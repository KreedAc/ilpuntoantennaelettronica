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
        diretta: { dalle: '09:00', alle: '20:00', giorni: [] }, whatsapp: db.whatsapp ?? false });
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
    if (p === '/appuntamenti' && metodo === 'POST') {
      db.ultimoNuovo = corpo;
      const nuovo = {
        id: db.prossimo++, tipo: 'intervento', nomeCliente: corpo.nomeCliente, luogoImpianto: corpo.luogoImpianto,
        telefonoCliente: corpo.telefonoCliente, telefonoPerChiamata: '+39', mappa: '', prezzoCentesimi: 0,
        prezzoConcordato: '0,00', data: corpo.data, ora: corpo.ora || null, note: '', urgente: false, stato: 'attivo',
        fatto: false, fattoAlle: null, assegnatoA: admin ? (Number(corpo.assegnatoA) || null) : db.utente.id,
      };
      nuovo.assegnatoNome = UTENTI.find((u) => u.id === nuovo.assegnatoA)?.nome ?? null;
      db.righe.push(nuovo);
      // Come l'API vera: la conferma la chiede solo Tiziana, con la casella.
      const whatsapp = admin && corpo.confermaWhatsapp === true ? (db.esitoWhatsapp ?? { inviata: true }) : null;
      return j({ appuntamento: nuovo, whatsapp }, 201);
    }
    const unoSolo = /^\/appuntamenti\/(\d+)$/.exec(p);
    if (unoSolo && metodo === 'GET') {
      const x = interventi().find((r) => r.id === Number(unoSolo[1]));
      return x ? j({ appuntamento: x }) : j({ errore: 'Appuntamento non trovato' }, 404);
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
      const m = /^\/ricontatti\/(\d+)(?:\/(sposta))?$/.exec(p);
      const r = m && suoiRicontatti().find((x) => x.id === Number(m[1]));
      if (!r) return j({ errore: 'Ricontatto non trovato' }, 404);
      if (!m[2] && metodo === 'PATCH') {
        const campi = valida();
        if (Object.keys(campi).length) return j({ errore: 'Controlla i campi segnalati', campi }, 400);
        Object.assign(r, { nomeCliente: corpo.nomeCliente, telefonoCliente: corpo.telefonoCliente,
          data: corpo.data, ora: corpo.ora || null, note: corpo.note ?? '' });
        return j({ ricontatto: r });
      }
      if (m[2] === 'sposta' && metodo === 'POST') {
        if (!corpo.data || corpo.data < OGGI) return j({ errore: 'Controlla la data', campi: { data: 'Scegli oggi o un giorno successivo' } }, 400);
        r.data = corpo.data;
        return j({ ricontatto: r });
      }
      if (!m[2] && metodo === 'DELETE') {
        // Come l'API vera: si cancella davvero, non si segna come annullato.
        db.righe.splice(db.righe.indexOf(r), 1);
        return j({ eliminato: true, id: r.id });
      }
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

// Le stesse regole del pannello, scritte qui per conto loro: se il pannello
// sbagliasse un conto, la prova non lo ripeterebbe uguale.
const piuMesiData = (iso, n) => {
  const [a, m, g] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(g, ultimo));
  return d.toISOString().slice(0, 10);
};
const apertura = (iso) => { const g = isoGiorno(iso); return g >= 6 ? giorniDa(iso, 8 - g) : iso; };

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
  const riga = (nome) => pagina.locator(`.voce-ricontatto:has-text("${nome}")`);
  const apriMenu = async (nome) => {
    await riga(nome).locator('.chiamato').click();
    await pagina.waitForSelector('.menu-chiamato');
  };

  await prova('vuota, spiega a cosa serve e mostra il calendario', async () => {
    assert(contiene(await pagina.locator('.elenco-ricontatti .vuoto').innerText(), 'chi richiamare'), 'manca la spiegazione');
    assert(await pagina.locator('.mini-calendario').isVisible(), 'manca il calendario');
    assert(await pagina.locator('.griglia-mese .g.oggi').count() === 1, 'oggi non è segnato');
  });

  await prova('un ricontatto senza ora va sotto oggi, «in giornata»', async () => {
    await salvaRicontatto({ nome: 'Mario Greco', data: OGGI });
    await pagina.waitForSelector(`#ricontatti-${OGGI} .voce-ricontatto:has-text("Mario Greco")`);
    assert(contiene(await riga('Mario Greco').innerText(), 'in giornata'), 'non dice «in giornata»');
    assert(contiene(await pagina.locator(`#ricontatti-${OGGI} .testa-giorno`).innerText(), 'oggi'), 'manca «Oggi»');
  });

  await prova('con l\'ora, l\'ora si vede', async () => {
    await salvaRicontatto({ nome: 'Anna Folino', data: OGGI, ora: '16:30', note: 'scade Sky a novembre' });
    await pagina.waitForSelector('.voce-ricontatto:has-text("Anna Folino")');
    assert(contiene(await riga('Anna Folino').innerText(), '16:30'), 'ora mancante');
    assert(contiene(await riga('Anna Folino').innerText(), 'scade Sky'), 'nota mancante');
  });

  await prova('quelli fra un anno stanno sotto l\'intestazione del loro mese', async () => {
    await salvaRicontatto({ nome: 'Rocco Paolino', data: FRA_UN_ANNO });
    await pagina.waitForSelector(`#ricontatti-${FRA_UN_ANNO}`);
    const mesi = await pagina.locator('.mese-ricontatti').allInnerTexts();
    assert(mesi.some((m) => m.includes(FRA_UN_ANNO.slice(0, 4))), `intestazioni: ${mesi.join(', ')}`);
  });

  await prova('il numero si chiama con un tocco', async () => {
    const href = await riga('Mario Greco').locator('.numero').getAttribute('href');
    assert(href?.startsWith('tel:+39'), `link: ${href}`);
  });

  await prova('non c\'è più nessun pulsante «Fatto»', async () => {
    assert((await pagina.locator('.elenco-ricontatti button:has-text("Fatto")').count()) === 0, 'c\'è ancora');
  });

  await prova('un numero sbagliato viene segnalato e il modulo resta aperto', async () => {
    await salvaRicontatto({ nome: 'Numero Sbagliato', telefono: '12', data: OGGI });
    await pagina.waitForSelector('dialog [data-campo="telefonoCliente"][data-errore]');
    await pagina.click('dialog button:has-text("Annulla")');
    await pagina.waitForSelector('dialog.pannello', { state: 'detached' });
    assert((await riga('Numero Sbagliato').count()) === 0, 'salvato lo stesso');
  });

  await prova('«Chiamato» offre i due esiti: richiamare più avanti o eliminare', async () => {
    await apriMenu('Mario Greco');
    const testo = await pagina.locator('.menu-chiamato').innerText();
    for (const voce of ['Richiama più avanti', 'Domani', 'Fra una settimana', 'Fra un mese', 'Fra 6 mesi', 'Fra un anno', 'Elimina']) {
      assert(contiene(testo, voce), `manca «${voce}»`);
    }
    await pagina.keyboard.press('Escape');
    await pagina.waitForSelector('.menu-chiamato', { state: 'detached' });
  });

  await prova('nessuna scelta rapida finisce di sabato o di domenica', async () => {
    await apriMenu('Mario Greco');
    const date = await pagina.locator('.menu-chiamato .scelta').evaluateAll((b) => b.map((x) => x.dataset.data));
    for (const d of date) assert(isoGiorno(d) <= 5, `${d} cade nel fine settimana`);
    assert(date[2] === apertura(piuMesiData(OGGI, 1)), `«fra un mese» = ${date[2]}`);
    assert(date[4] === apertura(piuMesiData(OGGI, 12)), `«fra un anno» = ${date[4]}`);
    await pagina.keyboard.press('Escape');
  });

  await prova('«Fra un mese» sposta il ricontatto e dice dove è finito', async () => {
    const atteso = apertura(piuMesiData(OGGI, 1));
    await apriMenu('Mario Greco');
    await pagina.click('.menu-chiamato .scelta:has-text("Fra un mese")');
    await pagina.waitForSelector(`#ricontatti-${atteso} .voce-ricontatto:has-text("Mario Greco")`);
    assert((await pagina.locator(`#ricontatti-${OGGI} .voce-ricontatto:has-text("Mario Greco")`).count()) === 0,
      'è rimasto anche oggi');
    const avviso = await pagina.locator('.avviso.esito').innerText();
    assert(contiene(avviso, 'Mario Greco') && contiene(avviso, 'si richiama'), avviso);
    assert(db.righe.find((r) => r.nomeCliente === 'Mario Greco').data === atteso, 'non salvato');
  });

  await prova('con una data a scelta si sposta dove si vuole', async () => {
    const giorno = giorniDa(OGGI, 40);
    await apriMenu('Anna Folino');
    await pagina.fill('.menu-chiamato input[type="date"]', giorno);
    await pagina.click('.menu-chiamato button:has-text("Sposta")');
    await pagina.waitForSelector(`#ricontatti-${giorno} .voce-ricontatto:has-text("Anna Folino")`);
  });

  await prova('«Elimina» chiede conferma: «No» lo lascia dov\'è', async () => {
    await apriMenu('Rocco Paolino');
    await pagina.click('.menu-chiamato .elimina');
    await pagina.waitForSelector('dialog.conferma[open]');
    assert(contiene(await pagina.locator('dialog.conferma').innerText(), 'Rocco Paolino'), 'non dice chi');
    await pagina.click('dialog.conferma button:has-text("No")');
    await pagina.waitForSelector('dialog.conferma', { state: 'detached' });
    assert(await riga('Rocco Paolino').isVisible(), 'è sparito lo stesso');
  });

  await prova('confermando si cancella davvero', async () => {
    await apriMenu('Rocco Paolino');
    await pagina.click('.menu-chiamato .elimina');
    await pagina.click('dialog.conferma button.pericolo-pieno');
    await pagina.waitForSelector('.voce-ricontatto:has-text("Rocco Paolino")', { state: 'detached' });
    assert(!db.righe.some((r) => r.nomeCliente === 'Rocco Paolino'), 'la riga è rimasta nel database');
  });

  await prova('cliccando il nome si modifica, e da lì si può eliminare', async () => {
    await riga('Anna Folino').locator('.apri').click();
    await pagina.waitForSelector('dialog.pannello[open]');
    assert((await pagina.inputValue('dialog select[name="ora"]')) === '16:30', 'ora non caricata');
    await pagina.fill('dialog textarea[name="note"]', 'preferisce il pomeriggio');
    await pagina.click('dialog button:has-text("Salva modifiche")');
    await pagina.waitForSelector('.voce-ricontatto:has-text("preferisce il pomeriggio")');
  });

  await prova('il calendario segna i giorni con qualcuno da richiamare', async () => {
    const giorno = apertura(piuMesiData(OGGI, 1));
    // Il ricontatto di Mario Greco è finito il mese prossimo: si va avanti di uno.
    await pagina.click('.mini-calendario [aria-label="Mese successivo"]');
    const titolo = await pagina.locator('.mini-calendario .testa-mese strong').innerText();
    assert(titolo.includes(giorno.slice(0, 4)), `mese: ${titolo}`);
    const segnato = pagina.locator(`.griglia-mese .g.pieno[aria-label*="${Number(giorno.slice(8))} "]`);
    assert(await segnato.count() >= 1, 'il giorno non ha il puntino');
  });

  await prova('toccando quel giorno l\'elenco ci arriva', async () => {
    const giorno = apertura(piuMesiData(OGGI, 1));
    await pagina.locator(`.griglia-mese .g.pieno[aria-label*="${Number(giorno.slice(8))} "]`).first().click();
    await pagina.waitForSelector(`#ricontatti-${giorno}.evidenziato`);
  });

  await prova('toccando un giorno vuoto si crea un ricontatto per quel giorno', async () => {
    const vuoto = await pagina.locator('.griglia-mese .g:not(.pieno):not(.fuori):not(.oggi)').last();
    await vuoto.click();
    await pagina.waitForSelector('dialog.pannello[open]');
    const data = await pagina.inputValue('dialog input[name="data"]');
    assert(data > OGGI, `data proposta: ${data}`);
    await pagina.click('dialog button:has-text("Annulla")');
  });

  await prova('il riepilogo conta giusto', async () => {
    const testo = await pagina.locator('.riepilogo-ricontatti').innerText();
    assert(/In programma in tutto\s*2/i.test(testo), testo.replace(/\n/g, ' | '));
  });

  await prova('i ricontatti non finiscono nell\'agenda dei tecnici', async () => {
    await pagina.click('.scelta-vista button:has-text("Giorno")');
    await attendiCaricamento(pagina);
    await pagina.waitForSelector('.agenda .persona');
    const testo = await pagina.locator('.agenda').innerText();
    assert(!contiene(testo, 'Mario Greco') && !contiene(testo, 'Anna Folino'), 'un ricontatto è in agenda');
    assert((await pagina.locator('.agenda .intestazione .persona').count()) === 2, 'colonne cambiate');
  });

  await ctx.close();
}

