/**
 * FarmerChat SDK example — minimal Expo host app: initializes the SDK against
 * the dev environment, logs every analytics event, and renders the full
 * FarmerChat journey.
 */
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  FarmerChat,
  FarmerChatProvider,
  FarmerChatView,
} from '@digitalgreenorg/farmerchat-react-native';

FarmerChat.initialize({
  environment: 'dev',
  // E2E verification (docs/08): to prove the paths dev cannot serve deterministically
  // (chat answer, OTP, voice, image, TTS), point the SDK at the local mock by
  // uncommenting the line below and running `adb reverse tcp:8899 tcp:8899`.
  // The committed default stays on the live dev backend per the guardrail.
  customBaseUrl: 'http://localhost:8899/',
  appearance: 'light',
  enableVoice: true,
  enableImages: true,
  enableWeather: true,
  // Host theme (docs/07 Part B) — recolor the whole SDK to a blue brand.
  // theme: {
  //   colors: {
  //     brandPrimary: '#1565C0',
  //     brandPrimaryDark: '#0D47A1',
  //     brandAccent: '#42A5F5',
  //     onBrand: '#FFFFFF',
  //   },
  //   shape: { cardCornerRadius: 16, buttonCornerRadius: 12 },
  // },
  callbacks: {
    onSessionStart: () => console.log('[FarmerChat cb] onSessionStart'),
    onScreenView: (name) => console.log('[FarmerChat cb] onScreenView', name),
    onChatOpened: () => console.log('[FarmerChat cb] onChatOpened'),
    onMessageSent: (text) => console.log('[FarmerChat cb] onMessageSent', text),
    onAnswerReceived: (id) => console.log('[FarmerChat cb] onAnswerReceived', id),
    onError: (code, message) => console.log('[FarmerChat cb] onError', code, message),
  },
  onEvent: (name, props) => {
    // Host analytics fan-out — identical event names/props to the production app.
    console.log(`[FarmerChat event] ${name}`, JSON.stringify(props));
  },
  onSessionExpired: () => {
    console.warn('[FarmerChat] session expired — user will be re-issued a guest session');
  },
});

export default function App(): React.ReactElement {
  useEffect(() => {
    const unsubscribe = FarmerChat.addAuthStateListener((isAuthenticated) => {
      console.log('[FarmerChat] auth state:', isAuthenticated);
    });
    return unsubscribe;
  }, []);

  return (
    <FarmerChatProvider>
      <StatusBar style="auto" />
      <FarmerChatView />
    </FarmerChatProvider>
  );
}
