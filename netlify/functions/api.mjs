// API del pannello appuntamenti.
//
// Una sola funzione serverless che risponde a tutto quello che sta sotto
// /api/. Netlify la instrada da sé grazie a `config.path` in fondo al file:
// non serve nessun reindirizzamento in netlify.toml.
//
// Tre principi che valgono per ogni endpoint:
//
//  1. I permessi si controllano QUI. Nascondere un pulsante nell'interfaccia
//     non è una protezione: un installatore che chiamasse a mano un endpoint
//     su un appuntamento non suo deve ricevere 403, e lo riceve.
//  2. Chi compie un'azione non viene avvisato della propria azione.
//  3. Niente dati dei clienti nei log. Gli errori si registrano per tipo, mai
//     con il contenuto della richiesta.

import { sql } from '../lib/db.mjs';
import {
  utenteCollegato, apriSessione, chiudiSessione, scadenzeDaRipulire,
  improntaSessioneCorrente,
} from '../lib/sessione.mjs';
import { verifica, cifra, bruciaTempo, LUNGHEZZA_MINIMA } from '../lib/password.mjs';
import { avvisa, chiavePubblica, conNotificheAttive } from '../lib/push.mjs';
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
const NON_TUO = 'Puoi modificare solo gli interventi assegnati a te';

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
// Il nome dell'assegnatario arriva da una giunzione, perché serve a ogni vista
// e chiederlo a parte significherebbe una query per riga.
const TABELLE = `FROM appuntamenti a LEFT JOIN utenti u ON u.id = a.assegnato_a`;

const SELEZIONE = `
  a.id,
  a.nome_cliente,
  a.luogo_impianto,
  a.telefono_cliente,
  a.prezzo_centesimi,
  to_char(a.data, 'YYYY-MM-DD') AS data,
  to_char(a.ora,  'HH24:MI')    AS ora,
  a.note,
  a.urgente,
  a.stato,
  a.assegnato_a,
  u.nome AS assegnato_nome,
  to_char(a.fatto_il AT TIME ZONE 'Europe/Rome', 'HH24:MI') AS fatto_alle
`;

