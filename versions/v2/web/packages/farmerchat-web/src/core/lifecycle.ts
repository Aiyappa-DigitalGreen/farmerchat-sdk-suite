/**
 * SDK instance lifecycle — the React-free half of the static API (`FarmerChat.initialize`,
 * `shutdown`, `clearAllData`, `onAuthStateChanged`), ported from Android `FarmerChat.kt`.
 *
 * - Re-initialize: an instance whose environment, mode, showDrawer, showHistory and showSettings
 *   all equal the new config's is kept (first config wins for every other field). Anything else
 *   tears the old instance down and builds a new one.
 * - Host auth listeners live HERE, not on a SessionManager, so they survive a rebuild and a
 *   shutdown and re-bind to whichever instance is current (Android's static `authListeners`).
 *
 * The graph factory is injected so this module never imports the service classes at runtime —
 * the unit tests run on Node's strip-only TypeScript, which cannot load them.
 */

import type { FarmerChatConfig, ResolvedConfig } from './config';
import { resolveConfig } from './config';
import { SessionStore } from './storage';
import type { AuthStateListener } from './session';

/** The slice of `SdkServices` the lifecycle touches. */
export interface LifecycleServices {
  config: ResolvedConfig;
  session: {
    onAuthStateChanged(listener: AuthStateListener): () => void;
    clearLocalData(): void;
    updateTokens(accessToken: string, refreshToken?: string): void;
  };
}

/** Android `FarmerChat.initialize`'s equivalence rule, on the RESOLVED values (web derives defaults). */
export function sameInstanceShape(a: ResolvedConfig, b: ResolvedConfig): boolean {
  return (
    a.environment === b.environment &&
    a.mode === b.mode &&
    a.showDrawer === b.showDrawer &&
    a.showHistory === b.showHistory &&
    a.showSettings === b.showSettings
  );
}

export interface SdkLifecycle<S extends LifecycleServices> {
  /** Initialize, or keep the current instance when the config is equivalent. */
  initialize(config: FarmerChatConfig): S;
  current(): S | null;
  /** The host config the current instance was built from. */
  currentConfig(): FarmerChatConfig | null;
  /** Tear down the current instance (persisted data and host auth listeners are kept). */
  shutdown(): void;
  /** Static host auth listener; survives rebuilds and shutdown. */
  addAuthListener(listener: AuthStateListener): () => void;
  /** Wipe every fc_sdk_ item locally; the instance (if any) stays up and reports signed-out. */
  clearAllData(): void;
}

export function createSdkLifecycle<S extends LifecycleServices>(
  build: (config: FarmerChatConfig) => S,
): SdkLifecycle<S> {
  let services: S | null = null;
  let hostConfig: FarmerChatConfig | null = null;
  let unbindAuth: (() => void) | null = null;
  const authListeners = new Set<AuthStateListener>();

  const teardown = (): void => {
    // Best effort, never throws. The old SessionManager stays reachable from a root the host has
    // not unmounted yet, so only the static fan-out is cut; in-flight requests are left to finish
    // (aborting them would surface as network errors on that still-mounted screen).
    try {
      unbindAuth?.();
    } catch {
      // ignore
    }
    unbindAuth = null;
    services = null;
    hostConfig = null;
  };

  return {
    initialize(config) {
      if (services && sameInstanceShape(services.config, resolveConfig(config))) {
        // No rebuild, but a host that rotates its token by re-initializing (HOST_TOKEN) must not
        // be silently ignored: push a changed accessToken into the live session and remember it,
        // so the same token passed again is not re-pushed.
        if (config.accessToken && config.accessToken !== hostConfig?.accessToken) {
          services.session.updateTokens(config.accessToken, config.refreshToken);
          hostConfig = { ...(hostConfig ?? config), accessToken: config.accessToken, refreshToken: config.refreshToken ?? hostConfig?.refreshToken };
        }
        return services;
      }
      teardown();
      const next = build(config);
      services = next;
      hostConfig = config;
      unbindAuth = next.session.onAuthStateChanged((authenticated) => {
        for (const l of Array.from(authListeners)) {
          try {
            l(authenticated);
          } catch {
            // listener errors never break the SDK
          }
        }
      });
      return next;
    },

    current: () => services,

    currentConfig: () => hostConfig,

    shutdown: teardown,

    addAuthListener(listener) {
      authListeners.add(listener);
      return () => {
        authListeners.delete(listener);
      };
    },

    clearAllData() {
      if (services) {
        services.session.clearLocalData();
        return;
      }
      // Not initialized: still wipe what an earlier page load persisted.
      new SessionStore().clearAll([]);
    },
  };
}
