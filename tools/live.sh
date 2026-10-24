#!/bin/sh
# Baut den öffentlichen Ordner _site/ für statichost (siehe statichost.yml).
# Kopiert alles außer Repo-Interna; die Seite selbst bleibt unverändert (fertiges HTML, pagefind/ ist mit committet).
set -eu
OUT="_site"
rm -rf "$OUT" && mkdir -p "$OUT"
tar -cf - --exclude=./.git --exclude=./.github --exclude=./.gitignore --exclude="./$OUT" --exclude=./tools \
  --exclude=./statichost.yml --exclude=./pagefind.yml --exclude=./README.md . | tar -xf - -C "$OUT"
# Noch nicht freigegebene Inhalte (Liste: tools/nur-vorschau.txt) aus der Live-Seite entfernen.
# Bricht den Build ab, falls danach noch Vorschau-Inhalte übrig sind.
sh tools/nur-vorschau.sh "$OUT"
# Hilfsdateien (auch in Unterordnern) entfernen, abgelaufene Termine aus dem No-JS-Fallback, Sitemap erzeugen
sh tools/hilfsdateien.sh "$OUT"
sh tools/termine.sh "$OUT/index.html"
sh tools/sitemap.sh "$OUT"
test -f "$OUT/index.html" && test -f "$OUT/_redirects" && test -f "$OUT/pagefind/pagefind.js" && test -f "$OUT/sitemap.xml"
echo "Live-Seite in $OUT/ erzeugt ($(find "$OUT" -type f | wc -l) Dateien)"
