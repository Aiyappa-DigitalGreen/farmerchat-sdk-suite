# -*- coding: utf-8 -*-
"""Builds the FarmerChat SDK integration guide from one content model.

Outputs:
  versions/v2/web/railway/guide/index.html   the hosted guide (served at / and /guide/)
  theme-studio/src/lib/guide.data.json       Theme Studio's "Get SDK" tab

    python3 tools/guide-gen/build.py             # both outputs
    python3 tools/guide-gen/build.py /tmp/x.html # HTML elsewhere; JSON path is fixed
"""
import base64, html, io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)

from content import VERSION
from plat_android import COMPOSE, VIEWS
from plat_ios import SWIFTUI, UIKIT, OBJC
from plat_js import RN, WEB

PLATFORMS = [COMPOSE, VIEWS, SWIFTUI, UIKIT, OBJC, RN, WEB]

# Page chrome per platform: rail icon (SVG body, 24x24), the short name the phone-width rail shows,
# and the three quick-start steps. Each step names a SUB heading in one of the platform's sections;
# the step takes that heading as its title, the paragraph right after it (if any) and the first tab
# of the next code block, so the quick start can never drift from the full guide.
SITE = {
 "android-compose": ("Compose",
   '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
   [("install", "Add the dependency to your app"), ("launch", "Initialize the SDK"), ("launch", "Open the journey")]),
 "android-views": ("XML Views",
   '<rect x="3" y="4" width="18" height="4" rx="1.2"/><rect x="3" y="10" width="18" height="4" rx="1.2"/><rect x="3" y="16" width="18" height="4" rx="1.2"/>',
   [("install", "Add the dependency to your app"), ("launch", "Initialize the SDK"), ("launch", "Open the journey")]),
 "ios-swiftui": ("SwiftUI",
   '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
   [("install", "Add the package to your project"), ("launch", "Initialize the SDK"), ("launch", "Present the journey")]),
 "ios-uikit": ("UIKit",
   '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
   [("install", "Add the package to your project"), ("launch", "Initialize the SDK"), ("launch", "Present the journey")]),
 "ios-objc": ("Objective-C",
   '<path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 2.5-2 3 1 .5 2 1.5 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5 1 2.5 2 3-1 .5-2 1.5-2 3v2c0 2-1 3-3 3"/>',
   [("install", "Add the package to your project"), ("launch", "Initialize the SDK"), ("launch", "Present the journey")]),
 "react-native": ("React Native",
   '<ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.4"/>',
   [("install", "Add the package"), ("launch", "Initialize the SDK"), ("launch", "Render the journey")]),
 "web": ("Web",
   '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c3 3 3 16 0 19M12 2.5c-3 3-3 16 0 19"/>',
   [("install", "Add the package"), ("launch", "Initialize the SDK"), ("launch", "Render the journey")]),
}

KW = {
 "kotlin":"class|object|fun|val|var|override|import|package|private|internal|public|return|if|else|when|is|in|by|as|true|false|null|super|this|companion",
 "java":"class|public|private|static|void|final|new|import|package|return|if|else|true|false|null|super|this|extends|implements",
 "swift":"import|struct|class|enum|func|let|var|private|public|override|return|if|else|guard|some|self|true|false|nil|init|extension|async|await|weak|targets|dependencies",
 "objc":"return|if|else|YES|NO|nil|self|id|BOOL|void|instancetype",
 "ts":"import|export|from|const|let|var|function|return|if|else|true|false|null|undefined|async|await|class|interface|type|new|default",
 "groovy":"dependencies|implementation|repositories|maven|url|plugins|id|def",
 "ruby":"pod",
 "shell":"npm|npx|yarn|pnpm|cd|install|add",
 "xml":"",
}

def highlight(code, lang):
    """Build-time highlighting. Placeholders are \\x00N\\x00 so they can never
    collide with digits in the source (the bug in the first attempt).
    Keep in step with theme-studio/src/lib/guide.ts `highlight`."""
    s = html.escape(code)
    store = []
    def stash(cls, txt):
        store.append('<span class="%s">%s</span>' % (cls, txt))
        return "\x00%d\x00" % (len(store)-1)
    # comments, then strings — order matters. `(?<!&)#` keeps the escaped quote `&#x27;` from
    # being read as a shell/Ruby comment.
    s = re.sub(r"(//[^\n]*|(?<!&)#[^\n]*|&lt;!--.*?--&gt;)", lambda m: stash("t-c", m.group(0)), s, flags=re.S)
    s = re.sub(r"(&quot;(?:[^&\\\n]|\\.|&(?!quot;))*&quot;|&#x27;(?:[^&\\\n]|\\.|&(?!#x27;))*&#x27;)",
               lambda m: stash("t-s", m.group(0)), s)
    s = re.sub(r"(@[A-Za-z_][\w]*)", lambda m: stash("t-a", m.group(0)), s)
    kw = KW.get(lang, KW["ts"])
    if kw:
        s = re.sub(r"\b(%s)\b" % kw, r'<span class="t-k">\1</span>', s)
    s = re.sub(r"\b([A-Z][A-Za-z0-9_]{2,})\b", r'<span class="t-n">\1</span>', s)
    s = re.sub(r"\x00(\d+)\x00", lambda m: store[int(m.group(1))], s)
    return s

