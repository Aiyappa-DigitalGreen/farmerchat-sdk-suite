/**
 * AppNavGraph (docs/01 §2) — Drawer (shared across Home/Chat/Settings/Help/
 * SettingsLanguage/ChatHistory) wrapping the native stack with every route
 * from Destination.kt; graph-level state (drawer language, username, auth,
 * name-updated toast, shared chatHistory VM); ErrorNavigationManager events →
 * Error route; sign-up funnel via getUserQuestionCount().
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  createDrawerNavigator,
  type DrawerNavigationProp,
} from '@react-navigation/drawer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AnalyticsEvents } from '../../core/analytics';
import { addOpenChatListener } from '../../FarmerChat';
import type { FarmerChatSdk } from '../../core/sdk';
import { StorageKeys } from '../../core/sessionStore';
import { useSdk } from '../context';
import { useChatHistory } from '../../state/useChatHistory';
import { useLocationPrompt } from '../../state/useLocationPrompt';
import { AppNavigator, createRootNavigationRef } from './AppNavigator';
import { AppDrawerContent } from './DrawerContent';
import { ErrorNavigationManager } from './errorManager';
import type { DrawerParamList, RootStackParamList } from './types';
import { SplashScreen } from '../screens/SplashScreen';
import { LanguageSelectionScreen } from '../screens/LanguageSelectionScreen';
import { EnterNameScreen } from '../screens/EnterNameScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ChatHistoryScreen } from '../screens/ChatHistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SettingsNameScreen } from '../screens/SettingsNameScreen';
import { LanguageChooserScreen } from '../screens/LanguageChooserScreen';
import { HelpScreen } from '../screens/HelpScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { AccountBenefitsScreen, AccountSuccessScreen } from '../screens/AccountScreens';
import { ErrorScreen } from '../screens/ErrorScreen';
import { LegalContentScreen } from '../screens/LegalContentScreen';
import { LocationPromptHost } from '../screens/LocationPromptHost';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

interface GraphContextValue {
  sdk: FarmerChatSdk;
  appNavigator: AppNavigator;
  errorManager: ErrorNavigationManager;
  chatHistory: ReturnType<typeof useChatHistory>;
  locationPrompt: ReturnType<typeof useLocationPrompt>;
  openDrawer: () => void;
  showNameUpdatedToast: boolean;
  setShowNameUpdatedToast: (value: boolean) => void;
  handleSignUpClick: () => void;
  handleLogout: () => void;
  handleSeeAll: () => void;
  /**
   * 2.0.0: `FarmerChat.openScreen('termsofuse')` landed on Home and asked for the in-app
   * Terms-of-Use dialog. Mirrors Compose's `openTermsOfUseRequested` flag threaded from
   * `FarmerChatRoot` into `HomeScreen`; cleared through `consumeTermsOfUseRequest`.
   */
  termsOfUseRequested: boolean;
  consumeTermsOfUseRequest: () => void;
}

const GraphContext = React.createContext<GraphContextValue | null>(null);

function useGraph(): GraphContextValue {
  const value = React.useContext(GraphContext);
  if (!value) throw new Error('[FarmerChat] Graph context missing');
  return value;
}