// --- gli scaduti si fanno notare ---------------------------------------------
{
  const db = nuovoDb({ ricontatti: [
    { nome: 'Caterina Nicotera', data: giorniDa(OGGI, -3), ora: '10:00', note: 'aspettava il preventivo' },
    { nome: 'Gino Mastroianni', data: OGGI },
    { nome: 'Bar Centrale', data: giorniDa(OGGI, 3), ora: '11:00' },
  ] });
  const ctx = await browser.newContext(PC);
  const pagina = await ctx.newPage();
  await collega(pagina, db);
  await entra(pagina, 'tiziana');
  await pagina.goto(`${BASE}?vista=ricontatti`, { waitUntil: 'networkidle' });
  await pagina.waitForSelector('.ricontatti');

  await prova('un ricontatto con la data passata sta fra gli «Scaduti», con il giorno', async () => {
    const voce = pagina.locator('.blocco-scaduti .voce-ricontatto:has-text("Caterina Nicotera")');
    assert(await voce.isVisible(), 'non è fra gli scaduti');
    assert((await voce.locator('.quando .giorno').count()) === 1, 'manca il giorno');
  });

  await prova('il riepilogo li conta, e il calendario li segna diversi', async () => {
    const testo = await pagina.locator('.riepilogo-ricontatti').innerText();
    assert(/Scaduti\s*1/i.test(testo) && /Oggi\s*1/i.test(testo), testo.replace(/\n/g, ' | '));
    if (giorniDa(OGGI, -3).slice(0, 7) === OGGI.slice(0, 7)) {
      assert(await pagina.locator('.griglia-mese .g.scaduto').count() === 1, 'il giorno scaduto non è segnato');
    }
  });

  await prova('«fra 3 giorni» accanto ai giorni vicini', async () => {
    assert(contiene(await pagina.locator(`#ricontatti-${giorniDa(OGGI, 3)} .testa-giorno`).innerText(), 'fra 3 giorni'),
      'manca quanto manca');
  });

  if (SCATTI) await pagina.screenshot({ path: `${SCATTI}/ricontatti.png`, fullPage: true });
  if (SCATTI) {
    await pagina.locator('.voce-ricontatto:has-text("Gino Mastroianni") .chiamato').click();
    await pagina.waitForSelector('.menu-chiamato');
    await pagina.screenshot({ path: `${SCATTI}/ricontatti-menu.png` });
  }
  await ctx.close();
}

