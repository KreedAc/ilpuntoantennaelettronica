-- ===================================================================
-- INTERVENTI SENZA ORARIO
-- Da incollare nel SQL Editor di Neon.  CTRL+A PRIMA DI PREMERE RUN.
--
-- Controlla in alto a sinistra che il ramo sia "production".
--
-- Toglie il controllo che obbligava gli interventi ad avere un'ora: da
-- adesso Tiziana può fissare un intervento per il giorno e lasciare
-- l'orario da concordare.
--
-- Non tocca nessun dato. Si può lanciare anche due volte.
-- ===================================================================

ALTER TABLE appuntamenti DROP CONSTRAINT IF EXISTS appuntamenti_ora_per_interventi;

-- Verifica: deve restituire ZERO righe.
SELECT conname
FROM pg_constraint
WHERE conname = 'appuntamenti_ora_per_interventi';
