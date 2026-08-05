#!/usr/bin/env python3
"""Rigenera le parti del sito che arrivano dai file in `dati/`.

Le pagine restano HTML normale: questo script riscrive soltanto i blocchi
delimitati da marcatori, del tipo

    <!-- GENERATO: nome-blocco -->
    ...contenuto sostituito a ogni build...
    <!-- FINE: nome-blocco -->

Tutto il resto della pagina non viene toccato. Lo script è idempotente:
rilanciarlo senza modificare i dati non produce differenze.

Uso:
    python3 scripts/genera.py            rigenera i blocchi
    python3 scripts/genera.py --verifica esce con codice 1 se qualcosa
                                         è disallineato, senza scrivere
"""

import html
import json
import pathlib
import re
import sys
import urllib.parse

RADICE = pathlib.Path(__file__).resolve().parent.parent
DATI = RADICE / "dati"
TELEFONO = "393802830773"


def leggi(nome):
    return json.loads((DATI / nome).read_text(encoding="utf-8"))


def dimensioni(percorso):
    """Larghezza e altezza di un'immagine, leggendone l'intestazione.

    Copre WebP, PNG e JPEG con la sola libreria standard, così la build non
    dipende da Pillow: servono per gli attributi width/height, che evitano
    lo scarto di impaginazione mentre le foto si caricano. Se il formato non
    è riconosciuto restituisce None e gli attributi vengono semplicemente
    omessi.
    """
    b = percorso.read_bytes()
    try:
        if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
            tipo = b[12:16]
            if tipo == b"VP8 ":
                return int.from_bytes(b[26:28], "little") & 0x3FFF, \
                       int.from_bytes(b[28:30], "little") & 0x3FFF
            if tipo == b"VP8L":
                n = int.from_bytes(b[21:25], "little")
                return (n & 0x3FFF) + 1, ((n >> 14) & 0x3FFF) + 1
            if tipo == b"VP8X":
                return int.from_bytes(b[24:27], "little") + 1, \
                       int.from_bytes(b[27:30], "little") + 1
        if b[:8] == b"\x89PNG\r\n\x1a\n":
            return int.from_bytes(b[16:20], "big"), int.from_bytes(b[20:24], "big")
        if b[:2] == b"\xff\xd8":
            i = 2
            while i < len(b) - 9:
                if b[i] != 0xFF:
                    i += 1
                    continue
                marcatore = b[i + 1]
                if 0xC0 <= marcatore <= 0xCF and marcatore not in (0xC4, 0xC8, 0xCC):
                    return int.from_bytes(b[i + 7:i + 9], "big"), \
                           int.from_bytes(b[i + 5:i + 7], "big")
                i += 2 + int.from_bytes(b[i + 2:i + 4], "big")
    except (IndexError, ValueError):
        pass
    return None


# --------------------------------------------------------------------------
# Generazione dei blocchi
# --------------------------------------------------------------------------

STELLA = (
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'
    "</svg>"
)


def blocco_fascia_recensioni(attivita):
    r = attivita["recensioni"]
    stelle = STELLA * 5
    return (
        f'          <span class="stelle" aria-hidden="true">{stelle}</span>\n'
        f'          <span><strong>{r["media"]} su 5</strong> — '
        f'<a href="{html.escape(r["url"])}" rel="noopener" target="_blank">'
        f'{r["numero"]} recensioni su Google</a></span>'
    )


def blocco_riga_recensioni(attivita):
    r = attivita["recensioni"]
    return (
        f'          <li><strong>{r["media"]} su 5 su Google</strong> '
        f'con {r["numero"]} recensioni dei nostri clienti.</li>'
    )


