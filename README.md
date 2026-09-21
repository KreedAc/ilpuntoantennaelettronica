# Il Punto Antenna Elettronica – Sito web

Sito vetrina statico, ottimizzato per la SEO locale, per **Il Punto Antenna Elettronica di Rumoro Tiziana** – Corso Eroi di Sapri 32, 88046 Lamezia Terme (CZ).

🌐 Online su **https://ilpuntoantennaelettronica.com/**

## Struttura

| File | Scopo |
|---|---|
| `index.html` | Home page – "antennista e negozio di elettronica a Lamezia Terme" |
| `antennista-lamezia-terme.html` | Landing SEO – "antennista Lamezia Terme" (con FAQ e dati strutturati FAQPage) |
| `telefonia-internet-lamezia-terme.html` | Landing SEO – Sky, Sky WiFi, internet casa, telefonia mobile, ricariche |
| `smartphone-ricondizionati-lamezia-terme.html` | Landing SEO – "smartphone ricondizionati Lamezia Terme", con il catalogo e le FAQ |
| `sky-business-lamezia-terme.html` | Landing SEO B2B – Sky per negozi, uffici e sale d'attesa |
| `collabora-con-noi.html` | Modulo per proposte di collaborazione (Netlify Forms), volutamente senza testi introduttivi |
| `grazie.html` | Pagina di conferma dopo l'invio del modulo (`noindex`) |
| `luce-gas-lamezia-terme.html` | Landing SEO – consulenza e attivazione contratti luce e gas |
| `videosorveglianza-lamezia-terme.html` | Landing SEO – videosorveglianza e sistemi di allarme |
| `negozio-elettronica-lamezia-terme.html` | Landing SEO – "negozio elettronica Lamezia Terme" (catalogo per categorie) |
| `contatti.html` | Contatti, mappa Google e indicazioni |
| `privacy.html` | Informativa privacy (GDPR artt. 13-14) – richiesta da Meta per i moduli di acquisizione contatti |
| `sitemap.xml`, `robots.txt` | File tecnici per i motori di ricerca |
| `404.html` | Pagina di errore (usata automaticamente da Netlify) |
| `assets/style.css` | Foglio di stile unico, nessuna dipendenza esterna |
| `assets/fonts/` | Carattere Inter (SIL OFL), servito dal sito stesso |
| `assets/logo.png` | Logo originale dell'insegna |
| `assets/prodotti/` | Foto degli smartphone ricondizionati (WebP), estratte dal volantino del fornitore |
| `dati/` | Contenuti modificabili: recensioni, media, cataloghi prodotti (JSON) |
| `scripts/genera.py` | Rigenera i blocchi delle pagine a partire da `dati/` |
| `admin/` | Pannello dei contenuti (Sveltia CMS), escluso dall'indicizzazione |
| `materiali/` | QR recensioni Google + cartellino A6 pronto da stampare |
| `appuntamenti/` | Pannello appuntamenti: area riservata con login, esclusa dall'indicizzazione |
| `netlify/functions/`, `netlify/lib/` | API del pannello appuntamenti e logica condivisa |
| `db/schema.sql` | Tabelle Postgres del pannello appuntamenti |
| `scripts/db.mjs`, `scripts/chiavi-push.mjs` | Configurazione del database e chiavi delle notifiche |
| `test/` | Prove automatiche sulla logica (`npm test`) |

**Le pagine pubbliche restano HTML/CSS puro**: niente framework, nessuna richiesta
a server esterni (carattere e icone sono locali), menu a comparsa e schede
cliccabili funzionano senza JavaScript. Le uniche due eccezioni sono aree
riservate ed escluse dai motori di ricerca: `/admin` (un solo script esterno) e
`/appuntamenti` (applicazione con database, vedi la sezione dedicata).

## Contenuti modificabili (`dati/` + generatore)

Recensioni e cataloghi **non si modificano a mano nell'HTML**: stanno in `dati/*.json`, e `scripts/genera.py` li riversa nelle pagine.

```bash
python3 scripts/genera.py             # rigenera i blocchi
python3 scripts/genera.py --verifica  # controlla senza scrivere (esce 1 se disallineato)
```

Lo script tocca **solo** il testo compreso fra i marcatori, e lascia intatto tutto il resto della pagina:

```html
<!-- GENERATO: catalogo-smartphone -->
...contenuto riscritto a ogni build...
<!-- FINE: catalogo-smartphone -->
```

