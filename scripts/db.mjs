#!/usr/bin/env node
// Strumenti di gestione del database del pannello appuntamenti.
//
//   npm run schema    crea o aggiorna le tabelle (si può rilanciare)
//   npm run utenti    crea un utente (Tiziana o un installatore)
//   npm run esempi    inserisce gli appuntamenti di prova
//
// Prima serve la stringa di connessione a Neon:
//
//   export DATABASE_URL='postgresql://…'
//
// Lo script gira sul computer, non su Netlify: serve solo per la prima
// configurazione e per aggiungere utenti.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { sql, stringaDiConnessione } from '../netlify/lib/db.mjs';
import { cifra } from '../netlify/lib/password.mjs';
import { prezzoInCentesimi } from '../netlify/lib/validazione.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));

function esci(messaggio) {
  console.error(`\n  ${messaggio}\n`);
  process.exit(1);
}

if (!stringaDiConnessione()) {
  esci(
    'Manca DATABASE_URL.\n\n' +
    "  Crea un progetto gratuito su https://neon.tech, copia la stringa di\n" +
    '  connessione e lanciala così:\n\n' +
    "    export DATABASE_URL='postgresql://…'"
  );
}

// ---------------------------------------------------------------------------
// schema
// ---------------------------------------------------------------------------

/**
 * Divide il file .sql nelle singole istruzioni. Il driver HTTP di Neon ne
 * esegue una per volta, quindi togliamo i commenti e spezziamo sui punti e
 * virgola. Lo schema non contiene stringhe con punti e virgola dentro, quindi
 * una divisione semplice basta e avanza.
 */
function istruzioni(testo) {
  return testo
    .split('\n')
    .filter((riga) => !riga.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function comandoSchema() {
  const file = await readFile(join(QUI, '..', 'db', 'schema.sql'), 'utf8');
  const elenco = istruzioni(file);
  const database = sql();

  console.log(`\n  Applico ${elenco.length} istruzioni…\n`);
  for (const istruzione of elenco) {
    const etichetta = istruzione.replace(/\s+/g, ' ').slice(0, 68);
    try {
      await database.query(istruzione);
      console.log(`  ✓ ${etichetta}…`);
    } catch (errore) {
      console.error(`  ✗ ${etichetta}…`);
      esci(`Errore dal database: ${errore.message}`);
    }
  }
  console.log('\n  Schema applicato.\n');
}

// ---------------------------------------------------------------------------
// utenti
// ---------------------------------------------------------------------------

/** Chiede una password senza mostrarla mentre viene digitata. */
function chiediPassword(domanda) {
  return new Promise((risolvi) => {
    const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
    let mostra = true;
    // Finché stiamo scrivendo la password, non facciamo eco dei caratteri.
    rl._writeToOutput = function (stringa) {
      if (mostra) rl.output.write(stringa);
    };
    rl.question(domanda).then((risposta) => {
      rl.close();
      stdout.write('\n');
      risolvi(risposta);
    });
    mostra = false;
    stdout.write(domanda);
  });
}

async function comandoUtenti() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log('\n  Nuovo utente del pannello appuntamenti\n');

  const email = (await rl.question('  Email: ')).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    rl.close();
    esci('Email non valida.');
  }

  const nome = (await rl.question('  Nome (come appare in alto a destra): ')).trim();
  if (!nome) { rl.close(); esci('Il nome è obbligatorio.'); }

  const rispostaRuolo = (await rl.question('  Ruolo [1 = amministratore, 2 = installatore]: ')).trim();
  const ruolo = rispostaRuolo === '1' ? 'admin' : rispostaRuolo === '2' ? 'installatore' : null;
  if (!ruolo) { rl.close(); esci('Rispondi 1 oppure 2.'); }

  rl.close();

  const password = await chiediPassword('  Password (non viene mostrata): ');
  if (password.length < 10) {
    esci('La password deve essere lunga almeno 10 caratteri.');
  }
  const conferma = await chiediPassword('  Ripeti la password: ');
  if (password !== conferma) esci('Le due password non coincidono.');

  const hash = await cifra(password);
  const database = sql();

  try {
    const [utente] = await database`
      INSERT INTO utenti (email, password_hash, nome, ruolo)
      VALUES (${email}, ${hash}, ${nome}, ${ruolo})
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            nome          = EXCLUDED.nome,
            ruolo         = EXCLUDED.ruolo
      RETURNING id, email, nome, ruolo
    `;
    console.log(
      `\n  Utente salvato: ${utente.nome} <${utente.email}> — ` +
      `${utente.ruolo === 'admin' ? 'amministratore' : 'installatore'}\n`
    );
    console.log('  Se l\'email esisteva già, la password è stata sostituita.\n');
  } catch (errore) {
    esci(`Errore dal database: ${errore.message}`);
  }
}

// ---------------------------------------------------------------------------
// esempi
// ---------------------------------------------------------------------------

const ESEMPI = [
  ['Antonio Greco', 'Via dei Bizantini 45, Lamezia Terme', '333 1234567', '80', 0, '09:00', 'Parabola Sky da riallineare', false],
  ['Maria Perri', 'Via Marconi 8, Sambiase', '339 2345678', '120', 0, '11:30', 'Antenna TV in camera da letto, portare 20 m di cavo', false],
  ['Pasquale Iannazzo', 'Via Adda 21, Lamezia Terme', '347 3456789', '60', 0, '15:00', 'Nessun segnale su tutti i canali. Cliente in casa dalle 14.', true],
  ['Domenico Villella', 'Via Aldo Moro 9, Sambiase', '340 1234098', '130', 3, '12:00', '', false],
  ['Elena Scalise', 'Via Mazzini 34, Nicastro', '366 2345109', '60', 3, '12:30', '', false],
];

async function comandoEsempi() {
  const { oggi, lunedi, piuGiorni } = await import('../netlify/lib/calendario.mjs');
  const database = sql();
  const inizioSettimana = lunedi(oggi());

  console.log('\n  Inserisco gli appuntamenti di prova nella settimana corrente…\n');
  let inseriti = 0;

  for (const [nome, luogo, telefono, prezzo, scarto, ora, note, urgente] of ESEMPI) {
    const data = piuGiorni(inizioSettimana, scarto);
    try {
      await database`
        INSERT INTO appuntamenti
          (nome_cliente, luogo_impianto, telefono_cliente, prezzo_centesimi, data, ora, note, urgente)
        VALUES
          (${nome}, ${luogo}, ${telefono}, ${prezzoInCentesimi(prezzo)}, ${data}, ${ora}, ${note}, ${urgente})
      `;
      console.log(`  ✓ ${data} ${ora}  ${nome}`);
      inseriti += 1;
    } catch (errore) {
      if (errore.message.includes('appuntamenti_una_per_fascia')) {
        console.log(`  – ${data} ${ora}  fascia già occupata, salto`);
      } else {
        console.error(`  ✗ ${nome}: ${errore.message}`);
      }
    }
  }
  console.log(`\n  ${inseriti} appuntamenti inseriti.\n`);
}

// ---------------------------------------------------------------------------

const comandi = { schema: comandoSchema, utenti: comandoUtenti, esempi: comandoEsempi };
const scelto = process.argv[2];

if (!comandi[scelto]) {
  esci('Uso: node scripts/db.mjs [schema|utenti|esempi]');
}

await comandi[scelto]();
