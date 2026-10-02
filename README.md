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

### Ruoli e permessi

| | Tiziana (admin) | Installatore |
|---|---|---|
| Vedere | tutto | **tutto**, anche gli interventi dei colleghi |
| Creare | per chiunque, o lasciare "da assegnare" | **solo per sé** |
| Modificare la scheda | qualunque | — |
| Rimandare, annullare, segnare fatto | qualunque | **solo i propri** |
| Assegnare e riassegnare | qualunque | **solo i propri** (passaggio di consegne) |

Il controllo è **nell'API su ogni endpoint** (`puoToccare`): un installatore
che chiamasse a mano un indirizzo su un intervento non suo riceve `403`. Non
basta nascondere i pulsanti.

Gli installatori **si vedono fra loro**: serve a coordinarsi, a sostituirsi e a
non uscire in due allo stesso indirizzo. È una scelta, ed è scritta
nell'informativa privacy al punto 5.

### Le viste

- **Tiziana, Giorno** — una colonna per installatore, con la striscia
  "Da assegnare" in cima. È lo schermo dell'assegnazione: squilla il telefono,
  si guarda chi è libero.
- **Tiziana, Settimana** — sei giorni, con i filtri *Tutti / ciascun
  installatore / Da assegnare*. Con "Tutti" ogni giorno si divide fra i
  tecnici e i blocchi portano l'iniziale; con un filtro attivo le colonne
  tornano larghe.
- **Installatore** — Giorno (i suoi), Settimana (i suoi), **Tutti** (la
  giornata di entrambi) e **Da assegnare**, un'icona con la pastiglia del
  conteggio. I lavori già fatti si raccolgono in fondo.

### Il mucchio "Da assegnare"

In negozio Tiziana raccoglie le richieste senza fissare chi ci va; sono i
tecnici a concordare l'orario definitivo col cliente. Prendere un lavoro libero
è quindi **la via normale**, non un'eccezione — per questo la scheda porta una
pastiglia col numero invece di nascondersi in fondo a un elenco.

- un installatore può **prendersi** un lavoro libero, ma non affidarne uno a un
  collega: per quello deve prima prenderlo, e poi usare "Passa a"
- la vista parte da **una settimana fa**: un lavoro che nessuno ha preso e la
  cui data è già passata porta l'etichetta **In ritardo**, invece di sparire
- l'assegnazione usa un aggiornamento condizionato
  (`assegnato_a IS NOT DISTINCT FROM` il valore letto): se due tecnici lo
  prendono insieme, il secondo legge *"L'ha appena preso Michele"* invece di
  credere di averlo in mano
- prendere o passare un lavoro **non avvisa Tiziana**: le interessa che sia
  coperto, non chi dei due se l'è preso. Annullarlo e segnarlo fatto invece sì

### Stato "fatto"

Un appuntamento è `attivo`, `fatto` o `annullato`. È **l'installatore a
chiuderlo dal telefono**, con un pulsante grande nel dettaglio; l'ora finisce
in `fatto_il`. I fatti restano in agenda, barrati: servono allo storico e a non
far arrivare promemoria per lavori già chiusi. Gli annullati spariscono da
tutte le viste ma restano in tabella.

### Colonne e colori

L'ordine delle colonne e il colore di ciascun installatore vengono da
`utenti.posizione` (più basso = più a sinistra). Si cambia con una riga:

```sql
UPDATE utenti SET posizione = 1 WHERE email = 'michele@…';
UPDATE utenti SET posizione = 2 WHERE email = 'alessandro@…';
```

Il colore non è mai l'unica informazione: nella vista Settimana ogni blocco
porta anche l'iniziale, e "Urgente" e "Fatto" sono scritti a parole.

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

### Promemoria automatici

`netlify/functions/promemoria.mjs` non risponde a nessuna richiesta: la fa
partire Netlify **ogni mezz'ora** (`config.schedule`), che è anche il passo
delle fasce. A ogni giro cerca gli interventi **attivi e assegnati** che
cominciano fra 10 e 80 minuti, e avvisa chi li deve fare.

Con esecuzioni ogni 30 minuti, un intervento delle 10:00 ricade per la prima
volta in quella finestra al giro delle 09:00: **l'avviso arriva un'ora prima**.
La finestra è più larga apposta — se un'esecuzione saltasse, la successiva
recupera comunque l'appuntamento invece di lasciarlo senza avviso.

