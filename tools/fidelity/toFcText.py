#!/usr/bin/env python3
"""Convert <TextView> elements in a STATIC views layout to FcText.

Static only. `FcText` is a composition host and was measured unusable in recycled rows
(99th-percentile frame 24ms -> 73ms); see FcText.kt.
"""
import re, sys

MAP_SIMPLE = {
    "android:textColor": "app:fcTextColor",
    "android:maxLines":  "app:fcMaxLines",
}

def convert(block: str) -> str:
    attrs = re.findall(r'(\S+)="([^"]*)"', block)
    out, size, weight, align, ellip = [], None, None, None, False
    for k, v in attrs:
        if k == "android:textSize":
            size = v.replace("sp", "").replace("dp", "")
        elif k == "android:textStyle":
            weight = "700" if "bold" in v else weight
        elif k == "android:textFontWeight":
            weight = v
        elif k == "android:ellipsize":
            ellip = (v == "end")
        elif k in ("android:textAlignment",):
            align = {"center": "center", "viewEnd": "end", "textEnd": "end"}.get(v)
        elif k == "android:gravity":
            if "center" in v and align is None: align = "center"
            out.append((k, v))            # keep: it also positions the view's content box
        elif k == "android:fontFamily":
            pass                          # FcText always uses the app's SansSerif
        elif k == "android:includeFontPadding":
            pass                          # Compose text has none
        elif k in MAP_SIMPLE:
            out.append((MAP_SIMPLE[k], v))
        elif k.startswith("tools:"):
            pass
        else:
            out.append((k, v))
    if size:   out.append(("app:fcTextSizeSp", size))
    if weight: out.append(("app:fcTextWeight", weight))
    if align:  out.append(("app:fcTextAlign", align))
    if ellip:  out.append(("app:fcEllipsize", "true"))
    indent = re.match(r'\s*', block).group(0).lstrip("\n")
    lines = [f'{indent}<org.digitalgreen.farmerchat.sdk.views.internal.widgets.FcText']
    for k, v in out:
        lines.append(f'{indent}    {k}="{v}"')
    lines[-1] += " />"
    return "\n".join(lines)

path = sys.argv[1]
src = open(path).read()
pat = re.compile(r'[ \t]*<TextView\b.*?/>', re.S)
n = 0
def repl(m):
    global n
    n += 1
    return convert(m.group(0))
out = pat.sub(repl, src)
open(path, "w").write(out)
print(f"  {path.split('/')[-1]}: {n} TextView -> FcText")
