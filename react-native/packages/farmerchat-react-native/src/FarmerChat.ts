/**
 * FarmerChat — static public API (docs/03 §Shared public surface):
 * initialize / openChat / logout / isAuthenticated / addAuthStateListener /
 * setAnalyticsListener. The UI is mounted via <FarmerChatProvider> +
 * <FarmerChatView/>.
 */
import type { FarmerChatConfig } from './core/config';
import { FarmerChatSdk, type FarmerChatScreen } from './core/sdk';
import type { AuthStateListener } from './core/sessionManager';

let instance: FarmerChatSdk | null = null;

function requireInstance(): FarmerChatSdk {
  if (!instance) {
    throw new Error(
      '[FarmerChat] Not initialized. Call FarmerChat.initialize(config) first.',
    );
  }
  return instance;
}

export const FarmerChat = {
  /** Initialize the SDK. Must be called before rendering <FarmerChatView/>. */
  initialize(config: FarmerChatConfig): void {
    instance = new FarmerChatSdk(config);
    void instance.ready();
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

  /** True once OTP has been verified (`OTP_VERIFIED`). */
  isAuthenticated(): boolean {
    return requireInstance().session.isAuthenticated;
  },

  /** Auth-state observer; returns an unsubscribe function. */
  addAuthStateListener(listener: AuthStateListener): () => void {
    return requireInstance().session.addAuthStateListener(listener);
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
