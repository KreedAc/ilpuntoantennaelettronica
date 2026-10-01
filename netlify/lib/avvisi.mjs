// Che cosa si legge sul telefono quando un lavoro cambia di mano.
//
// Sta qui, fuori dalle funzioni dell'API, perché è la parte che si sbaglia
// facilmente e che si può provare da sola: niente database, niente rete, solo
// chi c'era prima e chi c'è adesso.

/**
 * I titoli di un passaggio di consegne, uno per destinatario.
 *
 * Il titolo è quasi sempre l'unica riga che si legge davvero su una notifica,
 * e dice cose diverse a seconda di chi la riceve: chi prende il lavoro deve
 * capire che è suo, chi lo lascia che non lo è più. Lo stesso titolo per
 * entrambi li manderebbe fuori strada tutti e due.
 *
 * @param {number|null} precedente  chi lo aveva prima (null: era nel mucchio)
 * @param {number|null} nuovo       chi lo ha adesso (null: torna nel mucchio)
 * @param {string|null} nuovoNome   il nome di chi lo ha adesso
 * @returns {{a: number, titolo: string}[]} in ordine: prima chi riceve.
 */
export function titoliCambioTecnico({ precedente = null, nuovo = null, nuovoNome = null } = {}) {
  const avvisi = [];
  if (nuovo) avvisi.push({ a: nuovo, titolo: 'Intervento assegnato a te' });
  if (precedente && precedente !== nuovo) {
    avvisi.push({
      a: precedente,
      // Senza nome vuol dire che è tornato nel mucchio di chi deve ancora
      // prenderlo: non è passato a nessuno, semplicemente non è più suo.
      titolo: nuovoNome ? `Intervento passato a ${nuovoNome}` : 'Intervento non più tuo',
    });
  }
  return avvisi;
}
