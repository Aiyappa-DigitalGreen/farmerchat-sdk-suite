/**
 * FarmerChatSdk — composition root wiring config → store → http → api →
 * session/labels/analytics. One instance per `FarmerChat.initialize()`.
 */
import { AgenticChatDataSource } from './agenticStream';
import { FarmerChatApi } from './api';
import { AnalyticsManager } from './analytics';
import {
  resolveConfig,
  resolveCountryCode,
  resolveFallbackCoordinates,
  type FarmerChatConfig,
  type ResolvedFarmerChatConfig,
} from './config';
import { isResolved } from './countryLatLng';
import { HttpClient } from './httpClient';
import { LabelManager } from './labelManager';
import { SessionManager } from './sessionManager';
import { SessionStore, StorageKeys } from './sessionStore';
import { resolveTheme } from '../ui/theme';

/** Programmatic destinations for `FarmerChat.openScreen` (C4). */
export type FarmerChatScreen =
  | 'home'
  | 'chat'
  | 'history'
  | 'settings'
  | 'language'
  | 'help'
  /**
   * 2.0.0: lands on Home and opens the in-app Terms-of-Use dialog (`TermsOfUseDialog`), the
   * SDK's stand-in for the app's Plotline `open_terms_of_use=true` card CTA. Android exposes
   * the same key from `FarmerChatRoot` (`SCREEN_TERMS_OF_USE = "termsofuse"`); the SDK carries
   * no Plotline (root CLAUDE.md §6), so the host raises the request through this existing
   * public entry point rather than a new API.
   */
  | 'termsofuse';

/** Deep-link style pending navigation target (AppNavigator.PendingTarget). */
export type PendingTarget =
  | { kind: 'chat'; chatId: string }
  | { kind: 'chatQuery'; question: string; source: string; channel?: string | null }
  | { kind: 'gps'; action: string }
  | { kind: 'screen'; destination: FarmerChatScreen }
  | { kind: 'home' };

export class FarmerChatSdk {
  readonly config: ResolvedFarmerChatConfig;
  readonly store: SessionStore;
  readonly labels: LabelManager;
  readonly analytics: AnalyticsManager;
  readonly http: HttpClient;
  readonly api: FarmerChatApi;
  readonly session: SessionManager;
  /**
   * Agentic streaming source (#27a). Constructed on every 2.0.0 instance — it is free;
   * {@link ResolvedFarmerChatConfig.enableAgenticChat} decides whether `useChat` streams from it
   * or takes the synchronous #27 path.
   */
  readonly agentic: AgenticChatDataSource;

  private pendingTarget: PendingTarget | null = null;
  private hydratePromise: Promise<void> | null = null;

  constructor(config: FarmerChatConfig) {
    this.config = resolveConfig(config);
    // Host theme overlays the design tokens before any screen renders (docs/07 Part B).
    resolveTheme(this.config.theme);
    this.store = new SessionStore();
    this.labels = new LabelManager(this.store, {
      overrides: this.config.stringOverrides,
      forcedLocale: this.config.locale,
    });
    this.analytics = new AnalyticsManager(this.config.onEvent, this.config.callbacks, this.config.enableAnalytics);
    this.http = new HttpClient(
      this.config,
      this.store,
      () => {
        this.config.onSessionExpired?.();
      },
      (code, message) => {
        this.analytics.fireCallback('onError', code, message);
      },
      // docs/02 Step 3 guest replaced. `session` is created below; this only runs on a 401,
      // long after construction.
      () => this.session.notifyGuestReplaced(),
    );
    this.api = new FarmerChatApi(this.http, this.config);
    this.session = new SessionManager(this.api, this.store, this.analytics, this.config);
    this.agentic = new AgenticChatDataSource(
      this.config,
      this.store,
      this.http.authenticator,
    );
  }

