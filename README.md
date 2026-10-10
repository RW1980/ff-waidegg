# ff-waidegg
Freiwillige Feuerwehr Waidegg

## Suche im Archiv (Pagefind)

Die Suche auf /archiv/ und /aktuelles/ nutzt einen fertig erzeugten Index im Ordner `pagefind/` (keine externen Anfragen, kein Build auf statichost nötig).
Nach jedem neuen oder geänderten Bericht im Repo-Hauptordner `npx pagefind@1.5.2` ausführen und den Ordner `pagefind/` mit committen. Einstellungen stehen in `pagefind.yml`.