// --- sul telefono -------------------------------------------------------------
{
  const db = nuovoDb({ ricontatti: [{ nome: 'Gino Mastroianni', data: OGGI, note: 'richiamare per la parabola' }] });
  const ctx = await browser.newContext(TELEFONO);
  const pagina = await ctx.newPage();
  await collega(pagina, db);
  await entra(pagina, 'tiziana');
  await pagina.goto(`${BASE}?vista=ricontatti`, { waitUntil: 'networkidle' });
  await pagina.waitForSelector('.ricontatti');

  await prova('sul telefono di Tiziana niente scorre di lato', async () => {
    const largo = await pagina.evaluate(() => document.documentElement.scrollWidth);
    assert(largo <= 390, `la pagina è larga ${largo}px`);
  });

  if (SCATTI) await pagina.screenshot({ path: `${SCATTI}/ricontatti-telefono.png`, fullPage: true });
  await ctx.close();
}

// =============================================================== WHATSAPP
console.log('\nCONFERMA SU WHATSAPP\n');

async function nuovoAppuntamento(pagina, { telefono = '333 1234567', spunta = null, ora = '17:00' } = {}) {
  await pagina.click('button:has-text("Nuovo appuntamento")');
  await pagina.waitForSelector('dialog.pannello[open]');
  await pagina.fill('dialog input[name="nomeCliente"]', 'Mario Greco');
  await pagina.fill('dialog input[name="luogoImpianto"]', 'Via Roma 1');
  await pagina.fill('dialog input[name="telefonoCliente"]', telefono);
  if (ora !== null) await pagina.selectOption('dialog select[name="ora"]', ora);
  if (spunta !== null) await pagina.setChecked('dialog input[name="confermaWhatsapp"]', spunta);
}
const salvaNuovo = async (pagina) => {
  await pagina.click('dialog button:has-text("Salva appuntamento")');
  await pagina.waitForSelector('dialog.pannello', { state: 'detached' });
};

