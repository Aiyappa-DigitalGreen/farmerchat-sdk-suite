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
  stage: 'https://farmerchat.farmstack.co/mobile-app-stage/',
  demo: 'https://farmerchat.farmstack.co/mobile-app-demo/',
  prod: 'https://v2.api.farmer.chat/',
  eks: 'https://api.farmerchat.in/',
};

export const GEOLOCATE_URL = 'https://www.googleapis.com/geolocation/v1/geolocate';

/**
 * Built-in guest-init API key. Ships blank on web (the key is provisioned per
 * host); pass `guestApiKey` in the config to authenticate guest initialisation
 * (`api/user/initialize_user/`) and the guest-token fallback (`api/user/send_tokens/`).
 */
export const DEFAULT_GUEST_API_KEY = '';

/**
 * Fallback country for endpoint #2 when `initialize_user` returns no `country_code`.
 * The endpoint 400s on a blank value, so a non-empty default is required.
 */
export const DEFAULT_COUNTRY_CODE = 'IN';

/**
 * Fallback state/region paired with {@link DEFAULT_COUNTRY_CODE}.
 *
 * Endpoint #2 matches `state` on the **display name**, not the ISO code, and uses it only to rank
 * languages. Verified live 2026-09-01: `state=Karnataka` surfaces Kannada in `priority_view`,
 * while `state=KA` pushes it into `expanded_view` ("All languages").
 */
export const DEFAULT_STATE_CODE = 'Karnataka';

/** Coordinates for {@link DEFAULT_COUNTRY_CODE}/{@link DEFAULT_STATE_CODE} (Bengaluru). */
export const DEFAULT_LATITUDE = 12.9716;
export const DEFAULT_LONGITUDE = 77.5946;

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
  /** Google Geolocation API key (language auto-detect fallback). */
  geoApiKey?: string;
  /** Overrides the built-in guest init API key. */
  guestApiKey?: string;
  appearance?: AppearanceMode;
  /** Preselect a language; skips the language screen when the code is valid. */
  languageCode?: string;
  /**
   * Country code used for the language list when `initialize_user` returns a null/blank
   * `country_code` (the normal case for a fresh guest on an IP the backend cannot resolve).
   * Endpoint #2 rejects a blank `country_code` with HTTP 400, so this is never empty.
   * @default 'IN'
   */
  defaultCountryCode?: string;
  /**
   * State/region paired with {@link defaultCountryCode} for the endpoint #2 `state` param.
   * @default 'KA'
   */
  defaultStateCode?: string;
  /**
   * Coordinates for {@link defaultCountryCode}/{@link defaultStateCode} (Bengaluru, Karnataka).
   *
   * Endpoint #12 (home feed) is gated on the backend having a resolved location, and it resolves
   * one ONLY from coordinates — a country name alone is rejected (verified live 2026-09-01).
   * Seeding #11 with these keeps a guest's home screen populated instead of blank.
   */
  defaultLatitude?: number;
  defaultLongitude?: number;
  enableVoice?: boolean;
  enableImages?: boolean;
  enableWeather?: boolean;

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
  /** `FULL_JOURNEY` (default) or `CHAT_ONLY` (skip onboarding/home; land in chat). */
  mode?: FarmerChatMode;
  showSettings?: boolean;
  showHistory?: boolean;
  showDrawer?: boolean;
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
  geoApiKey: string;
  guestApiKey: string;
  appearance: AppearanceMode;
  languageCode?: string;
  defaultCountryCode: string;
  defaultStateCode: string;
  defaultLatitude: number;
  defaultLongitude: number;
  enableVoice: boolean;
  enableImages: boolean;
  enableWeather: boolean;
  theme?: FarmerChatTheme;
  authMode: AuthMode;
  accessToken?: string;
  refreshToken?: string;
  tokenProvider?: TokenProvider;
  mode: FarmerChatMode;
  showSettings: boolean;
  showHistory: boolean;
  showDrawer: boolean;
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
  return {
    environment: config.environment,
    baseUrl,
    geoApiKey: config.geoApiKey ?? '',
    guestApiKey: config.guestApiKey ?? DEFAULT_GUEST_API_KEY,
    appearance: config.appearance ?? 'auto',
    languageCode: config.languageCode,
    defaultCountryCode: config.defaultCountryCode?.trim() || DEFAULT_COUNTRY_CODE,
    defaultStateCode: config.defaultStateCode?.trim() || DEFAULT_STATE_CODE,
    defaultLatitude: config.defaultLatitude ?? DEFAULT_LATITUDE,
    defaultLongitude: config.defaultLongitude ?? DEFAULT_LONGITUDE,
    enableVoice: config.enableVoice ?? true,
    enableImages: config.enableImages ?? true,
    enableWeather: config.enableWeather ?? true,
    theme: config.theme,
    authMode: config.authMode ?? 'SDK_OTP',
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
    tokenProvider: config.tokenProvider,
    mode: config.mode ?? 'FULL_JOURNEY',
    showSettings: config.showSettings ?? true,
    showHistory: config.showHistory ?? true,
    showDrawer: config.showDrawer ?? true,
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
    },
    onEvent: config.onEvent,
    onSessionExpired: config.onSessionExpired,
  };
}
