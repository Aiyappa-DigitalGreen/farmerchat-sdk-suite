/**
 * @digitalgreenorg/farmerchat-web — public entry.
 *
 * Shared surface (docs/03):
 *   <FarmerChat config={...}/>            React component
 *   FarmerChat.mount(element, config)     imperative API (returns unmount handle)
 *   FarmerChat.initialize(config)
 *   FarmerChat.openChat(question?, conversationId?)
 *   FarmerChat.logout()
 *   FarmerChat.isAuthenticated()
 *   FarmerChat.onAuthStateChanged(listener)
 *   FarmerChat.setAnalyticsListener(listener)
 */

import { createElement, useMemo, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { FarmerChatConfig, FarmerChatEventListener } from './core/config';
import { createServices, SdkServices } from './core/services';
import { FarmerChatRoot, FarmerChatController } from './ui/FarmerChatRoot';

export type {
  FarmerChatConfig,
  FarmerChatEnvironment,
  AppearanceMode,
  FarmerChatEventListener,
  FarmerChatTheme,
  FarmerChatThemeColors,
  FarmerChatThemeShape,
  FarmerChatThemeTypography,
  FarmerChatCallbacks,
  AuthMode,
  FarmerChatMode,
  HostToken,
  TokenProvider,
} from './core/config';
export { BASE_URLS } from './core/config';
export type { ApiResult, ApiPriority } from './core/http';
export type { UiState } from './state/uiState';
export { Events as FarmerChatEvents, Screens as FarmerChatScreens } from './core/analytics';
export type { SdkServices } from './core/services';
export { FARMERCHAT_VERSION } from './core/version';

// ---------------------------------------------------------------------------
// Module-level singleton state (initialize/openChat/logout act on it)
// ---------------------------------------------------------------------------

let sharedServices: SdkServices | null = null;
let sharedConfig: FarmerChatConfig | null = null;
let activeController: FarmerChatController | null = null;
/** Programmatic calls made before a controller is mounted are queued and replayed. */
let pendingCommand: ((c: FarmerChatController) => void) | null = null;
const mountedRoots = new Map<Element, Root>();

function getOrCreateServices(config?: FarmerChatConfig): SdkServices {
  if (config) {
    sharedConfig = config;
    sharedServices = createServices(config);
    return sharedServices;
  }
  if (!sharedServices) {
    throw new Error('[FarmerChat] Call FarmerChat.initialize(config) or pass a config prop before use.');
  }
  return sharedServices;
}

function handleController(controller: FarmerChatController): void {
  activeController = controller;
  if (pendingCommand) {
    const cmd = pendingCommand;
    pendingCommand = null;
    cmd(controller);
  }
}

/** Run a command against the active controller, or queue it until one mounts. */
function withController(cmd: (c: FarmerChatController) => void): void {
  if (activeController) cmd(activeController);
  else pendingCommand = cmd;
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export interface FarmerChatProps {
  config?: FarmerChatConfig;
  /** C1 — inline embedding: fill the host container (no full-viewport assumptions). */
  inline?: boolean;
}

function FarmerChatComponent(props: FarmerChatProps): React.ReactElement {
  const services = useMemo(() => getOrCreateServices(props.config), [props.config]);
  return createElement(FarmerChatRoot, { services, onController: handleController, inline: props.inline });
}

// ---------------------------------------------------------------------------
// Floating launcher (FarmerChatFab)
// ---------------------------------------------------------------------------

export interface FarmerChatFabProps {
  config?: FarmerChatConfig;
  /** Deep-link straight into a chat asking this question; when omitted the full journey launches. */
  question?: string;
  /** Render as an extended launcher with this text beside the mark. Defaults to `config.fabLabel`. */
  label?: string;
  /** Corner to pin the launcher to (default 'bottom-right'). */
  position?: 'bottom-right' | 'bottom-left';
  /** Override the launcher background (else `config.fabBackgroundColor`, else theme brand). */
  backgroundColor?: string;
  /** Override the icon/label color (else `config.fabContentColor`, else on-brand). */
  contentColor?: string;
  /** Custom launcher icon; overrides the logo/emoji. */
  icon?: React.ReactNode;
}

function fabBrandColors(props: FarmerChatFabProps): { bg: string; fg: string } {
  const config = props.config ?? sharedConfig;
  const colors = config?.theme?.colors;
  // Precedence: per-instance prop → config default → theme brand → built-in.
  return {
    bg: props.backgroundColor ?? config?.fabBackgroundColor ?? colors?.brandPrimary ?? '#146152',
    fg: props.contentColor ?? config?.fabContentColor ?? colors?.onBrand ?? '#ffffff',
  };
}

function fabLogo(props: FarmerChatFabProps): React.ReactNode {
  if (props.icon != null) return props.icon;
  const logo = (props.config ?? sharedConfig)?.theme?.logo;
  if (typeof logo === 'string' && logo) {
    return createElement('img', {
      src: logo,
      alt: 'FarmerChat',
      style: { width: '1.4em', height: '1.4em', objectFit: 'contain', display: 'block' },
    });
  }
  if (logo) return logo;
  return '🌱';
}

/** FAB label: per-instance prop → config default. */
function fabLabel(props: FarmerChatFabProps): string | undefined {
  return props.label ?? (props.config ?? sharedConfig)?.fabLabel;
}

/**
 * Drop-in floating launcher that opens the full FarmerChat overlay on click.
 * Unlike a bare `openChat()` call, this reveals (mounts) the SDK root — the
 * "floating launcher mode" of docs/04 row 52. Needs only a prior
 * `FarmerChat.initialize(config)` or a `config` prop.
 */
export function FarmerChatFab(props: FarmerChatFabProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const { bg, fg } = fabBrandColors(props);
  const label = fabLabel(props);
  const side = props.position === 'bottom-left' ? { left: '20px' } : { right: '20px' };

  if (open) {
    return createElement(
      'div',
      { style: { position: 'fixed', inset: 0, zIndex: 2147483000, background: 'var(--fc-bg, #ffffff)' } },
      createElement(FarmerChatComponent, { config: props.config }),
      createElement(
        'button',
        {
          'aria-label': 'Close FarmerChat',
          onClick: () => {
            setOpen(false);
            // The revealed root is unmounting; drop its controller so a later
            // reopen's deep-link queues for the fresh root instead of a dead one.
            activeController = null;
          },
          style: {
            position: 'fixed', top: '14px', right: '14px', zIndex: 2147483001,
            width: '40px', height: '40px', borderRadius: '999px', border: 'none', cursor: 'pointer',
            background: 'rgba(0,0,0,0.5)', color: '#ffffff', fontSize: '18px', lineHeight: '40px',
          },
        },
        '✕',
      ),
    );
  }

  return createElement(
    'button',
    {
      'aria-label': 'Open FarmerChat',
      onClick: () => {
        // Clear any stale controller from a prior (now-unmounted) panel so the
        // deep-link always queues for the root we're about to reveal — not a
        // dead one, which would silently drop the question on reopen.
        activeController = null;
        setOpen(true);
        // Deep-link: queues until the just-revealed root mounts, then replays.
        if (props.question) FarmerChat.openChat(props.question);
      },
      style: {
        position: 'fixed', bottom: '20px', ...side, zIndex: 2147483000,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: label ? '10px' : '0', height: '56px',
        width: label ? 'auto' : '56px', padding: label ? '0 22px' : '0',
        borderRadius: '999px', border: 'none', cursor: 'pointer',
        background: bg, color: fg,
        boxShadow: '0 4px 14px rgba(0,0,0,0.25)', fontFamily: 'system-ui, -apple-system, sans-serif',
      },
    },
    createElement('span', { style: { display: 'inline-flex', fontSize: '24px', lineHeight: 1 } }, fabLogo(props)),
    label ? createElement('span', { style: { fontSize: '15px', fontWeight: 600 } }, label) : null,
  );
}

// ---------------------------------------------------------------------------
// Static API
// ---------------------------------------------------------------------------

export interface MountOptions {
  config?: FarmerChatConfig;
  /** C1 — inline embedding: fill the host container. */
  inline?: boolean;
}

interface FarmerChatStatics {
  initialize(config: FarmerChatConfig): void;
  mount(element: Element, options?: FarmerChatConfig | MountOptions): { unmount: () => void };
  /** Append a floating launcher to the document (defaults to document.body). Returns an unmount handle. */
  mountFab(props?: FarmerChatFabProps, container?: Element): { unmount: () => void };
  openChat(question?: string, conversationId?: string): void;
  /** C4 — programmatic: send a question into a fresh/current chat. */
  sendQuestion(text: string): void;
  /** C4 — programmatic: open a conversation by id. */
  openConversation(conversationId: string): void;
  /** C4 — programmatic: navigate to a named screen (home/settings/help/chatHistory/chat/settingsLanguage). */
  openScreen(destination: string): void;
  logout(): Promise<void>;
  /** Push a freshly-refreshed token into the active session (HOST_TOKEN mode). */
  updateTokens(accessToken: string, refreshToken?: string): void;
  isAuthenticated(): boolean;
  onAuthStateChanged(listener: (isAuthenticated: boolean) => void): () => void;
  setAnalyticsListener(listener: FarmerChatEventListener | undefined): void;
}

export const FarmerChat: typeof FarmerChatComponent & FarmerChatStatics = Object.assign(FarmerChatComponent, {
  initialize(config: FarmerChatConfig): void {
    getOrCreateServices(config);
  },

  mount(element: Element, options?: FarmerChatConfig | MountOptions): { unmount: () => void } {
    const opts: MountOptions =
      options && 'environment' in options ? { config: options as FarmerChatConfig } : ((options as MountOptions) ?? {});
    const services = getOrCreateServices(opts.config ?? sharedConfig ?? undefined);
    const existing = mountedRoots.get(element);
    if (existing) existing.unmount();
    const root = createRoot(element);
    mountedRoots.set(element, root);
    root.render(createElement(FarmerChatRoot, { services, onController: handleController, inline: opts.inline }));
    return {
      unmount: () => {
        root.unmount();
        mountedRoots.delete(element);
        activeController = null;
      },
    };
  },

  mountFab(props?: FarmerChatFabProps, container?: Element): { unmount: () => void } {
    if (props?.config) getOrCreateServices(props.config);
    const host = container ?? document.body;
    const el = document.createElement('div');
    el.setAttribute('data-farmerchat-fab', '');
    host.appendChild(el);
    const root = createRoot(el);
    root.render(createElement(FarmerChatFab, props ?? {}));
    return {
      unmount: () => {
        root.unmount();
        el.remove();
      },
    };
  },

  openChat(question?: string, conversationId?: string): void {
    withController((c) => c.openChat(question, conversationId));
  },

  sendQuestion(text: string): void {
    withController((c) => c.sendQuestion(text));
  },

  openConversation(conversationId: string): void {
    withController((c) => c.openConversation(conversationId));
  },

  openScreen(destination: string): void {
    withController((c) => c.openScreen(destination));
  },

  async logout(): Promise<void> {
    if (activeController) {
      await activeController.logout();
      return;
    }
    if (sharedServices) await sharedServices.session.logout();
  },

  updateTokens(accessToken: string, refreshToken?: string): void {
    sharedServices?.session.updateTokens(accessToken, refreshToken);
  },

  isAuthenticated(): boolean {
    return sharedServices?.session.isAuthenticated() ?? false;
  },

  onAuthStateChanged(listener: (isAuthenticated: boolean) => void): () => void {
    if (!sharedServices) throw new Error('[FarmerChat] initialize() first.');
    return sharedServices.session.onAuthStateChanged(listener);
  },

  setAnalyticsListener(listener: FarmerChatEventListener | undefined): void {
    sharedServices?.analytics.setListener(listener);
  },
});

/** Alias for the programmatic entry object (docs/07 C4: `FarmerChatSDK.sendQuestion` …). */
export const FarmerChatSDK = FarmerChat;

export default FarmerChat;