{
  const db = nuovoDb();
  db.whatsapp = true;
  const ctx = await browser.newContext(PC);
  const pagina = await ctx.newPage();
  await collega(pagina, db);
  await entra(pagina, 'tiziana');
  await pagina.goto(`${BASE}?vista=giorno&giorno=${OGGI}`, { waitUntil: 'networkidle' });
  await pagina.waitForSelector('.agenda .persona');

  await prova('nel modulo nuovo c\'è la casella, già spuntata', async () => {
    await nuovoAppuntamento(pagina);
    const casella = pagina.locator('dialog input[name="confermaWhatsapp"]');
    assert(await casella.isVisible(), 'la casella non c\'è');
    assert(await casella.isChecked(), 'non è spuntata');
    assert(contiene(await pagina.locator('dialog .scelta.whatsapp').innerText(), 'giorno, ora e indirizzo'), 'manca la spiegazione');
  });

  await prova('con un numero fisso avvisa che su WhatsApp non arriverà', async () => {
    await pagina.fill('dialog input[name="telefonoCliente"]', '0968 21345');
    assert(contiene(await pagina.locator('dialog .scelta.whatsapp .nota').innerText(), 'non è un cellulare'), 'nessun avviso');
    await pagina.fill('dialog input[name="telefonoCliente"]', '333 1234567');
    assert(!contiene(await pagina.locator('dialog .scelta.whatsapp .nota').innerText(), 'non è un cellulare'), 'l\'avviso è rimasto');
  });

  await prova('salvando con la spunta parte la conferma, e lo dice', async () => {
    await salvaNuovo(pagina);
    assert(db.ultimoNuovo.confermaWhatsapp === true, 'non ha chiesto la conferma');
    const avviso = await pagina.locator('.avviso.esito').innerText();
    assert(contiene(avviso, 'Conferma WhatsApp inviata a Mario Greco'), avviso);
  });

  await prova('togliendo la spunta non parte niente', async () => {
    await nuovoAppuntamento(pagina, { spunta: false });
    await salvaNuovo(pagina);
    assert(db.ultimoNuovo.confermaWhatsapp === false, 'ha chiesto la conferma lo stesso');
  });

  await prova('se WhatsApp rifiuta, l\'appuntamento resta e Tiziana sa perché', async () => {
    db.esitoWhatsapp = { inviata: false, motivo: 'il modello del messaggio non esiste o non è ancora approvato' };
    await nuovoAppuntamento(pagina);
    await salvaNuovo(pagina);
    const avviso = await pagina.locator('.avviso[role="alert"]').last().innerText();
    assert(contiene(avviso, 'Appuntamento salvato') && contiene(avviso, 'non è partita') && contiene(avviso, 'modello'), avviso);
    assert(db.righe.filter((r) => r.nomeCliente === 'Mario Greco').length === 3, 'un appuntamento non è stato salvato');
  });

  await prova('modificando un appuntamento la casella non c\'è', async () => {
    await pagina.click('.blocco:has-text("Maria Perri")');
    await pagina.waitForSelector('dialog.pannello[open]');
    await pagina.click('dialog button:has-text("Modifica scheda")');
    await pagina.waitForSelector('dialog input[name="nomeCliente"]');
    assert((await pagina.locator('dialog input[name="confermaWhatsapp"]').count()) === 0, 'compare anche in modifica');
  });

  await ctx.close();
}