  /** Hydrate persisted state; idempotent. Called by the provider before splash. */
  ready(): Promise<void> {
    if (!this.hydratePromise) {
      this.hydratePromise = this.store.hydrate().then(async () => {
        // Env-scoped cache invalidation: a conversation id is only valid on the
        // backend that created it — drop it if the base URL changed since last init.
        const currentBase = this.config.baseUrl;
        const lastBase = this.store.getString(StorageKeys.LAST_BASE_URL);
        // FarmerChatGraph.kt parity: everything stored belongs to the backend that issued it — on a
        // base-URL change wipe it (keeping appearance), or the foreign token 401s and the guest
        // fallback 400s on the foreign user_id, leaving the SDK unable to recover.
        if (lastBase && lastBase !== currentBase) {
          await this.store.clearAllPreservingAppearance();
        }
        this.store.set(StorageKeys.LAST_BASE_URL, currentBase);

        this.labels.restoreFromStore();
        this.applyConfigDefaults();
        // HOST_TOKEN mode (C2): seed host-supplied tokens before splash routing.
        await this.session.initHostToken();
      });
    }
    return this.hydratePromise;
  }

  // --- CHAT_ONLY headless bootstrap (FarmerChatGraph.ensureChatOnlySession parity) -----------

  /** Set once endpoint #2 404s: this backend has no language list, so stop asking every open. */
  private labelBootstrapUnavailable = false;

  /**
   * CHAT_ONLY skips Home (and, after the first launch or when the host configured a language, the
   * language screen), which are where the guest session, the UI labels and the conversation are
   * normally established. NOT called before a first-launch CHAT_ONLY language screen
   * ({@link chatOnlyNeedsLanguageScreen}) — that screen does guest init, labels and the preferred
   * language itself, and the chat creates its conversation lazily. Port of Android's `FarmerChatGraph.ensureChatOnlySession`:
   *
   *  1. guest init (#1) with coordinates resolved FIRST — geolocate, then the device-locale
   *     centroid, then nothing — exactly as onboarding does;
   *  2. labels (#2 → #3, + #5 set_preferred_language) for the stored / host / `en` language,
   *     because the language screen is the only other caller of `get_labels`;
   *  3. `new_conversation` (#15) when no conversation id is stored.
   *
   * Every step is best-effort and idempotent: a failure leaves the chat to retry lazily
   * (`useChat.ensureConversationId`) and labels to fall back to English.
   */
  async ensureChatOnlySession(): Promise<void> {
    if (!this.session.hasSession) {
      let lat: number | null = null;
      let lng: number | null = null;
      let accuracy: number | null = null;
      try {
        const geo = await this.api.geolocate();
        if (geo.ok) {
          lat = geo.data.location.lat;
          lng = geo.data.location.lng;
          accuracy = geo.data.accuracy ?? null;
          this.store.set(StorageKeys.FARMER_APP_LATITUDE, lat);
          this.store.set(StorageKeys.FARMER_APP_LONGITUDE, lng);
        }
      } catch {
        // best-effort
      }
      if (lat === null) {
        const [localeLat, localeLng] = resolveFallbackCoordinates(this.config);
        if (isResolved(localeLat, localeLng)) {
          lat = localeLat;
          lng = localeLng;
          accuracy = 0;
        }
      }
      try {
        await this.session.ensureGuestSession({ lat, long: lng, accuracy });
      } catch {
        // best-effort
      }
    }
    await this.ensureLabelsLoaded();
    if (!this.store.getString(StorageKeys.NEW_CONVERSATION_ID)) {
      const userId = this.session.userId?.trim();
      if (userId) {
        try {
          const res = await this.api.newConversation({ user_id: userId, content_provider_id: null });
          if (res.ok) this.store.set(StorageKeys.NEW_CONVERSATION_ID, res.data.conversation_id);
        } catch {
          // best-effort — useChat creates one lazily on the first send
        }
      }
    }
  }

  /**
   * A CHAT_ONLY journey opening fresh is the app's "Home entry", and the app starts a NEW
   * conversation on every Home entry. Port of Android `FarmerChatGraph.beginChatOnlyJourney`:
   * drop the stored conversation id unless the journey is opening a specific history thread
   * (pending `chat` target), which keeps its own id. Called once per journey start (Splash),
   * before {@link ensureChatOnlySession}, which then creates the new conversation.
   */
  beginChatOnlyJourney(): void {
    if (this.pendingTarget?.kind !== 'chat') {
      this.store.remove(StorageKeys.NEW_CONVERSATION_ID);
    }
  }

