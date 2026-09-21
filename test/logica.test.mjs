// Prove sulla logica del pannello appuntamenti.
//
//   npm test
//
// Non serve il database: qui si verificano le regole pure, cioè quelle che
// decidono se un dato è accettabile e come vengono fatti i conti sulle date.
// Sono il punto in cui un errore passerebbe inosservato più a lungo.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { FASCE, fasciaValida, GIORNI_LAVORATIVI } from '../netlify/lib/configurazione.mjs';
import {
  prezzoInCentesimi, centesimiInPrezzo, dataValida, normalizzaOra,
  telefonoPerChiamata, validaAppuntamento, validaSpostamento,
} from '../netlify/lib/validazione.mjs';
import { piuGiorni, lunedi, giornoSettimana, dataEstesa, intervalloSettimana } from '../netlify/lib/calendario.mjs';
import { cifra, verifica } from '../netlify/lib/password.mjs';

describe('fasce orarie', () => {
  test('vanno dalle 08:00 alle 18:30, di mezz\'ora in mezz\'ora', () => {
    assert.equal(FASCE[0], '08:00');
    assert.equal(FASCE.at(-1), '18:30');
    assert.equal(FASCE.length, 22); // dalle 8 alle 19 sono 11 ore = 22 mezz'ore
  });

  test('accetta solo gli orari allineati', () => {
    assert.ok(fasciaValida('08:00'));
    assert.ok(fasciaValida('15:30'));
    assert.ok(!fasciaValida('15:15'), 'i quarti d\'ora non sono ammessi');
    assert.ok(!fasciaValida('07:30'), 'prima dell\'apertura');
    assert.ok(!fasciaValida('19:00'), 'l\'ultima fascia inizia alle 18:30');
  });

  test('la domenica non è fra i giorni lavorativi', () => {
    assert.deepEqual(GIORNI_LAVORATIVI, [1, 2, 3, 4, 5, 6]);
    assert.ok(!GIORNI_LAVORATIVI.includes(7));
  });
});

describe('prezzo', () => {
  test('legge i modi in cui si scrive un importo', () => {
    assert.equal(prezzoInCentesimi('80'), 8000);
    assert.equal(prezzoInCentesimi('80,50'), 8050);
    assert.equal(prezzoInCentesimi('80.5'), 8050);
    assert.equal(prezzoInCentesimi(' 120 '), 12000);
    assert.equal(prezzoInCentesimi('€ 60'), 6000);
    assert.equal(prezzoInCentesimi('1.234,50'), 123450);
    assert.equal(prezzoInCentesimi('0'), 0);
  });

  test('rifiuta quello che importo non è', () => {
    assert.equal(prezzoInCentesimi(''), null);
    assert.equal(prezzoInCentesimi('ottanta'), null);
    assert.equal(prezzoInCentesimi('80,555'), null);
    assert.equal(prezzoInCentesimi('-10'), null);
  });

  test('andata e ritorno senza perdere centesimi', () => {
    for (const scritto of ['0,01', '9,99', '80,00', '1234,56']) {
      assert.equal(centesimiInPrezzo(prezzoInCentesimi(scritto)), scritto.replace(/^0+(?=\d)/, ''));
    }
  });

  test('niente errori di virgola mobile', () => {
    // 0.1 + 0.2 in virgola mobile fa 0.30000000000000004: con gli interi no.
    assert.equal(prezzoInCentesimi('0,10') + prezzoInCentesimi('0,20'), 30);
    assert.equal(centesimiInPrezzo(30), '0,30');
  });
});

describe('date e orari', () => {
  test('riconosce le date impossibili', () => {
    assert.ok(dataValida('2026-09-21'));
    assert.ok(dataValida('2028-02-29'), '2028 è bisestile');
    assert.ok(!dataValida('2026-02-30'));
    assert.ok(!dataValida('2027-02-29'), '2027 non è bisestile');
    assert.ok(!dataValida('2026-13-01'));
    assert.ok(!dataValida('21/09/2026'));
    assert.ok(!dataValida(''));
  });

  test('normalizza l\'ora', () => {
    assert.equal(normalizzaOra('9:00'), '09:00');
    assert.equal(normalizzaOra('09:00:00'), '09:00');
    assert.equal(normalizzaOra('18:30'), '18:30');
    assert.equal(normalizzaOra('25:00'), null);
    assert.equal(normalizzaOra('9.00'), null);
  });

  test('l\'ora legale non sposta i giorni', () => {
    // Nel 2026 l'ora legale in Italia finisce domenica 25 ottobre.
    assert.equal(piuGiorni('2026-10-24', 1), '2026-10-25');
    assert.equal(piuGiorni('2026-10-25', 1), '2026-10-26');
    // E ricomincia domenica 29 marzo.
    assert.equal(piuGiorni('2026-03-28', 1), '2026-03-29');
    assert.equal(piuGiorni('2026-03-29', 1), '2026-03-30');
  });

  test('settimane che iniziano di lunedì', () => {
    assert.equal(lunedi('2026-09-21'), '2026-09-21', 'un lunedì resta se stesso');
    assert.equal(lunedi('2026-09-26'), '2026-09-21', 'il sabato guarda al suo lunedì');
    assert.equal(lunedi('2026-09-27'), '2026-09-21', 'anche la domenica');
    assert.equal(lunedi('2026-09-28'), '2026-09-28', 'il lunedì dopo è un\'altra settimana');
  });

  test('giorno della settimana in stile ISO', () => {
    assert.equal(giornoSettimana('2026-09-21'), 1, 'lunedì');
    assert.equal(giornoSettimana('2026-09-26'), 6, 'sabato');
    assert.equal(giornoSettimana('2026-09-27'), 7, 'domenica');
  });

  test('date scritte per esteso', () => {
    assert.equal(dataEstesa('2026-09-21'), 'lunedì 21 settembre 2026');
    assert.equal(dataEstesa('2026-09-21', { conAnno: false }), 'lunedì 21 settembre');
  });

  test('intervallo della settimana', () => {
    assert.equal(intervalloSettimana('2026-09-21'), '21 – 26 settembre 2026');
    assert.equal(intervalloSettimana('2026-09-28'), '28 settembre – 3 ottobre 2026');
    assert.equal(intervalloSettimana('2026-12-28'), '28 dicembre 2026 – 2 gennaio 2027');
  });
});

