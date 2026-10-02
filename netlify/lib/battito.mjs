// Il "battito": un numero che cambia ogni volta che l'agenda cambia.
//
// Serve a tenere aggiornata la dashboard di Tiziana mentre Michele e
// Alessandro lavorano. Il pannello lo chiede ogni venti secondi: se è lo
// stesso di prima non c'è niente di nuovo e la richiesta finisce lì; se è
// diverso, allora — e solo allora — il pannello va a riprendersi gli
// appuntamenti.
//
// Perché non una domanda al database. Neon sul piano gratuito spegne il
// computo dopo cinque minuti di inattività, e il conto si fa sulle ore in cui
// resta acceso: una domanda ogni venti secondi lo terrebbe sveglio per tutta
// la giornata lavorativa, cioè centinaia di ore al mese su un totale di circa
// quattrocento. Il deposito di Netlify invece non c'entra con il database:
// leggerlo non sveglia niente, e il database si tocca soltanto quando c'è
// davvero qualcosa di nuovo da mostrare.

import { getStore } from '@netlify/blobs';

const NOME = 'agenda';
const CHIAVE = 'ultimo-cambiamento';

// `strong` costa qualche millisecondo in più ma evita il caso fastidioso:
// l'installatore salva, Tiziana ricarica e vede ancora i dati di prima.
const deposito = () => getStore({ name: NOME, consistency: 'strong' });

/**
 * Segna che qualcosa è cambiato.
 *
 * Non solleva mai: un problema qui vorrebbe dire al massimo che Tiziana vede
 * l'aggiornamento al cambio di vista invece che da sola, e non è un motivo
 * per far fallire il salvataggio di un appuntamento.
 */
export async function segnaCambiamento() {
  try {
    await deposito().set(CHIAVE, String(Date.now()));
  } catch (e) {
    console.warn('Battito non aggiornato:', e?.message);
  }
}

/**
 * L'ultimo cambiamento, in millisecondi.
 *
 * Restituisce `null` se il deposito non risponde — non `0`, che invece
 * significa "nessun cambiamento ancora registrato". Chi chiama distingue i
 * due casi: col `null` si ripiega sul database, che la risposta giusta la sa
 * comunque.
 */
export async function leggiBattito() {
  try {
    const valore = await deposito().get(CHIAVE);
    return valore ? Number(valore) : 0;
  } catch (e) {
    console.warn('Battito non leggibile:', e?.message);
    return null;
  }
}