{
  const db = nuovoDb();          // WhatsApp non configurato
  const ctx = await browser.newContext(PC);
  const pagina = await ctx.newPage();
  await collega(pagina, db);
  await entra(pagina, 'tiziana');
  await pagina.goto(`${BASE}?vista=giorno&giorno=${OGGI}`, { waitUntil: 'networkidle' });
  await pagina.waitForSelector('.agenda .persona');

  await prova('finché WhatsApp non è configurato la casella non compare', async () => {
    await nuovoAppuntamento(pagina);
    assert((await pagina.locator('dialog input[name="confermaWhatsapp"]').count()) === 0, 'compare');
  });

  await ctx.close();
}

{
  const db = nuovoDb();
  db.whatsapp = true;
  const ctx = await browser.newContext(TELEFONO);
  const pagina = await ctx.newPage();
  await collega(pagina, db);
  await entra(pagina, 'michele');

  await prova('quando un tecnico si carica un lavoro, niente conferma', async () => {
    await pagina.click('button:has-text("Aggiungi un intervento mio")');
    await pagina.waitForSelector('dialog.pannello[open]');
    assert((await pagina.locator('dialog input[name="confermaWhatsapp"]').count()) === 0, 'la casella c\'è anche per il tecnico');
  });

  await ctx.close();
}

