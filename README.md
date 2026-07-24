# Il Punto Antenna Elettronica – Sito web

Sito vetrina statico, ottimizzato per la SEO locale, per **Il Punto Antenna Elettronica di Rumoro Tiziana** – Corso Eroi di Sapri 32, 88046 Lamezia Terme (CZ).

## Struttura

| File | Scopo |
|---|---|
| `index.html` | Home page – parola chiave: "antennista e negozio di elettronica a Lamezia Terme" |
| `antennista-lamezia-terme.html` | Landing SEO – "antennista Lamezia Terme" (con FAQ e dati strutturati FAQPage) |
| `negozio-elettronica-lamezia-terme.html` | Landing SEO – "negozio elettronica Lamezia Terme" |
| `contatti.html` | Contatti, mappa Google e indicazioni |
| `sitemap.xml`, `robots.txt` | File tecnici per i motori di ricerca |
| `404.html` | Pagina di errore (usata automaticamente da GitHub Pages) |
| `assets/style.css` | Foglio di stile unico, nessuna dipendenza esterna |

Il sito è HTML/CSS puro: niente build, niente framework. Si può pubblicare su GitHub Pages, Netlify o qualunque hosting statico.

## ⚠️ Da verificare / completare prima della pubblicazione

1. **Dominio**: le URL canoniche, la sitemap e il robots.txt usano il segnaposto `https://www.ilpuntoantennaelettronica.it/`. Quando il dominio definitivo è deciso, sostituirlo in **tutti** i file (cerca e sostituisci).
2. **Dati verificati dalla scheda Google Business** (luglio 2026): indirizzo Corso Eroi di Sapri 32, tel. 380 283 0773, orari Lun–Ven 9–12:30 / 16:30–19, sab/dom chiusi. Se cambiano, aggiornare pagine HTML e `openingHoursSpecification` nel JSON-LD di `index.html`.
3. **Servizi**: l'elenco dei servizi/prodotti è basato sulla tipologia di attività (antennista + negozio elettronica). Far confermare alla titolare e aggiustare se serve (es. videosorveglianza, riparazioni particolari…).
4. **Foto reali**: aggiungere foto del negozio e dei lavori (rinominarle con nomi descrittivi, es. `negozio-elettronica-lamezia-terme.jpg`, e aggiungere attributi `alt`). Le foto reali aiutano molto la SEO locale.
5. **Email**: se l'attività ha un indirizzo email, aggiungerlo in `contatti.html` e nel JSON-LD.

## Checklist SEO locale (per arrivare in prima pagina su "Lamezia Terme")

Il sito da solo non basta: per le ricerche locali il fattore n.1 è la **scheda Google Business Profile**.

- [ ] **Google Business Profile**: rivendicare/aggiornare la scheda su [business.google.com](https://business.google.com) con nome, indirizzo, telefono **identici** a quelli del sito (NAP consistency), categoria "Antennista" + "Negozio di elettronica", orari, foto e collegamento al sito.
- [ ] **Recensioni Google**: chiedere ai clienti soddisfatti di lasciare una recensione: è il singolo fattore che più muove il posizionamento nel "local pack" (la mappa nei risultati).
- [ ] **Google Search Console**: registrare il sito, inviare `sitemap.xml`, verificare l'indicizzazione.
- [ ] **Directory locali**: verificare/uniformare i dati su PagineGialle, PagineBianche, Virgilio, Yelp – stesso nome, indirizzo e telefono ovunque.
- [ ] **Dominio proprio**: un dominio tipo `ilpuntoantennaelettronica.it` è più efficace di un sottodominio gratuito.
- [ ] Aggiungere col tempo contenuti utili (es. "come risintonizzare i canali", "cosa fare se il segnale TV squadretta"): portano traffico da ricerche correlate.

## Pubblicazione su Netlify (consigliata)

Il repo include già `netlify.toml` (header di sicurezza + cache del CSS). Per pubblicare:

1. Su [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → collega questo repository GitHub.
2. Build command: *(vuoto)* – Publish directory: `.` (già impostati dal `netlify.toml`).
3. Il sito va online su `https://<nome>.netlify.app`. La pagina `404.html` viene usata automaticamente.
4. **Dominio personalizzato**: Site settings → Domain management → aggiungi il dominio (es. `ilpuntoantennaelettronica.it`), Netlify configura HTTPS da solo. Poi aggiorna le URL canoniche in tutti i file HTML, `sitemap.xml` e `robots.txt`.

### In alternativa: GitHub Pages

Settings → Pages → Deploy from a branch → branch `main`, cartella `/ (root)`.
