/**
 * FarmerChat SDK configuration — environments, base URLs and host-supplied options.
 * Mirrors docs/03-sdk-architecture.md (FarmerChatConfig) and docs/02-api-reference.md (base URLs).
 */

import { fromDeviceLocale, isResolved } from './countryLatLng';

export type FarmerChatEnvironment = 'dev' | 'stage' | 'demo' | 'prod' | 'eks';

export const BASE_URLS: Record<FarmerChatEnvironment, string> = {
  dev: 'https://farmerchat.farmstack.co/mobile-app-dev/',
  // STAGE base URL switched to the agentic demo backend (requested 2026-09-08); applies to
  // debug and release alike. Previous host kept commented for a one-line revert.
  //   stage: 'https://farmerchat.farmstack.co/mobile-app-stage/',
  stage: 'https://demo.agent.farmer.chat/',
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
  /**
   * Fired when the user closes the SDK from a surface that has nowhere to go
   * back to (e.g. CHAT_ONLY chat close). The host should unmount / hide the SDK.
   */
  onExit?: () => void;
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
  /**
   * OPTIONAL override for the country used in the language list when `initialize_user` returns a
   * null/blank `country_code` (the normal case for a fresh guest on an IP the backend cannot
   * resolve — verified live 2026-09-03 on prod).
   *
   * **Leave this unset (the default) and the SDK derives the country from the device locale**,
   * exactly as the app does. Endpoint #2 rejects a blank `country_code` with HTTP 400, so if the
   * locale carries no region either, {@link LAST_RESORT_COUNTRY_CODE} is sent.
   *
   * Set it only to pin the SDK to one region regardless of where the device is.
   * @default '' (derive from the device locale)
   */
  defaultCountryCode?: string;
  /**
   * OPTIONAL `state` query param for endpoint #2. Empty by default and safe to leave empty: the
   * parameter is inert on every environment — `Karnataka`, `KA`, blank and omitted all return the
   * identical set (verified live 2026-09-03).
   * @default '' (parameter effectively omitted)
   */
  defaultStateCode?: string;
  /**
   * OPTIONAL override for the coordinates posted to endpoint #11 when nothing else resolved a
   * location. **Leave these at {@link COORDINATE_UNSET} (the default) and the SDK uses the device
   * locale's country centroid**, exactly as the app does on IP-geolocation failure
   * (`CountryLatLngProvider.getLatLngFromDeviceLocale`).
   *
   * Endpoint #12 (home feed) is gated on the backend having a resolved location, and it resolves
   * one ONLY from coordinates — a country name alone is rejected (verified live 2026-09-01).
   * That is why coordinates are needed at all.
   *
   * If both these and the device locale are unset, NO coordinates are sent — a guess would put
   * the farmer's advice in the wrong place. Set them to pin a region deliberately.
   * @default 0 (derive from the device locale)
   */
  defaultLatitude?: number;
  defaultLongitude?: number;
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
  /**
   * Mirrors the app's `show_name_screen` RemoteConfig flag and Android's
   * `FarmerChatConfig.showNameScreen`. When false the Enter-Name step is skipped and the
   * profile is marked done. Added 2026-09-16 — see docs/04 "Config-parity audit".
   */
  showNameScreen?: boolean;
  /**
   * Telemetry master switch, default **false** — matches android's
   * `FarmerChatConfig.enableAnalytics`. Until 2026-09-16 this platform emitted every event to a
   * host's `onEvent` unconditionally while android dropped them, so the same host code saw
   * different behaviour per platform (docs/04 "Config-parity audit").
   */
  enableAnalytics?: boolean;
  /**
   * Opt in to agentic (v2) streaming chat — endpoint #27a
   * `api/chat/get_answer_for_text_query_agentic/`, streamed as `text/event-stream`.
   *
   * **Default false**, so a host that does nothing keeps 1.0.0 behaviour: one synchronous #27
   * reply. When true the chat screen streams the answer live, shows tool progress, and can
   * surface an interrupted-stream retry card.
   *
   * Alignment surfaces (clarify / confirm / escalate chips) are NOT gated on this flag — they
   * arrive on the synchronous #27 response too.
   */
  enableAgenticChat?: boolean;

  /**
   * Show the unified floating InputComposer in Home and Chat instead of the legacy
   * Photo/Speak/Type row.
   *
   * Mirrors the app's `v2_composer_ui_enabled` Remote Config flag, which the app documents as
   * **independent** of `v2_agentic_chat_enabled`: it only controls the input surface, not which
   * API the query is routed to.
   *
   * **Omitted (the default) means "follow `enableAgenticChat`"** — exactly the collapse every
   * screen hardcoded before this knob existed, so an existing host sees no change. Set it to
   * decouple the two. Read it through `resolvedConfig.composerUi`, never directly.
   */
  enableComposerUi?: boolean;

  /** FAB default label; omitted → round icon-only FAB (per-instance `label` wins). */
  fabLabel?: string;
  /** FAB default background color (hex); omitted → theme brand (per-instance `backgroundColor` wins). */
  fabBackgroundColor?: string;
  /** FAB default icon/label color (hex); omitted → on-brand (per-instance `contentColor` wins). */
  fabContentColor?: string;

  // --- Chat UI customization (omitted → current theme behavior) ---
  /** User message bubble background (hex). */
  userBubbleColor?: string;
  /** User message bubble text color (hex). */
  userBubbleTextColor?: string;
  /** AI message body text color (hex). */
  aiBubbleTextColor?: string;
  /** Message bubble corner radius (px). */
  bubbleCornerRadius?: number;
  /** Chat message body font size (px). */
  messageFontSize?: number;

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
  defaultCountryCode: string;
  defaultStateCode: string;
  defaultLatitude: number;
  defaultLongitude: number;
  enableVoice: boolean;
  enableImages: boolean;
  enableWeather: boolean;
  enableSsfr: boolean;
  showSettings: boolean;
  showHistory: boolean;
  showDrawer: boolean;
  showNameScreen: boolean;
  enableAnalytics: boolean;
  enableAgenticChat: boolean;
  /**
   * Resolved composer decision: the host's `enableComposerUi` when set, else
   * `enableAgenticChat` (the historical collapse). Screens read THIS, never the raw option.
   */
  composerUi: boolean;
  fabLabel: string | null;
  fabBackgroundColor: string | null;
  fabContentColor: string | null;
  userBubbleColor: string | null;
  userBubbleTextColor: string | null;
  aiBubbleTextColor: string | null;
  bubbleCornerRadius: number | null;
  messageFontSize: number | null;
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
    defaultCountryCode: config.defaultCountryCode?.trim() || DEFAULT_COUNTRY_CODE,
    defaultStateCode: config.defaultStateCode?.trim() || DEFAULT_STATE_CODE,
    defaultLatitude: config.defaultLatitude ?? COORDINATE_UNSET,
    defaultLongitude: config.defaultLongitude ?? COORDINATE_UNSET,
    enableVoice: config.enableVoice ?? true,
    enableImages: config.enableImages ?? true,
    enableWeather: config.enableWeather ?? true,
    enableSsfr: config.enableSsfr ?? true,
    showSettings: config.showSettings ?? true,
    showHistory: config.showHistory ?? true,
    showDrawer: config.showDrawer ?? true,
    showNameScreen: config.showNameScreen ?? true,
    enableAnalytics: config.enableAnalytics ?? false,
    // 2.0.0 opt-in; false keeps the synchronous #27 path (root CLAUDE.md §3 no-regression).
    enableAgenticChat: config.enableAgenticChat ?? false,
    // `enableComposerUi` omitted ⇒ follow enableAgenticChat, preserving today's behaviour.
    composerUi: config.enableComposerUi ?? config.enableAgenticChat ?? false,
    fabLabel: config.fabLabel ?? null,
    fabBackgroundColor: config.fabBackgroundColor ?? null,
    fabContentColor: config.fabContentColor ?? null,
    userBubbleColor: config.userBubbleColor ?? null,
    userBubbleTextColor: config.userBubbleTextColor ?? null,
    aiBubbleTextColor: config.aiBubbleTextColor ?? null,
    bubbleCornerRadius: config.bubbleCornerRadius ?? null,
    messageFontSize: config.messageFontSize ?? null,
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

/**
 * Last-resort country for endpoint #2 — used ONLY when the server, the persisted value, the host
 * config AND the device locale all fail to name one.
 *
 * Endpoint #2 400s on a blank `country_code` (`{"error": "Country code is required"}` — verified
 * live 2026-09-03 on prod), so a floor has to exist at all. `"KE"` is the app's own literal on
 * its primary guest-init path, and dev/stage/prod/eks all return Kenya only (verified live
 * 2026-09-03).
 *
 * This is a floor, not a default: the normal answer comes from the device locale via
 * {@link fromDeviceLocale}, exactly as the app does.
 */
export const LAST_RESORT_COUNTRY_CODE = 'KE';

/**
 * Sentinel meaning "no country configured — derive it from the device locale".
 *
 * An earlier build shipped `'IN'` here, which pinned every guest the backend could not place to
 * India regardless of where they actually were.
 */
export const DEFAULT_COUNTRY_CODE = '';

/**
 * No default state is invented.
 *
 * Endpoint #2's `state` is inert on every environment — dev, stage, prod and eks all return the
 * identical set for `state=Karnataka`, `state=KA`, `state=` and the parameter omitted (verified
 * live 2026-09-03). An earlier build shipped `'Karnataka'` as a default, which is both unfaithful
 * to the app and wrong for a Kenya-only backend.
 */
export const DEFAULT_STATE_CODE = '';

/**
 * Sentinel meaning "no coordinates configured — derive them from the device locale".
 *
 * The app has NO hardcoded coordinates: on IP-geolocation failure it calls
 * `CountryLatLngProvider.getLatLngFromDeviceLocale(context)` and uses that country's centroid,
 * accepting it only when `lat != 0.0 && lng != 0.0`. An earlier build of this SDK shipped
 * Bengaluru as a hardcoded default, so every unplaceable guest — anywhere on earth — was seeded
 * with Karnataka and got Karnataka's advice.
 *
 * Endpoint #12 (home feed) is gated on the backend having resolved a location, and it resolves
 * one ONLY from coordinates — a country name alone is rejected (verified live 2026-09-01) —
 * which is why coordinates are needed at all.
 */
export const COORDINATE_UNSET = 0;

/**
 * The coordinates to use when neither guest init nor GPS resolved a location.
 *
 * Order: the host's explicit config override, then the DEVICE LOCALE's country centroid — the
 * app's own fallback (`CountryLatLngProvider.getLatLngFromDeviceLocale`). Returns `[0, 0]` when
 * neither is available, which callers MUST treat as "no location" via {@link isResolved} instead
 * of sending it: (0, 0) is a real point in the Gulf of Guinea, so sending it is a wrong answer,
 * not a missing one.
 *
 * There is deliberately NO hardcoded city here.
 */
export function resolveFallbackCoordinates(
  config: Pick<ResolvedFarmerChatConfig, 'defaultLatitude' | 'defaultLongitude'>,
): [number, number] {
  if (isResolved(config.defaultLatitude, config.defaultLongitude)) {
    return [config.defaultLatitude, config.defaultLongitude];
  }
  const { lat, lng } = fromDeviceLocale();
  return [lat, lng];
}

/**
 * The app's country fallback chain for the endpoint #2 `country_code` param:
 * server `country_code` → persisted → host config (when non-blank) → device-locale region →
 * {@link LAST_RESORT_COUNTRY_CODE}.
 *
 * Never returns blank: endpoint #2 400s on a blank value.
 */
export function resolveCountryCode(
  config: Pick<ResolvedFarmerChatConfig, 'defaultCountryCode'>,
  persisted?: string | null,
  serverCode?: string | null,
): string {
  return (
    serverCode?.trim() ||
    persisted?.trim() ||
    config.defaultCountryCode.trim() ||
    fromDeviceLocale().countryCode.trim() ||
    LAST_RESORT_COUNTRY_CODE
  );
}
