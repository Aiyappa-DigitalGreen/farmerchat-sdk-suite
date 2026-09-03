/**
 * FarmerChatRoot — single-root view router reproducing docs/01 §2:
 * routeFromSplash tree, all navigation edges with popUpTo semantics, shared
 * drawer around Home/Chat/Settings/Help/SettingsLanguage/ChatHistory, central
 * error routing with per-fromScreen retry, legal-content modal, global
 * location-prompt overlay, day/night/auto theming.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import type { AppearanceMode } from '../core/config';
import { ensureStylesInjected, resolveTheme, resolveThemeVars } from './theme';
import { SdkProvider, useToastState } from './context';
import { useNavigator, ChatRouteParams, PendingTarget } from './router';
import { useChatHistory } from '../state/useChatHistory';
import { useLocationPrompt } from '../state/useLocationPrompt';
import { Drawer, DrawerRoute } from './components/Drawer';
import { SplashScreen } from './screens/SplashScreen';
import { LanguageSelectionScreen } from './screens/LanguageSelectionScreen';
import { EnterNameScreen } from './screens/EnterNameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ChatScreen } from './screens/ChatScreen';
import { ChatHistoryScreen } from './screens/ChatHistoryScreen';
import { SettingsScreen, SettingsNameScreen } from './screens/SettingsScreen';
import { LanguageChooserScreen } from './screens/LanguageChooserScreen';
import { HelpScreen, LegalContentModal } from './screens/HelpScreen';
import { ErrorScreen } from './screens/ErrorScreen';
import { AccountBenefitsScreen, AccountSuccessScreen } from './screens/AccountScreens';
import { AuthScreen } from './screens/AuthScreen';
import { LocationPromptOverlay } from './screens/LocationPromptOverlay';
import { Events } from '../core/analytics';

export interface FarmerChatController {
  openChat: (question?: string, conversationId?: string) => void;
  logout: () => Promise<void>;
  /** C4 — programmatic: send a question into a fresh/current chat. */
  sendQuestion: (text: string) => void;
  /** C4 — programmatic: open a conversation by id (alias of openChat(_, id)). */
  openConversation: (conversationId: string) => void;
  /** C4 — programmatic: navigate to a named screen. */
  openScreen: (destination: string) => void;
}

const DRAWER_ROUTES = new Set(['home', 'chat', 'settings', 'help', 'settingsLanguage', 'chatHistory']);

