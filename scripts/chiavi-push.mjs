#!/usr/bin/env node
// Genera la coppia di chiavi VAPID per le notifiche push.
//
//   npm run chiavi-push
//
// Si lancia UNA SOLA VOLTA. Le chiavi vanno poi incollate fra le variabili
// d'ambiente di Netlify. Se un domani venissero rigenerate, tutti i
// dispositivi già iscritti smetterebbero di ricevere notifiche e dovrebbero
// riattivarle dal pannello.

import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
  Chiavi VAPID generate.

  Vai su Netlify → il progetto → Project configuration → Environment
  variables e aggiungi queste tre voci:

  ┌─────────────────────┬──────────────────────────────────────────────────┐
    VAPID_PUBLIC_KEY      ${publicKey}
    VAPID_PRIVATE_KEY     ${privateKey}
    VAPID_SUBJECT         mailto:ilpuntoantennaelettr@libero.it
  └─────────────────────┴──────────────────────────────────────────────────┘

  La chiave PRIVATA non va scritta da nessun'altra parte: non nel
  repository, non in una chat, non in un file del progetto. Se la perdi se
  ne generano di nuove e si riattivano le notifiche dai dispositivi.

  Finché queste variabili non ci sono, il pannello funziona normalmente ma
  non manda notifiche.
`);
