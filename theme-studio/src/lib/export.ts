/* FarmerChat Theme Studio — export code generation.
 *
 * VERIFIED AGAINST SDK SOURCE. This is a verbatim port of the original
 * theme-studio generators; output is byte-for-byte identical (see the golden
 * fixtures / verify harness). Do not "clean up" the empty-string ("") vs unset
 * conditionals — they encode the SDK's "knob omitted = inherit" precedence. */
import { COLORS, CONFIG_DEFAULTS, NIGHT_COLORS, SHAPE, type Config, type PlatformId, type ThemeState } from "./theme"

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
/**
 * Config entries that differ from the SDK's own default, in a fixed order.
 * Anything matching the default is omitted — the SDK already applies it, and a
 * snippet padded with redundant defaults hides the host's real customisation.
 * `enableAnalytics` is handled separately by each generator: it is printed even
 * at its default, because a host who never sees the flag cannot work out why no
 * events arrive.
 */
const CONFIG_ORDER: (keyof Config)[] = [
  "guestApiKey", "geoApiKey", "languageCode", "defaultCountryCode", "defaultStateCode",
  "appearance", "mode",
  "showDrawer", "showHistory", "showSettings", "showNameScreen",
  "enableVoice", "enableImages", "enableWeather", "enableSsfr", "enableAgenticChat",
]
function changedConfig(state: ThemeState): [keyof Config, string | boolean][] {
  const cfg = state.config ?? CONFIG_DEFAULTS
  const out: [keyof Config, string | boolean][] = []
  for (const k of CONFIG_ORDER) {
    const v = cfg[k] as string | boolean
    if (v === CONFIG_DEFAULTS[k]) continue
    if (typeof v === "string" && v.trim() === "") continue
    out.push([k, v])
  }
  return out
}

/** Android: builder calls. Enums are SCREAMING_CASE (`FarmerChatConfig.kt:35,49`). */
function configAndroid(state: ThemeState): string[] {
  return changedConfig(state).map(([k, v]) => {
    if (k === "appearance") return "    .appearance(FarmerChatAppearance." + v + ")"
    if (k === "mode") return "    .mode(FarmerChatMode." + v + ")"
    if (typeof v === "boolean") return "    ." + k + "(" + v + ")"
    return "    ." + k + '("' + v + '")'
  })
}

/** web / react-native: object literal. appearance is lower-case, mode is not. */
function configJS(state: ThemeState): string[] {
  return changedConfig(state).map(([k, v]) => {
    if (k === "appearance") return "  appearance: '" + String(v).toLowerCase() + "',"
    if (typeof v === "boolean") return "  " + k + ": " + v + ","
    return "  " + k + ": '" + v + "',"
  })
}

/** iOS: memberwise init. Enums are lowerCamelCase (`FarmerChatConfig.swift:27,46`). */
function configIOS(state: ThemeState): string[] {
  return changedConfig(state).map(([k, v]) => {
    if (k === "appearance") return "  appearance: ." + String(v).toLowerCase()
    if (k === "mode") return "  mode: ." + (v === "CHAT_ONLY" ? "chatOnly" : "fullJourney")
    if (typeof v === "boolean") return "  " + k + ": " + v
    return "  " + k + ': "' + v + '"'
  })
}

function n(v: number | ""): number {
  return v === "" || v == null ? 0 : Number(v)
}

const IMPORT: Record<"web" | "rn", string> = {
  web: "import { FarmerChat } from '@digitalgreenorg/farmerchat-web';",
  rn: "import { FarmerChat } from '@digitalgreenorg/farmerchat-react-native';",
}

/** Night keys the designer actually set. Unset = omit = SDK inherits the light value. */
function nightEntries(state: ThemeState): [string, string][] {
  return NIGHT_COLORS
    .map(([k]) => [k as string, state.night[k]] as [string, string])
    .filter(([, v]) => !!v)
}

function jsColorKnob(L: string[], key: string, val: string): void {
  if (val) L.push("  " + key + ": '" + val + "',")
}