function perIlBrowser(riga) {
  return {
    id: riga.id,
    nomeCliente: riga.nome_cliente,
    luogoImpianto: riga.luogo_impianto,
    telefonoCliente: riga.telefono_cliente,
    telefonoPerChiamata: telefonoPerChiamata(riga.telefono_cliente),
    // Per l'installatore che deve raggiungere l'indirizzo. Apre l'app mappe
    // predefinita del telefono, senza chiavi né tracciamenti da parte nostra.
    mappa: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(riga.luogo_impianto)}`,
    prezzoCentesimi: riga.prezzo_centesimi,
    prezzoConcordato: centesimiInPrezzo(riga.prezzo_centesimi),
    data: riga.data,
    ora: riga.ora,
    note: riga.note,
    urgente: riga.urgente,
    stato: riga.stato,
    fatto: riga.stato === 'fatto',
    fattoAlle: riga.fatto_alle,
    assegnatoA: riga.assegnato_a,
    assegnatoNome: riga.assegnato_nome,
  };
}

/** Legge un appuntamento non annullato, con il nome dell'assegnatario. */
async function leggiAppuntamento(id) {
  const righe = await sql().query(
    `SELECT ${SELEZIONE} ${TABELLE} WHERE a.id = $1 AND a.stato <> 'annullato' LIMIT 1`,
    [id],
  );
  return righe[0] ?? null;
}

/** Riconosce il rifiuto dell'indice unico parziale sulla fascia. */
function fasciaOccupata(e) {
  return e?.code === '23505' || String(e?.message ?? '').includes('una_per_fascia');
}

const occupata = (chi) => errore(
  chi ? `${chi} ha già un intervento in questa fascia` : 'Fascia già occupata',
  409,
  { campi: { ora: 'Fascia già occupata' } },
);

/**
 * Chi può toccare questo appuntamento.
 * L'amministratore tutto; l'installatore soltanto quelli assegnati a lui.
 * Un intervento ancora da assegnare è quindi di sola Tiziana, ed è giusto:
 * è lei che decide chi ci va.
 */
function puoToccare(utente, appuntamento) {
  return utente.ruolo === 'admin' || appuntamento.assegnato_a === utente.id;
}

// ---------------------------------------------------------------------------
// Utenti
// ---------------------------------------------------------------------------

async function elencoUtenti() {
  return await sql()`
    SELECT id, nome, ruolo, posizione
    FROM utenti
    ORDER BY posizione, id
  `;
}

async function idsAmministratori() {
  const righe = await sql()`SELECT id FROM utenti WHERE ruolo = 'admin'`;
  return righe.map((r) => r.id);
}

/** L'id esiste ed è di un installatore? Serve prima di assegnare. */
async function installatoreValido(id) {
  if (!Number.isInteger(id)) return false;
  const righe = await sql()`
    SELECT 1 FROM utenti WHERE id = ${id} AND ruolo = 'installatore' LIMIT 1
  `;
  return righe.length > 0;
}

// ---------------------------------------------------------------------------
// Notifiche
// ---------------------------------------------------------------------------

/**
 * Avvisa chi deve sapere, mai chi ha appena agito.
 *
 * Nella notifica finiscono solo giorno, ora e nome del cliente: indirizzo,
 * telefono e prezzo restano nel pannello, dietro il login.
 */
async function notifica(titolo, appuntamento, attore, { anche = [] } = {}) {
  try {
    const destinatari = [appuntamento.assegnato_a, ...anche]
      .filter((id) => Number.isInteger(id) && id !== attore.id);
    if (destinatari.length === 0) return;

    const quando = dataEstesa(appuntamento.data, { conAnno: false });
    await avvisa(destinatari, {
      titolo,
      testo: `${quando} alle ${appuntamento.ora} · ${appuntamento.nome_cliente}` +
             (appuntamento.urgente ? ' · Urgente' : ''),
      url: `/appuntamenti/?vista=giorno&giorno=${appuntamento.data}`,
      tag: `app-${appuntamento.id}`,
    });
  } catch (e) {
    // Un problema con le notifiche non deve far fallire il salvataggio.
    console.warn('Notifica non inviata:', e?.message);
  }
}

/** Gli amministratori, da avvisare quando è un installatore a muovere qualcosa. */
async function ancheGliAdmin(attore) {
  return attore.ruolo === 'admin' ? [] : await idsAmministratori();
}

// ---------------------------------------------------------------------------
// Accesso
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
    SELECT id, nome, email, ruolo, password_hash, deve_cambiare_password
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

  return risposta({ utente: perIlPannello(utente) }, 200, { 'Set-Cookie': cookie });
}

/** I dati dell'utente che il browser può conoscere. Mai il digest della password. */
function perIlPannello(utente) {
  return {
    id: utente.id,
    nome: utente.nome,
    email: utente.email,
    ruolo: utente.ruolo,
    deveCambiarePassword: utente.deve_cambiare_password === true,
  };
}

async function postPassword(req, utente) {
  const corpo = await leggiJson(req);
  const attuale = String(corpo?.attuale ?? '');
  const nuova = String(corpo?.nuova ?? '');

  const righe = await sql()`SELECT password_hash FROM utenti WHERE id = ${utente.id} LIMIT 1`;
  if (!righe[0] || !(await verifica(attuale, righe[0].password_hash))) {
    return risposta(
      { errore: 'La password attuale non è corretta', campi: { attuale: 'Password non corretta' } },
      400,
    );
  }
  if (nuova.length < LUNGHEZZA_MINIMA) {
    return risposta(
      { errore: 'La nuova password è troppo corta',
        campi: { nuova: `Servono almeno ${LUNGHEZZA_MINIMA} caratteri` } },
      400,
    );
  }
  if (nuova === attuale) {
    return risposta(
      { errore: 'La nuova password deve essere diversa da quella attuale',
        campi: { nuova: 'Dev\'essere diversa da quella attuale' } },
      400,
    );
  }

  const database = sql();
  await database`
    UPDATE utenti
    SET password_hash = ${await cifra(nuova)}, deve_cambiare_password = false
    WHERE id = ${utente.id}
  `;

  // Chi conosceva la vecchia password viene disconnesso ovunque; resta aperta
  // solo la sessione da cui si sta operando.
  const corrente = improntaSessioneCorrente(req);
  await database`
    DELETE FROM sessioni WHERE utente_id = ${utente.id} AND token_hash <> ${corrente}
  `;

  return risposta({ cambiata: true });
}

async function postLogout(req) {
  const cookie = await chiudiSessione(req);
  return risposta({ uscito: true }, 200, { 'Set-Cookie': cookie });
}

// ---------------------------------------------------------------------------
// Appuntamenti
// ---------------------------------------------------------------------------

async function getAppuntamenti(url) {
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

  // Gli annullati non compaiono in nessuna vista; i fatti sì, barrati.
  const righe = await sql().query(
    `SELECT ${SELEZIONE} ${TABELLE}
     WHERE a.stato <> 'annullato' AND a.data BETWEEN $1 AND $2
     ORDER BY a.data, a.ora, a.id`,
    [dal, al],
  );
  return risposta({ appuntamenti: righe.map(perIlBrowser) });
}

/**
 * A chi va assegnato un appuntamento in creazione.
 * L'installatore può crearne solo di suoi: qualunque cosa chieda, il lavoro
 * resta suo. Tiziana può assegnarlo a chi vuole o lasciarlo da assegnare.
 */
async function assegnatarioRichiesto(corpo, utente) {
  if (utente.ruolo !== 'admin') return { id: utente.id };

  const grezzo = corpo?.assegnatoA;
  if (grezzo === null || grezzo === undefined || grezzo === '') return { id: null };

  const id = Number(grezzo);
  if (!(await installatoreValido(id))) {
    return { errore: 'Installatore non valido' };
  }
  return { id };
}

async function postAppuntamento(req, utente) {
  const corpo = await leggiJson(req);
  const { valori, errori } = validaAppuntamento(corpo);

  const assegnatario = await assegnatarioRichiesto(corpo, utente);
  if (assegnatario.errore) errori.assegnatoA = assegnatario.errore;

  if (Object.keys(errori).length > 0) {
    return risposta({ errore: 'Controlla i campi segnalati', campi: errori }, 400);
  }

  let id;
  try {
    const righe = await sql().query(
      `INSERT INTO appuntamenti
         (nome_cliente, luogo_impianto, telefono_cliente, prezzo_centesimi,
          data, ora, note, urgente, assegnato_a, creato_da)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        valori.nomeCliente, valori.luogoImpianto, valori.telefonoCliente,
        valori.prezzoCentesimi, valori.data, valori.ora, valori.note,
        valori.urgente, assegnatario.id, utente.id,
      ],
    );
    id = righe[0].id;
  } catch (e) {
    if (fasciaOccupata(e)) return occupata(null);
    throw e;
  }

  const creato = await leggiAppuntamento(id);
  await notifica('Nuovo intervento', creato, utente, { anche: await ancheGliAdmin(utente) });
  return risposta({ appuntamento: perIlBrowser(creato) }, 201);
}