// =============================================================== SENZA ORARIO
console.log('\nINTERVENTI CON L\'ORARIO DA CONCORDARE\n');
{
  const db = nuovoDb();
  db.whatsapp = true;
  const ctx = await browser.newContext(PC);
  const pagina = await ctx.newPage();
  await collega(pagina, db);
  await entra(pagina, 'tiziana');
  await pagina.goto(`${BASE}?vista=giorno&giorno=${OGGI}`, { waitUntil: 'networkidle' });
  await pagina.waitForSelector('.agenda .persona');

  await prova('nel modulo nuovo l\'ora parte da «Da concordare», e non è obbligatoria', async () => {
    await nuovoAppuntamento(pagina, { ora: null });
    const ora = pagina.locator('dialog select[name="ora"]');
    assert((await ora.inputValue()) === '', `valore: ${await ora.inputValue()}`);
    assert(contiene(await ora.locator('option:checked').innerText(), 'Da concordare'), 'manca la voce');
    assert(!(await ora.evaluate((s) => s.required)), 'è ancora obbligatoria');
  });

  await prova('la nota di WhatsApp dice che partirà solo il giorno', async () => {
    const nota = () => pagina.locator('dialog .scelta.whatsapp .nota').innerText();
    assert(contiene(await nota(), 'solo il giorno'), await nota());
    await pagina.selectOption('dialog select[name="ora"]', '10:30');
    assert(contiene(await nota(), 'giorno, ora e indirizzo'), await nota());
    await pagina.selectOption('dialog select[name="ora"]', '');
    assert(contiene(await nota(), 'solo il giorno'), await nota());
  });

  await prova('salvato senza ora, finisce nella riga «Da concordare» di Michele', async () => {
    await pagina.selectOption('dialog select[name="assegnatoA"]', '2');
    await salvaNuovo(pagina);
    assert(db.ultimoNuovo.ora === '', `ora mandata: ${JSON.stringify(db.ultimoNuovo.ora)}`);
    await pagina.waitForSelector('.riga-da-concordare .gettone');
    const celle = await pagina.locator('.riga-da-concordare .cella').allInnerTexts();
    const persone = await pagina.locator('.agenda .intestazione .persona .nome').allInnerTexts();
    const diMichele = celle[persone.indexOf('Michele')];
    assert(contiene(diMichele ?? '', 'Mario Greco'), `celle: ${JSON.stringify(celle)}, persone: ${persone}`);
    assert(contiene(await pagina.locator('.avviso.esito').innerText(), 'Conferma WhatsApp inviata'), 'nessun esito');
  });

  if (SCATTI) await pagina.screenshot({ path: `${SCATTI}/da-concordare-giorno.png` });

  await prova('in tutta l\'agenda non compare mai «null»', async () => {
    assert(!/\bnull\b/.test(await pagina.locator('.agenda').innerText()), 'c\'è un null in pagina');
  });

  await prova('la scheda dice «orario da concordare» e offre «Fissa l\'orario»', async () => {
    await pagina.click('.riga-da-concordare .gettone:has-text("Mario Greco")');
    await pagina.waitForSelector('dialog.pannello[open]');
    const testo = await pagina.locator('dialog').innerText();
    assert(contiene(testo, 'orario da concordare'), testo.slice(0, 200));
    assert(contiene(testo, 'Fissa l\'orario'), 'manca il titolo');
    assert((await pagina.locator('#modulo-rimanda select[name="ora"]').inputValue()) === '', 'l\'ora non parte vuota');
    await pagina.keyboard.press('Escape');
    await pagina.waitForSelector('dialog.pannello', { state: 'detached' });
  });

  await prova('anche nella Settimana, sotto il giorno giusto', async () => {
    await pagina.click('.scelta-vista button:has-text("Settimana")');
    await pagina.waitForSelector('.agenda .intestazione .sigla');
    const celle = await pagina.locator('.riga-da-concordare .cella').allInnerTexts();
    const indice = isoGiorno(OGGI) - 1;
    if (SCATTI) await pagina.screenshot({ path: `${SCATTI}/da-concordare-settimana.png` });
    if (indice > 5) return; // domenica: la settimana mostrata non contiene oggi
    assert(contiene(celle[indice] ?? '', 'Mario Greco'), JSON.stringify(celle));
  });

  await prova('senza nessuno da concordare la riga non c\'è', async () => {
    db.righe = db.righe.filter((r) => r.ora !== null);
    await pagina.goto(`${BASE}?vista=giorno&giorno=${OGGI}`, { waitUntil: 'networkidle' });
    await pagina.waitForSelector('.agenda .persona');
    assert((await pagina.locator('.riga-da-concordare').count()) === 0, 'la riga è rimasta');
  });

  await ctx.close();
}

