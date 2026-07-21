/**
 * FarmerChat SDK configuration — environments, base URLs and host-supplied options.
 * Mirrors docs/03-sdk-architecture.md (FarmerChatConfig) and docs/02-api-reference.md (base URLs).
 */

export type FarmerChatEnvironment = 'dev' | 'stage' | 'demo' | 'prod' | 'eks';

export const BASE_URLS: Record<FarmerChatEnvironment, string> = {
  dev: 'https://farmerchat.farmstack.co/mobile-app-dev/',
  stage: 'https://farmerchat.farmstack.co/mobile-app-stage/',
  demo: 'https://farmerchat.farmstack.co/mobile-app-demo/',
  prod: 'https://v2.api.farmer.chat/',
  eks: 'https://api.farmerchat.in/',
};

export const GOOGLE_GEOLOCATE_URL =
  'https://www.googleapis.com/geolocation/v1/geolocate';

export type AppearanceMode = 'day' | 'night' | 'auto';

export type FarmerChatEventListener = (
  name: string,
  props: Record<string, unknown>,
) => void;

// ---------------------------------------------------------------------------
// Host theming contract (docs/07 Part B) — every field optional; omitted
// values fall back to the built-in FarmerChat green brand.
// ---------------------------------------------------------------------------

/** Host color overrides. Every value is an RN color string (`#RRGGBB`, rgba(), etc.). */
export interface FarmerChatThemeColors {
  /** App bars, primary brand surfaces (default Green700 `#008236`). */
  brandPrimary?: string;
  /** Primary buttons, input tiles (default Green800 `#08361B`). */
  brandPrimaryDark?: string;
  /** Chevrons, active radio dot, spinner (default Green500 `#00C950`). */
  brandAccent?: string;
  /** Content/text on brand surfaces (default white). */
  onBrand?: string;
  /** Screen background (default light zinc / near-white). */
  background?: string;
  /** Chat reading background (default near-white). */
  readingSurface?: string;
  /** Card / list background (default white). */
  cardSurface?: string;
  /** Error accents (default app error red). */
  error?: string;
  /** Text on background (default zinc-900 / zinc-100). */
  onBackground?: string;
  /** Text on cards/surfaces (default zinc-900 / zinc-100). */
  onSurface?: string;
}

export interface FarmerChatThemeShape {
  /** Feed / list card corner radius (default 24). */
  cardCornerRadius?: number;
  /** Primary/secondary button corner radius (default 12). */
  buttonCornerRadius?: number;
  /** Text-input / OTP field corner radius (default 12). */
  inputCornerRadius?: number;
}

export interface FarmerChatThemeTypography {
  /** Host font family applied to every text style (default: platform default). */
  fontFamily?: string;
  /** Multiplier on all text sizes/line-heights (default 1.0). */
  typeScale?: number;
}

/** RN logo source — `require('./logo.png')` (number) or a remote `{ uri }`. */
export type FarmerChatLogoSource = number | { uri: string };

/**
 * Host theme (docs/07 Part B). Supply a light set and optionally a dark set
 * via `colors.dark`; if only one set is given it is used for both, with
 * sensible dark derivations for the brand colors.
 */
export interface FarmerChatTheme {
  colors?: FarmerChatThemeColors & { dark?: FarmerChatThemeColors };
  shape?: FarmerChatThemeShape;
  typography?: FarmerChatThemeTypography;
  logo?: FarmerChatLogoSource;
}

/** Authentication mode (docs/07 Part C — C2). */
export type FarmerChatAuthMode = 'SDK_OTP' | 'HOST_TOKEN';

/** Journey mode (docs/07 Part C — C3). */
export type FarmerChatMode = 'FULL_JOURNEY' | 'CHAT_ONLY';

/**
 * Host-supplied access tokens / provider for `authMode: 'HOST_TOKEN'` (C2).
 * `tokenProvider` is called on init (when no token cached) and on 401.
 */
export type FarmerChatTokenProvider = () => Promise<{
  accessToken: string;
  refreshToken?: string;
} | null> | { accessToken: string; refreshToken?: string } | null;

/** Semantic lifecycle callbacks (docs/07 Part C — C4). All optional. */
export interface FarmerChatCallbacks {
  onChatOpened?: () => void;
  onMessageSent?: (text: string) => void;
  onAnswerReceived?: (messageId: string) => void;
  onScreenView?: (name: string) => void;
  onError?: (code: number, message: string) => void;
  onSessionStart?: () => void;
}

export interface FarmerChatConfig {
  /** Backend environment. Selects the base URL. */
  environment: FarmerChatEnvironment;
  /**
   * Optional custom base URL. When set (non-empty) it OVERRIDES the `environment`
   * base URL — point the SDK at your own backend, or a local mock. Should end with `/`.
   */
  customBaseUrl?: string;
  /** Google Geolocation API key (language auto-detect fallback). */
  geoApiKey?: string;
  /** Overrides the built-in guest-init / send_tokens API key. */
  guestApiKey?: string;
  /** Theme mode. Default 'auto' (follows system). */
  appearance?: AppearanceMode;
  /** Preselect a language code; skips the language screen when valid. */
  languageCode?: string;
  /** Enable voice (Speak) input + TTS Listen. Default true. */
  enableVoice?: boolean;
  /** Enable image (Photo) queries. Default true. */
  enableImages?: boolean;
  /** Enable the weather chip + weather advice CTA. Default true. */
  enableWeather?: boolean;
  /** Enable the SSFR (self-service farmer registration) home card. Default true. */
  enableSsfr?: boolean;
  /** Show the Settings entry in the drawer. Default true. */
  showSettings?: boolean;
  /** Show the chat-history entry + "See all" in the drawer. Default true. */
  showHistory?: boolean;
  /** Show the hamburger/drawer chrome at all. Default true. */
  showDrawer?: boolean;