export function AppNavGraph(): React.ReactElement {
  const sdk = useSdk();
  const navRef = useMemo(() => createRootNavigationRef(), []);
  const appNavigator = useMemo(() => new AppNavigator(navRef, sdk), [navRef, sdk]);
  const errorManager = useMemo(() => new ErrorNavigationManager(), []);
  const chatHistory = useChatHistory(sdk);
  const locationPrompt = useLocationPrompt(sdk);
  const [currentRoute, setCurrentRoute] = useState<string | null>('Splash');
  const [isAuthenticated, setIsAuthenticated] = useState(sdk.session.isAuthenticated);
  const [showNameUpdatedToast, setShowNameUpdatedToast] = useState(false);
  // 2.0.0 in-app Terms-of-Use dialog. Raised by AppNavigator when a `'termsofuse'` screen
  // target is routed (see `openScreenTarget`), consumed by HomeScreen once acted on so a
  // later terms fetch can never re-open the dialog unprompted.
  const [termsOfUseRequested, setTermsOfUseRequested] = useState(false);
  const drawerNavRef = useRef<DrawerNavigationProp<DrawerParamList> | null>(null);

  // errorEvents → Error route (singleTop)
  useEffect(
    () =>
      errorManager.addListener((event) => {
        appNavigator.push('Error', {
          isNetworkError: event.isNetworkError,
          fromScreen: event.fromScreen,
        });
      }),
    [appNavigator, errorManager],
  );

  // FarmerChat.openChat while mounted → consume the pending target immediately
  // once onboarding is complete (captureIntentTarget equivalent, docs/01 §1).
  useEffect(
    () =>
      addOpenChatListener(() => {
        const route = navRef.isReady() ? navRef.getCurrentRoute()?.name : null;
        const onboardingDone =
          sdk.config.mode === 'CHAT_ONLY'
            ? route !== 'Splash'
            : sdk.isLanguageSelected &&
              route !== 'Splash' &&
              route !== 'Language' &&
              route !== 'Name';
        if (!onboardingDone) return; // stays pending; routeFromSplash consumes it
        const target = sdk.consumePendingTarget();
        if (!target) return;
        if (target.kind === 'chat') {
          appNavigator.navigateToChat({ source: 'history', conversationId: target.chatId });
        } else if (target.kind === 'chatQuery') {
          appNavigator.navigateToChat({
            source: target.source,
            question: target.question,
            channel: target.channel ?? undefined,
          });
        } else if (target.kind === 'screen') {
          appNavigator.openScreenTarget(target.destination);
        } else {
          appNavigator.navigateDrawerRoute('Home');
        }
      }),
    [appNavigator, navRef, sdk],
  );

  // auth-state changes re-sync + refresh chat history (docs/01 §2 graph effects)
  useEffect(
    () =>
      sdk.session.addAuthStateListener((authed) => {
        setIsAuthenticated(authed);
        if (authed) chatHistory.refresh();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sdk],
  );

  useEffect(() => {
    if (isAuthenticated) chatHistory.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    appNavigator.onTermsOfUseRequested = () => setTermsOfUseRequested(true);
    return () => {
      appNavigator.onTermsOfUseRequested = null;
    };
  }, [appNavigator]);

  const consumeTermsOfUseRequest = useCallback(() => setTermsOfUseRequested(false), []);

  const openDrawer = useCallback(() => {
    drawerNavRef.current?.openDrawer();
  }, []);

  const closeDrawer = useCallback(() => {
    drawerNavRef.current?.closeDrawer();
  }, []);

  // Drawer/Settings sign-up: getUserQuestionCount → bypass_interstitial?Auth:AccountBenefits
  const handleSignUpClick = useCallback(() => {
    closeDrawer();
    void sdk.api.getUserQuestionCount().then((result) => {
      if (result.ok && result.data.bypass_interstitial === true) {
        appNavigator.push('Auth');
      } else if (result.ok) {
        appNavigator.push('AccountBenefits');
      } else if (result.isNetworkError || result.isTimeout) {
        appNavigator.push('Error', { isNetworkError: true, fromScreen: 'auth' });
      } else {
        appNavigator.push('AccountBenefits');
      }
    });
  }, [appNavigator, closeDrawer, sdk]);

  // Settings logout: logoutApp + prefClearAll (preserve appearance) → Splash popUpTo(0)
  const handleLogout = useCallback(() => {
    void sdk.session.logout().then(() => {
      // Silent reset: an emission here would settle an armed chat surface the farmer never
      // triggered.
      locationPrompt.clearState();
      appNavigator.navigateLogoutToSplash();
    });
  }, [appNavigator, locationPrompt, sdk]);

  // "See all": offline → Error(fromScreen=chatHistory), else ChatHistory
  const handleSeeAll = useCallback(() => {
    closeDrawer();
    sdk.analytics.track(AnalyticsEvents.CHAT_HISTORY_CLICK_EVENT, {});
    if (chatHistory.state.isNetworkError && chatHistory.state.errorMessage !== null) {
      appNavigator.push('Error', { isNetworkError: true, fromScreen: 'chatHistory' });
    } else {
      appNavigator.navigateDrawerRoute('ChatHistory');
    }
  }, [appNavigator, chatHistory.state, closeDrawer, sdk]);

  const graphValue = useMemo<GraphContextValue>(
    () => ({
      sdk,
      appNavigator,
      errorManager,
      chatHistory,
      locationPrompt,
      openDrawer,
      showNameUpdatedToast,
      setShowNameUpdatedToast,
      handleSignUpClick,
      handleLogout,
      handleSeeAll,
      termsOfUseRequested,
      consumeTermsOfUseRequest,
    }),
    [
      sdk,
      appNavigator,
      errorManager,
      chatHistory,
      locationPrompt,
      openDrawer,
      showNameUpdatedToast,
      handleSignUpClick,
      handleLogout,
      handleSeeAll,
      termsOfUseRequested,
      consumeTermsOfUseRequest,
    ],
  );

  // App HomeScreen.kt:258-266: a location Error while Home is the visible screen goes to the
  // shared Error screen (network flag = NoNetwork, fromScreen "home") and the flow is closed
  // WITHOUT a Continue. Done here rather than in HomeScreen because Home stays mounted under Chat
  // in the native stack — keyed on the visible route, a chat-chip GPS error is never swallowed.
  const locationState = locationPrompt.state;
  useEffect(() => {
    if (locationState.kind !== 'Error' || currentRoute !== 'Home') return;
    errorManager.navigateToError(locationState.errorType === 'NoNetwork', 'home', () => undefined);
    locationPrompt.dismiss(false);
  }, [currentRoute, errorManager, locationPrompt, locationState]);

  const currentLanguage = sdk.store.getString(
    StorageKeys.SELECTED_LANGUAGE_DISPLAY_NAME,
  );

  return (
    <GraphContext.Provider value={graphValue}>
      <NavigationContainer
        ref={navRef}
        onStateChange={() => {
          const route = navRef.getCurrentRoute()?.name ?? null;
          setCurrentRoute(route);
          if (route) errorManager.setActiveScreen(routeToScreenId(route));
          setIsAuthenticated(sdk.session.isAuthenticated);
        }}
      >
        <Drawer.Navigator
          screenOptions={{
            headerShown: false,
            swipeEnabled: false,
            drawerStyle: { width: 300 },
          }}
          drawerContent={() => (
            <AppDrawerContent
              currentRoute={currentRoute}
              isAuthenticated={isAuthenticated}
              currentLanguage={currentLanguage}
              previousQuestions={chatHistory.recentQuestions()}
              historyErrorMessage={chatHistory.state.errorMessage}
              isLoadingHistory={chatHistory.state.isLoading}
              onRetryHistory={() => chatHistory.refresh()}
              onSeeAllClick={handleSeeAll}
              onSignUpClick={handleSignUpClick}
              showSettings={sdk.config.showSettings}
              showHistory={sdk.config.showHistory}
              onNavigate={(route) => {
                closeDrawer();
                sdk.analytics.track(AnalyticsEvents.MENU_OPTION_CLICK_EVENT, { route });
                switch (route) {
                  case 'home':
                    appNavigator.navigateDrawerRoute('Home');
                    break;
                  case 'settings':
                    appNavigator.navigateDrawerRoute('Settings');
                    break;
                  case 'settings/language':
                    appNavigator.navigateDrawerRoute('SettingsLanguage');
                    break;
                  case 'help':
                    appNavigator.navigateDrawerRoute('Help');
                    break;
                  case 'chatHistory':
                    handleSeeAll();
                    break;
                }
              }}
              onOpenQuestion={(q) => {
                closeDrawer();
                appNavigator.navigateToChat({
                  source: 'history',
                  conversationId: q.conversationId,
                });
              }}
            />
          )}
        >
          <Drawer.Screen name="Main">
            {(drawerProps) => {
              drawerNavRef.current = drawerProps.navigation;
              return <MainStack />;
            }}
          </Drawer.Screen>
        </Drawer.Navigator>
      </NavigationContainer>
      <LocationPromptHost prompt={locationPrompt} suppressError={currentRoute === 'Home'} />
    </GraphContext.Provider>
  );
}

/** Maps route names to ErrorNavigationManager screen ids. */
function routeToScreenId(route: string): string {
  switch (route) {
    case 'Language':
      return 'language';
    case 'Name':
      return 'name';
    case 'Home':
      return 'home';
    case 'ChatHistory':
      return 'chatHistory';
    case 'Help':
      return 'help';
    case 'Auth':
    case 'AccountBenefits':
      return 'auth';
    default:
      return route.toLowerCase();
  }
}

// ---------------------------------------------------------------------------
// Stack
// ---------------------------------------------------------------------------

function MainStack(): React.ReactElement {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 500 }}
    >
      <Stack.Screen name="Splash" component={SplashRoute} />
      <Stack.Screen name="Language" component={LanguageRoute} />
      <Stack.Screen name="Name" component={NameRoute} />
      <Stack.Screen name="Home" component={HomeRoute} />
      <Stack.Screen name="Chat" component={ChatRoute} />
      <Stack.Screen name="ChatHistory" component={ChatHistoryRoute} />
      <Stack.Screen name="Settings" component={SettingsRoute} />
      <Stack.Screen name="SettingsName" component={SettingsNameRoute} />
      <Stack.Screen name="SettingsLanguage" component={SettingsLanguageRoute} />
      <Stack.Screen name="Help" component={HelpRoute} />
      <Stack.Screen name="Auth" component={AuthRoute} />
      <Stack.Screen name="AccountBenefits" component={AccountBenefitsRoute} />
      <Stack.Screen name="AccountSuccess" component={AccountSuccessRoute} />
      <Stack.Screen name="Error" component={ErrorRoute} />
      <Stack.Screen
        name="LegalContent"
        component={LegalContentRoute}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Route wrappers
