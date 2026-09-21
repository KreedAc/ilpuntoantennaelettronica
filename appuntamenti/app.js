/* Pannello appuntamenti — interfaccia.
 *
 * Nessuna libreria: la pagina si costruisce con `document.createElement`.
 * Tutto il testo che arriva dal database entra nel documento come
 * `textContent`, mai come HTML: un nome cliente scritto con dentro dei tag
 * resta testo e non può eseguire nulla.
 *
 * Lo stato della vista (settimana o giorno mostrato) sta nell'indirizzo, così
 * il ricaricamento e il tasto "indietro" del browser funzionano come ci si
 * aspetta.
 */

// ---------------------------------------------------------------------------
// Costruzione degli elementi
// ---------------------------------------------------------------------------

function el(tag, attributi = {}, ...figli) {
  const nodo = document.createElement(tag);
  for (const [chiave, valore] of Object.entries(attributi)) {
    if (valore === null || valore === undefined || valore === false) continue;
    if (chiave === 'class') nodo.className = valore;
    else if (chiave === 'testo') nodo.textContent = valore;
    else if (chiave === 'icona') nodo.insertAdjacentHTML('afterbegin', ICONE[valore]);
    else if (chiave.startsWith('on')) nodo.addEventListener(chiave.slice(2), valore);
    else nodo.setAttribute(chiave, valore === true ? '' : valore);
  }
  for (const figlio of figli.flat(Infinity)) {
    if (figlio === null || figlio === undefined || figlio === false) continue;
    nodo.append(figlio?.nodeType ? figlio : document.createTextNode(String(figlio)));
  }
  return nodo;
}

/* Icone lineari. Sono stringhe scritte qui dentro, non contenuti esterni:
   l'unico punto del file in cui usiamo insertAdjacentHTML. */
const ICONE = {
  sinistra: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  destra:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
  piu:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  chiudi:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  telefono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .3 1.9.6 2.8a2 2 0 01-.5 2.1L8.1 9.7a16 16 0 006 6l1.1-1.1a2 2 0 012.1-.5c.9.3 1.8.5 2.8.6a2 2 0 011.9 2.1z"/></svg>',
  posizione:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  campana:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>',
  chiave:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
};

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------
// Stesse regole del server (netlify/lib/calendario.mjs): i conti si fanno in
// UTC su stringhe "YYYY-MM-DD", così l'ora legale non sposta mai un giorno.
// Le due copie esistono perché il browser non può importare i moduli della
// funzione serverless; sono poche righe di sola aritmetica, senza stato.

const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const SIGLE = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
              'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const FORMATO_ISO = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
});

const oggi = () => FORMATO_ISO.format(new Date());

function aUTC(iso) {
  const [a, m, g] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, g));
}