function genJS(state: ThemeState, importLine: string, platform: "web" | "rn"): string {
  const c = state.colors, sh = state.shape, t = state.typography
  const L: string[] = []
  L.push(importLine)
  L.push("")
  L.push("FarmerChat.initialize({")
  L.push("  environment: '" + (state.config?.environment ?? "PROD").toLowerCase() + "',")
  L.push("  theme: {")
  L.push("    colors: {")
  COLORS.forEach(([k]) => L.push("      " + k + ": '" + c[k] + "',"))
  const night = nightEntries(state)
  // react-native nests the dark palette INSIDE colors (`colors.dark`); web puts it BESIDE them
  // (`theme.dark`). Same designer intent, two different shapes — verified in each package's
  // core/config.ts.
  if (night.length && platform === "rn") {
    L.push("      dark: {")
    night.forEach(([k, v]) => L.push("        " + k + ": '" + v + "',"))
    L.push("      },")
  }
  L.push("    },")
  if (night.length && platform === "web") {
    L.push("    dark: {")
    night.forEach(([k, v]) => L.push("      " + k + ": '" + v + "',"))
    L.push("    },")
  }
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
  configJS(state).forEach((l) => L.push(l))
  // Printed even at its default — see CONFIG_ORDER's note.
  L.push("  // Telemetry is OFF by default. Semantic callbacks fire either way.")
  L.push("  enableAnalytics: " + (state.config?.enableAnalytics ?? false) + ",")
  L.push("});")
  return L.join("\n")
}

function genAndroid(state: ThemeState): string {
  const c = state.colors, sh = state.shape, t = state.typography
  const col = (v: string) => "0xFF" + hex6(v) + ".toInt()"
  const L: string[] = []
  L.push("FarmerChat.initialize(this,")
  L.push("  FarmerChatConfig.builder(FarmerChatEnvironment." + (state.config?.environment ?? "PROD") + ")")
  L.push("    .theme(FarmerChatTheme.builder()")
  COLORS.forEach(([k]) => L.push("      ." + k + "(" + col(c[k]) + ")"))
  L.push("      .cardCornerRadius(" + n(sh.cardCornerRadius) + ")")
  L.push("      .buttonCornerRadius(" + n(sh.buttonCornerRadius) + ")")
  L.push("      .inputCornerRadius(" + n(sh.inputCornerRadius) + ")")
  if (t.typeScale && Number(t.typeScale) !== 1) L.push("      .typeScale(" + Number(t.typeScale) + "f)")
  // Android names each dark override `<key>Night` on the SAME builder.
  nightEntries(state).forEach(([k, v]) => L.push("      ." + k + "Night(" + col(v) + ")"))
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
  // Emitted UNCONDITIONALLY and explicitly, unlike the theme knobs above.
  //
  // Those encode "omitted = inherit", so leaving them out is meaningful. This one is the
  // opposite: `enableAnalytics` defaults to FALSE in 2.0.0, so omitting it means a host wires
  // everything up, sees no events reach onEvent, and has nothing in their own code to explain
  // why. Printing the flag with its default makes the switch discoverable at the one moment the
  // host is looking at their config. Android-only — the iOS/web/RN trees do not have this flag.
  configAndroid(state).forEach((l) => L.push(l))
  L.push("    // Telemetry is OFF by default in 2.0.0. Flip to true when you are ready to")
  L.push("    // receive events on your analytics listener. Semantic hooks (onChatOpened,")
  L.push("    // onMessageSent, ...) are NOT gated by this and fire either way.")
  L.push("    .enableAnalytics(" + (state.config?.enableAnalytics ?? false) + ")")
  L.push("    .build())")
  return L.join("\n")
}

/**
 * Position of each argument in `FarmerChatConfig.init` (FarmerChatConfig.swift:247).
 *
 * Swift inits are ORDER-SENSITIVE — arguments must appear in declaration order or
 * the call does not compile. Emitting in UI order silently produces a snippet that
 * fails in Xcode, so every line is tagged with its position here and sorted before
 * printing. Gaps are arguments the studio does not emit (customBaseURL, the
 * lat/long pair, auth, callbacks).
 */
/**
 * Position of each argument in `FarmerChatTheme.init` (FarmerChatTheme.swift).
 *
 * Same order-sensitivity as the config init, and the Swift order is NOT the order
 * the other platforms use: `error` sits BEFORE `onBackground`/`onSurface`, every
 * `dark*` override comes BEFORE the radii, and `fontName` precedes `typeScale`.
 * Emitting the shared COLORS order here produced Swift that did not compile.
 */
