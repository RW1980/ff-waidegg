#!/bin/sh
# Kopiert die echte Website waehrend der Wartung unter einen geheimen Pfad
# in den Ausgabeordner _wartung/ und schreibt root-absolute Links um.
# Nur Verschleierung, kein Zugriffsschutz! Wird beim Livegang entfernt.
set -eu
P="${VORSCHAU_PFAD:-v-dukayd9b57}"
OUT="_wartung/$P"
rm -rf "$OUT" && mkdir -p "$OUT"
tar -cf - --exclude=./.git --exclude=./_wartung --exclude=./tools \
  --exclude=./statichost.yml --exclude=./pagefind.yml --exclude=./README.md . | tar -xf - -C "$OUT"
cd "$OUT"
find . -name '*.html' -exec sed -i \
  -e 's#\(href\|src\|srcset\|content\|action\|poster\)="/\([^/]\)#\1="/'"$P"'/\2#g' \
  -e ':a' -e 's#\(srcset="[^"]*\), /\([^/]\)#\1, %%R%%\2#' -e 'ta' \
  -e 's#%%R%%#/'"$P"'/#g' \
  -e 's#<head>#<head><meta name="robots" content="noindex">#' {} +
find . -name '*.css' ! -path './pagefind/*' -exec sed -i -e "s#url(\(['\"]\?\)/\([^/]\)#url(\1/$P/\2#g" {} +
sed -i -e 's#"/\([^/]\)#"/'"$P"'/\1#g' manifest.webmanifest
sed -i -e 's#"/pagefind/pagefind.js"#"/'"$P"'/pagefind/pagefind.js"#' \
  -e 's#pf.options({ #pf.options({ baseUrl: "/'"$P"'/", #' suche.js
echo "Vorschau unter /$P/ erzeugt"
