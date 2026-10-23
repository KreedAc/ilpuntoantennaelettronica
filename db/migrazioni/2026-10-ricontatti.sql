-- ===================================================================
-- RICONTATTI DI TIZIANA
-- Da incollare nel SQL Editor di Neon.  CTRL+A PRIMA DI PREMERE RUN.
--
-- PRIMA DI TUTTO, un ramo di sicurezza (è gratis e ci vuole un minuto):
--   Neon → il progetto → Branches → "New branch" → nome: prima-ricontatti
-- Se qualcosa andasse storto, i dati di adesso sono lì.
--
-- Va lanciato PRIMA di pubblicare il nuovo pannello. È compatibile con
-- il pannello di adesso: aggiunge e allarga, non toglie niente, quindi
-- tutto continua a funzionare come prima finché non arriva il codice nuovo.
--
-- Si può lanciare anche due volte: non rompe niente.
-- ===================================================================

-- 1) Il tipo: ogni riga che c'è già diventa 'intervento', come prima.
ALTER TABLE appuntamenti
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'intervento';
ALTER TABLE appuntamenti DROP CONSTRAINT IF EXISTS appuntamenti_tipo_check;
ALTER TABLE appuntamenti ADD CONSTRAINT appuntamenti_tipo_check
  CHECK (tipo IN ('intervento', 'ricontatto'));

-- 2) L'ora diventa facoltativa, ma solo per i ricontatti.
ALTER TABLE appuntamenti ALTER COLUMN ora DROP NOT NULL;
ALTER TABLE appuntamenti DROP CONSTRAINT IF EXISTS appuntamenti_ora_per_interventi;
ALTER TABLE appuntamenti ADD CONSTRAINT appuntamenti_ora_per_interventi
  CHECK (tipo = 'ricontatto' OR ora IS NOT NULL);

-- 3) Il luogo: obbligatorio per gli interventi, vuoto per i ricontatti.
ALTER TABLE appuntamenti DROP CONSTRAINT IF EXISTS appuntamenti_luogo_impianto_check;
ALTER TABLE appuntamenti DROP CONSTRAINT IF EXISTS appuntamenti_luogo_per_interventi;
ALTER TABLE appuntamenti ADD CONSTRAINT appuntamenti_luogo_per_interventi
  CHECK (tipo = 'ricontatto' OR length(btrim(luogo_impianto)) > 0);

-- 4) "Uno per fascia" vale solo per gli interventi.
DROP INDEX IF EXISTS appuntamenti_una_per_fascia;
DROP INDEX IF EXISTS appuntamenti_una_per_fascia_per_persona;
CREATE UNIQUE INDEX appuntamenti_una_per_fascia_per_persona
  ON appuntamenti (data, ora, assegnato_a)
  WHERE stato <> 'annullato' AND assegnato_a IS NOT NULL AND tipo = 'intervento';

CREATE INDEX IF NOT EXISTS appuntamenti_ricontatti
  ON appuntamenti (assegnato_a, data)
  WHERE tipo = 'ricontatto' AND stato <> 'annullato';

-- 5) Controllo: deve uscire una riga sola, "intervento", con il numero
--    di appuntamenti che avevi prima.
SELECT tipo, count(*) AS quanti FROM appuntamenti GROUP BY tipo;
