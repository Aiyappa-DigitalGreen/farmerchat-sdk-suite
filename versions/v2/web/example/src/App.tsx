import { FarmerChat, FarmerChatSDK, type FarmerChatConfig } from '@digitalgreenorg/farmerchat-web';

/**
 * Verification harness for the FarmerChat Web SDK.
 *
 * The scenario is selected with a `?scenario=` URL parameter so a single build
 * can be driven through every screen and every feature (C1–C5) by a headless
 * browser. Default (`default`) is the shipping green brand, full journey,
 * embedded inline (C1) in a phone-sized host container.
 *
 * WEB VERIFICATION NOTE: the dev backend requires a per-host guest API key that
 * ships blank on web, so a browser cannot authenticate against dev. Every path
 * here is therefore served by the local mock (docs/08) via `customBaseUrl`.
 */

const MOCK_BASE = 'http://localhost:8899/';

const params = new URLSearchParams(window.location.search);
const scenario = params.get('scenario') ?? 'default';

// Blue "host brand" palette (docs/07 Part B) used by the theming scenarios.
const blueTheme: FarmerChatConfig['theme'] = {
  colors: {
    brandPrimary: '#1565C0',
    brandPrimaryDark: '#0D47A1',
    brandAccent: '#42A5F5',
    onBrand: '#ffffff',
  },
  dark: {
    brandPrimary: '#1E88E5',
    brandPrimaryDark: '#1565C0',
    brandAccent: '#64B5F6',
    onBrand: '#ffffff',
  },
  shape: { cardCornerRadius: 16, buttonCornerRadius: 12, inputCornerRadius: 12 },
  typography: { typeScale: 1.0 },
};

// Base config shared by all scenarios — every semantic callback (C4) is wired
// to console.log so the headless run can assert the hooks fire.
const baseConfig: FarmerChatConfig = {
  environment: 'dev',
  customBaseUrl: MOCK_BASE,
  appearance: 'auto',
  enableVoice: true,
  enableImages: true,
  enableWeather: true,
  mode: 'FULL_JOURNEY',
  showSettings: true,
  showHistory: true,
  // showDrawer left unset: it follows the mode (drawer in FULL_JOURNEY, none in the CHAT_ONLY scenario).
  enableSsfr: true,

  onChatOpened: () => console.log('[fc] chat opened'),
  onMessageSent: (text) => console.log('[fc] message sent:', text),
  onAnswerReceived: (id) => console.log('[fc] answer received:', id),
  onScreenView: (name) => console.log('[fc] screen:', name),
  onError: (code, message) => console.warn('[fc] error', code, message),
  onSessionStart: () => console.log('[fc] session started'),
  onEvent: (name, props) => console.log('[fc-event]', name, props),
  onSessionExpired: () => console.warn('[fc] session expired'),
};

function buildConfig(): FarmerChatConfig {
  switch (scenario) {
    case 'blue':
      return { ...baseConfig, theme: blueTheme };
    case 'chatonly':
      return { ...baseConfig, mode: 'CHAT_ONLY' };
    case 'hosttoken':
      return {
        ...baseConfig,
        authMode: 'HOST_TOKEN',
        accessToken: 'host-supplied-access-token',
        refreshToken: 'host-supplied-refresh-token',
        tokenProvider: () => {
          console.log('[fc] tokenProvider called');
          return { accessToken: 'host-refreshed-token' };
        },
      };
    case 'overrides':
      // C5: host string overrides (win over server labels) + forced locale.
      return {
        ...baseConfig,
        locale: 'hi',
        stringOverrides: {
          app_name: 'AgriAssist',
          language_title: 'Pick your language (host copy)',
          language_start_button: 'Continue with AgriAssist',
          name_title: 'Tell us your name (host copy)',
          home_feed_header: 'Your AgriAssist briefing',
        },
      };
    default:
      return baseConfig;
  }
}

const config = buildConfig();

// The programmatic API (C4) is exercised from a toolbar so a click can drive
// navigation without host-side routing.
function Toolbar() {
  return (
    <div className="toolbar">
      <button onClick={() => FarmerChatSDK.sendQuestion('How do I treat leaf blight on rice?')}>Ask a question</button>
      <button onClick={() => FarmerChatSDK.openScreen('chatHistory')}>History</button>
      <button onClick={() => FarmerChatSDK.openScreen('settings')}>Settings</button>
      <button onClick={() => FarmerChatSDK.openScreen('help')}>Help</button>
      <button onClick={() => FarmerChatSDK.openScreen('home')}>Home</button>
      <button onClick={() => FarmerChatSDK.openConversation('conv-001')}>Open conv-001</button>
    </div>
  );
}

export function App() {
  // `fullpage` demonstrates that inline makes no full-viewport assumptions by
  // filling a narrow column; all other scenarios embed in the phone frame.
  const wide = scenario === 'fullwidth';
  return (
    <div className="page" data-scenario={scenario}>
      <Toolbar />
      <div className="host" style={wide ? { height: '90vh', maxWidth: 'none' } : undefined}>
        {/* C1 — inline fills its container (no full-viewport assumptions). */}
        <FarmerChat config={config} inline />
      </div>
    </div>
  );
}
