#!/bin/sh
# Erzeugt <ordner>/sitemap.xml für die Live-Seite (nur im Go-live-Build, nicht in der Vorschau).
# Aufgenommen wird jede index.html ohne noindex; Adressen absolut auf https://ff-waidegg.at/, Umlaute
# prozentkodiert. Läuft mit busybox. Aufruf: sh tools/sitemap.sh _site
set -eu
OUT="${1:?Ordner fehlt}"
BASIS="https://ff-waidegg.at"
test -d "$OUT"
{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  find "$OUT" -name index.html -type f | sed "s#^$OUT##; s#index.html\$##" | LC_ALL=C sort | while IFS= read -r pfad; do
    grep -q 'name="robots" content="noindex' "$OUT${pfad}index.html" && continue
    printf '%s' "$pfad" | od -An -tx1 -v | awk -v basis="$BASIS" '
      BEGIN { for (i = 0; i < 256; i++) hex[sprintf("%02x", i)] = i; ok = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._~/" }
      { for (f = 1; f <= NF; f++) { c = hex[$f]; ch = sprintf("%c", c)
          if (c < 128 && index(ok, ch)) s = s ch; else s = s "%" toupper($f) } }
      END { printf "  <url><loc>%s%s</loc></url>\n", basis, s }'
  done
  echo '</urlset>'
} > "$OUT/sitemap.xml"
echo "sitemap: $(grep -c '<loc>' "$OUT/sitemap.xml") Adressen"
