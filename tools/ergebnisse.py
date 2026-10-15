#!/usr/bin/env python3
"""Baut /bewerbe/ergebnisse/index.html aus bewerbe/ergebnisse/ergebnisse.json.
Nachtragen: Eintrag in ergebnisse.json ergänzen (art = lm | blb | alb), dann
  python3 tools/ergebnisse.py
ausführen und index.html mitcommitten."""
import json, html, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(root, 'bewerbe/ergebnisse/ergebnisse.json')))
tpl = open(os.path.join(root, 'bewerbe/ergebnisse/vorlage.html')).read()
ART = [("lm", "Landesmeisterschaften", "Landesmeisterschaft"),
       ("blb", "Bezirksleistungsbewerbe", "Bezirk"),
       ("alb", "Abschnittsbewerbe und Cup", "Cup")]
M = {"1": "🥇 ", "2": "🥈 ", "3": "🥉 "}
e = lambda s: html.escape(str(s))
out = []
for key, titel, kurz in ART:
    rows = sorted([r for r in D if r["art"] == key], key=lambda r: r["jahr"])
    tr = []
    for r in rows:
        rg = r["rang"]
        txt = (M.get(rg, "") + rg + ("." if rg.isdigit() else "")) if rg else ""
        # Gruppenzahl (r["von"]) bleibt in der JSON, wird aber nicht angezeigt
        cls = ' class="lm-podest"' if rg in M else ''
        hin = e(r["hinweis"])
        tr.append(f'<tr{cls}><th scope="row" data-label="Jahr">{r["jahr"]}</th>'
                  f'<td data-label="Ort">{e(r["ort"])}</td><td data-label="Bewerb">{e(r["klasse"])}</td>'
                  f'<td data-label="Gruppe">{e(r["gruppe"])}</td><td data-label="Platz">{txt}</td>'
                  f'<td data-label="Zeit">{e(r["zeit"])}</td><td data-label="Hinweis">{hin}</td></tr>')
    out.append(f'''    <section id="{key}" aria-labelledby="{key}-titel">
    <h2 id="{key}-titel">{titel}</h2>
    <p class="lm-hinweis">{len(rows)} Ergebnisse. Die Liste wird laufend ergänzt.</p>
    <div class="lm-wrap"><table class="lm-tab">
    <caption class="visually-hidden">{titel} der FF Waidegg</caption>
    <thead><tr><th scope="col">Jahr</th><th scope="col">Ort</th><th scope="col">Bewerb</th><th scope="col">Gruppe</th><th scope="col">Platz</th><th scope="col">Zeit</th><th scope="col">Hinweis</th></tr></thead>
    <tbody>
    {chr(10).join(tr)}
    </tbody></table></div>
    </section>''')
open(os.path.join(root, 'bewerbe/ergebnisse/index.html'), 'w').write(tpl.replace('<!--ERGEBNISSE-->', '\n'.join(out)))
print({k: sum(r["art"] == k for r in D) for k, _, _ in ART})