describe('telefono', () => {
  test('prepara il numero per il link tel:', () => {
    assert.equal(telefonoPerChiamata('333 1234567'), '+393331234567');
    assert.equal(telefonoPerChiamata('+39 333 1234567'), '+393331234567');
    assert.equal(telefonoPerChiamata('0039 333 1234567'), '+393331234567');
    assert.equal(telefonoPerChiamata('333-123.45.67'), '+393331234567');
  });
});

describe('scheda cliente', () => {
  const buona = {
    nomeCliente: 'Antonio Greco',
    luogoImpianto: 'Via dei Bizantini 45, Lamezia Terme',
    telefonoCliente: '333 1234567',
    prezzoConcordato: '80',
    data: '2026-09-21',
    ora: '09:00',
    note: 'Parabola Sky da riallineare',
    urgente: false,
  };

  test('accetta una scheda completa', () => {
    const { valori, errori } = validaAppuntamento(buona);
    assert.deepEqual(errori, {});
    assert.equal(valori.prezzoCentesimi, 8000);
    assert.equal(valori.ora, '09:00');
    assert.equal(valori.urgente, false);
  });

  test('i campi obbligatori sono obbligatori', () => {
    const { errori } = validaAppuntamento({});
    for (const campo of ['nomeCliente', 'luogoImpianto', 'telefonoCliente', 'prezzoConcordato', 'data', 'ora']) {
      assert.ok(errori[campo], `manca la segnalazione su ${campo}`);
    }
    assert.ok(!errori.note, 'le note sono facoltative');
  });

  test('toglie gli spazi intorno ai valori', () => {
    const { valori } = validaAppuntamento({ ...buona, nomeCliente: '  Maria Perri  ' });
    assert.equal(valori.nomeCliente, 'Maria Perri');
  });

  test('rifiuta gli orari fuori fascia', () => {
    assert.ok(validaAppuntamento({ ...buona, ora: '09:15' }).errori.ora);
    assert.ok(validaAppuntamento({ ...buona, ora: '07:00' }).errori.ora);
    assert.ok(validaAppuntamento({ ...buona, ora: '19:00' }).errori.ora);
  });

  test('urgente accetta sia il booleano sia la stringa', () => {
    assert.equal(validaAppuntamento({ ...buona, urgente: true }).valori.urgente, true);
    assert.equal(validaAppuntamento({ ...buona, urgente: 'true' }).valori.urgente, true);
    assert.equal(validaAppuntamento({ ...buona, urgente: 'no' }).valori.urgente, false);
  });

  test('lo spostamento guarda solo data e ora', () => {
    assert.deepEqual(validaSpostamento({ data: '2026-09-22', ora: '15:30' }).errori, {});
    assert.ok(validaSpostamento({ data: '2026-09-22', ora: '15:20' }).errori.ora);
    assert.ok(validaSpostamento({ data: 'domani', ora: '15:30' }).errori.data);
  });
});

describe('password', () => {
  test('la stessa password dà impronte diverse, e si verificano entrambe', async () => {
    const uno = await cifra('una-password-lunga');
    const due = await cifra('una-password-lunga');
    assert.notEqual(uno, due, 'il sale deve essere diverso ogni volta');
    assert.ok(await verifica('una-password-lunga', uno));
    assert.ok(await verifica('una-password-lunga', due));
  });

  test('rifiuta la password sbagliata', async () => {
    const hash = await cifra('quella-giusta');
    assert.ok(!(await verifica('quella-sbagliata', hash)));
    assert.ok(!(await verifica('', hash)));
  });

  test('non contiene la password in chiaro', async () => {
    const hash = await cifra('segretissima');
    assert.ok(!hash.includes('segretissima'));
    assert.ok(hash.startsWith('scrypt$'));
  });

  test('non si rompe su un valore malformato', async () => {
    assert.ok(!(await verifica('x', 'spazzatura')));
    assert.ok(!(await verifica('x', null)));
    assert.ok(!(await verifica('x', 'bcrypt$1$2$3$4$5')));
  });
});
