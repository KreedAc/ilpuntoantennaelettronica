// Cifratura delle password.
//
// Usiamo scrypt, incluso in Node (`node:crypto`). È una funzione "lenta e
// golosa di memoria" della stessa famiglia di bcrypt e argon2: anche chi
// rubasse il database non potrebbe provare miliardi di password al secondo.
// Rispetto a bcrypt e argon2 ha il vantaggio di non aggiungere nessuna
// dipendenza esterna, cosa che conta su una funzione serverless.
//
// Formato memorizzato:  scrypt$N$r$p$sale_base64$digest_base64
// I parametri viaggiano insieme al digest, così si possono irrobustire in
// futuro senza invalidare le password già salvate.

import { randomBytes, scrypt as scryptConCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptConCallback);

const N = 16384; // costo CPU/memoria: 16384 · 8 · 128 B ≈ 16 MB per tentativo
const R = 8;
const P = 1;
const LUNGHEZZA = 32;
const MAXMEM = 64 * 1024 * 1024;

/** Restituisce la stringa da salvare in `utenti.password_hash`. */
export async function cifra(password) {
  const sale = randomBytes(16);
  const digest = await scrypt(password.normalize('NFKC'), sale, LUNGHEZZA, {
    N, r: R, p: P, maxmem: MAXMEM,
  });
  return ['scrypt', N, R, P, sale.toString('base64'), digest.toString('base64')].join('$');
}

/**
 * Confronta una password con il valore memorizzato.
 * Il confronto è a tempo costante: non rivela nulla sul digest corretto.
 */
export async function verifica(password, memorizzato) {
  if (typeof memorizzato !== 'string') return false;
  const parti = memorizzato.split('$');
  if (parti.length !== 6 || parti[0] !== 'scrypt') return false;

  const [, n, r, p, saleB64, digestB64] = parti;
  const sale = Buffer.from(saleB64, 'base64');
  const atteso = Buffer.from(digestB64, 'base64');

  let calcolato;
  try {
    calcolato = await scrypt(password.normalize('NFKC'), sale, atteso.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
    });
  } catch {
    return false;
  }
  return calcolato.length === atteso.length && timingSafeEqual(calcolato, atteso);
}

/**
 * Da chiamare quando l'email non esiste, prima di rispondere "credenziali non
 * valide". Senza, il tempo di risposta direbbe a un attaccante quali email
 * sono registrate: con l'email sbagliata la risposta tornerebbe subito, con
 * quella giusta dopo il calcolo di scrypt.
 */
export async function bruciaTempo() {
  await scrypt('password-inesistente', randomBytes(16), LUNGHEZZA, {
    N, r: R, p: P, maxmem: MAXMEM,
  });
}
