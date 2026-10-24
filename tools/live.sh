#!/bin/sh
# Baut den öffentlichen Ordner _site/ für statichost (siehe statichost.yml).
# Kopiert alles außer Repo-Interna; die Seite selbst bleibt unverändert (fertiges HTML, pagefind/ ist mit committet).
set -eu
OUT="_site"
rm -rf "$OUT" && mkdir -p "$OUT"
tar -cf - --exclude=./.git --exclude=./.github --exclude=./.gitignore --exclude="./$OUT" --exclude=./tools \
  --exclude=./statichost.yml --exclude=./pagefind.yml --exclude=./README.md . | tar -xf - -C "$OUT"
test -f "$OUT/index.html" && test -f "$OUT/_redirects" && test -f "$OUT/pagefind/pagefind.js"
echo "Live-Seite in $OUT/ erzeugt ($(find "$OUT" -type f | wc -l) Dateien)"
