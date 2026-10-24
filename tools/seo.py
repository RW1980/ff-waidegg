#!/usr/bin/env python3
"""SEO-Pflege für ff-waidegg.at (im Repo-Hauptordner ausführen: python3 tools/seo.py).
- meta description: ersetzt nur die alte Standardbeschreibung. Für Hauptseiten gilt die Tabelle HAUPT,
  sonst der Einleitungssatz (p.lead), für Berichte der Kartentext aus /aktuelles/ bzw. der Anfang des Berichts.
  Alles kommt aus vorhandenem Seiteninhalt, nichts wird dazugeschrieben.
- <title>: Hauptseiten laut HAUPT; Berichte mit gleichem Titel bekommen das Jahr (bei Gleichstand im Jahr das Datum).
- canonical: https://ff-waidegg.at/<Pfad>/ auf jeder Seite ohne noindex (nicht 404, nicht Vorlagen).
Mehrfach ausführbar; ändert nichts, was schon passt."""
import re, os, glob, html, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
BASIS = 'https://ff-waidegg.at/'
STANDARD = 'Freiwillige Feuerwehr Waidegg, Ortswehr der Marktgemeinde Kirchbach. Seit 1895.'
HAUPT = {
 'index.html': ('Freiwillige Feuerwehr Waidegg – Seit 1895 für die Heimat',
   'Die Freiwillige Feuerwehr Waidegg im Oberen Gailtal: Ortswehr der Marktgemeinde Kirchbach seit 1895. Neueste Berichte, Termine und der Notruf 122.'),
 'mannschaft/index.html': ('Mannschaft – FF Waidegg',
   'Die Mannschaft der FF Waidegg: 63 Mitglieder, davon 46 Aktive, 16 Altmitglieder und 1 Gastmitglied (Stand 18.10.2026), mit Kommando und Dienstgraden.'),
 'datenschutz/index.html': ('Datenschutz – FF Waidegg',
   'Datenschutz der FF Waidegg: Hosting bei statichost.eu in der EU, kein Tracking, keine Analyse-Cookies, Schriften vom eigenen Server, Karte erst nach Klick.'),
 'impressum/index.html': (None,
   'Impressum der Freiwilligen Feuerwehr Waidegg, Waidegg 6, 9631 Jenig: Medieninhaber, Kontakt und Offenlegung nach § 25 Mediengesetz.'),
 'notfall/index.html': (None,
   'Im Notfall: Feuer, Unfall, Menschen in Not – 122 anrufen. Alle Notrufnummern in Österreich, Notruf für Gehörlose (DEC112) und was die Leitstelle wissen muss.'),
 'bewerbe/archiv/index.html': ('Bewerbsarchiv – Bewerbe – FF Waidegg', 'Bewerbsarchiv der FF Waidegg: ältere Bewerbsberichte, nach Jahr sortiert.'),
 '404.html': ('Seite nicht gefunden – FF Waidegg', 'Diese Adresse gibt es auf ff-waidegg.at nicht.'),
}
AUSLASSEN = {'bewerbe/ergebnisse/vorlage.html'}
WT = r'(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)'
DATUM = re.compile(r'^(' + WT + r',?\s*(den\s+)?)?(am\s+)?\d{1,2}\.\s*(\d{1,2}\.|[A-Za-zÄÖÜäöü]+)\s*\d{2,4}\.?$|^\d{1,2}\.\d{1,2}\.\d{2,4}$', re.I)

def text(s):
    s = html.unescape(re.sub(r'<[^>]+>', ' ', s))
    s = re.sub(r'#\w+', '', s)
    s = re.sub(r'[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F]', '', s)
    return re.sub(r'\s+', ' ', s).strip()

def kuerzen(s, n=155):
    if len(s) <= n: return s
    s = s[:n - 1]; s = s[:s.rfind(' ')] if ' ' in s else s
    return s.rstrip(' ,;:–-') + '…'

def attr(s): return html.escape(s, quote=True)

seiten = sorted(p for p in glob.glob('**/*.html', recursive=True)
                if not p.startswith(('pagefind/', '_wartung/', '_site/', 'tools/')) and p not in AUSLASSEN)
