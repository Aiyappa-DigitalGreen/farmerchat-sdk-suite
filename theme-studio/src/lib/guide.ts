/* FarmerChat SDK integration guide — content model + build-time-equivalent highlighter.
 *
 * `guide.data.json` is the SAME content model that generates the shareable
 * integration-guide artifact, serialized into the repo so it is no longer
 * session-scoped. Every platform carries the identical ordered section list, so
 * format parity across the seven flavours is structural, not hand-maintained.
 *
 * NO-HALLUCINATION: the JSON is generated from the guide source, which is itself
 * derived from the SDK trees. Versions differ PER PLATFORM and are never stated
 * globally here — android publishes 2.0.0 (root `build.gradle.kts` farmerChatVersion,
 * confirmed against the published POM); the iOS podspec, web `core/version.ts` and
 * the RN package.json still declare 1.0.0. See `sdk.ts` for the same rule.
 */
import raw from "./guide.data.json"

export type GuideBlock =
  | { k: "p" | "sub"; html: string }
  | { k: "code"; tabs: { label: string; lang: string; fname: string | null; code: string }[] }
  | { k: "table"; head: string[]; rows: string[][] }
  | { k: "note" | "warn"; tag: string; paras: string[] }

export interface GuideSection {
  id: string
  title: string
  blocks: GuideBlock[]
}

export interface GuidePlatform {
  id: string
  name: string
  flavour: string
  badge: string
  intro: string[]
  sections: GuideSection[]
}

export const GUIDE = raw as unknown as GuidePlatform[]

/* ---------------------------------------------------------------- highlight */

const KW: Record<string, string> = {
  kotlin:
    "class|object|fun|val|var|override|import|package|private|internal|public|return|if|else|when|is|in|by|as|true|false|null|super|this|companion",
  java: "class|public|private|static|void|final|new|import|package|return|if|else|true|false|null|super|this|extends|implements",
  swift:
    "import|struct|class|enum|func|let|var|private|public|override|return|if|else|guard|some|self|true|false|nil|init|extension|async|await|weak|targets|dependencies",
  objc: "return|if|else|YES|NO|nil|self|id|BOOL|void|instancetype",
  ts: "import|export|from|const|let|var|function|return|if|else|true|false|null|undefined|async|await|class|interface|type|new|default",
  groovy: "dependencies|implementation|repositories|maven|url|plugins|id|def",
  ruby: "pod",
  shell: "npm|yarn|pnpm|cd|install|add",
  xml: "",
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

/** Token-stash highlighter. Placeholders are \0N\0 so they can never collide
 *  with real digits in the source (e.g. `minSdk 26`, a `999` radius) — that
 *  collision was a real bug in an earlier space-delimited version. */
export function highlight(code: string, lang: string): string {
  let s = escapeHtml(code)
  const store: string[] = []
  const stash = (cls: string, txt: string) => {
    store.push(`<span class="${cls}">${txt}</span>`)
    return `\0${store.length - 1}\0`
  }
  // comments, then strings — order matters
  s = s.replace(/(\/\/[^\n]*|#[^\n]*|&lt;!--[\s\S]*?--&gt;)/g, (m) => stash("t-c", m))
  s = s.replace(
    /(&quot;(?:[^&\\\n]|\\.|&(?!quot;))*&quot;|&#x27;(?:[^&\\\n]|\\.|&(?!#x27;))*&#x27;)/g,
    (m) => stash("t-s", m),
  )
  s = s.replace(/(@[A-Za-z_]\w*)/g, (m) => stash("t-a", m))
  const kw = KW[lang] ?? KW.ts
  if (kw) s = s.replace(new RegExp(`\\b(${kw})\\b`, "g"), '<span class="t-k">$1</span>')
  s = s.replace(/\b([A-Z][A-Za-z0-9_]{2,})\b/g, '<span class="t-n">$1</span>')
  s = s.replace(/\0(\d+)\0/g, (_m, n: string) => store[Number(n)])
  return s
}