// ---------------------------------------------------------------------------

function SplashRoute(): React.ReactElement {
  const { appNavigator, errorManager } = useGraph();
  return (
    <SplashScreen
      errorManager={errorManager}
      onReady={() => appNavigator.routeFromSplash()}
    />
  );
}

function LanguageRoute(): React.ReactElement {
  const { appNavigator, errorManager } = useGraph();
  return (
    <LanguageSelectionScreen
      onLanguageSubmitted={() => appNavigator.routeFromSplash()}
      onOpenLegal={(url, title) => appNavigator.push('LegalContent', { url, title })}
      onNavigateToError={(isNetworkError, fromScreen, retry) =>
        errorManager.navigateToError(isNetworkError, fromScreen, retry)
      }
    />
  );
}

function NameRoute(): React.ReactElement {
  const { appNavigator } = useGraph();
  return <EnterNameScreen onDone={() => appNavigator.routeFromSplash()} />;
}

function HomeRoute(): React.ReactElement {
  const {
    appNavigator,
    errorManager,
    locationPrompt,
    openDrawer,
    termsOfUseRequested,
    consumeTermsOfUseRequest,
  } = useGraph();
  return (
    <HomeScreen
      onOpenDrawer={openDrawer}
      onNavigateToChat={(params) => appNavigator.navigateToChat(params)}
      locationPrompt={locationPrompt}
      onNavigateToError={(isNetworkError, fromScreen, retry) =>
        errorManager.navigateToError(isNetworkError, fromScreen, retry)
      }
      openTermsOfUseRequested={termsOfUseRequested}
      onTermsOfUseRequestConsumed={consumeTermsOfUseRequest}
    />
  );
}

