#!/usr/bin/env python3
"""Compare the DESIGN VALUES of an app composable against the SDK's port.

Pixel capture cannot reach a dialog that needs a ToS version bump or a twice-denied
permission. The app source can. This extracts the ordered sequence of design constants a
composable uses -- dp/sp numbers, colour tokens, typography slots, shape radii -- and diffs
the multisets, so a 16dp that should be 20dp, or a `foregroundSecondary` that should be
`foregroundPrimary`, shows up without rendering anything.

It is a screening tool, not proof: it ignores WHERE a value is used. Every hit it reports
still has to be read in context before it is called a defect.
"""
import re, sys, collections

def body(path, fn):
    src = open(path, errors="ignore").read()
    m = re.search(r'(?:private\s+)?fun\s+' + re.escape(fn) + r'\s*\(', src)
    if not m:
        return None
    # Skip the PARAMETER LIST first. `src.index("{", ...)` grabbed a default-argument lambda
    # (`onOpenUrl: (...) -> Unit = { _, _ -> }`) as the body and reported zero values for every
    # screen that has one.
    k, pdepth = m.end() - 1, 0
    while k < len(src):
        if src[k] == "(": pdepth += 1
        elif src[k] == ")":
            pdepth -= 1
            if pdepth == 0: break
        k += 1
    i = src.index("{", k)
    depth, j = 0, i
    while j < len(src):
        if src[j] == "{": depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0: break
        j += 1
    return src[i:j]

def values(text):
    if text is None: return None
    text = re.sub(r'//[^\n]*', '', text)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    out = collections.Counter()
    for m in re.finditer(r'(\d+(?:\.\d+)?)\s*\.\s*(dp|sp)\b', text):
        out[f"{m.group(1)}{m.group(2)}"] += 1
    for m in re.finditer(r'\b(?:colors|brandColors|brand)\.(\w+)', text):
        out[f"color:{m.group(1)}"] += 1
    for m in re.finditer(r'typography\.(\w+)', text):
        out[f"type:{m.group(1)}"] += 1
    for m in re.finditer(r'\bRadius\.(\w+)', text):
        out[f"radius:{m.group(1)}"] += 1
    for m in re.finditer(r'\bFontWeight\.(\w+)|FontWeight\((\d+)\)', text):
        out[f"weight:{m.group(1) or m.group(2)}"] += 1
    return out

app_f, sdk_f, fn = sys.argv[1], sys.argv[2], sys.argv[3]
a, s = values(body(app_f, fn)), values(body(sdk_f, sys.argv[4] if len(sys.argv) > 4 else fn))
if a is None: print(f"  !! {fn} not found in app file"); sys.exit(0)
if s is None: print(f"  !! {fn} not found in sdk file"); sys.exit(0)
diff = []
for k in sorted(set(a) | set(s)):
    if a[k] != s[k]:
        diff.append(f"    {k:34} app x{a[k]}  sdk x{s[k]}")
print(f"  {fn}: {len(a)} distinct app values, {len(diff)} differ")
for d in diff: print(d)
