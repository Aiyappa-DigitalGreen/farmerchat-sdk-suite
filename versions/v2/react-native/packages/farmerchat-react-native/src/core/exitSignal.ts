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

/**
 * Whether the visible SDK screen draws its own exit (the CHAT_ONLY chat's ✕). Published by the
 * nav graph on every route change so a presenter (FarmerChatFab) can hide its fallback close
 * there and only there (iOS FarmerChatFabButton parity, `FCScreenHasOwnExitKey`).
 */
type OwnExitListener = (hasOwnExit: boolean) => void;
const ownExitListeners = new Set<OwnExitListener>();
let screenHasOwnExit = false;

export function setScreenHasOwnExit(value: boolean): void {
  if (value === screenHasOwnExit) return;
  screenHasOwnExit = value;
  ownExitListeners.forEach((fn) => {
    try {
      fn(value);
    } catch {
      // a wrapper's error never breaks the SDK
    }
  });
}

export function onScreenHasOwnExit(fn: OwnExitListener): () => void {
  ownExitListeners.add(fn);
  fn(screenHasOwnExit);
  return () => {
    ownExitListeners.delete(fn);
  };
}
