// Promemoria: un avviso circa un'ora prima di ogni intervento.
//
// Questa funzione non risponde a nessuna richiesta: la fa partire Netlify da
// sola, ogni mezz'ora nelle ore che servono (vedi `config.schedule` in fondo).
// Mezz'ora è anche il passo delle fasce, quindi ogni appuntamento cade in una
// sola finestra.
//
// Perché non `pg_cron` dentro il database, come nel progetto della barberia:
// lì Supabase teneva il database sempre acceso. Neon invece lo spegne dopo 5
// minuti di inattività, e un cron interno a un database spento non parte.
// La sveglia deve stare fuori.
//
// Costo: poco più di un credito Netlify al mese, cioè un centesimo.

import { sql } from '../lib/db.mjs';
import { avvisa, chiavePubblica } from '../lib/push.mjs';
import { oraItaliana } from '../lib/calendario.mjs';

// Quanto prima avvisare. La finestra è più larga dei 60 minuti di proposito:
// se una esecuzione saltasse, quella dopo recupera comunque l'appuntamento,
// e il segno su `promemoria_inviati` impedisce il doppione.
//
// Con esecuzioni ogni 30 minuti, un intervento delle 10:00 ricade per la prima
// volta nella finestra al giro delle 09:00 — cioè esattamente un'ora prima.
export const MINUTI_MINIMI = 10;
export const MINUTI_MASSIMI = 80;

/**
 * L'ora italiana in cui si ripuliscono i segni vecchi. Una volta al giorno
 * basta. Prima erano le 3 di notte, ma da quando la funzione gira solo nelle
 * ore utili a quell'ora non parte più nessuno: deve stare dentro la finestra.
 */
export const ORA_PULIZIA = 7;

/**
 * Segna che un avviso è stato mandato, e dice se era già stato mandato prima.
 * È l'inserimento stesso a fare da guardia: se la chiave esiste già,
 * `ON CONFLICT DO NOTHING` non tocca niente e non restituisce righe. Due
 * esecuzioni ravvicinate non possono quindi mandare due volte lo stesso
 * avviso, nemmeno se partissero nello stesso istante.
 */
async function primaVolta(chiave) {
  const righe = await sql()`
    INSERT INTO promemoria_inviati (chiave) VALUES (${chiave})
    ON CONFLICT (chiave) DO NOTHING
    RETURNING chiave
  `;
  return righe.length > 0;
}

/**
 * Gli interventi che stanno per cominciare.
 *
 * Il confronto fra l'orario dell'appuntamento e l'ora attuale lo fa Postgres,
 * che conosce il fuso di Roma e l'ora legale: `(data + ora) AT TIME ZONE
 * 'Europe/Rome'` trasforma il "giovedì alle 15:00" scritto in agenda
 * nell'istante giusto, qualunque sia il fuso del server.
 *
 * Restano fuori i lavori già fatti, quelli annullati e quelli ancora da
 * assegnare: non c'è nessuno da avvisare.
 */
async function inArrivo() {
  return await sql().query(
    `SELECT
       a.id,
       a.assegnato_a,
       a.nome_cliente,
       a.urgente,
       to_char(a.data, 'YYYY-MM-DD') AS data,
       to_char(a.ora,  'HH24:MI')    AS ora,
       round(EXTRACT(EPOCH FROM
         ((a.data + a.ora) AT TIME ZONE 'Europe/Rome') - now()) / 60)::int AS fra_quanti_minuti
     FROM appuntamenti a
     WHERE a.stato = 'attivo'
       AND a.assegnato_a IS NOT NULL
       AND (a.data + a.ora) AT TIME ZONE 'Europe/Rome'
           BETWEEN now() + ($1::int * interval '1 minute')
               AND now() + ($2::int * interval '1 minute')
     ORDER BY a.data, a.ora`,
    [MINUTI_MINIMI, MINUTI_MASSIMI],
  );
}

/**
 * Come dire quanto manca, senza far sembrare preciso qualcosa che non lo è.
 * Le esecuzioni sono ogni mezz'ora, quindi "fra 58 minuti" darebbe
 * un'impressione di precisione che non abbiamo: si arrotonda a cinque minuti
 * e sopra i tre quarti d'ora si dice semplicemente "circa un'ora".
 */
export function comeDire(minuti) {
  if (minuti >= 50) return 'Fra circa un\'ora';
  if (minuti <= 12) return 'Fra pochi minuti';
  return `Fra circa ${Math.round(minuti / 5) * 5} minuti`;
}

/** Ripulisce i segni vecchi: una volta al giorno basta e avanza. */
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

  const righe = await inArrivo();
  let mandati = 0;

  for (const a of righe) {
    // La chiave contiene data e ora: se l'appuntamento viene rimandato,
    // l'avviso riparte per il nuovo orario invece di restare muto.
    if (!(await primaVolta(`prima:${a.id}:${a.data}:${a.ora}`))) continue;

    await avvisa([a.assegnato_a], {
      titolo: comeDire(a.fra_quanti_minuti),
      testo: `Ore ${a.ora} · ${a.nome_cliente}` + (a.urgente ? ' · Urgente' : ''),
      url: `/appuntamenti/?vista=giorno&giorno=${a.data}`,
      tag: `app-${a.id}`,
    });
    mandati += 1;
  }

  const { ore, minuti } = oraItaliana();
  if (ore === ORA_PULIZIA && minuti < 30) await ripulisci();

  // Nel log niente nomi di clienti: solo quanti avvisi sono partiti.
  console.log(`Promemoria: ore ${ore}:${String(minuti).padStart(2, '0')} in Italia, ` +
              `${righe.length} interventi in arrivo, ${mandati} avvisi inviati.`);
};

/*
 * Ogni mezz'ora, come il passo delle fasce — ma solo nelle ore in cui può
 * servire. Di notte non c'è nessun appuntamento da annunciare, e ogni
 * esecuzione sveglia il database per cinque minuti: girare 24 ore su 24
 * costava da solo ~120 ore al mese di computo acceso sulle 400 del piano
 * gratuito. Così scendono a ~75.
 *
 * Perché 4-18 e non gli orari del negozio. Netlify conta in UTC, l'Italia no:
 * +1 d'inverno, +2 d'estate. Gli appuntamenti vanno dalle 08:00 alle 19:30 e
 * l'avviso parte fra 80 e 10 minuti prima, quindi serve una esecuzione fra le
 * 06:40 e le 19:20 italiane. Questa finestra va bene in entrambe le stagioni:
 *
 *   inverno (UTC+1):  04:00–18:30 UTC  =  05:00–19:30 in Italia
 *   estate  (UTC+2):  04:00–18:30 UTC  =  06:00–20:30 in Italia
 *
 * Non si restringono anche i GIORNI. `GIORNI_LAVORATIVI` serve all'interfaccia
 * ma non è imposto dalla validazione: un appuntamento di domenica si può
 * creare, e saltarne il promemoria sarebbe un guasto silenzioso.
 *
 * C'è una prova in `npm test` che ricalcola la finestra necessaria dalle fasce
 * e dai minuti di anticipo: se cambiano gli orari del negozio, quella fallisce
 * e dice che questa riga va rifatta.
 */
export const config = { schedule: '*/30 4-18 * * *' };
