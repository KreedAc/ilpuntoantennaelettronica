# Il Punto Antenna Elettronica – Sito web

Sito vetrina statico, ottimizzato per la SEO locale, per **Il Punto Antenna Elettronica di Rumoro Tiziana** – Corso Eroi di Sapri 32, 88046 Lamezia Terme (CZ).

🌐 Online su **https://ilpuntoantennaelettronica.netlify.app/**

## Struttura

| File | Scopo |
|---|---|
| `index.html` | Home page – "antennista e negozio di elettronica a Lamezia Terme" |
| `antennista-lamezia-terme.html` | Landing SEO – "antennista Lamezia Terme" (con FAQ e dati strutturati FAQPage) |
| `telefonia-internet-lamezia-terme.html` | Landing SEO – Sky, Sky WiFi, internet casa, telefonia mobile, ricariche |
| `luce-gas-lamezia-terme.html` | Landing SEO – consulenza e attivazione contratti luce e gas |
| `videosorveglianza-lamezia-terme.html` | Landing SEO – videosorveglianza e sistemi di allarme |
| `negozio-elettronica-lamezia-terme.html` | Landing SEO – "negozio elettronica Lamezia Terme" (catalogo per categorie) |
| `contatti.html` | Contatti, mappa Google e indicazioni |
| `sitemap.xml`, `robots.txt` | File tecnici per i motori di ricerca |
| `404.html` | Pagina di errore (usata automaticamente da Netlify) |
| `assets/style.css` | Foglio di stile unico, nessuna dipendenza esterna |
| `assets/logo.png` | Logo originale dell'insegna |
| `materiali/` | QR recensioni Google + cartellino A6 pronto da stampare |

Il sito è HTML/CSS puro: niente build, niente framework, nessuna dipendenza esterna.

**Nota sulla cache**: `netlify.toml` imposta `Cache-Control: max-age=0`, così ogni modifica pubblicata è visibile all'istante. Il CSS è linkato con un parametro di versione (`style.css?v=3`): **incrementarlo a ogni modifica importante dello stile**, per forzare l'aggiornamento sui browser dei visitatori.

## Dati dell'attività (verificati sulla scheda Google Business, luglio 2026)

- Indirizzo: Corso Eroi di Sapri, 32 – 88046 Lamezia Terme (CZ)
- Telefono / WhatsApp: 380 283 0773
- Orari: Lun–Ven 9:00–12:30 e 16:30–19:00 · sabato e domenica chiusi
- Coordinate: 38.9638, 16.2839

Se cambiano, aggiornare le pagine HTML **e** il JSON-LD in `index.html` (`openingHoursSpecification`, `geo`, `telephone`).

## Checklist SEO locale

### ✅ Fatto

- [x] **Sito online** su Netlify, mobile-friendly, HTTPS, veloce
- [x] **Struttura per parole chiave locali**: 5 landing dedicate + home + contatti
- [x] **Dati strutturati JSON-LD**: LocalBusiness/ElectronicsStore (indirizzo, orari, geo, servizi, logo), FAQPage, BreadcrumbList, Service
- [x] **Sitemap, robots.txt, canonical, Open Graph** su tutte le pagine
- [x] **Google Search Console**: proprietà verificata (meta tag in `index.html`) e sitemap inviata
- [x] **Google Business Profile**: sito collegato alla scheda
- [x] **QR recensioni** + cartellino stampabile in `materiali/`

### ⏳ Da fare

- [ ] **Recensioni Google**: chiedere sempre a fine lavoro, con il QR in negozio. È il fattore n.1 del "local pack". ⚠️ Mai suggerire testi ai clienti né far scrivere recensioni a chi non è cliente: Google le rileva e rimuove, ed è vietato per legge (pratica commerciale ingannevole). Il canale legittimo per inserire le parole chiave è **rispondere** alle recensioni dal profilo dell'attività.
- [ ] **Foto reali** del negozio e dei lavori: aggiungerle al sito (nomi file descrittivi + attributo `alt`) e alla scheda Google.
- [ ] **Bonifica directory**: la scheda su PagineBianche riporta ancora il vecchio indirizzo (Via Perugini) e il fisso. Correggere o rimuovere tramite Italiaonline: dati discordanti confondono Google (NAP consistency).
- [ ] **Dominio proprio** (~10-15 €/anno): più efficace del sottodominio `.netlify.app`. Vedi procedura sotto.
- [ ] **Email**: se l'attività ne ha una, aggiungerla in `contatti.html` e nel JSON-LD.
- [ ] **`sameAs` nel JSON-LD**: aggiungere i link ai profili social (Facebook/Instagram) se esistono.
- [ ] *(opzionale)* Contenuti utili nel tempo: "come risintonizzare i canali", "cosa fare se il segnale TV squadretta" — portano traffico da ricerche correlate.
- [ ] *(opzionale)* Tag NFC da banco con il link recensioni: `https://g.page/r/CQoOih4xjnXMEBM/review`

## Pubblicazione e dominio

Il sito è collegato a Netlify: **ogni push sul branch pubblica automaticamente**.

Per passare a un dominio proprio:

1. Acquistare il dominio (es. `ilpuntoantennaelettronica.it`).
2. Netlify → Site settings → Domain management → Add domain, poi impostare i record DNS indicati (HTTPS è automatico).
3. Sostituire `https://ilpuntoantennaelettronica.netlify.app` con il nuovo dominio in **tutti** i file HTML, `sitemap.xml` e `robots.txt`.
4. Aggiornare il link sulla scheda Google Business e creare la nuova proprietà su Search Console (Netlify mantiene un redirect 301 dal vecchio indirizzo, quindi il lavoro di indicizzazione non si perde).
