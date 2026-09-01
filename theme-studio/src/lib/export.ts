/* FarmerChat Theme Studio — export code generation.
 *
 * VERIFIED AGAINST SDK SOURCE. This is a verbatim port of the original
 * theme-studio generators; output is byte-for-byte identical (see the golden
 * fixtures / verify harness). Do not "clean up" the empty-string ("") vs unset
 * conditionals — they encode the SDK's "knob omitted = inherit" precedence. */
import { COLORS, SHAPE, type PlatformId, type ThemeState } from "./theme"

function hex6(v: string): string {
  return (v || "").replace("#", "").toUpperCase().padStart(6, "0").slice(0, 6)
}

function setKnobsColor(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  Object.keys(obj).forEach((k) => {
    if (obj[k] !== "" && obj[k] != null) out[k] = obj[k]
  })
  return out
}

/** Empty/nullish numeric knob → 0 (used for always-emitted shape fields). */
function n(v: number | ""): number {
  return v === "" || v == null ? 0 : Number(v)
}

const IMPORT: Record<"web" | "rn", string> = {
  web: "import { FarmerChat } from '@digitalgreenorg/farmerchat-web';",
  rn: "import { FarmerChat } from '@digitalgreenorg/farmerchat-react-native';",
}

function jsColorKnob(L: string[], key: string, val: string): void {
  if (val) L.push("  " + key + ": '" + val + "',")
}

function genJS(state: ThemeState, importLine: string): string {
  const c = state.colors, sh = state.shape, t = state.typography
  const L: string[] = []
  L.push(importLine)
  L.push("")
  L.push("FarmerChat.initialize({")
  L.push("  environment: 'prod',")
  L.push("  theme: {")
  L.push("    colors: {")
  COLORS.forEach(([k]) => L.push("      " + k + ": '" + c[k] + "',"))
  L.push("    },")
  L.push("    shape: { cardCornerRadius: " + n(sh.cardCornerRadius) + ", buttonCornerRadius: " + n(sh.buttonCornerRadius) + ", inputCornerRadius: " + n(sh.inputCornerRadius) + " },")
  const typo: string[] = []
  if (t.typeScale && Number(t.typeScale) !== 1) typo.push("typeScale: " + t.typeScale)
  if (t.fontFamily) typo.push("fontFamily: '" + t.fontFamily + "'")
  if (typo.length) L.push("    typography: { " + typo.join(", ") + " },")
  L.push("  },")
  if (state.fab.fabLabel) L.push("  fabLabel: '" + state.fab.fabLabel + "',")
  jsColorKnob(L, "fabBackgroundColor", state.fab.fabBackgroundColor)
  jsColorKnob(L, "fabContentColor", state.fab.fabContentColor)
  jsColorKnob(L, "userBubbleColor", state.chat.userBubbleColor)
  jsColorKnob(L, "userBubbleTextColor", state.chat.userBubbleTextColor)
  jsColorKnob(L, "aiBubbleTextColor", state.chat.aiBubbleTextColor)
  if (state.chat.bubbleCornerRadius !== "") L.push("  bubbleCornerRadius: " + Number(state.chat.bubbleCornerRadius) + ",")
  if (state.chat.messageFontSize !== "") L.push("  messageFontSize: " + Number(state.chat.messageFontSize) + ",")
  L.push("});")
  return L.join("\n")
}

function genAndroid(state: ThemeState): string {
  const c = state.colors, sh = state.shape, t = state.typography
  const col = (v: string) => "0xFF" + hex6(v) + ".toInt()"
  const L: string[] = []
  L.push("FarmerChat.initialize(this,")
  L.push("  FarmerChatConfig.builder(FarmerChatEnvironment.PROD)")
  L.push("    .theme(FarmerChatTheme.builder()")
  COLORS.forEach(([k]) => L.push("      ." + k + "(" + col(c[k]) + ")"))
  L.push("      .cardCornerRadius(" + n(sh.cardCornerRadius) + ")")
  L.push("      .buttonCornerRadius(" + n(sh.buttonCornerRadius) + ")")
  L.push("      .inputCornerRadius(" + n(sh.inputCornerRadius) + ")")
  if (t.typeScale && Number(t.typeScale) !== 1) L.push("      .typeScale(" + Number(t.typeScale) + "f)")
  if (t.fontFamily) L.push('      // .fontFamily(R.font.your_font)  // add "' + t.fontFamily + '" to res/font/ and reference it')
  L.push("      .build())")
  if (state.fab.fabLabel) L.push('    .fabLabel("' + state.fab.fabLabel + '")')
  if (state.fab.fabBackgroundColor) L.push("    .fabBackgroundColor(" + col(state.fab.fabBackgroundColor) + ")")
  if (state.fab.fabContentColor) L.push("    .fabContentColor(" + col(state.fab.fabContentColor) + ")")
  if (state.chat.userBubbleColor) L.push("    .userBubbleColor(" + col(state.chat.userBubbleColor) + ")")
  if (state.chat.userBubbleTextColor) L.push("    .userBubbleTextColor(" + col(state.chat.userBubbleTextColor) + ")")
  if (state.chat.aiBubbleTextColor) L.push("    .aiBubbleTextColor(" + col(state.chat.aiBubbleTextColor) + ")")
  if (state.chat.bubbleCornerRadius !== "") L.push("    .bubbleCornerRadius(" + Number(state.chat.bubbleCornerRadius) + ")")
  if (state.chat.messageFontSize !== "") L.push("    .messageFontSizeSp(" + Number(state.chat.messageFontSize) + "f)")
  L.push("    .build())")
  return L.join("\n")
}