async function patchAppuntamento(req, id, utente) {
  const esistente = await leggiAppuntamento(id);
  if (!esistente) return errore('Appuntamento non trovato', 404);
  if (!puoToccare(utente, esistente)) return errore(NON_TUO, 403);

  const corpo = await leggiJson(req);
  const { valori, errori } = validaAppuntamento(corpo);

  // Solo Tiziana può cambiare l'assegnatario da questa schermata; per
  // l'installatore resta quello che c'era (per passare un lavoro a un collega
  // esiste /assegna, che avvisa le persone giuste).
  let assegnatoA = esistente.assegnato_a;
  if (utente.ruolo === 'admin' && 'assegnatoA' in (corpo ?? {})) {
    const scelto = await assegnatarioRichiesto(corpo, utente);
    if (scelto.errore) errori.assegnatoA = scelto.errore;
    else assegnatoA = scelto.id;
  }

  if (Object.keys(errori).length > 0) {
    return risposta({ errore: 'Controlla i campi segnalati', campi: errori }, 400);
  }

  try {
    const righe = await sql().query(
      `UPDATE appuntamenti SET
         nome_cliente = $1, luogo_impianto = $2, telefono_cliente = $3,
         prezzo_centesimi = $4, data = $5, ora = $6, note = $7, urgente = $8,
         assegnato_a = $9, aggiornato_il = now()
       WHERE id = $10 AND stato <> 'annullato'
       RETURNING id`,
      [
        valori.nomeCliente, valori.luogoImpianto, valori.telefonoCliente,
        valori.prezzoCentesimi, valori.data, valori.ora, valori.note,
        valori.urgente, assegnatoA, id,
      ],
    );
    if (righe.length === 0) return errore('Appuntamento non trovato', 404);
  } catch (e) {
    if (fasciaOccupata(e)) return occupata(esistente.assegnato_nome);
    throw e;
  }

  const aggiornato = await leggiAppuntamento(id);
  const spostato = aggiornato.data !== esistente.data || aggiornato.ora !== esistente.ora;
  await notifica(
    spostato ? 'Intervento spostato' : 'Intervento aggiornato',
    aggiornato, utente,
    { anche: [...(await ancheGliAdmin(utente)), esistente.assegnato_a] },
  );
  return risposta({ appuntamento: perIlBrowser(aggiornato) });
}