def scheda_prodotto(p):
    e = html.escape
    nome = f'{p["marca"]} {p["modello"]}'
    dettaglio = f' ({p["variante"].replace(" · ", ", ")})' if p.get("variante") else ""
    msg = (
        "Salve! Vorrei informazioni su questo prodotto visto sul sito: "
        f"{nome} ricondizionato{dettaglio}."
    )
    link = f"https://wa.me/{TELEFONO}?text=" + urllib.parse.quote(msg, safe="")

    if p.get("prezzo_pieno"):
        sconto = round(
            float(p["prezzo_pieno"].replace(".", "").replace(",", "."))
            - float(p["prezzo"].replace(".", "").replace(",", "."))
        )
        badge = f'\n            <span class="risparmio">−{sconto}&nbsp;€</span>'
        prezzo = f'<s>{p["prezzo_pieno"]}&nbsp;€</s> <strong>{p["prezzo"]}&nbsp;€</strong>'
    else:
        badge = ""
        prezzo = f'<span class="da">a partire da</span> <strong>{p["prezzo"]}&nbsp;€</strong>'

    variante = f'\n            <p class="variante">{e(p["variante"])}</p>' if p.get("variante") else ""

    misure = dimensioni(RADICE / p["foto"])
    misure = f' width="{misure[0]}" height="{misure[1]}"' if misure else ""

    return f'''          <article class="prodotto">{badge}
            <div class="foto"><img src="{e(p["foto"])}" alt="{e(nome)} ricondizionato"{misure} loading="lazy" decoding="async"></div>
            <p class="marca">{e(p["marca"])}</p>
            <h4>{e(p["modello"])}</h4>{variante}
            <p class="prezzo">{prezzo}</p>
            <a class="link-prodotto" href="{link}" rel="noopener" target="_blank">Chiedi disponibilità<span class="sr-only"> di {e(nome)} su WhatsApp</span></a>
          </article>'''


def blocco_novita(dati):
    """Fascia delle promozioni in home.

    Restituisce stringa vuota se non c'è nessuna promozione attiva: in quel
    caso la sezione non viene proprio scritta e la pagina torna com'era.
    """
    attive = [p for p in dati["promozioni"] if p.get("attiva")]
    if not attive:
        return ""

    e = html.escape
    schede = []
    for p in attive:
        etichetta = (
            f'\n            <span class="etichetta">{e(p["pubblico"])}</span>'
            if p.get("pubblico") else ""
        )
        # il prezzo compare solo quando è stato compilato
        if p.get("prezzo"):
            pieno = (
                f'<s>{p["prezzo_pieno"]}&nbsp;€</s> ' if p.get("prezzo_pieno") else ""
            )
            prezzo = (
                f'\n              <p class="prezzo-novita">{pieno}'
                f'<strong>{p["prezzo"]}&nbsp;€</strong></p>'
            )
        else:
            prezzo = ""
        condizioni = (
            f'\n              <p class="condizioni">{p["condizioni"]}</p>'
            if p.get("condizioni") else ""
        )
        if p.get("immagine"):
            misure = dimensioni(RADICE / p["immagine"])
            misure = f' width="{misure[0]}" height="{misure[1]}"' if misure else ""
            poster = (
                f'\n            <div class="poster"><img src="{e(p["immagine"])}" '
                f'alt="{e(p.get("immagine_alt", p["titolo"]))}"{misure} '
                f'loading="lazy" decoding="async"></div>'
            )
        else:
            poster = ""

        schede.append(f'''          <article class="novita">{poster}
            <div class="testo-novita">{etichetta}
              <h3>{e(p["titolo"])}</h3>
              <p>{p["testo"]}</p>{prezzo}{condizioni}
            </div>
            <a class="link-novita" href="{e(p["link"])}">{e(p.get("testo_link", "Scopri di più"))} <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          </article>''')

    return "\n".join([
        '    <section class="fascia-novita" aria-label="Novità e promozioni">',
        '      <div class="container">',
        f'        <p class="etichetta-sezione">{e(dati["etichetta_sezione"])}</p>',
        '        <div class="griglia-novita">',
        *schede,
        "        </div>",
        "      </div>",
        "    </section>",
    ])