  /** FAB default label; omitted → round icon-only FAB (per-instance `label` wins). */
  fabLabel?: string;
  /** FAB default background color (hex); omitted → theme brand (per-instance `backgroundColor` wins). */
  fabBackgroundColor?: string;
  /** FAB default icon/label color (hex); omitted → on-brand (per-instance `contentColor` wins). */
  fabContentColor?: string;

  /** Host theme overrides (docs/07 Part B). Omitted → built-in green brand. */
  theme?: FarmerChatTheme;

  /** Journey mode (C3). `FULL_JOURNEY` (default) or `CHAT_ONLY`. */
  mode?: FarmerChatMode;

  /** Authentication mode (C2). `SDK_OTP` (default) or `HOST_TOKEN`. */
  authMode?: FarmerChatAuthMode;
  /** HOST_TOKEN: host-supplied access token (skips OTP UI). */
  accessToken?: string;
  /** HOST_TOKEN: optional refresh token. */
  refreshToken?: string;
  /** HOST_TOKEN: callback to (re)issue tokens on init / 401. */
  tokenProvider?: FarmerChatTokenProvider;

  /** Force a language code regardless of device/onboarding (C5). */
  locale?: string;
  /** Host label overrides — highest precedence, win over server labels (C5). */
  stringOverrides?: Record<string, string>;

  /** Semantic lifecycle callbacks (C4). */
  callbacks?: FarmerChatCallbacks;

  /** Analytics fan-out — same event names/props as the production app. */
  onEvent?: FarmerChatEventListener;
  /** Called when both token refresh and the guest-token fallback fail. */
  onSessionExpired?: () => void;
}

export interface ResolvedFarmerChatConfig {
  environment: FarmerChatEnvironment;
  baseUrl: string;
  geoApiKey: string | null;
  guestApiKey: string | null;
  appearance: AppearanceMode;
  languageCode: string | null;
  enableVoice: boolean;
  enableImages: boolean;
  enableWeather: boolean;
  enableSsfr: boolean;
  showSettings: boolean;
  showHistory: boolean;
  showDrawer: boolean;
  fabLabel: string | null;
  fabBackgroundColor: string | null;
  fabContentColor: string | null;
  theme: FarmerChatTheme | null;
  mode: FarmerChatMode;
  authMode: FarmerChatAuthMode;
  accessToken: string | null;
  refreshToken: string | null;
  tokenProvider: FarmerChatTokenProvider | null;
  locale: string | null;
  stringOverrides: Record<string, string>;
  callbacks: FarmerChatCallbacks;
  onEvent: FarmerChatEventListener | null;
  onSessionExpired: (() => void) | null;
}

export function resolveConfig(config: FarmerChatConfig): ResolvedFarmerChatConfig {
  const envBaseUrl = BASE_URLS[config.environment];
  if (!envBaseUrl) {
    throw new Error(
      `[FarmerChat] Unknown environment "${config.environment}". ` +
        `Expected one of: ${Object.keys(BASE_URLS).join(', ')}`,
    );
  }
  // A custom base URL (when non-empty) overrides the environment base URL.
  const baseUrl =
    config.customBaseUrl && config.customBaseUrl.length > 0
      ? config.customBaseUrl
      : envBaseUrl;
  return {
    environment: config.environment,
    baseUrl,
    geoApiKey: config.geoApiKey ?? null,
    guestApiKey: config.guestApiKey ?? DEFAULT_GUEST_API_KEY,
    appearance: config.appearance ?? 'auto',
    // A forced locale (C5) also preselects the language, skipping the language screen.
    languageCode: config.locale ?? config.languageCode ?? null,
    enableVoice: config.enableVoice ?? true,
    enableImages: config.enableImages ?? true,
    enableWeather: config.enableWeather ?? true,
    enableSsfr: config.enableSsfr ?? true,
    showSettings: config.showSettings ?? true,
    showHistory: config.showHistory ?? true,
    showDrawer: config.showDrawer ?? true,
    fabLabel: config.fabLabel ?? null,
    fabBackgroundColor: config.fabBackgroundColor ?? null,
    fabContentColor: config.fabContentColor ?? null,
    theme: config.theme ?? null,
    mode: config.mode ?? 'FULL_JOURNEY',
    authMode: config.authMode ?? 'SDK_OTP',
    accessToken: config.accessToken ?? null,
    refreshToken: config.refreshToken ?? null,
    tokenProvider: config.tokenProvider ?? null,
    locale: config.locale ?? null,
    stringOverrides: config.stringOverrides ?? {},
    callbacks: config.callbacks ?? {},
    onEvent: config.onEvent ?? null,
    onSessionExpired: config.onSessionExpired ?? null,
  };
}

/** SDK build version reported in the Build-Version header. */
export const BUILD_VERSION_HEADER_VALUE = 'v2';
export const SDK_VERSION = '1.0.0';

/**
 * Built-in guest API key (app's `RemoteConfigKeys.GUEST_USER_API_KEY`),
 * overridable via `FarmerChatConfig.guestApiKey` — see docs/05 open question #2.
 */
export const DEFAULT_GUEST_API_KEY = 'Y2K3kW5R9uQ0fL2X8zI7hT3aJ7';
