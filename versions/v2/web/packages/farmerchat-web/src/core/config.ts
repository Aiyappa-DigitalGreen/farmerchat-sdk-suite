/**
 * FarmerChat SDK configuration.
 * See docs/03-sdk-architecture.md — "Shared public surface" and
 * docs/07-customization-and-distribution.md (theming + feature contract C1–C5).
 */

import type { ReactNode } from 'react';

export type FarmerChatEnvironment = 'dev' | 'stage' | 'demo' | 'prod' | 'eks';

export type AppearanceMode = 'day' | 'night' | 'auto';

/** Exact per-environment base URLs (docs/02-api-reference.md). */
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

export const GEOLOCATE_URL = 'https://www.googleapis.com/geolocation/v1/geolocate';

/**
 * Bundled FarmerChat `API-Key` (guest initialisation `api/user/initialize_user/` and the
 * guest-token fallback `api/user/send_tokens/`), used when the host passes no
 * `farmerChatApiKey` (unset or blank). Same value as Android
 * `ApiConstants.DEFAULT_FARMERCHAT_API_KEY`. Hosts are not asked to supply one.
 */
export const DEFAULT_FARMERCHAT_API_KEY = 'Y2K3kW5R9uQ0fL2X8zI7hT3aJ7';

/**
 * Bundled Google Geolocation key (language/location auto-detect fallback), used when the host
 * passes no `geoApiKey` (unset or blank). Same value as Android `ApiConstants.DEFAULT_GEO_API_KEY`.
 * Not a secret: it ships in the bundle; restrict it to the Geolocation API on the Google side.
 */
export const DEFAULT_GEO_API_KEY = 'AIzaSyBr13y53dIh6Pf6G0R6y_870o_x9d-jCSo';

/**
 * Sentinel meaning "no country configured — derive it from the device locale".
 *
 * The app has NO hardcoded country: it derives one from the device locale
 * (`utils/CountryLatLngProvider.kt`). An earlier build of this SDK shipped `'IN'`, so every guest
 * the backend could not place — anywhere on earth — was told about India.
 */
export const DEFAULT_COUNTRY_CODE = '';

/**
 * Absolute floor for the endpoint #2 `country_code` param, used only when neither the backend,
 * the store, the host config nor the device locale produced one.
 *
 * Endpoint #2 rejects a blank `country_code` with HTTP 400 (`{"error": "Country code is
 * required"}`, verified live 2026-09-03 on prod), so a floor has to exist. `'KE'` is the app's own
 * literal on its primary guest-init path, and dev/stage/prod/eks all return Kenya only (verified
 * live 2026-09-03).
 *
 * This is a floor, not a default — the normal answer comes from the device locale.
 */
export const LAST_RESORT_COUNTRY_CODE = 'KE';

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
 * `CountryLatLngProvider.getLatLngFromDeviceLocale(context)`, takes that country's centroid and
 * accepts it ONLY when `lat != 0.0 && lng != 0.0`. (0, 0) is a real point in the Gulf of Guinea,
 * so it is a wrong answer, not a missing one — see `core/countryLatLng.ts`.
 */
export const COORDINATE_UNSET = 0;

/** @see COORDINATE_UNSET — "unset, derive from the device locale", not a place. */
export const DEFAULT_LATITUDE = COORDINATE_UNSET;
export const DEFAULT_LONGITUDE = COORDINATE_UNSET;

export type FarmerChatEventListener = (name: string, props: Record<string, unknown>) => void;

// ---------------------------------------------------------------------------
// Theming (docs/07 Part B) — cross-platform shape, web-idiomatic types.
// ---------------------------------------------------------------------------

/** Host palette. Each optional; omitted values fall back to the FarmerChat green brand. */
export interface FarmerChatThemeColors {
  /** App bars, primary brand surfaces (default Green700 #008236). */
  brandPrimary?: string;
  /** Primary buttons, input tiles (default Green800 #08361B). */
  brandPrimaryDark?: string;
  /** Chevrons, active radio dot, spinner (default Green500 #00C950). */
  brandAccent?: string;
  /** Content/text on brand surfaces (default white). */
  onBrand?: string;
  /** Screen background. */
  background?: string;
  /** Chat reading background. */
  readingSurface?: string;
  /** Card/list background. */
  cardSurface?: string;
  /** Error accents. */
  error?: string;
  /** Text on background. */
  onBackground?: string;
  /** Text on surface. */
  onSurface?: string;
}

export interface FarmerChatThemeShape {
  cardCornerRadius?: number;
  buttonCornerRadius?: number;
  inputCornerRadius?: number;
}