{
  const db = nuovoDb();
  db.righe.push({ ...db.righe[0], id: 9, nomeCliente: 'Pino Gigliotti', ora: null });
  const ctx = await browser.newContext(TELEFONO);
  const pagina = await ctx.newPage();
  await collega(pagina, db);
  await entra(pagina, 'michele');

  await prova('sul telefono di Michele: «Da concordare» al posto dell\'ora', async () => {
    const voce = pagina.locator('.voce:has-text("Pino Gigliotti") .quando');
    assert(contiene(await voce.innerText(), 'Da concordare'), await voce.innerText());
    assert(!/\bnull\b/.test(await pagina.locator('.app-installatore').innerText()), 'c\'è un null');
  });

  if (SCATTI) await pagina.screenshot({ path: `${SCATTI}/da-concordare-telefono.png`, fullPage: true });

  await prova('il dettaglio dice «orario da concordare» e il bottone è «Fissa l\'orario»', async () => {
    await pagina.click('.voce:has-text("Pino Gigliotti") a');
    await pagina.waitForSelector('button:has-text("Fissa l’orario")');
    assert(contiene(await pagina.locator('body').innerText(), 'orario da concordare'), 'manca');
  });

  await prova('sul telefono la pagina non scappa di lato', async () => {
    const largo = await pagina.evaluate(() => document.documentElement.scrollWidth);
    assert(largo <= 390, `larga ${largo}px`);
  });

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
