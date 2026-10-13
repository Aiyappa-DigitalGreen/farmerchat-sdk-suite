/**
 * FarmerChat — static public API (docs/03 §Shared public surface):
 * initialize / shutdown / openChat / logout / clearAllData / isAuthenticated /
 * addAuthStateListener (onAuthStateChanged) / setAnalyticsListener. The UI is mounted via
 * <FarmerChatProvider> + <FarmerChatView/>.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveConfig, type FarmerChatConfig } from './core/config';
import { FarmerChatSdk, type FarmerChatScreen } from './core/sdk';
import type { AuthStateListener } from './core/sessionManager';
import { STORAGE_PREFIX } from './core/sessionStore';

let instance: FarmerChatSdk | null = null;

/**
 * Host auth listeners live HERE, not on the instance, so they survive a re-initialize that
 * rebuilds it and a shutdown (android `FarmerChat.authListeners` parity). Each instance gets one
 * bridge listener that fans out to this set.
 */
const authListeners = new Set<AuthStateListener>();
let unbindAuthBridge: (() => void) | null = null;

/**
 * The last host `accessToken` applied to the current instance (from its build config or a later
 * equivalent re-initialize), so an identical repeat initialize does not re-push it.
 */
let appliedHostAccessToken: string | null = null;

function bindAuthBridge(sdk: FarmerChatSdk): void {
  unbindAuthBridge = sdk.session.addAuthStateListener((authenticated) => {
    for (const listener of Array.from(authListeners)) {
      try {
        listener(authenticated);
      } catch {
        // listener errors never break the SDK
      }
    }
  });
}

/** Release everything the current instance owns. Best effort, never throws. */
function teardown(): void {
  try {
    unbindAuthBridge?.();
  } catch {
    // best effort
  }
  unbindAuthBridge = null;
  instance?.dispose();
  instance = null;
}

function requireInstance(): FarmerChatSdk {
  if (!instance) {
    throw new Error(
      '[FarmerChat] Not initialized. Call FarmerChat.initialize(config) first.',
    );
  }
  return instance;
}

