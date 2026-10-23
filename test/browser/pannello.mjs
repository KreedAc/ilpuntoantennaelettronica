// Prove del pannello appuntamenti in un browser vero, con l'API simulata.
//
//   npm run prova-browser
//
// Non fa parte di `npm test` perché serve Chromium. L'API è finta ma si
// comporta come quella vera nelle cose che contano qui: gli interventi non
// contengono mai ricontatti, e i ricontatti li vede solo l'amministratore.
// Il vero lucchetto sta nell'API, ed è provato in test/logica.test.mjs; qui si
// prova quello che fa il pannello.
//
// Sta nel repository e non in una cartella temporanea per un motivo preciso:
// la versione precedente di queste prove viveva fuori, ed è sparita con il
// container che la ospitava.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const pw = await import('playwright')
  .catch(() => import('/opt/node22/lib/node_modules/playwright/index.js'));
const { chromium } = pw.default ?? pw;

const RADICE = fileURLToPath(new URL('../../', import.meta.url));
const SCATTI = process.env.SCATTI ?? null;   // cartella per gli screenshot, se serve

// --- server statico ---------------------------------------------------------

const TIPI = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};
const server = createServer(async (req, res) => {
  let percorso = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (percorso.endsWith('/')) percorso += 'index.html';
  const file = normalize(join(RADICE, percorso));
  if (!file.startsWith(RADICE)) { res.writeHead(403).end(); return; }
  try {
    const corpo = await readFile(file);
    res.writeHead(200, { 'Content-Type': TIPI[extname(file)] ?? 'application/octet-stream' });
    res.end(corpo);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${server.address().port}/appuntamenti/`;

// --- date relative a oggi ----------------------------------------------------
// Mai date scritte a mano: invecchiano in un giorno.

const ROMA = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
const OGGI = ROMA.format(new Date());
const giorniDa = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isoGiorno = (iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() || 7);
const lunediDi = (iso) => giorniDa(iso, -(isoGiorno(iso) - 1));
const FRA_UN_ANNO = giorniDa(OGGI, 365);

const FASCE = [];
for (let m = 8 * 60; m < 20 * 60; m += 30) {
  FASCE.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
}

// --- esiti -----------------------------------------------------------------

const esiti = [];
async function prova(nome, fn) {
  try { await fn(); esiti.push(1); console.log(`  ok   ${nome}`); }
  catch (e) { esiti.push(0); console.log(`  KO   ${nome}\n       ${e.message.split('\n')[0]}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const norm = (s) => s.replace(/[‘’]/g, "'").toLowerCase();
const contiene = (t, a) => norm(t).includes(norm(a));

// --- API simulata ------------------------------------------------------------

const UTENTI = [
  { id: 1, nome: 'Tiziana', ruolo: 'admin', posizione: 0 },
  { id: 2, nome: 'Michele', ruolo: 'installatore', posizione: 1 },
  { id: 3, nome: 'Alessandro', ruolo: 'installatore', posizione: 2 },
];

function nuovoDb({ ricontatti = [] } = {}) {
  const intervento = (id, nome, luogo, data, ora, chi) => ({
    id, tipo: 'intervento', nomeCliente: nome, luogoImpianto: luogo,
    telefonoCliente: '333 1234567', telefonoPerChiamata: '+393331234567',
    mappa: 'https://maps.example/', prezzoCentesimi: 8000, prezzoConcordato: '80,00',
    data, ora, note: '', urgente: false, stato: 'attivo', fatto: false, fattoAlle: null,
    assegnatoA: chi, assegnatoNome: UTENTI.find((u) => u.id === chi)?.nome ?? null,
  });
  return {
    prossimo: 100,
    utente: null,
    righe: [
      intervento(1, 'Maria Perri', 'Via Marconi 8', OGGI, '10:00', 2),
      intervento(2, 'Elena Scalise', 'Via Mazzini 34', OGGI, '11:00', 3),
      ...ricontatti.map((r, i) => ({
        id: 50 + i, tipo: 'ricontatto', nomeCliente: r.nome, telefonoCliente: r.telefono ?? '333 7654321',
        telefonoPerChiamata: '+393337654321', data: r.data, ora: r.ora ?? null, note: r.note ?? '',
        stato: r.fatto ? 'fatto' : 'attivo', fatto: !!r.fatto, fattoAlle: r.fatto ? '09:00' : null,
        assegnatoA: 1,
      })),
    ],
  };
}

async function collega(pagina, db) {
  await pagina.route('**/api/**', async (rotta) => {
    const req = rotta.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^\/api/, '');
    const metodo = req.method();
    const corpo = req.postData() ? JSON.parse(req.postData()) : {};
    const j = (d, s = 200) => rotta.fulfill({
      status: s, contentType: 'application/json', body: JSON.stringify(d),
      headers: { 'Cache-Control': 'no-store' },
    });

    if (p === '/configurazione') {
      return j({ fasce: FASCE, chiavePush: null, versione: 'a',
        diretta: { dalle: '09:00', alle: '20:00', giorni: [] } });
    }
    if (p === '/login' && metodo === 'POST') {
      const u = UTENTI.find((x) => x.nome.toLowerCase() === String(corpo.email).split('@')[0]);
      if (!u || corpo.password !== 'giusta') return j({ errore: 'Credenziali non valide' }, 401);
      db.utente = { ...u, deveCambiarePassword: false };
      return j({ utente: db.utente });
    }
    if (p === '/sessione') return db.utente ? j({ utente: db.utente }) : j({ errore: 'Non autenticato' }, 401);
    if (!db.utente) return j({ errore: 'Non autenticato' }, 401);
    if (p === '/battito') return j({ cambiato: 0 });

    const admin = db.utente.ruolo === 'admin';
    const vive = () => db.righe.filter((x) => x.stato !== 'annullato');
    const interventi = () => vive().filter((x) => x.tipo === 'intervento');
    const suoiRicontatti = () => vive().filter((x) => x.tipo === 'ricontatto' && x.assegnatoA === db.utente.id);

    if (p === '/utenti') {
      return j({
        utenti: UTENTI.map((u) => ({ ...u, notificheAttive: true })),
        daAssegnare: interventi().filter((x) => x.assegnatoA === null && x.stato === 'attivo').length,
      });
    }
    if (p === '/appuntamenti' && metodo === 'GET') {
      const dal = url.searchParams.get('dal'), al = url.searchParams.get('al');
      return j({ battito: 0, appuntamenti: interventi().filter((x) => x.data >= dal && x.data <= al) });
    }
    if (p === '/storico') {
      if (!admin) return j({ errore: 'Riservato' }, 403);
      return j({ mese: url.searchParams.get('mese'), fatti: [], sospesi: [] });
    }

    // Ricontatti: solo l'amministratore, e solo i propri.
    if (p.startsWith('/ricontatti')) {
      if (!admin) return j({ errore: 'Riservato all\'amministratore' }, 403);
      db.chiamateRicontatti = (db.chiamateRicontatti ?? 0) + 1;
      if (p === '/ricontatti' && metodo === 'GET') {
        return j({ ricontatti: suoiRicontatti()
          .sort((a, b) => (a.data + (a.ora ?? '')).localeCompare(b.data + (b.ora ?? ''))) });
      }
      const valida = () => {
        const campi = {};
        if (!String(corpo.nomeCliente ?? '').trim()) campi.nomeCliente = 'Campo obbligatorio';
        const tel = String(corpo.telefonoCliente ?? '').trim();
        if (!tel) campi.telefonoCliente = 'Campo obbligatorio';
        else if (tel.replace(/\D/g, '').length < 6) campi.telefonoCliente = 'Numero di telefono non valido';
        if (!corpo.data) campi.data = 'Campo obbligatorio';
        return campi;
      };
      if (p === '/ricontatti' && metodo === 'POST') {
        const campi = valida();
        if (Object.keys(campi).length) return j({ errore: 'Controlla i campi segnalati', campi }, 400);
        const r = {
          id: db.prossimo++, tipo: 'ricontatto', nomeCliente: corpo.nomeCliente.trim(),
          telefonoCliente: corpo.telefonoCliente.trim(), telefonoPerChiamata: '+39' + corpo.telefonoCliente.replace(/\D/g, ''),
          data: corpo.data, ora: corpo.ora || null, note: corpo.note ?? '',
          stato: 'attivo', fatto: false, fattoAlle: null, assegnatoA: db.utente.id,
        };
        db.righe.push(r);
        return j({ ricontatto: r }, 201);
      }
      const m = /^\/ricontatti\/(\d+)(?:\/(fatto|annulla))?$/.exec(p);
      const r = m && suoiRicontatti().find((x) => x.id === Number(m[1]));
      if (!r) return j({ errore: 'Ricontatto non trovato' }, 404);
      if (!m[2] && metodo === 'PATCH') {
        const campi = valida();
        if (Object.keys(campi).length) return j({ errore: 'Controlla i campi segnalati', campi }, 400);
        Object.assign(r, { nomeCliente: corpo.nomeCliente, telefonoCliente: corpo.telefonoCliente,
          data: corpo.data, ora: corpo.ora || null, note: corpo.note ?? '' });
        return j({ ricontatto: r });
      }
      if (m[2] === 'fatto') {
        const f = corpo.fatto !== false;
        Object.assign(r, { stato: f ? 'fatto' : 'attivo', fatto: f, fattoAlle: f ? '12:00' : null });
        return j({ ricontatto: r });
      }
      if (m[2] === 'annulla') { r.stato = 'annullato'; return j({ annullato: true }); }
    }
    return j({ errore: 'Indirizzo non trovato' }, 404);
  });
}

async function entra(pagina, chi) {
  await pagina.goto(BASE, { waitUntil: 'networkidle' });
  await pagina.fill('input[name="email"]', `${chi}@esempio.it`);
  await pagina.fill('input[name="password"]', 'giusta');
  await pagina.click('button[type="submit"]');
  await pagina.waitForFunction(() => location.search.includes('vista='));
  await pagina.waitForSelector('.agenda, .elenco, .vuoto, .app-installatore');
}

/** Il pannello non si svuota mentre carica: il segnale vero è la barra. */
async function attendiCaricamento(pagina) {
  try { await pagina.waitForSelector('.barra-caricamento', { timeout: 1500 }); } catch { /* già finito */ }
  await pagina.waitForSelector('.barra-caricamento', { state: 'detached', timeout: 15000 });
}

/** Sceglie una data nel selettore, come farebbe una persona. */
async function scegliData(pagina, valore) {
  const campo = pagina.locator('.scelta-data');
  await campo.fill(valore);
  await campo.dispatchEvent('change');
}

const browser = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const PC = { viewport: { width: 1600, height: 950 }, locale: 'it-IT' };
const TELEFONO = { viewport: { width: 390, height: 844 }, locale: 'it-IT', hasTouch: true, isMobile: true };

// =============================================================== CALENDARIO
console.log('\nTIZIANA · CALENDARIO\n');
{
  const db = nuovoDb();
  const ctx = await browser.newContext(PC);
  const pagina = await ctx.newPage();
  await collega(pagina, db);
  await entra(pagina, 'tiziana');
  await pagina.goto(`${BASE}?vista=giorno&giorno=${OGGI}`, { waitUntil: 'networkidle' });
  await pagina.waitForSelector('.agenda .persona');

  await prova('la barra dice «Calendario»', async () => {
    const testo = await pagina.locator('.barra .sezione').innerText();
    assert(testo === 'Calendario', `dice: ${testo}`);
  });

  await prova('le schede sono Giorno, Settimana, Ricontatti, Storico', async () => {
    const schede = await pagina.locator('.scelta-vista button').allInnerTexts();
    assert(schede.join('|') === 'Giorno|Settimana|Ricontatti|Storico', schede.join(', '));
  });

  await prova('il giorno mostra le colonne dei tecnici e i loro interventi', async () => {
    const colonne = await pagina.locator('.agenda .intestazione .persona').count();
    assert(colonne === 2, `colonne: ${colonne}`);
    assert(await pagina.locator('.blocco:has-text("Maria Perri")').isVisible(), 'manca un intervento');
  });

  await prova('dal selettore si arriva a un giorno fra un anno', async () => {
    await scegliData(pagina, FRA_UN_ANNO);
    await pagina.waitForFunction((d) => location.search.includes(`giorno=${d}`), FRA_UN_ANNO);
    await attendiCaricamento(pagina);
    const titolo = await pagina.locator('.strumenti h1').innerText();
    assert(titolo.includes(FRA_UN_ANNO.slice(0, 4)), `titolo: ${titolo}`);
    assert((await pagina.locator('.scelta-data').inputValue()) === FRA_UN_ANNO,
      'il selettore non mostra la data in cui si è');
  });

  await prova('in Settimana, scegliere un giorno apre la sua settimana', async () => {
    await pagina.click('.scelta-vista button:has-text("Settimana")');
    await attendiCaricamento(pagina);
    await scegliData(pagina, FRA_UN_ANNO);
    const lunedi = lunediDi(FRA_UN_ANNO);
    await pagina.waitForFunction((l) => location.search.includes(`settimana=${l}`), lunedi);
    await attendiCaricamento(pagina);
    assert(await pagina.locator('.agenda').isVisible(), 'la settimana non si è disegnata');
  });

  await ctx.close();
}

// =============================================================== RICONTATTI
console.log('\nTIZIANA · RICONTATTI\n');
{
  const db = nuovoDb();
  const ctx = await browser.newContext(PC);
  const pagina = await ctx.newPage();
  await collega(pagina, db);
  await entra(pagina, 'tiziana');
  await pagina.click('.scelta-vista button:has-text("Ricontatti")');
  await attendiCaricamento(pagina);

  const salvaRicontatto = async ({ nome, telefono = '333 1112223', data, ora = '', note = '' }) => {
    await pagina.click('button:has-text("Nuovo ricontatto")');
    await pagina.waitForSelector('dialog.pannello[open]');
    await pagina.fill('dialog input[name="nomeCliente"]', nome);
    await pagina.fill('dialog input[name="telefonoCliente"]', telefono);
    await pagina.fill('dialog input[name="data"]', data);
    await pagina.selectOption('dialog select[name="ora"]', ora);
    if (note) await pagina.fill('dialog textarea[name="note"]', note);
    await pagina.click('dialog button:has-text("Salva ricontatto")');
  };

  await prova('vuota, la scheda spiega a cosa serve', async () => {
    const testo = await pagina.locator('.ricontatti .vuoto').innerText();
    assert(contiene(testo, 'chi richiamare'), testo);
  });

  await prova('un ricontatto senza ora finisce in «Oggi», «in giornata»', async () => {
    await salvaRicontatto({ nome: 'Mario Greco', data: OGGI });
    await pagina.waitForSelector('dialog.pannello', { state: 'detached' });
    await pagina.waitForSelector('.gruppo-ricontatti:has-text("Oggi") .voce:has-text("Mario Greco")');
    const voce = await pagina.locator('.voce:has-text("Mario Greco")').innerText();
    assert(contiene(voce, 'in giornata'), voce);
  });

  await prova('con l\'ora, l\'ora si vede', async () => {
    await salvaRicontatto({ nome: 'Anna Folino', data: OGGI, ora: '16:30' });
    await pagina.waitForSelector('.voce:has-text("Anna Folino")');
    assert(contiene(await pagina.locator('.voce:has-text("Anna Folino")').innerText(), '16:30'), 'ora mancante');
  });

  await prova('quelli fra un anno stanno sotto il loro mese', async () => {
    await salvaRicontatto({ nome: 'Rocco Paolino', data: FRA_UN_ANNO, note: 'scade il contratto Sky' });
    await pagina.waitForSelector('.voce:has-text("Rocco Paolino")');
    const gruppo = pagina.locator('.gruppo-ricontatti', { has: pagina.locator('.voce:has-text("Rocco Paolino")') });
    const titolo = await gruppo.locator('h2').innerText();
    assert(titolo.includes(FRA_UN_ANNO.slice(0, 4)), `gruppo: ${titolo}`);
    assert(contiene(await pagina.locator('.voce:has-text("Rocco Paolino")').innerText(), 'scade il contratto'),
      'la nota non si vede');
  });

  await prova('il numero si chiama con un tocco', async () => {
    const href = await pagina.locator('.voce:has-text("Mario Greco") .numero').getAttribute('href');
    assert(href?.startsWith('tel:+39'), `link: ${href}`);
  });

  await prova('un numero sbagliato viene segnalato e il modulo resta aperto', async () => {
    await salvaRicontatto({ nome: 'Numero Sbagliato', telefono: '12', data: OGGI });
    await pagina.waitForSelector('dialog [data-campo="telefonoCliente"][data-errore]');
    assert(await pagina.locator('dialog.pannello[open]').isVisible(), 'il modulo si è chiuso');
    await pagina.click('dialog button:has-text("Annulla")');
    await pagina.waitForSelector('dialog.pannello', { state: 'detached' });
    assert((await pagina.locator('.voce:has-text("Numero Sbagliato")').count()) === 0, 'salvato lo stesso');
  });

  await prova('«Fatto» lo sposta fra i fatti, «Riapri» lo riporta', async () => {
    await pagina.click('.voce:has-text("Mario Greco") button:has-text("Fatto")');
    await pagina.waitForSelector('.gruppo-ricontatti.fatti .voce:has-text("Mario Greco")');
    await pagina.click('.voce:has-text("Mario Greco") button:has-text("Riapri")');
    await pagina.waitForSelector('.gruppo-ricontatti:not(.fatti) .voce:has-text("Mario Greco")');
  });

  await prova('cliccando la riga si modifica', async () => {
    await pagina.click('.voce:has-text("Anna Folino") .apri');
    await pagina.waitForSelector('dialog.pannello[open]');
    assert((await pagina.inputValue('dialog input[name="nomeCliente"]')) === 'Anna Folino', 'valori non caricati');
    assert((await pagina.inputValue('dialog select[name="ora"]')) === '16:30', 'ora non caricata');
    await pagina.fill('dialog textarea[name="note"]', 'preferisce il pomeriggio');
    await pagina.click('dialog button:has-text("Salva modifiche")');
    await pagina.waitForSelector('dialog.pannello', { state: 'detached' });
    await pagina.waitForSelector('.voce:has-text("preferisce il pomeriggio")');
  });

  await prova('«Elimina» lo toglie di mezzo', async () => {
    await pagina.click('.voce:has-text("Anna Folino") .apri');
    await pagina.waitForSelector('dialog.pannello[open]');
    await pagina.click('dialog button:has-text("Elimina")');
    await pagina.waitForSelector('dialog.pannello', { state: 'detached' });
    await pagina.waitForSelector('.voce:has-text("Anna Folino")', { state: 'detached' });
  });

  await prova('i ricontatti non finiscono nell\'agenda dei tecnici', async () => {
    await pagina.click('.scelta-vista button:has-text("Giorno")');
    await attendiCaricamento(pagina);
    await pagina.waitForSelector('.agenda .persona');
    const testo = await pagina.locator('.agenda').innerText();
    assert(!contiene(testo, 'Mario Greco'), 'un ricontatto è comparso in agenda');
    assert((await pagina.locator('.agenda .intestazione .persona').count()) === 2, 'colonne cambiate');
  });

  if (SCATTI) await pagina.goto(`${BASE}?vista=ricontatti`, { waitUntil: 'networkidle' });
  if (SCATTI) await pagina.screenshot({ path: `${SCATTI}/ricontatti.png`, fullPage: true });
  await ctx.close();
}

// --- gli scaduti si fanno notare ---------------------------------------------
{
  const db = nuovoDb({ ricontatti: [
    { nome: 'Caterina Nicotera', data: giorniDa(OGGI, -3), ora: '10:00' },
    { nome: 'Già Chiamato', data: giorniDa(OGGI, -1), fatto: true },
  ] });
  const ctx = await browser.newContext(PC);
  const pagina = await ctx.newPage();
  await collega(pagina, db);
  await entra(pagina, 'tiziana');
  await pagina.goto(`${BASE}?vista=ricontatti`, { waitUntil: 'networkidle' });
  await pagina.waitForSelector('.ricontatti');

  await prova('un ricontatto con la data passata sta fra gli «Scaduti»', async () => {
    assert(await pagina.locator('.gruppo-ricontatti.scaduti .voce:has-text("Caterina Nicotera")').isVisible(),
      'non è fra gli scaduti');
  });

  await prova('uno già fatto, anche se passato, non è uno scaduto', async () => {
    assert((await pagina.locator('.gruppo-ricontatti.scaduti .voce:has-text("Già Chiamato")').count()) === 0,
      'un fatto conta come scaduto');
    assert(await pagina.locator('.gruppo-ricontatti.fatti .voce:has-text("Già Chiamato")').isVisible(),
      'non è fra i fatti');
  });

  if (SCATTI) await pagina.screenshot({ path: `${SCATTI}/ricontatti-scaduti.png`, fullPage: true });
  await ctx.close();
}

// =============================================================== TECNICI
console.log('\nMICHELE · TELEFONO\n');
{
  const db = nuovoDb({ ricontatti: [{ nome: 'Mario Greco', data: OGGI }] });
  const ctx = await browser.newContext(TELEFONO);
  const pagina = await ctx.newPage();
  await collega(pagina, db);
  await entra(pagina, 'michele');

  await prova('Michele vede i suoi interventi', async () => {
    assert(contiene(await pagina.locator('.app-installatore').innerText(), 'Maria Perri'), 'manca il suo lavoro');
  });

  await prova('sul telefono non c\'è nessuna scheda Ricontatti', async () => {
    assert(!contiene(await pagina.locator('.app-installatore').innerText(), 'ricontatt'), 'compare');
  });

  await prova('scrivendosi l\'indirizzo a mano viene rimandato alla sua giornata', async () => {
    const prima = db.chiamateRicontatti ?? 0;
    await pagina.goto(`${BASE}?vista=ricontatti`, { waitUntil: 'networkidle' });
    await pagina.waitForSelector('.app-installatore');
    const vista = await pagina.evaluate(() => new URLSearchParams(location.search).get('vista'));
    assert(vista === 'giorno', `è rimasto su: ${vista}`);
    assert((db.chiamateRicontatti ?? 0) === prima, 'il pannello ha chiesto i ricontatti per conto del tecnico');
  });

  await prova('nella scheda «Tutti» il ricontatto di Tiziana non c\'è', async () => {
    await pagina.goto(`${BASE}?vista=tutti&giorno=${OGGI}`, { waitUntil: 'networkidle' });
    await pagina.waitForSelector('.giorno-gruppo');
    assert(!contiene(await pagina.locator('.app-installatore').innerText(), 'Mario Greco'), 'compare');
  });

  await ctx.close();
}

// =============================================================== STORICO
console.log('\nSTORICO\n');
{
  const db = nuovoDb();
  const ctx = await browser.newContext(PC);
  const pagina = await ctx.newPage();
  await collega(pagina, db);
  await entra(pagina, 'tiziana');

  await prova('lo storico si apre ancora', async () => {
    await pagina.click('.scelta-vista button:has-text("Storico")');
    await attendiCaricamento(pagina);
    assert(await pagina.locator('.riepilogo-storico').isVisible(), 'manca il riepilogo');
  });

  await ctx.close();
}

await browser.close();
server.close();
const falliti = esiti.filter((x) => x === 0).length;
console.log(`\n${esiti.length - falliti}/${esiti.length} prove superate\n`);
process.exit(falliti === 0 ? 0 : 1);
