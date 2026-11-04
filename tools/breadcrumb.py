#!/usr/bin/env python3
"""Pfadanzeige (Breadcrumb) + JSON-LD BreadcrumbList auf allen Unterseiten.

Aufruf im Repo-Hauptordner:  python3 tools/breadcrumb.py
Nach neuen Seiten oder Berichten ausführen und die geänderten index.html mitcommitten.
Idempotent: vorhandene Blöcke zwischen den BREADCRUMB-Markern werden ersetzt, nie verdoppelt.

- Startseite (/index.html), 404.html, _wartung/ und Weiterleitungs-Stubs (meta refresh) bekommen keine Leiste.
- Hierarchie wie im Hauptmenü: /mannschaft/ und /fahrzeug/ liegen unter /wehr/ (Unsere Wehr),
  Berichte /berichte/JAHR/slug/ unter /aktuelles/JAHR/ (falls die Jahresübersicht existiert), sonst unter /aktuelles/.
- Bezeichnung: Menütext für Menüseiten, Jahreszahl für /aktuelles/JAHR/, sonst h1 (bzw. title ohne „– FF Waidegg“).
- Links sind root-absolut (/x/) wie im Hauptmenü, die Vorschau (/v-…/) schreibt sie um.
  Das JSON-LD nutzt absolute URLs https://ff-waidegg.at/…
- Mit --check: nichts schreiben, nur prüfen (Rückgabe 1, wenn eine Seite nicht aktuell ist).
"""
import html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASIS = "https://ff-waidegg.at"
START_B, ENDE_B = "<!-- BREADCRUMB:START -->", "<!-- BREADCRUMB:ENDE -->"
START_J, ENDE_J = "<!-- BREADCRUMB-JSONLD:START -->", "<!-- BREADCRUMB-JSONLD:ENDE -->"
# Zusätzliche Dateien, die wie eine Seite behandelt werden (Vorlage -> Seite)
VORLAGEN = {"bewerbe/ergebnisse/vorlage.html": "bewerbe/ergebnisse/"}
# Eltern abweichend vom Ordner (Menüstruktur)
ELTERN = {"mannschaft/": "wehr/", "fahrzeug/": "wehr/"}
AUSLASSEN = ("_wartung/", "_site/", "pagefind/", "node_modules/", ".git/", "tools/")


