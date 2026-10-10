# ff-waidegg
Freiwillige Feuerwehr Waidegg

## Suche im Archiv (Pagefind)

Die Suche auf /archiv/ und /aktuelles/ nutzt einen fertig erzeugten Index im Ordner `pagefind/` (keine externen Anfragen, kein Build auf statichost nötig).
Durchsucht werden alle Berichte und die Chronik (/wehr/chronik/). Nach jedem neuen oder geänderten Bericht oder einer Änderung an der Chronik im Repo-Hauptordner `npx pagefind@1.5.2` ausführen und den Ordner `pagefind/` mit committen. Einstellungen stehen in `pagefind.yml`.

## Chronik (/wehr/chronik/)

Zeitleiste in `wehr/chronik/index.html` (reines HTML), Aussehen in `wehr/chronik/chronik.css`, Einblenden und Sprungleiste in `wehr/chronik/chronik.js`. Bilder der Chronik liegen in `wehr/chronik/bilder/` (je .jpg, .webp und -640.webp). Ein neuer Eintrag ist ein weiteres `<li class="zr-eintrag">` im passenden Kapitel.
