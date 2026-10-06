/* FarmerChat Theme Studio — theme model, schema, and presets.
 *
 * Field set == the SDK's shipped, overridable surface (verified against source).
 * That surface includes an optional DARK palette, which every platform supports under a
 * different name — android `.brandPrimaryNight(...)`, web `theme.dark`, react-native
 * `theme.colors.dark`, iOS `darkBrandPrimary:`. The studio edits one set and each generator
 * emits its own shape; see export.ts.
 * Deliberately NOT exposed: aiBubbleColor / aiAvatarEmoji / showUserAvatar
 * (not shipped — see ../../../docs/04-parity-matrix.md), so we never generate
 * config a platform can't consume. This schema is FROZEN — adding or removing a
 * knob here changes the exported config surface. */

/** A numeric knob whose empty ("") value means "omit — inherit theme/default". */
export type NumOrEmpty = number | ""

export interface Colors {
  brandPrimary: string
  brandPrimaryDark: string
  brandAccent: string
  onBrand: string
  background: string
  readingSurface: string
  cardSurface: string
  onBackground: string
  onSurface: string
  error: string
}

export interface Shape {
  cardCornerRadius: NumOrEmpty
  buttonCornerRadius: NumOrEmpty
  inputCornerRadius: NumOrEmpty
}

export interface Typography {
  fontFamily: string
  typeScale: NumOrEmpty
}

export interface Fab {
  fabLabel: string
  fabBackgroundColor: string
  fabContentColor: string
}

export interface Chat {
  userBubbleColor: string
  userBubbleTextColor: string
  aiBubbleTextColor: string
  bubbleCornerRadius: NumOrEmpty
  messageFontSize: NumOrEmpty
}

/** Optional dark-mode overrides. Empty string on a key = omit it = inherit the light value. */
export type NightColors = Record<keyof Colors, string>

export interface ThemeState {
  colors: Colors
  night: NightColors
  shape: Shape
  typography: Typography
  fab: Fab
  chat: Chat
  config: Config
}

export type PlatformId = "web" | "rn" | "android" | "ios"

/** [key, label] — key matches the SDK exactly. */
export const COLORS: [keyof Colors, string][] = [
  ["brandPrimary", "Brand primary"],
  ["brandPrimaryDark", "Brand primary dark"],
  ["brandAccent", "Brand accent"],
  ["onBrand", "On-brand (text/icon)"],
  ["background", "Background"],
  ["readingSurface", "Reading surface"],
  ["cardSurface", "Card surface"],
  ["onBackground", "On background (text)"],
  ["onSurface", "On surface (text)"],
  ["error", "Error"],
]

/**
 * The dark palette, same keys as [COLORS]. Optional by design: the SDK falls back to the light
 * value for any night colour left unset, so an empty field must stay OUT of the exported config
 * rather than being emitted as a duplicate of the light one.
 */
export const NIGHT_COLORS: [keyof Colors, string][] = COLORS

export const SHAPE: [keyof Shape, string][] = [
  ["cardCornerRadius", "Card radius"],
  ["buttonCornerRadius", "Button radius"],
  ["inputCornerRadius", "Input radius"],
]

/** Optional chat-color knobs (empty = inherit). */
export const CHAT_COLORS: [keyof Chat, string][] = [
  ["userBubbleColor", "User bubble bg"],
  ["userBubbleTextColor", "User bubble text"],
  ["aiBubbleTextColor", "AI answer text"],
]

/** Optional FAB color knobs (empty = inherit). */
export const FAB_COLORS: [keyof Fab, string][] = [
  ["fabBackgroundColor", "FAB background"],
  ["fabContentColor", "FAB content"],
]

export const PLATFORMS: [PlatformId, string][] = [
  ["web", "Web"],
  ["rn", "React Native"],
  ["android", "Android"],
  ["ios", "iOS"],
]

function emptyNight(): NightColors {
  return {
    brandPrimary: "", brandPrimaryDark: "", brandAccent: "", onBrand: "",
    background: "", readingSurface: "", cardSurface: "",
    onBackground: "", onSurface: "", error: "",
  }
}

function palette(o: string[]): Colors {
  return {
    brandPrimary: o[0], brandPrimaryDark: o[1], brandAccent: o[2], onBrand: o[3],
    background: o[4], readingSurface: o[5], cardSurface: o[6],
    onBackground: o[7], onSurface: o[8], error: o[9],
  }
}

/**
 * Runtime configuration — journey, features and environment.
 *
 * NO-HALLUCINATION: every field below is a real builder method on the Android
 * `FarmerChatConfig.Builder` AND a real field on the iOS / React Native / web
 * configs, so the same knob emits on all four platforms. Defaults mirror the
 * SDK's own (`FarmerChatConfig.kt`), and the emitters print a line ONLY when a
 * value differs from the default — so the generated snippet stays as short as
 * the host's actual customisation.
 *
 * `enableComposerUi` is deliberately absent: Android/RN/web have it, iOS does not.
 */
export interface Config {
  environment: "DEV" | "STAGE" | "DEMO" | "PROD" | "EKS"
  guestApiKey: string
  geoApiKey: string
  languageCode: string
  defaultCountryCode: string
  defaultStateCode: string
  appearance: "DAY" | "NIGHT" | "AUTO"
  mode: "FULL_JOURNEY" | "CHAT_ONLY"
  showDrawer: boolean
  showHistory: boolean
  showSettings: boolean
  showNameScreen: boolean
  enableVoice: boolean
  enableImages: boolean
  enableWeather: boolean
  enableSsfr: boolean
  enableAgenticChat: boolean
  enableAnalytics: boolean
}