def lesen(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read()


def ist_seite(pfad):
    """pfad wie 'bewerbe/' -> True, wenn dort eine echte Seite (kein Stub) liegt."""
    p = os.path.join(ROOT, pfad, "index.html")
    if not os.path.isfile(p):
        return False
    return 'http-equiv="refresh"' not in lesen(os.path.join(pfad, "index.html"))


def menue():
    t = lesen("index.html")
    m = re.search(r'<nav class="nav-row" id="hauptmenue".*?</nav>', t, re.S)
    return {h.lstrip("/"): html.unescape(re.sub(r"<[^>]+>", "", x)).strip()
            for h, x in re.findall(r'<a href="(/[^"]*)"[^>]*>(.*?)</a>', m.group(0))}


MENUE = menue()


def text(s):
    s = html.unescape(re.sub(r"<[^>]+>", "", s))
    return re.sub(r"\s+", " ", s.replace("\u00a0", " ")).strip()


def name(pfad, t=None):
    if pfad == "":
        return "Start"
    if pfad in MENUE:
        return MENUE[pfad]
    m = re.fullmatch(r"aktuelles/(\d{4})/", pfad)
    if m:
        return m.group(1)
    if t is None:
        t = lesen(os.path.join(pfad, "index.html"))
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", t, re.S)
    if h1 and text(h1.group(1)):
        return text(h1.group(1))
    ti = re.search(r"<title>(.*?)</title>", t, re.S)
    return re.sub(r"\s*[–|·-]\s*(FF|Freiwillige Feuerwehr) Waidegg\s*$", "", text(ti.group(1)))


def eltern(pfad):
    if pfad in ELTERN:
        return ELTERN[pfad]
    m = re.fullmatch(r"berichte/(\d{4})/[^/]+/", pfad)
    if m:
        j = "aktuelles/%s/" % m.group(1)
        return j if ist_seite(j) else "aktuelles/"
    teile = pfad.rstrip("/").split("/")[:-1]
    while teile:
        p = "/".join(teile) + "/"
        if ist_seite(p):
            return p
        teile.pop()
    return ""


def kette(pfad, t):
    k = [(pfad, name(pfad, t))]
    while pfad:
        pfad = eltern(pfad)
        k.insert(0, (pfad, name(pfad)))
    return k


def bloecke(k):
    e = html.escape
    eltern_pfad, eltern_name = k[-2]
    li = []
    for p, n in k[:-1]:
        li.append('<li><a href="/%s">%s</a></li>' % (e(p), e(n)))
    li.append('<li aria-current="page">%s</li>' % e(k[-1][1]))
    nav = ('%s\n  <nav class="breadcrumb" aria-label="Pfad" data-pagefind-ignore>'
           '<a class="breadcrumb-hoch" href="/%s"><span aria-hidden="true">←</span>'
           '<span class="visually-hidden">Eine Ebene höher: %s</span></a><ol>%s</ol></nav>\n  %s'
           % (START_B, e(eltern_pfad), e(eltern_name), "".join(li), ENDE_B))
    daten = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": "%s/%s" % (BASIS, p)}
        for i, (p, n) in enumerate(k)]}
    js = json.dumps(daten, ensure_ascii=False).replace("</", "<\\/")
    ld = '%s<script type="application/ld+json">%s</script>%s' % (START_J, js, ENDE_J)
    return nav, ld


def entfernen(t):
    t = re.sub(r"\n?[ \t]*" + re.escape(START_B) + r".*?" + re.escape(ENDE_B), "", t, flags=re.S)
    t = re.sub(r"\n?[ \t]*" + re.escape(START_J) + r".*?" + re.escape(ENDE_J), "", t, flags=re.S)
    return t


def seiten():
    for d, ds, fs in os.walk(ROOT):
        rel = os.path.relpath(d, ROOT).replace(os.sep, "/")
        rel = "" if rel == "." else rel + "/"
        ds[:] = [x for x in ds if not (rel + x + "/").startswith(AUSLASSEN) and not x.startswith(".")]
        if "index.html" in fs and rel:
            yield rel + "index.html", rel
    for datei, pfad in VORLAGEN.items():
        if os.path.isfile(os.path.join(ROOT, datei)):
            yield datei, pfad


def main():
    nur_pruefen = "--check" in sys.argv
    n, neu = 0, []
    for datei, pfad in sorted(seiten()):
        alt = lesen(datei)
        if 'http-equiv="refresh"' in alt or 'id="hauptmenue"' not in alt:
            continue
        t = entfernen(alt)
        kopf = re.search(r'<header class="site-head".*?</header>', t, re.S)
        if t.count("</head>") != 1 or not kopf:
            sys.exit("breadcrumb: FEHLER, </head> oder Seitenkopf (header.site-head) fehlt in " + datei)
        nav, ld = bloecke(kette(pfad, t))
        t = t[:kopf.end()] + "\n  " + nav + t[kopf.end():]
        t = t.replace("</head>", "  " + ld + "\n</head>", 1)
        n += 1
        if t != alt:
            neu.append((datei, t))
    if nur_pruefen:
        print("breadcrumb: %d Seiten, %d nicht aktuell %s" % (n, len(neu), " ".join(d for d, _ in neu)))
        sys.exit(1 if neu else 0)
    for datei, t in neu:  # erst schreiben, wenn alle Seiten fehlerfrei vorbereitet sind
        with open(os.path.join(ROOT, datei), "w", encoding="utf-8") as f:
            f.write(t)
    print("breadcrumb: %d Seiten mit Pfadanzeige, %d geändert" % (n, len(neu)))


if __name__ == "__main__":
    main()
