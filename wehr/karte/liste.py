#!/usr/bin/env python3
"""Schreibt die Liste der Kartenpunkte (fuer Besucher ohne JavaScript und als
Begleitliste zur Karte) aus karte.json in index.html, zwischen
<!-- LISTE:START --> und <!-- LISTE:ENDE -->.
Aufruf im Repo-Hauptordner:  python3 wehr/karte/liste.py"""
import json, html, os, re
from collections import Counter

HIER = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HIER, "karte.json"), encoding="utf-8"))
ART = {"einsatz": "Einsatz", "bewerb": "Bewerb", "fest": "Fest", "geschichte": "Geschichte", "uebung": "Übung"}
MON = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August",
       "September", "Oktober", "November", "Dezember"]
e = lambda s: html.escape(str(s), quote=True)

def datum(d):
    t = d.split("-")
    if len(t) == 3:
        return f"{int(t[2])}. {MON[int(t[1]) - 1]} {t[0]}"
    if len(t) == 2:
        return f"{MON[int(t[1]) - 1]} {t[0]}"
    return t[0]

def linktext(l):
    if l.startswith("wehr/chronik/"): return "Zur Chronik"
    if l.startswith("bewerbe/geschichte/"): return "Zur NeverEnding Story"
    if l.startswith("bewerbe/ergebnisse/"): return "Zu den Ergebnissen"
    return "Zum Bericht"

out = []
jahr = None
for i, p in enumerate(D["punkte"]):
    o = D["orte"][p["ort"]]
    if p["jahr"] != jahr:
        if jahr is not None: out.append("</ol></section>")
        jahr = p["jahr"]
        out.append(f'<section class="ka-jahr" data-jahr="{jahr}" aria-labelledby="ka-j{jahr}"><h3 id="ka-j{jahr}">{jahr}</h3><ol class="ka-liste">')
    ort = e(o["name"])
    if o["ungefaehr"]:
        ort += f' <span class="ka-ungefaehr">ungefähr ({e(o["hinweis"])})</span>'
    foto = ""
    if p.get("foto"):
        foto = (f'<img class="ka-foto" src="/{e(p["foto"])}" alt="" width="{p["fw"]}" height="{p["fh"]}" '
                f'loading="lazy" decoding="async">')
    text = f'<p>{e(p["text"])}</p>' if p.get("text") else ""
    erg = ""
    if p.get("ergebnisse"):
        erg = '<ul class="ka-erg">' + "".join(f"<li>{e(z)}</li>" for z in p["ergebnisse"]) + "</ul>"
    beleg = f'<p class="ka-beleg">{e(p["beleg"])}</p>' if p.get("beleg") else ""
    out.append(
        f'<li class="ka-punkt ka-{p["art"]}" data-i="{i}" data-jahr="{p["jahr"]}" data-art="{p["art"]}" data-ort="{e(p["ort"])}">'
        f'{foto}<div class="ka-text"><p class="ka-meta"><span class="ka-art">{ART[p["art"]]}</span> '
        f'<time datetime="{e(p["datum"])}">{datum(p["datum"])}</time></p>'
        f'<h4>{e(p["titel"])}</h4><p class="ka-ort">{ort}</p>{text}{erg}{beleg}'
        f'<p class="ka-links"><a class="zr-link" href="/{e(p["link"])}">{linktext(p["link"])} <span aria-hidden="true">→</span></a></p></div></li>')
out.append("</ol></section>")

f = os.path.join(HIER, "index.html")
t = open(f, encoding="utf-8").read()
t = re.sub(r"(<!-- LISTE:START -->).*?(<!-- LISTE:ENDE -->)",
           lambda m: m.group(1) + "\n" + "\n".join(out) + "\n" + m.group(2), t, flags=re.S)
n = Counter(p["art"] for p in D["punkte"])
zahl = f'{len(D["punkte"])} Punkte: {n["einsatz"]} Einsätze, {n["bewerb"]} Bewerbe, {n["uebung"]} Übungen, {n["fest"]} Feste, {n["geschichte"]} aus der Geschichte'
t = re.sub(r"(<!-- ZAHL -->).*?(<!-- /ZAHL -->)", lambda m: m.group(1) + zahl + m.group(2), t, flags=re.S)
open(f, "w", encoding="utf-8").write(t)
print(zahl)
