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

-- Per i database creati prima che questa colonna esistesse.
ALTER TABLE utenti
  ADD COLUMN IF NOT EXISTS deve_cambiare_password BOOLEAN NOT NULL DEFAULT false;

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
-- Gli annullati restano in tabella con stato = 'annullato' (cancellazione
-- logica). Tutte le query di lettura per le viste filtrano stato = 'attivo'.

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
  stato            TEXT        NOT NULL DEFAULT 'attivo'
                               CHECK (stato IN ('attivo', 'annullato')),
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

-- Un solo appuntamento ATTIVO per fascia. È un indice unico parziale: gli
-- annullati sono esclusi, quindi una fascia liberata torna disponibile.
-- Questo rende impossibile la doppia prenotazione anche se due richieste
-- arrivano nello stesso istante: il secondo INSERT viene rifiutato dal
-- database e l'API risponde 409 "Fascia già occupata".
CREATE UNIQUE INDEX IF NOT EXISTS appuntamenti_una_per_fascia
  ON appuntamenti (data, ora)
  WHERE stato = 'attivo';

-- Indice per le letture per intervallo (vista giorno e vista settimana).
CREATE INDEX IF NOT EXISTS appuntamenti_per_data
  ON appuntamenti (data, ora)
  WHERE stato = 'attivo';

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
