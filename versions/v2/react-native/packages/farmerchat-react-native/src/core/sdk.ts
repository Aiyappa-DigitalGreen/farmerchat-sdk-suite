/**
 * FarmerChatSdk — composition root wiring config → store → http → api →
 * session/labels/analytics. One instance per `FarmerChat.initialize()`.
 */
import { AgenticChatDataSource } from './agenticStream';
import { FarmerChatApi } from './api';
import { AnalyticsManager } from './analytics';
import {
  resolveConfig,
  type FarmerChatConfig,
  type ResolvedFarmerChatConfig,
} from './config';
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
