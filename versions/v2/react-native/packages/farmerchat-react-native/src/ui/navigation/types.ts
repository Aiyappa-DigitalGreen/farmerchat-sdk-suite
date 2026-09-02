/**
 * Route params — port of `navigation/Destination.kt` (docs/01 §2).
 * Chat is the only parameterized non-dialog route.
 */
import type { NavigatorScreenParams } from '@react-navigation/native';

export interface ChatRouteParams {
  /** "home" | "history" | "deeplink" (campaign surfaces are omitted per docs/03). */
  source?: string;
  question?: string;
  conversationId?: string;
  imageUri?: string;
  transcriptionId?: string;
  audioUri?: string;
  statementId?: number;
  homeStatementId?: string;
  preGeneratedAnswer?: string;
  follow_up_questions?: string[];
  isWeatherAdviceCTA?: boolean;
  isSSFR?: boolean;
  ssfrCrop?: string;
  channel?: string;
}

export interface ErrorRouteParams {
  isNetworkError?: boolean;
  fromScreen?: string;
}

export interface LegalContentRouteParams {
  url: string;
  title: string;
}

export type RootStackParamList = {
  Splash: undefined;
  Language: undefined;
  Name: undefined;
  Home: undefined;
  Chat: ChatRouteParams;
  Settings: undefined;
  SettingsName: undefined;
  Help: undefined;
  SettingsLanguage: undefined;
  ChatHistory: undefined;
  Error: ErrorRouteParams;
  AccountBenefits: undefined;
  Auth: undefined;
  AccountSuccess: undefined;
  LegalContent: LegalContentRouteParams;
};

export type DrawerParamList = {
  Main: NavigatorScreenParams<RootStackParamList>;
};

/** Screens wrapped by the shared drawer (docs/01 §4). */
export const DRAWER_ROUTES: ReadonlySet<keyof RootStackParamList> = new Set([
  'Home',
  'Chat',
  'Settings',
  'Help',
  'SettingsLanguage',
  'ChatHistory',
] as const);
