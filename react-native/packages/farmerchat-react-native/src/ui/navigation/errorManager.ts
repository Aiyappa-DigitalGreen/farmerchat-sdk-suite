/**
 * ErrorNavigationManager — port of core/navigation/ErrorNavigationManager
 * (docs/01 §2): central one-shot error navigation with an active-screen guard,
 * a pending-error flag (Splash checks it before auto-routing) and a retry
 * action invoked by the Error screen's Try again.
 */
export interface ErrorEvent {
  isNetworkError: boolean;
  fromScreen: string;
}

type ErrorListener = (event: ErrorEvent) => void;

export class ErrorNavigationManager {
  private activeScreen: string | null = null;
  private retryAction: (() => void) | null = null;
  private listeners = new Set<ErrorListener>();
  hasPendingError = false;

  setActiveScreen(screenId: string): void {
    this.activeScreen = screenId;
  }

  addListener(listener: ErrorListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Ignores errors raised from a screen that is no longer visible. */
  navigateToError(
    isNetworkError: boolean,
    fromScreen: string,
    retry?: (() => void) | null,
  ): void {
    if (this.activeScreen !== null && fromScreen !== '' && this.activeScreen !== fromScreen) {
      return;
    }
    this.retryAction = retry ?? null;
    this.hasPendingError = true;
    for (const l of Array.from(this.listeners)) {
      try {
        l({ isNetworkError, fromScreen });
      } catch {
        // never let a listener break error routing
      }
    }
  }

  retryLastAction(): void {
    this.hasPendingError = false;
    const action = this.retryAction;
    this.retryAction = null;
    action?.();
  }

  clearRetryAction(): void {
    this.retryAction = null;
    this.hasPendingError = false;
  }
}