function ChatRoute(
  props: NativeStackScreenProps<RootStackParamList, 'Chat'>,
): React.ReactElement {
  const { appNavigator, locationPrompt, openDrawer } = useGraph();
  return (
    <ChatScreen
      params={props.route.params ?? {}}
      onClose={() => appNavigator.navigateChatCloseToHome()}
      onOpenDrawer={openDrawer}
      // 2.0.0: the `gps-prompt` capability chip drives the SHARED location flow, so the prompt
      // host's overlay renders its permission / fetch / recovery UI.
      locationPrompt={locationPrompt}
    />
  );
}

function ChatHistoryRoute(): React.ReactElement {
  const { appNavigator, chatHistory, openDrawer } = useGraph();
  return (
    <ChatHistoryScreen
      history={chatHistory}
      onOpenDrawer={openDrawer}
      onOpenChatFromHistory={(conversationId) =>
        appNavigator.navigateToChat({ source: 'history', conversationId })
      }
      onNavigateToError={(isNetworkError) =>
        appNavigator.push('Error', { isNetworkError, fromScreen: 'chatHistory' })
      }
    />
  );
}

function SettingsRoute(): React.ReactElement {
  const {
    appNavigator,
    openDrawer,
    handleSignUpClick,
    handleLogout,
    showNameUpdatedToast,
    setShowNameUpdatedToast,
    locationPrompt,
  } = useGraph();
  return (
    <SettingsScreen
      locationPrompt={locationPrompt}
      onOpenDrawer={openDrawer}
      onNameClick={() => appNavigator.push('SettingsName')}
      onSignUpClick={handleSignUpClick}
      onLogOutClick={handleLogout}
      showNameUpdatedToast={showNameUpdatedToast}
      onNameToastShown={() => setShowNameUpdatedToast(false)}
    />
  );
}