export interface FarmerChatThemeTypography {
  /** CSS font-family string applied to the SDK root. */
  fontFamily?: string;
  /** Multiplier on the base text size (default 1.0). */
  typeScale?: number;
}

export interface FarmerChatTheme {
  /** Light palette (also used for dark unless `dark` is supplied). */
  colors?: FarmerChatThemeColors;
  /** Optional dark palette. When omitted the light palette is reused for both modes. */
  dark?: FarmerChatThemeColors;
  shape?: FarmerChatThemeShape;
  typography?: FarmerChatThemeTypography;
  /** Override for the built-in 6-petal mark: an image URL, or any React node. */
  logo?: string | ReactNode;
}

// ---------------------------------------------------------------------------
// Feature scope (docs/07 Part C)
// ---------------------------------------------------------------------------

/** C2 — host identity injection. */
export type AuthMode = 'SDK_OTP' | 'HOST_TOKEN';

/** C3 — journey scope. */
export type FarmerChatMode = 'FULL_JOURNEY' | 'CHAT_ONLY';

/** A host-supplied token: either a bare access token, or an access/refresh pair. */
export type HostToken = string | { accessToken: string; refreshToken?: string };

/** C2 — callback that supplies (and refreshes) the host token. May be async. */
export type TokenProvider = () => HostToken | null | Promise<HostToken | null>;

/** C4 — semantic host callbacks (in addition to the raw `onEvent` fan-out). */
export interface FarmerChatCallbacks {
  onChatOpened?: () => void;
  onMessageSent?: (text: string) => void;
  onAnswerReceived?: (messageId: string) => void;
  onScreenView?: (name: string) => void;
  onError?: (code: number | undefined, message: string) => void;
  onSessionStart?: () => void;
  /**
   * Fired when the user closes the SDK from a surface with nowhere to go back to
   * (e.g. CHAT_ONLY chat close). The host should unmount / hide the SDK.
   */
  onExit?: () => void;
}

export interface FarmerChatConfig extends FarmerChatCallbacks {
  environment: FarmerChatEnvironment;
  /**
   * Optional custom base URL. When set (non-empty) it OVERRIDES the `environment`
   * base URL — point the SDK at your own backend, or a local mock. Should end with `/`.
   */
  customBaseUrl?: string;
  /**
   * Web only. Where the SDK's bundled illustrations are served from — the `illustrations/` folder
   * shipped in `dist/` (Android bundles them as APK assets). Must end with `/`. When unset the
   * full-screen messages (sign up, errors, location) render without the farmer picture. The
   * widget's script-tag build defaults it to its own folder.
   */
  assetBaseUrl?: string;
  /**
   * OPTIONAL. Google Geolocation API key (language/location auto-detect fallback). The SDK ships
   * a built-in key (`DEFAULT_GEO_API_KEY`), used when this is unset or blank; pass one only to
   * override it.
   */
  geoApiKey?: string;
  /**
   * OPTIONAL. FarmerChat `API-Key` for guest initialisation and the guest-token fallback. The SDK
   * ships a built-in key (`DEFAULT_FARMERCHAT_API_KEY`), used when this is unset or blank; hosts
   * do not need to supply one.
   */
  farmerChatApiKey?: string;
  appearance?: AppearanceMode;
  /** Preselect a language; skips the language screen when the code is valid. */
  languageCode?: string;
  /**
   * OPTIONAL override for the endpoint #2 `country_code` when `initialize_user` returns a
   * null/blank one (the normal case for a fresh guest on an IP the backend cannot resolve).
   *
   * **Leave this unset (the default) and the SDK derives the country from the device locale**,
   * exactly as the app does. Endpoint #2 rejects a blank `country_code` with HTTP 400, so if the
   * browser locale carries no region either, {@link LAST_RESORT_COUNTRY_CODE} is sent.
   *
   * Set it only to pin the SDK to one region regardless of where the browser is.
   * @default '' (unset — derive from the device locale)
   */
  defaultCountryCode?: string;
  /**
   * OPTIONAL `state` query param for endpoint #2. Empty by default and safe to leave empty:
   * the parameter is inert on every environment (verified live 2026-09-03).
   * @default '' (omit)
   */
  defaultStateCode?: string;
  /**
   * OPTIONAL override for the coordinates posted to endpoint #11 when nothing else resolved a
   * location. **Leave these at {@link COORDINATE_UNSET} (the default) and the SDK uses the device
   * locale's country centroid**, exactly as the app does on IP-geolocation failure.
   *
   * Endpoint #12 (home feed) is gated on the backend having a resolved location, and it resolves
   * one ONLY from coordinates — a country name alone is rejected (verified live 2026-09-01).
   *
   * If both these and the device locale are unset, NO coordinates are sent — a guess would put
   * the farmer's advice in the wrong place. Set them to pin a region deliberately.
   * @default 0 (unset — derive from the device locale)
   */
  defaultLatitude?: number;
  defaultLongitude?: number;
  enableVoice?: boolean;
  enableImages?: boolean;
  enableWeather?: boolean;
  /**
   * Opt into agentic (streaming) chat — **SDK 2.0.0**, endpoint #27a.
   *
   * `false` (the default) keeps the 1.0.0 synchronous chat contract (#27) unchanged, so a host
   * that does nothing sees no behaviour change. When true, text queries stream: the answer
   * accretes from `text_delta` events and tool progress is surfaced as it happens.
   *
   * Note the wire framing is not yet confirmed against a real stream
   * (docs/05-open-questions.md), so treat this as preview until it is.
   * @default false
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

  // --- FAB customization (config-level defaults; per-instance props win) ---
  /** FAB default label; omitted → round icon-only FAB. */
  fabLabel?: string;
  /** FAB default background (CSS color); omitted → theme brand. */
  fabBackgroundColor?: string;
  /** FAB default icon/label color (CSS color); omitted → on-brand. */
  fabContentColor?: string;

