#!/bin/sh
# Entfernt Hilfs- und Quelldateien aus einem Ausgabeordner (live: _site/, Vorschau: _wartung/<pfad>/),
# auch in Unterordnern: Skripte, Doku, Konfiguration, Python-Caches, versteckte Dateien und Build-Vorlagen.
# Läuft mit busybox (alpine-Image von statichost). Aufruf: sh tools/hilfsdateien.sh <ordner>
set -eu
OUT="${1:?Ordner fehlt}"
test -d "$OUT"
vorher=$(find "$OUT" -type f | wc -l)
# versteckte Ordner/Dateien und Python-Caches
find "$OUT" -mindepth 1 \( -name '.*' -o -name '__pycache__' \) -prune -exec rm -rf {} +
# Dateitypen, die nie zur Website gehören
find "$OUT" -type f \( -name '*.py' -o -name '*.pyc' -o -name '*.sh' -o -name '*.md' -o -name '*.pkl' \
  -o -name '*.pickle' -o -name '*.yml' -o -name '*.yaml' -o -name '*.toml' -o -name '*.ini' -o -name '*.cfg' \
  -o -name '*.bak' -o -name '*.orig' -o -name '*.tmp' -o -name '*.swp' -o -name '*~' -o -name '*.log' \
  -o -name '*.csv' -o -name '*.xcf' -o -name '*.psd' -o -name 'Thumbs.db' \) -exec rm -f {} +
# Build-Quellen, die keine Seite verwendet (Liste: tools/hilfsdateien.txt)
LISTE="$(dirname "$0")/hilfsdateien.txt"
if [ -f "$LISTE" ]; then
  while IFS= read -r p || [ -n "$p" ]; do
    case "$p" in ''|'#'*) continue ;; *..*) echo "hilfsdateien: ungültiger Pfad $p" >&2; exit 1 ;; esac
    rm -rf "${OUT:?}/${p#/}"
  done < "$LISTE"
fi
rest=$(find "$OUT" -type f \( -name '*.py' -o -name '*.sh' -o -name '*.md' -o -name '*.pkl' -o -name '*.yml' -o -name '.*' \) | head -5)
if [ -n "$rest" ]; then echo "hilfsdateien: FEHLER, noch vorhanden: $rest" >&2; exit 1; fi
echo "hilfsdateien: $((vorher - $(find "$OUT" -type f | wc -l))) Datei(en) entfernt"
