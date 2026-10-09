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

  private get isChatOnly(): boolean {
    return this.sdk.config.mode === 'CHAT_ONLY';
  }

  /**
   * Prefixes the journey root. FULL_JOURNEY keeps Home at the bottom of every stack (the app's
   * start destination). CHAT_ONLY has no Home, so the requested routes ARE the stack — otherwise
   * a back press would surface the dashboard CHAT_ONLY hides (views `NavRoutes.navigateChatOnly`).
   */
  private withRoot(
    routes: Array<{ name: keyof RootStackParamList; params?: object }>,
  ): Array<{ name: keyof RootStackParamList; params?: object }> {
    if (!this.isChatOnly) return [{ name: 'Home' }, ...routes];
    return routes.length > 0
      ? routes
      : [{ name: 'Chat', params: { source: 'home' } satisfies ChatRouteParams }];
  }

  /**
   * routeFromSplash() decision tree (docs/01 §2 AppNavigator):
   *  1. !isLanguageSelected → Language
   *  2. !isProfileDone && !hasSeenNameScreenOnce → Name, unless
   *     `FarmerChatConfig.showNameScreen` is false, which stands in for the app's
   *     `show_name_screen` RemoteConfig flag (the SDK has no Remote Config). When
   *     false the profile is marked done and the step is skipped — matching Android
   *     `RouteDecider.routeFromSplash`.
   *  3. else consume PendingTarget → Chat / ChatQuery / Gps(Home) / Home
   * All with popUpTo(0){inclusive} (reset).
   *
   * CHAT_ONLY (C3): no Name / Home. The language screen shows once, on a first launch
   * (`LANGUAGE_DONE` false and no host `languageCode`/`locale`); its "submitted" callback re-runs
   * this decision, which then lands in chat. The pending target is not consumed while routing to
   * Language, so it survives the screen and is honoured on the way to chat.
   */
  routeFromSplash(): void {
    if (this.sdk.config.mode === 'CHAT_ONLY') {
      if (this.sdk.chatOnlyNeedsLanguageScreen) {
        this.resetTo([{ name: 'Language' }]);
        return;
      }
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
      if (this.sdk.config.showNameScreen) {
        this.resetTo([{ name: 'Name' }]);
        return;
      }
      // Host suppressed the step: mark the profile done and fall through so a later
      // launch does not re-evaluate it. Android does the same in RouteDecider:90.
      this.sdk.markProfileDone();
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
        this.resetTo(this.withRoot([
          {
            name: 'Chat',
            params: {
              source: 'history',
              conversationId: target.chatId,
            } satisfies ChatRouteParams,
          },
        ]));
        break;
      case 'chatQuery':
        this.resetTo(this.withRoot([
          {
            name: 'Chat',
            params: {
              source: target.source,
              question: target.question,
              channel: target.channel ?? undefined,
            } satisfies ChatRouteParams,
          },
        ]));
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
      this.resetTo(this.withRoot([{ name: 'Chat', params: { source: 'home' } satisfies ChatRouteParams }]));
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

  /**
   * Drawer route: popUpTo(startDestinationId) + singleTop equivalent. In CHAT_ONLY the start
   * destination is a fresh chat, so `Home` maps to it and other routes become the stack root.
   */
  navigateDrawerRoute(route: keyof RootStackParamList): void {
    if (!this.navRef.isReady()) return;
    if (route === 'Home') {
      this.resetTo(this.withRoot([]).slice(0, 1));
    } else {
      this.resetTo(this.withRoot([{ name: route }]));
    }
  }

  /**
   * Drawer-off back (C3 `showDrawer=false`): the screen's left button pops instead of opening a
   * suppressed drawer. With nothing to pop — the screen is the journey root, e.g. a CHAT_ONLY
   * `openScreen` — CHAT_ONLY hands control back to the host (`onExit`, as chat close does) and
   * FULL_JOURNEY returns to Home. Android views: `popBackStack() || exitJourney()`.
   */
  navigateBackOrExit(): void {
    if (!this.navRef.isReady()) return;
    if (collectStackRoutes(this.navRef.getRootState()).length > 1) {
      this.dispatchToStack(StackActions.pop() as NavAction);
      return;
    }
    if (this.isChatOnly) {
      this.sdk.analytics.fireCallback('onExit');
      return;
    }
    this.resetTo([{ name: 'Home' }]);
  }

  /**
   * SettingsLanguage saved. FULL_JOURNEY: Home with popUpTo(0){inclusive}. CHAT_ONLY has no Home,
   * so it returns to the chat the language screen was opened from (or a fresh one).
   */
  navigateLanguageSaved(): void {
    if (!this.isChatOnly) {
      this.navigateLanguageSavedToHome();
      return;
    }
    if (!this.navRef.isReady()) return;
    if (collectStackRoutes(this.navRef.getRootState()).includes('Chat')) {
      this.dispatchToStack(StackActions.popTo('Chat') as NavAction);
    } else {
      this.resetTo(this.withRoot([]));
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
