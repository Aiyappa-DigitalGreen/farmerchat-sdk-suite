#!/usr/bin/env python3
"""Exact pixel diff between an app screenshot and the SDK's, for screens that band-diff
cannot read.

`banddiff` reduces a screen to rows-containing-ink, which works beautifully on light screens
with discrete text lines. It saturates on anything with a full-bleed coloured area — Home's
green header makes every row "ink" and the whole screen collapses to one band. This does the
straight comparison instead and reports where the two images actually differ.

    python3 tools/fidelity/pixdiff.py app.png sdk.png [--tolerance 28] [--skip-top 110]

`--skip-top` drops the status bar, whose clock and signal icons always differ. `--tolerance`
is the per-channel delta below which a pixel counts as equal; it absorbs gradient dithering
and the Home sunbeams, which animate and so never match frame-to-frame. A clean screen comes
back well under tolerance — Home measured a max channel delta of 25 with zero pixels flagged.

Exit status is 0 when nothing exceeds tolerance, 1 otherwise.
"""
import sys

try:
    from PIL import Image, ImageChops
except ImportError:  # pragma: no cover
    sys.exit("pixdiff needs Pillow: python3 -m pip install pillow")

DENSITY = 2.625


def arg(argv, name, default):
    return int(argv[argv.index(name) + 1]) if name in argv else default


def main(argv):
    if len(argv) < 3:
        sys.exit(__doc__)
    tol = arg(argv, "--tolerance", 28)
    skip_top = arg(argv, "--skip-top", 110)

    a = Image.open(argv[1]).convert("RGB")
    b = Image.open(argv[2]).convert("RGB")
    if a.size != b.size:
        sys.exit(f"size mismatch: {a.size} vs {b.size}")

    w, h = a.size
    box = (0, skip_top, w, h)
    grey = ImageChops.difference(a.crop(box), b.crop(box)).convert("L")
    peak = grey.getextrema()[1]

    # point() to a 0/1 mask, then one getdata() pass: orders of magnitude faster than
    # per-pixel getpixel(), which is slow enough on a 1080x2290 crop to look like a hang.
    mask = grey.point(lambda v: 255 if v > tol else 0)
    # list(): ImagingCore supports indexing but not slicing, and the per-row scan below slices.
    data = list(mask.getdata())
    mw, mh = mask.size
    total = sum(1 for v in data if v)

    print(f"max channel delta {peak}   pixels over tolerance({tol}): {total} "
          f"({100 * total / (mw * mh):.3f}%)")
    if total == 0:
        print("MATCH")
        return 0

    rows = [
        sum(1 for v in data[y * mw:(y + 1) * mw] if v)
        for y in range(mh)
    ]
    print("differing row ranges (device y):")
    start = None
    for y, n in enumerate(rows + [0]):
        if n > 6 and start is None:
            start = y
        elif n <= 6 and start is not None:
            if y - start > 2:
                print(f"   y {start + skip_top:4d}..{y + skip_top:4d}"
                      f"  h={y - start:4d} ({(y - start) / DENSITY:5.1f} dp)"
                      f"  peak {max(rows[start:y]):4d} px wide")
            start = None
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
