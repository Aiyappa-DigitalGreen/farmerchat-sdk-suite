#!/usr/bin/env python3
"""Pixel-fidelity diff between the FarmerChat app and the SDK sample.

Both are driven to the same screen on the same emulator, against the same backend and
language, and screenshotted. This reduces each screenshot to horizontal *bands* of ink —
contiguous row ranges that contain non-background pixels — and reports the per-band delta.

A band is a text line, a filled card, or a button: anything that paints. Comparing bands
rather than raw pixels is what makes the diff readable, because it survives antialiasing
and 1-off rasterisation noise while still catching a 2dp spacing error.

    python3 tools/fidelity/banddiff.py app.png sdk.png [--top 150] [--bottom 2340]

Exit status is 0 when every band matches, 1 otherwise, so it can gate a fidelity check.

Two rules learned the hard way, both of which produce false diffs if ignored:

  * RELAUNCH BOTH before capturing. On a fresh install the app resolves its language after
    first paint, so its per-script typography (Kannada titleLarge is 22/32, Latin is 22/28)
    is one frame behind and every multi-line text measures differently.
  * Compare the SAME LANGUAGE. A Kannada/English pair cannot be band-diffed at all.
"""
import sys

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("banddiff needs Pillow: python3 -m pip install pillow")

DENSITY = 2.625  # 420 dpi, the rs_qa emulator
INK = 200        # mean channel value below which a pixel counts as ink
MARGIN = 40      # ignore the outermost columns: rounded corners and scrollbars live there


def bands(im, y0, y1):
    """Contiguous row ranges containing ink, each with its x extent."""
    w, _ = im.size
    out, start = [], None
    for y in range(y0, y1):
        row_has_ink = any(
            sum(im.getpixel((x, y))) / 3 < INK for x in range(MARGIN, w - MARGIN)
        )
        if row_has_ink and start is None:
            start = y
        elif not row_has_ink and start is not None:
            out.append((start, y - 1))
            start = None
    if start is not None:
        out.append((start, y1))
    return [(a, b) + (extent(im, a, b),) for a, b in out]


def extent(im, y0, y1):
    w, _ = im.size
    xs = [
        x for x in range(w)
        if any(sum(im.getpixel((x, y))) / 3 < INK for y in range(y0, y1 + 1))
    ]
    return (min(xs), max(xs)) if xs else (0, 0)


def main(argv):
    if len(argv) < 3:
        sys.exit(__doc__)
    app_path, sdk_path = argv[1], argv[2]
    top = int(argv[argv.index("--top") + 1]) if "--top" in argv else 150
    bottom = int(argv[argv.index("--bottom") + 1]) if "--bottom" in argv else 2340

    a = bands(Image.open(app_path).convert("RGB"), top, bottom)
    s = bands(Image.open(sdk_path).convert("RGB"), top, bottom)

    if len(a) != len(s):
        # A band-count mismatch means one side paints something the other does not —
        # a missing divider, an extra line of wrapped text. Print both so it is obvious.
        print(f"BAND COUNT DIFFERS: app {len(a)}, sdk {len(s)}\n")
        for label, bs in (("APP", a), ("SDK", s)):
            print(label)
            for y0, y1, (x0, x1) in bs:
                print(f"   y {y0:4d}..{y1:4d}  x {x0:4d}..{x1:4d}")
        return 1

    worst = 0
    for i, (ab, sb) in enumerate(zip(a, s)):
        d = (sb[0] - ab[0], sb[1] - ab[1], sb[2][0] - ab[2][0], sb[2][1] - ab[2][1])
        worst = max(worst, max(abs(v) for v in d))
        flag = "" if not any(d) else "   <-- DIFF"
        print(
            f"band {i:2d}  app y{ab[0]:4d}..{ab[1]:4d} x{ab[2][0]:4d}..{ab[2][1]:4d}"
            f" | dy {d[0]:+3d}/{d[1]:+3d} dx {d[2]:+3d}/{d[3]:+3d}{flag}"
        )
    print(f"\n{len(a)} bands | max deviation {worst} px ({worst / DENSITY:.2f} dp)")
    return 0 if worst == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