| Blocco | Pagina | File dei dati |
|---|---|---|
| `recensioni-fascia`, `recensioni-riga` | `index.html` | `dati/attivita.json` |
| `catalogo-smartphone` | `smartphone-ricondizionati-lamezia-terme.html` | `dati/catalogo-smartphone.json` |
| `novita` | `index.html` | `dati/promozioni.json` |

Il generatore gira **da solo a ogni deploy** (`command` in `netlify.toml`): basta modificare un file in `dati/` e fare push. Usa la sola libreria standard di Python — nessuna dipendenza da installare.

Ogni prodotto ha un campo `visibile`: metterlo a `false` lo toglie dal sito **senza perdere i dati**, utile quando un pezzo è esaurito ma tornerà. Le promozioni funzionano allo stesso modo con il campo `attiva`: **se nessuna è attiva, la fascia novità non viene proprio scritta** e la home torna com'era.

⚠️ **Prezzi nelle promozioni**: il campo `prezzo` va compilato solo quando si hanno le condizioni complete. Se si indica un importo, nel campo `condizioni` vanno durata, vincoli e se è IVA inclusa o esclusa — per le offerte rivolte alle attività i listini sono spesso al netto dell'IVA.

Per aggiungere un catalogo nuovo (TV, condizionatori…): un file `dati/catalogo-xxx.json`, i marcatori nella pagina e tre righe in `genera.py`. Poi aggiungerlo anche in `admin/config.yml` per vederlo nel pannello.

## Modulo di collaborazione

Il modulo di `collabora-con-noi.html` usa **Netlify Forms**: nessun server, nessun JavaScript, gratuito fino a 100 invii al mese. Perché funzioni servono tre cose già presenti nell'HTML:

- `data-netlify="true"` sul tag `<form>`
- un campo nascosto `<input type="hidden" name="form-name" value="collabora">` con lo stesso valore dell'attributo `name` del modulo
- `data-netlify-honeypot="campo-esca"` più il campo `.campo-esca`, nascosto via CSS: è l'esca che intercetta gli invii automatici

Dopo l'invio l'utente arriva su `grazie.html` (`action="/grazie.html"`).

⚠️ **Da fare una volta sola nel pannello Netlify**, nell'ordine, altrimenti gli invii non vengono nemmeno raccolti:

1. **Forms → Enable form detection.** Il rilevamento dei moduli non è attivo di serie: senza, Netlify non guarda nemmeno l'HTML.
2. **Fare un nuovo deploy** (*Deploys → Trigger deploy*): il rilevamento parte dal deploy successivo all'attivazione, non da quelli già fatti.
3. In *Forms* deve comparire il modulo **`collabora`**. Se non c'è, i due passi sopra non sono andati a buon fine.
4. **Project configuration → Notifications → Emails and webhooks → Form submission notifications** → aggiungere una notifica email verso `ilpuntoantennaelettr@libero.it`.

I nomi dei campi sono in italiano leggibile (`Nome e cognome`, `Zona`, `Tipo di collaborazione`…) perché è così che compaiono nell'email di notifica.

## Pannello dei contenuti (`/admin`)

Su **`/admin`** c'è [Sveltia CMS](https://github.com/sveltia/sveltia-cms): modifica i file di `dati/` scrivendo direttamente su GitHub, senza toccare il codice. A ogni salvataggio Netlify ricostruisce e pubblica (circa un minuto). Funziona anche da telefono.

È l'**unica pagina del sito che carica uno script esterno**; tutte le pagine pubbliche restano HTML puro.

### Come si entra

L'accesso usa un **token personale GitHub**, così non serve nessuna app OAuth né servizi di terze parti (`auth_methods: [token]` in `admin/config.yml`).

1. Su GitHub: *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*
2. **Repository access**: solo `KreedAc/ilpuntoantennaelettronica`
3. **Permissions → Repository permissions**: `Contents` = **Read and write** (basta questo)
4. Copiare il token e incollarlo nella schermata di accesso di `/admin`

Il token resta nel browser di chi lo inserisce: non è nel repository e non è pubblico. Se si perde il telefono, basta revocarlo da GitHub.

### Due cose da sapere

- **Il ramo è scritto in `admin/config.yml`** (`backend.branch`): deve sempre corrispondere a quello che Netlify pubblica. Se il sito passa a `main` dopo il merge, va aggiornato lì.
- **Dopo una modifica dal pannello l'HTML nel repository resta indietro**, perché il generatore gira durante la build e non ricommitta. Il sito pubblicato è comunque corretto. Per riallineare i file in locale basta `python3 scripts/genera.py`.

**Convenzioni di stile**: fondo pagina grigio chiarissimo (`#f5f7fa`) con schede e sezioni alternate bianche; carattere Inter; icone SVG a tratto da 24px, spessore 1.8, che ereditano il colore dal contenitore.

