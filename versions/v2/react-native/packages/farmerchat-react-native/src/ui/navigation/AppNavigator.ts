/**
 * AppNavigator — port of the app's `AppNavigator` (docs/01 §2):
 * `routeFromSplash()` decision tree, pending-target consumption and the
 * `popUpTo(0){inclusive}` reset semantics via navigation resets.
 */
import {
  CommonActions,
  createNavigationContainerRef,
  StackActions,
  type NavigationContainerRef,
} from '@react-navigation/native';
import type { FarmerChatScreen, FarmerChatSdk, PendingTarget } from '../../core/sdk';
import type { ChatRouteParams, DrawerParamList, RootStackParamList } from './types';

/** Maps a public C4 screen destination to an internal stack route. */
function screenToRoute(destination: FarmerChatScreen): keyof RootStackParamList {
  switch (destination) {
    case 'home':
      return 'Home';
    case 'chat':
      return 'Chat';
    case 'history':
      return 'ChatHistory';
    case 'settings':
      return 'Settings';
    case 'language':
      return 'SettingsLanguage';
    case 'help':
      return 'Help';
    // 2.0.0: the terms surface is a dialog owned by Home, not a route of its own — the
    // request lands on Home and `onTermsOfUseRequested` raises the dialog there.
    case 'termsofuse':
      return 'Home';
  }
}

export type RootNavigationRef = NavigationContainerRef<DrawerParamList>;

export function createRootNavigationRef() {
  return createNavigationContainerRef<DrawerParamList>();
}

interface NavAction {
  type: string;
  [key: string]: unknown;
}

export class AppNavigator {
  constructor(
    private readonly navRef: RootNavigationRef,
    private readonly sdk: FarmerChatSdk,
  ) {}

  /** The root navigator is the Drawer; stack actions target the nested stack. */
  private stackKey(): string | undefined {
    if (!this.navRef.isReady()) return undefined;
    const root = this.navRef.getRootState() as unknown as {
      index?: number;
      routes?: Array<{ state?: { key?: string } }>;
    };
    const main = root?.routes?.[root.index ?? 0];
    return main?.state?.key;
  }

  private dispatchToStack(action: NavAction): void {
    if (!this.navRef.isReady()) return;
    const key = this.stackKey();
    this.navRef.dispatch(
      key ? ({ ...action, target: key } as never) : (action as never),
    );
  }

  private resetTo(
    routes: Array<{ name: keyof RootStackParamList; params?: object }>,
  ): void {
    this.dispatchToStack(
      CommonActions.reset({
        index: routes.length - 1,
        routes: routes as never,
      }) as NavAction,
    );
  }

  /**
   * routeFromSplash() decision tree (docs/01 §2 AppNavigator):
   *  1. !isLanguageSelected → Language
   *  2. !isProfileDone && !hasSeenNameScreenOnce → Name
   *     (the app consults RemoteConfig show_name_screen; the SDK has no Remote
   *      Config — the name screen is always part of the flow, docs/03 §screens)
   *  3. else consume PendingTarget → Chat / ChatQuery / Gps(Home) / Home
   * All with popUpTo(0){inclusive} (reset).
   */
  routeFromSplash(): void {
    // CHAT_ONLY (C3): skip onboarding + home and land straight in chat.
    if (this.sdk.config.mode === 'CHAT_ONLY') {
      const target = this.sdk.consumePendingTarget();
      if (target && target.kind !== 'home' && target.kind !== 'gps') {
        this.routePendingTarget(target);
        return;
      }
      this.resetTo([{ name: 'Chat', params: { source: 'home' } satisfies ChatRouteParams }]);
      return;
    }
    if (!this.sdk.isLanguageSelected) {
      this.resetTo([{ name: 'Language' }]);
      return;
    }
    if (!this.sdk.isProfileDone && !this.sdk.hasSeenNameScreenOnce) {
      this.resetTo([{ name: 'Name' }]);
      return;
    }
    const target = this.sdk.consumePendingTarget();
    if (target) {
      this.routePendingTarget(target);
      return;
    }
    this.resetTo([{ name: 'Home' }]);
  }

  private routePendingTarget(target: PendingTarget): void {
    switch (target.kind) {
      case 'chat':
        this.resetTo([
          { name: 'Home' },
          {
            name: 'Chat',
            params: {
              source: 'history',
              conversationId: target.chatId,
            } satisfies ChatRouteParams,
          },
        ]);
        break;
      case 'chatQuery':
        this.resetTo([
          { name: 'Home' },
          {
            name: 'Chat',
            params: {
              source: target.source,
              question: target.question,
              channel: target.channel ?? undefined,
            } satisfies ChatRouteParams,
          },
        ]);
        break;
      case 'screen':
        this.openScreenTarget(target.destination);
        break;
      case 'gps':
      case 'home':
        this.resetTo([{ name: 'Home' }]);
        break;
    }
  }