  // --- Chat UI customization (omitted → current theme behavior) ---
  /** User message bubble background (CSS color). */
  userBubbleColor?: string;
  /** User message bubble text color (CSS color). */
  userBubbleTextColor?: string;
  /** AI message body text color (CSS color). */
  aiBubbleTextColor?: string;
  /** Message bubble corner radius (px). */
  bubbleCornerRadius?: number;
  /** Chat message body font size (px). */
  messageFontSize?: number;

  // --- Theming (docs/07 Part B) ---
  theme?: FarmerChatTheme;

  // --- C2 host identity injection ---
  /** `SDK_OTP` (default) runs the built-in phone/OTP flow; `HOST_TOKEN` trusts host tokens. */
  authMode?: AuthMode;
  /** HOST_TOKEN: initial access token. */
  accessToken?: string;
  /** HOST_TOKEN: optional refresh token. */
  refreshToken?: string;
  /** HOST_TOKEN: called to (re)supply a token, incl. on 401. */
  tokenProvider?: TokenProvider;

  // --- C3 screen/feature toggles ---
  /**
   * `CHAT_ONLY` (default since 2026-10-09: skip onboarding/home and land in chat, bootstrapping a
   * guest session headlessly) or `FULL_JOURNEY` (onboarding, Home, drawer, settings).
   */
  mode?: FarmerChatMode;
  showSettings?: boolean;
  /**
   * History ("past advice") button in the chat app bar / drawer entry. Unset by default, which
   * resolves to `mode === 'FULL_JOURNEY'`: CHAT_ONLY users are fresh guests with no history, so the
   * chat bar shows only the language button. An explicit host value wins.
   */
  showHistory?: boolean;
  /**
   * Navigation drawer. Unset by default, which resolves to `mode === 'FULL_JOURNEY'`: so
   * CHAT_ONLY has no drawer and the chat app bar shows the language button (and history, when
   * `showHistory` is on) instead.
   * An explicit host value wins.
   */
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
  enableSsfr?: boolean;

  // --- C5 host string overrides + forced locale ---
  /** Highest-precedence label overrides, keyed by label base key. */
  stringOverrides?: Record<string, string>;
  /** Force a language code regardless of device/onboarding. */
  locale?: string;

  /** Analytics fan-out — same event names/props as the production app. */
  onEvent?: FarmerChatEventListener;
  /** Called when the session cannot be recovered (refresh + guest/host token all failed). */
  onSessionExpired?: () => void;
}