async function patchRimanda(req, id, utente) {
  const esistente = await leggiAppuntamento(id);
  if (!esistente) return errore('Appuntamento non trovato', 404);
  if (!puoToccare(utente, esistente)) return errore(NON_TUO, 403);

  const corpo = await leggiJson(req);
  const { valori, errori } = validaSpostamento(corpo);
  if (Object.keys(errori).length > 0) {
    return risposta({ errore: 'Controlla i campi segnalati', campi: errori }, 400);
  }

  try {
    // Solo data e ora: tutto il resto della scheda resta com'era.
    const righe = await sql().query(
      `UPDATE appuntamenti SET data = $1, ora = $2, aggiornato_il = now()
       WHERE id = $3 AND stato <> 'annullato'
       RETURNING id`,
      [valori.data, valori.ora, id],
    );
    if (righe.length === 0) return errore('Appuntamento non trovato', 404);
  } catch (e) {
    if (fasciaOccupata(e)) return occupata(esistente.assegnato_nome);
    throw e;
  }

  const spostato = await leggiAppuntamento(id);
  await notifica('Intervento spostato', spostato, utente, { anche: await ancheGliAdmin(utente) });
  return risposta({ appuntamento: perIlBrowser(spostato) });
}

/** Passaggio di consegne, e assegnazione dal mucchio "da assegnare". */
async function patchAssegna(req, id, utente) {
  const esistente = await leggiAppuntamento(id);
  if (!esistente) return errore('Appuntamento non trovato', 404);
  if (!puoToccare(utente, esistente)) return errore(NON_TUO, 403);

  const corpo = await leggiJson(req);
  const grezzo = corpo?.assegnatoA;
  const nessuno = grezzo === null || grezzo === undefined || grezzo === '';

  if (!nessuno && !(await installatoreValido(Number(grezzo)))) {
    return errore('Installatore non valido', 400);
  }
  const nuovo = nessuno ? null : Number(grezzo);
  if (nuovo === esistente.assegnato_a) {
    return risposta({ appuntamento: perIlBrowser(esistente) });
  }

  try {
    const righe = await sql().query(
      `UPDATE appuntamenti SET assegnato_a = $1, aggiornato_il = now()
       WHERE id = $2 AND stato <> 'annullato'
       RETURNING id`,
      [nuovo, id],
    );
    if (righe.length === 0) return errore('Appuntamento non trovato', 404);
  } catch (e) {
    if (fasciaOccupata(e)) {
      return errore(
        'Chi hai scelto ha già un intervento in quella fascia',
        409,
        { campi: { assegnatoA: 'Fascia già occupata' } },
      );
    }
    throw e;
  }

  const aggiornato = await leggiAppuntamento(id);
  // Avvisiamo chi lo riceve, chi lo perde, e Tiziana se la mossa è partita da
  // un installatore: deve sapere chi va dove.
  await notifica('Intervento assegnato a te', aggiornato, utente, {
    anche: [...(await ancheGliAdmin(utente)), esistente.assegnato_a],
  });
  return risposta({ appuntamento: perIlBrowser(aggiornato) });
}

/** Segna l'intervento come eseguito, o torna indietro se è stato un errore. */
async function postFatto(req, id, utente) {
  const esistente = await leggiAppuntamento(id);
  if (!esistente) return errore('Appuntamento non trovato', 404);
  if (!puoToccare(utente, esistente)) return errore(NON_TUO, 403);

  const corpo = await leggiJson(req);
  const fatto = corpo?.fatto !== false; // senza corpo, l'intenzione è segnarlo fatto

  await sql().query(
    `UPDATE appuntamenti
     SET stato = $1, fatto_il = $2, aggiornato_il = now()
     WHERE id = $3 AND stato <> 'annullato'`,
    [fatto ? 'fatto' : 'attivo', fatto ? new Date().toISOString() : null, id],
  );

  const aggiornato = await leggiAppuntamento(id);
  await notifica(
    fatto ? 'Intervento completato' : 'Intervento riaperto',
    aggiornato, utente,
    { anche: await idsAmministratori() },
  );
  return risposta({ appuntamento: perIlBrowser(aggiornato) });
}