# Kartentexte aus /aktuelles/
karten = {}
for p in glob.glob('aktuelles/**/index.html', recursive=True) + ['index.html']:
    for href, inner in re.findall(r'<a class="card[^"]*" href="([^"]+)">(.*?)</a>', open(p, encoding='utf-8').read(), re.S):
        m = re.findall(r'<p>(.*?)</p>', inner, re.S)
        if m and text(m[-1]): karten.setdefault(href, text(m[-1]))

def h1_von(t):
    m = re.search(r'<h1[^>]*>(.*?)</h1>', t, re.S); return text(m.group(1)) if m else ''

def bericht_beschreibung(p, t):
    url = '/' + p[:-len('index.html')]
    if url in karten: return karten[url]
    h1 = h1_von(t)
    body = re.search(r'<div class="body">(.*?)</div>', t, re.S)
    teile = [text(x) for x in re.findall(r'<p>(.*?)</p>', body.group(1), re.S)] if body else []
    teile = [x for x in teile if x and not DATUM.match(x) and x.lower().strip(' !.') != h1.lower().strip(' !.')
             and x.lower().strip(' "„“') != h1.lower()]
    satz = ''
    for x in teile:
        if 'corona' in x.lower() or 'covid' in x.lower(): continue
        if x == 'Bericht folgt.': continue
        satz = (satz + ' ' + x).strip()
        if len(satz) >= 110: break
    if len(satz) < 40:
        zeit = re.search(r'<time class="meta"[^>]*>(.*?)</time>', t)
        satz = f'{h1}: Bericht der FF Waidegg' + (f' vom {text(zeit.group(1))}' if zeit else '') + '.'
    return kuerzen(satz)

daten = {}
for p in seiten:
    daten[p] = open(p, encoding='utf-8').read()

# Titel der Berichte eindeutig machen
def titel(t): m = re.search(r'<title>(.*?)</title>', t, re.S); return m.group(1) if m else None
zaehler = collections.Counter(titel(t) for t in daten.values())
neu_titel = {}
for p, t in daten.items():
    ti = titel(t)
    if p in HAUPT and HAUPT[p][0]: neu_titel[p] = HAUPT[p][0]; continue
    if p.startswith('berichte/') and zaehler[ti] > 1 and 'noindex' not in t[:4000]:
        jahr = p.split('/')[1]
        neu_titel[p] = ti.replace(' – FF Waidegg', f' {jahr} – FF Waidegg') if ' – FF Waidegg' in ti else f'{ti} {jahr}'
z2 = collections.Counter(neu_titel.get(p, titel(t)) for p, t in daten.items())
for p in list(neu_titel):
    if z2[neu_titel[p]] > 1 and p.startswith('berichte/'):
        zeit = re.search(r'<time class="meta"[^>]*>(.*?)</time>', daten[p])
        if zeit:
            jahr = p.split('/')[1]
            neu_titel[p] = neu_titel[p].replace(f' {jahr} – FF Waidegg', f' {text(zeit.group(1))} – FF Waidegg')

geaendert = collections.Counter()
for p, t in daten.items():
    alt = t
    noindex = 'name="robots" content="noindex' in t[:4000]
    if p in neu_titel and titel(t) != neu_titel[p]:
        t = t.replace(f'<title>{titel(t)}</title>', f'<title>{neu_titel[p]}</title>', 1); geaendert['title'] += 1
    m = re.search(r'<meta name="description" content="([^"]*)">', t)
    if m and html.unescape(m.group(1)) == STANDARD and not noindex:
        d = None
        if p in HAUPT and HAUPT[p][1]: d = HAUPT[p][1]
        elif p.startswith('berichte/'): d = bericht_beschreibung(p, t)
        else:
            l = re.search(r'<p class="lead">(.*?)</p>', t, re.S)
            if l: d = kuerzen(text(l.group(1)))
        if d:
            t = t.replace(m.group(0), f'<meta name="description" content="{attr(d)}">', 1); geaendert['description'] += 1
    if not noindex and p != '404.html' and 'rel="canonical"' not in t:
        pfad = '' if p == 'index.html' else p[:-len('index.html')] if p.endswith('/index.html') else None
        if pfad is not None:
            t = t.replace('</head>', f'  <link rel="canonical" href="{BASIS}{pfad}">\n</head>', 1); geaendert['canonical'] += 1
    if t != alt: open(p, 'w', encoding='utf-8').write(t)
print(dict(geaendert))
