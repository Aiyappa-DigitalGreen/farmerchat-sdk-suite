/* FarmerChat SDK — full integration guide, all seven platform flavours.
 *
 * This renders the SAME content model as the shareable integration-guide
 * artifact (`lib/guide.data.json`), so the Studio and the artifact cannot drift.
 * It is ADDITIVE to the themed download cards above it: those carry the user's
 * live theme, which static docs cannot, and remain the primary path.
 *
 * Nav is always visible — a sidebar at >=1000px, a <details> disclosure below.
 * It is never display:none'd, because a previous version's max-width rule made
 * the navigation disappear entirely inside narrow embeds. */
import { useMemo, useState } from "react"
import { GUIDE, highlight, type GuideBlock, type GuidePlatform } from "@/lib/guide"
import "./guide.css"

/* The guide's HTML comes from our own checked-in content model (build-time
 * generated from the SDK trees), never from user input or the network. */
function Html({ as: Tag = "p", html, className }: { as?: "p" | "h4" | "td" | "th"; html: string; className?: string }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

function CodeBlock({ tabs }: { tabs: Extract<GuideBlock, { k: "code" }>["tabs"] }) {
  const [i, setI] = useState(0)
  const [copied, setCopied] = useState(false)
  const active = tabs[i]
  const rendered = useMemo(() => highlight(active.code, active.lang), [active])

  function copy() {
    navigator.clipboard.writeText(active.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  return (
    <div className="fcg-cb">
      <div className="fcg-cb-bar">
        {tabs.length > 1 ? (
          <div className="fcg-cb-tabs" role="tablist">
            {tabs.map((t, n) => (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={n === i}
                className="fcg-cb-tab"
                onClick={() => setI(n)}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="fcg-cb-tabs single">{tabs[0].label}</div>
        )}
        <button type="button" className="fcg-cb-copy" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {active.fname ? <div className="fcg-fname">{active.fname}</div> : null}
      <pre>
        <code dangerouslySetInnerHTML={{ __html: rendered }} />
      </pre>
    </div>
  )
}

function Block({ b }: { b: GuideBlock }) {
  switch (b.k) {
    case "p":
      return <Html html={b.html} />
    case "sub":
      return <Html as="h4" className="fcg-sub" html={b.html} />
    case "code":
      return <CodeBlock tabs={b.tabs} />
    case "table":
      return (
        <div className="fcg-tw">
          <table>
            <thead>
              <tr>{b.head.map((h) => <Html key={h} as="th" html={h} />)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, n) => (
                <tr key={n}>{r.map((c, m) => <Html key={m} as="td" html={c} />)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case "note":
    case "warn":
      return (
        <div className={b.k === "warn" ? "fcg-note fcg-warn" : "fcg-note"}>
          <span className="fcg-tag" dangerouslySetInnerHTML={{ __html: b.tag }} />
          {b.paras.map((p, n) => <Html key={n} html={p} />)}
        </div>
      )
  }
}

function Nav({ active, onPick }: { active: string; onPick: (id: string) => void }) {
  return (
    <nav className="fcg-nav" aria-label="Integration guide">
      <p className="fcg-nav-title">Platforms</p>
      {GUIDE.map((p) => (
        <div key={p.id}>
          <button
            type="button"
            className="fcg-nav-plat"
            aria-current={p.id === active}
            onClick={() => onPick(p.id)}
          >
            <span>{p.name}</span>
            <span className="fcg-nav-flavour">{p.flavour}</span>
          </button>
          {p.id === active ? (
            <ol className="fcg-nav-secs">
              {p.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#fcg-${p.id}-${s.id}`}>{s.title}</a>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ))}
    </nav>
  )
}

function Platform({ p }: { p: GuidePlatform }) {
  return (
    <article>
      <header className="fcg-plat-head">
        <p className="fcg-kicker">Platform</p>
        <h2>
          {p.name} <span className="fcg-plat-flavour">{p.flavour}</span>
        </h2>
        <p className="fcg-badge">{p.badge}</p>
        {p.intro.map((t, n) => <Html key={n} className="fcg-intro" html={t} />)}
      </header>
      {p.sections.map((s) => (
        <section className="fcg-sec" id={`fcg-${p.id}-${s.id}`} key={s.id}>
          <h3>{s.title}</h3>
          {s.blocks.map((b, n) => <Block key={n} b={b} />)}
        </section>
      ))}
    </article>
  )
}

export function IntegrationGuide() {
  const [active, setActive] = useState(GUIDE[0].id)
  const platform = GUIDE.find((p) => p.id === active) ?? GUIDE[0]

  return (
    <div className="fcg">
      <aside className="fcg-nav-aside">
        <Nav active={active} onPick={setActive} />
      </aside>
      <details className="fcg-nav-details">
        <summary>
          Jump to a platform — {platform.name} {platform.flavour}
        </summary>
        <Nav active={active} onPick={setActive} />
      </details>
      <div className="fcg-body">
        <Platform p={platform} />
      </div>
    </div>
  )
}
