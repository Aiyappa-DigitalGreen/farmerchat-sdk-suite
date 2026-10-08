import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactElement, ReactNode } from 'react';
import { FarmerChat } from '@digitalgreenorg/farmerchat-web';
import type { FarmerChatConfig } from '@digitalgreenorg/farmerchat-web';
import { ensureWidgetStyles } from './styles';
import { shouldUseFullscreen } from './layout';

export interface FarmerChatWidgetProps {
  /** Passed to the SDK unchanged, except `onExit`, which also collapses the panel. */
  config: FarmerChatConfig;
  /** Corner the launcher and panel are pinned to (default 'bottom-right'). */
  position?: 'bottom-right' | 'bottom-left';
  /** Distance from the side of the viewport, px (default 20). */
  horizontalPadding?: number;
  /** Distance from the bottom of the viewport, px (default 20). */
  verticalPadding?: number;
  /** Floating panel size, px (defaults 400 × 680; clamped to the viewport). */
  panelWidth?: number;
  panelHeight?: number;
  /** Launcher background. Default: `config.fabBackgroundColor` → `theme.colors.brandPrimary` → SDK green. */
  launcherColor?: string;
  /** Launcher icon/label colour. Default: `config.fabContentColor` → `theme.colors.onBrand` → white. */
  launcherIconColor?: string;
  /** Extended launcher text. Default: `config.fabLabel`; omitted → round launcher. */
  launcherLabel?: string;
  /** Custom launcher icon (replaces the chat bubble / `theme.logo`). */
  launcherIcon?: ReactNode;
  /** Hide the built-in launcher and drive the widget from your own button via the API. */
  hideLauncher?: boolean;
  /** Open on first render. */
  defaultOpen?: boolean;
  /**
   * Mount the SDK on page load instead of on first open. Costs the guest-init
   * requests up front; saves the splash on first open. Default false.
   */
  preload?: boolean;
  /** Stacking order of launcher + panel (default 2147483000). */
  zIndex?: number;
  /** Host callbacks for the widget's own state — not analytics events (no new event names). */
  onOpen?: () => void;
  onClose?: () => void;
}

/** Imperative surface the mounted widget registers; see `index.ts`. */
export interface WidgetHandle {
  open(question?: string): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
}

let activeHandle: WidgetHandle | null = null;
let pending: ((h: WidgetHandle) => void) | null = null;

/** Runs against the mounted widget, or queues until one mounts (last call wins). */
export function withWidget(cmd: (h: WidgetHandle) => void): void {
  if (activeHandle) cmd(activeHandle);
  else pending = cmd;
}

export function currentWidget(): WidgetHandle | null {
  return activeHandle;
}

let initializedFor: FarmerChatConfig | null = null;
let generation = 0;

/**
 * Initialises the SDK singleton for this host config (no-op when it is the same
 * object). Runs before the panel ever opens — `createServices` is synchronous and
 * makes no requests — so `FarmerChatWidget.sdk.logout()`, `isAuthenticated()`,
 * `onAuthStateChanged()` and `updateTokens()` act on the stored session even on a
 * page load where the user never opens the widget.
 *
 * Returns a generation number that changes only when the services were rebuilt.
 */
export function ensureSdk(config: FarmerChatConfig): number {
  if (config === initializedFor) return generation;
  initializedFor = config;
  generation += 1;
  FarmerChat.initialize({
    ...config,
    // The SDK's "nowhere to go back to" exit (e.g. CHAT_ONLY close) collapses
    // the panel; the host's own onExit still fires.
    onExit: () => {
      activeHandle?.close();
      config.onExit?.();
    },
  });
  return generation;
}

/** compose FarmerChatFab: `hostBrandColor() ?: Green700`. */
const DEFAULT_BRAND = '#008236';

