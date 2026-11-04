#!/usr/bin/env python3
"""Open-Graph-Tags für ff-waidegg.at (im Repo-Hauptordner: python3 tools/og.py, nur prüfen: --check).
Setzt auf jeder Seite mit canonical und ohne noindex einen Block zwischen <!-- OG START --> und <!-- OG ENDE -->:
og:type (Berichte article, sonst website), og:locale de_AT, og:site_name, og:title (<title> ohne „ – FF Waidegg“, sonst h1),
og:description (= meta description), og:url (= canonical), og:image absolut (Berichte: Titelbild bzw. erstes Berichtsfoto,
also genau die Datei, die auf der Seite steht – damit auch die weichgezeichneten Fassungen; bei AVIF/WebP die daraus
erzeugte JPG-Fassung <name>-og.jpg, falls vorhanden; sonst /og.jpg) samt Maßen,
und twitter:card summary_large_image. Seiten, die schon eigene og:-Tags haben (Berichte 2026), bleiben unverändert.
Mehrfach ausführbar; ändert nichts, was schon passt. Mit --check: Exit 1, wenn etwas fehlt oder veraltet ist."""
import re, os, glob, sys, html
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
BASIS = 'https://ff-waidegg.at'
SITE = 'Freiwillige Feuerwehr Waidegg'
STANDARD_BILD = '/og.jpg'
AUSLASSEN = {'bewerbe/ergebnisse/vorlage.html'}
BLOCK = re.compile(r'  <!-- OG START -->\n.*?<!-- OG ENDE -->\n', re.S)
try:
    from PIL import Image
except ImportError:
    Image = None

def text(s): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()
def attr(s): return html.escape(s, quote=True)

def masse(pfad):
    if Image is None: return None
    try:
        with Image.open(pfad.lstrip('/')) as im: return im.size
    except Exception: return None

def bild(p, t):
    """(src, alt) des ersten Berichtsfotos bzw. Titelbilds, sonst Standardbild."""
    if p.startswith('berichte/'):
        main = t.split('<main', 1)[-1]
        m = re.search(r'class="[^"]*hero-cover[^"]*">.*?<img ([^>]*)>', main, re.S)
        kandidaten = [m.group(1)] if m else []
        kandidaten += re.findall(r'<img ([^>]*)>', main)
        for a in kandidaten:
            src = re.search(r'\bsrc="([^"]+)"', a)
            if not src: continue
            src = html.unescape(src.group(1))
            if src.startswith('/fotos/') or (m and a == m.group(1) and src.startswith('/')):
                if os.path.isfile(src.lstrip('/')):
                    # AVIF/WebP zeigen soziale Netzwerke oft nicht: dann die gleichnamige JPG-Fassung <name>-og.jpg (aus derselben Datei erzeugt)
                    og = src.rsplit('.', 1)[0] + '-og.jpg'
                    if not src.lower().endswith(('.jpg', '.jpeg', '.png')) and os.path.isfile(og.lstrip('/')): src = og
                    alt = re.search(r'\balt="([^"]*)"', a)
                    return src, html.unescape(alt.group(1)) if alt else ''
    return STANDARD_BILD, ''

def block(p, t):
    can = re.search(r'<link rel="canonical" href="([^"]+)">', t)
    titel = re.search(r'<title>(.*?)</title>', t, re.S)
    ti = text(titel.group(1)) if titel else ''
    ti = re.sub(r'\s+–\s+FF Waidegg$', '', ti)
    if not ti:
        h1 = re.search(r'<h1[^>]*>(.*?)</h1>', t, re.S); ti = text(h1.group(1)) if h1 else SITE
    d = re.search(r'<meta name="description" content="([^"]*)">', t)
    src, alt = bild(p, t)
    z = ['  <!-- OG START -->',
         f'  <meta property="og:type" content="{"article" if p.startswith("berichte/") else "website"}">',
         '  <meta property="og:locale" content="de_AT">',
         f'  <meta property="og:site_name" content="{SITE}">',
         f'  <meta property="og:title" content="{attr(ti)}">']
    if d: z.append(f'  <meta property="og:description" content="{d.group(1)}">')
    z.append(f'  <meta property="og:url" content="{can.group(1)}">')
    url = BASIS + '/'.join(__import__('urllib.parse').parse.quote(x) for x in src.split('/'))
    z.append(f'  <meta property="og:image" content="{attr(url)}">')
    gr = masse(src)
    if gr: z += [f'  <meta property="og:image:width" content="{gr[0]}">', f'  <meta property="og:image:height" content="{gr[1]}">']
    if alt: z.append(f'  <meta property="og:image:alt" content="{attr(alt)}">')
    z += ['  <meta name="twitter:card" content="summary_large_image">', '  <!-- OG ENDE -->']
    return '\n'.join(z) + '\n', src

def main():
    check = '--check' in sys.argv
    seiten = sorted(p for p in glob.glob('**/*.html', recursive=True)
                    if not p.startswith(('pagefind/', '_wartung/', '_site/', 'tools/', 'node_modules/')) and p not in AUSLASSEN)
    neu = geaendert = eigen = ohne = 0; fehler = []
    for p in seiten:
        t = open(p, encoding='utf-8').read()
        kopf = t.split('</head>', 1)[0]
        ohne_block = BLOCK.sub('', t)
        if 'name="robots" content="noindex' in kopf or 'rel="canonical"' not in kopf:
            ohne += 1
            if ohne_block != t: fehler.append(f'{p}: OG-Block auf Seite ohne canonical/noindex')
            continue
        if 'property="og:' in ohne_block.split('</head>', 1)[0]:
            eigen += 1
            if ohne_block != t: fehler.append(f'{p}: eigene og-Tags und OG-Block')
            continue
        b, src = block(p, ohne_block)
        if not os.path.isfile(src.lstrip('/')): fehler.append(f'{p}: Bild fehlt {src}')
        m = re.search(r'(<link rel="canonical" href="[^"]+">\n)', ohne_block)
        soll = ohne_block.replace(m.group(1), m.group(1) + b, 1) if m else ohne_block.replace('</head>', b + '</head>', 1)
        if soll != t:
            if BLOCK.search(t): geaendert += 1
            else: neu += 1
            if check: fehler.append(f'{p}: OG-Block fehlt oder veraltet')
            else: open(p, 'w', encoding='utf-8').write(soll)
    print({'neu': neu, 'aktualisiert': geaendert, 'eigene_og': eigen, 'ohne_canonical_oder_noindex': ohne, 'seiten': len(seiten)})
    for f in fehler[:20]: print('FEHLER', f)
    if check and fehler: sys.exit(1)

main()
