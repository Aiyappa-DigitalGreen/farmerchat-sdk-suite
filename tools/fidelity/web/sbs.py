#!/usr/bin/env python3
"""sbs.py NAME [y0 y1] — android | web | 50% overlay, side by side, cropped to y0..y1 (px)."""
import sys
from PIL import Image, ImageChops
n = sys.argv[1]
a = Image.open(f'android/{n}.png').convert('RGB')
w = Image.open(f'web/{n}.png').convert('RGB').resize(a.size)
# web has no status/nav bar: paint Android's bars onto web so only content differs
y0 = int(sys.argv[2]) if len(sys.argv) > 2 else 0
y1 = int(sys.argv[3]) if len(sys.argv) > 3 else a.height
a, w = a.crop((0, y0, a.width, y1)), w.crop((0, y0, w.width, y1))
blend = Image.blend(a, w, 0.5)
out = Image.new('RGB', (a.width * 3 + 40, a.height), 'white')
for i, im in enumerate((a, w, blend)): out.paste(im, (i * (a.width + 20), 0))
out = out.resize((out.width // 2, out.height // 2))
out.save(f'sbs-{n}.png'); print(f'sbs-{n}.png')
