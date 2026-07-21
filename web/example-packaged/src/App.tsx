/**
 * Fresh consumer that installs @digitalgreenorg/farmerchat-web from the packed
 * .tgz (see package.json `file:./…tgz`). Proves the published artifact's public
 * API + type declarations resolve from `dist/` — no workspace/source path.
 */
import {
  FarmerChat,
  FarmerChatSDK,
  FARMERCHAT_VERSION,
  type FarmerChatConfig,
  type FarmerChatTheme,
  type AuthMode,
  type FarmerChatMode,
  type TokenProvider,
} from '@digitalgreenorg/farmerchat-web';

// Type-only checks: the theming + feature surface is fully typed from the .tgz.
const theme: FarmerChatTheme = {
  colors: { brandPrimary: '#1565C0', brandPrimaryDark: '#0D47A1', brandAccent: '#42A5F5', onBrand: '#ffffff' },
  dark: { brandPrimary: '#1E88E5', brandAccent: '#64B5F6' },
  shape: { cardCornerRadius: 16, buttonCornerRadius: 12, inputCornerRadius: 12 },
  typography: { fontFamily: 'Inter, system-ui, sans-serif', typeScale: 1.0 },
};

const authMode: AuthMode = 'SDK_OTP';
const mode: FarmerChatMode = 'FULL_JOURNEY';

// C2 HOST_TOKEN example (unused here, just proving the type):
const _tokenProvider: TokenProvider = async () => ({ accessToken: 'host-access', refreshToken: 'host-refresh' });
void _tokenProvider;

const config: FarmerChatConfig = {
  environment: 'dev',
  appearance: 'auto',
  theme,
  authMode,
  mode,
  showSettings: true,
  showHistory: true,
  showDrawer: true,
  enableSsfr: true,
  stringOverrides: { app_name: 'AgriAssist' },
  onChatOpened: () => console.log('[fc] chat opened'),
  onMessageSent: (t) => console.log('[fc] sent', t),
  onAnswerReceived: (id) => console.log('[fc] answer', id),
  onScreenView: (name) => console.log('[fc] screen', name),
  onError: (code, message) => console.warn('[fc] error', code, message),
  onSessionStart: () => console.log('[fc] session start'),
  onEvent: (name, props) => console.log('[fc-event]', name, props),
};

export function App() {
  console.log('FarmerChat SDK version', FARMERCHAT_VERSION);
  return (
    <div className="host">
      <button onClick={() => FarmerChatSDK.sendQuestion('How do I treat leaf blight?')} style={{ display: 'none' }}>
        ask
      </button>
      <FarmerChat config={config} inline />
    </div>
  );
}