function SettingsNameRoute(): React.ReactElement {
  const { appNavigator, setShowNameUpdatedToast } = useGraph();
  return (
    <SettingsNameScreen
      onBack={() => appNavigator.popBackStack()}
      onSaveComplete={() => {
        setShowNameUpdatedToast(true);
        appNavigator.popBackStack();
      }}
    />
  );
}

function SettingsLanguageRoute(): React.ReactElement {
  const { appNavigator, openDrawer } = useGraph();
  return (
    <LanguageChooserScreen
      onOpenDrawer={openDrawer}
      onLanguageSaved={() => appNavigator.navigateLanguageSavedToHome()}
      onFetchLabelsFailure={() => appNavigator.navigateDrawerRoute('Home')}
    />
  );
}

function HelpRoute(): React.ReactElement {
  const { appNavigator, errorManager, openDrawer } = useGraph();
  return (
    <HelpScreen
      onOpenDrawer={openDrawer}
      onOpenUrl={(url, title) => appNavigator.push('LegalContent', { url, title })}
      onNavigateToError={(isNetworkError, retry) =>
        errorManager.navigateToError(isNetworkError, 'help', retry)
      }
    />
  );
}

function AuthRoute(): React.ReactElement {
  const { appNavigator } = useGraph();
  return (
    <AuthScreen
      onSuccess={() => {
        // OTP_VERIFIED / PHONE_NUMBER_LOGIN / KEY_NAME_SCREEN_SEEN saved by
        // SessionManager.completeOtpLogin; popUpTo(Auth){inclusive} → AccountSuccess
        appNavigator.navigateAuthSuccess();
      }}
      onClose={() => appNavigator.popBackStack()}
      onOpenLegal={(url, title) => appNavigator.push('LegalContent', { url, title })}
    />
  );
}

function AccountBenefitsRoute(): React.ReactElement {
  const { appNavigator } = useGraph();
  return (
    <AccountBenefitsScreen
      // Offline detection without a NetInfo dependency happens inside the Auth
      // flow itself (send-OTP network errors surface a toast / error screen).
      onSignUp={() => appNavigator.push('Auth')}
      onSkip={() => appNavigator.popBackStack()}
    />
  );
}

function AccountSuccessRoute(): React.ReactElement {
  const { appNavigator } = useGraph();
  return (
    <AccountSuccessScreen
      onContinue={() => appNavigator.navigateAccountSuccessToHome()}
    />
  );
}

function ErrorRoute(
  props: NativeStackScreenProps<RootStackParamList, 'Error'>,
): React.ReactElement {
  const { appNavigator, errorManager } = useGraph();
  const params = props.route.params ?? {};
  const fromScreen = params.fromScreen ?? '';
  return (
    <ErrorScreen
      isNetworkError={params.isNetworkError ?? true}
      fromScreen={fromScreen}
      onTryAgain={() => {
        // per-fromScreen retry semantics (docs/01 §2): pop back to the origin,
        // then re-run the failed action via the retained retry action.
        switch (fromScreen) {
          case 'chatHistory':
            appNavigator.popBackStack();
            appNavigator.navigateDrawerRoute('ChatHistory');
            break;
          case 'auth':
            appNavigator.popBackStack();
            appNavigator.push('Auth');
            break;
          default:
            appNavigator.popBackStack();
            break;
        }
        errorManager.retryLastAction();
      }}
    />
  );
}

function LegalContentRoute(
  props: NativeStackScreenProps<RootStackParamList, 'LegalContent'>,
): React.ReactElement {
  const { appNavigator } = useGraph();
  return (
    <LegalContentScreen
      url={props.route.params.url}
      title={props.route.params.title}
      onClose={() => appNavigator.popBackStack()}
    />
  );
}