_cb = [0]
def render_code(tabs):
    _cb[0] += 1
    gid = "cb%d" % _cb[0]
    heads, panes = [], []
    for i,(label,lang,fname,code) in enumerate(tabs):
        heads.append('<button class="cb-tab" type="button" role="tab" aria-selected="%s" '
                     'data-cb="%s" data-i="%d">%s</button>' % ("true" if i==0 else "false", gid, i, html.escape(label)))
        panes.append('<div class="cb-pane" data-cb="%s" data-i="%d"%s>%s<pre><code>%s</code></pre></div>' % (
            gid, i, "" if i==0 else ' hidden',
            ('<div class="fname">%s</div>' % html.escape(fname)) if fname else "",
            highlight(code, lang)))
    tabbar = ('<div class="cb-tabs" role="tablist">%s</div>' % "".join(heads)) if len(tabs)>1 else \
             ('<div class="cb-tabs single">%s</div>' % html.escape(tabs[0][0]))
    return ('<div class="cb" id="%s"><div class="cb-bar">%s'
            '<button class="cb-copy" type="button">Copy</button></div>%s</div>'
            % (gid, tabbar, "".join(panes)))

def render_block(b):
    k = b[0]
    if k=="p":    return "<p>%s</p>" % b[1]
    if k=="sub":  return "<h4 class=\"sub\">%s</h4>" % b[1]
    if k=="code": return render_code(b[1])
    if k=="table":
        head, rows = b[1], b[2]
        return ('<div class="tw"><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (
            "".join("<th>%s</th>" % h for h in head),
            "".join("<tr>%s</tr>" % "".join("<td>%s</td>" % c for c in r) for r in rows)))
    if k in ("note","warn"):
        return ('<div class="note%s"><span class="tag">%s</span>%s</div>' % (
            " warn" if k=="warn" else "", b[1], "".join("<p>%s</p>" % x for x in b[2])))
    raise ValueError("unknown block %r" % (k,))

def ico(svg, cls="ico"):
    return '<svg class="%s" viewBox="0 0 24 24" aria-hidden="true">%s</svg>' % (cls, svg)

def render_rail():
    items = []
    for pl in PLATFORMS:
        pid = pl["id"]; short, svg, _ = SITE[pid]
        items.append(
            '<li class="ptab" data-plat="%s"><a class="ptab-a" href="#%s">%s<span class="ptab-t">'
            '<span class="ptab-n">%s</span><span class="ptab-f">%s</span></span><span class="ptab-s">%s</span></a>'
            '<ol class="ptab-secs">%s</ol></li>' % (
                pid, pid, ico(svg), pl["name"], pl["flavour"], short,
                "".join('<li><a class="sec-link" href="#%s-%s">%s</a></li>' % (pid, s["id"], s["title"])
                        for s in pl["sections"])))
    return ('<aside class="rail" aria-label="Platforms and sections"><p class="rail-t">Platforms &amp; sections</p>'
            '<ol class="ptabs">%s</ol></aside>' % "".join(items))

def render_body():
    out = []
    for pl in PLATFORMS:
        pid = pl["id"]
        secs = "".join(
            '<section class="sec" id="%s-%s"><h3>%s</h3>%s</section>' % (
                pid, s["id"], s["title"], "".join(render_block(b) for b in s["blocks"]))
            for s in pl["sections"])
        out.append(
            '<article class="platform" id="%s">'
            '<header class="plat-head"><p class="plat-kicker">Platform</p>'
            '<h2>%s <span class="plat-flavour">%s</span></h2>'
            '<p class="plat-badge">%s</p>%s</header>%s</article>' % (
              pid, pl["name"], pl["flavour"], html.escape(pl["badge"]),
              "".join("<p class=\"plat-intro\">%s</p>" % t for t in pl["intro"]), secs))
    return "".join(out)

