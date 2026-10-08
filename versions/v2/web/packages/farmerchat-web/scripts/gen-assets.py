#!/usr/bin/env python3
"""Copy the compose module's raster drawables into src/ui/assets/, shrinking the big blurred ones.

fc_boot_bg (a smooth gradient) and the two glows are soft enough that a small re-encode, scaled
back up by the browser, is visually identical, so the inlined bundle carries ~10 KB instead of
~360 KB. Needs Pillow.   python3 scripts/gen-assets.py
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '../../../../android/farmerchat-android-compose/src/main/res/drawable'))
OUT = os.path.join(HERE, '../src/ui/assets')
os.makedirs(OUT, exist_ok=True)

SHRINK = {'fc_boot_bg.webp': 8, 'fc_glow_green.png': 4, 'fc_glow_yellow.png': 4}
COPY = ['fc_weather_rain.png', 'fc_weather_sun.png', 'fc_weather_sunclouds.png', 'fc_flag_india.png']

for name, f in SHRINK.items():
    im = Image.open(os.path.join(SRC, name))
    print(name, im.size, '->', end=' ')
    im = im.resize((max(1, im.width // f), max(1, im.height // f)), Image.LANCZOS)
    dst = os.path.join(OUT, os.path.splitext(name)[0].removeprefix('fc_') + '.webp')
    im.save(dst, 'WEBP', quality=85, method=6)
    print(im.size, os.path.getsize(dst), 'bytes')
for name in COPY:
    data = open(os.path.join(SRC, name), 'rb').read()
    open(os.path.join(OUT, name.removeprefix('fc_')), 'wb').write(data)
    print(name, len(data), 'bytes')