const IOS_THEME_ORDER: Record<string, number> = {
  brandPrimary: 0, brandPrimaryDark: 1, brandAccent: 2, onBrand: 3, background: 4,
  readingSurface: 5, cardSurface: 6, error: 7, onBackground: 8, onSurface: 9,
  darkBrandPrimary: 10, darkBrandPrimaryDark: 11, darkBrandAccent: 12, darkOnBrand: 13,
  darkBackground: 14, darkReadingSurface: 15, darkCardSurface: 16, darkError: 17,
  darkOnBackground: 18, darkOnSurface: 19,
  cardCornerRadius: 20, buttonCornerRadius: 21, inputCornerRadius: 22,
  fontName: 23, typeScale: 24, logo: 25,
}

const IOS_ARG_ORDER: Record<string, number> = {
  environment: 0, customBaseURL: 1, geoApiKey: 2, guestApiKey: 3, appearance: 4, theme: 5,
  languageCode: 6, defaultCountryCode: 7, defaultStateCode: 8,
  enableVoice: 11, enableImages: 12, enableWeather: 13, enableAgenticChat: 14,
  fabLabel: 15, fabBackgroundColor: 16, fabContentColor: 17,
  userBubbleColor: 18, userBubbleTextColor: 19, aiBubbleTextColor: 20,
  bubbleCornerRadius: 21, messageFontSize: 22,
  mode: 27, showSettings: 28, showHistory: 29, showDrawer: 30, showNameScreen: 31,
  enableAnalytics: 32, enableSsfr: 33,
}

function genIOS(state: ThemeState): string {
  const c = state.colors, sh = state.shape, t = state.typography
  const col = (v: string) => "Color(hex: 0x" + hex6(v) + ")"
  const args: { i: number; text: string }[] = []
  const put = (key: string, text: string) => args.push({ i: IOS_ARG_ORDER[key] ?? 999, text })

  put("environment", "  environment: ." + (state.config?.environment ?? "PROD").toLowerCase())

  // theme is one multi-line argument
  const tp: { i: number; text: string }[] = []
  const putTheme = (key: string, text: string) => tp.push({ i: IOS_THEME_ORDER[key] ?? 999, text })
  COLORS.forEach(([k]) => putTheme(k, "    " + k + ": " + col(c[k])))
  putTheme("cardCornerRadius", "    cardCornerRadius: " + n(sh.cardCornerRadius))
  putTheme("buttonCornerRadius", "    buttonCornerRadius: " + n(sh.buttonCornerRadius))
  putTheme("inputCornerRadius", "    inputCornerRadius: " + n(sh.inputCornerRadius))
  // iOS prefixes each dark override `dark<Key>` as a flat property.
  nightEntries(state).forEach(([k, v]) => {
    const key = "dark" + k.charAt(0).toUpperCase() + k.slice(1)
    putTheme(key, "    " + key + ": " + col(v))
  })
  if (t.typeScale && Number(t.typeScale) !== 1) putTheme("typeScale", "    typeScale: " + Number(t.typeScale))
  if (t.fontFamily) putTheme("fontName", '    fontName: "' + t.fontFamily + '"')
  tp.sort((a, b) => a.i - b.i)
  put("theme", "  theme: FarmerChatTheme(\n" + tp.map((x) => x.text).join(",\n") + "\n  )")

  if (state.fab.fabLabel) put("fabLabel", '  fabLabel: "' + state.fab.fabLabel + '"')
  if (state.fab.fabBackgroundColor) put("fabBackgroundColor", "  fabBackgroundColor: " + col(state.fab.fabBackgroundColor))
  if (state.fab.fabContentColor) put("fabContentColor", "  fabContentColor: " + col(state.fab.fabContentColor))
  if (state.chat.userBubbleColor) put("userBubbleColor", "  userBubbleColor: " + col(state.chat.userBubbleColor))
  if (state.chat.userBubbleTextColor) put("userBubbleTextColor", "  userBubbleTextColor: " + col(state.chat.userBubbleTextColor))
  if (state.chat.aiBubbleTextColor) put("aiBubbleTextColor", "  aiBubbleTextColor: " + col(state.chat.aiBubbleTextColor))
  if (state.chat.bubbleCornerRadius !== "") put("bubbleCornerRadius", "  bubbleCornerRadius: " + Number(state.chat.bubbleCornerRadius))
  if (state.chat.messageFontSize !== "") put("messageFontSize", "  messageFontSize: " + Number(state.chat.messageFontSize))

  configIOS(state).forEach((line) => {
    const key = line.trim().split(":")[0]
    put(key, line)
  })
  put("enableAnalytics", "  enableAnalytics: " + (state.config?.enableAnalytics ?? false))

  args.sort((a, b) => a.i - b.i)
  const L: string[] = []
  L.push("import FarmerChatCore   // Color(hex:) + FarmerChatConfig/Theme")
  L.push("")
  L.push("_ = FarmerChat.initialize(config: FarmerChatConfig(")
  L.push(args.map((a) => a.text).join(",\n"))
  L.push("))")
  return L.join("\n")
}

