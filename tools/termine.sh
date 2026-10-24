#!/bin/sh
# Entfernt abgelaufene Termine aus dem HTML der Startseite (Fallback ohne JavaScript).
# Ein Termin ist abgelaufen, wenn sein data-bis (erster Tag ohne Anzeige) <= heute (Wiener Zeit) ist.
# Sind alle abgelaufen, fällt die ganze Termin-Lasche (<aside class="termin" …>…</aside>) weg.
# Mit JavaScript blendet termin.js abgelaufene Termine zusätzlich live aus (auch zwischen zwei Builds).
# Aufruf: sh tools/termine.sh <ordner>/index.html   (Test: HEUTE=2026-11-08 sh tools/termine.sh …)
set -eu
F="${1:?Datei fehlt}"
test -f "$F"
HEUTE="${HEUTE:-$(TZ='CET-1CEST,M3.5.0,M10.5.0/3' date +%Y-%m-%d)}"
case "$HEUTE" in [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;; *) echo "termine: ungültiges Datum $HEUTE" >&2; exit 1 ;; esac
awk -v heute="$HEUTE" '
  { z[NR] = $0 }
  END {
    n = NR; i = 1; weg = 0; bleibt = 0; a0 = 0
    while (i <= n) {
      if (z[i] ~ /^[ \t]*<aside class="termin"/) a0 = i
      if (z[i] ~ /^[ \t]*<li data-termin-eintrag([ \t]|$)/) {
        j = i; buf = z[i]
        while (j < n && !index(z[j], "</li>")) { j++; buf = buf "\n" z[j] }
        bis = ""
        if (match(buf, /data-bis="[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]"/)) bis = substr(buf, RSTART + 10, 10)
        if (bis != "" && bis <= heute) { for (k = i; k <= j; k++) loesch[k] = 1; weg++ } else bleibt++
        i = j + 1; continue
      }
      if (a0 && z[i] ~ /^[ \t]*<\/aside>/) { a1 = i; if (bleibt == 0 && weg > 0) for (k = a0; k <= a1; k++) loesch[k] = 1; a0 = 0 }
      i++
    }
    for (k = 1; k <= n; k++) if (!(k in loesch)) print z[k]
    printf "termine: %d abgelaufen entfernt, %d bleiben (Stand %s)\n", weg, bleibt, heute > "/dev/stderr"
  }' "$F" > "$F.tmp"
mv "$F.tmp" "$F"
