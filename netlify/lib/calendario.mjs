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