**Indirizzi delle pagine**: Netlify serve ogni pagina sia come `/pagina` sia come `/pagina.html`, e Google aveva indicizzato entrambe le forme. I `[[redirects]]` in `netlify.toml` reindirizzano con un 301 la forma senza estensione verso quella con `.html`, che è quella indicata dai tag `canonical` e dalla sitemap. **Aggiungendo una pagina nuova va aggiunta anche la sua riga di reindirizzamento.**

**Titoli e descrizioni**: Google mostra circa 60 caratteri di titolo e 155 di descrizione, poi taglia. Tenersi entro quei limiti, con la parola chiave all'inizio.

**Nota sulla cache**: `netlify.toml` imposta `Cache-Control: max-age=0`, così ogni modifica pubblicata è visibile all'istante. Il CSS è linkato con un parametro di versione (`style.css?v=N`): **incrementare N in tutte le pagine a ogni modifica dello stile**, per forzare l'aggiornamento sui browser di chi ha già visitato il sito.

## Pannello appuntamenti (`/appuntamenti`)

Area riservata: Tiziana carica gli interventi, l'installatore li vede sul telefono.
È **l'unica parte del progetto con un database e un server**, e la ragione è una
sola: qui passano nome, indirizzo e telefono dei clienti. Nei file di `dati/`
finirebbero su GitHub in chiaro, e resterebbero nella cronologia di git anche
dopo averli cancellati.

### Come sta insieme

| Pezzo | Dove | Cosa fa |
|---|---|---|
| Interfaccia | `appuntamenti/` | HTML, CSS e JavaScript senza librerie |
| API | `netlify/functions/api.mjs` | risponde a `/api/*` (si instrada da sé con `config.path`) |
| Logica condivisa | `netlify/lib/` | orari, validazione, password, sessioni, date, push |
| Schema | `db/schema.sql` | tabelle Postgres |
| Strumenti | `scripts/db.mjs`, `scripts/chiavi-push.mjs` | schema, utenti, dati di prova, chiavi VAPID |

I due ruoli sono **admin** (Tiziana: crea, modifica, rimanda, annulla) e
**installatore** (sola lettura, viste Giorno e Settimana, numero cliccabile).
I permessi si controllano **nell'API su ogni endpoint**: un installatore che
chiamasse a mano un indirizzo di scrittura riceve `403`, non basta nascondere
i pulsanti.

### Prima configurazione

