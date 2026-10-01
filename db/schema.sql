-- Pannello appuntamenti – Il Punto Antenna Elettronica
-- Postgres (Neon). Si applica con:  npm run schema
--
-- Lo script è idempotente: si può rilanciare su un database già popolato
-- senza perdere dati.

-- ---------------------------------------------------------------------------
-- Utenti
-- ---------------------------------------------------------------------------
-- Non esiste registrazione pubblica: gli account si creano con `npm run utenti`.
-- La password non è mai in chiaro; `password_hash` contiene l'algoritmo, i
-- parametri, il sale e il digest (vedi netlify/lib/password.mjs).

-- `deve_cambiare_password` a true obbliga l'utente a sceglierne una propria al
-- primo accesso: finché non lo fa, il pannello mostra soltanto quella
-- schermata e l'API rifiuta ogni altra richiesta. Serve quando l'account
-- viene creato da qualcun altro con una password provvisoria.

CREATE TABLE IF NOT EXISTS utenti (
  id                     SERIAL PRIMARY KEY,
  email                  TEXT        NOT NULL UNIQUE,
  password_hash          TEXT        NOT NULL,
  nome                   TEXT        NOT NULL,
  ruolo                  TEXT        NOT NULL CHECK (ruolo IN ('admin', 'installatore')),
  deve_cambiare_password BOOLEAN     NOT NULL DEFAULT false,
  creato_il              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per i database creati prima che queste colonne esistessero.
ALTER TABLE utenti
  ADD COLUMN IF NOT EXISTS deve_cambiare_password BOOLEAN NOT NULL DEFAULT false;

-- `posizione` decide l'ordine delle colonne nell'agenda e il colore assegnato
-- a ciascun installatore. Più basso = più a sinistra. Si cambia con una
-- riga di SQL, per esempio:
--   UPDATE utenti SET posizione = 1 WHERE email = 'michele@…';
--   UPDATE utenti SET posizione = 2 WHERE email = 'alessandro@…';
ALTER TABLE utenti
  ADD COLUMN IF NOT EXISTS posizione SMALLINT NOT NULL DEFAULT 0;

-- `nascosto` serve all'account di prova: Tiziana può affidargli un lavoro dal
-- menu a tendina, ma non diventa una colonna fissa nell'agenda né un collega a
-- cui gli installatori possono passare un intervento. La colonna compare solo
-- nei giorni in cui ha davvero qualcosa, così niente sparisce dalla vista.
ALTER TABLE utenti
  ADD COLUMN IF NOT EXISTS nascosto BOOLEAN NOT NULL DEFAULT false;

-- Il confronto delle email è sempre in minuscolo.
CREATE UNIQUE INDEX IF NOT EXISTS utenti_email_minuscola
  ON utenti (lower(email));

-- ---------------------------------------------------------------------------
-- Sessioni
-- ---------------------------------------------------------------------------
-- Nel database finisce solo l'impronta SHA-256 del token: chi leggesse la
-- tabella non potrebbe comunque spacciarsi per un utente collegato.

CREATE TABLE IF NOT EXISTS sessioni (
  token_hash TEXT        PRIMARY KEY,
  utente_id  INTEGER     NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
  creata_il  TIMESTAMPTZ NOT NULL DEFAULT now(),
  scade_il   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessioni_scadenza ON sessioni (scade_il);

-- ---------------------------------------------------------------------------
-- Appuntamenti
-- ---------------------------------------------------------------------------
-- `data` e `ora` sono separate e senza fuso orario di proposito: un
-- appuntamento "giovedì alle 15:00" resta tale a prescindere dal fuso del
-- server, e l'ora legale non lo sposta mai.
--
-- Il prezzo è in centesimi (intero): niente errori di arrotondamento.
--
-- Tre stati:
--   attivo     da fare
--   fatto      eseguito (resta in agenda, barrato) con l'ora in `fatto_il`
--   annullato  sparito da tutte le viste, ma conservato per storico
--
-- `assegnato_a` vuoto significa "da assegnare": è il mucchio dei lavori presi
-- al telefono prima di decidere chi ci va.

CREATE TABLE IF NOT EXISTS appuntamenti (
  id               SERIAL PRIMARY KEY,
  nome_cliente     TEXT        NOT NULL CHECK (length(btrim(nome_cliente)) > 0),
  luogo_impianto   TEXT        NOT NULL CHECK (length(btrim(luogo_impianto)) > 0),
  telefono_cliente TEXT        NOT NULL CHECK (length(btrim(telefono_cliente)) > 0),
  prezzo_centesimi INTEGER     NOT NULL CHECK (prezzo_centesimi >= 0),
  data             DATE        NOT NULL,
  ora              TIME        NOT NULL,
  note             TEXT        NOT NULL DEFAULT '',
  urgente          BOOLEAN     NOT NULL DEFAULT false,
  stato            TEXT        NOT NULL DEFAULT 'attivo',
  assegnato_a      INTEGER     REFERENCES utenti(id) ON DELETE SET NULL,
  fatto_il         TIMESTAMPTZ,
  creato_da        INTEGER     REFERENCES utenti(id) ON DELETE SET NULL,
  creato_il        TIMESTAMPTZ NOT NULL DEFAULT now(),
  aggiornato_il    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Fasce da 30 minuti: l'orario deve cadere esatto sull'ora o sulla mezz'ora.
  -- Il controllo è ripetuto anche nell'API, ma averlo qui rende impossibile
  -- inserire un orario storto anche scrivendo a mano nel database.
  CONSTRAINT ora_a_fasce_di_trenta_minuti
    CHECK (EXTRACT(MINUTE FROM ora) IN (0, 30)
           AND EXTRACT(SECOND FROM ora) = 0)
);

-- Colonne aggiunte dopo la prima versione: si applicano anche a un database
-- già popolato.
ALTER TABLE appuntamenti
  ADD COLUMN IF NOT EXISTS assegnato_a INTEGER REFERENCES utenti(id) ON DELETE SET NULL;
ALTER TABLE appuntamenti
  ADD COLUMN IF NOT EXISTS fatto_il TIMESTAMPTZ;

-- Il vincolo sullo stato va rifatto: la prima versione ammetteva solo due
-- valori e rifiuterebbe 'fatto'.
ALTER TABLE appuntamenti DROP CONSTRAINT IF EXISTS appuntamenti_stato_check;
ALTER TABLE appuntamenti ADD CONSTRAINT appuntamenti_stato_check
  CHECK (stato IN ('attivo', 'fatto', 'annullato'));

-- `fatto_il` esiste se e solo se lo stato è 'fatto': impedisce che una riga
-- dica una cosa e la data ne dica un'altra.
ALTER TABLE appuntamenti DROP CONSTRAINT IF EXISTS appuntamenti_fatto_coerente;
ALTER TABLE appuntamenti ADD CONSTRAINT appuntamenti_fatto_coerente
  CHECK ((stato = 'fatto') = (fatto_il IS NOT NULL));

-- Un solo appuntamento per fascia PER INSTALLATORE. Con due tecnici, alle
-- 15:00 di giovedì possono lavorare tutti e due: quello che non si può fare è
-- mandare la stessa persona in due posti nello stesso momento.
--
-- Sono esclusi gli annullati (la fascia torna libera) e quelli ancora da
-- assegnare, che per definizione non occupano l'agenda di nessuno.
--
-- Il vincolo sta nel database e non solo nel codice: due richieste inviate
-- nello stesso istante non possono sovrapporsi, la seconda viene rifiutata e
-- l'API risponde 409 "Fascia già occupata".
DROP INDEX IF EXISTS appuntamenti_una_per_fascia;
CREATE UNIQUE INDEX IF NOT EXISTS appuntamenti_una_per_fascia_per_persona
  ON appuntamenti (data, ora, assegnato_a)
  WHERE stato <> 'annullato' AND assegnato_a IS NOT NULL;

-- Indici per le letture per intervallo (viste giorno e settimana).
DROP INDEX IF EXISTS appuntamenti_per_data;
CREATE INDEX IF NOT EXISTS appuntamenti_per_data_non_annullati
  ON appuntamenti (data, ora)
  WHERE stato <> 'annullato';

CREATE INDEX IF NOT EXISTS appuntamenti_per_assegnatario
  ON appuntamenti (assegnato_a, data)
  WHERE stato <> 'annullato';

-- ---------------------------------------------------------------------------
-- Iscrizioni alle notifiche push
-- ---------------------------------------------------------------------------
-- Una riga per dispositivo. L'endpoint è la chiave: se l'installatore
-- reinstalla l'app, il browser ne genera uno nuovo e il vecchio viene
-- ripulito quando il servizio push risponde 404/410.

CREATE TABLE IF NOT EXISTS push_iscrizioni (
  endpoint   TEXT        PRIMARY KEY,
  utente_id  INTEGER     NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  creata_il  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_iscrizioni_utente
  ON push_iscrizioni (utente_id);

-- ---------------------------------------------------------------------------
-- Tentativi di accesso falliti (limite ai tentativi)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tentativi_accesso (
  id     SERIAL PRIMARY KEY,
  chiave TEXT        NOT NULL,
  quando TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tentativi_accesso_chiave_quando
  ON tentativi_accesso (chiave, quando);

-- ---------------------------------------------------------------------------
-- Promemoria già inviati
-- ---------------------------------------------------------------------------
-- La funzione dei promemoria gira ogni mezz'ora e decide da sé se è il momento
-- di mandare qualcosa. Questa tabella è il suo appunto di cosa ha già fatto:
-- senza, due giri ravvicinati manderebbero lo stesso riepilogo due volte.
--
-- La chiave è del tipo  'sera:2026-10-01:utente-3'.

CREATE TABLE IF NOT EXISTS promemoria_inviati (
  chiave TEXT        PRIMARY KEY,
  quando TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promemoria_inviati_quando
  ON promemoria_inviati (quando);