export const FarmerChat = {
  /**
   * Initialize the SDK. Must be called before rendering <FarmerChatView/>.
   *
   * Android `FarmerChat.initialize` parity: re-initializing with the same environment, mode,
   * showDrawer, showHistory and showSettings (resolved values) is a no-op and the first config
   * wins for every other field. Any of those differing tears the old instance down and builds a
   * new one, so one host can offer a full-journey and a CHAT_ONLY entry by re-initializing
   * before each mount. Call it only while no SDK screen is mounted. Auth listeners carry over.
   */
  initialize(config: FarmerChatConfig): void {
    if (instance) {
      const a = instance.config;
      const b = resolveConfig(config);
      if (
        a.environment === b.environment &&
        a.mode === b.mode &&
        a.showDrawer === b.showDrawer &&
        a.showHistory === b.showHistory &&
        a.showSettings === b.showSettings
      ) {
        // Before the no-op rule every initialize rebuilt, so a HOST_TOKEN host passing a fresh
        // token in a new config got it applied. Keep that: push a changed token through the
        // updateTokens path (after hydration, so the stored value cannot overwrite it).
        const token = b.accessToken;
        if (token && token !== appliedHostAccessToken) {
          appliedHostAccessToken = token;
          const sdk = instance;
          void sdk.ready().then(() => {
            sdk.session.updateTokens(token, b.refreshToken ?? undefined);
          });
        }
        return;
      }
      teardown();
    }
    const sdk = new FarmerChatSdk(config);
    instance = sdk;
    appliedHostAccessToken = sdk.config.accessToken;
    bindAuthBridge(sdk);
    void sdk.ready();
  },

  /**
   * Tear the SDK down: `isInitialized` becomes false and the instance's listeners/subscriptions
   * are released. Persisted data and host auth listeners are KEPT (they re-bind on the next
   * initialize). Idempotent; safe before initialize. Unmounting SDK views is the host's job.
   */
  shutdown(): void {
    teardown();
  },

  /** True once initialize() has been called. */
  get isInitialized(): boolean {
    return instance !== null;
  },

  /** @internal — used by FarmerChatProvider. */
  getInstance(): FarmerChatSdk {
    return requireInstance();
  },

  /**
   * Deep-link style entry: queue a chat target consumed on the next
   * routeFromSplash / by a mounted FarmerChatView.
   */
  openChat(question?: string, conversationId?: string): void {
    const sdk = requireInstance();
    if (conversationId) {
      sdk.setPendingTarget({ kind: 'chat', chatId: conversationId });
    } else if (question) {
      sdk.setPendingTarget({ kind: 'chatQuery', question, source: 'deeplink' });
    } else {
      sdk.setPendingTarget({ kind: 'home' });
    }
    notifyOpenChatListeners();
  },

  /**
   * Programmatic: send a text question (C4). Opens the chat with the question,
   * as if the user typed it. Queues a pending target consumed by a mounted view.
   */
  sendQuestion(text: string): void {
    const sdk = requireInstance();
    sdk.setPendingTarget({ kind: 'chatQuery', question: text, source: 'programmatic' });
    notifyOpenChatListeners();
  },

  /** Programmatic: open an existing conversation by id (C4). */
  openConversation(conversationId: string): void {
    const sdk = requireInstance();
    sdk.setPendingTarget({ kind: 'chat', chatId: conversationId });
    notifyOpenChatListeners();
  },

  /** Programmatic: navigate to a top-level SDK screen (C4). */
  openScreen(destination: FarmerChatScreen): void {
    const sdk = requireInstance();
    sdk.setPendingTarget({ kind: 'screen', destination });
    notifyOpenChatListeners();
  },

  /** Full logout: endpoint #23 + clear prefs (preserve appearance) + identity reset. */
  async logout(): Promise<void> {
    await requireInstance().session.logout();
  },

  /**
   * Push a freshly-refreshed token into the active session (HOST_TOKEN mode).
   * Call after the host refreshes its own auth so subsequent SDK requests use
   * the new token — no re-configure needed. `refreshToken` omitted preserves the
   * stored one.
   */
  updateTokens(accessToken: string, refreshToken?: string): void {
    requireInstance().session.updateTokens(accessToken, refreshToken);
  },

  /** True once OTP has been verified (`OTP_VERIFIED`). */
  isAuthenticated(): boolean {
    return requireInstance().session.isAuthenticated;
  },

  /**
   * Local-only privacy wipe ("delete my data"): removes EVERY `fc_sdk_` AsyncStorage key,
   * appearance and tokens included, and nothing outside the namespace. No network call (docs/02
   * has no delete-user endpoint). Afterwards auth state is false and auth listeners are
   * notified; the SDK stays initialized. Before initialize it just wipes storage.
   */
  async clearAllData(): Promise<void> {
    const sdk = instance;
    if (!sdk) {
      try {
        const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(STORAGE_PREFIX));
        if (keys.length > 0) await AsyncStorage.multiRemove(keys);
      } catch {
        // storage failures are non-fatal
      }
      return;
    }
    // Let hydration finish first, or a late multiGet would refill the cache after the wipe.
    await sdk.ready().catch(() => undefined);
    await sdk.session.clearAllData();
  },

  /**
   * Auth-state observer; returns an unsubscribe function. The listener is held statically, so
   * it survives a re-initialize that rebuilds the SDK and a shutdown.
   */
  addAuthStateListener(listener: AuthStateListener): () => void {
    requireInstance();
    authListeners.add(listener);
    return () => {
      authListeners.delete(listener);
    };
  },

  /** Naming-parity alias of {@link addAuthStateListener} (android/iOS `onAuthStateChanged`). */
  onAuthStateChanged(listener: AuthStateListener): () => void {
    return FarmerChat.addAuthStateListener(listener);
  },

  /** Replace the analytics fan-out listener after init. */
  setAnalyticsListener(
    listener: ((name: string, props: Record<string, unknown>) => void) | null,
  ): void {
    requireInstance().analytics.setListener(listener);
  },
};

// Internal: FarmerChatView subscribes to react to openChat while mounted.
const openChatListeners = new Set<() => void>();

function notifyOpenChatListeners(): void {
  openChatListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // never let a listener break a programmatic navigation
    }
  });
}

/** @internal */
export function addOpenChatListener(listener: () => void): () => void {
  openChatListeners.add(listener);
  return () => {
    openChatListeners.delete(listener);
  };
}
