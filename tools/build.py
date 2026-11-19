#!/usr/bin/env python3
"""Bouwt app.js uit src/parts en zet de extra CSS in index.html.
Gebruik: python3 tools/build.py   (vanuit de repo-map)"""
import re, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
P = R + 'src/parts/'
rd = lambda p: open(p, encoding='utf-8').read()
helpers = re.sub(r"const SUGGEST = \[.*?\];\n", '', rd(R + 'src/helpers.txt'), flags=re.S)
vb = rd(P + 'views_b.js').replace("const app = $('#app'), ci = $('#coachInput'); if (ci) state.coach.draft = ci.value; state.pending = false;", "const app = $('#app'); captureInputs(); state.pending = false;")
app = "'use strict';\n" + helpers + '\n' + rd(P + 'core.js') + '\n' + rd(P + 'views_a.js') + '\n' + vb + '\n' + rd(P + 'camp.js') + '\n' + rd(P + 'org.js') + '\n' + rd(P + 'web.js') + '\n' + rd(P + 'actions.js') + '\n'
open(R + 'app.js', 'w', encoding='utf-8').write(app)
h = rd(R + 'index.html')
a, b = h.index('/* EXTRA-START'), h.index('/* EXTRA-END */')
h = h[:a] + '/* EXTRA-START (wordt gevuld door tools/build.py uit src/parts/extra.css, hier niet handmatig aanpassen) */\n' + rd(P + 'extra.css').rstrip() + '\n' + h[b:]
open(R + 'index.html', 'w', encoding='utf-8').write(h)
print('gebouwd: app.js', len(app), 'bytes, index.html', len(h), 'bytes')
