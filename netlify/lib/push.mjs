// Notifiche push (Web Push standard, con chiavi VAPID).
//
// Nessun servizio a pagamento di mezzo: il server firma il messaggio con la
// chiave privata VAPID e lo consegna al servizio push del browser
// (Google, Mozilla, Apple). Il contenuto è cifrato da `web-push` con le chiavi
// del dispositivo, quindi il servizio push non può leggerlo.
//
// Le chiavi si generano una volta sola con `npm run chiavi-push` e si mettono
// fra le variabili d'ambiente di Netlify.

import webpush from 'web-push';
import { sql } from './db.mjs';

let configurato = null;

function preparaVapid() {
  if (configurato !== null) return configurato;

  const pubblica = process.env.VAPID_PUBLIC_KEY;
  const privata = process.env.VAPID_PRIVATE_KEY;
  const contatto = process.env.VAPID_SUBJECT || 'mailto:ilpuntoantennaelettr@libero.it';

  if (!pubblica || !privata) {
    configurato = false;
    return false;
  }
  webpush.setVapidDetails(contatto, pubblica, privata);
  configurato = true;
  return true;
}

export function chiavePubblica() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Manda una notifica a tutti i dispositivi degli installatori.
 *
 * Non fallisce mai in modo rumoroso: se le push non sono configurate, o se un
 * dispositivo non risponde, l'appuntamento resta salvato lo stesso. Salvare è
 * la cosa importante; avvisare è un di più.
 *
 * Le iscrizioni che il servizio push dichiara morte (404 / 410) vengono
 * cancellate, così la tabella non si riempie di dispositivi che non esistono.
 */
export async function avvisaInstallatori({ titolo, testo, url }) {
  if (!preparaVapid()) return { inviate: 0, motivo: 'chiavi VAPID non configurate' };

  const database = sql();
  const iscrizioni = await database`
    SELECT i.endpoint, i.p256dh, i.auth
    FROM push_iscrizioni i
    JOIN utenti u ON u.id = i.utente_id
    WHERE u.ruolo = 'installatore'
  `;
  if (iscrizioni.length === 0) return { inviate: 0, motivo: 'nessun dispositivo iscritto' };

  const carico = JSON.stringify({ titolo, testo, url });
  const scaduti = [];
  let inviate = 0;

  await Promise.all(iscrizioni.map(async (i) => {
    try {
      await webpush.sendNotification(
        { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
        carico,
        { TTL: 12 * 60 * 60, urgency: 'high' },
      );
      inviate += 1;
    } catch (errore) {
      if (errore?.statusCode === 404 || errore?.statusCode === 410) {
        scaduti.push(i.endpoint);
      } else {
        // Non logghiamo il contenuto della notifica: contiene dati del cliente.
        console.warn('Push non consegnata:', errore?.statusCode ?? errore?.message);
      }
    }
  }));

  if (scaduti.length > 0) {
    await database`DELETE FROM push_iscrizioni WHERE endpoint = ANY(${scaduti})`;
  }
  return { inviate, rimossi: scaduti.length };
}
