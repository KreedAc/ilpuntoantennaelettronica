// Sessioni di accesso.
//
// Il token è un numero casuale da 32 byte. Nel database ne salviamo solo
// l'impronta SHA-256: se qualcuno riuscisse a leggere la tabella `sessioni`
// non potrebbe comunque farsi passare per un utente collegato.
//
// Il cookie è HttpOnly (il JavaScript della pagina non può leggerlo, quindi
// un eventuale XSS non se lo porta via), Secure (viaggia solo su HTTPS) e
// SameSite=Strict, che da solo blocca le richieste partite da altri siti:
// è la protezione CSRF principale, e nell'API la rinforziamo controllando
// anche l'intestazione Origin.

import { randomBytes, createHash } from 'node:crypto';
import { sql } from './db.mjs';
import { COOKIE_SESSIONE, DURATA_SESSIONE_GIORNI } from './configurazione.mjs';

function impronta(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function leggiCookie(req, nome) {
  const intestazione = req.headers.get('cookie');
  if (!intestazione) return null;
  for (const pezzo of intestazione.split(';')) {
    const uguale = pezzo.indexOf('=');
    if (uguale === -1) continue;
    if (pezzo.slice(0, uguale).trim() === nome) {
      return decodeURIComponent(pezzo.slice(uguale + 1).trim());
    }
  }
  return null;
}

/** Crea la sessione e restituisce il valore da mettere in Set-Cookie. */
export async function apriSessione(utenteId) {
  const token = randomBytes(32).toString('base64url');
  const scadenza = new Date(Date.now() + DURATA_SESSIONE_GIORNI * 24 * 60 * 60 * 1000);

  await sql()`
    INSERT INTO sessioni (token_hash, utente_id, scade_il)
    VALUES (${impronta(token)}, ${utenteId}, ${scadenza.toISOString()})
  `;

  return cookieSessione(token, DURATA_SESSIONE_GIORNI * 24 * 60 * 60);
}

export async function chiudiSessione(req) {
  const token = leggiCookie(req, COOKIE_SESSIONE);
  if (token) {
    await sql()`DELETE FROM sessioni WHERE token_hash = ${impronta(token)}`;
  }
  return cookieSessione('', 0);
}

function cookieSessione(valore, durataSecondi) {
  return [
    `${COOKIE_SESSIONE}=${valore}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${durataSecondi}`,
  ].join('; ');
}

/**
 * Riconosce chi sta facendo la richiesta.
 * Restituisce { id, nome, email, ruolo } oppure null.
 */
export async function utenteCollegato(req) {
  const token = leggiCookie(req, COOKIE_SESSIONE);
  if (!token) return null;

  const righe = await sql()`
    SELECT u.id, u.nome, u.email, u.ruolo
    FROM sessioni s
    JOIN utenti u ON u.id = s.utente_id
    WHERE s.token_hash = ${impronta(token)}
      AND s.scade_il > now()
    LIMIT 1
  `;
  return righe[0] ?? null;
}

/** Pulizia delle sessioni scadute. Chiamata ogni tanto, senza bloccare nulla. */
export async function scadenzeDaRipulire() {
  try {
    await sql()`DELETE FROM sessioni WHERE scade_il < now()`;
  } catch {
    // La pulizia è un di più: se fallisce, la richiesta in corso non ne risente.
  }
}