export function themeJSON(state: ThemeState): string {
  const c = state.colors, sh = state.shape, t = state.typography
  const obj: Record<string, unknown> = { environment: (state.config?.environment ?? "PROD").toLowerCase(), theme: { colors: {}, shape: {}, typography: {} } }
  const theme = obj.theme as { colors: Record<string, unknown>; shape: Record<string, unknown>; typography: Record<string, unknown> }
  COLORS.forEach(([k]) => (theme.colors[k] = c[k]))
  SHAPE.forEach(([k]) => (theme.shape[k] = n(sh[k])))
  const night = nightEntries(state)
  // theme.json mirrors the WEB config object (that is what FarmerChat.initialize(JSON.parse(...))
  // consumes), so the dark palette sits beside `colors`, not inside it.
  if (night.length) {
    const dark: Record<string, unknown> = {}
    night.forEach(([k, v]) => (dark[k] = v))
    ;(obj.theme as Record<string, unknown>).dark = dark
  }
  if (t.typeScale && Number(t.typeScale) !== 1) theme.typography.typeScale = Number(t.typeScale)
  if (t.fontFamily) theme.typography.fontFamily = t.fontFamily
  if (!Object.keys(theme.typography).length) delete (obj.theme as Record<string, unknown>).typography
  Object.assign(obj, setKnobsColor(state.fab as unknown as Record<string, unknown>))
  const chat = setKnobsColor(state.chat as unknown as Record<string, unknown>)
  ;["bubbleCornerRadius", "messageFontSize"].forEach((k) => {
    if (chat[k] !== undefined) chat[k] = Number(chat[k])
  })
  Object.assign(obj, chat)
  // theme.json mirrors the web config object, so the runtime knobs belong here too.
  changedConfig(state).forEach(([k, v]) => {
    obj[k] = k === "appearance" ? String(v).toLowerCase() : v
  })
  obj.enableAnalytics = state.config?.enableAnalytics ?? false
  return JSON.stringify(obj, null, 2)
}

export function currentCode(state: ThemeState, platform: PlatformId): string {
  if (platform === "web") return genJS(state, IMPORT.web, "web")
  if (platform === "rn") return genJS(state, IMPORT.rn, "rn")
  if (platform === "android") return genAndroid(state)
  return genIOS(state)
}

export const FOOT: Record<PlatformId, string> = {
  web: "Paste into your web app. Colors are CSS hex strings. theme.json below is exactly this object → FarmerChat.initialize(JSON.parse(json)).",
  rn: "Paste into your Expo/RN app. Colors are hex strings, as on web — but the DARK palette differs: react-native nests it at theme.colors.dark, where web puts it at theme.dark. Use the code above rather than the web-shaped theme.json.",
  android: "Paste into Application.onCreate. Colors are ARGB ints. Fonts need a res/font resource id (@FontRes). Shape verified against the SDK builder API — not compiled against a host app here.",
  ios: "Paste into your @main App init. Color(hex:) ships in FarmerChatCore. Shape verified against the SDK API — not compiled against a host app here.",
}

export const EXT: Record<PlatformId, string> = { web: "ts", rn: "ts", android: "kt", ios: "swift" }
