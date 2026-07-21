/**
 * @digitalgreenorg/farmerchat-react-native — public entry.
 */

// Public API surface (docs/03 + docs/07 C1)
export { FarmerChat } from './FarmerChat';
export { FarmerChatProvider } from './FarmerChatProvider';
export { FarmerChatView } from './FarmerChatView';
export { FarmerChatInlineView } from './FarmerChatInlineView';
export { FarmerChatFab } from './FarmerChatFab';
export type { FarmerChatFabProps } from './FarmerChatFab';

// Configuration
export type {
  AppearanceMode,
  FarmerChatConfig,
  FarmerChatEnvironment,
  FarmerChatEventListener,
  // Host theming (docs/07 Part B)
  FarmerChatTheme,
  FarmerChatThemeColors,
  FarmerChatThemeShape,
  FarmerChatThemeTypography,
  FarmerChatLogoSource,
  // Feature scope (docs/07 Part C)
  FarmerChatAuthMode,
  FarmerChatMode,
  FarmerChatTokenProvider,
  FarmerChatCallbacks,
} from './core/config';
export { BASE_URLS } from './core/config';

// Programmatic C4 screen destinations for FarmerChat.openScreen
export type { FarmerChatScreen } from './core/sdk';

// Analytics (event/screen name constants for host fan-out mapping)
export { AnalyticsEvents, ScreenNames } from './core/analytics';

// Resolved design tokens (theme object consumed by the UI after host overlay)
export { dayTheme, nightTheme } from './ui/theme';
export type { FarmerChatTheme as FarmerChatResolvedTheme } from './ui/theme';

// Core result envelopes (useful for hosts extending the SDK)
export type { ApiResult, UiState } from './core/apiResult';

// Wire models (full typed surface of docs/02)
export * from './core/types';
