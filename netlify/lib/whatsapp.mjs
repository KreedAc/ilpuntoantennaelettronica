// Conferma dell'appuntamento su WhatsApp.
//
// Un messaggio solo, quando Tiziana fissa un intervento: «le confermiamo
// l'appuntamento di giovedì alle 10». Nessun promemoria, nessun altro invio.
//
// Passa dall'API ufficiale di WhatsApp (Cloud API di Meta). Strumenti che
// comandano WhatsApp Web da soli sono contro le regole, e il rischio è che
// blocchino il numero del negozio: qui non se ne usano.
//
// Un messaggio che parte dall'azienda verso il cliente deve usare un MODELLO
// approvato da Meta, con il testo fisso e i dati come variabili. Il testo da
// sottoporre è nel README, sezione "Conferma su WhatsApp".
//
// Finché su Netlify mancano le variabili d'ambiente qui sotto, tutto è spento:
// il pannello non mostra la casella e non parte niente. È lo stesso schema
// delle notifiche push.
//
//   WHATSAPP_TOKEN        token di sistema permanente (Meta Business)
//   WHATSAPP_NUMERO_ID    "Phone number ID" del numero che invia
//   WHATSAPP_MODELLO      nome del modello approvato (predefinito: conferma_appuntamento)
//   WHATSAPP_LINGUA       lingua del modello (predefinita: it)
//   WHATSAPP_VERSIONE     versione dell'API di Meta (predefinita: v23.0)

import { dataEstesa } from './calendario.mjs';
import { telefonoPerChiamata } from './validazione.mjs';

const configurazione = () => ({
  token: process.env.WHATSAPP_TOKEN || null,
  numeroId: process.env.WHATSAPP_NUMERO_ID || null,
  modello: process.env.WHATSAPP_MODELLO || 'conferma_appuntamento',
  lingua: process.env.WHATSAPP_LINGUA || 'it',
  versione: process.env.WHATSAPP_VERSIONE || 'v23.0',
});

/** La conferma è configurata? Senza token e numero non si prova nemmeno. */
export function whatsappAttivo() {
  const c = configurazione();
  return Boolean(c.token && c.numeroId);
}

/**
 * Il numero nella forma che vuole WhatsApp: solo cifre, con il prefisso del
 * paese e senza il «+». Restituisce null se non è un cellulare.
 *
 * In Italia i cellulari cominciano per 3: un fisso (0968…) su WhatsApp non
 * c'è, e mandargli un messaggio vorrebbe solo dire un errore. I numeri esteri
 * si lasciano passare: non sappiamo distinguerli, e decide WhatsApp.
 */
export function numeroWhatsApp(telefono) {
  const n = telefonoPerChiamata(telefono).replace(/^\+/, '');
  if (!/^\d{8,15}$/.test(n)) return null;
  if (n.startsWith('39')) return /^393\d{8,9}$/.test(n) ? n : null;
  return n;
}

/**
 * Le variabili del modello, nell'ordine in cui compaiono nel testo:
 *   {{1}} nome · {{2}} giorno · {{3}} ora · {{4}} indirizzo
 * Il tecnico non c'è apposta: quando Tiziana fissa l'appuntamento spesso non
 * è ancora assegnato, e una conferma con un nome sbagliato è peggio di niente.
 */
export function variabiliConferma({ nome_cliente, data, ora, luogo_impianto }) {
  return [nome_cliente, dataEstesa(data, { conAnno: false }), ora, luogo_impianto]
    .map((testo) => ({ type: 'text', text: String(testo) }));
}

/**
 * Manda la conferma. Non solleva mai: un problema con WhatsApp non deve far
 * fallire il salvataggio dell'appuntamento, che è già nel database. Dice
 * com'è andata, così il pannello lo mostra e Tiziana, se serve, scrive a mano.
 *
 * «Inviata» vuol dire che Meta ha accettato il messaggio. Se poi il numero
 * non ha WhatsApp lo si sa solo più tardi: Meta lo comunica a parte, e qui
 * non lo ascoltiamo.
 */
export async function mandaConferma(appuntamento) {
  const c = configurazione();
  if (!c.token || !c.numeroId) return { inviata: false, motivo: 'WhatsApp non è configurato' };

  const a = numeroWhatsApp(appuntamento.telefono_cliente);
  if (!a) return { inviata: false, motivo: 'il numero non è un cellulare' };

  try {
    const r = await fetch(`https://graph.facebook.com/${c.versione}/${c.numeroId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: a,
        type: 'template',
        template: {
          name: c.modello,
          language: { code: c.lingua },
          components: [{ type: 'body', parameters: variabiliConferma(appuntamento) }],
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) return { inviata: true };
    const dati = await r.json().catch(() => null);
    // Nel log il codice d'errore di Meta, mai il numero o il nome del cliente.
    console.warn('WhatsApp: conferma rifiutata', r.status, dati?.error?.code ?? '');
    return { inviata: false, motivo: spiegaErrore(dati?.error?.code) };
  } catch (e) {
    console.warn('WhatsApp: conferma non partita', e?.name ?? '');
    return { inviata: false, motivo: 'WhatsApp non ha risposto in tempo' };
  }
}

/** I codici di Meta che possono capitare davvero, detti in italiano. */
export function spiegaErrore(codice) {
  switch (Number(codice)) {
    case 131030: return 'il numero non è fra quelli autorizzati (account Meta ancora in prova)';
    case 132001: return 'il modello del messaggio non esiste o non è ancora approvato';
    case 132000: case 132012: return 'il modello del messaggio non corrisponde: va controllato su Meta';
    case 190: return 'la chiave di accesso a WhatsApp non è valida o è scaduta';
    case 131047: case 131026: return 'il numero non può ricevere il messaggio';
    case 4: case 80007: case 130429: return 'troppi messaggi in poco tempo, riprova fra poco';
    default: return 'WhatsApp ha rifiutato il messaggio';
  }
}
