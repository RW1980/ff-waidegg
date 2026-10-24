#!/usr/bin/env python3
"""Maskottchen-Bilder einbauen: python3 tools/maskottchen-bilder.py <ordner-mit-pngs>
Erwartet je eine transparente PNG mit winken, zeigen, daumen im Namen (z. B. maskottchen-a-winken.png).
"zeigen" zeigt nach rechts, die Seite spiegelt per CSS.
Schreibt maskottchen/{winken,zeigen,daumen}.webp und .png: 240 px hoch, ohne Metadaten."""
import glob, os, sys
from PIL import Image

if len(sys.argv) < 2:
    sys.exit(__doc__)
quelle = sys.argv[1]
ziel = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "maskottchen")
for pose in ("winken", "zeigen", "daumen"):
    treffer = sorted(glob.glob(os.path.join(quelle, "*" + pose + "*.png")))
    if len(treffer) != 1:
        sys.exit(pose + ": %d passende PNGs (genau 1 erwartet)" % len(treffer))
    bild = Image.open(treffer[0]).convert("RGBA")
    if bild.getchannel("A").getextrema()[0] == 255:
        sys.exit(treffer[0] + ": nicht transparent")
    klein = bild.resize((round(bild.width * 240 / bild.height), 240), Image.LANCZOS)
    klein.save(os.path.join(ziel, pose + ".webp"), "WEBP", quality=88, alpha_quality=90, method=6)
    klein.quantize(256, method=Image.FASTOCTREE).save(os.path.join(ziel, pose + ".png"), optimize=True)
    print(pose, os.path.basename(treffer[0]), bild.size, "->", klein.size)