Il confronto fra l'orario in agenda e l'ora attuale lo fa Postgres
(`(data + ora) AT TIME ZONE 'Europe/Rome'`), che conosce l'ora legale: il cron
di Netlify ragiona in UTC e un orario fisso si sposterebbe due volte l'anno.

Costa circa **2 crediti Netlify al mese**, cioè due centesimi.

Perché non `pg_cron` dentro il database: Neon spegne il database dopo 5 minuti
di inattività, e un cron interno a un database spento non parte. La sveglia
deve stare fuori.

La tabella `promemoria_inviati` impedisce i doppioni: è l'`INSERT … ON CONFLICT
DO NOTHING` stesso a fare da guardia, quindi nemmeno due esecuzioni simultanee
possono mandare due volte lo stesso avviso. La chiave contiene **data e ora**
dell'appuntamento (`prima:12:2026-10-02:15:00`), così un intervento rimandato
fa ripartire l'avviso per il nuovo orario invece di restare muto.

### Notifiche sul telefono dell'installatore

Le attivano da soli, dal **campanello nella barra in alto**: una spunta verde
se arrivano, una croce rossa se no. Premendolo si apre una finestra che spiega
lo stato e permette di accenderle o spegnerle su quel dispositivo.

All'apertura, se non sono attive, la stessa finestra compare da sola. Non è il
permesso del browser: quello si può chiedere **solo dentro un gesto
dell'utente**, quindi parte dal tocco su «Attiva le notifiche». Chi risponde
«Non adesso» non se la ritrova per sette giorni (ricordato in `localStorage`,
che è una comodità di quel dispositivo e non un dato da conservare altrove).

- **Android**: funzionano dal browser, senza installare niente.
- **iPhone**: solo dopo *Condividi → Aggiungi a Home*, e poi riaprendo il
  pannello da quell'icona. È un vincolo di Apple. In Europa funzionano: la
  rimozione annunciata a febbraio 2024 è stata revocata il 1° marzo 2024.

Nella notifica finiscono **solo giorno, ora e nome**: indirizzo, telefono e
prezzo restano dietro il login.

Il **titolo cambia a seconda di chi legge**, perché spesso è l'unica riga che
si vede davvero. Quando un lavoro passa di mano — dal menu della scheda, dal
cassetto o dal mucchio dei lavori liberi — chi lo riceve legge «Intervento
assegnato a te» e chi lo lascia «Intervento passato a *nome*». I titoli stanno
in `netlify/lib/avvisi.mjs`, fuori dall'API, perché si possano provare da soli.

### L'agenda si aggiorna da sola

Tiziana tiene la dashboard aperta mentre Michele e Alessandro lavorano. Ogni
**20 secondi** il pannello chiede `GET /api/battito`, che risponde con un solo
numero: l'istante dell'ultima modifica. Se è lo stesso di prima la richiesta
finisce lì; se è diverso, il pannello si riprende gli appuntamenti e ridisegna
**senza accendere la barra di caricamento** — l'aggiornamento non l'ha chiesto
nessuno, e una barra che compare da sé a ogni salvataggio di un tecnico
sarebbe peggio del problema.

Non sono notifiche in tempo reale, ed è una scelta: Netlify non tiene
connessioni aperte, e tenerne una viva tutto il giorno costerebbe molto più di
una domanda ogni venti secondi.

**Perché il battito non passa dal database.** Neon sul piano gratuito spegne
il computo dopo 5 minuti di inattività, e il conto si fa sulle ore in cui resta
acceso: 100 CU-hours ≈ **400 ore** al mese a 0,25 CU. Una domanda ogni venti
secondi lo terrebbe sveglio per tutta la giornata lavorativa — da sole ~270
ore al mese, più le ~120 che già consumano i promemoria ogni mezz'ora. Si
arriverebbe al limite, e **superarlo sospende il database fino al mese
successivo**: tutto il pannello fermo. Quindi il numero vive in un deposito
[Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
(`netlify/lib/battito.mjs`), che non c'entra con Neon: leggerlo non sveglia
niente, e il database si tocca solo quando c'è davvero qualcosa di nuovo.

Due dettagli che sembrano pignoleria e non lo sono:

- **Il battito si legge prima dei dati, non dopo.** Viaggia insieme alla
  risposta di `GET /api/appuntamenti`, letto un attimo prima della query. Così
  il riferimento che il pannello si segna è al massimo vecchio quanto quello
  che mostra, mai più recente: al peggio si ridisegna una volta di troppo, e
  non capita mai di perdere una modifica arrivata nel mezzo.
- **Con una finestra aperta non si ridisegna niente.** Finché c'è un `<dialog>`
  aperto il controllo si ferma e non prende nemmeno nota del valore nuovo: così
  l'aggiornamento arriva appena Tiziana chiude, invece di sparire.

Se il deposito non risponde, `/battito` ripiega su `max(aggiornato_il)` nel
database: costa di più, ma il pannello non resta fermo. E `segnaCambiamento()`
non solleva mai: un problema lì vorrebbe dire al massimo che l'aggiornamento
arriva al cambio di vista, e non è un motivo per far fallire il salvataggio di
un appuntamento.

### L'account di prova

Un utente con `nascosto = true` serve a provare notifiche e schermate senza
rubare il posto a nessuno:

- **non** diventa una colonna fissa nell'agenda di Tiziana;
- **non** compare fra i colleghi a cui gli installatori possono passare un
  lavoro, né nella loro scheda «Tutti»;
- Tiziana lo trova lo stesso nel menu **«Assegnato a»**, sia nella scheda sia
  nel cassetto;
- la sua colonna **compare solo nei giorni in cui ha davvero qualcosa**, così
  un intervento affidato per prova non sparisce dalla vista.

La regola vale anche lato server: `installatoreValido()` accetta un account
nascosto solo se a chiedere è Tiziana, o se è l'account stesso a prendersi un
lavoro libero. Si crea con una riga di SQL, come gli altri.

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
  Si può **lasciare in bianco** — spesso la cifra si concorda dopo aver visto
  l'impianto — e allora vale zero, che nella scheda si legge «Da concordare»
  invece che «€ 0,00». Un importo *scritto male* resta però un errore: senza
  quella distinzione «ottanta» passerebbe per «non concordato» e il lavoro
  finirebbe salvato a zero senza che nessuno se ne accorga.

### Sicurezza

Password con **scrypt** (`node:crypto`, memory-hard come bcrypt e argon2, senza
dipendenze esterne); sessioni in cookie `HttpOnly` + `Secure` + `SameSite=Strict`
di cui il database conserva solo l'impronta SHA-256; limite di 8 tentativi di
accesso in 15 minuti per IP e per email; `Origin` verificato su ogni scrittura;
`no-store` e `noindex` su `/appuntamenti/*` e `/api/*`; `Disallow` in `robots.txt`.
Il service worker **non mette niente in cache**, di proposito.

### Aggiornamenti e PWA

Il pannello **non mette niente in cache**: il service worker serve solo a
ricevere le notifiche, e `netlify.toml` manda `no-store` su tutto
`/appuntamenti/*`. Riaprendolo si prende sempre l'ultima versione, anche
installato sulla schermata Home. L'avevo fatto per non lasciare dati dei
clienti sul telefono; il risultato è che gli aggiornamenti arrivano sempre.

Resta un caso: una pagina **lasciata aperta** mentre esce una versione nuova
continua a girare con il codice vecchio. `GET /api/configurazione` riporta
quindi una `versione`, e il pannello confronta quella vista all'avvio con
quella attuale — al ritorno in primo piano e ogni quarto d'ora. Se è cambiata
compare in basso una striscia *"È uscita una versione aggiornata"* con
**Ricarica**; rifiutandola non si ripresenta finché la pagina resta aperta.

La versione viene da `COMMIT_REF` se Netlify la espone a runtime, altrimenti
da `VERSIONE_PANNELLO` in `netlify/lib/configurazione.mjs`, **che va tenuta
uguale al `?v=` di `appuntamenti/index.html`**. Una prova in `npm test`
fallisce se le due si scollano, perché altrimenti l'avviso non comparirebbe
mai e nessuno se ne accorgerebbe.

Due cose che gli aggiornamenti **non** sistemano:

- su Android, nome e icona dell'app installata sono fotografati all'installazione
  e Chrome ci mette giorni ad accorgersi di un cambio del manifest; il contenuto
  no, quello è sempre aggiornato
- su iPhone l'app aggiunta alla Home ha **memoria propria**, separata da Safari:
  accesso e notifiche vanno rifatti dentro l'app

### Prove

```bash
npm test     # 30 prove sulla logica: fasce, prezzi, date, password, validazione, versione
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