export function FarmerChatRoot(props: {
  services: SdkServices;
  onController?: (controller: FarmerChatController) => void;
  /** C1 — inline embedding: fill the host container (no full-viewport assumptions). */
  inline?: boolean;
}) {
  const { services } = props;
  const navigator = useNavigator(services.store, services.config.mode);
  const toast = useToastState();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [legal, setLegal] = useState<{ url: string; title: string } | null>(null);
  const [showNameUpdatedToast, setShowNameUpdatedToast] = useState(false);
  // 2.0.0 in-app Terms-of-Use dialog. The app opens it from a Plotline card CTA
  // (`open_terms_of_use=true`); the SDK carries no Plotline (root CLAUDE.md §6), so the request
  // comes from the host through the EXISTING public entry point — `openScreen('termsofuse')` —
  // which lands on Home and then raises this flag, exactly the app's "navigate Home + open Terms
  // dialog". Mirrors the Android compose `termsOfUseRequested` flag (FarmerChatRoot.kt:118).
  const [termsOfUseRequested, setTermsOfUseRequested] = useState(false);
  const [authTick, setAuthTick] = useState(0);
  const retryActionRef = useRef<(() => void) | null>(null);

  // Appearance (Day/Night/Auto with prefers-color-scheme).
  const [appearance, setAppearanceState] = useState<AppearanceMode>(() => {
    const saved = services.store.getString(PrefKeys.APPEARANCE_MODE);
    return saved === 'day' || saved === 'night' || saved === 'auto' ? saved : services.config.appearance;
  });
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const setAppearance = useCallback(
    (mode: AppearanceMode) => {
      setAppearanceState(mode);
      services.store.setString(PrefKeys.APPEARANCE_MODE, mode);
    },
    [services.store],
  );
  const theme = appearance === 'auto' ? (systemDark ? 'night' : 'day') : resolveTheme(appearance);

  useEffect(() => ensureStylesInjected(), []);

  // Shared chatHistory VM (drawer + ChatHistory screen), refreshed on auth (docs/01 §2 graph effects).
  const [history, historyActions] = useChatHistory(services);
  const isAuthenticated = services.session.isAuthenticated();
  useEffect(() => {
    if (isAuthenticated) void historyActions.refreshSilently();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authTick]);
  useEffect(() => services.session.onAuthStateChanged(() => setAuthTick((t) => t + 1)), [services.session]);

  // Global location prompt (docs/01 §3.15).
  const [locationState, locationActions] = useLocationPrompt(services);

  const isOnline = () => (typeof navigator !== 'undefined' && 'onLine' in window.navigator ? window.navigator.onLine : true);

  // --- Navigation helpers (docs/01 §2 edges) --------------------------------

  const openChat = useCallback(
    (params: ChatRouteParams) => {
      navigator.push({ name: 'chat', params });
    },
    [navigator],
  );

  const navigateToError = useCallback(
    (isNetworkError: boolean, fromScreen: string, retry?: () => void) => {
      retryActionRef.current = retry ?? null;
      // C4 semantic error callback (in addition to the analytics fan-out).
      services.analytics.error(
        undefined,
        isNetworkError ? 'network_error' : `error:${fromScreen}`,
      );
      navigator.pushSingleTop({ name: 'error', params: { isNetworkError, fromScreen } });
    },
    [navigator, services.analytics],
  );

  const navigateDrawerRoute = useCallback(
    (route: DrawerRoute) => {
      setDrawerOpen(false);
      // Drawer routes: popUpTo(startDestination) + singleTop (docs/01 §2).
      switch (route) {
        case 'home':
          navigator.replaceAll({ name: 'home' });
          break;
        case 'settings':
          navigator.popUpToAndPush('home', false, { name: 'settings' });
          break;
        case 'settings/language':
          navigator.popUpToAndPush('home', false, { name: 'settingsLanguage' });
          break;
        case 'help':
          navigator.popUpToAndPush('home', false, { name: 'help' });
          break;
        case 'chatHistory':
          if (!isOnline()) navigateToError(true, 'chatHistory', () => void historyActions.refresh());
          else navigator.popUpToAndPush('home', false, { name: 'chatHistory' });
          break;
      }
    },
    [historyActions, navigateToError, navigator],
  );

  /** Drawer/Settings sign-up: question count → bypass_interstitial ? Auth : AccountBenefits. */
  const handleSignUpClick = useCallback(async () => {
    setDrawerOpen(false);
    if (!isOnline()) {
      navigateToError(true, 'auth');
      return;
    }
    const res = await services.api.getUserQuestionCount();
    const bypass = res.ok && (res.data.bypass_interstitial ?? false);
    navigator.push(bypass ? { name: 'auth' } : { name: 'accountBenefits' });
  }, [navigateToError, navigator, services.api]);

  const handleLogout = useCallback(async () => {
    await services.session.logout();
    setShowNameUpdatedToast(false);
    setAuthTick((t) => t + 1);
    navigator.replaceAll({ name: 'splash' });
  }, [navigator, services.session]);

  // Programmatic openChat / openConversation / sendQuestion (deep-link semantics).
  const controllerOpenChat = useCallback(
    (question?: string, conversationId?: string) => {
      const target: PendingTarget = conversationId
        ? { type: 'chat', chatId: conversationId }
        : question
          ? { type: 'chatQuery', question, source: 'deeplink' }
          : { type: 'home' };
      const onboardingDone = services.store.getBool(PrefKeys.LANGUAGE_DONE, false);
      if (!onboardingDone) {
        // Onboarding incomplete → save pending target (docs/01 §1 captureIntentTarget).
        navigator.setPendingTarget(target);
        return;
      }
      if (target.type === 'chat') openChat({ source: 'history', conversationId: target.chatId });
      else if (target.type === 'chatQuery') openChat({ source: 'home', question: target.question });
      else navigator.replaceAll({ name: 'home' });
    },
    [navigator, openChat, services.store],
  );

  /** C4 — map a destination name to a navigation edge. */
  const openScreen = useCallback(
    (destination: string) => {
      switch (destination) {
        case 'home':
          navigator.replaceAll({ name: 'home' });
          break;
        case 'settings':
          if (services.config.showSettings) navigateDrawerRoute('settings');
          break;
        case 'settingsLanguage':
        case 'settings/language':
          navigateDrawerRoute('settings/language');
          break;
        case 'help':
          navigateDrawerRoute('help');
          break;
        case 'chatHistory':
          if (services.config.showHistory) navigateDrawerRoute('chatHistory');
          break;
        case 'chat':
          controllerOpenChat();
          break;
        // 2.0.0: land on Home, then ask it to open the in-app Terms-of-Use dialog. Same screen
        // key android-compose accepts (`SCREEN_TERMS_OF_USE = "termsofuse"`).
        //
        // CHAT_ONLY has no Home (docs/07 C3 — `routeFromSplash` lands straight in chat and
        // `ChatScreen.onClose` exits the SDK instead of popping to Home), and Home is what renders
        // the dialog. `replaceAll` would happily blow the chat away and strand the user on a
        // screen the mode excludes, so the request is ignored — the same silent-ignore the
        // neighbouring `settings` / `chatHistory` cases use when their config flag is off.
        // Recorded in docs/04.
        case 'termsofuse':
          if (services.config.mode !== 'CHAT_ONLY') {
            navigator.replaceAll({ name: 'home' });
            setTermsOfUseRequested(true);
          }
          break;
        default:
          break;
      }
    },
    [controllerOpenChat, navigateDrawerRoute, navigator, services.config.mode, services.config.showHistory, services.config.showSettings],
  );

  // External controller (FarmerChat.openChat / logout / programmatic API).
  useEffect(() => {
    props.onController?.({
      openChat: controllerOpenChat,
      logout: handleLogout,
      sendQuestion: (text: string) => controllerOpenChat(text),
      openConversation: (conversationId: string) => controllerOpenChat(undefined, conversationId),
      openScreen,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleLogout, controllerOpenChat, openScreen]);

  /** Error screen retry — per-fromScreen semantics (docs/01 §2 Error edge). */
  const onErrorTryAgain = useCallback(
    (fromScreen: string) => {
      const retry = retryActionRef.current;
      retryActionRef.current = null;
      switch (fromScreen) {
        case 'chatHistory':
          navigator.popUpToAndPush('home', false, { name: 'chatHistory' });
          retry?.();
          break;
        case 'auth':
          if (isOnline()) navigator.popUpToAndPush('home', false, { name: 'auth' });
          else navigator.pop();
          break;
        case 'help':
          navigator.pop();
          retry?.();
          break;
        case 'language':
        case 'name':
          navigator.replaceAll({ name: 'splash' });
          break;
        default:
          navigator.pop();
          retry?.();
          break;
      }
    },
    [navigator],
  );

  const current = navigator.current;
  const drawerVisible = services.config.showDrawer && DRAWER_ROUTES.has(current.name);
  const currentLanguage = services.store.getString(PrefKeys.SELECTED_LANGUAGE_DISPLAY_NAME) ?? services.labels.languageCode;
  const userName = services.store.getString(PrefKeys.USER_NAME);

  // Host theme → inline CSS custom properties for the active appearance (docs/07 Part B).
  const themeVars = useMemo(
    () => resolveThemeVars(services.config.theme, theme),
    [services.config.theme, theme],
  );
  // Chat UI customization → scoped CSS vars (undefined = stylesheet default).
  const chatVars = useMemo(() => {
    const c = services.config;
    const v: Record<string, string> = {};
    if (c.userBubbleColor) v['--fc-bubble-user'] = c.userBubbleColor;
    if (c.userBubbleTextColor) v['--fc-bubble-user-text'] = c.userBubbleTextColor;
    if (c.aiBubbleTextColor) v['--fc-bubble-ai-text'] = c.aiBubbleTextColor;
    if (c.bubbleCornerRadius != null) v['--fc-radius-bubble'] = `${c.bubbleCornerRadius}px`;
    if (c.messageFontSize != null) v['--fc-bubble-font-size'] = `${c.messageFontSize}px`;
    return v;
  }, [services.config]);
  const logo = services.config.theme?.logo;

  const ctx = useMemo(
    () => ({ services, navigator, toast, appearance, setAppearance, logo }),
    [services, navigator, toast, appearance, setAppearance, logo],
  );

  return (
    <SdkProvider value={ctx}>
      <div
        className={`fcsdk-root${props.inline ? ' fcsdk-root--inline' : ''}`}
        data-fc-theme={theme}
        style={{ ...themeVars, ...chatVars } as CSSProperties}
      >
        {renderScreen()}

        {drawerVisible ? (
          <Drawer
            open={drawerOpen}
            currentRoute={routeToDrawerKey(current.name)}
            onClose={() => setDrawerOpen(false)}
            onNavigate={navigateDrawerRoute}
            isAuthenticated={services.session.isAuthenticated()}
            onSeeAllClick={() => navigateDrawerRoute('chatHistory')}
            onSignUpClick={() => void handleSignUpClick()}
            currentLanguage={currentLanguage}
            previousQuestions={historyActions.recentQuestions(8)}
            historyErrorMessage={history.errorMessage}
            onRetryHistory={() => void historyActions.refreshSilently()}
            isLoadingHistory={history.isLoading}
            userName={userName}
            onOpenQuestion={(item) => {
              setDrawerOpen(false);
              services.analytics.track(Events.NEW_CHAT_CLICK_EVENT, { conversation_id: item.conversation_id ?? '', source: 'drawer' });
              // Drawer recent items are conversations — always opened by id
              // (the app's ConversationListItem has no free-text `question`).
              if (item.conversation_id) openChat({ source: 'history', conversationId: item.conversation_id });
            }}
          />
        ) : null}

        {legal ? <LegalContentModal url={legal.url} title={legal.title} onClose={() => setLegal(null)} /> : null}
        <LocationPromptOverlay state={locationState} actions={locationActions} />
      </div>
    </SdkProvider>
  );

  function renderScreen() {
    switch (current.name) {
      case 'splash':
        return <SplashScreen onReady={() => navigator.routeFromSplash()} />;
      case 'language':
        return (
          <LanguageSelectionScreen
            onLanguageSubmitted={() => navigator.routeFromSplash()}
            onOpenLegal={(url, title) => setLegal({ url, title })}
          />
        );
      case 'name':
        return <EnterNameScreen onDone={() => navigator.routeFromSplash()} />;
      case 'home':
        return (
          <HomeScreen
            onOpenDrawer={() => setDrawerOpen(true)}
            onOpenChat={openChat}
            locationActions={locationActions}
            openTermsOfUseRequested={termsOfUseRequested}
            onTermsOfUseRequestConsumed={() => setTermsOfUseRequested(false)}
          />
        );
      case 'chat':
        return (
          <ChatScreen
            params={current.params}
            onOpenDrawer={() => setDrawerOpen(true)}
            // 2.0.0: the GPS_PROMPT capability chip runs the ONE shared location flow (Compose
            // reads the same single `graph.locationPromptManager`), so its overlay and state
            // machine stay here.
            locationActions={locationActions}
            onClose={() => {
              // CHAT_ONLY has no Home — signal the host to exit/unmount the SDK
              // (host wires config.onExit); otherwise popUpTo(Home){!inclusive}.
              if (services.config.mode === 'CHAT_ONLY') {
                services.analytics.exit();
              } else {
                navigator.popUpToAndPush('home', true, { name: 'home' });
              }
            }}
          />
        );
      case 'chatHistory':
        return (
          <ChatHistoryScreen
            history={history}
            historyActions={historyActions}
            onOpenDrawer={() => setDrawerOpen(true)}
            onOpenChat={(conversationId) => openChat({ source: 'history', conversationId })}
            onNavigateToError={(isNetworkError) => navigateToError(isNetworkError, 'chatHistory', () => void historyActions.refresh())}
            onSignUpClick={() => void handleSignUpClick()}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            onOpenDrawer={() => setDrawerOpen(true)}
            onNameClick={() => navigator.push({ name: 'settingsName' })}
            onSignUpClick={() => void handleSignUpClick()}
            onLogOutClick={() => void handleLogout()}
            showNameUpdatedToast={showNameUpdatedToast}
            onToastConsumed={() => setShowNameUpdatedToast(false)}
          />
        );
      case 'settingsName':
        return (
          <SettingsNameScreen
            onBack={() => navigator.pop()}
            onSaveComplete={() => {
              setShowNameUpdatedToast(true);
              navigator.pop();
            }}
          />
        );
      case 'settingsLanguage':
        return (
          <LanguageChooserScreen
            onOpenDrawer={() => setDrawerOpen(true)}
            onLanguageSaved={() => navigator.replaceAll({ name: 'home' })}
            onFetchLabelsFailure={() => navigator.popUpToAndPush('home', true, { name: 'home' })}
          />
        );
      case 'help':
        return (
          <HelpScreen
            onOpenDrawer={() => setDrawerOpen(true)}
            onOpenUrl={(_kind, url, title) => setLegal({ url, title })}
            onNavigateToError={(isNetworkError, retry) => navigateToError(isNetworkError, 'help', retry)}
          />
        );
      case 'accountBenefits':
        return (
          <AccountBenefitsScreen
            onSignUp={() => {
              if (!isOnline()) navigateToError(true, 'auth');
              else navigator.push({ name: 'auth' });
            }}
            onSkip={() => navigator.pop()}
          />
        );
      case 'auth':
        return (
          <AuthScreen
            onSuccess={() => {
              setAuthTick((t) => t + 1);
              // popUpTo(Auth){inclusive} → AccountSuccess, singleTop.
              navigator.popUpToAndPush('auth', true, { name: 'accountSuccess' });
            }}
            onClose={() => navigator.pop()}
            onOpenLegal={(url, title) => setLegal({ url, title })}
          />
        );
      case 'accountSuccess':
        return (
          <AccountSuccessScreen
            onContinue={() => {
              // Continue/back → Home, popUpTo(AccountBenefits){inclusive}.
              navigator.replaceAll({ name: 'home' });
            }}
          />
        );
      case 'error':
        return (
          <ErrorScreen
            isNetworkError={current.params.isNetworkError}
            fromScreen={current.params.fromScreen}
            onTryAgain={() => onErrorTryAgain(current.params.fromScreen)}
          />
        );
      default:
        return null;
    }
  }
}

function routeToDrawerKey(name: string): string {
  return name === 'settingsLanguage' ? 'settings/language' : name;
}