  /**
   * Raised when a `'termsofuse'` screen target is routed, so the graph can open Home's in-app
   * Terms-of-Use dialog. Set by `AppNavGraph`; mirrors Compose's `termsOfUseRequested` flag
   * threaded from `FarmerChatRoot` into `HomeScreen`.
   */
  onTermsOfUseRequested: (() => void) | null = null;

  /** Programmatic C4 navigation to a top-level screen. */
  openScreenTarget(destination: FarmerChatScreen): void {
    if (destination === 'chat') {
      this.resetTo([{ name: 'Home' }, { name: 'Chat', params: { source: 'home' } satisfies ChatRouteParams }]);
      return;
    }
    this.navigateDrawerRoute(screenToRoute(destination));
    // Home is already the route above; raising the flag AFTER the navigation means the
    // dialog opens on the Home that is now on screen.
    if (destination === 'termsofuse') this.onTermsOfUseRequested?.();
  }

  navigateToChat(params: ChatRouteParams): void {
    this.dispatchToStack(StackActions.push('Chat', params) as NavAction);
  }

  /** Chat close (Home entry): popUpTo(Home){!inclusive} + singleTop. */
  navigateChatCloseToHome(): void {
    if (!this.navRef.isReady()) return;
    // CHAT_ONLY (C3): there is no Home to return to — signal the host to
    // exit/unmount the SDK (host wires config.onExit).
    if (this.sdk.config.mode === 'CHAT_ONLY') {
      this.sdk.analytics.fireCallback('onExit');
      return;
    }
    const state = this.navRef.getRootState();
    const routes = collectStackRoutes(state);
    if (routes.some((r) => r === 'Home')) {
      this.dispatchToStack(StackActions.popTo('Home') as NavAction);
    } else {
      this.resetTo([{ name: 'Home' }]);
    }
  }

  /** Drawer route: popUpTo(startDestinationId) + singleTop equivalent. */
  navigateDrawerRoute(route: keyof RootStackParamList): void {
    if (!this.navRef.isReady()) return;
    if (route === 'Home') {
      this.resetTo([{ name: 'Home' }]);
    } else {
      this.resetTo([{ name: 'Home' }, { name: route }]);
    }
  }

  /** Auth success: AccountSuccess with popUpTo(Auth){inclusive}. */
  navigateAuthSuccess(): void {
    if (!this.navRef.isReady()) return;
    const state = this.navRef.getRootState();
    const routes = collectStackRoutes(state);
    const preserved: Array<{ name: keyof RootStackParamList }> = [];
    for (const name of routes) {
      if (name === 'Auth') break;
      preserved.push({ name: name as keyof RootStackParamList });
    }
    this.resetTo([...preserved, { name: 'AccountSuccess' }]);
  }

  /** AccountSuccess continue: Home with popUpTo(AccountBenefits){inclusive}. */
  navigateAccountSuccessToHome(): void {
    this.resetTo([{ name: 'Home' }]);
  }

  /** SettingsLanguage saved: Home with popUpTo(0){inclusive}. */
  navigateLanguageSavedToHome(): void {
    this.resetTo([{ name: 'Home' }]);
  }

  /** Logout: Splash with popUpTo(0){inclusive}. */
  navigateLogoutToSplash(): void {
    this.resetTo([{ name: 'Splash' }]);
  }

  navigate<Name extends keyof RootStackParamList>(
    name: Name,
    params?: RootStackParamList[Name],
  ): void {
    this.dispatchToStack(
      CommonActions.navigate({ name, params }) as NavAction,
    );
  }

  push<Name extends keyof RootStackParamList>(
    name: Name,
    params?: RootStackParamList[Name],
  ): void {
    this.dispatchToStack(StackActions.push(name, params) as NavAction);
  }

  popBackStack(): void {
    if (this.navRef.isReady() && this.navRef.canGoBack()) this.navRef.goBack();
  }

  currentRouteName(): string | null {
    if (!this.navRef.isReady()) return null;
    return this.navRef.getCurrentRoute()?.name ?? null;
  }
}

interface NavStateLike {
  routes?: Array<{ name: string; state?: NavStateLike }>;
}

/** Flattens nested navigator state into stack route names, in order. */
function collectStackRoutes(state: NavStateLike | undefined): string[] {
  if (!state?.routes) return [];
  const names: string[] = [];
  for (const route of state.routes) {
    if (route.state) {
      names.push(...collectStackRoutes(route.state));
    } else {
      names.push(route.name);
    }
  }
  return names;
}