/** The app's `fc_logo_mark` (compose FarmerChatFab's default icon), 24dp. */
function LogoMarkIcon(): ReactElement {
  return (
    <svg width="24" height="24" viewBox="0 0 130 130" fill="currentColor" aria-hidden="true">
      <path d="M32.56,0C50.54,0 65.12,14.59 65.12,32.59C47.14,32.59 32.56,18 32.56,0Z" />
      <path d="M97.56,0C79.58,0 65,14.59 65,32.59C82.98,32.59 97.56,18 97.56,0Z" />
      <path d="M32.68,65.06C14.7,65.06 0.12,50.47 0.12,32.47C18.1,32.47 32.68,47.06 32.68,65.06Z" />
      <path d="M65.12,32.47C47.14,32.47 32.56,47.06 32.56,65.06C50.54,65.06 65.12,50.47 65.12,32.47Z" />
      <path d="M65,32.47C82.98,32.47 97.56,47.06 97.56,65.06C79.58,65.06 65,50.47 65,32.47Z" />
      <path d="M97.44,65.06C115.42,65.06 130,50.47 130,32.47C112.02,32.47 97.44,47.06 97.44,65.06Z" />
      <path d="M32.56,64.94C14.58,64.94 0,79.53 0,97.53C17.98,97.53 32.56,82.94 32.56,64.94Z" />
      <path d="M32.56,64.94C50.54,64.94 65.12,79.53 65.12,97.53C47.14,97.53 32.56,82.94 32.56,64.94Z" />
      <path d="M97.56,64.94C79.58,64.94 65,79.53 65,97.53C82.98,97.53 97.56,82.94 97.56,64.94Z" />
      <path d="M97.44,64.94C115.42,64.94 130,79.53 130,97.53C112.02,97.53 97.44,82.94 97.44,64.94Z" />
      <path d="M65.12,97.41C47.14,97.41 32.56,112 32.56,130C50.54,130 65.12,115.41 65.12,97.41Z" />
      <path d="M65,97.41C82.98,97.41 97.56,112 97.56,130C79.58,130 65,115.41 65,97.41Z" />
    </svg>
  );
}

