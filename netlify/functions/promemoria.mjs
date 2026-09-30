// Promemoria automatici.
//
// Questa funzione non risponde a nessuna richiesta: la fa partire Netlify da
// sola, ogni mezz'ora (vedi `config.schedule` in fondo).
//
// Perché ogni mezz'ora e non due volte al giorno: il cron di Netlify ragiona
// in UTC, e un orario fisso si sposterebbe di un'ora a ogni cambio di ora
// legale. Girando spesso e decidendo qui in base all'ora italiana, il problema
// non si pone. Il costo è trascurabile — circa 2 crediti Netlify al mese.
//
// Perché non `pg_cron` dentro il database, come nel progetto della barberia:
// lì Supabase teneva il database sempre acceso. Neon invece lo spegne dopo 5
// minuti di inattività, e un cron interno a un database spento non parte.
// La sveglia deve stare fuori.

import { sql } from '../lib/db.mjs';
import { avvisa, chiavePubblica } from '../lib/push.mjs';
import { oggi, piuGiorni, oraItaliana, dataEstesa } from '../lib/calendario.mjs';

/** Ora italiana in cui esce il riepilogo della sera (per il giorno dopo). */
const ORA_SERA = 19;
/** Ora italiana in cui esce il riepilogo della mattina (per oggi). */
const ORA_MATTINA = 7;

/**
 * Segna che un avviso è stato mandato, e dice se era già stato mandato prima.
 * È l'inserimento stesso a fare da guardia: se la chiave esiste già,
 * `ON CONFLICT DO NOTHING` non tocca niente e non restituisce righe. Due
 * esecuzioni ravvicinate non possono quindi mandare due volte lo stesso
 * riepilogo, nemmeno se partissero nello stesso istante.
 */
async function primaVolta(chiave) {
  const righe = await sql()`
    INSERT INTO promemoria_inviati (chiave) VALUES (${chiave})
    ON CONFLICT (chiave) DO NOTHING
    RETURNING chiave
  `;
  return righe.length > 0;
}

/** Gli interventi ancora da fare in un certo giorno, raggruppati per persona. */
async function daFare(giorno) {
  return await sql()`
    SELECT
      a.assegnato_a,
      to_char(a.ora, 'HH24:MI') AS ora,
      a.nome_cliente,
      a.urgente
    FROM appuntamenti a
    WHERE a.stato = 'attivo' AND a.data = ${giorno}
    ORDER BY a.ora, a.id
  `;
}

function riassunto(elenco) {
  const urgenti = elenco.filter((a) => a.urgente).length;
  const parti = [`${elenco.length} ${elenco.length === 1 ? 'intervento' : 'interventi'}`];
  if (urgenti > 0) parti.push(`${urgenti} ${urgenti === 1 ? 'urgente' : 'urgenti'}`);
  return parti.join(' · ');
}

/**
 * Manda il riepilogo di un giorno a ogni installatore che ha qualcosa da fare,
 * e uno complessivo agli amministratori.
 */
async function riepilogo({ giorno, quandoDice, prefisso }) {
  const righe = await daFare(giorno);

  const perPersona = new Map();
  let senzaAssegnatario = 0;
  for (const r of righe) {
    if (r.assegnato_a === null) { senzaAssegnatario += 1; continue; }
    if (!perPersona.has(r.assegnato_a)) perPersona.set(r.assegnato_a, []);
    perPersona.get(r.assegnato_a).push(r);
  }

  const url = `/appuntamenti/?vista=giorno&giorno=${giorno}`;
  let mandati = 0;

  for (const [utenteId, suoi] of perPersona) {
    if (!(await primaVolta(`${prefisso}:${giorno}:u${utenteId}`))) continue;

    const primo = suoi[0];
    await avvisa([utenteId], {
      titolo: `${quandoDice}: ${riassunto(suoi)}`,
      testo: `Si comincia alle ${primo.ora} da ${primo.nome_cliente}` +
             (suoi.some((a) => a.urgente) ? ' · ci sono interventi urgenti' : ''),
      url,
      tag: `riepilogo-${giorno}`,
    });
    mandati += 1;
  }

  // A Tiziana il quadro d'insieme, più il promemoria di quello che resta da
  // assegnare: è la cosa che le sfugge più facilmente.
  const admin = await sql()`SELECT id FROM utenti WHERE ruolo = 'admin'`;
  for (const { id } of admin) {
    if (righe.length === 0 && senzaAssegnatario === 0) continue;
    if (!(await primaVolta(`${prefisso}:${giorno}:u${id}`))) continue;

    const pezzi = [];
    for (const [utenteId, suoi] of perPersona) {
      const nome = await nomeDi(utenteId);
      pezzi.push(`${nome}: ${suoi.length}`);
    }
    if (senzaAssegnatario > 0) {
      pezzi.push(`da assegnare: ${senzaAssegnatario}`);
    }

    await avvisa([id], {
      titolo: `${quandoDice}: ${riassunto(righe)}`,
      testo: pezzi.join(' · ') || 'Nessun intervento in programma',
      url,
      tag: `riepilogo-${giorno}`,
    });
    mandati += 1;
  }

  return mandati;
}

const nomiVisti = new Map();
async function nomeDi(id) {
  if (nomiVisti.has(id)) return nomiVisti.get(id);
  const righe = await sql()`SELECT nome FROM utenti WHERE id = ${id} LIMIT 1`;
  const nome = righe[0]?.nome ?? 'Installatore';
  nomiVisti.set(id, nome);
  return nome;
}

/** Ripulisce i segni più vecchi di un mese: non servono più a niente. */
async function ripulisci() {
  try {
    await sql()`DELETE FROM promemoria_inviati WHERE quando < now() - interval '30 days'`;
  } catch { /* la pulizia è un di più */ }
}

export default async () => {
  if (!chiavePubblica()) {
    console.log('Promemoria: chiavi VAPID non configurate, non c\'è niente da mandare.');
    return;
  }

  const { ore } = oraItaliana();
  let mandati = 0;

  if (ore === ORA_SERA) {
    const domani = piuGiorni(oggi(), 1);
    mandati = await riepilogo({
      giorno: domani,
      quandoDice: `Domani, ${dataEstesa(domani, { conAnno: false })}`,
      prefisso: 'sera',
    });
  } else if (ore === ORA_MATTINA) {
    const adesso = oggi();
    mandati = await riepilogo({
      giorno: adesso,
      quandoDice: 'Oggi',
      prefisso: 'mattina',
    });
    await ripulisci();
  }

  // Nel log niente nomi di clienti: solo quante notifiche sono partite.
  console.log(`Promemoria: ore ${ore} in Italia, ${mandati} riepiloghi inviati.`);
};

// Ogni mezz'ora. È la funzione stessa a decidere se è il momento di parlare.
export const config = { schedule: '*/30 * * * *' };
