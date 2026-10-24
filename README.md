# ff-waidegg
Freiwillige Feuerwehr Waidegg

## Veröffentlichung (statichost)

Die Seite ist fertiges HTML. `statichost.yml` ruft beim Build `sh tools/live.sh` auf: Das kopiert alles außer `.git`, `tools/`, `README.md`, `statichost.yml` und `pagefind.yml` nach `_site/`, und dieser Ordner geht online. Ein Build wird mit `curl -X POST https://builder.statichost.eu/ff-waidegg` ausgelöst. `_redirects` leitet die alte Vorschau-Adresse `/v-dukayd9b57/…` dauerhaft (301) auf die gleiche Seite unter `/` um.

## Suche im Archiv (Pagefind)

Die Suche auf /archiv/ und /aktuelles/ nutzt einen fertig erzeugten Index im Ordner `pagefind/` (keine externen Anfragen, kein Build auf statichost nötig).
Durchsucht werden alle Berichte und die Chronik (/wehr/chronik/). Nach jedem neuen oder geänderten Bericht oder einer Änderung an der Chronik im Repo-Hauptordner `npx pagefind@1.5.2` ausführen und den Ordner `pagefind/` mit committen. Einstellungen stehen in `pagefind.yml`.

## Chronik (/wehr/chronik/)

Zeitleiste in `wehr/chronik/index.html` (reines HTML), Aussehen in `wehr/chronik/chronik.css`, Einblenden und Sprungleiste in `wehr/chronik/chronik.js`. Bilder der Chronik liegen in `wehr/chronik/bilder/` (je .jpg, .webp und -640.webp). Ein neuer Eintrag ist ein weiteres `<li class="zr-eintrag">` im passenden Kapitel.

## Ortskarte (/wehr/karte/)

Interaktive Karte „Einsätze & Geschichte“ mit Zeitregler. Daten in `wehr/karte/karte.json` (`orte` mit Koordinaten aus OpenStreetMap/Nominatim und `ungefaehr`-Kennzeichen, `punkte` mit Datum, Art, Ort, Text, Link und kleinem Foto). Nach jeder Änderung an `karte.json` im Repo-Hauptordner `python3 wehr/karte/liste.py` ausführen: das schreibt die Liste (für Besucher ohne JavaScript) in `wehr/karte/index.html`. Leaflet 1.9.4 liegt selbst gehostet in `wehr/karte/leaflet/` und wird nur auf dieser Seite und erst nach Klick auf „Karte laden“ geladen (Zwei-Klick-Lösung, Kacheln von tile.openstreetmap.org). Arten: Einsatz, Übung, Bewerb, Geschichte. Bewerbe nur: alle Landesmeisterschaften, Bezirksleistungsbewerbe in Rattendorf und Kötschach, Uggowitz (keine Abschnitts-/Cupbewerbe). Keine Feste oder anderen Veranstaltungen. Bewerbs-Ergebnisse (`ergebnisse`) kommen aus `bewerbe/ergebnisse/ergebnisse.json` (Platz, Klasse, Jahr je Ort); Datum und Ort der Landesmeisterschaften ab 2005 sind mit den KLFV-Ergebnislisten abgeglichen (`beleg`). Wer „Karte künftig automatisch laden“ wählt, bekommt im localStorage den Merker `ffw-karte-laden=1` (kein Cookie); der Knopf „Karte nicht mehr automatisch laden“ löscht ihn (siehe /datenschutz/#karte). Regeln: nur Ereignisse mit im Repo belegtem Ort; bei Einsätzen und Übungen an Privathäusern nur die Ortschaft, keine Adressen, keine Namen.

## Build-Helfer (tools/)
- `tools/seo.py`: nach neuen Seiten oder Berichten ausführen (`python3 tools/seo.py`). Setzt `canonical` (https://ff-waidegg.at/…), ersetzt die Standard-Beschreibung durch den Kartentext aus /aktuelles/ bzw. den Berichtsanfang und macht gleiche Berichtstitel mit dem Jahr eindeutig.
- `tools/hilfsdateien.sh <ordner>`: entfernt beim Build Skripte, Doku, Konfiguration, versteckte Dateien und die Liste `tools/hilfsdateien.txt` (z. B. `wehr/karte/liste.py`, Ergebnis-Vorlage) aus der Ausgabe, auch in Unterordnern.
- `tools/termine.sh <ordner>/index.html`: entfernt beim Build abgelaufene Termine (ab `data-bis`, Wiener Datum) aus dem No-JS-Fallback der Startseite.
- `tools/sitemap.sh _site`: erzeugt im Live-Build `sitemap.xml` (alle Seiten ohne noindex). In der Vorschau gibt es keine Sitemap.
