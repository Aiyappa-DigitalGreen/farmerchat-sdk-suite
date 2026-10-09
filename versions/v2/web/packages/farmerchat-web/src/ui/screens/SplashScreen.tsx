/**
 * Splash (docs/01 §3.1): logo mark with hold-then-spin animation, "starting…"
 * toast after 2 s, min-duration delay, APP_OPENED analytics, then onReady()
 * → routeFromSplash().
 */

import { useEffect, useRef, useState } from 'react';
import { useLabel, useSdk } from '../context';
import { LogoGlyph, Toast } from '../components/common';
import { Assets } from '../assets';
import { Events, Screens } from '../../core/analytics';
import { beginChatOnlyJourney, ensureChatOnlySession } from '../../core/chatOnlyBootstrap';
import type { PendingTarget } from '../router';

const MIN_DURATION_MS = 200;
const TOAST_AFTER_MS = 2000;

export function SplashScreen(props: {
  onReady: () => void;
  /** The navigator's pending target, read (not consumed) at CHAT_ONLY journey start. */
  peekPendingTarget?: () => PendingTarget | null;
}) {
  const { services } = useSdk();
  const label = useLabel();
  const [showToast, setShowToast] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    const toastTimer = window.setTimeout(() => setShowToast(true), TOAST_AFTER_MS);
    services.analytics.track(Events.APP_OPENED, { build_version: 'V2' });
    services.analytics.screenView(Screens.SPLASH);
    // CHAT_ONLY skips the language screen, so the guest session and labels are bootstrapped
    // headlessly here (Android FarmerChatGraph.ensureChatOnlySession) before routing to chat.
    let cancelled = false;
    // Each fresh CHAT_ONLY journey starts a new conversation (Android beginChatOnlyJourney).
    if (services.config.mode === 'CHAT_ONLY') {
      beginChatOnlyJourney(services.store, props.peekPendingTarget?.() ?? null);
    }
    const bootstrap =
      services.config.mode === 'CHAT_ONLY' ? ensureChatOnlySession(services) : Promise.resolve();
    let readyTimer: number | undefined;
    const minDuration = new Promise<void>((resolve) => {
      readyTimer = window.setTimeout(resolve, MIN_DURATION_MS);
    });
    void Promise.all([bootstrap, minDuration]).then(() => {
      if (!cancelled && !firedRef.current) {
        firedRef.current = true;
        props.onReady();
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(toastTimer);
      if (readyTimer !== undefined) window.clearTimeout(readyTimer);
      services.analytics.screenExit(Screens.SPLASH);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SplashScreen.kt: brand green under the full-bleed `fc_boot_bg` gradient, a bare 100dp white
  // mark that holds 3s then spins once over 600ms, and a Loading toast from 2s. No wordmark.
  return (
    <div className="fcsdk-screen fcsdk-c-splash" style={{ backgroundImage: `url(${Assets.bootBg})` }}>
      <div className="fcsdk-c-splash-mark" aria-hidden>
        <LogoGlyph size={100} tint="var(--fc-c-brand-fg-primary)" />
      </div>
      <Toast
        message={showToast ? label('fc_v2_app_label_farmerchat_starting', 'FarmerChat is starting...') : null}
        kind="loading"
      />
    </div>
  );
}
