// Costanti di funzionamento del pannello appuntamenti.
//
// Questo è l'UNICO punto in cui cambiare gli orari di lavoro: l'API valida su
// questi valori e l'interfaccia riceve l'elenco delle fasce da
// `GET /api/configurazione`, quindi non esiste una seconda copia da tenere
// allineata a mano.

/** Prima fascia della giornata. */
export const ORA_INIZIO = '08:00';

/** Chiusura: l'ultima fascia è quella che finisce a quest'ora (19:30 → 20:00). */
export const ORA_FINE = '20:00';

/** Durata di una fascia in minuti. Ogni appuntamento ne occupa esattamente una. */
export const PASSO_MINUTI = 30;

/**
 * Giorni mostrati, con lunedì = 1 come in ISO-8601. La domenica (7) è esclusa.
 * Per riaprire la domenica basta aggiungere 7 a questo elenco.
 */
export const GIORNI_LAVORATIVI = [1, 2, 3, 4, 5, 6];

/** Tutte le date e le ore sono intese in questo fuso. */
export const FUSO = 'Europe/Rome';

/** Durata della sessione. Lunga di proposito: l'installatore lavora dal telefono. */
export const DURATA_SESSIONE_GIORNI = 30;

/** Limite ai tentativi di accesso falliti. */
export const TENTATIVI_MASSIMI = 8;
export const FINESTRA_TENTATIVI_MINUTI = 15;

/** Nome del cookie di sessione. */
export const COOKIE_SESSIONE = 'pa_sessione';

/**
 * Elenco ordinato delle fasce ammesse, es. ['08:00', '08:30', …, '19:30'].
 * Calcolato una volta sola all'avvio della funzione.
 */
export const FASCE = (() => {
  const inMinuti = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const elenco = [];
  for (let m = inMinuti(ORA_INIZIO); m < inMinuti(ORA_FINE); m += PASSO_MINUTI) {
    const h = String(Math.floor(m / 60)).padStart(2, '0');
    const min = String(m % 60).padStart(2, '0');
    elenco.push(`${h}:${min}`);
  }
  return elenco;
})();

/** true se `ora` ("HH:MM") è una fascia ammessa. */
export function fasciaValida(ora) {
  return FASCE.includes(ora);
}
