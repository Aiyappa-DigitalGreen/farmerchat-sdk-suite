# -*- coding: utf-8 -*-
import re, html, io, os, sys
from content import *
from plat_android import COMPOSE, VIEWS
from plat_ios import SWIFTUI, UIKIT, OBJC
from plat_js import RN, WEB

PLATFORMS = [COMPOSE, VIEWS, SWIFTUI, UIKIT, OBJC, RN, WEB]

KW = {
 "kotlin":"class|object|fun|val|var|override|import|package|private|internal|public|return|if|else|when|is|in|by|as|true|false|null|super|this|companion",
 "java":"class|public|private|static|void|final|new|import|package|return|if|else|true|false|null|super|this|extends|implements",
 "swift":"import|struct|class|enum|func|let|var|private|public|override|return|if|else|guard|some|self|true|false|nil|init|extension|async|await|weak|targets|dependencies",
 "objc":"return|if|else|YES|NO|nil|self|id|BOOL|void|instancetype",
 "ts":"import|export|from|const|let|var|function|return|if|else|true|false|null|undefined|async|await|class|interface|type|new|default",
 "groovy":"dependencies|implementation|repositories|maven|url|plugins|id|def",
 "ruby":"pod",
 "shell":"npm|yarn|pnpm|cd|install|add",
 "xml":"",
}

def highlight(code, lang):
    """Build-time highlighting. Placeholders are \x00N\x00 so they can never
    collide with digits in the source (the bug in the first attempt)."""
    s = html.escape(code)
    store = []
    def stash(cls, txt):
        store.append('<span class="%s">%s</span>' % (cls, txt))
        return "\x00%d\x00" % (len(store)-1)
    # comments, then strings — order matters
    s = re.sub(r"(//[^\n]*|#[^\n]*|&lt;!--.*?--&gt;)", lambda m: stash("t-c", m.group(0)), s, flags=re.S)
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

def render():
    nav, body = [], []
    for pl in PLATFORMS:
        pid = pl["id"]
        nav.append('<li class="nav-plat"><a class="nav-plat-a" href="#%s">%s'
                   '<span class="nav-flavour">%s</span></a><ol class="nav-secs">%s</ol></li>' % (
            pid, pl["name"], pl["flavour"],
            "".join('<li><a href="#%s-%s">%s</a></li>' % (pid, s["id"], s["title"]) for s in pl["sections"])))
        secs = "".join(
            '<section class="sec" id="%s-%s"><h3>%s</h3>%s</section>' % (
                pid, s["id"], s["title"], "".join(render_block(b) for b in s["blocks"]))
            for s in pl["sections"])
        body.append(
            '<article class="platform" id="%s">'
            '<header class="plat-head"><p class="plat-kicker">Platform</p>'
            '<h2>%s <span class="plat-flavour">%s</span></h2>'
            '<p class="plat-badge">%s</p>%s</header>%s</article>' % (
              pid, pl["name"], pl["flavour"], html.escape(pl["badge"]),
              "".join("<p class=\"plat-intro\">%s</p>" % t for t in pl["intro"]), secs))
    return "".join(nav), "".join(body)

def dump_json(path):
    """Emit the same content model theme-studio renders, so the shareable
    artifact and the Studio's Get SDK tab cannot drift apart."""
    import json, os
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


NAV, BODY = render()
CSS = io.open("style.css", encoding="utf-8").read()
JS  = io.open("enhance.js", encoding="utf-8").read()
SHELL = io.open("shell.html", encoding="utf-8").read()
out = SHELL.replace("{{CSS}}", CSS).replace("{{NAV}}", NAV).replace("{{BODY}}", BODY).replace("{{JS}}", JS)
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
html_out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "farmerchat-sdk-docs.html")
json_out = os.path.join(REPO, "theme-studio", "src", "lib", "guide.data.json")
io.open(html_out, "w", encoding="utf-8").write(out)
print("html     :", html_out)
print("json     :", json_out, "(%d platforms)" % dump_json(json_out))
print("platforms:", len(PLATFORMS))
print("sections :", sum(len(p["sections"]) for p in PLATFORMS))
print("code blks:", _cb[0])
print("bytes    :", len(out))
for bad in ("\x00","undefined","None</"):
    print("contains %-10r : %s" % (bad, bad in out))
