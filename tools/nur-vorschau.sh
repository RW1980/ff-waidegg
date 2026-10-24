#!/bin/sh
# Entfernt noch nicht freigegebene Inhalte aus einem Ausgabeordner (Standard: _site/).
# Wird von tools/live.sh aufgerufen. Liste der Pfade: tools/nur-vorschau.txt
# Läuft mit busybox (alpine-Image von statichost), braucht nur sh, find, grep, awk.
# Bricht mit Fehler ab (Build schlägt fehl, bisherige Seite bleibt online), falls danach noch etwas übrig ist.
set -eu
OUT="${1:-_site}"
LISTE="$(dirname "$0")/nur-vorschau.txt"
test -d "$OUT"

pfade() { [ -f "$LISTE" ] || return 0; while IFS= read -r p || [ -n "$p" ]; do
  case "$p" in ''|'#'*) continue ;; *..*) echo "nur-vorschau: ungültiger Pfad $p" >&2; exit 1 ;; esac
  p="${p#/}"; echo "${p%/}"; done < "$LISTE"; }

# 1) Gelistete Seiten und Fotoordner löschen
n=0
for p in $(pfade); do
  if [ -e "$OUT/$p" ]; then rm -rf "${OUT:?}/$p"; n=$((n+1)); fi
done

# 2) Listen-/Archiv-Einträge zwischen <!-- NUR-VORSCHAU:START … --> und <!-- NUR-VORSCHAU:ENDE --> entfernen
dateien=$(find "$OUT" -name '*.html' -exec grep -l 'NUR-VORSCHAU:START' {} + || true)
for f in $dateien; do
  awk -v A='<!-- NUR-VORSCHAU:START' -v E='<!-- NUR-VORSCHAU:ENDE -->' '
    { s = $0; out = ""; anders = skip
      while (1) {
        if (skip) { e = index(s, E); if (e == 0) { s = ""; break }; s = substr(s, e + length(E)); skip = 0 }
        a = index(s, A); if (a == 0) { out = out s; break }
        out = out substr(s, 1, a - 1); s = substr(s, a); skip = 1; anders = 1
      }
      if (!(anders && out ~ /^[ \t]*$/)) print out }
    END { if (skip) { print "nur-vorschau: FEHLER, NUR-VORSCHAU:ENDE fehlt" > "/dev/stderr"; exit 1 } }' "$f" > "$f.tmp"
  mv "$f.tmp" "$f"
done

# 3) Kontrolle: keine Marker, keine Seite mit ffw-status nur-vorschau, kein Link/Suchtreffer auf gelistete Pfade
rest=$(find "$OUT" -name '*.html' -exec grep -lE 'NUR-VORSCHAU:(START|ENDE)|name="ffw-status" content="nur-vorschau"' {} + || true)
if [ -n "$rest" ]; then echo "nur-vorschau: FEHLER, noch Vorschau-Inhalte in: $rest" >&2; exit 1; fi
for p in $(pfade); do
  [ -e "$OUT/$p" ] && { echo "nur-vorschau: FEHLER, $p noch da" >&2; exit 1; }
  treffer=$(grep -rlF "/$p/" "$OUT" || true)
  if [ -n "$treffer" ]; then echo "nur-vorschau: FEHLER, Verweis auf /$p/ in: $treffer" >&2; exit 1; fi
done
echo "nur-vorschau: $n Pfad(e) entfernt, $(echo $dateien | wc -w) Listen-Datei(en) bereinigt"
