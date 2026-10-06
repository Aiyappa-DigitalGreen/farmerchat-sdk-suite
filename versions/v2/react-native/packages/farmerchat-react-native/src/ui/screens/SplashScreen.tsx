/**
 * Splash (docs/01 §3.1) — full-bleed brand surface + rotating logo mark,
 * "FarmerChat is starting…" toast after 2 s, min-duration delay, App_Opened
 * analytics, then `onReady()` unless a pending error exists.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnalyticsEvents, ScreenNames } from '../../core/analytics';
import { StorageKeys } from '../../core/sessionStore';
import { useLabel, useSdk, useTheme } from '../context';
import { SpinningLogo, Toast } from '../components/Chrome';
import type { ErrorNavigationManager } from '../navigation/errorManager';
import { spacing, typography } from '../theme';

const MIN_SPLASH_DURATION_MS = 200;
const TOAST_DELAY_MS = 2_000;

export function SplashScreen(props: {
  errorManager: ErrorNavigationManager;
  onReady: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const sdk = useSdk();
  const label = useLabel();
  const [showToast, setShowToast] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    const toastTimer = setTimeout(() => setShowToast(true), TOAST_DELAY_MS);

    let cancelled = false;
    const run = async () => {
      const startedAt = Date.now();
      await sdk.ready();
      // Guest session bootstrap (issues tokens for all later calls).
      await sdk.session.ensureGuestSession();
      sdk.store.set(StorageKeys.IS_PROFILE_LOADED, true);
      sdk.analytics.track(AnalyticsEvents.APP_OPENED, { build_version: 'V2' });
      sdk.analytics.trackScreenView(ScreenNames.SPLASH);

      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_SPLASH_DURATION_MS) {
        await new Promise<void>((r) =>
          setTimeout(() => r(), MIN_SPLASH_DURATION_MS - elapsed),
        );
      }
      if (cancelled) return;
      if (!props.errorManager.hasPendingError && !firedRef.current) {
        firedRef.current = true;
        props.onReady();
      }
    };
    void run();

    return () => {
      cancelled = true;
      clearTimeout(toastTimer);
      sdk.analytics.trackScreenExit(ScreenNames.SPLASH);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceFullScreen }]}>
      <SpinningLogo size={72} color={theme.accentYellow} />
      <Text style={[typography.title, { color: theme.textOnBrand, marginTop: spacing.xl }]}>
        FarmerChat
      </Text>
      <Toast
        toast={
          showToast
            ? {
                message: label('fc_v2_app_label_farmerchat_starting', 'FarmerChat is starting…'),
                kind: 'loading',
              }
            : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
