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
 * Manda una notifica ai dispositivi degli utenti indicati.
 *
 * `destinatari` è un elenco di id utente. I valori vuoti vengono ignorati, e
 * l'elenco viene ripulito dai doppioni: capita di chiamare questa funzione con
 * "l'assegnatario e l'amministratore" quando sono la stessa persona.
 *
 * `tag` distingue le notifiche fra loro sul telefono. Usiamo un'etichetta per
 * appuntamento (`app-12`): così due lavori assegnati di fila si accumulano
 * invece di sostituirsi, mentre un aggiornamento sullo stesso appuntamento
 * rimpiazza la notifica precedente invece di aggiungersene un'altra.
 *
 * Non fallisce mai in modo rumoroso: se le push non sono configurate, o se un
 * dispositivo non risponde, l'operazione sul database resta valida. Salvare è
 * la cosa importante; avvisare è un di più.
 */
export async function avvisa(destinatari, { titolo, testo, url, tag = 'appuntamenti' }) {
  if (!preparaVapid()) return { inviate: 0, motivo: 'chiavi VAPID non configurate' };

  const ids = [...new Set((destinatari ?? []).filter((x) => Number.isInteger(x)))];
  if (ids.length === 0) return { inviate: 0, motivo: 'nessun destinatario' };

  const database = sql();
  const iscrizioni = await database`
    SELECT endpoint, p256dh, auth
    FROM push_iscrizioni
    WHERE utente_id = ANY(${ids})
  `;
  if (iscrizioni.length === 0) return { inviate: 0, motivo: 'nessun dispositivo iscritto' };

  const carico = JSON.stringify({ titolo, testo, url, tag });
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
      // 404 e 410 vogliono dire che quel dispositivo non esiste più: l'app è
      // stata disinstallata, o il browser ha ripulito i dati. Si cancella,
      // altrimenti la tabella si riempie di indirizzi morti.
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

/** Chi, fra questi utenti, ha almeno un dispositivo iscritto alle notifiche. */
export async function conNotificheAttive(ids) {
  const elenco = [...new Set((ids ?? []).filter((x) => Number.isInteger(x)))];
  if (elenco.length === 0) return new Set();
  const righe = await sql()`
    SELECT DISTINCT utente_id FROM push_iscrizioni WHERE utente_id = ANY(${elenco})
  `;
  return new Set(righe.map((r) => r.utente_id));
}