function MinimizeIcon(): ReactElement {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Material Icons.Filled.Close, 24dp. */
function CloseIcon(): ReactElement {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}

function useFullscreen(panelWidth: number, panelHeight: number): boolean {
  const compute = () =>
    typeof window !== 'undefined' &&
    shouldUseFullscreen(window.innerWidth, window.innerHeight, panelWidth, panelHeight);
  const [fullscreen, setFullscreen] = useState(compute);
  useEffect(() => {
    const onResize = () => setFullscreen(compute());
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelWidth, panelHeight]);
  return fullscreen;
}

/**
 * Intercom-style launcher + floating panel hosting the complete FarmerChat SDK.
 *
 * Unlike `FarmerChatFab` (which unmounts its full-screen overlay on close and so
 * replays the splash every reopen), the panel stays mounted once opened and is
 * only hidden, so the conversation, scroll position and back stack survive.
 */
export function FarmerChatWidget(props: FarmerChatWidgetProps): ReactElement {
  const {
    config,
    position = 'bottom-right',
    horizontalPadding = 20,
    verticalPadding = 20,
    panelWidth = 400,
    panelHeight = 680,
    hideLauncher = false,
    defaultOpen = false,
    preload = false,
    zIndex = 2147483000,
  } = props;

  const [open, setOpen] = useState(defaultOpen);
  // The SDK mounts on first open (or immediately with `preload`) and is never
  // unmounted by a close.
  const [mounted, setMounted] = useState(defaultOpen || preload);
  const fullscreen = useFullscreen(panelWidth, panelHeight);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  // Only a NEW config object rebuilds the SDK services; the same object across
  // re-renders (or `update()` calls that leave it out) keeps the live session.
  const sdkGeneration = useMemo(() => ensureSdk(config), [config]);
  // A question asked while the SDK root is not mounted yet is handed over in an
  // effect, after the root (a child, so its effects run first) has registered its
  // controller — not synchronously, where it could reach a stale, unmounted one.
  const [pendingQuestion, setPendingQuestion] = useState<{ text: string } | null>(null);

  const callbacksRef = useRef(props);
  callbacksRef.current = props;

  // Before the first paint, so the launcher never shows up as an unstyled in-flow button.
  useLayoutEffect(() => ensureWidgetStyles(), []);

  const doOpen = useCallback((question?: string) => {
    setMounted(true);
    if (!openRef.current) {
      setOpen(true);
      callbacksRef.current.onOpen?.();
    }
    if (question) setPendingQuestion({ text: question });
  }, []);

  useEffect(() => {
    if (!mounted || !pendingQuestion) return;
    FarmerChat.openChat(pendingQuestion.text);
    setPendingQuestion(null);
  }, [mounted, pendingQuestion]);

  const doClose = useCallback(() => {
    if (!openRef.current) return;
    setOpen(false);
    callbacksRef.current.onClose?.();
    // Return focus to the launcher only if it was inside the panel; never steal
    // it from wherever the host page put it.
    if (panelRef.current?.contains(document.activeElement)) launcherRef.current?.focus();
  }, []);

  // Register the imperative handle and replay anything queued before mount.
  useEffect(() => {
    const handle: WidgetHandle = {
      open: doOpen,
      close: doClose,
      toggle: () => (openRef.current ? doClose() : doOpen()),
      isOpen: () => openRef.current,
    };
    activeHandle = handle;
    if (pending) {
      const cmd = pending;
      pending = null;
      cmd(handle);
    }
    return () => {
      if (activeHandle === handle) activeHandle = null;
    };
  }, [doOpen, doClose]);

  // Move focus into the panel when the USER opens it, so keyboard users land in it. Not for
  // `defaultOpen`: a widget must not take focus from the host page on load.
  const skipInitialFocus = useRef(defaultOpen);
  useEffect(() => {
    if (!open) return;
    if (skipInitialFocus.current) {
      skipInitialFocus.current = false;
      return;
    }
    panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Escape dismisses the topmost SDK layer first (drawer, sheet, dialog — each closes on a scrim
  // tap, which is what Escape stands in for); only with none open does it collapse the panel.
  // The location-permission modal has no dismissing scrim and is left to its own buttons.
  const onPanelKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.stopPropagation();
      const scrims = panelRef.current?.querySelectorAll<HTMLElement>(
        // The drawer stays mounted when shut; only its open host counts.
        '.fcsdk-c-drawer-host--open .fcsdk-c-drawer-scrim, .fcsdk-c-sheet-scrim, .fcsdk-modal-scrim',
      );
      const top = scrims && scrims.length ? scrims[scrims.length - 1] : null;
      if (top) {
        if (!top.classList.contains('fcsdk-location-layer')) top.click();
        return;
      }
      doClose();
    },
    [doClose],
  );

  const side = position === 'bottom-left' ? 'left' : 'right';
  const colors = config.theme?.colors;
  const bg = props.launcherColor ?? config.fabBackgroundColor ?? colors?.brandPrimary ?? DEFAULT_BRAND;
  const fg = props.launcherIconColor ?? config.fabContentColor ?? colors?.onBrand ?? '#ffffff';
  const label = props.launcherLabel ?? config.fabLabel;

  let icon: ReactNode = props.launcherIcon;
  if (icon == null) {
    const logo = config.theme?.logo;
    if (typeof logo === 'string' && logo) icon = <img src={logo} alt="" />;
    else if (logo) icon = logo;
    else icon = <LogoMarkIcon />;
  }

  const vars = {
    '--fcw-offset-x': `${horizontalPadding}px`,
    '--fcw-offset-y': `${verticalPadding}px`,
    '--fcw-panel-w': `min(${panelWidth}px, calc(100vw - ${horizontalPadding * 2}px))`,
    '--fcw-panel-h': `${panelHeight}px`,
    '--fcw-z': String(zIndex),
    '--fcw-launcher-bg': bg,
    '--fcw-launcher-fg': fg,
  } as CSSProperties;

  const launcherHidden = hideLauncher || (open && fullscreen);
  const extended = !!label && !open;

  return (
    <div className="fcw-root" style={vars} data-farmerchat-widget="">
      <div
        ref={panelRef}
        id="fcw-panel"
        role="dialog"
        aria-label="FarmerChat"
        aria-hidden={!open}
        tabIndex={-1}
        className={[
          'fcw-panel',
          `fcw-panel--${side}`,
          open ? '' : 'fcw-panel--closed',
          fullscreen ? 'fcw-panel--fullscreen' : '',
          hideLauncher ? 'fcw-panel--barred' : '',
        ].filter(Boolean).join(' ')}
        onKeyDown={onPanelKeyDown}
      >
        <div className="fcw-panel-bar">
          <button type="button" className="fcw-panel-close" aria-label="Close FarmerChat" onClick={doClose}>
            <MinimizeIcon />
          </button>
        </div>
        <div className="fcw-panel-body">{/* No config prop: the root reuses the services `ensureSdk` built. Keyed by
            generation so a genuinely new config remounts onto the new services. */}
          {/* active: a collapsed panel stays mounted, so the SDK is told to cancel any voice
              recording and pause playback — never a live microphone behind a closed widget. */}
          {mounted ? <FarmerChat key={sdkGeneration} inline active={open} /> : null}</div>
      </div>

      <button
        ref={launcherRef}
        type="button"
        className={[
          'fcw-launcher',
          `fcw-launcher--${side}`,
          extended ? 'fcw-launcher--extended' : '',
          open ? 'fcw-launcher--open' : '',
          launcherHidden ? 'fcw-launcher--hidden' : '',
        ].filter(Boolean).join(' ')}
        aria-label={open ? 'Close FarmerChat' : 'Open FarmerChat'}
        aria-expanded={open}
        aria-controls="fcw-panel"
        onClick={() => (open ? doClose() : doOpen())}
      >
        <span className="fcw-launcher-icon">
          <span className="fcw-icon-open">{icon}</span>
          <span className="fcw-icon-close"><CloseIcon /></span>
        </span>
        {extended ? <span>{label}</span> : null}
      </button>
    </div>
  );
}
