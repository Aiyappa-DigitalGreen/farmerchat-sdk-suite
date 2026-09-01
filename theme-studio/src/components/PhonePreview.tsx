/* FarmerChat SDK preview — shadcn/ui rebuild.
 * The app screens are now composed from shadcn/ui primitives (Button, Card,
 * Input, RadioGroup, ToggleGroup, InputOTP, Badge, Avatar …) instead of the
 * hand-rolled SDK markup. The studio theme is bridged onto shadcn's design
 * tokens (--primary, --background, --card, --radius …) via shadcnVars(), so
 * every component re-themes live with the Controls panel. Night appearance adds
 * the `dark` class to the phone wrapper so components' dark: variants fire off
 * the phone, not the studio's <html>.dark. Precedence still honored:
 * chat/fab knob ?? theme token ?? built-in default.
 * The prior 1:1 SDK re-render is preserved in PhonePreview.faithful.tsx.bak. */
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import {
  Bookmark, Camera, ChevronRight, Clock, CloudSun, Info, Keyboard, Menu,
  Mic, Moon, Send, Share2, Smartphone, Sun, Volume2, X,
} from "lucide-react"
import type { ThemeState } from "@/lib/theme"
import { Logo } from "@/components/Logo"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import "./phone.css"

export type Appearance = "day" | "night"
export type Screen = "language" | "name" | "home" | "chat" | "auth" | "settings"

export const SCREENS: [Screen, string][] = [
  ["language", "Language"],
  ["name", "Name"],
  ["home", "Home"],
  ["chat", "Chat"],
  ["auth", "OTP"],
  ["settings", "Settings"],
]

const LANGS = ["English", "हिन्दी", "தமிழ்", "తెలుగు"]
const OPTS = ["1–2 acres", "3–5 acres", "5+ acres"]
const AI_REPLIES = [
  "Good question. A **soil test** first means you apply only what's needed — it saves cost and lifts yield.",
  "Quick tip: split fertilizer into **2–3 doses** across the season so the crop takes up more of it.",
  "For pests, describe the **leaf symptoms** — spots, curling, colour — and I can narrow down the cause.",
  "Water early morning or evening to cut evaporation. Aim for **deep, less-frequent** irrigation.",
]

interface Msg { role: "user" | "ai"; text: string; followups?: string[] }

function num(v: number | "", d: number): number {
  return v === "" || v == null || isNaN(v as number) ? d : Number(v)
}
function mdLite(t: string): string {
  return String(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>")
}

/** Bridge the studio ThemeState onto shadcn's design tokens (scoped to .phone).
 * Hex overrides replace the oklch defaults and cascade to every shadcn child. */
function shadcnVars(state: ThemeState, appearance: Appearance): CSSProperties {
  const c = state.colors, sh = state.shape, ty = state.typography, fb = state.fab
  const dark = appearance === "night"
  const bg = dark ? "#18181B" : c.background
  const card = dark ? "#27272A" : c.cardSurface
  const ink = dark ? "#FAFAFA" : c.onBackground
  const muted = dark ? "#27272A" : "#F4F4F5"
  const mutedFg = dark ? "#A1A1AA" : "#71717B"
  const border = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.10)"
  const v: Record<string, string | number> = {
    "--background": bg,
    "--foreground": ink,
    "--card": card,
    "--card-foreground": ink,
    "--popover": card,
    "--popover-foreground": ink,
    "--primary": c.brandPrimary,
    "--primary-foreground": c.onBrand,
    "--secondary": muted,
    "--secondary-foreground": ink,
    "--muted": muted,
    "--muted-foreground": mutedFg,
    "--accent": muted,
    "--accent-foreground": ink,
    "--destructive": c.error,
    "--border": border,
    "--input": border,
    "--ring": c.brandPrimary,
    "--radius": num(sh.buttonCornerRadius, 12) + "px",
    // Brand + FAB helpers (not part of the shadcn token set):
    "--fc-brand-dark": c.brandPrimaryDark,
    "--fc-accent": c.brandAccent,
    "--fc-fab-bg": fb.fabBackgroundColor || c.brandPrimary,
    "--fc-fab-fg": fb.fabContentColor || c.onBrand,
    "--fc-scale": ty.typeScale || 1,
  }
  if (ty.fontFamily) v.fontFamily = `"${ty.fontFamily}", system-ui, sans-serif`
  return v as CSSProperties
}

