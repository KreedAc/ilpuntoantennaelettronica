/* Pannello appuntamenti — interfaccia.
 *
 * Nessuna libreria: la pagina si costruisce con `document.createElement`.
 * Tutto il testo che arriva dal database entra nel documento come
 * `textContent`, mai come HTML: un nome cliente scritto con dentro dei tag
 * resta testo e non può eseguire nulla.
 *
 * Lo stato della vista (giorno o settimana mostrati, filtro per installatore)
 * sta nell'indirizzo, così il ricaricamento e il tasto "indietro" del browser
 * funzionano come ci si aspetta.
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
  spunta:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
  passa:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3l4 4-4 4"/><path d="M21 7H8a4 4 0 00-4 4v1"/><path d="M7 21l-4-4 4-4"/><path d="M3 17h13a4 4 0 004-4v-1"/></svg>',
};

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------
// Stesse regole del server (netlify/lib/calendario.mjs): i conti si fanno in
// UTC su stringhe "YYYY-MM-DD", così l'ora legale non sposta mai un giorno.

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
  utenti: [],
  appuntamenti: [],
  disegnoCorrente: 0,
};

const radice = document.getElementById('app');

/** I colori delle colonne, in ordine di `posizione`. */
const COLORI = ['#2e3192', '#0f7b6c', '#a3560c', '#7a2d6b', '#1d6fa5'];

const installatori = () => stato.utenti.filter((u) => u.ruolo === 'installatore');

function coloreDi(id) {
  const indice = installatori().findIndex((u) => u.id === id);
  return indice < 0 ? 'var(--bordo-campo)' : COLORI[indice % COLORI.length];
}

function nomeDi(id) {
  return stato.utenti.find((u) => u.id === id)?.nome ?? null;
}

const iniziale = (nome) => (nome ?? '?').trim().charAt(0).toUpperCase();

const eAdmin = () => stato.utente?.ruolo === 'admin';

function rotta() {
  const p = new URLSearchParams(location.search);
  return {
    vista: p.get('vista'),
    settimana: p.get('settimana'),
    giorno: p.get('giorno'),
    id: p.get('id'),
    chi: p.get('chi'),
  };
}

function vai(parametri, { sostituisci = false } = {}) {
  const p = new URLSearchParams();
  for (const [chiave, valore] of Object.entries(parametri)) if (valore) p.set(chiave, valore);
  history[sostituisci ? 'replaceState' : 'pushState']({}, '', `${location.pathname}?${p}`);
  disegna();
}

const rottaPredefinita = () => ({ vista: 'giorno', giorno: oggi() });

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
        await caricaUtenti();
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
  stato.utenti = [];
  history.replaceState({}, '', location.pathname);
  disegna();
}

// ---------------------------------------------------------------------------
// Caricamento dei dati
// ---------------------------------------------------------------------------

async function caricaUtenti() {
  try {
    const { utenti } = await api('/utenti');
    stato.utenti = utenti;
  } catch {
    // Si tiene l'elenco precedente: meglio nomi e colori di un minuto fa che
    // un'agenda senza colonne perché una richiesta è andata storta.
  }
}

async function caricaIntervallo(dal, al) {
  const { appuntamenti } = await api(`/appuntamenti?dal=${dal}&al=${al}`);
  return appuntamenti;
}

const diQuelGiorno = (elenco, giorno) => elenco.filter((a) => a.data === giorno);
const diQuellaPersona = (elenco, id) => elenco.filter((a) => a.assegnatoA === id);
const daAssegnare = (elenco) => elenco.filter((a) => a.assegnatoA === null);
const conclusi = (elenco) => elenco.filter((a) => a.fatto).length;

// ---------------------------------------------------------------------------
// Pezzi comuni dell'agenda
// ---------------------------------------------------------------------------

