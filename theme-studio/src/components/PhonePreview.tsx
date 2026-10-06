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
  ArrowLeft, Camera, ChevronRight, CloudSun, Eye, Info, Lightbulb, LocateFixed, MapPin, Menu,
  Phone,
  Mic, Moon, Send, Share2, Smartphone, Sun, Volume2, X,
} from "lucide-react"
import type { ThemeState } from "@/lib/theme"
import { Logo } from "@/components/Logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import "./phone.css"

export type Appearance = "day" | "night"
export type Screen =
  | "splash" | "language" | "name" | "home" | "chat" | "auth" | "settings"
  | "settingsName" | "settingsLanguage" | "chatHistory" | "help"
  | "accountBenefits" | "accountSuccess" | "error" | "legalContent"

/** All 15 routes in the SDK's `Destination.kt`, in journey order. */
export const SCREENS: [Screen, string][] = [
  ["splash", "Splash"],
  ["language", "Language"],
  ["name", "Name"],
  ["home", "Home"],
  ["chat", "Chat"],
  ["auth", "OTP"],
  ["settings", "Settings"],
  ["settingsName", "Edit name"],
  ["settingsLanguage", "Change lang"],
  ["chatHistory", "Past Advice"],
  ["help", "Help"],
  ["accountBenefits", "Sign-up promo"],
  ["accountSuccess", "All set"],
  ["error", "Error"],
  ["legalContent", "Legal"],
]

/**
 * `SectionHeader.kt`'s LeafDivider — `fc_leaf` (an 11x11 lens glyph) tiled
 * gaplessly at 4dp, every other leaf mirrored, filling the space either side of
 * the title in `buttonPrimaryAccent`.
 */
