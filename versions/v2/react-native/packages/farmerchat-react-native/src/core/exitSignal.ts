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

/**
 * Where a presenter's fallback ✕ may sit without covering the visible screen's own top-right
 * control. Home's top-right is the weather pill, so its ✕ moves to the free gap after the menu
 * button (web FarmerChatFab parity, scenario pass 2026-10-17). 'right' everywhere else.
 */
export type FallbackCloseSlot = 'right' | 'left' | 'hidden';
type SlotListener = (slot: FallbackCloseSlot) => void;
const slotListeners = new Set<SlotListener>();
let fallbackCloseSlot: FallbackCloseSlot = 'right';

/**
 * The slot for a visible route. With the drawer open the ✕ is hidden: in the left slot it sat on
 * the drawer's logo, and the drawer closes by scrim tap / Back (scenario E4, 2026-10-17).
 */
export function fallbackCloseSlotFor(
  route: string | null | undefined,
  drawerOpen = false,
): FallbackCloseSlot {
  if (drawerOpen) return 'hidden';
  // Screens whose top-right is their own control and which carry their own exit (back chip):
  // AccountBenefits' "Skip" (app AppNavGraph.kt:800-835).
  if (route === 'AccountBenefits') return 'hidden';
  return route === 'Home' ? 'left' : 'right';
}

/** react-navigation 7 drawer state: open = a `{type:'drawer', status:'open'}` history entry. */
export function isDrawerOpenInState(state: unknown): boolean {
  const s = state as
    | { type?: string; history?: Array<{ type?: string; status?: string }>; routes?: Array<{ state?: unknown }> }
    | null
    | undefined;
  if (!s) return false;
  if (s.type === 'drawer' && (s.history ?? []).some((h) => h.type === 'drawer' && h.status === 'open')) {
    return true;
  }
  return (s.routes ?? []).some((r) => isDrawerOpenInState(r.state));
}

export function setFallbackCloseSlot(slot: FallbackCloseSlot): void {
  if (slot === fallbackCloseSlot) return;
  fallbackCloseSlot = slot;
  slotListeners.forEach((fn) => {
    try {
      fn(slot);
    } catch {
      // a wrapper's error never breaks the SDK
    }
  });
}

export function onFallbackCloseSlot(fn: SlotListener): () => void {
  slotListeners.add(fn);
  fn(fallbackCloseSlot);
  return () => {
    slotListeners.delete(fn);
  };
}