function piuGiorni(iso, giorni) {
  const d = aUTC(iso);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

function giornoSettimana(iso) {
  const g = aUTC(iso).getUTCDay();
  return g === 0 ? 7 : g;
}

const lunedi = (iso) => piuGiorni(iso, -(giornoSettimana(iso) - 1));

function dataEstesa(iso, { conAnno = true } = {}) {
  const d = aUTC(iso);
  const t = `${GIORNI[giornoSettimana(iso) - 1]} ${d.getUTCDate()} ${MESI[d.getUTCMonth()]}`;
  return conAnno ? `${t} ${d.getUTCFullYear()}` : t;
}

function intervalloSettimana(inizio) {
  const a = aUTC(inizio);
  const b = aUTC(piuGiorni(inizio, 5));
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${a.getUTCDate()} – ${b.getUTCDate()} ${MESI[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  }
  if (a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${a.getUTCDate()} ${MESI[a.getUTCMonth()]} – ${b.getUTCDate()} ${MESI[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  }
  return `${a.getUTCDate()} ${MESI[a.getUTCMonth()]} ${a.getUTCFullYear()} – ${b.getUTCDate()} ${MESI[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
}

const maiuscola = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Rete
// ---------------------------------------------------------------------------

async function api(percorso, { metodo = 'GET', corpo } = {}) {
  const opzioni = { method: metodo, credentials: 'same-origin', headers: {} };
  if (corpo !== undefined) {
    opzioni.headers['Content-Type'] = 'application/json';
    opzioni.body = JSON.stringify(corpo);
  }

  let risposta;
  try {
    risposta = await fetch(`/api${percorso}`, opzioni);
  } catch {
    throw Object.assign(new Error('Connessione assente. Controlla la rete e riprova.'), { rete: true });
  }

  let dati = null;
  try { dati = await risposta.json(); } catch { /* corpo vuoto o non JSON */ }

  if (!risposta.ok) {
    throw Object.assign(new Error(dati?.errore ?? 'Errore imprevisto. Riprova.'), {
      stato: risposta.status,
      campi: dati?.campi ?? null,
      cambiaPassword: dati?.cambiaPassword === true,
    });
  }
  return dati;
}

// ---------------------------------------------------------------------------
// Stato
// ---------------------------------------------------------------------------

const stato = {
  utente: null,
  config: null,
  appuntamenti: [],
  caricamento: false,
  erroreCaricamento: null,
  disegnoCorrente: 0,
};

const radice = document.getElementById('app');

function rotta() {
  const p = new URLSearchParams(location.search);
  return { vista: p.get('vista'), settimana: p.get('settimana'), giorno: p.get('giorno'), id: p.get('id') };
}

function vai(parametri, { sostituisci = false } = {}) {
  const p = new URLSearchParams();
  for (const [chiave, valore] of Object.entries(parametri)) if (valore) p.set(chiave, valore);
  history[sostituisci ? 'replaceState' : 'pushState']({}, '', `${location.pathname}?${p}`);
  disegna();
}

function rottaPredefinita() {
  return stato.utente?.ruolo === 'admin'
    ? { vista: 'agenda', settimana: lunedi(oggi()) }
    : { vista: 'giorno', giorno: oggi() };
}

// ---------------------------------------------------------------------------
// Accesso
// ---------------------------------------------------------------------------

function vistaAccesso(messaggio) {
  const errore = el('p', { class: 'avviso', role: 'alert', hidden: !messaggio, testo: messaggio ?? '' });

  const modulo = el('form', {
    novalidate: true,
    onsubmit: async (e) => {
      e.preventDefault();
      const bottone = modulo.querySelector('button[type="submit"]');
      bottone.disabled = true;
      bottone.textContent = 'Accesso in corso…';
      errore.hidden = true;
      try {
        const { utente } = await api('/login', {
          metodo: 'POST',
          corpo: {
            email: modulo.elements.email.value,
            password: modulo.elements.password.value,
          },
        });
        stato.utente = utente;
        vai(rottaPredefinita(), { sostituisci: true });
      } catch (e2) {
        errore.textContent = e2.message;
        errore.hidden = false;
        modulo.elements.password.value = '';
        modulo.elements.password.focus();
        bottone.disabled = false;
        bottone.textContent = 'Accedi';
      }
    },
  },
    el('h2', { testo: 'Accedi' }),
    el('p', { class: 'introduzione', testo: 'Area riservata a chi lavora al Punto Antenna.' }),
    errore,
    el('label', { class: 'campo' },
      el('span', { class: 'etichetta', testo: 'Email' }),
      el('input', { type: 'email', name: 'email', autocomplete: 'username', required: true, autocapitalize: 'none' }),
    ),
    el('label', { class: 'campo' },
      el('span', { class: 'etichetta', testo: 'Password' }),
      el('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true }),
    ),
    el('button', { type: 'submit', class: 'pulsante primario', testo: 'Accedi' }),
    el('p', {
      class: 'nota-ruolo',
      testo: 'Il tuo profilo, amministratore o installatore, viene riconosciuto in automatico.',
    }),
  );

  return el('div', { class: 'accesso' },
    el('div', { class: 'marchio' },
      el('span', { class: 'nome', testo: 'Il Punto Antenna Elettronica' }),
      el('h1', { testo: 'Gli interventi caricati in ufficio, subito sul telefono dell’installatore.' }),
      el('p', { testo: 'Agenda condivisa fra il negozio e chi esegue i lavori.' }),
    ),
    el('div', { class: 'modulo-lato' }, modulo),
  );
}

// ---------------------------------------------------------------------------
// Cambio della password
// ---------------------------------------------------------------------------

function vistaCambioPassword({ obbligatorio = false } = {}) {
  const avviso = el('p', { class: 'avviso', role: 'alert', hidden: true });
  const fatto = el('p', { class: 'avviso informativo', role: 'status', hidden: true });

  const campo = (nome, etichetta, autocomplete) =>
    el('label', { class: 'campo', 'data-campo': nome },
      el('span', { class: 'etichetta', testo: etichetta }),
      el('input', { type: 'password', name: nome, autocomplete, required: true }));

  const salva = el('button', { class: 'pulsante primario', type: 'submit', testo: 'Cambia password' });

  const modulo = el('form', { novalidate: true, class: 'modulo-stretto' },
    el('h1', { testo: obbligatorio ? 'Scegli la tua password' : 'Cambia password' }),
    obbligatorio
      ? el('p', { class: 'introduzione', testo: 'Il tuo account è stato creato con una password provvisoria. Prima di entrare nell’agenda devi sceglierne una tua, che sappia soltanto tu.' })
      : el('p', { class: 'introduzione', testo: 'Dopo il cambio resterai collegato solo su questo dispositivo: gli altri dovranno accedere di nuovo.' }),
    avviso,
    fatto,
    campo('attuale', obbligatorio ? 'Password provvisoria' : 'Password attuale', 'current-password'),
    campo('nuova', 'Nuova password', 'new-password'),
    el('p', { class: 'aiuto', testo: 'Almeno 10 caratteri. Evita qualcosa di indovinabile come il nome del negozio o una data.' }),
    campo('ripeti', 'Ripeti la nuova password', 'new-password'),
    el('div', { class: 'bottoni-riga' },
      !obbligatorio && el('button', {
        class: 'pulsante', type: 'button', testo: 'Annulla',
        onclick: () => vai(rottaPredefinita(), { sostituisci: true }),
      }),
      salva,
    ),
    obbligatorio
      ? el('p', { class: 'aiuto' },
          el('button', { class: 'come-link', type: 'button', testo: 'Esci', onclick: esci }),
          ' se preferisci farlo in un altro momento.')
      : null,
  );

  modulo.addEventListener('submit', async (e) => {
    e.preventDefault();
    avviso.hidden = true;
    fatto.hidden = true;
    for (const c of modulo.querySelectorAll('[data-campo]')) {
      c.removeAttribute('data-errore');
      c.querySelector('.errore-campo')?.remove();
    }

    // Il controllo che le due nuove coincidano si fa qui: al server non
    // serve saperlo, e così l'errore compare subito.
    if (modulo.elements.nuova.value !== modulo.elements.ripeti.value) {
      const c = modulo.querySelector('[data-campo="ripeti"]');
      c.setAttribute('data-errore', '');
      c.append(el('span', { class: 'errore-campo', testo: 'Le due password non coincidono' }));
      modulo.elements.ripeti.focus();
      return;
    }

    salva.disabled = true;
    salva.textContent = 'Salvataggio…';
    try {
      await api('/password', {
        metodo: 'POST',
        corpo: { attuale: modulo.elements.attuale.value, nuova: modulo.elements.nuova.value },
      });
      stato.utente.deveCambiarePassword = false;
      fatto.textContent = 'Password cambiata.';
      fatto.hidden = false;
      setTimeout(() => vai(rottaPredefinita(), { sostituisci: true }), 700);
    } catch (errore) {
      mostraErrori(modulo, errore, avviso);
      salva.disabled = false;
      salva.textContent = 'Cambia password';
    }
  });

  return el('div', { class: 'pagina-stretta' }, modulo);
}

async function esci() {
  try { await api('/logout', { metodo: 'POST' }); } catch { /* usciamo comunque */ }
  stato.utente = null;
  stato.appuntamenti = [];
  history.replaceState({}, '', location.pathname);
  disegna();
}

// ---------------------------------------------------------------------------
// Caricamento degli appuntamenti
// ---------------------------------------------------------------------------

async function caricaIntervallo(dal, al) {
  const { appuntamenti } = await api(`/appuntamenti?dal=${dal}&al=${al}`);
  return appuntamenti;
}

const diQuelGiorno = (elenco, giorno) => elenco.filter((a) => a.data === giorno);

// ---------------------------------------------------------------------------
// Amministratore — agenda settimanale
// ---------------------------------------------------------------------------

function vistaAgenda(inizioSettimana) {
  const fasce = stato.config.fasce;
  const adesso = oggi();

  // --- barra superiore ---
  const barra = el('header', { class: 'barra' },
    el('span', { class: 'negozio', testo: 'Il Punto Antenna Elettronica' }),
    el('span', { class: 'separatore', 'aria-hidden': 'true' }),
    el('span', { class: 'sezione', testo: 'Appuntamenti' }),
    el('div', { class: 'destra' },
      el('span', { class: 'chi', testo: `${stato.utente.nome} · Amministratore` }),
      el('button', {
        class: 'pulsante', type: 'button', testo: 'Cambia password',
        onclick: () => vai({ vista: 'password' }),
      }),
      el('button', { class: 'pulsante', type: 'button', testo: 'Esci', onclick: esci }),
    ),
  );

  // --- barra strumenti ---
  const strumenti = el('div', { class: 'strumenti' },
    el('button', {
      class: 'pulsante icona', type: 'button', icona: 'sinistra',
      'aria-label': 'Settimana precedente',
      onclick: () => vai({ vista: 'agenda', settimana: piuGiorni(inizioSettimana, -7) }),
    }),
    el('button', {
      class: 'pulsante icona', type: 'button', icona: 'destra',
      'aria-label': 'Settimana successiva',
      onclick: () => vai({ vista: 'agenda', settimana: piuGiorni(inizioSettimana, 7) }),
    }),
    el('button', {
      class: 'pulsante', type: 'button', testo: 'Oggi',
      onclick: () => vai({ vista: 'agenda', settimana: lunedi(oggi()) }),
    }),
    el('h1', { class: 'titolo-settimana', testo: intervalloSettimana(inizioSettimana) }),
    el('div', { class: 'a-destra' },
      el('div', { class: 'legenda' },
        el('span', {}, el('i', { 'aria-hidden': 'true' }), 'Normale'),
        el('span', {}, el('i', { class: 'urgente', 'aria-hidden': 'true' }), 'Urgente'),
      ),
      el('button', {
        class: 'pulsante primario', type: 'button', icona: 'piu',
        onclick: () => apriPannelloNuovo(inizioSettimana),
      }, 'Nuovo appuntamento'),
    ),
  );

  // --- intestazione della griglia ---
  const intestazione = el('div', { class: 'intestazione' }, el('div', {}));
  for (let i = 0; i < 6; i += 1) {
    const giorno = piuGiorni(inizioSettimana, i);
    const d = aUTC(giorno);
    intestazione.append(el('div', { class: giorno === adesso ? 'oggi' : null },
      el('span', { class: 'sigla', testo: SIGLE[i] }),
      el('span', { class: 'numero', testo: String(d.getUTCDate()) }),
    ));
  }

  // --- colonna degli orari ---
  // Tutte le misure sono espresse in funzione di --riga, mai in pixel fissi:
  // così quando app.js ricalcola l'altezza della fascia sulla finestra, righe
  // ed etichette si spostano da sole, senza ridisegnare niente.
  const altezzaTotale = `calc(var(--riga) * ${fasce.length})`;

  const colonnaOre = el('div', { class: 'colonna-ore', style: `height:${altezzaTotale}` });
  fasce.forEach((ora, indice) => {
    if (!ora.endsWith(':00')) return;
    colonnaOre.append(el('span', {
      class: 'ora', testo: ora, style: `top:calc(var(--riga) * ${indice})`,
    }));
  });

  // --- colonne dei giorni ---
  const corpo = el('div', { class: 'corpo' }, colonnaOre);
  for (let i = 0; i < 6; i += 1) {
    const giorno = piuGiorni(inizioSettimana, i);
    const colonna = el('div', {
      class: `colonna-giorno${giorno === adesso ? ' oggi' : ''}`,
      style: `height:${altezzaTotale}`,
    });

    for (const appuntamento of diQuelGiorno(stato.appuntamenti, giorno)) {
      const indice = fasce.indexOf(appuntamento.ora);
      if (indice < 0) continue; // fascia fuori orario: non rappresentabile nella griglia
      colonna.append(el('button', {
        type: 'button',
        class: `blocco${appuntamento.urgente ? ' urgente' : ''}`,
        style: `top:calc(var(--riga) * ${indice} + 2px)`,
        title: `${appuntamento.ora} · ${appuntamento.nomeCliente} · ${appuntamento.luogoImpianto}`,
        onclick: (e) => apriPannelloScheda(appuntamento.id, inizioSettimana, e.currentTarget),
      },
        // "Urgente" sta sulla prima riga e non si accorcia mai: la seconda
        // riga sparisce quando le fasce si stringono, e il colore da solo
        // non basta a dire che un intervento è urgente.
        el('span', { class: 'prima' },
          el('span', { class: 'quando-chi', testo: `${appuntamento.ora} ${appuntamento.nomeCliente}` }),
          appuntamento.urgente ? el('span', { class: 'segno-urgente', testo: 'Urgente' }) : null,
        ),
        el('span', { class: 'seconda', testo: appuntamento.luogoImpianto }),
      ));
    }
    corpo.append(colonna);
  }

  const agenda = el('div', { class: 'agenda' }, intestazione, corpo);
  return el('div', {}, barra, strumenti, el('div', { class: 'agenda-contenitore' }, agenda));
}

/** Limiti dell'altezza di una fascia: sotto il minimo diventa illeggibile,
 *  sopra il massimo si spreca spazio su uno schermo molto alto. */
const FASCIA_MINIMA = 24;
const FASCIA_MASSIMA = 40;
/**
 * Sotto questa altezza nel blocco ci sta una riga sola.
 * Il blocco è alto `riga - 4`, e due righe di testo ne occupano circa 26:
 * sotto i 30px verrebbero tagliate.
 */
const FASCIA_A_UNA_RIGA = 30;

/**
 * Sceglie l'altezza della fascia in modo che l'intera giornata entri nella
 * finestra. Si limita a scrivere --riga sull'agenda: righe, etichette e
 * blocchi sono tutti espressi in funzione di quella variabile e si
 * ricollocano da soli.
 */
function adattaAgenda() {
  const agenda = document.querySelector('.agenda');
  const corpo = agenda?.querySelector('.corpo');
  if (!corpo || !stato.config) return;

  const quante = stato.config.fasce.length;
  const cima = corpo.getBoundingClientRect().top + window.scrollY;
  const respiro = 20;
  const disponibile = window.innerHeight - cima - respiro;

  const riga = Math.max(
    FASCIA_MINIMA,
    Math.min(FASCIA_MASSIMA, Math.floor(disponibile / quante)),
  );
  agenda.style.setProperty('--riga', `${riga}px`);
  agenda.classList.toggle('compatta', riga < FASCIA_A_UNA_RIGA);
}

// ---------------------------------------------------------------------------
// Amministratore — pannello laterale
// ---------------------------------------------------------------------------

function pannello(titolo, contenuto, piede) {
  const finestra = el('dialog', { class: 'pannello', 'aria-label': titolo });
  const chiudi = () => finestra.close();

  finestra.append(el('div', { class: 'dentro' },
    el('div', { class: 'testa' },
      el('h2', { testo: titolo }),
      el('button', {
        class: 'pulsante icona chiudi', type: 'button', icona: 'chiudi',
        'aria-label': 'Chiudi', onclick: chiudi,
      }),
    ),
    el('div', { class: 'contenuto' }, contenuto),
    piede,
  ));

  // <dialog> con showModal() dà già: sfondo scurito, fuoco intrappolato
  // dentro il pannello e chiusura con Esc. Non serve riscriverlo a mano.
  finestra.addEventListener('close', () => finestra.remove());
  document.body.append(finestra);
  finestra.showModal();
  return { finestra, chiudi };
}

/** Campi della scheda cliente, condivisi fra "nuovo" e "modifica". */
function campiScheda(valori = {}) {
  const fasce = stato.config.fasce;

  const campo = (nome, etichetta, dentro) =>
    el('label', { class: 'campo', 'data-campo': nome },
      el('span', { class: 'etichetta', testo: etichetta }), dentro);

  const opzioniOra = fasce.map((ora) =>
    el('option', { value: ora, selected: valori.ora === ora, testo: ora }));

  return el('div', {},
    el('h3', { class: 'sezione-titolo', testo: 'Scheda cliente' }),

    campo('nomeCliente', 'Nome cliente',
      el('input', { type: 'text', name: 'nomeCliente', required: true, autocomplete: 'off', value: valori.nomeCliente ?? '' })),

    campo('luogoImpianto', 'Luogo impianto',
      el('input', { type: 'text', name: 'luogoImpianto', required: true, autocomplete: 'off', value: valori.luogoImpianto ?? '', placeholder: 'Via, civico, città' })),

    el('div', { class: 'coppia' },
      campo('telefonoCliente', 'Telefono cliente',
        el('input', { type: 'tel', name: 'telefonoCliente', required: true, autocomplete: 'off', value: valori.telefonoCliente ?? '' })),
      campo('prezzoConcordato', 'Prezzo concordato con il cliente',
        el('span', { class: 'con-euro' },
          el('input', { type: 'text', name: 'prezzoConcordato', required: true, inputmode: 'decimal', autocomplete: 'off', value: valori.prezzoConcordato ?? '' }))),
    ),

    el('div', { class: 'coppia' },
      campo('data', 'Data',
        el('input', { type: 'date', name: 'data', required: true, value: valori.data ?? '' })),
      campo('ora', 'Ora',
        el('select', { name: 'ora', required: true },
          !valori.ora && el('option', { value: '', testo: 'Scegli…' }),
          opzioniOra)),
    ),

    campo('note', 'Note aggiuntive',
      el('textarea', { name: 'note', rows: '3', testo: valori.note ?? '' })),

    el('label', { class: 'scelta' },
      el('input', { type: 'checkbox', name: 'urgente', checked: valori.urgente === true }),
      el('span', {},
        'Segna come urgente',
        el('span', { class: 'nota', testo: 'Resta evidenziato in agenda e nella vista dell’installatore.' }),
      ),
    ),
  );
}

/** Legge i campi della scheda dal modulo. */
function leggiScheda(modulo) {
  return {
    nomeCliente: modulo.elements.nomeCliente.value,
    luogoImpianto: modulo.elements.luogoImpianto.value,
    telefonoCliente: modulo.elements.telefonoCliente.value,
    prezzoConcordato: modulo.elements.prezzoConcordato.value,
    data: modulo.elements.data.value,
    ora: modulo.elements.ora.value,
    note: modulo.elements.note.value,
    urgente: modulo.elements.urgente.checked,
  };
}

/** Mostra gli errori restituiti dal server accanto ai campi giusti. */
function mostraErrori(modulo, errore, avviso) {
  for (const campo of modulo.querySelectorAll('[data-campo]')) {
    campo.removeAttribute('data-errore');
    campo.querySelector('.errore-campo')?.remove();
  }
  if (errore.campi) {
    for (const [nome, messaggio] of Object.entries(errore.campi)) {
      const campo = modulo.querySelector(`[data-campo="${nome}"]`);
      if (!campo) continue;
      campo.setAttribute('data-errore', '');
      campo.append(el('span', { class: 'errore-campo', testo: messaggio }));
    }
  }
  avviso.textContent = errore.message;
  avviso.hidden = false;
}

function apriPannelloNuovo(inizioSettimana) {
  // La data parte già compilata: oggi se stiamo guardando la settimana
  // corrente, altrimenti il lunedì della settimana a schermo. È il valore
  // giusto nella quasi totalità dei casi e toglie un passaggio a Tiziana.
  const adesso = oggi();
  const dentroLaSettimana = adesso >= inizioSettimana && adesso <= piuGiorni(inizioSettimana, 5);

  const avviso = el('p', { class: 'avviso', role: 'alert', hidden: true });
  const modulo = el('form', { novalidate: true, id: 'modulo-nuovo' },
    avviso, campiScheda({ data: dentroLaSettimana ? adesso : inizioSettimana }));

  const annulla = el('button', { class: 'pulsante', type: 'button', testo: 'Annulla' });
  const salva = el('button', {
    class: 'pulsante primario', type: 'submit', form: 'modulo-nuovo', testo: 'Salva appuntamento',
  });

  const { chiudi } = pannello('Nuovo appuntamento', modulo,
    el('div', { class: 'piede' }, annulla, salva));

  annulla.addEventListener('click', () => chiudi());

  modulo.addEventListener('submit', async (e) => {
    e.preventDefault();
    salva.disabled = true;
    salva.textContent = 'Salvataggio…';
    try {
      await api('/appuntamenti', { metodo: 'POST', corpo: leggiScheda(modulo) });
      chiudi();
      await ridisegnaDati();
    } catch (errore) {
      mostraErrori(modulo, errore, avviso);
      salva.disabled = false;
      salva.textContent = 'Salva appuntamento';
    }
  });

  modulo.elements.nomeCliente.focus();
}

async function apriPannelloScheda(id, inizioSettimana, blocco) {
  blocco?.classList.add('scelto');

  let appuntamento;
  try {
    ({ appuntamento } = await api(`/appuntamenti/${id}`));
  } catch (e) {
    blocco?.classList.remove('scelto');
    avvisoVolante(e.message);
    return;
  }

  const avviso = el('p', { class: 'avviso', role: 'alert', hidden: true });

  const moduloRimanda = el('form', { novalidate: true, class: 'riquadro-rimanda', id: 'modulo-rimanda' },
    el('h3', { class: 'sezione-titolo', testo: 'Rimanda l’appuntamento' }),
    el('div', { class: 'coppia' },
      el('label', { class: 'campo', 'data-campo': 'data' },
        el('span', { class: 'etichetta', testo: 'Nuova data' }),
        el('input', { type: 'date', name: 'data', value: appuntamento.data, required: true })),
      el('label', { class: 'campo', 'data-campo': 'ora' },
        el('span', { class: 'etichetta', testo: 'Nuova ora' }),
        el('select', { name: 'ora', required: true },
          stato.config.fasce.map((ora) =>
            el('option', { value: ora, selected: ora === appuntamento.ora, testo: ora })))),
    ),
    el('button', { class: 'pulsante primario', type: 'submit', testo: 'Conferma nuova data e ora' }),
  );

  const riga = (etichetta, valore) => el('div', {},
    el('dt', { testo: etichetta }), el('dd', {}, valore));

  const contenuto = el('div', {},
    avviso,
    el('div', { class: 'scheda-nome', testo: appuntamento.nomeCliente }),
    appuntamento.urgente ? el('p', { style: 'margin:.35rem 0 0' }, el('span', { class: 'etichetta-urgente', testo: 'Urgente' })) : null,
    el('p', { class: 'scheda-quando', testo: `${maiuscola(dataEstesa(appuntamento.data))} · ore ${appuntamento.ora}` }),
    el('dl', { class: 'righe' },
      riga('Luogo impianto', appuntamento.luogoImpianto),
      riga('Telefono cliente', el('a', { href: `tel:${appuntamento.telefonoPerChiamata}`, testo: appuntamento.telefonoCliente })),
      riga('Prezzo concordato', `€ ${appuntamento.prezzoConcordato}`),
      riga('Note', appuntamento.note || '—'),
    ),
    moduloRimanda,
    el('div', { style: 'margin-top:1.25rem' },
      el('button', {
        class: 'pulsante', type: 'button', style: 'width:100%',
        testo: 'Modifica scheda',
        onclick: () => { chiudi(); apriPannelloModifica(appuntamento, inizioSettimana); },
      }),
    ),
  );

  const { chiudi, finestra } = pannello('Scheda appuntamento', contenuto,
    el('div', { class: 'piede sparso' },
      el('button', {
        class: 'pulsante pericolo', type: 'button', testo: 'Annulla appuntamento',
        onclick: () => chiediConferma(appuntamento, async () => { chiudi(); await ridisegnaDati(); }),
      }),
      el('button', { class: 'pulsante', type: 'button', testo: 'Chiudi', onclick: () => chiudi() }),
    ));

  finestra.addEventListener('close', () => blocco?.classList.remove('scelto'));

  moduloRimanda.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bottone = moduloRimanda.querySelector('button[type="submit"]');
    bottone.disabled = true;
    bottone.textContent = 'Sposto…';
    try {
      await api(`/appuntamenti/${appuntamento.id}/rimanda`, {
        metodo: 'PATCH',
        corpo: { data: moduloRimanda.elements.data.value, ora: moduloRimanda.elements.ora.value },
      });
      chiudi();
      await ridisegnaDati();
    } catch (errore) {
      mostraErrori(moduloRimanda, errore, avviso);
      bottone.disabled = false;
      bottone.textContent = 'Conferma nuova data e ora';
    }
  });
}

function apriPannelloModifica(appuntamento, inizioSettimana) {
  const avviso = el('p', { class: 'avviso', role: 'alert', hidden: true });
  const modulo = el('form', { novalidate: true, id: 'modulo-modifica' },
    avviso, campiScheda(appuntamento));

  const salva = el('button', {
    class: 'pulsante primario', type: 'submit', form: 'modulo-modifica', testo: 'Salva modifiche',
  });

  const { chiudi } = pannello('Modifica scheda', modulo,
    el('div', { class: 'piede' },
      el('button', {
        class: 'pulsante', type: 'button', testo: 'Annulla',
        onclick: () => { chiudi(); apriPannelloScheda(appuntamento.id, inizioSettimana); },
      }),
      salva,
    ));

  modulo.addEventListener('submit', async (e) => {
    e.preventDefault();
    salva.disabled = true;
    salva.textContent = 'Salvataggio…';
    try {
      await api(`/appuntamenti/${appuntamento.id}`, { metodo: 'PATCH', corpo: leggiScheda(modulo) });
      chiudi();
      await ridisegnaDati();
    } catch (errore) {
      mostraErrori(modulo, errore, avviso);
      salva.disabled = false;
      salva.textContent = 'Salva modifiche';
    }
  });

  modulo.elements.nomeCliente.focus();
}

function chiediConferma(appuntamento, dopo) {
  const finestra = el('dialog', { class: 'conferma', 'aria-labelledby': 'titolo-conferma' });
  const conferma = el('button', { class: 'pulsante pericolo-pieno', type: 'button', testo: 'Sì, annulla appuntamento' });
  const avviso = el('p', { class: 'avviso', role: 'alert', hidden: true });

  finestra.append(
    el('h2', { id: 'titolo-conferma', testo: 'Annullare l’appuntamento?' }),
    avviso,
    el('div', { class: 'riassunto' },
      el('strong', { testo: appuntamento.nomeCliente }),
      el('div', { testo: `${maiuscola(dataEstesa(appuntamento.data))} · ore ${appuntamento.ora}` }),
      el('div', { testo: appuntamento.luogoImpianto }),
    ),
    el('p', {
      testo: 'L’appuntamento sparisce dall’agenda e dalla vista dell’installatore. ' +
             'Se serve, potrai inserirne uno nuovo.',
    }),
    el('div', { class: 'bottoni' },
      el('button', { class: 'pulsante', type: 'button', testo: 'Torna alla scheda', onclick: () => finestra.close() }),
      conferma,
    ),
  );

  conferma.addEventListener('click', async () => {
    conferma.disabled = true;
    conferma.textContent = 'Annullo…';
    try {
      await api(`/appuntamenti/${appuntamento.id}/annulla`, { metodo: 'POST' });
      finestra.close();
      await dopo();
    } catch (errore) {
      avviso.textContent = errore.message;
      avviso.hidden = false;
      conferma.disabled = false;
      conferma.textContent = 'Sì, annulla appuntamento';
    }
  });

  finestra.addEventListener('close', () => finestra.remove());
  document.body.append(finestra);
  finestra.showModal();
}

/** Messaggio breve per gli errori che non appartengono a un modulo. */
function avvisoVolante(messaggio) {
  const nota = el('p', {
    class: 'avviso', role: 'alert', testo: messaggio,
    style: 'position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);z-index:99;max-width:min(30rem,calc(100vw - 2rem))',
  });
  document.body.append(nota);
  setTimeout(() => nota.remove(), 6000);
}

// ---------------------------------------------------------------------------
// Installatore
// ---------------------------------------------------------------------------

function testaInstallatore() {
  return el('header', { class: 'testa-installatore' },
    el('span', { class: 'nome', testo: 'Il Punto Antenna' }),
    el('div', { class: 'azioni' },
      el('button', {
        class: 'pulsante chiaro icona', type: 'button', icona: 'chiave',
        'aria-label': 'Cambia password',
        onclick: () => vai({ vista: 'password' }),
      }),
      el('button', { class: 'pulsante chiaro', type: 'button', testo: 'Esci', onclick: esci }),
    ),
  );
}

function schedeVista(attiva, { giorno, settimana }) {
  const link = (etichetta, chiave, parametri) => {
    const p = new URLSearchParams(parametri);
    return el('a', {
      href: `?${p}`,
      'aria-current': attiva === chiave ? 'page' : null,
      testo: etichetta,
      onclick: (e) => { e.preventDefault(); vai(parametri); },
    });
  };
  return el('nav', { class: 'schede', 'aria-label': 'Cambia vista' },
    link('Giorno', 'giorno', { vista: 'giorno', giorno: giorno ?? oggi() }),
    link('Settimana', 'settimana', { vista: 'settimana', settimana: settimana ?? lunedi(giorno ?? oggi()) }),
  );
}

/**
 * Passando da "Settimana" a "Giorno": se oggi cade nella settimana mostrata si
 * apre su oggi, altrimenti sul lunedì di quella settimana.
 */
function giornoDaAprire(inizioSettimana) {
  const adesso = oggi();
  return adesso >= inizioSettimana && adesso <= piuGiorni(inizioSettimana, 5) ? adesso : inizioSettimana;
}

function conteggio(elenco) {
  const urgenti = elenco.filter((a) => a.urgente).length;
  const parti = [`${elenco.length} ${elenco.length === 1 ? 'appuntamento' : 'appuntamenti'}`];
  if (urgenti > 0) parti.push(`${urgenti} ${urgenti === 1 ? 'urgente' : 'urgenti'}`);
  return parti.join(' · ');
}

function voceAppuntamento(appuntamento, { compatta = false } = {}) {
  return el('li', { class: `voce${compatta ? ' compatta' : ''}${appuntamento.urgente ? ' urgente' : ''}` },
    el('span', { class: 'quando', testo: appuntamento.ora }),
    el('a', {
      href: `?vista=dettaglio&id=${appuntamento.id}`,
      onclick: (e) => { e.preventDefault(); vai({ vista: 'dettaglio', id: String(appuntamento.id) }); },
    },
      el('span', { class: 'chi', testo: appuntamento.nomeCliente }),
      el('span', { class: 'dove' },
        el('span', { icona: 'posizione', 'aria-hidden': 'true' }),
        el('span', { testo: appuntamento.luogoImpianto }),
      ),
      appuntamento.urgente ? el('span', { class: 'etichetta-urgente', testo: 'Urgente' }) : null,
    ),
  );
}

function vistaGiorno(giorno) {
  const elenco = diQuelGiorno(stato.appuntamenti, giorno);
  const sotto = [giorno === oggi() ? 'Oggi' : null, conteggio(elenco)].filter(Boolean).join(' · ');

  return el('div', { class: 'app-installatore' },
    testaInstallatore(),
    schedeVista('giorno', { giorno }),
    el('div', { class: 'navigazione-giorno' },
      el('button', {
        class: 'pulsante icona', type: 'button', icona: 'sinistra', 'aria-label': 'Giorno precedente',
        onclick: () => vai({ vista: 'giorno', giorno: piuGiorni(giorno, -1) }),
      }),
      el('div', { class: 'testo' },
        el('h1', { testo: maiuscola(dataEstesa(giorno, { conAnno: false })) }),
        el('div', { class: 'sotto', testo: sotto }),
      ),
      el('button', {
        class: 'pulsante icona', type: 'button', icona: 'destra', 'aria-label': 'Giorno successivo',
        onclick: () => vai({ vista: 'giorno', giorno: piuGiorni(giorno, 1) }),
      }),
    ),
    elenco.length === 0
      ? el('p', { class: 'vuoto', testo: 'Nessun appuntamento' })
      : el('ul', { class: 'elenco' }, elenco.map((a) => voceAppuntamento(a))),
    rigaNotifiche(),
  );
}

function vistaSettimana(inizioSettimana) {
  const gruppi = [];
  for (let i = 0; i < 6; i += 1) {
    const giorno = piuGiorni(inizioSettimana, i);
    const elenco = diQuelGiorno(stato.appuntamenti, giorno);
    const d = aUTC(giorno);
    gruppi.push(el('section', { class: 'giorno-gruppo' },
      el('h2', {},
        `${maiuscola(GIORNI[i])} ${d.getUTCDate()}`,
        giorno === oggi() ? el('span', { class: 'oggi-segno', testo: 'Oggi' }) : null,
      ),
      elenco.length === 0
        ? el('p', { class: 'vuoto', testo: 'Nessun appuntamento' })
        : el('ul', { class: 'elenco' }, elenco.map((a) => voceAppuntamento(a, { compatta: true }))),
    ));
  }

  return el('div', { class: 'app-installatore' },
    testaInstallatore(),
    schedeVista('settimana', { settimana: inizioSettimana, giorno: giornoDaAprire(inizioSettimana) }),
    el('div', { class: 'navigazione-giorno' },
      el('button', {
        class: 'pulsante icona', type: 'button', icona: 'sinistra', 'aria-label': 'Settimana precedente',
        onclick: () => vai({ vista: 'settimana', settimana: piuGiorni(inizioSettimana, -7) }),
      }),
      el('div', { class: 'testo' },
        el('h1', { testo: intervalloSettimana(inizioSettimana) }),
        el('div', { class: 'sotto', testo: conteggio(stato.appuntamenti) }),
      ),
      el('button', {
        class: 'pulsante icona', type: 'button', icona: 'destra', 'aria-label': 'Settimana successiva',
        onclick: () => vai({ vista: 'settimana', settimana: piuGiorni(inizioSettimana, 7) }),
      }),
    ),
    gruppi,
  );
}

function vistaDettaglio(appuntamento) {
  const riquadro = (titoletto, valore, grande = false) => el('div', { class: 'riquadro' },
    el('div', { class: 'titoletto', testo: titoletto }),
    el('div', { class: `valore${grande ? ' grande' : ''}` }, valore),
  );

  return el('div', { class: 'app-installatore' },
    testaInstallatore(),
    el('div', { class: 'barra-indietro' },
      el('button', {
        class: 'pulsante', type: 'button', icona: 'sinistra',
        onclick: () => (history.length > 1 ? history.back() : vai({ vista: 'giorno', giorno: appuntamento.data })),
      }, 'Indietro'),
    ),
    el('div', { class: 'dettaglio' },
      appuntamento.urgente ? el('div', {}, el('span', { class: 'etichetta-urgente', testo: 'Urgente' })) : null,
      el('h1', { class: 'nome-grande', testo: appuntamento.nomeCliente }),
      riquadro('Data e ora', `${maiuscola(dataEstesa(appuntamento.data))} · ore ${appuntamento.ora}`, true),
      riquadro('Luogo impianto', appuntamento.luogoImpianto),
      el('a', { class: 'chiama', href: `tel:${appuntamento.telefonoPerChiamata}` },
        el('span', { icona: 'telefono', 'aria-hidden': 'true' }),
        el('span', {},
          el('span', { class: 'sopra', testo: 'Telefono cliente · tocca per chiamare' }),
          appuntamento.telefonoCliente,
        ),
      ),
      riquadro('Prezzo concordato', `€ ${appuntamento.prezzoConcordato}`, true),
      riquadro('Note', appuntamento.note || '—'),
    ),
  );
}

// ---------------------------------------------------------------------------
// Notifiche push
// ---------------------------------------------------------------------------

const supportaPush = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const installataSuHome = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const suIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function daBase64(base64) {
  const riempito = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(riempito);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

function rigaNotifiche() {
  if (stato.utente?.ruolo !== 'installatore') return null;
  if (!stato.config?.chiavePush) return null;

  // Su iPhone le notifiche web arrivano solo se il sito è stato aggiunto alla
  // schermata Home: è un vincolo di Apple, non c'è modo di aggirarlo.
  if (suIOS() && !installataSuHome()) {
    return el('div', { class: 'riga-notifiche' },
      el('span', { icona: 'campana', 'aria-hidden': 'true' }),
      el('div', { class: 'testo' },
        'Attiva le notifiche',
        el('span', {
          class: 'stato',
          testo: 'Su iPhone: tocca Condividi, poi «Aggiungi a Home». Riapri il pannello da lì e torna qui.',
        }),
      ),
    );
  }

  if (!supportaPush()) return null;

  const stampa = el('span', { class: 'stato', testo: '' });
  const bottone = el('button', { class: 'pulsante', type: 'button', testo: 'Attiva' });

  const aggiorna = async () => {
    if (Notification.permission === 'denied') {
      stampa.textContent = 'Bloccate nelle impostazioni del browser.';
      bottone.hidden = true;
      return;
    }
    const registrazione = await navigator.serviceWorker.getRegistration();
    const iscrizione = await registrazione?.pushManager.getSubscription();
    if (iscrizione) {
      stampa.textContent = 'Attive su questo dispositivo.';
      bottone.textContent = 'Disattiva';
    } else {
      stampa.textContent = 'Ricevi un avviso quando arriva o cambia un intervento.';
      bottone.textContent = 'Attiva';
    }
  };

  bottone.addEventListener('click', async () => {
    bottone.disabled = true;
    try {
      const registrazione = await navigator.serviceWorker.register('sw.js');
      await navigator.serviceWorker.ready;
      const esistente = await registrazione.pushManager.getSubscription();

      if (esistente) {
        await api('/push/iscrizione', { metodo: 'DELETE', corpo: { endpoint: esistente.endpoint } });
        await esistente.unsubscribe();
      } else {
        if (await Notification.requestPermission() !== 'granted') {
          stampa.textContent = 'Permesso non concesso.';
          return;
        }
        const iscrizione = await registrazione.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: daBase64(stato.config.chiavePush),
        });
        const chiavi = iscrizione.toJSON().keys;
        await api('/push/iscrizione', {
          metodo: 'POST',
          corpo: { endpoint: iscrizione.endpoint, chiavi },
        });
      }
      await aggiorna();
    } catch (e) {
      stampa.textContent = e.message ?? 'Non è stato possibile cambiare le notifiche.';
    } finally {
      bottone.disabled = false;
    }
  });

  aggiorna();

  return el('div', { class: 'riga-notifiche' },
    el('span', { icona: 'campana', 'aria-hidden': 'true' }),
    el('div', { class: 'testo' }, 'Notifiche', stampa),
    bottone,
  );
}

// ---------------------------------------------------------------------------
// Disegno
// ---------------------------------------------------------------------------

function schermataStato(messaggio, { errore = false, riprova = null } = {}) {
  return el('div', { class: 'app-installatore' },
    el('div', { style: 'padding:3rem 1.15rem;text-align:center' },
      el('p', { class: errore ? 'avviso' : null, role: errore ? 'alert' : null, testo: messaggio }),
      riprova ? el('button', { class: 'pulsante', type: 'button', testo: 'Riprova', onclick: riprova }) : null,
    ),
  );
}

function sostituisci(contenuto) {
  radice.replaceChildren(contenuto);
  radice.classList.remove('avvio');
  // Subito dopo l'inserimento nella pagina, quando le misure reali esistono
  // ma il browser non ha ancora disegnato: l'agenda parte già della misura
  // giusta, senza sobbalzi.
  adattaAgenda();
}

async function disegna() {
  const mio = ++stato.disegnoCorrente;
  const r = rotta();

  if (!stato.utente) {
    sostituisci(vistaAccesso());
    return;
  }

  // Password provvisoria: non si va da nessun'altra parte finché non ne sceglie
  // una sua. Lo stesso blocco è ripetuto nell'API, che rifiuta ogni richiesta.
  if (stato.utente.deveCambiarePassword) {
    sostituisci(vistaCambioPassword({ obbligatorio: true }));
    return;
  }

  if (r.vista === 'password') {
    sostituisci(vistaCambioPassword());
    return;
  }

  // Nessuna vista nell'indirizzo: portiamo l'utente dove gli compete.
  if (!r.vista) {
    vai(rottaPredefinita(), { sostituisci: true });
    return;
  }
  // Un installatore non ha l'agenda settimanale dell'amministratore.
  if (r.vista === 'agenda' && stato.utente.ruolo !== 'admin') {
    vai({ vista: 'giorno', giorno: oggi() }, { sostituisci: true });
    return;
  }

  sostituisci(schermataStato('Caricamento…'));

  try {
    if (r.vista === 'dettaglio') {
      const { appuntamento } = await api(`/appuntamenti/${Number(r.id)}`);
      if (mio !== stato.disegnoCorrente) return;
      sostituisci(vistaDettaglio(appuntamento));
      return;
    }

    if (r.vista === 'giorno') {
      const giorno = r.giorno ?? oggi();
      stato.appuntamenti = await caricaIntervallo(giorno, giorno);
      if (mio !== stato.disegnoCorrente) return;
      sostituisci(vistaGiorno(giorno));
      return;
    }

    const inizio = lunedi(r.settimana ?? oggi());
    stato.appuntamenti = await caricaIntervallo(inizio, piuGiorni(inizio, 5));
    if (mio !== stato.disegnoCorrente) return;
    sostituisci(r.vista === 'agenda' ? vistaAgenda(inizio) : vistaSettimana(inizio));
  } catch (e) {
    if (mio !== stato.disegnoCorrente) return;
    if (e.stato === 401) {
      stato.utente = null;
      sostituisci(vistaAccesso('La sessione è scaduta. Accedi di nuovo.'));
      return;
    }
    if (e.cambiaPassword) {
      stato.utente.deveCambiarePassword = true;
      sostituisci(vistaCambioPassword({ obbligatorio: true }));
      return;
    }
    if (e.stato === 404) {
      sostituisci(schermataStato('Appuntamento non trovato: potrebbe essere stato annullato.', {
        errore: true,
        riprova: () => vai(rottaPredefinita(), { sostituisci: true }),
      }));
      return;
    }
    sostituisci(schermataStato(e.message, { errore: true, riprova: () => disegna() }));
  }
}

/** Ricarica i dati e ridisegna la vista corrente, senza ricaricare la pagina. */
const ridisegnaDati = () => disegna();

// ---------------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------------

window.addEventListener('popstate', () => disegna());

// Ridimensionando la finestra basta ricalcolare l'altezza della fascia:
// non serve ridisegnare l'agenda né richiedere di nuovo i dati.
let attesaRidimensionamento;
window.addEventListener('resize', () => {
  clearTimeout(attesaRidimensionamento);
  attesaRidimensionamento = setTimeout(adattaAgenda, 120);
});

async function avvia() {
  try {
    stato.config = await api('/configurazione');
  } catch (e) {
    sostituisci(schermataStato(e.message, { errore: true, riprova: () => avvia() }));
    return;
  }

  try {
    const { utente } = await api('/sessione');
    stato.utente = utente;
  } catch {
    stato.utente = null; // non collegato: si parte dalla pagina di accesso
  }

  await disegna();
}

avvia();