export interface ResolvedConfig {
  environment: FarmerChatEnvironment;
  baseUrl: string;
  assetBaseUrl: string;
  geoApiKey: string;
  farmerChatApiKey: string;
  appearance: AppearanceMode;
  languageCode?: string;
  defaultCountryCode: string;
  defaultStateCode: string;
  defaultLatitude: number;
  defaultLongitude: number;
  enableVoice: boolean;
  enableImages: boolean;
  enableWeather: boolean;
  enableAgenticChat: boolean;
  /**
   * Resolved composer decision: the host's `enableComposerUi` when set, else
   * `enableAgenticChat` (the historical collapse). Screens read THIS, never the raw option.
   */
  composerUi: boolean;
  theme?: FarmerChatTheme;
  authMode: AuthMode;
  accessToken?: string;
  refreshToken?: string;
  tokenProvider?: TokenProvider;
  mode: FarmerChatMode;
  showSettings: boolean;
  showHistory: boolean;
  showDrawer: boolean;
  showNameScreen: boolean;
  enableAnalytics: boolean;
  enableSsfr: boolean;
  userBubbleColor?: string;
  userBubbleTextColor?: string;
  aiBubbleTextColor?: string;
  bubbleCornerRadius?: number;
  messageFontSize?: number;
  stringOverrides?: Record<string, string>;
  locale?: string;
  callbacks: FarmerChatCallbacks;
  onEvent?: FarmerChatEventListener;
  onSessionExpired?: () => void;
}

export function resolveConfig(config: FarmerChatConfig): ResolvedConfig {
  const envBaseUrl = BASE_URLS[config.environment];
  if (!envBaseUrl) {
    throw new Error(`[FarmerChat] Unknown environment "${config.environment}"`);
  }
  // A custom base URL (when non-empty) overrides the environment base URL.
  const baseUrl =
    config.customBaseUrl && config.customBaseUrl.length > 0
      ? config.customBaseUrl
      : envBaseUrl;
  const mode: FarmerChatMode = config.mode ?? 'CHAT_ONLY';
  return {
    environment: config.environment,
    baseUrl,
    assetBaseUrl: config.assetBaseUrl ?? '',
    // Unset or blank ⇒ the bundled keys (parity with Android ApiConstants defaults).
    geoApiKey: config.geoApiKey?.trim() || DEFAULT_GEO_API_KEY,
    farmerChatApiKey: config.farmerChatApiKey?.trim() || DEFAULT_FARMERCHAT_API_KEY,
    appearance: config.appearance ?? 'auto',
    languageCode: config.languageCode,
    // All four default to "unset" — resolved from the device locale at use time, the way the app
    // does it (see core/fallbackLocation.ts). A host that sets one explicitly still wins.
    defaultCountryCode: config.defaultCountryCode?.trim() || DEFAULT_COUNTRY_CODE,
    defaultStateCode: config.defaultStateCode?.trim() || DEFAULT_STATE_CODE,
    defaultLatitude: config.defaultLatitude ?? DEFAULT_LATITUDE,
    defaultLongitude: config.defaultLongitude ?? DEFAULT_LONGITUDE,
    enableVoice: config.enableVoice ?? true,
    enableImages: config.enableImages ?? true,
    enableWeather: config.enableWeather ?? true,
    // 2.0.0 streaming chat is opt-in: default false keeps v1 behaviour.
    enableAgenticChat: config.enableAgenticChat ?? false,
    // `enableComposerUi` omitted ⇒ follow enableAgenticChat, preserving today's behaviour.
    composerUi: config.enableComposerUi ?? config.enableAgenticChat ?? false,
    theme: config.theme,
    authMode: config.authMode ?? 'SDK_OTP',
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
    tokenProvider: config.tokenProvider,
    mode,
    showSettings: config.showSettings ?? true,
    showHistory: config.showHistory ?? mode === 'FULL_JOURNEY',
    // Unset ⇒ follows the mode: drawer in FULL_JOURNEY only. An explicit host value wins.
    showDrawer: config.showDrawer ?? mode === 'FULL_JOURNEY',
    showNameScreen: config.showNameScreen ?? true,
    enableAnalytics: config.enableAnalytics ?? false,
    enableSsfr: config.enableSsfr ?? true,
    userBubbleColor: config.userBubbleColor,
    userBubbleTextColor: config.userBubbleTextColor,
    aiBubbleTextColor: config.aiBubbleTextColor,
    bubbleCornerRadius: config.bubbleCornerRadius,
    messageFontSize: config.messageFontSize,
    stringOverrides: config.stringOverrides,
    locale: config.locale,
    callbacks: {
      onChatOpened: config.onChatOpened,
      onMessageSent: config.onMessageSent,
      onAnswerReceived: config.onAnswerReceived,
      onScreenView: config.onScreenView,
      onError: config.onError,
      onSessionStart: config.onSessionStart,
      // Without this the CHAT_ONLY close button fired into nothing and the host never closed.
      onExit: config.onExit,
    },
    onEvent: config.onEvent,
    onSessionExpired: config.onSessionExpired,
  };
}
