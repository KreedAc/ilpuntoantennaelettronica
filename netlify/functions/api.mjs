// API del pannello appuntamenti.
//
// Una sola funzione serverless che risponde a tutto quello che sta sotto
// /api/. Netlify la instrada da sé grazie a `config.path` in fondo al file:
// non serve nessun reindirizzamento in netlify.toml.
//
// Due principi che valgono per ogni endpoint:
//
//  1. I permessi si controllano QUI. Nascondere un pulsante nell'interfaccia
//     non è una protezione: un installatore che chiamasse a mano un endpoint
//     di scrittura deve ricevere 403, e lo riceve.
//  2. Niente dati dei clienti nei log. Gli errori si registrano per tipo, mai
//     con il contenuto della richiesta.

import { sql } from '../lib/db.mjs';
import { utenteCollegato, apriSessione, chiudiSessione, scadenzeDaRipulire } from '../lib/sessione.mjs';
import { verifica, bruciaTempo } from '../lib/password.mjs';
import { avvisaInstallatori, chiavePubblica } from '../lib/push.mjs';
import {
  FASCE, ORA_INIZIO, ORA_FINE, PASSO_MINUTI,
  TENTATIVI_MASSIMI, FINESTRA_TENTATIVI_MINUTI,
} from '../lib/configurazione.mjs';
import {
  validaAppuntamento, validaSpostamento,
  centesimiInPrezzo, telefonoPerChiamata, dataValida,
} from '../lib/validazione.mjs';
import { dataEstesa } from '../lib/calendario.mjs';

// ---------------------------------------------------------------------------
// Risposte
// ---------------------------------------------------------------------------

const INTESTAZIONI_BASE = {
  'Content-Type': 'application/json; charset=utf-8',
  // Nessuna cache, da nessuna parte: qui dentro ci sono dati dei clienti.
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
};

function risposta(corpo, stato = 200, intestazioniExtra = {}) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...INTESTAZIONI_BASE, ...intestazioniExtra },
  });
}

const errore = (messaggio, stato, extra = {}) => risposta({ errore: messaggio, ...extra }, stato);

// ---------------------------------------------------------------------------
// Lettura del corpo della richiesta
// ---------------------------------------------------------------------------

const CORPO_MASSIMO = 64 * 1024;