interface PreviewProps {
  theme: ThemeState
  appearance: Appearance
  setAppearance: (a: Appearance) => void
  screen: Screen
  setScreen: (s: Screen) => void
}

export function PhonePreview({ theme, appearance, setAppearance, screen, setScreen }: PreviewProps) {
  const [chatMsgs, setChatMsgs] = useState<Msg[]>([
    { role: "user", text: "What's the best fertilizer for wheat this season?" },
    { role: "ai", text: "For **wheat**, a balanced approach works well:\n1. Apply **DAP** at sowing for phosphorus.\n2. Top-dress **urea** in 2 splits.", followups: ["How much urea per acre?", "When should I irrigate?"] },
  ])
  const aiIdx = useRef(0)
  const [langSel, setLangSel] = useState(0)
  const [optSel, setOptSel] = useState(0)
  const [otp, setOtp] = useState("123")
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [chatMsgs, screen, composerOpen])

  function navigate(to: Screen) {
    if (to === "chat") setComposerOpen(false)
    setScreen(to)
  }
  function sendChat(text?: string) {
    const q = (text ?? draft).trim()
    if (!q) return
    aiIdx.current = (aiIdx.current + 1) % AI_REPLIES.length
    setChatMsgs((m) => [...m, { role: "user", text: q }, { role: "ai", text: AI_REPLIES[aiIdx.current] }])
    setDraft("")
    if (screen !== "chat") { setComposerOpen(false); navigate("chat") }
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const rCard = num(theme.shape.cardCornerRadius, 24)
  const rInput = num(theme.shape.inputCornerRadius, 12)
  const rBtn = num(theme.shape.buttonCornerRadius, 12)
  const rBubble = num(theme.chat.bubbleCornerRadius, 20)
  const msgSize = num(theme.chat.messageFontSize, 15)
  const ch = theme.chat

  // Dark square chip used on the brand app bar.
  const Chip = ({ icon, onClick }: { icon: ReactNode; onClick?: () => void }) => (
    <Button
      type="button" size="icon" variant="ghost" onClick={onClick}
      className="size-10 flex-none rounded-xl text-primary-foreground hover:bg-black/20 hover:text-primary-foreground"
      style={{ background: "var(--fc-brand-dark)" }}
    >
      {icon}
    </Button>
  )

  const AppBar = (opts: { left?: ReactNode; leftGo?: Screen; logo?: boolean; title?: string; weather?: boolean }) => (
    <div className="relative z-10 flex-none bg-primary text-primary-foreground shadow-sm">
      <div className="flex items-center gap-2.5 px-3 py-3">
        {opts.left
          ? <Chip icon={opts.left} onClick={opts.leftGo ? () => navigate(opts.leftGo!) : undefined} />
          : <span className="size-10 flex-none" />}
        <div className="flex flex-1 items-center justify-center">
          {opts.logo ? <Logo size={32} />
            : opts.title ? <span className="text-[18px] font-bold">{opts.title}</span> : null}
        </div>
        {opts.weather
          ? <Button type="button" variant="ghost" onClick={() => navigate("chat")} className="h-10 flex-none gap-1.5 rounded-2xl px-3 text-sm font-semibold text-primary-foreground hover:text-primary-foreground" style={{ background: "var(--fc-brand-dark)" }}>
              <CloudSun className="size-5" style={{ color: "var(--fc-accent)" }} />28°<ChevronRight className="size-3.5" style={{ color: "var(--fc-accent)" }} />
            </Button>
          : <span className="size-10 flex-none" />}
      </div>
    </div>
  )

  // NOTE: render *helpers* — call them ({homeTiles()}), never mount as elements
  // (<HomeTiles/>). Mounting remounts the subtree each render, blowing away the
  // composer <input> focus after every keystroke.
  // Primary input bar (Photo/Speak/Type) — brand surface with brand-dark tiles,
  // matching the app's PrimaryInputButtons.
  const tileRow = (tiles: { icon: ReactNode; label: string; onClick: () => void }[]): ReactNode => (
    <div className="flex-none bg-primary p-2.5 pt-2" style={{ borderTop: "0.5px solid rgba(0,0,0,.12)" }}>
      <div className="grid grid-cols-3 gap-1.5">
        {tiles.map((t) => (
          <Button key={t.label} type="button" variant="ghost" onClick={t.onClick}
            className="h-auto flex-col gap-1.5 py-3.5 text-primary-foreground hover:text-primary-foreground"
            style={{ background: "var(--fc-brand-dark)", borderRadius: rCard }}>
            <span style={{ color: "var(--fc-accent)" }}>{t.icon}</span>
            <span className="text-xs font-medium">{t.label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
  const chatBottom = (): ReactNode => composerOpen ? (
    <div className="flex flex-none items-center gap-2 border-t bg-card p-2.5">
      <Input
        ref={inputRef} value={draft} placeholder="Type your question…" autoComplete="off"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendChat() } }}
        style={{ borderRadius: rInput }}
      />
      <Button type="button" size="icon" onClick={() => sendChat()} className="size-10 flex-none" style={{ borderRadius: rInput }}>
        <Send className="size-4" />
      </Button>
    </div>
  ) : tileRow([
    { icon: <Camera className="size-6" />, label: "Photo", onClick: () => sendChat("📷  (photo) What is this spot on my tomato leaf?") },
    { icon: <Mic className="size-6" />, label: "Speak", onClick: () => sendChat("🎤  (voice) How do I control stem borer in paddy?") },
    { icon: <Keyboard className="size-6" />, label: "Type", onClick: () => { setComposerOpen(true); setTimeout(() => inputRef.current?.focus(), 0) } },
  ])

  const bubble = (m: Msg): ReactNode => m.role === "user" ? (
    // Right-aligned; 3 corners rounded, bottom-right sharp (app's asymmetric shape).
    <div
      className="ml-auto max-w-[82%] px-4 py-2.5"
      style={{
        background: ch.userBubbleColor || "var(--secondary)",
        color: ch.userBubbleTextColor || "var(--secondary-foreground)",
        borderRadius: `${rBubble}px ${rBubble}px 0 ${rBubble}px`, fontSize: msgSize,
      }}
      dangerouslySetInnerHTML={{ __html: mdLite(m.text) }}
    />
  ) : (
    // AI answer renders as plain text on the reading surface (no bubble/card).
    <div className="space-y-4">
      <div style={{ fontSize: msgSize, color: ch.aiBubbleTextColor || "var(--foreground)" }}
        dangerouslySetInnerHTML={{ __html: mdLite(m.text) }} />
      <div className="grid grid-cols-3 gap-1">
        <Button type="button" className="gap-1.5" style={{ borderRadius: rBtn }}><Volume2 className="size-4" />Listen</Button>
        <Button type="button" variant="secondary" className="gap-1.5" style={{ borderRadius: rBtn }}><Share2 className="size-4" />Share</Button>
        <Button type="button" variant="secondary" className="gap-1.5" style={{ borderRadius: rBtn }}><Bookmark className="size-4" />Save</Button>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="size-4 flex-none" />AI may be wrong. Please double-check.</div>
      <Separator className="h-[3px] rounded-full" />
      {m.followups?.length ? (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground">Related questions</div>
          {m.followups.map((q) => (
            <Button key={q} type="button" variant="secondary" onClick={() => sendChat(q)}
              className="h-auto w-full justify-between gap-2 whitespace-normal px-4 py-3 text-left text-sm font-normal"
              style={{ borderRadius: rInput }}>
              <span className="flex-1">{q}</span>
              <Badge className="flex-none text-white" style={{ background: "var(--fc-accent)" }}>Ask</Badge>
            </Button>
          ))}
          <p className="pt-1 text-center text-[13px] font-medium text-foreground">Or ask a follow-up question 👇</p>
        </div>
      ) : null}
    </div>
  )

  let body: React.ReactNode = null
  if (screen === "language") body = (
    <div className="flex flex-1 flex-col overflow-y-auto bg-muted p-5 text-foreground">
      <div className="mt-3 mb-3.5 flex justify-center"><Logo size={32} className="text-primary" /></div>
      <h1 className="text-center text-xl font-bold">Choose your language</h1>
      <p className="mt-2 mb-6 text-center text-sm text-muted-foreground">You can change this later</p>
      <RadioGroup value={String(langSel)} onValueChange={(v) => setLangSel(Number(v))} className="gap-1.5">
        {LANGS.map((l, i) => {
          const sel = i === langSel
          return (
            <Label key={l} htmlFor={`lang-${i}`} className="flex cursor-pointer items-center gap-3 p-3.5 font-normal"
              style={{ borderRadius: rInput, background: sel ? "color-mix(in srgb, var(--fc-accent) 16%, var(--card))" : "var(--card)" }}>
              <RadioGroupItem id={`lang-${i}`} value={String(i)} />
              <span className="text-sm">{l}</span>
            </Label>
          )
        })}
      </RadioGroup>
      <div className="mt-4 flex justify-center">
        <Badge className="rounded-full px-4 py-1.5 text-xs" style={{ background: "var(--fc-brand-dark)", color: "#fff" }}>All languages</Badge>
      </div>
      <div className="mt-auto -mx-5 -mb-5 space-y-4 rounded-t-3xl bg-card px-6 pt-6 pb-5 text-center">
        <p className="text-base font-bold">FarmerChat: Practical advice for your crops &amp; livestock</p>
        <Button type="button" className="w-full gap-1.5" onClick={() => navigate("name")} style={{ borderRadius: rBtn, background: "var(--fc-brand-dark)", color: "#fff" }}>
          Start using FarmerChat<ChevronRight className="size-4" style={{ color: "var(--fc-accent)" }} />
        </Button>
        <p className="mx-auto max-w-[260px] text-xs text-muted-foreground">By continuing, you agree to our <u>Terms of Use</u> also see <u>Privacy Policy</u>.</p>
      </div>
    </div>
  )
  else if (screen === "name") body = (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted p-6 text-foreground">
      <Logo size={32} className="text-primary" />
      <h1 className="text-center text-xl font-bold">What should we call you?</h1>
      <p className="-mt-2 mx-auto max-w-[260px] text-center text-sm text-muted-foreground">So we can greet you by name</p>
      <Input defaultValue="Aiyappa" placeholder="Your name or nickname" className="w-full" style={{ borderRadius: rInput }} />
      <Button type="button" className="w-full gap-1.5" onClick={() => navigate("home")} style={{ borderRadius: rBtn, background: "var(--fc-brand-dark)", color: "#fff" }}>
        Save name<ChevronRight className="size-4" style={{ color: "var(--fc-accent)" }} />
      </Button>
      <Button type="button" variant="secondary" className="w-full" onClick={() => navigate("home")} style={{ borderRadius: rBtn }}>Skip for now</Button>
    </div>
  )
  else if (screen === "home") body = (
    <div className="flex flex-1 flex-col overflow-hidden bg-primary">
      {AppBar({ left: <Menu className="size-5" />, weather: true })}
      {/* Greeting + primary input (Photo/Speak/Type) on the brand surface —
          matches the app's sticky-header input directly under the greeting. */}
      <div className="flex-none px-3.5 pt-1 pb-4">
        <p className="mb-3 px-2 text-center text-[15px] font-semibold text-primary-foreground">Tap a button to ask a question</p>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: "Photo", icon: <Camera className="size-6" /> },
            { label: "Speak", icon: <Mic className="size-6" /> },
            { label: "Type", icon: <Keyboard className="size-6" /> },
          ].map((t) => (
            <Button key={t.label} type="button" variant="ghost" onClick={() => navigate("chat")}
              className="h-auto flex-col gap-1.5 py-4 text-primary-foreground hover:text-primary-foreground"
              style={{ background: "var(--fc-brand-dark)", borderRadius: rCard }}>
              <span style={{ color: "var(--fc-accent)" }}>{t.icon}</span>
              <span className="text-xs font-medium">{t.label}</span>
            </Button>
          ))}
        </div>
      </div>
      {/* Feed (reading surface) with a rounded sheet over the brand surface. */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-t-3xl bg-background p-4">
        <div className="text-[15px] font-bold text-foreground">For your farm today</div>
        <Card className="cursor-pointer gap-3 overflow-hidden py-0" style={{ borderRadius: rCard }} onClick={() => navigate("chat")}>
          <CardContent className="space-y-2.5 p-3">
            <AspectRatio ratio={16 / 9} className="flex items-center justify-center rounded-xl text-4xl" style={{ background: "color-mix(in srgb, var(--fc-accent) 20%, var(--card))" }}>🌾</AspectRatio>
            <div className="font-bold">Wheat sowing window</div>
            <p className="text-sm text-muted-foreground">Sow between Nov 1–15 for the best yield in your region.</p>
            <Button type="button" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); navigate("chat") }} style={{ borderRadius: rBtn }}>
              Start chat<ChevronRight className="size-4" />
            </Button>
          </CardContent>
        </Card>
        <Card className="gap-3 py-0" style={{ borderRadius: rCard }}>
          <CardContent className="space-y-2.5 p-3">
            <div className="font-bold">How many acres do you farm?</div>
            <ToggleGroup type="single" spacing={2} value={String(optSel)} onValueChange={(v) => v && setOptSel(Number(v))} variant="outline" className="grid w-full grid-cols-3">
              {OPTS.map((o, i) => <ToggleGroupItem key={o} value={String(i)} className="w-full border px-1 text-sm" style={{ borderRadius: rInput }}>{o}</ToggleGroupItem>)}
            </ToggleGroup>
          </CardContent>
        </Card>
      </div>
    </div>
  )
  else if (screen === "chat") body = (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {AppBar({ left: <X className="size-5" />, leftGo: "home", logo: true })}
      <div ref={threadRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-3.5">
        {chatMsgs.map((m, i) => <Fragment key={i}>{bubble(m)}</Fragment>)}
      </div>
      {chatBottom()}
    </div>
  )
  else if (screen === "auth") body = (
    <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      {AppBar({ left: <X className="size-5" />, leftGo: "home", title: "Sign up" })}
      <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-5 pt-8">
        <h1 className="text-center text-xl font-bold">Enter the code we sent</h1>
        <p className="-mt-2 text-center text-sm text-muted-foreground">Check your messages for the code</p>
        <InputOTP maxLength={4} value={otp} onChange={setOtp} className="caret-transparent" containerClassName="mt-2 w-full justify-center">
          <InputOTPGroup className="flex w-full gap-2">
            {[0, 1, 2, 3].map((i) => (
              <InputOTPSlot key={i} index={i} className="h-14 flex-1 border bg-secondary text-xl" style={{ borderRadius: rInput }} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <Button type="button" className="h-12 w-full" onClick={() => navigate("home")} style={{ borderRadius: rBtn, background: "var(--fc-brand-dark)", color: "#fff" }}>Verify</Button>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex size-8 flex-none items-center justify-center rounded-full text-white" style={{ background: "var(--fc-accent)" }}><Clock className="size-4" /></span>
          <span className="text-sm">Please enter in 2:58 seconds</span>
        </div>
        <p className="text-sm font-medium text-muted-foreground">Resend code</p>
      </div>
    </div>
  )
  else if (screen === "settings") body = (
    <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      {AppBar({ left: <Menu className="size-5" />, title: "Settings" })}
      <div className="flex flex-1 flex-col gap-7 overflow-y-auto p-5">
        <div className="space-y-2.5">
          <div className="text-sm font-semibold text-foreground">Appearance</div>
          <ToggleGroup type="single" spacing={2} value={appearance} onValueChange={(v) => v && setAppearance(v === "night" ? "night" : "day")} variant="outline" className="grid w-full grid-cols-3">
            <ToggleGroupItem value="day" className="h-auto flex-col gap-2 border py-4" style={{ borderRadius: rInput }}><Sun className="size-5" />Day</ToggleGroupItem>
            <ToggleGroupItem value="night" className="h-auto flex-col gap-2 border py-4" style={{ borderRadius: rInput }}><Moon className="size-5" />Night</ToggleGroupItem>
            <ToggleGroupItem value="auto" className="h-auto flex-col gap-2 border py-4" style={{ borderRadius: rInput }}><Smartphone className="size-5" />Auto</ToggleGroupItem>
          </ToggleGroup>
          <p className="text-xs text-muted-foreground">{appearance === "night" ? "FarmerChat is always in dark mode" : "FarmerChat is always in light mode"}</p>
        </div>
        <div className="space-y-2.5">
          <div className="text-sm font-semibold text-foreground">Account details</div>
          <Button type="button" variant="secondary" onClick={() => navigate("name")} className="h-auto w-full justify-between px-4 py-3.5 font-normal" style={{ borderRadius: rInput }}>
            <span className="text-sm">Your name</span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">Aiyappa<ChevronRight className="size-4" /></span>
          </Button>
          <Button type="button" variant="secondary" className="mt-1.5 w-full font-medium" onClick={() => navigate("language")} style={{ borderRadius: rBtn }}>Logout</Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={"phone" + (appearance === "night" ? " dark" : "")} style={shadcnVars(theme, appearance)}>
      <div className="fc-screen">{body}</div>
    </div>
  )
}
