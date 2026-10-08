import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
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

const DEFAULT_BRAND = '#146152';

function ChatBubbleIcon(): ReactElement {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3C6.48 3 2 6.92 2 11.75c0 2.47 1.18 4.7 3.08 6.28-.16 1.28-.7 2.5-1.6 3.47a.5.5 0 0 0 .4.84c2.05-.1 3.8-.86 5.03-1.72.98.24 2.02.38 3.09.38 5.52 0 10-3.92 10-8.75S17.52 3 12 3Zm-4.5 10a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm4.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm4.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z" />
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

function CloseIcon(): ReactElement {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
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

  // Callbacks read through a ref so the memoised SDK config below stays stable:
  // the SDK rebuilds its whole service graph when the config identity changes.
  const callbacksRef = useRef(props);
  callbacksRef.current = props;

  useEffect(() => ensureWidgetStyles(), []);

  const doOpen = useCallback((question?: string) => {
    setMounted(true);
    if (!openRef.current) {
      setOpen(true);
      callbacksRef.current.onOpen?.();
    }
    // Queues inside the SDK until its root mounts, then replays.
    if (question) FarmerChat.openChat(question);
  }, []);

  const doClose = useCallback(() => {
    if (!openRef.current) return;
    setOpen(false);
    callbacksRef.current.onClose?.();
    // Return focus to the launcher only if it was inside the panel; never steal
    // it from wherever the host page put it.
    if (panelRef.current?.contains(document.activeElement)) launcherRef.current?.focus();
  }, []);

  const sdkConfig = useMemo<FarmerChatConfig>(
    () => ({
      ...config,
      // The SDK's "nowhere to go back to" exit (e.g. CHAT_ONLY close) collapses
      // the panel; the host's own onExit still fires.
      onExit: () => {
        doClose();
        config.onExit?.();
      },
    }),
    [config, doClose],
  );

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

  // Move focus into the panel when it opens so keyboard users land in it.
  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);

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
    else icon = <ChatBubbleIcon />;
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
        ].filter(Boolean).join(' ')}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            doClose();
          }
        }}
      >
        <div className="fcw-panel-bar">
          <button type="button" className="fcw-panel-close" aria-label="Close FarmerChat" onClick={doClose}>
            <MinimizeIcon />
          </button>
        </div>
        <div className="fcw-panel-body">{mounted ? <FarmerChat config={sdkConfig} inline /> : null}</div>
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
