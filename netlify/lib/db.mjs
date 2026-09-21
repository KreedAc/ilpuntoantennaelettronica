// Connessione al database Postgres (Neon).
//
// Usiamo il driver `@neondatabase/serverless`, che parla con Neon via HTTPS
// invece che con una connessione TCP persistente: è quello giusto per una
// funzione serverless, che nasce e muore a ogni richiesta e non può tenere
// aperto un pool.
//
// Le query si scrivono come template literal e i valori interpolati diventano
// SEMPRE parametri ($1, $2, …), mai testo concatenato: l'iniezione SQL è
// esclusa per costruzione.
//
//     await sql()`SELECT * FROM utenti WHERE email = ${email}`

import { neon } from '@neondatabase/serverless';

let connessione = null;

/**
 * Nomi accettati per la stringa di connessione, in ordine di precedenza.
 * DATABASE_URL è quello che impostiamo a mano con Neon; gli altri due sono
 * quelli che Netlify inietta da solo se un domani si passasse a Netlify DB.
 */
const VARIABILI = ['DATABASE_URL', 'NETLIFY_DB_URL', 'NETLIFY_DATABASE_URL'];

export function stringaDiConnessione() {
  for (const nome of VARIABILI) {
    const valore = process.env[nome];
    if (valore) return valore;
  }
  return null;
}

export function sql() {
  if (connessione) return connessione;

  const url = stringaDiConnessione();
  if (!url) {
    throw new Error(
      'Manca la stringa di connessione al database. Imposta DATABASE_URL ' +
      'fra le variabili d\'ambiente (Netlify → Project configuration → ' +
      'Environment variables).'
    );
  }
  connessione = neon(url);
  return connessione;
}
