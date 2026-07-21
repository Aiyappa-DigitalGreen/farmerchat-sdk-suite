/**
 * FarmerChat SDK — PACKAGED consumer example.
 *
 * This app installs the SDK from the published tarball
 * (`@digitalgreenorg/farmerchat-react-native` via the .tgz), NOT via a
 * `file:` symlink — it proves the real npm consumption path compiles and
 * bundles. It also exercises the full public surface: host theming (blue
 * brand), C2 authMode, C3 toggles/mode, C4 callbacks, C5 string overrides.
 */
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  FarmerChat,
  FarmerChatProvider,
  FarmerChatView,
  type FarmerChatConfig,
} from '@digitalgreenorg/farmerchat-react-native';

const config: FarmerChatConfig = {
  environment: 'dev',
  appearance: 'auto',
  // C2 — default SDK-owned OTP.
  authMode: 'SDK_OTP',
  // C3 — full journey with every screen enabled.
  mode: 'FULL_JOURNEY',
  showSettings: true,
  showHistory: true,
  showDrawer: true,
  enableWeather: true,
  enableSsfr: true,
  // Part B — host theme (blue brand instead of green).
  theme: {
    colors: {
      brandPrimary: '#1565C0',
      brandPrimaryDark: '#0D47A1',
      brandAccent: '#42A5F5',
      onBrand: '#FFFFFF',
    },
    shape: { cardCornerRadius: 16, buttonCornerRadius: 12 },
    typography: { typeScale: 1.0 },
  },
  // C5 — host string override wins over server labels.
  stringOverrides: {
    fc_v2_app_label_for_your_farm_today: 'For your farm today (host)',
  },
  // C4 — semantic lifecycle callbacks.
  callbacks: {
    onSessionStart: () => console.log('[FarmerChat cb] onSessionStart'),
    onScreenView: (name) => console.log('[FarmerChat cb] onScreenView', name),
    onChatOpened: () => console.log('[FarmerChat cb] onChatOpened'),
    onMessageSent: (text) => console.log('[FarmerChat cb] onMessageSent', text),
    onAnswerReceived: (id) => console.log('[FarmerChat cb] onAnswerReceived', id),
    onError: (code, message) => console.log('[FarmerChat cb] onError', code, message),
  },
  onEvent: (name, props) => console.log(`[FarmerChat event] ${name}`, JSON.stringify(props)),
  onSessionExpired: () => console.warn('[FarmerChat] session expired'),
};

FarmerChat.initialize(config);

export default function App(): React.ReactElement {
  useEffect(() => {
    const unsubscribe = FarmerChat.addAuthStateListener((isAuthenticated) => {
      console.log('[FarmerChat] auth state:', isAuthenticated);
    });
    // Exercise the programmatic C4 API surface (types must resolve from the pkg).
    void FarmerChat.isAuthenticated();
    return unsubscribe;
  }, []);

  return (
    <FarmerChatProvider>
      <StatusBar style="auto" />
      <FarmerChatView />
    </FarmerChatProvider>
  );
}