def blocco_catalogo(cat):
    msg = "Salve! Vorrei sapere quali smartphone ricondizionati avete disponibili."
    link_wa = f"https://wa.me/{TELEFONO}?text=" + urllib.parse.quote(msg, safe="")

    parti = [
        '        <div class="titolo-sezione">',
        f'          <h2>{cat["titolo"]}</h2>',
        f'          <p>{cat["introduzione"]}</p>',
        "        </div>",
    ]
    for gruppo in cat["gruppi"]:
        prodotti = [p for p in gruppo["prodotti"] if p.get("visibile", True)]
        if not prodotti:
            continue
        parti += [
            "",
            f'        <h3 class="titolo-gruppo">{gruppo["titolo"]}</h3>',
            f'        <p class="nota-gruppo">{gruppo["nota"]}</p>',
            '        <div class="griglia-prodotti">',
            *[scheda_prodotto(p) for p in prodotti],
            "        </div>",
        ]
    parti += [
        "",
        f'        <p class="nota-catalogo">{cat["nota_finale"]} Prezzi e disponibilità '
        f'aggiornati al <strong>{cat["aggiornato"]}</strong> e soggetti a variazione: '
        f'<a href="{link_wa}" rel="noopener" target="_blank">scrivici su WhatsApp</a> '
        f'o chiama il <a href="tel:+{TELEFONO}">380 283 0773</a> per conferma.</p>',
    ]
    return "\n".join(parti)


# --------------------------------------------------------------------------
# Sostituzione fra i marcatori
# --------------------------------------------------------------------------


def sostituisci(testo, nome, contenuto, percorso):
    inizio, fine = f"<!-- GENERATO: {nome} -->", f"<!-- FINE: {nome} -->"
    # il contenuto fra i marcatori può anche essere assente: è il caso di una
    # pagina appena creata, dove i due marcatori sono su righe consecutive
    schema = re.compile(
        re.escape(inizio) + r"\n(?:.*?\n)?\s*" + re.escape(fine), re.S
    )
    if not schema.search(testo):
        raise SystemExit(
            f"ERRORE: marcatori '{nome}' non trovati (o malformati) in {percorso.name}.\n"
            f"Servono le righe '{inizio}' e '{fine}'."
        )
    rientro = " " * (len(inizio) - len(inizio.lstrip()))
    return schema.sub(
        lambda _: f"{inizio}\n{contenuto}\n{rientro}{fine}", testo, count=1
    )


def main():
    solo_verifica = "--verifica" in sys.argv

    attivita = leggi("attivita.json")
    catalogo = leggi("catalogo-smartphone.json")
    promozioni = leggi("promozioni.json")

    lavori = [
        ("index.html", [
            ("recensioni-fascia", blocco_fascia_recensioni(attivita)),
            ("recensioni-riga", blocco_riga_recensioni(attivita)),
            ("novita", blocco_novita(promozioni)),
        ]),
        ("smartphone-ricondizionati-lamezia-terme.html", [
            ("catalogo-smartphone", blocco_catalogo(catalogo)),
        ]),
    ]

    modificati = []
    for nome_file, blocchi in lavori:
        percorso = RADICE / nome_file
        originale = percorso.read_text(encoding="utf-8")
        nuovo = originale
        for nome, contenuto in blocchi:
            nuovo = sostituisci(nuovo, nome, contenuto, percorso)
        if nuovo != originale:
            modificati.append(nome_file)
            if not solo_verifica:
                percorso.write_text(nuovo, encoding="utf-8")

    # controlli di coerenza sui dati
    mancanti = [
        p["foto"]
        for c in [catalogo]
        for g in c["gruppi"]
        for p in g["prodotti"]
        if p.get("visibile", True) and not (RADICE / p["foto"]).exists()
    ]
    if mancanti:
        raise SystemExit("ERRORE: foto non trovate:\n  " + "\n  ".join(mancanti))

    n_prodotti = sum(
        len([p for p in g["prodotti"] if p.get("visibile", True)])
        for g in catalogo["gruppi"]
    )

    if solo_verifica:
        if modificati:
            raise SystemExit(
                "Disallineati rispetto a dati/: " + ", ".join(modificati) +
                "\nLancia: python3 scripts/genera.py"
            )
        print("Verifica superata: le pagine sono allineate ai dati.")
    else:
        print(
            f"Generati: recensioni ({attivita['recensioni']['numero']} · "
            f"{attivita['recensioni']['media']}), catalogo smartphone "
            f"({n_prodotti} prodotti)."
        )
        print("Pagine riscritte: " + (", ".join(modificati) if modificati else "nessuna (già allineate)"))


if __name__ == "__main__":
    main()