/** The SDK's own defaults, verbatim from `FarmerChatConfig.kt`. */
export const CONFIG_DEFAULTS: Config = {
  environment: "PROD",
  guestApiKey: "",
  geoApiKey: "",
  languageCode: "",
  defaultCountryCode: "",
  defaultStateCode: "",
  appearance: "AUTO",
  mode: "FULL_JOURNEY",
  showDrawer: true,
  showHistory: true,
  showSettings: true,
  showNameScreen: true,
  enableVoice: true,
  enableImages: true,
  enableWeather: true,
  enableSsfr: true,
  enableAgenticChat: false,
  enableAnalytics: false,
}

export interface Preset {
  sw: string
  values: ThemeState
}

function preset(colors: string[], sw: string): Preset {
  return {
    sw,
    values: {
      colors: palette(colors),
      // Presets ship no dark overrides — the SDK reuses the light palette for both modes
      // unless the designer opts in, and inventing a dark palette per preset would be a
      // fabricated design decision.
      night: emptyNight(),
      shape: { cardCornerRadius: 24, buttonCornerRadius: 999, inputCornerRadius: 12 },
      typography: { fontFamily: "", typeScale: 1 },
      fab: { fabLabel: "", fabBackgroundColor: "", fabContentColor: "" },
      chat: { userBubbleColor: "", userBubbleTextColor: "", aiBubbleTextColor: "", bubbleCornerRadius: "", messageFontSize: "" },
      config: { ...CONFIG_DEFAULTS },
    },
  }
}

export const PRESETS: Record<string, Preset> = {
  "FarmerChat Green": preset(["#008236", "#08361B", "#00C950", "#FFFFFF", "#FFFFFF", "#F7F5EF", "#FFFFFF", "#1C2B26", "#1C2B26", "#C94F3D"], "#008236"),
  "Ocean Blue":       preset(["#1565C0", "#0D47A1", "#42A5F5", "#FFFFFF", "#FFFFFF", "#F1F5FB", "#FFFFFF", "#0D1B2A", "#0D1B2A", "#C62828"], "#1565C0"),
  "Sunset Amber":     preset(["#E67E22", "#B45309", "#F6AD37", "#FFFFFF", "#FFFDF9", "#FDF3E6", "#FFFFFF", "#2A1E10", "#2A1E10", "#C0392B"], "#E67E22"),
  "Royal Purple":     preset(["#6D28D9", "#4C1D95", "#A78BFA", "#FFFFFF", "#FFFFFF", "#F5F1FC", "#FFFFFF", "#1E1633", "#1E1633", "#DC2626"], "#6D28D9"),
  "Teal Midnight":    preset(["#0F766E", "#115E59", "#2DD4BF", "#FFFFFF", "#FFFFFF", "#EEF6F5", "#FFFFFF", "#12211F", "#12211F", "#B91C1C"], "#0F766E"),
  "Crimson Red":      preset(["#C62828", "#8E1C1C", "#FF6659", "#FFFFFF", "#FFFFFF", "#FBEDED", "#FFFFFF", "#161719", "#161719", "#E5533D"], "#C62828"),
  "Indigo":           preset(["#3F51B5", "#283593", "#7986CB", "#FFFFFF", "#FFFFFF", "#F0F1FA", "#FFFFFF", "#161719", "#161719", "#E5533D"], "#3F51B5"),
  "Rose Pink":        preset(["#D81B60", "#AD1457", "#FF80AB", "#FFFFFF", "#FFFFFF", "#FCEEF3", "#FFFFFF", "#161719", "#161719", "#E5533D"], "#D81B60"),
  "Slate Gray":       preset(["#455A64", "#263238", "#90A4AE", "#FFFFFF", "#FFFFFF", "#F2F4F5", "#FFFFFF", "#161719", "#161719", "#E5533D"], "#455A64"),
  "Cyan Sky":         preset(["#0097A7", "#006064", "#4DD0E1", "#FFFFFF", "#FFFFFF", "#ECF7F9", "#FFFFFF", "#161719", "#161719", "#E5533D"], "#0097A7"),
  "Golden":           preset(["#B7860B", "#8C6A00", "#FFD54F", "#FFFFFF", "#FFFFFF", "#FBF5E6", "#FFFFFF", "#161719", "#161719", "#E5533D"], "#B7860B"),
  "Chocolate":        preset(["#6D4C41", "#4E342E", "#A1887F", "#FFFFFF", "#FFFFFF", "#F4EFED", "#FFFFFF", "#161719", "#161719", "#E5533D"], "#6D4C41"),
  "Coral":            preset(["#F4511E", "#C63F0F", "#FF8A65", "#FFFFFF", "#FFFFFF", "#FCEFEA", "#FFFFFF", "#161719", "#161719", "#E5533D"], "#F4511E"),
  "Midnight Navy":    preset(["#1A237E", "#0D1552", "#5C6BC0", "#FFFFFF", "#FFFFFF", "#EEEFF7", "#FFFFFF", "#161719", "#161719", "#E5533D"], "#1A237E"),
  "Forest":           preset(["#2E7D32", "#1B5E20", "#66BB6A", "#FFFFFF", "#FFFFFF", "#EEF5EE", "#FFFFFF", "#161719", "#161719", "#E5533D"], "#2E7D32"),
}

export const DEFAULT_PRESET = "FarmerChat Green"

export function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o))
}