function barraSuperiore() {
  return el('header', { class: 'barra' },
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
}

function sceltaVista(attiva, riferimento) {
  const bottone = (etichetta, chiave, parametri) => el('button', {
    type: 'button',
    'aria-pressed': attiva === chiave ? 'true' : 'false',
    testo: etichetta,
    onclick: () => vai(parametri),
  });
  return el('div', { class: 'scelta-vista' },
    bottone('Giorno', 'giorno', { vista: 'giorno', giorno: riferimento.giorno }),
    bottone('Settimana', 'settimana', { vista: 'agenda', settimana: riferimento.settimana, chi: 'tutti' }),
  );
}

function colonnaOre(quante, altezzaTotale) {
  const colonna = el('div', { class: 'colonna-ore', style: `height:${altezzaTotale}` });
  stato.config.fasce.forEach((ora, indice) => {
    if (!ora.endsWith(':00')) return;
    colonna.append(el('span', {
      class: 'ora', testo: ora, style: `top:calc(var(--riga) * ${indice})`,
    }));
  });
  return colonna;
}

/** Il blocco di un appuntamento dentro la griglia. */
function blocco(appuntamento, { conIniziale = false, compatto = false, onClick }) {
  const indice = stato.config.fasce.indexOf(appuntamento.ora);
  if (indice < 0) return null; // fascia fuori orario: non rappresentabile

  const classi = ['blocco'];
  if (appuntamento.urgente && !appuntamento.fatto) classi.push('urgente');
  if (appuntamento.fatto) classi.push('fatto');
  if (appuntamento.assegnatoA === null) classi.push('da-assegnare');
  if (compatto) classi.push('compattissimo');

  const colore = appuntamento.assegnatoA === null ? null : coloreDi(appuntamento.assegnatoA);

  return el('button', {
    type: 'button',
    class: classi.join(' '),
    style: `top:calc(var(--riga) * ${indice} + 2px)` +
           (colore && !conIniziale ? `;border-left:3px solid ${colore}` : ''),
    title: `${appuntamento.ora} · ${appuntamento.nomeCliente} · ${appuntamento.luogoImpianto}`,
    onclick: (e) => onClick(appuntamento, e.currentTarget),
  },
    el('span', { class: 'prima' },
      conIniziale && appuntamento.assegnatoA !== null
        ? el('span', {
            class: 'iniziale', style: `background:${colore}`,
            testo: iniziale(appuntamento.assegnatoNome),
          })
        : null,
      el('span', { class: 'quando-chi', testo: `${appuntamento.ora} ${appuntamento.nomeCliente}` }),
      appuntamento.fatto ? el('span', { class: 'segno-fatto', testo: 'Fatto' }) : null,
      appuntamento.urgente && !appuntamento.fatto
        ? el('span', { class: 'segno-urgente', testo: 'Urgente' }) : null,
    ),
    el('span', {
      class: 'seconda',
      testo: appuntamento.assegnatoA === null
        ? `Da assegnare · ${appuntamento.luogoImpianto}`
        : appuntamento.luogoImpianto,
    }),
  );
}

function strisciaDaAssegnare(elenco, giorno) {
  const senza = daAssegnare(elenco);
  if (senza.length === 0) return null;
  return el('div', { class: 'da-assegnare-striscia' },
    el('span', { class: 'titolo', testo: 'Da assegnare' }),
    senza.map((a) => el('button', {
      class: 'gettone', type: 'button',
      onclick: (e) => apriScheda(a.id, e.currentTarget),
    },
      el('span', { class: 'ora-piccola', testo: a.ora }),
      ` ${a.nomeCliente} · ${a.luogoImpianto}`,
    )),
  );
}

// ---------------------------------------------------------------------------
// Amministratore — vista Giorno, una colonna per installatore
// ---------------------------------------------------------------------------

function vistaGiornoAdmin(giorno) {
  const fasce = stato.config.fasce;
  const altezzaTotale = `calc(var(--riga) * ${fasce.length})`;
  const persone = installatori();
  const delGiorno = diQuelGiorno(stato.appuntamenti, giorno);

  const strumenti = el('div', { class: 'strumenti' },
    sceltaVista('giorno', { giorno, settimana: lunedi(giorno) }),
    el('button', {
      class: 'pulsante icona', type: 'button', icona: 'sinistra',
      'aria-label': 'Giorno precedente',
      onclick: () => vai({ vista: 'giorno', giorno: piuGiorni(giorno, -1) }),
    }),
    el('button', {
      class: 'pulsante icona', type: 'button', icona: 'destra',
      'aria-label': 'Giorno successivo',
      onclick: () => vai({ vista: 'giorno', giorno: piuGiorni(giorno, 1) }),
    }),
    el('button', {
      class: 'pulsante', type: 'button', testo: 'Oggi',
      onclick: () => vai({ vista: 'giorno', giorno: oggi() }),
    }),
    el('h1', { class: 'titolo-settimana', testo: maiuscola(dataEstesa(giorno)) }),
    el('div', { class: 'a-destra' },
      el('div', { class: 'legenda' },
        el('span', {}, el('i', { 'aria-hidden': 'true' }), 'Normale'),
        el('span', {}, el('i', { class: 'urgente', 'aria-hidden': 'true' }), 'Urgente'),
        el('span', {}, el('i', { class: 'concluso', 'aria-hidden': 'true' }), 'Fatto'),
      ),
      el('button', {
        class: 'pulsante primario', type: 'button', icona: 'piu',
        onclick: () => apriNuovo({ data: giorno }),
      }, 'Nuovo appuntamento'),
    ),
  );

  const intestazione = el('div', { class: 'intestazione' }, el('div', {}));
  const corpo = el('div', { class: 'corpo' }, colonnaOre(fasce.length, altezzaTotale));

  if (persone.length === 0) {
    return el('div', {}, barraSuperiore(), strumenti,
      el('p', { class: 'vuoto', style: 'margin:2rem 1.25rem' },
        'Non ci sono ancora installatori. Creane uno e comparirà qui la sua colonna.'));
  }

  for (const persona of persone) {
    const suoi = diQuellaPersona(delGiorno, persona.id);

    intestazione.append(el('div', { class: 'persona' },
      el('span', { class: 'pallino', style: `background:${coloreDi(persona.id)}` }),
      el('span', {},
        el('span', { class: 'nome', testo: persona.nome }),
        el('span', {
          class: 'quanti',
          testo: ` · ${suoi.length} ${suoi.length === 1 ? 'intervento' : 'interventi'}` +
                 (conclusi(suoi) > 0
                   ? ` (${conclusi(suoi)} ${conclusi(suoi) === 1 ? 'fatto' : 'fatti'})`
                   : ''),
        }),
        persona.notificheAttive === false
          ? el('span', { class: 'senza-notifiche', title: 'Non riceve notifiche su nessun dispositivo', testo: 'notifiche spente' })
          : null,
      ),
    ));

    const colonna = el('div', {
      class: `colonna-giorno${giorno === oggi() ? ' oggi' : ''}`,
      style: `height:${altezzaTotale}`,
    });
    for (const a of suoi) {
      colonna.append(blocco(a, { onClick: (app, nodo) => apriScheda(app.id, nodo) }));
    }
    corpo.append(colonna);
  }

  const agenda = el('div', {
    class: 'agenda per-persona', style: `--colonne:${persone.length}`,
  }, intestazione, corpo);

  return el('div', {}, barraSuperiore(), strumenti,
    strisciaDaAssegnare(delGiorno, giorno),
    el('div', { class: 'agenda-contenitore' }, agenda));
}

// ---------------------------------------------------------------------------
// Amministratore — vista Settimana, con i filtri
// ---------------------------------------------------------------------------

function vistaSettimanaAdmin(inizioSettimana, chi) {
  const fasce = stato.config.fasce;
  const altezzaTotale = `calc(var(--riga) * ${fasce.length})`;
  const persone = installatori();
  const adesso = oggi();

  // `chi` vale 'tutti', 'nessuno' (i da assegnare) o l'id di un installatore.
  const mostrate = chi === 'tutti' || !chi
    ? persone
    : persone.filter((u) => String(u.id) === String(chi));
  const soloDaAssegnare = chi === 'nessuno';
  const quanteDaAssegnare = daAssegnare(stato.appuntamenti).length;

  const filtro = (etichetta, valore, colore, contatore) => el('button', {
    class: 'filtro', type: 'button',
    'aria-pressed': String(chi ?? 'tutti') === valore ? 'true' : 'false',
    onclick: () => vai({ vista: 'agenda', settimana: inizioSettimana, chi: valore }),
  },
    colore ? el('span', { class: 'pallino', style: `background:${colore}` }) : null,
    etichetta,
    contatore ? el('strong', { testo: String(contatore) }) : null,
  );

  const strumenti = el('div', { class: 'strumenti' },
    sceltaVista('settimana', { giorno: giornoDaAprire(inizioSettimana), settimana: inizioSettimana }),
    el('button', {
      class: 'pulsante icona', type: 'button', icona: 'sinistra',
      'aria-label': 'Settimana precedente',
      onclick: () => vai({ vista: 'agenda', settimana: piuGiorni(inizioSettimana, -7), chi }),
    }),
    el('button', {
      class: 'pulsante icona', type: 'button', icona: 'destra',
      'aria-label': 'Settimana successiva',
      onclick: () => vai({ vista: 'agenda', settimana: piuGiorni(inizioSettimana, 7), chi }),
    }),
    el('button', {
      class: 'pulsante', type: 'button', testo: 'Oggi',
      onclick: () => vai({ vista: 'agenda', settimana: lunedi(oggi()), chi }),
    }),
    el('h1', { class: 'titolo-settimana', testo: intervalloSettimana(inizioSettimana) }),
    el('div', { class: 'a-destra' },
      el('div', { class: 'filtri' },
        el('span', { class: 'etichetta-filtro', testo: 'Mostra' }),
        filtro('Tutti', 'tutti'),
        persone.map((u) => filtro(u.nome, String(u.id), coloreDi(u.id))),
        quanteDaAssegnare > 0
          ? filtro('Da assegnare', 'nessuno', 'var(--bordo-campo)', quanteDaAssegnare)
          : null,
      ),
      el('button', {
        class: 'pulsante primario', type: 'button', icona: 'piu',
        onclick: () => apriNuovo({ data: giornoDaAprire(inizioSettimana) }),
      }, 'Nuovo appuntamento'),
    ),
  );

  const intestazione = el('div', { class: 'intestazione' }, el('div', {}));
  const corpo = el('div', { class: 'corpo' }, colonnaOre(fasce.length, altezzaTotale));

  for (let i = 0; i < 6; i += 1) {
    const giorno = piuGiorni(inizioSettimana, i);
    const d = aUTC(giorno);
    intestazione.append(el('div', { class: giorno === adesso ? 'oggi' : null },
      el('span', { class: 'sigla', testo: SIGLE[i] }),
      el('span', { class: 'numero', testo: String(d.getUTCDate()) }),
    ));

    const colonna = el('div', {
      class: `colonna-giorno${giorno === adesso ? ' oggi' : ''}`,
      style: `height:${altezzaTotale}`,
    });
    const delGiorno = diQuelGiorno(stato.appuntamenti, giorno);

    if (!soloDaAssegnare) {
      // Ogni installatore ha la sua metà di colonna. Con un filtro attivo la
      // persona mostrata è una sola e si prende tutta la larghezza.
      mostrate.forEach((persona, indice) => {
        const meta = el('div', { class: 'meta' });
        if (mostrate.length > 1) {
          meta.style.left = `${(indice / mostrate.length) * 100}%`;
          meta.style.right = `${(1 - (indice + 1) / mostrate.length) * 100}%`;
        }
        for (const a of diQuellaPersona(delGiorno, persona.id)) {
          meta.append(blocco(a, {
            conIniziale: mostrate.length > 1,
            compatto: true,
            onClick: (app, nodo) => apriScheda(app.id, nodo),
          }));
        }
        colonna.append(meta);
      });
    }

    // I lavori ancora da assegnare attraversano tutta la colonna: devono
    // saltare all'occhio, non nascondersi in una metà.
    if (chi === 'tutti' || !chi || soloDaAssegnare) {
      for (const a of daAssegnare(delGiorno)) {
        colonna.append(blocco(a, {
          compatto: true,
          onClick: (app, nodo) => apriScheda(app.id, nodo),
        }));
      }
    }
    corpo.append(colonna);
  }

  const agenda = el('div', { class: 'agenda', style: '--colonne:6' }, intestazione, corpo);
  return el('div', {}, barraSuperiore(), strumenti,
    el('div', { class: 'agenda-contenitore' }, agenda));
}

/**
 * Passando da "Settimana" a "Giorno": se oggi cade nella settimana mostrata si
 * apre su oggi, altrimenti sul lunedì di quella settimana.
 */
function giornoDaAprire(inizioSettimana) {
  const adesso = oggi();
  return adesso >= inizioSettimana && adesso <= piuGiorni(inizioSettimana, 5) ? adesso : inizioSettimana;
}

// ---------------------------------------------------------------------------
// Pannello laterale
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
  const campo = (nome, etichetta, dentro) =>
    el('label', { class: 'campo', 'data-campo': nome },
      el('span', { class: 'etichetta', testo: etichetta }), dentro);

  const opzioniOra = stato.config.fasce.map((ora) =>
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

    // Solo Tiziana sceglie a chi va il lavoro. L'installatore che si carica un
    // intervento da solo lo prende per sé, e il campo non gli compare.
    eAdmin()
      ? campo('assegnatoA', 'Assegnato a',
          el('select', { name: 'assegnatoA' },
            el('option', { value: '', selected: !valori.assegnatoA, testo: 'Da assegnare' }),
            installatori().map((u) => el('option', {
              value: String(u.id),
              selected: valori.assegnatoA === u.id,
              testo: u.nome,
            })),
          ))
      : null,

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

function leggiScheda(modulo) {
  const dati = {
    nomeCliente: modulo.elements.nomeCliente.value,
    luogoImpianto: modulo.elements.luogoImpianto.value,
    telefonoCliente: modulo.elements.telefonoCliente.value,
    prezzoConcordato: modulo.elements.prezzoConcordato.value,
    data: modulo.elements.data.value,
    ora: modulo.elements.ora.value,
    note: modulo.elements.note.value,
    urgente: modulo.elements.urgente.checked,
  };
  if (modulo.elements.assegnatoA) {
    dati.assegnatoA = modulo.elements.assegnatoA.value || null;
  }
  return dati;
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

function apriNuovo(preimpostati = {}) {
  const avviso = el('p', { class: 'avviso', role: 'alert', hidden: true });
  const modulo = el('form', { novalidate: true, id: 'modulo-nuovo' },
    avviso, campiScheda({ data: preimpostati.data ?? oggi(), ...preimpostati }));

  const annulla = el('button', { class: 'pulsante', type: 'button', testo: 'Annulla' });
  const salva = el('button', {
    class: 'pulsante primario', type: 'submit', form: 'modulo-nuovo', testo: 'Salva appuntamento',
  });

  const { chiudi } = pannello(
    eAdmin() ? 'Nuovo appuntamento' : 'Nuovo intervento mio',
    modulo,
    el('div', { class: 'piede' }, annulla, salva),
  );
  annulla.addEventListener('click', () => chiudi());

  modulo.addEventListener('submit', async (e) => {
    e.preventDefault();
    salva.disabled = true;
    salva.textContent = 'Salvataggio…';
    try {
      await api('/appuntamenti', { metodo: 'POST', corpo: leggiScheda(modulo) });
      chiudi();
      await disegna();
    } catch (errore) {
      mostraErrori(modulo, errore, avviso);
      salva.disabled = false;
      salva.textContent = 'Salva appuntamento';
    }
  });

  modulo.elements.nomeCliente.focus();
}

// ---------------------------------------------------------------------------
// Scheda di un appuntamento (amministratore e installatore da agenda)
// ---------------------------------------------------------------------------

async function apriScheda(id, nodo) {
  nodo?.classList.add('scelto');

  let appuntamento;
  try {
    ({ appuntamento } = await api(`/appuntamenti/${id}`));
  } catch (e) {
    nodo?.classList.remove('scelto');
    avvisoVolante(e.message);
    return;
  }

  const mio = appuntamento.assegnatoA === stato.utente.id;
  const posso = eAdmin() || mio;
  const avviso = el('p', { class: 'avviso', role: 'alert', hidden: true });

  // Cambiare l'assegnatario dal menu non chiude il pannello, ma l'agenda
  // dietro è già diversa. Ridisegnarla subito farebbe sparire il pannello da
  // sotto le mani: si tiene il segno e si ridisegna alla chiusura.
  const modificato = { valore: false };

  const riga = (etichetta, valore) => el('div', {},
    el('dt', { testo: etichetta }), el('dd', {}, valore));

  const moduloRimanda = posso ? el('form', { novalidate: true, class: 'riquadro-rimanda', id: 'modulo-rimanda' },
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
  ) : null;

  const contenuto = el('div', {},
    avviso,
    el('div', { class: 'scheda-nome', testo: appuntamento.nomeCliente }),
    el('p', { style: 'margin:.35rem 0 0;display:flex;gap:.4rem;flex-wrap:wrap' },
      appuntamento.fatto
        ? el('span', { class: 'etichetta-fatto', testo: `Fatto alle ${appuntamento.fattoAlle}` }) : null,
      appuntamento.urgente ? el('span', { class: 'etichetta-urgente', testo: 'Urgente' }) : null,
    ),
    el('p', { class: 'scheda-quando', testo: `${maiuscola(dataEstesa(appuntamento.data))} · ore ${appuntamento.ora}` }),
    el('dl', { class: 'righe' },
      riga('Assegnato a', assegnazione(appuntamento, posso, avviso, modificato)),
      riga('Luogo impianto', el('span', {},
        appuntamento.luogoImpianto, ' ',
        el('a', { href: appuntamento.mappa, rel: 'noopener', target: '_blank', class: 'come-link', testo: 'apri in mappa' }),
      )),
      riga('Telefono cliente', el('a', { href: `tel:${appuntamento.telefonoPerChiamata}`, testo: appuntamento.telefonoCliente })),
      riga('Prezzo concordato', `€ ${appuntamento.prezzoConcordato}`),
      riga('Note', appuntamento.note || '—'),
    ),
    posso ? el('button', {
      class: `pulsante ${appuntamento.fatto ? '' : 'conferma'}`,
      type: 'button', style: 'width:100%;margin-bottom:1.25rem',
      icona: appuntamento.fatto ? null : 'spunta',
      testo: appuntamento.fatto ? 'Riapri: non è stato fatto' : 'Segna come fatto',
      onclick: async (e) => {
        e.currentTarget.disabled = true;
        try {
          await api(`/appuntamenti/${id}/fatto`, { metodo: 'POST', corpo: { fatto: !appuntamento.fatto } });
          chiudi();
          await disegna();
        } catch (err) {
          avviso.textContent = err.message;
          avviso.hidden = false;
          e.currentTarget.disabled = false;
        }
      },
    }) : null,
    moduloRimanda,
    posso && eAdmin() ? el('div', { style: 'margin-top:1.25rem' },
      el('button', {
        class: 'pulsante', type: 'button', style: 'width:100%',
        testo: 'Modifica scheda',
        onclick: () => { chiudi(); apriModifica(appuntamento); },
      }),
    ) : null,
  );

  const { chiudi, finestra } = pannello('Scheda appuntamento', contenuto,
    el('div', { class: 'piede sparso' },
      posso ? el('button', {
        class: 'pulsante pericolo', type: 'button', testo: 'Annulla appuntamento',
        onclick: () => chiediConferma(appuntamento, async () => { chiudi(); await disegna(); }),
      }) : el('span', { class: 'aiuto', testo: 'Assegnato a un collega: puoi solo consultarlo.' }),
      el('button', { class: 'pulsante', type: 'button', testo: 'Chiudi', onclick: () => chiudi() }),
    ));

  finestra.addEventListener('close', () => {
    nodo?.classList.remove('scelto');
    if (modificato.valore) disegna();
  });

  moduloRimanda?.addEventListener('submit', async (e) => {
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
      await disegna();
    } catch (errore) {
      mostraErrori(moduloRimanda, errore, avviso);
      bottone.disabled = false;
      bottone.textContent = 'Conferma nuova data e ora';
    }
  });
}

/** La riga "Assegnato a": un menu se si può cambiare, altrimenti il nome. */
function assegnazione(appuntamento, posso, avviso, modificato = { valore: false }) {
  if (!posso) {
    return appuntamento.assegnatoNome ?? 'Da assegnare';
  }
  const scelta = el('select', { class: 'scelta-persona' },
    el('option', { value: '', selected: !appuntamento.assegnatoA, testo: 'Da assegnare' }),
    installatori().map((u) => el('option', {
      value: String(u.id),
      selected: appuntamento.assegnatoA === u.id,
      testo: u.id === stato.utente.id ? `${u.nome} (io)` : u.nome,
    })),
  );
  scelta.addEventListener('change', async () => {
    scelta.disabled = true;
    try {
      await api(`/appuntamenti/${appuntamento.id}/assegna`, {
        metodo: 'PATCH',
        corpo: { assegnatoA: scelta.value || null },
      });
      appuntamento.assegnatoA = scelta.value ? Number(scelta.value) : null;
      avviso.hidden = true;
      modificato.valore = true;
    } catch (e) {
      avviso.textContent = e.message;
      avviso.hidden = false;
      scelta.value = appuntamento.assegnatoA ? String(appuntamento.assegnatoA) : '';
    } finally {
      scelta.disabled = false;
    }
  });
  return scelta;
}

function apriModifica(appuntamento) {
  const avviso = el('p', { class: 'avviso', role: 'alert', hidden: true });
  const modulo = el('form', { novalidate: true, id: 'modulo-modifica' },
    avviso, campiScheda(appuntamento));

  const annulla = el('button', { class: 'pulsante', type: 'button', testo: 'Annulla' });
  const salva = el('button', {
    class: 'pulsante primario', type: 'submit', form: 'modulo-modifica', testo: 'Salva modifiche',
  });

  const { chiudi } = pannello('Modifica scheda', modulo,
    el('div', { class: 'piede' }, annulla, salva));

  annulla.addEventListener('click', () => { chiudi(); apriScheda(appuntamento.id); });

  modulo.addEventListener('submit', async (e) => {
    e.preventDefault();
    salva.disabled = true;
    salva.textContent = 'Salvataggio…';
    try {
      await api(`/appuntamenti/${appuntamento.id}`, { metodo: 'PATCH', corpo: leggiScheda(modulo) });
      chiudi();
      await disegna();
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
  return el('nav', { class: 'schede tre', 'aria-label': 'Cambia vista' },
    link('Giorno', 'giorno', { vista: 'giorno', giorno }),
    link('Settimana', 'settimana', { vista: 'settimana', settimana }),
    link('Tutti', 'tutti', { vista: 'tutti', giorno }),
  );
}

function conteggio(elenco) {
  const daFare = elenco.filter((a) => !a.fatto);
  const urgenti = daFare.filter((a) => a.urgente).length;
  const conclusi = elenco.length - daFare.length;
  const parti = [`${elenco.length} ${elenco.length === 1 ? 'intervento' : 'interventi'}`];
  if (urgenti > 0) parti.push(`${urgenti} ${urgenti === 1 ? 'urgente' : 'urgenti'}`);
  if (conclusi > 0) parti.push(`${conclusi} ${conclusi === 1 ? 'fatto' : 'fatti'}`);
  return parti.join(' · ');
}

function voceAppuntamento(appuntamento, { compatta = false, conPersona = false } = {}) {
  return el('li', {
    class: `voce${compatta ? ' compatta' : ''}` +
           `${appuntamento.urgente && !appuntamento.fatto ? ' urgente' : ''}` +
           `${appuntamento.fatto ? ' conclusa' : ''}`,
  },
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
      conPersona
        ? el('span', { class: 'di-chi' },
            el('span', { class: 'pallino', style: `background:${coloreDi(appuntamento.assegnatoA)}` }),
            appuntamento.assegnatoNome ?? 'Da assegnare')
        : null,
      appuntamento.urgente && !appuntamento.fatto
        ? el('span', { class: 'etichetta-urgente', testo: 'Urgente' }) : null,
      appuntamento.fatto
        ? el('span', { class: 'segno-concluso' },
            el('span', { icona: 'spunta', 'aria-hidden': 'true' }),
            `Fatto alle ${appuntamento.fattoAlle}`)
        : null,
    ),
  );
}

function elencoConFatti(elenco, { conPersona = false } = {}) {
  const daFare = elenco.filter((a) => !a.fatto);
  const conclusi = elenco.filter((a) => a.fatto);
  return el('div', {},
    daFare.length === 0 && conclusi.length === 0
      ? el('p', { class: 'vuoto', testo: 'Nessun appuntamento' })
      : null,
    daFare.length > 0
      ? el('ul', { class: 'elenco' }, daFare.map((a) => voceAppuntamento(a, { conPersona })))
      : null,
    conclusi.length > 0
      ? el('div', {},
          el('p', { class: 'conclusi-titolo', testo: 'Già fatti' }),
          el('ul', { class: 'elenco' }, conclusi.map((a) => voceAppuntamento(a, { conPersona }))))
      : null,
  );
}

function navigazione(titolo, sotto, indietro, avanti) {
  return el('div', { class: 'navigazione-giorno' },
    el('button', { class: 'pulsante icona', type: 'button', icona: 'sinistra', 'aria-label': 'Precedente', onclick: indietro }),
    el('div', { class: 'testo' },
      el('h1', { testo: titolo }),
      el('div', { class: 'sotto', testo: sotto }),
    ),
    el('button', { class: 'pulsante icona', type: 'button', icona: 'destra', 'aria-label': 'Successivo', onclick: avanti }),
  );
}

function vistaGiornoInstallatore(giorno) {
  const miei = diQuellaPersona(diQuelGiorno(stato.appuntamenti, giorno), stato.utente.id);
  const sotto = [giorno === oggi() ? 'Oggi' : null, conteggio(miei)].filter(Boolean).join(' · ');

  return el('div', { class: 'app-installatore' },
    testaInstallatore(),
    schedeVista('giorno', { giorno, settimana: lunedi(giorno) }),
    navigazione(
      maiuscola(dataEstesa(giorno, { conAnno: false })), sotto,
      () => vai({ vista: 'giorno', giorno: piuGiorni(giorno, -1) }),
      () => vai({ vista: 'giorno', giorno: piuGiorni(giorno, 1) }),
    ),
    el('button', {
      class: 'nuovo-mio', type: 'button', icona: 'piu',
      onclick: () => apriNuovo({ data: giorno }),
    }, 'Aggiungi un intervento mio'),
    elencoConFatti(miei),
    rigaNotifiche(),
  );
}

function vistaSettimanaInstallatore(inizioSettimana) {
  const miei = diQuellaPersona(stato.appuntamenti, stato.utente.id);
  const gruppi = [];

  for (let i = 0; i < 6; i += 1) {
    const giorno = piuGiorni(inizioSettimana, i);
    const d = aUTC(giorno);
    const suoi = diQuelGiorno(miei, giorno);
    gruppi.push(el('section', { class: 'giorno-gruppo' },
      el('h2', {},
        `${maiuscola(GIORNI[i])} ${d.getUTCDate()}`,
        giorno === oggi() ? el('span', { class: 'oggi-segno', testo: 'Oggi' }) : null,
      ),
      suoi.length === 0
        ? el('p', { class: 'vuoto', testo: 'Nessun appuntamento' })
        : el('ul', { class: 'elenco' }, suoi.map((a) => voceAppuntamento(a, { compatta: true }))),
    ));
  }

  return el('div', { class: 'app-installatore' },
    testaInstallatore(),
    schedeVista('settimana', { giorno: giornoDaAprire(inizioSettimana), settimana: inizioSettimana }),
    navigazione(
      intervalloSettimana(inizioSettimana), conteggio(miei),
      () => vai({ vista: 'settimana', settimana: piuGiorni(inizioSettimana, -7) }),
      () => vai({ vista: 'settimana', settimana: piuGiorni(inizioSettimana, 7) }),
    ),
    gruppi,
  );
}

/** La giornata di tutti: serve a sapere dove sta il collega. */
function vistaTutti(giorno) {
  const delGiorno = diQuelGiorno(stato.appuntamenti, giorno);
  const sezioni = installatori().map((persona) => el('section', { class: 'giorno-gruppo' },
    el('h2', {},
      el('span', { class: 'pallino', style: `background:${coloreDi(persona.id)}` }),
      persona.nome,
      persona.id === stato.utente.id ? el('span', { class: 'oggi-segno', testo: 'Io' }) : null,
    ),
    elencoConFatti(diQuellaPersona(delGiorno, persona.id)),
  ));

  const senza = daAssegnare(delGiorno);
  if (senza.length > 0) {
    sezioni.push(el('section', { class: 'giorno-gruppo' },
      el('h2', {},
        el('span', { class: 'pallino', style: 'background:var(--bordo-campo)' }),
        'Da assegnare'),
      el('ul', { class: 'elenco' }, senza.map((a) => voceAppuntamento(a, { compatta: true }))),
    ));
  }

  return el('div', { class: 'app-installatore' },
    testaInstallatore(),
    schedeVista('tutti', { giorno, settimana: lunedi(giorno) }),
    navigazione(
      maiuscola(dataEstesa(giorno, { conAnno: false })),
      giorno === oggi() ? `Oggi · ${conteggio(delGiorno)}` : conteggio(delGiorno),
      () => vai({ vista: 'tutti', giorno: piuGiorni(giorno, -1) }),
      () => vai({ vista: 'tutti', giorno: piuGiorni(giorno, 1) }),
    ),
    sezioni,
  );
}

function vistaDettaglio(appuntamento) {
  const mio = appuntamento.assegnatoA === stato.utente.id;
  const posso = eAdmin() || mio;

  const riquadro = (titoletto, valore, grande = false) => el('div', { class: 'riquadro' },
    el('div', { class: 'titoletto', testo: titoletto }),
    el('div', { class: `valore${grande ? ' grande' : ''}` }, valore),
  );

  const azione = async (chiamata, bottone, inCorso, dove = null) => {
    bottone.disabled = true;
    const prima = bottone.textContent;
    bottone.textContent = inCorso;
    try {
      await chiamata();
      if (dove) vai(dove, { sostituisci: true });
      else await disegna();
    } catch (e) {
      avvisoVolante(e.message);
      bottone.disabled = false;
      bottone.textContent = prima;
    }
  };

  const segnaFatto = el('button', {
    class: appuntamento.fatto ? 'pulsante' : 'fatto-grande',
    type: 'button',
    icona: appuntamento.fatto ? null : 'spunta',
    style: appuntamento.fatto ? 'width:100%;min-height:50px' : null,
  }, appuntamento.fatto ? 'Riapri: non è stato fatto' : 'Segna come fatto');

  // Segnato il lavoro come fatto, l'installatore ha finito lì: lo riportiamo
  // alla giornata, dove trova il prossimo. Riaprendolo invece resta sulla
  // scheda, perché vuol dire che sta ancora lavorando su quella.
  segnaFatto.addEventListener('click', () => azione(
    () => api(`/appuntamenti/${appuntamento.id}/fatto`, { metodo: 'POST', corpo: { fatto: !appuntamento.fatto } }),
    segnaFatto, appuntamento.fatto ? 'Riapro…' : 'Segno…',
    appuntamento.fatto ? null : { vista: 'giorno', giorno: appuntamento.data },
  ));

  const colleghi = installatori().filter((u) => u.id !== appuntamento.assegnatoA);
  const passa = colleghi.length === 1
    ? el('button', { class: 'pulsante', type: 'button', testo: `Passa a ${colleghi[0].nome}` })
    : null;
  // Passato il lavoro, non è più suo: la scheda non gli serve più.
  passa?.addEventListener('click', () => azione(
    () => api(`/appuntamenti/${appuntamento.id}/assegna`, {
      metodo: 'PATCH', corpo: { assegnatoA: colleghi[0].id },
    }),
    passa, 'Passo…',
    { vista: 'giorno', giorno: appuntamento.data },
  ));

  const sceltaPassa = colleghi.length > 1 ? el('select', { class: 'scelta-persona' },
    el('option', { value: '', testo: 'Passa a…' }),
    colleghi.map((u) => el('option', { value: String(u.id), testo: u.nome })),
  ) : null;
  sceltaPassa?.addEventListener('change', async () => {
    if (!sceltaPassa.value) return;
    sceltaPassa.disabled = true;
    try {
      await api(`/appuntamenti/${appuntamento.id}/assegna`, {
        metodo: 'PATCH', corpo: { assegnatoA: Number(sceltaPassa.value) },
      });
      await disegna();
    } catch (e) {
      avvisoVolante(e.message);
      sceltaPassa.disabled = false;
      sceltaPassa.value = '';
    }
  });

  return el('div', { class: 'app-installatore' },
    testaInstallatore(),
    el('div', { class: 'barra-indietro' },
      el('button', {
        class: 'pulsante', type: 'button', icona: 'sinistra',
        onclick: () => (history.length > 1 ? history.back() : vai({ vista: 'giorno', giorno: appuntamento.data })),
      }, 'Indietro'),
    ),
    el('div', { class: 'dettaglio' },
      el('div', { style: 'display:flex;gap:.4rem;flex-wrap:wrap' },
        appuntamento.fatto
          ? el('span', { class: 'etichetta-fatto', testo: `Fatto alle ${appuntamento.fattoAlle}` }) : null,
        appuntamento.urgente && !appuntamento.fatto
          ? el('span', { class: 'etichetta-urgente', testo: 'Urgente' }) : null,
        !mio && appuntamento.assegnatoNome
          ? el('span', { class: 'di-chi' },
              el('span', { class: 'pallino', style: `background:${coloreDi(appuntamento.assegnatoA)}` }),
              appuntamento.assegnatoNome)
          : null,
      ),
      el('h1', { class: 'nome-grande', testo: appuntamento.nomeCliente }),

      posso ? segnaFatto : null,

      riquadro('Data e ora', `${maiuscola(dataEstesa(appuntamento.data))} · ore ${appuntamento.ora}`, true),
      riquadro('Luogo impianto', appuntamento.luogoImpianto),

      el('a', { class: 'chiama', href: `tel:${appuntamento.telefonoPerChiamata}` },
        el('span', { icona: 'telefono', 'aria-hidden': 'true' }),
        el('span', {},
          el('span', { class: 'sopra', testo: 'Telefono cliente · tocca per chiamare' }),
          appuntamento.telefonoCliente,
        ),
      ),

      el('a', { class: 'mappa', href: appuntamento.mappa, rel: 'noopener', target: '_blank' },
        el('span', { icona: 'posizione', 'aria-hidden': 'true' }), 'Apri in mappa'),

      riquadro('Prezzo concordato', `€ ${appuntamento.prezzoConcordato}`, true),
      riquadro('Note', appuntamento.note || '—'),

      posso ? el('div', { class: 'separa' }) : null,
      posso ? el('div', { class: 'riga-azioni' },
        el('button', {
          class: 'pulsante', type: 'button', testo: 'Rimanda',
          onclick: () => apriScheda(appuntamento.id),
        }),
        passa ?? sceltaPassa ?? el('span'),
      ) : null,
      posso ? el('button', {
        class: 'pulsante pericolo', type: 'button', style: 'width:100%',
        testo: 'Annulla intervento',
        onclick: () => chiediConferma(appuntamento, async () => {
          vai({ vista: 'giorno', giorno: appuntamento.data }, { sostituisci: true });
        }),
      }) : null,
      !posso ? el('p', { class: 'aiuto', testo: 'Questo intervento è di un collega: puoi consultarlo ma non modificarlo.' }) : null,
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
  if (!stato.config?.chiavePush) return null;

  // Su iPhone le notifiche web arrivano solo se il sito è stato aggiunto alla
  // schermata Home: è un vincolo di Apple, non c'è modo di aggirarlo.
  if (suIOS() && !installataSuHome()) {
    return el('div', { class: 'riga-notifiche da-sistemare' },
      el('span', { icona: 'campana', 'aria-hidden': 'true' }),
      el('div', { class: 'testo' },
        'Le notifiche non sono attive',
        el('span', {
          class: 'stato',
          testo: 'Su iPhone: tocca Condividi, poi «Aggiungi a Home». Riapri il pannello da lì e torna qui.',
        }),
      ),
    );
  }

  if (!supportaPush()) return null;

  const contenitore = el('div', { class: 'riga-notifiche' });
  const stampa = el('span', { class: 'stato', testo: 'Controllo…' });
  const bottone = el('button', { class: 'pulsante', type: 'button', testo: 'Attiva' });

  // L'iscrizione può morire in silenzio — dati del browser ripuliti, app
  // disinstallata, pulizia del sistema. È il punto debole delle push: il
  // guasto va reso visibile, non lasciato scoprire con un intervento saltato.
  const aggiorna = async () => {
    if (Notification.permission === 'denied') {
      contenitore.classList.add('da-sistemare');
      stampa.textContent = 'Bloccate nelle impostazioni del browser.';
      bottone.hidden = true;
      return;
    }
    const registrazione = await navigator.serviceWorker.getRegistration();
    const iscrizione = await registrazione?.pushManager.getSubscription();
    if (iscrizione) {
      contenitore.classList.remove('da-sistemare');
      stampa.textContent = 'Attive su questo dispositivo.';
      bottone.textContent = 'Disattiva';
    } else {
      contenitore.classList.add('da-sistemare');
      stampa.textContent = 'Non riceverai avvisi per i nuovi interventi.';
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
        // Prima si avvisa il server, poi si disiscrive il dispositivo: se la
        // chiamata fallisce, l'eccezione ferma tutto e l'iscrizione resta
        // valida da entrambe le parti. Al contrario resterebbe una riga
        // fantasma nel database, e Tiziana continuerebbe a vedere le
        // notifiche come attive.
        await api('/push/disiscrizione', { metodo: 'POST', corpo: { endpoint: esistente.endpoint } });
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
        await api('/push/iscrizione', {
          metodo: 'POST',
          corpo: { endpoint: iscrizione.endpoint, chiavi: iscrizione.toJSON().keys },
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

  contenitore.append(
    el('span', { icona: 'campana', 'aria-hidden': 'true' }),
    el('div', { class: 'testo' }, 'Notifiche', stampa),
    bottone,
  );
  return contenitore;
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

/** Limiti dell'altezza di una fascia. */
const FASCIA_MINIMA = 24;
const FASCIA_MASSIMA = 40;
/** Sotto questa altezza nel blocco ci sta una riga sola. */
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
  const disponibile = window.innerHeight - cima - 20;

  const riga = Math.max(
    FASCIA_MINIMA,
    Math.min(FASCIA_MASSIMA, Math.floor(disponibile / quante)),
  );
  agenda.style.setProperty('--riga', `${riga}px`);
  agenda.classList.toggle('compatta', riga < FASCIA_A_UNA_RIGA);
}

function sostituisci(contenuto) {
  radice.replaceChildren(contenuto);
  radice.classList.remove('avvio');
  adattaAgenda();
}

/**
 * Segnale di attesa mentre si caricano i dati.
 *
 * NON si svuota la pagina: cambiando vista si resterebbe due secondi davanti a
 * uno schermo bianco, che su rete mobile è il tempo che ci mette il database a
 * svegliarsi. La vista attuale resta dov'è e compare solo una barra sottile in
 * cima, finché il contenuto nuovo non è pronto a prenderne il posto.
 */
let barraAttesa = null;
function mostraCaricamento(acceso) {
  if (acceso) {
    if (barraAttesa) return;
    barraAttesa = el('div', { class: 'barra-caricamento', role: 'progressbar', 'aria-label': 'Caricamento' });
    document.body.append(barraAttesa);
    radice.setAttribute('aria-busy', 'true');
  } else {
    barraAttesa?.remove();
    barraAttesa = null;
    radice.removeAttribute('aria-busy');
  }
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

  if (!r.vista) {
    vai(rottaPredefinita(), { sostituisci: true });
    return;
  }
  // Solo Tiziana ha l'agenda settimanale a colonne.
  if (r.vista === 'agenda' && !eAdmin()) {
    vai({ vista: 'settimana', settimana: lunedi(r.settimana ?? oggi()) }, { sostituisci: true });
    return;
  }

  // Solo al primissimo ingresso non c'è ancora niente da mostrare: da lì in
  // poi si tiene la vista precedente e si accende la barra.
  if (radice.classList.contains('avvio')) sostituisci(schermataStato('Caricamento…'));
  else mostraCaricamento(true);

  try {
    // L'elenco degli utenti si richiede a OGNI disegno, non solo la prima
    // volta: contiene anche se ciascun installatore ha le notifiche attive,
    // e tenendolo in cache quell'informazione restava vecchia finché Tiziana
    // non ricaricava la pagina. Parte in parallelo con gli appuntamenti,
    // quindi non aggiunge attesa: sono tre righe di tabella.
    const utentiPronti = caricaUtenti();

    if (r.vista === 'dettaglio') {
      const [{ appuntamento }] = await Promise.all([
        api(`/appuntamenti/${Number(r.id)}`), utentiPronti,
      ]);
      if (mio !== stato.disegnoCorrente) return;
      sostituisci(vistaDettaglio(appuntamento));
      return;
    }

    if (r.vista === 'giorno' || r.vista === 'tutti') {
      const giorno = r.giorno ?? oggi();
      const [appuntamenti] = await Promise.all([
        caricaIntervallo(giorno, giorno), utentiPronti,
      ]);
      stato.appuntamenti = appuntamenti;
      if (mio !== stato.disegnoCorrente) return;
      if (r.vista === 'tutti') sostituisci(vistaTutti(giorno));
      else sostituisci(eAdmin() ? vistaGiornoAdmin(giorno) : vistaGiornoInstallatore(giorno));
      return;
    }

    const inizio = lunedi(r.settimana ?? oggi());
    const [appuntamenti] = await Promise.all([
      caricaIntervallo(inizio, piuGiorni(inizio, 5)), utentiPronti,
    ]);
    stato.appuntamenti = appuntamenti;
    if (mio !== stato.disegnoCorrente) return;
    sostituisci(r.vista === 'agenda'
      ? vistaSettimanaAdmin(inizio, r.chi ?? 'tutti')
      : vistaSettimanaInstallatore(inizio));
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
  } finally {
    // Anche se il disegno è stato superato da uno più recente: la barra la
    // spegne comunque chi l'ha accesa, altrimenti resterebbe lì per sempre.
    if (mio === stato.disegnoCorrente) mostraCaricamento(false);
  }
}

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