function topKnobsIOS(state: ThemeState, col?: (v: string) => string): string[] {
  const c = col || ((v: string) => "Color(hex: 0x" + hex6(v) + ")")
  const out: string[] = []
  if (state.fab.fabLabel) out.push('  fabLabel: "' + state.fab.fabLabel + '"')
  if (state.fab.fabBackgroundColor) out.push("  fabBackgroundColor: " + c(state.fab.fabBackgroundColor))
  if (state.fab.fabContentColor) out.push("  fabContentColor: " + c(state.fab.fabContentColor))
  if (state.chat.userBubbleColor) out.push("  userBubbleColor: " + c(state.chat.userBubbleColor))
  if (state.chat.userBubbleTextColor) out.push("  userBubbleTextColor: " + c(state.chat.userBubbleTextColor))
  if (state.chat.aiBubbleTextColor) out.push("  aiBubbleTextColor: " + c(state.chat.aiBubbleTextColor))
  if (state.chat.bubbleCornerRadius !== "") out.push("  bubbleCornerRadius: " + Number(state.chat.bubbleCornerRadius))
  if (state.chat.messageFontSize !== "") out.push("  messageFontSize: " + Number(state.chat.messageFontSize))
  return out
}

function genIOS(state: ThemeState): string {
  const c = state.colors, sh = state.shape, t = state.typography
  const col = (v: string) => "Color(hex: 0x" + hex6(v) + ")"
  const L: string[] = []
  L.push("import FarmerChatCore   // Color(hex:) + FarmerChatConfig/Theme")
  L.push("")
  L.push("_ = FarmerChat.initialize(config: FarmerChatConfig(")
  L.push("  environment: .prod,")
  L.push("  theme: FarmerChatTheme(")
  const themeParts = COLORS.map(([k]) => "    " + k + ": " + col(c[k]))
  themeParts.push("    cardCornerRadius: " + n(sh.cardCornerRadius))
  themeParts.push("    buttonCornerRadius: " + n(sh.buttonCornerRadius))
  themeParts.push("    inputCornerRadius: " + n(sh.inputCornerRadius))
  if (t.typeScale && Number(t.typeScale) !== 1) themeParts.push("    typeScale: " + Number(t.typeScale))
  if (t.fontFamily) themeParts.push('    fontName: "' + t.fontFamily + '"')
  L.push(themeParts.join(",\n"))
  L.push("  )" + (topKnobsIOS(state).length ? "," : ""))
  const knobs = topKnobsIOS(state, col)
  if (knobs.length) L.push(knobs.join(",\n"))
  L.push("))")
  return L.join("\n")
}

export function themeJSON(state: ThemeState): string {
  const c = state.colors, sh = state.shape, t = state.typography
  const obj: Record<string, unknown> = { environment: "prod", theme: { colors: {}, shape: {}, typography: {} } }
  const theme = obj.theme as { colors: Record<string, unknown>; shape: Record<string, unknown>; typography: Record<string, unknown> }
  COLORS.forEach(([k]) => (theme.colors[k] = c[k]))
  SHAPE.forEach(([k]) => (theme.shape[k] = n(sh[k])))
  if (t.typeScale && Number(t.typeScale) !== 1) theme.typography.typeScale = Number(t.typeScale)
  if (t.fontFamily) theme.typography.fontFamily = t.fontFamily
  if (!Object.keys(theme.typography).length) delete (obj.theme as Record<string, unknown>).typography
  Object.assign(obj, setKnobsColor(state.fab as unknown as Record<string, unknown>))
  const chat = setKnobsColor(state.chat as unknown as Record<string, unknown>)
  ;["bubbleCornerRadius", "messageFontSize"].forEach((k) => {
    if (chat[k] !== undefined) chat[k] = Number(chat[k])
  })
  Object.assign(obj, chat)
  return JSON.stringify(obj, null, 2)
}

export function currentCode(state: ThemeState, platform: PlatformId): string {
  if (platform === "web") return genJS(state, IMPORT.web)
  if (platform === "rn") return genJS(state, IMPORT.rn)
  if (platform === "android") return genAndroid(state)
  return genIOS(state)
}

export const FOOT: Record<PlatformId, string> = {
  web: "Paste into your web app. Colors are CSS hex strings. theme.json below is exactly this object → FarmerChat.initialize(JSON.parse(json)).",
  rn: "Paste into your Expo/RN app. Same config object shape as web (colors as hex strings).",
  android: "Paste into Application.onCreate. Colors are ARGB ints. Fonts need a res/font resource id (@FontRes). Shape verified against the SDK builder API — not compiled against a host app here.",
  ios: "Paste into your @main App init. Color(hex:) ships in FarmerChatCore. Shape verified against the SDK API — not compiled against a host app here.",
}

export const EXT: Record<PlatformId, string> = { web: "ts", rn: "ts", android: "kt", ios: "swift" }
