#!/usr/bin/env bash
# Zet een nieuwe versie online: bouwen, testen, cacheversies ophogen, committen en pushen.
# Gebruik: bash tools/release.sh "korte beschrijving"
set -euo pipefail
cd "$(dirname "$0")/.."
[ -n "${1:-}" ] || { echo "Geef een beschrijving mee"; exit 1; }
python3 tools/build.py
OUT=$(node tools/smoke.js 2>&1); echo "$OUT" | tail -3
if echo "$OUT" | grep -q "^FAIL\|^ERR"; then echo "Test mislukt, niet online gezet."; exit 1; fi
python3 - <<'PY'
import re
s = open('sw.js').read(); s = re.sub(r"lumo-shell-v(\d+)", lambda m: "lumo-shell-v%d" % (int(m.group(1)) + 1), s, 1); open('sw.js', 'w').write(s)
c = open('config.js').read(); c = re.sub(r"version: '(\d+)'", lambda m: "version: '%d'" % (int(m.group(1)) + 1), c, 1); open('config.js', 'w').write(c)
PY
git add -A
git commit -q -m "$1

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -q origin HEAD:main
git status -sb | head -1
