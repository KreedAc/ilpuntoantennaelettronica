// Validazione e normalizzazione dei dati in arrivo dal browser.
//
// Regola di fondo: l'interfaccia aiuta l'utente, ma non è una garanzia. Tutto
// quello che arriva da fuori viene ricontrollato qui, lato server, prima di
// toccare il database.

import { fasciaValida, FASCE } from './configurazione.mjs';

const MAX_TESTO = 200;
const MAX_NOTE = 2000;

function testo(valore) {
  return typeof valore === 'string' ? valore.trim() : '';
}

/**
 * Converte un prezzo scritto a mano in centesimi.
 * Accetta "80", "80,50", "80.5", " 1.234,50 ". Restituisce null se non è un
 * importo valido. Il calcolo passa per gli interi: niente virgola mobile,
 * quindi nessun 80,49999999999999.
 */
export function prezzoInCentesimi(valore) {
  if (typeof valore === 'number' && Number.isFinite(valore)) {
    return Math.round(valore * 100);
  }
  let grezzo = testo(valore).replace(/[\s€]/g, '');
  if (grezzo === '') return null;

  // "1.234,50" → "1234,50"  (il punto è separatore delle migliaia)
  if (grezzo.includes(',')) grezzo = grezzo.replace(/\./g, '');
  grezzo = grezzo.replace(',', '.');

  if (!/^\d+(\.\d{1,2})?$/.test(grezzo)) return null;

  const [interi, decimali = ''] = grezzo.split('.');
  const centesimi = Number(interi) * 100 + Number(decimali.padEnd(2, '0'));
  return Number.isSafeInteger(centesimi) ? centesimi : null;
}

/** Da centesimi a stringa italiana senza simbolo, es. 8050 → "80,50". */
export function centesimiInPrezzo(centesimi) {
  const segno = centesimi < 0 ? '-' : '';
  const assoluto = Math.abs(centesimi);
  return `${segno}${Math.floor(assoluto / 100)},${String(assoluto % 100).padStart(2, '0')}`;
}

/** true se la stringa è una data reale in formato YYYY-MM-DD. */
export function dataValida(valore) {
  const grezzo = testo(valore);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(grezzo)) return false;
  const [a, m, g] = grezzo.split('-').map(Number);
  if (m < 1 || m > 12 || g < 1 || g > 31) return false;
  // Il costruttore in UTC evita che il fuso sposti il giorno.
  const d = new Date(Date.UTC(a, m - 1, g));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g;
}

/** Normalizza "9:00" e "09:00:00" in "09:00". Restituisce null se irrecuperabile. */
export function normalizzaOra(valore) {
  const grezzo = testo(valore);
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(grezzo);
  if (!m) return null;
  const ore = Number(m[1]);
  const minuti = Number(m[2]);
  if (ore > 23 || minuti > 59) return null;
  return `${String(ore).padStart(2, '0')}:${m[2]}`;
}

/**
 * Numero pronto per il link `tel:`: via gli spazi e i separatori, e se manca
 * il prefisso internazionale ci mettiamo +39. Il numero MOSTRATO resta quello
 * digitato da Tiziana: qui produciamo solo la versione per il link.
 */
export function telefonoPerChiamata(valore) {
  let n = testo(valore).replace(/[^\d+]/g, '');
  if (n.startsWith('00')) n = `+${n.slice(2)}`;
  if (!n.startsWith('+')) n = `+39${n}`;
  return n;
}

/**
 * Controlla i campi della scheda cliente.
 * Restituisce { valori, errori }: `errori` è un oggetto campo → messaggio,
 * vuoto se va tutto bene.
 */
export function validaAppuntamento(corpo, { richiediTutto = true } = {}) {
  const errori = {};
  const valori = {};

  const nomeCliente = testo(corpo?.nomeCliente);
  if (!nomeCliente) errori.nomeCliente = 'Campo obbligatorio';
  else if (nomeCliente.length > MAX_TESTO) errori.nomeCliente = 'Testo troppo lungo';
  valori.nomeCliente = nomeCliente;

  const luogoImpianto = testo(corpo?.luogoImpianto);
  if (!luogoImpianto) errori.luogoImpianto = 'Campo obbligatorio';
  else if (luogoImpianto.length > MAX_TESTO) errori.luogoImpianto = 'Testo troppo lungo';
  valori.luogoImpianto = luogoImpianto;

  const telefonoCliente = testo(corpo?.telefonoCliente);
  if (!telefonoCliente) errori.telefonoCliente = 'Campo obbligatorio';
  else if (telefonoCliente.replace(/\D/g, '').length < 6) {
    errori.telefonoCliente = 'Numero di telefono non valido';
  } else if (telefonoCliente.length > 40) {
    errori.telefonoCliente = 'Numero di telefono non valido';
  }
  valori.telefonoCliente = telefonoCliente;

  const centesimi = prezzoInCentesimi(corpo?.prezzoConcordato);
  if (centesimi === null) errori.prezzoConcordato = 'Importo non valido';
  else valori.prezzoCentesimi = centesimi;

  const data = testo(corpo?.data);
  if (!data) errori.data = 'Campo obbligatorio';
  else if (!dataValida(data)) errori.data = 'Data non valida';
  valori.data = data;

  const ora = normalizzaOra(corpo?.ora);
  if (!ora) {
    errori.ora = 'Campo obbligatorio';
  } else if (!fasciaValida(ora)) {
    errori.ora = `Orario non valido: usa fasce da 30 minuti fra ${FASCE[0]} e ${FASCE[FASCE.length - 1]}`;
  }
  valori.ora = ora;

  const note = testo(corpo?.note);
  if (note.length > MAX_NOTE) errori.note = 'Testo troppo lungo';
  valori.note = note;

  valori.urgente = corpo?.urgente === true || corpo?.urgente === 'true';

  if (!richiediTutto) {
    for (const campo of Object.keys(errori)) {
      if (corpo?.[campo] === undefined) delete errori[campo];
    }
  }

  return { valori, errori };
}

/** Controlla solo data e ora: serve a "Rimanda l'appuntamento". */
export function validaSpostamento(corpo) {
  const errori = {};
  const data = testo(corpo?.data);
  if (!data) errori.data = 'Campo obbligatorio';
  else if (!dataValida(data)) errori.data = 'Data non valida';

  const ora = normalizzaOra(corpo?.ora);
  if (!ora) {
    errori.ora = 'Campo obbligatorio';
  } else if (!fasciaValida(ora)) {
    errori.ora = `Orario non valido: usa fasce da 30 minuti fra ${FASCE[0]} e ${FASCE[FASCE.length - 1]}`;
  }

  return { valori: { data, ora }, errori };
}