def find_step(pl, sec_id, sub_title):
    """(paragraph html or None, first tab of the next code block) after a SUB heading."""
    sec = next(s for s in pl["sections"] if s["id"] == sec_id)
    blocks = sec["blocks"]
    i = next(i for i, b in enumerate(blocks) if b[0] == "sub" and b[1] == sub_title)
    # Install steps stay code-only; their paragraphs are about the alternatives in the full section.
    para = blocks[i+1][1] if blocks[i+1][0] == "p" and sec_id != "install" else None
    code = next(b for b in blocks[i+1:] if b[0] == "code")
    return para, code[1][0]

def render_steps():
    chips, lists = [], []
    for n, pl in enumerate(PLATFORMS):
        pid = pl["id"]; _, svg, steps = SITE[pid]
        chips.append('<button type="button" class="st-chip" data-st="%s" aria-pressed="%s">%s<span>%s</span><i>%s</i></button>'
                     % (pid, "true" if n == 0 else "false", ico(svg), pl["name"], pl["flavour"]))
        lis = []
        for k, (sec_id, sub_title) in enumerate(steps, 1):
            para, (label, lang, fname, code) = find_step(pl, sec_id, sub_title)
            lis.append(
                '<li class="st-step"><div class="st-text"><span class="st-num">%d</span><h3 class="st-t">%s</h3>%s'
                '<a class="st-more" href="#%s-%s">Full section <span aria-hidden="true">&rarr;</span></a></div>'
                '<div class="st-code"><div class="st-file">%s</div>%s<pre><code>%s</code></pre></div></li>' % (
                    k, sub_title, ("<p>%s</p>" % para) if para else "", pid, sec_id, html.escape(label),
                    ('<div class="fname">%s</div>' % html.escape(fname)) if fname else "", highlight(code, lang)))
        lists.append('<ol class="st-list" data-st="%s"%s>%s</ol>' % (pid, "" if n == 0 else " hidden", "".join(lis)))
    return ('<div class="st-chips" role="group" aria-label="Platform">%s</div>' % "".join(chips)), "".join(lists)

def dump_json(path):
    """Emit the same content model theme-studio renders, so the hosted guide
    and the Studio's Get SDK tab cannot drift apart."""
    def blk(b):
        k = b[0]
        if k in ("p", "sub"):    return {"k": k, "html": b[1]}
        if k == "code":          return {"k": "code", "tabs": [{"label": l, "lang": g, "fname": f, "code": c} for (l, g, f, c) in b[1]]}
        if k == "table":         return {"k": "table", "head": list(b[1]), "rows": [list(r) for r in b[2]]}
        if k in ("note", "warn"): return {"k": k, "tag": b[1], "paras": list(b[2])}
        raise ValueError(k)
    data = [{"id": p["id"], "name": p["name"], "flavour": p["flavour"], "badge": p["badge"],
             "intro": list(p["intro"]),
             "sections": [{"id": s["id"], "title": s["title"], "blocks": [blk(b) for b in s["blocks"]]}
                          for s in p["sections"]]} for p in PLATFORMS]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    io.open(path, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=1))
    return len(data)

def read(name, mode="r"):
    p = os.path.join(HERE, name)
    return io.open(p, "rb").read() if mode == "rb" else io.open(p, encoding="utf-8").read()

def main():
    chips, lists = render_steps()
    hero = "data:image/webp;base64," + base64.b64encode(read("hero-chat.webp", "rb")).decode("ascii")
    # Body placeholders first: CSS/JS are substituted last so nothing inside them is re-scanned.
    out = read("site.html")
    for key, val in (("{{STEP_CHIPS}}", chips), ("{{STEP_LISTS}}", lists), ("{{RAIL}}", render_rail()),
                     ("{{BODY}}", render_body()), ("{{VERSION}}", VERSION), ("{{HERO_IMG}}", hero),
                     ("{{CSS}}", read("style.css")), ("{{JS}}", read("enhance.js"))):
        assert key in out, key
        out = out.replace(key, val)
    html_out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "versions", "v2", "web", "railway", "guide", "index.html")
    json_out = os.path.join(REPO, "theme-studio", "src", "lib", "guide.data.json")
    io.open(html_out, "w", encoding="utf-8").write(out)
    print("html     :", html_out)
    print("json     :", json_out, "(%d platforms)" % dump_json(json_out))
    print("version  :", VERSION)
    print("sections :", sum(len(p["sections"]) for p in PLATFORMS))
    print("code blks:", _cb[0])
    print("bytes    :", len(out))
    bad = [b for b in ("\x00", "guestApiKey", "None</") if b in out] + re.findall(r"\{\{[A-Z_]+\}\}", out)
    if bad:
        sys.exit("output contains %r" % bad)

if __name__ == "__main__":
    main()
