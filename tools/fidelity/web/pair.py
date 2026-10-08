#!/usr/bin/env python3
"""pair.py NAME — pair android/NAME.txt and web/NAME.txt rows by text; print deltas in dp."""
import re, sys
S = 2.625
def load(p):
    rows = []
    for line in open(p):
        m = re.search(r'(?:text|content-desc)="([^"]*)".*?@?\[(\d+),(\d+)\]\[(\d+),(\d+)\](.*)', line)
        if m: rows.append((m.group(1).strip(), *map(int, m.group(2, 3, 4, 5)), m.group(6).strip()))
    return rows
n = sys.argv[1]
a, w = load(f'android/{n}.txt'), load(f'web/{n}.txt')
def key(t): return re.sub(r'\W+', '', t.lower())[:18]
used = set()
print(f'{"text":28} {"A x0,y0,x1,y1 (dp)":>24} {"dx0":>6} {"dy0":>6} {"dx1":>6} {"dy1":>6}  web-style')
for t, x0, y0, x1, y1, _ in a:
    k = key(t)
    m = next((r for i, r in enumerate(w) if i not in used and k and (key(r[0]).startswith(k[:10]) or k.startswith(key(r[0])[:10]))), None)
    if not m: print(f'{t[:28]:28} {"%d,%d,%d,%d" % (x0/S, y0/S, x1/S, y1/S):>24}   -- missing on web'); continue
    used.add(w.index(m))
    d = [(m[i] - v) / S for i, v in zip((1, 2, 3, 4), (x0, y0, x1, y1))]
    flag = ' <<' if max(map(abs, d)) > 1.5 else ''
    print(f'{t[:28]:28} {"%d,%d,%d,%d" % (x0/S, y0/S, x1/S, y1/S):>24} {d[0]:6.1f} {d[1]:6.1f} {d[2]:6.1f} {d[3]:6.1f}  {m[5][:40]}{flag}')
for i, r in enumerate(w):
    if i not in used: print(f'  web-only: {r[0][:40]}')