const LEAF = "M10.5191 0C4.70952 0 0 4.71382 0 10.5286C5.8095 10.5286 10.5191 5.81477 10.5191 0Z"
function LeafDivider({ id }: { id: string }) {
  return (
    <svg className="h-1 min-w-[16px] flex-1" style={{ color: "var(--fc-accent)" }} aria-hidden>
      <defs>
        <pattern id={id} width="8" height="4" patternUnits="userSpaceOnUse">
          <g transform="scale(0.3636)"><path d={LEAF} fill="currentColor" /></g>
          <g transform="translate(8,0) scale(-0.3636,0.3636)"><path d={LEAF} fill="currentColor" /></g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/**
 * Farmer illustrations, copied verbatim from the SDK's own bundled assets
 * (`farmerchat-core/src/main/assets/<cc>/<name>.webp`). The SDK picks the pack
 * from the USER_COUNTRY_CODE pref and falls back to `ke`; all four shipped packs
 * are here, so switching FARMER_COUNTRY is a one-line change.
 * Screens: AccountBenefits -> camera, AccountSuccess and Error -> sky.
 */
const FARMER_COUNTRY = "in"
const farmerSrc = (name: "camera" | "phone" | "sky") =>
  `/farmer/${FARMER_COUNTRY}/farmer_looking_at_${name}.webp`

/** Help screen FAQ rows — the titles this tenant's `get_faqs` returns. */
const FAQS = [
  "What is FarmerChat and how can it help me?",
  "How can I ask questions on FarmerChat?",
  "What kind of questions can I ask in the app?",
  "Is internet required to use the app?",
  "Is FarmerChat free to use?",
]

/** Past Advice rows. Copy is the served label; the entries are sample data. */
const PAST_ADVICE = [
  ["How do I control armyworm in maize?", "Today"],
  ["Essential best practices for general irrigation management", "Yesterday"],
  ["When should I irrigate my tomato crop?", "12 Sep"],
  ["Boost soil fertility without breaking the bank", "9 Sep"],
]

const LANGS = ["English", "हिन्दी", "தமிழ்", "తెలుగు"]
const OPTS = ["1–2 acres", "3–5 acres", "5+ acres"]

/**
 * Agentic stream statuses (2.0.0). The SDK shows these one at a time in the
 * shimmering label while the agent works — they arrive as `event: status` and
 * tool events on `api/chat/get_answer_for_text_query_agentic/`.
 */
const STREAM_STATUS = [
  "Getting your answer…",
  "Looking up soil conditions",
  "Checking elevation for your location",
  "Reading local advisories",
]

/**
 * Tips shown for the whole answer wait. In the real SDK these are DISCOVERED
 * from the label payload (`fc_v2_app_label_tips_<name>_title/_statement`), so a
 * backend can add one without an SDK release; these three are the built-in
 * fallbacks, verbatim.
 */
const TIPS: { title: string; body: string }[] = [
  { title: "Did you know?", body: "You can ask follow-up questions to get more details" },
  { title: "Quick tip", body: "Try asking about specific crops or problems" },
  { title: "Try this", body: "Upload photos for plant disease identification" },
]

const AI_REPLIES = [
  "Good question. A **soil test** first means you apply only what's needed — it saves cost and lifts yield.",
  "Quick tip: split fertilizer into **2–3 doses** across the season so the crop takes up more of it.",
  "For pests, describe the **leaf symptoms** — spots, curling, colour — and I can narrow down the cause.",
  "Water early morning or evening to cut evaporation. Aim for **deep, less-frequent** irrigation.",
]

interface Msg {
  role: "user" | "ai"
  text: string
  followups?: string[]
  /** Agentic alignment surface — the numbered quick replies under an answer. */
  chips?: string[]
  /** The question the chips answer, e.g. "Do you grow maize on your farm?". */
  chipPrompt?: string
}

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
    "--radius": num(sh.buttonCornerRadius, 999) + "px",
    // Brand + FAB helpers (not part of the shadcn token set):
    "--fc-brand-dark": c.brandPrimaryDark,
    "--fc-accent": c.brandAccent,
    // SDK ContentColors the agentic surfaces are built from. These have no shadcn
    // equivalent, and hand-inlining them would mean N copies to drift:
    //   surfaceActive           = accent @ 16%  (Green500_16) — tip cards, alignment
    //                             chip rows, the selected language row
    //   surfaceReadingSecondary = Neutral150 #ECECEE / Neutral800 #27272A — the
    //                             agentic user bubble's DEFAULT ground
    //   foregroundSecondary     = Neutral600 #52525C / Neutral400 #9F9FA9 — the
    //                             accuracy note and the stream status
    "--fc-surface-active": `color-mix(in srgb, ${c.brandAccent} 16%, ${card})`,
    "--fc-reading-2": dark ? "#27272A" : "#ECECEE",
    "--fc-reading": dark ? "#18181B" : c.background,
    "--fc-fg-2": mutedFg,
    "--fc-shimmer-base": mutedFg,
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
    { role: "user", text: "How do I control armyworm in maize?" },
    {
      role: "ai",
      text: "To control **Fall Armyworm** in your maize field, adopt an Integrated Pest Management (IPM) approach:\n• **Monitoring:** inspect crops early and destroy egg masses by hand.\n• **Biological:** spray *Bacillus thuringiensis* or neem-based formulations early.\n• **Chemical:** for severe infestations, **Emamectin Benzoate 5 SG** at **0.4 g/litre**, into the whorls.",
      chipPrompt: "Do you grow maize on your farm?",
      chips: ["Yes, save maize", "Not now"],
      followups: ["How much urea per acre?", "When should I irrigate?"],
    },
  ])
  /** Agentic wait: index into STREAM_STATUS, or null when no answer is generating. */
  const [streamStep, setStreamStep] = useState<number | null>(null)
  const [tipIdx, setTipIdx] = useState(0)
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
  }, [chatMsgs, screen, composerOpen, streamStep])

  // Agentic wait simulation: step through the tool statuses, then settle the
  // answer. Mirrors the SDK's order — statuses/tools first, then the text, and
  // the tips carousel is up for exactly this window.
  useEffect(() => {
    if (streamStep === null) return
    if (streamStep >= STREAM_STATUS.length) {
      const t = setTimeout(() => {
        setStreamStep(null)
        setChatMsgs((m) => [...m, {
          role: "ai",
          text: AI_REPLIES[aiIdx.current],
          chipPrompt: "Was this useful for your farm?",
          chips: ["Yes, that helps", "Not quite"],
        }])
      }, 700)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setStreamStep((n) => (n ?? 0) + 1), 1100)
    return () => clearTimeout(t)
  }, [streamStep])

  // Tip rotation — 8s per tip, the SDK's TIP_DURATION_MS, looping while the
  // carousel is up.
  useEffect(() => {
    if (streamStep === null) return
    const t = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 8000)
    return () => clearInterval(t)
  }, [streamStep])

  function navigate(to: Screen) {
    if (to === "chat") setComposerOpen(false)
    setScreen(to)
  }
  function sendChat(text?: string) {
    const q = (text ?? draft).trim()
    if (!q) return
    aiIdx.current = (aiIdx.current + 1) % AI_REPLIES.length
    // The answer is NOT appended here any more: 2.0.0 streams, so the user
    // message lands, the agentic wait runs (shimmer status + tips), and the
    // effect above settles the answer. That wait is the state a farmer sees
    // most, so the preview has to show it rather than skip to the result.
    setChatMsgs((m) => [...m, { role: "user", text: q }])
    setDraft("")
    setTipIdx(0)
    setStreamStep(0)
    if (screen !== "chat") { setComposerOpen(false); navigate("chat") }
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const rCard = num(theme.shape.cardCornerRadius, 24)
  const rInput = num(theme.shape.inputCornerRadius, 12)
  // SDK default is Radius.Rounded (999.dp) since the 2026-09-15 pass — buttons are pills.
  const rBtn = num(theme.shape.buttonCornerRadius, 999)
  const rBubble = num(theme.chat.bubbleCornerRadius, 20)
  const msgSize = num(theme.chat.messageFontSize, 15)
  const ch = theme.chat

  // Dark square chip used on the brand app bar.
  const Chip = ({ icon, onClick, round }: { icon: ReactNode; onClick?: () => void; round?: boolean }) => (
    <Button
      type="button" size="icon" variant="ghost" onClick={onClick}
      className="size-10 flex-none text-primary-foreground hover:bg-black/20 hover:text-primary-foreground"
      style={{ background: "var(--fc-brand-dark)", borderRadius: round ? 999 : 14 }}
    >
      {icon}
    </Button>
  )

  const AppBar = (opts: { left?: ReactNode; leftGo?: Screen; logo?: boolean; title?: string; weather?: boolean; roundLeft?: boolean }) => (
    <div className="relative z-10 flex-none bg-primary text-primary-foreground shadow-sm">
      <div className="flex items-center gap-2.5 px-3 py-3">
        {opts.left
          ? <Chip icon={opts.left} round={opts.roundLeft} onClick={opts.leftGo ? () => navigate(opts.leftGo!) : undefined} />
          : <span className="size-10 flex-none" />}
        <div className="flex flex-1 items-center justify-center">
          {opts.logo ? <Logo size={32} />
            : opts.title ? <span className="text-[18px] font-bold">{opts.title}</span> : null}
        </div>
        {opts.weather
          ? <Button type="button" variant="ghost" onClick={() => navigate("chat")} className="h-11 flex-none gap-1.5 rounded-full px-3 text-sm font-semibold text-primary-foreground hover:text-primary-foreground" style={{ background: "var(--fc-brand-dark)" }}>
              <CloudSun className="size-5" style={{ color: "var(--fc-accent)" }} />28 °C<ChevronRight className="size-3.5" style={{ color: "var(--fc-accent)" }} />
            </Button>
          : <span className="size-10 flex-none" />}
      </div>
    </div>
  )

  // NOTE: render *helpers* — call them ({inputComposer()}), never mount as
  // elements (<InputComposer/>). Mounting remounts the subtree each render,
  // blowing away the composer <input> focus after every keystroke — and now it
  // would also restart the tip carousel's rotation on every keystroke.

  /**
   * The 2.0.0 unified InputComposer, which REPLACES the legacy Photo/Speak/Type
   * tile row on Home and Chat whenever a host sets `enableAgenticChat(true)`.
   * Camera on the left, the field in the middle, mic — or send once there is a
   * draft — on the right, all on the brand surface.
   */
  const inputComposer = (): ReactNode => (
    <div className="flex-none p-2.5 pt-2">
      <div className="flex items-center gap-2 p-2" style={{ background: "var(--primary)", borderRadius: 999 }}>
        <Button
          type="button" size="icon" variant="ghost"
          onClick={() => sendChat("📷  (photo) What is this spot on my tomato leaf?")}
          className="size-11 flex-none rounded-full hover:bg-black/20"
          style={{ background: "var(--fc-brand-dark)" }}
          aria-label="Camera"
        >
          <Camera className="size-5" style={{ color: "var(--fc-accent)" }} />
        </Button>
        <Input
          ref={inputRef} value={draft} placeholder="Ask about your farm…" autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendChat() } }}
          className="h-11 flex-1 border-0 bg-card text-foreground shadow-none focus-visible:ring-0"
          style={{ borderRadius: 999 }}
        />
        <Button
          type="button" size="icon" variant="ghost"
          onClick={() => draft.trim()
            ? sendChat()
            : sendChat("🎤  (voice) How do I control stem borer in paddy?")}
          className="size-11 flex-none rounded-full hover:bg-black/20"
          style={{ background: "var(--fc-brand-dark)" }}
          aria-label={draft.trim() ? "Send" : "Voice"}
        >
          {draft.trim()
            ? <Send className="size-5" style={{ color: "var(--fc-accent)" }} />
            : <Mic className="size-5" style={{ color: "var(--fc-accent)" }} />}
        </Button>
      </div>
    </div>
  )

  /**
   * The answer-generation tip carousel — bottom-anchored, up for the whole wait
   * and hidden the moment the answer produces text. The card ground is
   * `surfaceActive` (accent @ 16%), so it re-themes with the accent knob.
   */
  const tipsCarousel = (): ReactNode => {
    const tip = TIPS[tipIdx]
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
        <div className="fc-tip-fade" />
        <div className="px-6 pb-4" style={{ background: "var(--fc-reading)" }}>
          <div
            className="flex items-start gap-3 px-5 py-4"
            // Tip.kt (2026-09-15): dark-green ground with white text, Radius.LG — no
            // longer the neutral surfaceActive.
            style={{ background: "var(--fc-brand-dark)", borderRadius: 16 }}
          >
            <span
              className="flex size-9 flex-none items-center justify-center rounded-full"
              style={{ background: "var(--fc-accent)" }}
            >
              <Lightbulb className="size-[18px] text-white" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium text-white">{tip.title}</div>
              <p className="mt-1.5 text-[13px] text-white">{tip.body}</p>
            </div>
          </div>
          {/* Dots for the other tips; the active one is a 24x8 track whose fill
              runs the countdown to the next tip. */}
          <div className="mt-3.5 flex items-center justify-center gap-2.5">
            {TIPS.map((t, i) => i === tipIdx ? (
              <span
                key={t.title} className="h-2 w-6 overflow-hidden rounded-full"
                style={{ background: "var(--fc-surface-active)" }}
              >
                <span key={`fill-${tipIdx}`} className="fc-tip-fill block" />
              </span>
            ) : (
              <span key={t.title} className="size-2 rounded-full" style={{ background: "var(--fc-surface-active)" }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  /**
   * The in-thread stream status: the branded spinner with a SHIMMERING label.
   * The app shimmers this label (`LogoSpinnerHorizontal`) and does not shimmer
   * the full-screen loader's — the sweep is the only difference, not the weight.
   */
  const streamStatus = (): ReactNode => (
    // min-w-0 on the row + flex-1 on the label: a long tool status such as
    // "Checking elevation for your location" is wider than the phone, and
    // without these the flex column sizes to it — clipping the status AND
    // pushing every ml-auto user bubble past the bezel.
    <div className="flex min-w-0 items-center gap-3">
      <span className="relative flex size-10 flex-none items-center justify-center">
        <span
          className="absolute inset-0 animate-spin rounded-full border-[2.5px] border-transparent"
          style={{ borderTopColor: "var(--fc-accent)", borderRightColor: "var(--fc-accent)" }}
        />
        {/* App parity: ring AND glyph share one spinnerColor. */}
        <Logo size={23} style={{ color: "var(--fc-accent)" }} />
      </span>
      <span className="fc-shimmer min-w-0 flex-1 text-sm font-medium leading-snug">
        {STREAM_STATUS[Math.min(streamStep ?? 0, STREAM_STATUS.length - 1)]}
      </span>
    </div>
  )

  const bubble = (m: Msg): ReactNode => m.role === "user" ? (
    // Right-aligned. The 2.0.0 DEFAULT is the grey reading surface with primary
    // ink and a SQUARE bottom-end corner — not the old green/white bubble.
    // `userBubbleColor` / `userBubbleTextColor` still override it, so the
    // default has to be right or the studio lies about the unset case.
    <div
      className="ml-auto max-w-[82%] px-4 py-3"
      style={{
        background: ch.userBubbleColor || "var(--fc-reading-2)",
        color: ch.userBubbleTextColor || "var(--foreground)",
        borderRadius: `${rBubble}px ${rBubble}px 0 ${rBubble}px`, fontSize: msgSize,
      }}
      dangerouslySetInnerHTML={{ __html: mdLite(m.text) }}
    />
  ) : (
    // AI answer renders as plain text on the reading surface (no bubble/card).
    <div className="space-y-4">
      <div style={{ fontSize: msgSize, color: ch.aiBubbleTextColor || "var(--foreground)" }}
        dangerouslySetInnerHTML={{ __html: mdLite(m.text) }} />

      {/* Alignment surface — the agentic quick replies. Numbered badge, label,
          chevron, on a `surfaceActive` row. */}
      {m.chips?.length ? (
        <div className="space-y-2">
          {m.chipPrompt ? <div className="text-[15px] font-semibold text-foreground">{m.chipPrompt}</div> : null}
          {m.chips.map((c, i) => (
            <Button
              key={c} type="button" variant="ghost" onClick={() => sendChat(c)}
              className="h-auto w-full justify-start gap-3 whitespace-normal px-3 py-3.5 text-left font-normal hover:opacity-90"
              style={{ background: "var(--fc-surface-active)", borderRadius: rInput }}
            >
              <span
                className="flex size-7 flex-none items-center justify-center rounded-full text-[13px] font-semibold text-white"
                style={{ background: "var(--fc-accent)" }}
              >
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-foreground">{c}</span>
              <ChevronRight className="size-4 flex-none" style={{ color: "var(--fc-accent)" }} />
            </Button>
          ))}
        </div>
      ) : null}

      {/* Agentic answer footer: the accuracy note ABOVE Share + Listen, and NO
          Save. The legacy row was Listen/Share/Save with no note — carrying that
          treatment into an agentic answer was the defect fixed on android in
          docs/04 ("isAgentic was erased at finalize"). */}
      <div className="flex items-start gap-2 text-xs" style={{ color: "var(--fc-fg-2)" }}>
        <Info className="mt-px size-4 flex-none" style={{ color: "var(--fc-accent)" }} />
        <span>Local conditions may vary. Please confirm important actions before you act.</span>
      </div>
      <div className="flex gap-2.5">
        {[
          { icon: <Share2 className="size-[19px]" />, label: "Share" },
          { icon: <Volume2 className="size-[19px]" />, label: "Listen" },
        ].map((a) => (
          <Button
            key={a.label} type="button" variant="ghost"
            className="h-[42px] gap-2.5 px-4 font-medium text-foreground hover:opacity-90"
            style={{ background: "var(--fc-reading-2)", borderRadius: 999 }}
          >
            {a.icon}{a.label}
          </Button>
        ))}
      </div>

      {m.followups?.length ? (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground">You can also ask</div>
          {m.followups.map((q) => (
            <Button key={q} type="button" variant="secondary" onClick={() => sendChat(q)}
              className="h-auto w-full justify-between gap-2 whitespace-normal px-4 py-3 text-left text-sm font-normal"
              style={{ borderRadius: rInput }}>
              <span className="flex-1">{q}</span>
              <Badge className="flex-none text-white" style={{ background: "var(--fc-accent)" }}>Ask</Badge>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )

  /**
   * The SDK's `FullScreenMessage` (components/FullScreenMessage.kt) — brand-filled,
   * title at the top, oval illustration, headline + subtitle, dark CTA pill.
   * Error, AccountBenefits and AccountSuccess are all this one component, so the
   * layout here is taken from the Error screen as rendered on a device.
   */
  const fullScreenMessage = (o: {
    title: string; main: string; subtitle: string; cta: string
    illustration: "camera" | "phone" | "sky"
    leftClose?: boolean; rightLabel?: string; chevron?: boolean; go?: Screen
  }): ReactNode => (
    <div className="flex flex-1 flex-col overflow-y-auto bg-primary px-5 pt-3 pb-5 text-primary-foreground">
      <div className="flex min-h-9 flex-none items-center">
        {o.leftClose
          ? <button type="button" onClick={() => navigate("home")} className="flex size-9 items-center justify-center rounded-xl" style={{ background: "var(--fc-brand-dark)" }}><X className="size-4" /></button>
          : <span className="size-9" />}
        <span className="flex-1 text-center text-[17px] font-bold">{o.title}</span>
        {o.rightLabel
          ? <button type="button" onClick={() => navigate("home")} className="min-w-9 text-sm font-semibold">{o.rightLabel}</button>
          : <span className="size-9" />}
      </div>

      {/* FullScreenMessage.kt:199-201 — max 300dp wide, 300:450 (2:3) aspect,
          clipped with Radius.Rounded, image cropped to fill. */}
      <img
        src={farmerSrc(o.illustration)}
        alt=""
        className="mx-auto my-4 aspect-[2/3] w-[83%] max-w-[300px] flex-none object-cover"
        style={{ borderRadius: 999 }}
      />

      <div className="mt-auto space-y-2 text-center">
        <p className="text-[21px] font-bold leading-tight">{o.main}</p>
        <p className="text-sm opacity-90">{o.subtitle}</p>
      </div>
      <Button type="button" onClick={() => navigate(o.go ?? "home")}
        className="mt-5 h-13 w-full flex-none gap-1.5 py-3.5 font-bold"
        style={{ borderRadius: rBtn, background: "var(--fc-brand-dark)", color: "#fff" }}>
        {o.cta}{o.chevron ? <ChevronRight className="size-4" style={{ color: "var(--fc-accent)" }} /> : null}
      </Button>
    </div>
  )

  /** Language list, shared by onboarding and the Settings variant. */
  const languageList = (allLanguagesDark: boolean): ReactNode => (
    <>
      <RadioGroup value={String(langSel)} onValueChange={(v) => setLangSel(Number(v))} className="gap-1.5">
        {LANGS.map((l, i) => {
          const sel = i === langSel
          return (
            <Label key={l} htmlFor={`sl-${i}`} className="flex cursor-pointer items-center gap-3 p-3.5 font-normal"
              style={{ borderRadius: rInput, background: sel ? "var(--fc-surface-active)" : "var(--card)" }}>
              <RadioGroupItem id={`sl-${i}`} value={String(i)} />
              <span className="text-sm">{l}</span>
            </Label>
          )
        })}
      </RadioGroup>
      <div className="mt-4 flex justify-center">
        <Badge className="rounded-full px-4 py-1.5 text-xs"
          style={allLanguagesDark
            ? { background: "var(--fc-brand-dark)", color: "#fff" }
            : { background: "var(--card)", color: "var(--foreground)" }}>
          All languages
        </Badge>
      </div>
    </>
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
              style={{ borderRadius: rInput, background: sel ? "var(--fc-surface-active)" : "var(--card)" }}>
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
        {/* SDK parity (app 47bc8524): ONE flowing justified paragraph capped at 260dp, with the
            links inline and joined by the served `also see` connector — not an intro line plus a
            centred "Terms of Use · Privacy Policy" row. The trailing "." sits outside the link so
            it is neither underlined nor clickable. Served copy (DEV `get_labels`), not the
            compose fallbacks. */}
        <p className="mx-auto max-w-[260px] text-justify text-xs text-muted-foreground">
          FarmerChat uses AI. By continuing, you agree to our{" "}
          <u className="cursor-pointer text-foreground">Terms of Use</u> also see{" "}
          <u className="cursor-pointer text-foreground">Privacy Policy</u>.
        </p>
      </div>
    </div>
  )
  else if (screen === "name") body = (
    <div className="flex flex-1 flex-col items-center gap-4 bg-muted p-6 pt-8 text-foreground">
      <Logo size={32} className="text-primary" />
      <h1 className="text-center text-xl font-bold">What should we call you?</h1>
      <p className="-mt-2 mx-auto max-w-[260px] text-center text-sm text-muted-foreground">So we can greet you by name</p>
      {/* Device: pill field with a brand-accent focus ring, and a WHITE "Skip for
          now" pill — not a grey secondary button. */}
      <Input
        defaultValue="Aiyappa"
        placeholder="Your name"
        className="h-12 w-full bg-card px-5"
        style={{ borderRadius: rBtn, borderColor: "var(--fc-accent)" }}
      />
      <Button type="button" className="h-12 w-full gap-1.5" onClick={() => navigate("home")} style={{ borderRadius: rBtn, background: "var(--fc-brand-dark)", color: "#fff" }}>
        Save name<ChevronRight className="size-4" style={{ color: "var(--fc-accent)" }} />
      </Button>
      <Button type="button" className="h-12 w-full bg-card font-bold text-foreground hover:bg-card" onClick={() => navigate("home")} style={{ borderRadius: rBtn }}>Skip for now</Button>
    </div>
  )
  else if (screen === "home") body = (
    <div className="flex flex-1 flex-col overflow-hidden bg-primary">
      {AppBar({ left: <Menu className="size-5" />, weather: true, roundLeft: true })}
      {/* Agentic Home header: logo, the "what are farmers asking" headline and
          the location CTA on the brand surface. The legacy Photo/Speak/Type
          tile row is GONE — 2.0.0 puts a single composer at the bottom. */}
      <div className="flex-none px-3.5 pt-1 pb-4 text-center">
        <div className="mb-2 flex justify-center"><Logo size={34} className="text-primary-foreground" /></div>
        {/* SectionHeader: leaves | title | leaves */}
        <div className="flex items-center gap-2.5 px-2">
          <LeafDivider id="leafL" />
          <p className="flex-none text-[15px] font-semibold text-primary-foreground">What are farmers asking today?</p>
          <LeafDivider id="leafR" />
        </div>
        <Button
          type="button" variant="ghost"
          onClick={() => navigate("chat")}
          className="mt-3 h-10 gap-2 rounded-full px-4 text-sm font-semibold text-primary-foreground hover:text-primary-foreground"
          style={{ background: "var(--fc-brand-dark)" }}
        >
          <LocateFixed className="size-5" style={{ color: "var(--fc-accent)" }} />Set your location
        </Button>
      </div>
      {/* HomeScreen.kt:608-612 — a verticalGradient from surfacePrimary to
          transparent over the brand surface. No rounded sheet, and the feed
          ground is the GREY surfacePrimary in both modes (:573), not white. */}
      <div className="h-8 flex-none" style={{ background: "linear-gradient(to top, var(--muted), transparent)" }} />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-muted px-4 pb-4">
        <Card className="cursor-pointer gap-3 py-0" style={{ borderRadius: rCard }} onClick={() => sendChat("Step-by-step guidance on improving soil structure through cover cropping")}>
          <CardContent className="space-y-2.5 p-3">
            {/* Native aspect-ratio, not radix <AspectRatio>: its percentage-padding
                box collapsed inside the flex Card and overflow-hidden then clipped
                the text + CTA away (106px rendered of 306px of content). */}
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl" style={{ background: "var(--fc-surface-active)" }}>
              <img src={farmerSrc("phone")} alt="" className="size-full object-cover" />
              {/* View counter — served content cards that carry a count show it
                  (seen as "23" on device); cards without one render no badge. */}
              <Badge className="absolute top-2 right-2 gap-1 rounded-lg px-2 py-1 text-xs text-white" style={{ background: "rgba(0,0,0,.55)" }}>
                <Eye className="size-3.5" style={{ color: "var(--fc-accent)" }} />23
              </Badge>
            </div>
            <p className="text-[15px] text-foreground">Step-by-step guidance on improving soil structure through cover cropping in your current conditions.</p>
            <Button type="button" className="w-full gap-1.5 font-bold" style={{ borderRadius: rBtn, background: "var(--fc-brand-dark)", color: "#fff" }}>
              Ask Now<ChevronRight className="size-4" style={{ color: "var(--fc-accent)" }} />
            </Button>
          </CardContent>
        </Card>
        <Card className="gap-3 py-0" style={{ borderRadius: rCard }}>
          <CardContent className="space-y-2.5 p-3">
            <p className="text-[15px] text-foreground">Boost fertility without breaking the bank!</p>
            <Button type="button" className="w-full gap-1.5 font-bold" onClick={() => sendChat("How do I boost soil fertility cheaply?")} style={{ borderRadius: rBtn, background: "var(--fc-brand-dark)", color: "#fff" }}>
              Ask Now<ChevronRight className="size-4" style={{ color: "var(--fc-accent)" }} />
            </Button>
          </CardContent>
        </Card>
        <Card className="gap-3 py-0" style={{ borderRadius: rCard }}>
          <CardContent className="space-y-2.5 p-3">
            <div className="font-bold text-foreground">How many acres do you farm?</div>
            <ToggleGroup type="single" spacing={2} value={String(optSel)} onValueChange={(v) => v && setOptSel(Number(v))} variant="outline" className="grid w-full grid-cols-3">
              {OPTS.map((o, i) => <ToggleGroupItem key={o} value={String(i)} className="w-full border px-1 text-sm" style={{ borderRadius: rInput }}>{o}</ToggleGroupItem>)}
            </ToggleGroup>
          </CardContent>
        </Card>
      </div>
      {inputComposer()}
    </div>
  )
  else if (screen === "chat") body = (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {AppBar({ left: <ArrowLeft className="size-5" />, leftGo: "home", logo: true })}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div ref={threadRef} className="flex flex-1 flex-col gap-4 overflow-y-auto p-3.5">
          {chatMsgs.map((m, i) => <Fragment key={i}>{bubble(m)}</Fragment>)}
          {streamStep !== null ? streamStatus() : null}
          {/* Reserve room so the carousel never covers the live status. */}
          {streamStep !== null ? <div className="h-[190px] flex-none" /> : null}
        </div>
        {/* Tips are up for the whole wait and gone the moment text lands. */}
        {streamStep !== null ? tipsCarousel() : null}
      </div>
      {inputComposer()}
    </div>
  )
  else if (screen === "auth") body = (
    <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      {AppBar({ left: <ArrowLeft className="size-5" />, leftGo: "home", title: "Sign up" })}
      <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto p-5 pt-8">
        <h1 className="text-center text-xl font-bold">Enter the One time code/password (OTP) we sent</h1>
        <p className="-mt-2 text-center text-sm text-muted-foreground">Check your messages for One time password (OTP)</p>
        <InputOTP maxLength={4} value={otp} onChange={setOtp} className="caret-transparent" containerClassName="mt-2 w-full justify-center">
          <InputOTPGroup className="flex w-full gap-2">
            {[0, 1, 2, 3].map((i) => (
              <InputOTPSlot key={i} index={i} className="h-14 flex-1 border bg-secondary text-xl" style={{ borderRadius: rInput }} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <Button type="button" className="h-12 w-full" onClick={() => navigate("home")} style={{ borderRadius: rBtn, background: "var(--fc-brand-dark)", color: "#fff" }}>Verify</Button>
        {/* SDK AuthScreen.kt:747 - while the 180 s timer runs this is ONE muted,
            centered line and nothing else; the Resend / Start over buttons only
            appear once it reaches zero. */}
        <p className="w-full text-center text-xs text-muted-foreground">Resend code &middot; 158 seconds</p>
      </div>
    </div>
  )
  else if (screen === "settings") body = (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted text-foreground">
      {AppBar({ left: <Menu className="size-5" />, title: "Settings" })}
      {/* Device layout: bold black section headings on the muted ground, each
          group a plain WHITE card (no outline), helper text below the card. */}
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
        <div className="space-y-2.5">
          <div className="text-[17px] font-bold">Appearance</div>
          <ToggleGroup type="single" spacing={8} value={appearance} onValueChange={(v) => v && setAppearance(v === "night" ? "night" : "day")} className="grid w-full grid-cols-3">
            <ToggleGroupItem value="day" className="h-auto flex-col gap-2 bg-card py-5 font-semibold data-[state=on]:bg-[var(--fc-surface-active)]" style={{ borderRadius: rInput }}><Sun className="size-5" />Day</ToggleGroupItem>
            <ToggleGroupItem value="night" className="h-auto flex-col gap-2 bg-card py-5 font-semibold data-[state=on]:bg-[var(--fc-surface-active)]" style={{ borderRadius: rInput }}><Moon className="size-5" />Night</ToggleGroupItem>
            <ToggleGroupItem value="auto" className="h-auto flex-col gap-2 bg-card py-5 font-semibold data-[state=on]:bg-[var(--fc-surface-active)]" style={{ borderRadius: rInput }}><Smartphone className="size-5" />Auto</ToggleGroupItem>
          </ToggleGroup>
          <p className="text-sm text-muted-foreground">{appearance === "night" ? "FarmerChat is always in dark mode" : "FarmerChat is always in light mode"}</p>
        </div>

        <div className="space-y-2.5">
          <div className="text-[17px] font-bold">My Farm</div>
          <div className="flex items-center gap-3 bg-card px-4 py-4" style={{ borderRadius: rInput }}>
            <MapPin className="size-5 flex-none" />
            <span className="flex-none text-[15px]">Location</span>
            <span className="flex-1 truncate text-[15px] text-muted-foreground">Bengaluru Urban (approximate)</span>
            <ChevronRight className="size-5 flex-none" />
          </div>
          {/* Device splits this line: "Estimated." muted, the invite in brand green. */}
          <p className="text-sm text-muted-foreground">
            Estimated. <span style={{ color: "var(--fc-brand-dark)" }}>Share your location for better advice.</span>
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="text-[17px] font-bold">Account details</div>
          <div className="bg-card" style={{ borderRadius: rInput }}>
            <div className="flex items-center gap-3 px-4 py-4">
              <Phone className="size-5 flex-none" />
              <span className="flex-1 text-[15px]">Your phone</span>
              <span className="text-muted-foreground">&mdash;</span>
            </div>
            <div className="mx-4 border-t" />
            <button type="button" onClick={() => navigate("name")} className="flex w-full items-center gap-3 px-4 py-4 text-left">
              <Info className="size-5 flex-none" />
              <span className="flex-1 text-[15px]">Your name</span>
              <ChevronRight className="size-5 flex-none" />
            </button>
          </div>
        </div>

        <Button type="button" className="h-12 w-full bg-card font-bold text-foreground hover:bg-card" onClick={() => navigate("language")} style={{ borderRadius: rBtn }}>Logout</Button>
      </div>
    </div>
  )

  else if (screen === "splash") body = (
    // Device: logo + arc spinner centred on the muted ground, label below.
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted text-foreground">
      <Logo size={44} className="text-primary" />
      <p className="text-[17px] font-bold">FarmerChat is Starting...</p>
    </div>
  )
  else if (screen === "settingsName") body = (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted text-foreground">
      {AppBar({ left: <ArrowLeft className="size-5" />, leftGo: "settings", title: "Name" })}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="text-sm font-bold">Your name</div>
        <Input placeholder="Enter your name" className="h-12 w-full bg-card px-5"
          style={{ borderRadius: rBtn, borderColor: "var(--fc-accent)" }} />
        <Button type="button" className="h-12 w-full" onClick={() => navigate("settings")}
          style={{ borderRadius: rBtn, background: "var(--fc-brand-dark)", color: "#fff" }}>Save name</Button>
      </div>
    </div>
  )
  else if (screen === "settingsLanguage") body = (
    // Same list as onboarding, but no logo/tagline, a WHITE "All languages"
    // pill, and a pinned "Save language" CTA.
    <div className="flex flex-1 flex-col overflow-hidden bg-muted text-foreground">
      {AppBar({ left: <Menu className="size-5" />, title: "Choose your language" })}
      <div className="flex flex-1 flex-col overflow-y-auto p-4">
        {languageList(false)}
        <Button type="button" className="mt-auto h-13 w-full py-3.5 font-bold" onClick={() => navigate("settings")}
          style={{ borderRadius: rBtn, background: "var(--fc-brand-dark)", color: "#fff" }}>Save language</Button>
      </div>
    </div>
  )
  else if (screen === "chatHistory") body = (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted text-foreground">
      {AppBar({ left: <Menu className="size-5" />, title: "Past Advice" })}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {PAST_ADVICE.map(([q, when]) => (
          <button key={q} type="button" onClick={() => navigate("chat")}
            className="flex w-full items-center gap-3 bg-card px-4 py-3.5 text-left"
            style={{ borderRadius: rInput }}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px]">{q}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{when}</span>
            </span>
            <ChevronRight className="size-5 flex-none text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  )
  else if (screen === "help") body = (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted text-foreground">
      {AppBar({ left: <Menu className="size-5" />, title: "Help" })}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        <div className="text-[17px] font-bold">How to use FarmerChat?</div>
        <div className="bg-card" style={{ borderRadius: rInput }}>
          {FAQS.map((q, i) => (
            <Fragment key={q}>
              {i > 0 ? <div className="mx-4 border-t" /> : null}
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <span className="min-w-0 flex-1 truncate text-[15px]">{q}</span>
                <ChevronRight className="size-5 flex-none" />
              </button>
            </Fragment>
          ))}
        </div>
        <div className="mt-3 text-[17px] font-bold">More</div>
        <div className="bg-card" style={{ borderRadius: rInput }}>
          <button type="button" onClick={() => navigate("legalContent")} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
            <span className="flex-1 text-[15px]">Terms of Use</span><ChevronRight className="size-5" />
          </button>
          <div className="mx-4 border-t" />
          <button type="button" onClick={() => navigate("legalContent")} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
            <span className="flex-1 text-[15px]">Privacy Policy</span><ChevronRight className="size-5" />
          </button>
        </div>
        <p className="mt-6 text-center text-sm font-semibold text-muted-foreground">
          FarmerChat v.2.0.0<br />&copy; Digital Green
        </p>
      </div>
    </div>
  )
  else if (screen === "legalContent") body = (
    <div className="flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      {AppBar({ left: <X className="size-5" />, leftGo: "help", title: "Terms of Use" })}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Server-rendered legal HTML: serif display heading, revision date, rule. */}
        <h1 className="font-serif text-[26px] tracking-wide" style={{ color: "var(--fc-brand-dark)" }}>TERMS OF USE</h1>
        <p className="mt-1 text-sm font-semibold italic text-muted-foreground">Last Revised September 2026</p>
        <div className="my-4 border-t" />
        <p className="text-[15px] leading-relaxed">
          The following terms and conditions (these <strong>&ldquo;Terms&rdquo;</strong>) apply to your use of
          Digital Green Foundation&rsquo;s (<strong>&ldquo;Company&rdquo;</strong>, <strong>&ldquo;we&rdquo;</strong> or{" "}
          <strong>&ldquo;us&rdquo;</strong>) website, www.digitalgreen.org, including any relevant subdomains
          (the <strong>&ldquo;Website&rdquo;</strong>), the artificial intelligence-powered chatbot assistant,
          &ldquo;FarmerChat&rdquo; (the <strong>&ldquo;Chatbot&rdquo;</strong>) and any related mobile applications.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed">
          These Terms govern your access to and use of the Services. Please read these Terms carefully, as
          they include important information about your legal rights.
        </p>
      </div>
    </div>
  )
  else if (screen === "error") body = fullScreenMessage({
    title: "No internet connection",
    main: "FarmerChat needs the internet",
    subtitle: "Check mobile data or Wi-Fi signal",
    cta: "Try again",
    illustration: "sky",   // ErrorScreen.kt:54 LOOKING_AT_SKY
  })
  else if (screen === "accountBenefits") body = fullScreenMessage({
    title: "Sign up", leftClose: true, rightLabel: "Skip",
    main: "Your advice stays with you.",
    subtitle: "Keep important crop recommendations safe and come back to them anytime",
    cta: "Sign up with phone number", chevron: true, go: "auth",
    illustration: "camera",   // AccountScreens.kt:27 LOOKING_AT_CAMERA
  })
  else if (screen === "accountSuccess") body = fullScreenMessage({
    title: "Sign up",
    main: "You\u2019re all set!",
    subtitle: "See your old questions in the menu",
    cta: "Continue",
    illustration: "sky",   // AccountScreens.kt:75 LOOKING_AT_SKY
  })

  return (
    <div className={"phone" + (appearance === "night" ? " dark" : "")} style={shadcnVars(theme, appearance)}>
      <div className="fc-screen">{body}</div>
    </div>
  )
}