async function leggiJson(req) {
  const dichiarata = Number(req.headers.get('content-length') ?? 0);
  if (dichiarata > CORPO_MASSIMO) return null;
  try {
    const testo = await req.text();
    if (testo.length > CORPO_MASSIMO || testo.trim() === '') return null;
    const dati = JSON.parse(testo);
    return dati !== null && typeof dati === 'object' ? dati : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Protezione CSRF
// ---------------------------------------------------------------------------
// Il cookie è già SameSite=Strict, quindi un altro sito non riesce a farlo
// viaggiare. Questo è il secondo lucchetto: su ogni richiesta che modifica
// dati pretendiamo che Origin sia il nostro stesso dominio.

function origineLecita(req) {
  const origine = req.headers.get('origin');
  if (!origine) return false;
  try {
    return new URL(origine).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Limite ai tentativi di accesso
// ---------------------------------------------------------------------------

function indirizzo(req) {
  return (
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'sconosciuto'
  );
}

async function troppiTentativi(chiave) {
  const righe = await sql().query(
    `SELECT count(*)::int AS quanti
     FROM tentativi_accesso
     WHERE chiave = $1
       AND quando > now() - ($2::int * interval '1 minute')`,
    [chiave, FINESTRA_TENTATIVI_MINUTI],
  );
  return righe[0].quanti >= TENTATIVI_MASSIMI;
}

async function segnaTentativo(chiave) {
  const database = sql();
  await database`INSERT INTO tentativi_accesso (chiave) VALUES (${chiave})`;
  // Pulizia opportunistica della coda vecchia, così la tabella non cresce.
  await database.query(
    `DELETE FROM tentativi_accesso WHERE quando < now() - ($1::int * interval '1 minute')`,
    [FINESTRA_TENTATIVI_MINUTI],
  );
}

// ---------------------------------------------------------------------------
// Appuntamenti: lettura e conversione
// ---------------------------------------------------------------------------

// `data` e `ora` escono dal database già come testo: così nessuna conversione
// automatica del driver può spostare un appuntamento di un giorno o di un'ora.
const SELEZIONE = `
  id,
  nome_cliente,
  luogo_impianto,
  telefono_cliente,
  prezzo_centesimi,
  to_char(data, 'YYYY-MM-DD') AS data,
  to_char(ora,  'HH24:MI')    AS ora,
  note,
  urgente,
  stato
`;

function perIlBrowser(riga) {
  return {
    id: riga.id,
    nomeCliente: riga.nome_cliente,
    luogoImpianto: riga.luogo_impianto,
    telefonoCliente: riga.telefono_cliente,
    telefonoPerChiamata: telefonoPerChiamata(riga.telefono_cliente),
    prezzoCentesimi: riga.prezzo_centesimi,
    prezzoConcordato: centesimiInPrezzo(riga.prezzo_centesimi),
    data: riga.data,
    ora: riga.ora,
    note: riga.note,
    urgente: riga.urgente,
  };
}

async function leggiAppuntamento(id) {
  const righe = await sql().query(
    `SELECT ${SELEZIONE} FROM appuntamenti WHERE id = $1 AND stato = 'attivo' LIMIT 1`,
    [id],
  );
  return righe[0] ?? null;
}

/** Riconosce il rifiuto dell'indice unico parziale sulla fascia. */
function fasciaOccupata(e) {
  return e?.code === '23505' || String(e?.message ?? '').includes('appuntamenti_una_per_fascia');
}

// ---------------------------------------------------------------------------
// Endpoint
// ---------------------------------------------------------------------------

async function postLogin(req) {
  const corpo = await leggiJson(req);
  const email = String(corpo?.email ?? '').trim().toLowerCase();
  const password = String(corpo?.password ?? '');

  if (!email || !password) {
    return errore('Credenziali non valide', 401);
  }

  // Il conteggio è per indirizzo IP e per email insieme: così né chi prova
  // tante email dallo stesso posto, né chi attacca una sola email da posti
  // diversi, riesce ad andare avanti all'infinito.
  const chiaveIp = `ip:${indirizzo(req)}`;
  const chiaveEmail = `email:${email}`;

  if (await troppiTentativi(chiaveIp) || await troppiTentativi(chiaveEmail)) {
    return errore(
      `Troppi tentativi di accesso. Riprova fra ${FINESTRA_TENTATIVI_MINUTI} minuti.`,
      429,
    );
  }

  const righe = await sql()`
    SELECT id, nome, email, ruolo, password_hash
    FROM utenti
    WHERE lower(email) = ${email}
    LIMIT 1
  `;
  const utente = righe[0];

  // Se l'email non esiste calcoliamo comunque un hash, per non far capire dal
  // tempo di risposta quali indirizzi sono registrati.
  if (!utente) {
    await bruciaTempo();
    await segnaTentativo(chiaveIp);
    await segnaTentativo(chiaveEmail);
    return errore('Credenziali non valide', 401);
  }

  if (!(await verifica(password, utente.password_hash))) {
    await segnaTentativo(chiaveIp);
    await segnaTentativo(chiaveEmail);
    return errore('Credenziali non valide', 401);
  }

  const cookie = await apriSessione(utente.id);
  await scadenzeDaRipulire();

  return risposta(
    { utente: { nome: utente.nome, email: utente.email, ruolo: utente.ruolo } },
    200,
    { 'Set-Cookie': cookie },
  );
}

async function postLogout(req) {
  const cookie = await chiudiSessione(req);
  return risposta({ uscito: true }, 200, { 'Set-Cookie': cookie });
}

async function getAppuntamenti(req, url) {
  const dal = url.searchParams.get('dal');
  const al = url.searchParams.get('al');

  if (!dataValida(dal) || !dataValida(al)) {
    return errore('Intervallo non valido: servono `dal` e `al` in formato YYYY-MM-DD', 400);
  }
  if (dal > al) {
    return errore('Intervallo non valido: `dal` viene dopo `al`', 400);
  }
  // Un tetto all'ampiezza evita che una richiesta scarichi l'intero archivio.
  const giorni = (Date.parse(`${al}T00:00:00Z`) - Date.parse(`${dal}T00:00:00Z`)) / 86400000;
  if (giorni > 92) {
    return errore('Intervallo troppo ampio: al massimo 92 giorni', 400);
  }

  const righe = await sql().query(
    `SELECT ${SELEZIONE} FROM appuntamenti
     WHERE stato = 'attivo' AND data BETWEEN $1 AND $2
     ORDER BY data, ora`,
    [dal, al],
  );
  return risposta({ appuntamenti: righe.map(perIlBrowser) });
}

async function postAppuntamento(req, utente) {
  const corpo = await leggiJson(req);
  const { valori, errori } = validaAppuntamento(corpo);
  if (Object.keys(errori).length > 0) {
    return risposta({ errore: 'Controlla i campi segnalati', campi: errori }, 400);
  }

  let creato;
  try {
    const righe = await sql().query(
      `INSERT INTO appuntamenti
         (nome_cliente, luogo_impianto, telefono_cliente, prezzo_centesimi,
          data, ora, note, urgente, creato_da)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${SELEZIONE}`,
      [
        valori.nomeCliente, valori.luogoImpianto, valori.telefonoCliente,
        valori.prezzoCentesimi, valori.data, valori.ora, valori.note,
        valori.urgente, utente.id,
      ],
    );
    creato = righe[0];
  } catch (e) {
    if (fasciaOccupata(e)) return errore('Fascia già occupata', 409, { campi: { ora: 'Fascia già occupata' } });
    throw e;
  }

  await notifica('Nuovo appuntamento', creato);
  return risposta({ appuntamento: perIlBrowser(creato) }, 201);
}

async function patchAppuntamento(req, id) {
  const esistente = await leggiAppuntamento(id);
  if (!esistente) return errore('Appuntamento non trovato', 404);

  const corpo = await leggiJson(req);
  const { valori, errori } = validaAppuntamento(corpo);
  if (Object.keys(errori).length > 0) {
    return risposta({ errore: 'Controlla i campi segnalati', campi: errori }, 400);
  }

  let aggiornato;
  try {
    const righe = await sql().query(
      `UPDATE appuntamenti SET
         nome_cliente = $1, luogo_impianto = $2, telefono_cliente = $3,
         prezzo_centesimi = $4, data = $5, ora = $6, note = $7, urgente = $8,
         aggiornato_il = now()
       WHERE id = $9 AND stato = 'attivo'
       RETURNING ${SELEZIONE}`,
      [
        valori.nomeCliente, valori.luogoImpianto, valori.telefonoCliente,
        valori.prezzoCentesimi, valori.data, valori.ora, valori.note,
        valori.urgente, id,
      ],
    );
    aggiornato = righe[0];
  } catch (e) {
    if (fasciaOccupata(e)) return errore('Fascia già occupata', 409, { campi: { ora: 'Fascia già occupata' } });
    throw e;
  }

  if (!aggiornato) return errore('Appuntamento non trovato', 404);

  const spostato = aggiornato.data !== esistente.data || aggiornato.ora !== esistente.ora;
  await notifica(spostato ? 'Appuntamento spostato' : 'Appuntamento aggiornato', aggiornato);
  return risposta({ appuntamento: perIlBrowser(aggiornato) });
}

async function patchRimanda(req, id) {
  if (!(await leggiAppuntamento(id))) return errore('Appuntamento non trovato', 404);

  const corpo = await leggiJson(req);
  const { valori, errori } = validaSpostamento(corpo);
  if (Object.keys(errori).length > 0) {
    return risposta({ errore: 'Controlla i campi segnalati', campi: errori }, 400);
  }

  let spostato;
  try {
    // Solo data e ora: tutto il resto della scheda resta com'era.
    const righe = await sql().query(
      `UPDATE appuntamenti SET data = $1, ora = $2, aggiornato_il = now()
       WHERE id = $3 AND stato = 'attivo'
       RETURNING ${SELEZIONE}`,
      [valori.data, valori.ora, id],
    );
    spostato = righe[0];
  } catch (e) {
    if (fasciaOccupata(e)) return errore('Fascia già occupata', 409, { campi: { ora: 'Fascia già occupata' } });
    throw e;
  }

  if (!spostato) return errore('Appuntamento non trovato', 404);

  await notifica('Appuntamento spostato', spostato);
  return risposta({ appuntamento: perIlBrowser(spostato) });
}

async function postAnnulla(req, id) {
  const righe = await sql().query(
    `UPDATE appuntamenti SET stato = 'annullato', aggiornato_il = now()
     WHERE id = $1 AND stato = 'attivo'
     RETURNING ${SELEZIONE}`,
    [id],
  );
  const annullato = righe[0];
  if (!annullato) return errore('Appuntamento non trovato', 404);

  await notifica('Appuntamento annullato', annullato);
  return risposta({ annullato: true, id: annullato.id });
}

/**
 * Avvisa gli installatori. Nella notifica finiscono solo giorno, ora e nome:
 * indirizzo, telefono e prezzo restano nel pannello, dietro il login.
 */
async function notifica(titolo, appuntamento) {
  try {
    const quando = dataEstesa(appuntamento.data, { conAnno: false });
    await avvisaInstallatori({
      titolo,
      testo: `${quando} alle ${appuntamento.ora} · ${appuntamento.nome_cliente}` +
             (appuntamento.urgente ? ' · Urgente' : ''),
      url: `/appuntamenti/?vista=giorno&giorno=${appuntamento.data}`,
    });
  } catch (e) {
    // Un problema con le notifiche non deve far fallire il salvataggio.
    console.warn('Notifica non inviata:', e?.message);
  }
}

// --- notifiche push: iscrizione dei dispositivi ----------------------------

async function postIscrizionePush(req, utente) {
  const corpo = await leggiJson(req);
  const endpoint = String(corpo?.endpoint ?? '');
  const p256dh = String(corpo?.chiavi?.p256dh ?? '');
  const auth = String(corpo?.chiavi?.auth ?? '');

  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    return errore('Iscrizione non valida', 400);
  }

  await sql()`
    INSERT INTO push_iscrizioni (endpoint, utente_id, p256dh, auth)
    VALUES (${endpoint}, ${utente.id}, ${p256dh}, ${auth})
    ON CONFLICT (endpoint) DO UPDATE
      SET utente_id = EXCLUDED.utente_id,
          p256dh    = EXCLUDED.p256dh,
          auth      = EXCLUDED.auth
  `;
  return risposta({ iscritto: true });
}

async function deleteIscrizionePush(req, utente) {
  const corpo = await leggiJson(req);
  const endpoint = String(corpo?.endpoint ?? '');
  if (endpoint) {
    await sql()`
      DELETE FROM push_iscrizioni
      WHERE endpoint = ${endpoint} AND utente_id = ${utente.id}
    `;
  }
  return risposta({ iscritto: false });
}

// ---------------------------------------------------------------------------
// Instradamento
// ---------------------------------------------------------------------------

export default async (req) => {
  const url = new URL(req.url);
  const percorso = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
  const metodo = req.method.toUpperCase();

  try {
    // --- pubblico ---------------------------------------------------------
    if (percorso === '/configurazione' && metodo === 'GET') {
      return risposta({
        fasce: FASCE,
        oraInizio: ORA_INIZIO,
        oraFine: ORA_FINE,
        passoMinuti: PASSO_MINUTI,
        chiavePush: chiavePubblica(),
      });
    }

    if (percorso === '/login' && metodo === 'POST') {
      if (!origineLecita(req)) return errore('Richiesta non valida', 403);
      return await postLogin(req);
    }

    // --- da qui in poi serve la sessione ----------------------------------
    const utente = await utenteCollegato(req);

    if (percorso === '/logout' && metodo === 'POST') {
      if (!origineLecita(req)) return errore('Richiesta non valida', 403);
      return await postLogout(req);
    }

    if (!utente) return errore('Non autenticato', 401);

    if (percorso === '/sessione' && metodo === 'GET') {
      return risposta({ utente: { nome: utente.nome, email: utente.email, ruolo: utente.ruolo } });
    }

    // Ogni scrittura deve arrivare dal nostro stesso sito.
    if (metodo !== 'GET' && !origineLecita(req)) {
      return errore('Richiesta non valida', 403);
    }

    // --- lettura: admin e installatore ------------------------------------
    if (percorso === '/appuntamenti' && metodo === 'GET') {
      return await getAppuntamenti(req, url);
    }

    const dettaglio = /^\/appuntamenti\/(\d+)$/.exec(percorso);
    if (dettaglio && metodo === 'GET') {
      const riga = await leggiAppuntamento(Number(dettaglio[1]));
      if (!riga) return errore('Appuntamento non trovato', 404);
      return risposta({ appuntamento: perIlBrowser(riga) });
    }

    // --- iscrizione alle notifiche: entrambi i ruoli ----------------------
    if (percorso === '/push/iscrizione') {
      if (metodo === 'POST') return await postIscrizionePush(req, utente);
      if (metodo === 'DELETE') return await deleteIscrizionePush(req, utente);
    }

    // --- scrittura: solo amministratore -----------------------------------
    const scritture =
      (percorso === '/appuntamenti' && metodo === 'POST') ||
      (metodo !== 'GET' && /^\/appuntamenti\/\d+(\/(rimanda|annulla))?$/.test(percorso));

    if (scritture && utente.ruolo !== 'admin') {
      return errore('Questa operazione è riservata all\'amministratore', 403);
    }

    if (percorso === '/appuntamenti' && metodo === 'POST') {
      return await postAppuntamento(req, utente);
    }
    if (dettaglio && metodo === 'PATCH') {
      return await patchAppuntamento(req, Number(dettaglio[1]));
    }
    const rimanda = /^\/appuntamenti\/(\d+)\/rimanda$/.exec(percorso);
    if (rimanda && metodo === 'PATCH') {
      return await patchRimanda(req, Number(rimanda[1]));
    }
    const annulla = /^\/appuntamenti\/(\d+)\/annulla$/.exec(percorso);
    if (annulla && metodo === 'POST') {
      return await postAnnulla(req, Number(annulla[1]));
    }

    return errore('Indirizzo non trovato', 404);
  } catch (e) {
    // Nel log finisce il tipo di errore, mai il contenuto della richiesta.
    console.error('Errore API:', e?.message);
    return errore('Errore del server. Riprova.', 500);
  }
};

export const config = { path: '/api/*' };