async function postAnnulla(req, id, utente) {
  const esistente = await leggiAppuntamento(id);
  if (!esistente) return errore('Appuntamento non trovato', 404);
  if (!puoToccare(utente, esistente)) return errore(NON_TUO, 403);

  await sql().query(
    `UPDATE appuntamenti SET stato = 'annullato', fatto_il = NULL, aggiornato_il = now()
     WHERE id = $1`,
    [id],
  );

  await notifica('Intervento annullato', esistente, utente, {
    anche: await idsAmministratori(),
  });
  return risposta({ annullato: true, id });
}

// ---------------------------------------------------------------------------
// Notifiche push: iscrizione dei dispositivi
// ---------------------------------------------------------------------------

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
      return risposta({ utente: perIlPannello(utente) });
    }

    // Ogni scrittura deve arrivare dal nostro stesso sito.
    if (metodo !== 'GET' && !origineLecita(req)) {
      return errore('Richiesta non valida', 403);
    }

    if (percorso === '/password' && metodo === 'POST') {
      return await postPassword(req, utente);
    }

    // Con una password provvisoria non si fa nient'altro che cambiarla. Il
    // blocco è qui e non solo nell'interfaccia: una sessione aperta con la
    // password provvisoria non deve poter leggere i dati dei clienti
    // chiamando gli indirizzi a mano.
    if (utente.deve_cambiare_password === true) {
      return errore('Devi prima scegliere una password tua', 403, { cambiaPassword: true });
    }

    // --- lettura: entrambi i ruoli vedono tutto ---------------------------
    // Michele e Alessandro si vedono fra loro: sapere che il collega è già in
    // zona serve, ed evita due interventi allo stesso indirizzo.
    if (percorso === '/utenti' && metodo === 'GET') {
      const utenti = await elencoUtenti();
      const conNotifiche = await conNotificheAttive(utenti.map((u) => u.id));
      return risposta({
        utenti: utenti.map((u) => ({
          id: u.id,
          nome: u.nome,
          ruolo: u.ruolo,
          posizione: u.posizione,
          notificheAttive: conNotifiche.has(u.id),
        })),
      });
    }

    if (percorso === '/appuntamenti' && metodo === 'GET') {
      return await getAppuntamenti(url);
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

    // --- scrittura --------------------------------------------------------
    // Non c'è più un blocco unico per ruolo: ogni handler controlla se
    // l'appuntamento è di chi lo sta toccando (`puoToccare`), perché ora
    // l'installatore può agire, ma solo sui propri.
    if (percorso === '/appuntamenti' && metodo === 'POST') {
      return await postAppuntamento(req, utente);
    }
    if (dettaglio && metodo === 'PATCH') {
      return await patchAppuntamento(req, Number(dettaglio[1]), utente);
    }
    const rimanda = /^\/appuntamenti\/(\d+)\/rimanda$/.exec(percorso);
    if (rimanda && metodo === 'PATCH') {
      return await patchRimanda(req, Number(rimanda[1]), utente);
    }
    const assegna = /^\/appuntamenti\/(\d+)\/assegna$/.exec(percorso);
    if (assegna && metodo === 'PATCH') {
      return await patchAssegna(req, Number(assegna[1]), utente);
    }
    const segnaFatto = /^\/appuntamenti\/(\d+)\/fatto$/.exec(percorso);
    if (segnaFatto && metodo === 'POST') {
      return await postFatto(req, Number(segnaFatto[1]), utente);
    }
    const annulla = /^\/appuntamenti\/(\d+)\/annulla$/.exec(percorso);
    if (annulla && metodo === 'POST') {
      return await postAnnulla(req, Number(annulla[1]), utente);
    }

    return errore('Indirizzo non trovato', 404);
  } catch (e) {
    // Nel log finisce il tipo di errore, mai il contenuto della richiesta.
    console.error('Errore API:', e?.message);
    return errore('Errore del server. Riprova.', 500);
  }
};

export const config = { path: '/api/*' };