1. **Database.** Crea un progetto gratuito su [neon.tech](https://neon.tech) e
   copia la stringa di connessione. Il piano gratuito non mette in pausa il
   progetto per inattività: si spegne dopo 5 minuti e si riaccende alla query
   successiva in qualche centinaio di millisecondi.
2. **Su Netlify** (*Project configuration → Environment variables*) aggiungi
   `DATABASE_URL` con quella stringa.
3. **In locale**, per creare tabelle e utenti:
   ```bash
   export DATABASE_URL='postgresql://…'
   npm install
   npm run schema     # crea le tabelle (si può rilanciare quando serve)
   npm run utenti     # crea Tiziana (amministratore) e l'installatore
   npm run esempi     # facoltativo: cinque appuntamenti di prova
   ```
4. **Notifiche push** (facoltative: senza, il pannello funziona lo stesso):
   ```bash
   npm run chiavi-push
   ```
   Incolla `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` fra le
   variabili d'ambiente di Netlify. **La chiave privata non va nel repository.**

### Notifiche sul telefono dell'installatore

L'installatore le attiva da solo, dal riquadro in fondo alla vista Giorno.

- **Android**: funzionano dal browser, senza installare niente.
- **iPhone**: solo dopo *Condividi → Aggiungi a Home*, e poi riaprendo il
  pannello da quell'icona. È un vincolo di Apple. In Europa funzionano: la
  rimozione annunciata a febbraio 2024 è stata revocata il 1° marzo 2024.

Nella notifica finiscono **solo giorno, ora e nome**: indirizzo, telefono e
prezzo restano dietro il login.

### Regole di funzionamento

- Fasce da **30 minuti**, dalle **08:00 alle 19:30** (ultima che finisce alle 20:00).
  Si cambiano in **un punto solo**: `netlify/lib/configurazione.mjs`. L'interfaccia
  riceve l'elenco delle fasce dall'API, quindi non esiste una seconda copia.
- **L'agenda si adatta all'altezza della finestra.** `app.js` calcola l'altezza
  della fascia e la scrive nella variabile CSS `--riga`; righe, etichette orarie
  e blocchi sono tutti espressi in funzione di quella variabile, quindi si
  ricollocano da soli senza essere ridisegnati. I limiti sono 24–40 px: sotto i
  28 px il blocco mostra solo ora e nome, e l'indirizzo si legge passandoci
  sopra il mouse. In larghezza l'agenda si ferma a `--agenda-massima` (1400 px).
- **Un appuntamento per fascia.** Lo garantisce un indice unico parziale nel
  database (`appuntamenti_una_per_fascia`), non solo un controllo nel codice:
  due salvataggi nello stesso istante non possono sovrapporsi.
- Settimana **da lunedì a sabato**, fuso `Europe/Rome`.
- **Annullare non cancella**: la riga resta con `stato = 'annullato'`, ma sparisce
  da tutte le viste. La fascia torna libera.
- Il prezzo è salvato **in centesimi**, come numero intero: niente arrotondamenti.

### Sicurezza

Password con **scrypt** (`node:crypto`, memory-hard come bcrypt e argon2, senza
dipendenze esterne); sessioni in cookie `HttpOnly` + `Secure` + `SameSite=Strict`
di cui il database conserva solo l'impronta SHA-256; limite di 8 tentativi di
accesso in 15 minuti per IP e per email; `Origin` verificato su ogni scrittura;
`no-store` e `noindex` su `/appuntamenti/*` e `/api/*`; `Disallow` in `robots.txt`.
Il service worker **non mette niente in cache**, di proposito.

### Prove

```bash
npm test     # 25 prove sulla logica: fasce, prezzi, date, password, validazione
```

L'interfaccia è stata verificata in un browser vero (Chromium, 1280 px e 390 px)
con l'API simulata: accesso e ruoli, griglia, creazione, fascia occupata,
rimanda, modifica, annullamento con conferma, viste installatore, link `tel:`,
nessuno scorrimento orizzontale a 390 px, elementi toccabili da almeno 44 px.

### Da fare prima di usarlo davvero

- [ ] Creare il progetto Neon e impostare `DATABASE_URL` su Netlify
- [ ] `npm run schema` e `npm run utenti`
- [ ] Generare le chiavi VAPID e impostarle su Netlify
- [ ] Far installare il pannello sulla schermata Home del telefono dell'installatore
- [x] **Informativa privacy aggiornata** (21 settembre 2026): punto 2.5 sull'agenda
      degli interventi e sulle notifiche, finalità e base giuridica al punto 3,
      conservazione di 24 mesi al punto 4, Neon come responsabile al punto 5,
      server europei al punto 6, misure di sicurezza al punto 8

> **Se cambi fornitore o regione del database**, vanno riallineati i punti 2.5, 5 e 6
> di `privacy.html`: citano Neon per nome e dichiarano che i server sono nell'Unione europea.

## Dati dell'attività (verificati sulla scheda Google Business, luglio 2026)

- Ragione sociale: Il Punto Antenna Elettronica di Rumoro Tiziana
- Indirizzo: Corso Eroi di Sapri, 32 – 88046 Lamezia Terme (CZ)
- Telefono / WhatsApp: 380 283 0773
- Email: ilpuntoantennaelettr@libero.it
- Partita IVA e Codice Fiscale: 03065030797
- Orari: Lun–Ven 9:00–12:30 e 16:30–19:00 · sabato e domenica chiusi
- Coordinate: 38.9638, 16.2839
- Facebook: https://www.facebook.com/p/Il-Punto-Antenna-Elettronica-100054474850234/
- Instagram: https://www.instagram.com/ilpuntoantennaelettronica/

Se cambiano, aggiornare le pagine HTML **e** il JSON-LD in `index.html` (`openingHoursSpecification`, `geo`, `telephone`).

## Checklist SEO locale

### ✅ Fatto

- [x] **Sito online** su Netlify, mobile-friendly, HTTPS, veloce
- [x] **Struttura per parole chiave locali**: 5 landing dedicate + home + contatti
- [x] **Dati strutturati JSON-LD**: LocalBusiness/ElectronicsStore (indirizzo, orari, geo, servizi, logo), FAQPage, BreadcrumbList, Service
- [x] **Sitemap, robots.txt, canonical, Open Graph** su tutte le pagine
- [x] **Google Search Console**: proprietà verificata (meta tag in `index.html`) e sitemap inviata
- [x] **Google Business Profile**: sito collegato alla scheda
- [x] **Dominio proprio**: `ilpuntoantennaelettronica.com`
- [x] **Partita IVA** nel piè di pagina di tutte le pagine (obbligatoria per il D.Lgs. 70/2003) e nell'informativa privacy
- [x] **Email e profili social** in `contatti.html`, nel piè di pagina e nel JSON-LD (`email`, `sameAs`, `vatID`)
- [x] **QR recensioni** + cartellino stampabile in `materiali/`
- [x] **Informativa privacy** (`privacy.html`), linkata dal piè di pagina di tutte le pagine
- [x] **Catalogo smartphone ricondizionati**: pagina dedicata `smartphone-ricondizionati-lamezia-terme.html`, con voce propria nel menu e card in home. 24 schede con foto, prezzo e link WhatsApp precompilato per prodotto

### ⏳ Da fare

- [ ] **Recensioni Google**: chiedere sempre a fine lavoro, con il QR in negozio. È il fattore n.1 del "local pack". ⚠️ Mai suggerire testi ai clienti né far scrivere recensioni a chi non è cliente: Google le rileva e rimuove, ed è vietato per legge (pratica commerciale ingannevole). Il canale legittimo per inserire le parole chiave è **rispondere** alle recensioni dal profilo dell'attività.
- [ ] **Foto reali** del negozio e dei lavori: aggiungerle al sito (nomi file descrittivi + attributo `alt`) e alla scheda Google. **È la cosa che manca di più**: oggi il sito non contiene nessuna fotografia dell'attività.
- [ ] **Bio dei social**: controllare che il link nelle biografie Facebook e Instagram punti al dominio `.com` (sito e Search Console sono già allineati).
- [ ] **Bonifica directory**: la scheda su PagineBianche riporta ancora il vecchio indirizzo (Via Perugini) e il fisso. Correggere o rimuovere tramite Italiaonline: dati discordanti confondono Google (NAP consistency).
- [ ] **Catalogo ricondizionati**: prezzi e disponibilità sono fotografati al 31/07/2026 e vanno riallineati a ogni nuovo volantino del fornitore. La data compare in fondo alla sezione: aggiornarla insieme ai prezzi.
- [ ] **Foto dei prodotti**: provengono dal volantino Evolution Level; una (`iphone-13.webp`) riporta la filigrana `©recommerce`. Chiedere al fornitore il pacchetto immagini per rivenditori.
- [ ] **Mappa di Google in `contatti.html`**: installa cookie di terze parti. Per evitare il banner di consenso, sostituirla con un'immagine statica che apre Google Maps al clic.
- [ ] *(opzionale)* Contenuti utili nel tempo: "come risintonizzare i canali", "cosa fare se il segnale TV squadretta" — portano traffico da ricerche correlate.
- [ ] *(opzionale)* Tag NFC da banco con il link recensioni: `https://g.page/r/CQoOih4xjnXMEBM/review`
- [ ] **Notifica email del modulo** da attivare nel pannello Netlify (vedi sopra) — senza, le richieste restano solo nel pannello.
- [ ] **Autorizzazione dei mandanti**: prima di promuovere il modulo, verificare con Sky, con gli operatori telefonici e con i fornitori di energia se e come è ammesso portare collaboratori sotto il proprio codice. Molti contratti da dealer vietano il sub-mandato.
- [ ] *(opzionale)* **Pannello di amministrazione**: con i dati già in `dati/`, si aggiunge [Sveltia CMS](https://github.com/sveltia/sveltia-cms) su `/admin` per modificare recensioni e cataloghi da browser (anche da telefono) senza toccare i file. ⚠️ Non usare Decap CMS con Netlify Identity/Git Gateway: entrambi sono deprecati.

## Pubblicazione e dominio

Il sito è collegato a Netlify: **ogni push sul branch pubblica automaticamente**.

Il dominio è **`https://ilpuntoantennaelettronica.com`**, gestito da Netlify (HTTPS automatico).
La migrazione dall'indirizzo `.netlify.app` è conclusa: dominio attivo, proprietà Search
Console verificata con sitemap inviata, link aggiornato sulla scheda Google Business.

Se un giorno il dominio dovesse cambiare, vanno toccati **tutti** i riferimenti assoluti:
i tag `canonical`, `og:url` e `twitter:url` di ogni pagina, il JSON-LD (`url`, `logo`,
`image`, `@id` dei breadcrumb), `sitemap.xml` e `robots.txt`. Per trovarli tutti:

```bash
grep -rn "ilpuntoantennaelettronica.com" --include="*.html" --include="*.xml" --include="*.txt" .
```

Vanno poi aggiornati il link sulla scheda Google Business, le bio dei social e la proprietà
su Search Console. Netlify mantiene un redirect 301 dal vecchio indirizzo, quindi
l'indicizzazione già guadagnata non si perde.