  /** FarmerChatGraph.ensureLabelsLoaded parity. */
  private async ensureLabelsLoaded(): Promise<void> {
    if (this.labels.isLoaded || this.labelBootstrapUnavailable) return;
    const code = (
      this.store.getString(StorageKeys.SELECTED_LANGUAGE_CODE)?.trim() ||
      this.config.locale ||
      this.config.languageCode ||
      'en'
    )
      .trim()
      .toLowerCase();
    if (!this.session.hasSession) {
      try {
        await this.session.ensureGuestSession();
      } catch {
        // best-effort
      }
    }
    try {
      const country = resolveCountryCode(
        this.config,
        this.store.getString(StorageKeys.USER_COUNTRY_CODE),
      );
      const state =
        this.store.getString(StorageKeys.USER_STATE)?.trim() || this.config.defaultStateCode;
      const groups = await this.api.getSupportedLanguages(country, state);
      if (!groups.ok) {
        // 404 = this backend has no such endpoint; offline/5xx may succeed next open.
        if (groups.code === 404) this.labelBootstrapUnavailable = true;
        return;
      }
      const all = groups.data.flatMap((g) => [...g.priority_view, ...g.expanded_view]);
      const match =
        all.find((l) => l.code.toLowerCase() === code) ??
        all.find((l) => l.code.toLowerCase() === 'en');
      if (!match) return;
      const labels = await this.api.getLabels(match.id);
      if (labels.ok) {
        this.labels.setLabels(labels.data);
        this.store.set(StorageKeys.SELECTED_LANGUAGE_ID, match.id);
        this.store.set(StorageKeys.SELECTED_LANGUAGE_CODE, match.code);
        if (match.display_name?.trim()) {
          this.store.set(StorageKeys.SELECTED_LANGUAGE_DISPLAY_NAME, match.display_name);
        }
      }
      const userId = this.session.userId?.trim();
      if (userId) {
        await this.api.setPreferredLanguage({ user_id: userId, language_id: match.id });
      }
    } catch {
      // best-effort — the chat renders English fallbacks
    }
  }

  private applyConfigDefaults(): void {
    // Host-provided appearance always wins at init.
    this.store.set(StorageKeys.APPEARANCE_MODE, this.config.appearance);
    // Preselected language code skips the language screen when set.
    if (
      this.config.languageCode &&
      this.store.getString(StorageKeys.SELECTED_LANGUAGE_CODE) === null
    ) {
      this.store.set(StorageKeys.SELECTED_LANGUAGE_CODE, this.config.languageCode);
    }
  }

  // --- pending deep-link targets (FarmerChat.openChat) ----------------------

  setPendingTarget(target: PendingTarget): void {
    this.pendingTarget = target;
  }

  consumePendingTarget(): PendingTarget | null {
    const t = this.pendingTarget;
    this.pendingTarget = null;
    return t;
  }

  peekPendingTarget(): PendingTarget | null {
    return this.pendingTarget;
  }

  // --- routeFromSplash inputs (docs/01 §AppNavigator) ------------------------

  get isLanguageSelected(): boolean {
    if (this.store.getBoolean(StorageKeys.LANGUAGE_DONE)) return true;
    // Host preselected a language code → skip the language screen.
    return (
      this.config.languageCode !== null &&
      this.store.getString(StorageKeys.SELECTED_LANGUAGE_CODE) !== null
    );
  }

  /**
   * True when the host configured the UI language itself (a non-blank `locale` or `languageCode`
   * — the values {@link ensureLabelsLoaded} already reads as the configured language).
   */
  get hostLanguageConfigured(): boolean {
    return Boolean(this.config.locale?.trim() || this.config.languageCode?.trim());
  }

  /**
   * CHAT_ONLY first launch: the language onboarding screen (docs/01 §3.2) shows once — when it
   * has never completed (`LANGUAGE_DONE` false) and the host configured no language. Later
   * launches, and hosts that pass `languageCode`/`locale`, go straight to chat.
   */
  get chatOnlyNeedsLanguageScreen(): boolean {
    return !this.store.getBoolean(StorageKeys.LANGUAGE_DONE) && !this.hostLanguageConfigured;
  }

  get isProfileDone(): boolean {
    return this.store.getBoolean(StorageKeys.KEY_NAME_DONE);
  }

  get hasSeenNameScreenOnce(): boolean {
    return this.store.getBoolean(StorageKeys.KEY_NAME_SCREEN_SEEN);
  }

  markProfileDone(): void {
    this.store.set(StorageKeys.KEY_NAME_DONE, true);
  }
}
