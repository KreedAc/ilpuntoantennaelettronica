// Aiutanti per le date.
//
// Le date viaggiano sempre come stringhe "YYYY-MM-DD" e i conti si fanno in
// UTC: così nessuna operazione può far scivolare un appuntamento al giorno
// prima o dopo quando scatta l'ora legale. L'unico punto in cui il fuso conta
// davvero è "che giorno è oggi a Lamezia Terme", ed è isolato in `oggi()`.

import { FUSO } from './configurazione.mjs';

const FORMATO_ISO = new Intl.DateTimeFormat('sv-SE', {
  timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** La data di oggi nel fuso di Roma, come "YYYY-MM-DD". */
export function oggi() {
  return FORMATO_ISO.format(new Date());
}

const FORMATO_ORA = new Intl.DateTimeFormat('it-IT', {
  timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/**
 * L'ora attuale a Lamezia Terme, come { ore, minuti }.
 * Serve alla funzione dei promemoria: il cron di Netlify ragiona in UTC, e
 * un orario fisso si sposterebbe di un'ora a ogni cambio di ora legale.
 * Facendola partire spesso e lasciando decidere a lei sull'ora italiana, il
 * problema non si pone.
 */
export function oraItaliana(quando = new Date()) {
  const [ore, minuti] = FORMATO_ORA.format(quando).split(':').map(Number);
  return { ore, minuti };
}

function aUTC(dataISO) {
  const [a, m, g] = dataISO.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, g));
}

function daUTC(d) {
  return d.toISOString().slice(0, 10);
}

/** Somma (o sottrae) giorni a una data ISO. */
export function piuGiorni(dataISO, giorni) {
  const d = aUTC(dataISO);
  d.setUTCDate(d.getUTCDate() + giorni);
  return daUTC(d);
}

/** Giorno della settimana ISO: lunedì = 1 … domenica = 7. */
export function giornoSettimana(dataISO) {
  const g = aUTC(dataISO).getUTCDay();
  return g === 0 ? 7 : g;
}

/** Il lunedì della settimana che contiene `dataISO`. */
export function lunedi(dataISO) {
  return piuGiorni(dataISO, -(giornoSettimana(dataISO) - 1));
}

const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/** "lunedì 21 settembre 2026" (con l'iniziale minuscola: la maiuscola la mette chi la usa). */
export function dataEstesa(dataISO, { conAnno = true } = {}) {
  const d = aUTC(dataISO);
  const testo = `${GIORNI[giornoSettimana(dataISO) - 1]} ${d.getUTCDate()} ${MESI[d.getUTCMonth()]}`;
  return conAnno ? `${testo} ${d.getUTCFullYear()}` : testo;
}

/** "21 – 26 settembre 2026", accorpando mese e anno quando coincidono. */
export function intervalloSettimana(lunediISO) {
  const fine = piuGiorni(lunediISO, 5); // sabato
  const a = aUTC(lunediISO);
  const b = aUTC(fine);

  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${a.getUTCDate()} – ${b.getUTCDate()} ${MESI[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  }
  if (a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${a.getUTCDate()} ${MESI[a.getUTCMonth()]} – ${b.getUTCDate()} ${MESI[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  }
  return `${a.getUTCDate()} ${MESI[a.getUTCMonth()]} ${a.getUTCFullYear()} – ` +
         `${b.getUTCDate()} ${MESI[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

// ---------------------------------------------------------------------------
// Mesi
// ---------------------------------------------------------------------------
// Servono allo storico, che si sfoglia un mese alla volta. Stesse regole delle
// date: stringhe e conti in UTC, così il cambio dell'ora legale non sposta mai
// il primo né l'ultimo giorno.

const MESI_ESTESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                     'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** Il mese come "AAAA-MM" è scritto bene? */
export function meseValido(mese) {
  if (typeof mese !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mese)) return false;
  const anno = Number(mese.slice(0, 4));
  return anno >= 2000 && anno <= 2100;
}

/** Il mese di una data "AAAA-MM-GG". */
export const meseDi = (dataISO) => dataISO.slice(0, 7);

/**
 * Primo e ultimo giorno del mese, come "AAAA-MM-GG".
 * Il giorno 0 del mese successivo è l'ultimo di questo: vale anche a febbraio
 * e negli anni bisestili, senza doverli contare a mano.
 */
export function intervalloMese(mese) {
  const [anno, m] = mese.split('-').map(Number);
  const ultimo = new Date(Date.UTC(anno, m, 0)).getUTCDate();
  return { dal: `${mese}-01`, al: `${mese}-${String(ultimo).padStart(2, '0')}` };
}

/** Il mese spostato di `quanti` (negativo per andare indietro). */
export function piuMesi(mese, quanti) {
  const [anno, m] = mese.split('-').map(Number);
  const d = new Date(Date.UTC(anno, m - 1 + quanti, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Il mese per esteso, es. "settembre 2026". */
export function meseEsteso(mese) {
  const [anno, m] = mese.split('-').map(Number);
  return `${MESI_ESTESI[m - 1]} ${anno}`;
}
