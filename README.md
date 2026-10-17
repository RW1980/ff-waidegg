# ff-waidegg
Freiwillige Feuerwehr Waidegg

## Suche im Archiv (Pagefind)

Die Suche auf /archiv/ und /aktuelles/ nutzt einen fertig erzeugten Index im Ordner `pagefind/` (keine externen Anfragen, kein Build auf statichost nötig).
Durchsucht werden alle Berichte und die Chronik (/wehr/chronik/). Nach jedem neuen oder geänderten Bericht oder einer Änderung an der Chronik im Repo-Hauptordner `npx pagefind@1.5.2` ausführen und den Ordner `pagefind/` mit committen. Einstellungen stehen in `pagefind.yml`.

## Chronik (/wehr/chronik/)

Zeitleiste in `wehr/chronik/index.html` (reines HTML), Aussehen in `wehr/chronik/chronik.css`, Einblenden und Sprungleiste in `wehr/chronik/chronik.js`. Bilder der Chronik liegen in `wehr/chronik/bilder/` (je .jpg, .webp und -640.webp). Ein neuer Eintrag ist ein weiteres `<li class="zr-eintrag">` im passenden Kapitel.

## Ortskarte (/wehr/karte/)

Interaktive Karte „Einsätze & Geschichte“ mit Zeitregler. Daten in `wehr/karte/karte.json` (`orte` mit Koordinaten aus OpenStreetMap/Nominatim und `ungefaehr`-Kennzeichen, `punkte` mit Datum, Art, Ort, Text, Link und kleinem Foto). Nach jeder Änderung an `karte.json` im Repo-Hauptordner `python3 wehr/karte/liste.py` ausführen: das schreibt die Liste (für Besucher ohne JavaScript) in `wehr/karte/index.html`. Leaflet 1.9.4 liegt selbst gehostet in `wehr/karte/leaflet/` und wird nur auf dieser Seite und erst nach Klick auf „Karte laden“ geladen (Zwei-Klick-Lösung, Kacheln von tile.openstreetmap.org). Arten: Einsatz, Übung, Bewerb, Fest, Geschichte. Bewerbs-Ergebnisse (`ergebnisse`) kommen aus `bewerbe/ergebnisse/ergebnisse.json` (Platz, Klasse, Jahr je Ort); Datum und Ort der Landesmeisterschaften ab 2005 sind mit den KLFV-Ergebnislisten abgeglichen (`beleg`). Wer „Karte künftig automatisch laden“ wählt, bekommt im localStorage den Merker `ffw-karte-laden=1` (kein Cookie); der Knopf „Karte nicht mehr automatisch laden“ löscht ihn (siehe /datenschutz/#karte). Regeln: nur Ereignisse mit im Repo belegtem Ort; bei Einsätzen und Übungen an Privathäusern nur die Ortschaft, keine Adressen, keine Namen.
