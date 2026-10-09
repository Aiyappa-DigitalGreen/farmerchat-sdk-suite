/**
 * Internal "the SDK wants to close" signal (not public API).
 *
 * CHAT_ONLY's chat close (and `openScreen` hand-backs) fire the host's `onExit`. The SDK's own
 * wrappers that present the journey (FarmerChatFab's modal) must close on it too, whether or not
 * the host wired `onExit`. Module-level so it survives a re-`initialize()`.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function emitSdkExit(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // a wrapper's error never breaks the SDK
    }
  });
}

export function onSdkExit(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
