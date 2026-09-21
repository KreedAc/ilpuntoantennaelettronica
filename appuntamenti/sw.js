/* Service worker del pannello appuntamenti.
 *
 * Serve a una cosa sola: ricevere le notifiche push quando l'app è chiusa.
 * Non mette NIENTE in cache di proposito — qui dentro passano dati di
 * clienti, e una copia salvata sul telefono sarebbe una copia in più da
 * proteggere. L'app si scarica dalla rete a ogni apertura: sono pochi
 * kilobyte.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  let dati = {};
  try {
    dati = evento.data ? evento.data.json() : {};
  } catch {
    dati = {};
  }

  const titolo = dati.titolo || 'Appuntamenti';
  const opzioni = {
    body: dati.testo || '',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    lang: 'it',
    // Le notifiche successive sostituiscono la precedente invece di
    // accatastarsi: chi apre il telefono a fine giornata trova l'ultima.
    tag: 'appuntamenti',
    renotify: true,
    data: { url: dati.url || '/appuntamenti/' },
  };

  evento.waitUntil(self.registration.showNotification(titolo, opzioni));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destinazione = evento.notification.data?.url || '/appuntamenti/';

  evento.waitUntil((async () => {
    const aperte = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Se il pannello è già aperto lo portiamo in primo piano invece di
    // aprirne una seconda copia.
    for (const finestra of aperte) {
      if (new URL(finestra.url).pathname.startsWith('/appuntamenti')) {
        await finestra.focus();
        if ('navigate' in finestra) await finestra.navigate(destinazione);
        return;
      }
    }
    await self.clients.openWindow(destinazione);
  })());
});
