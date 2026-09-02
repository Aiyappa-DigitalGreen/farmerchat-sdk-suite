/**
 * Internal view-router reproducing the app's navigation graph
 * (docs/01 §2: Destination.kt, AppNavGraph edges, AppNavigator.routeFromSplash).
 * Implemented as a route stack with popUpTo-equivalent helpers.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { SessionStore, PrefKeys } from '../core/storage';
import type { FarmerChatMode } from '../core/config';

export interface ChatRouteParams {
  source: 'home' | 'history';
  question?: string;
  conversationId?: string;
  imageUri?: string;
  /** Web addition: the actual image payload for #28 (browser blobs can't ride in a URL). */
  imageBlob?: Blob;
  transcriptionId?: string;
  audioUri?: string;
  statementId?: number;
  homeStatementId?: string;
  preGeneratedAnswer?: string;
  followUpQuestions?: string[];
  isWeatherAdviceCTA?: boolean;
  isSSFR?: boolean;
  ssfrCrop?: string;
  channel?: string;
  /** Web addition: pending voice recording for the voice-prototype entry. */
  voiceBase64?: string;
  voiceFormat?: string;
}

export interface ErrorRouteParams {
  isNetworkError: boolean;
  fromScreen: string;
}

export type Route =
  | { name: 'splash' }
  | { name: 'language' }
  | { name: 'name' }
  | { name: 'home' }
  | { name: 'chat'; params: ChatRouteParams }
  | { name: 'settings' }
  | { name: 'settingsName' }
  | { name: 'help' }
  | { name: 'settingsLanguage' }
  | { name: 'chatHistory' }
  | { name: 'error'; params: ErrorRouteParams }
  | { name: 'accountBenefits' }
  | { name: 'auth' }
  | { name: 'accountSuccess' };

export type RouteName = Route['name'];

/** PendingTarget types (docs/01 §1 AppNavigator). */
export type PendingTarget =
  | { type: 'chat'; chatId: string }
  | { type: 'chatQuery'; question: string; source: string; channel?: string }
  | { type: 'home' };

export interface Navigator {
  stack: Route[];
  current: Route;
  /** Standard push. */
  push: (route: Route) => void;
  /** Push unless the same route name is already on top (launchSingleTop). */
  pushSingleTop: (route: Route) => void;
  /** popUpTo(0){inclusive} + navigate. */
  replaceAll: (route: Route) => void;
  /** popUpTo(name){inclusive?} then push. */
  popUpToAndPush: (upTo: RouteName, inclusive: boolean, route: Route) => void;
  /** popBackStack(). Returns false when the stack cannot pop. */
  pop: () => boolean;
  /** routeFromSplash decision tree. */
  routeFromSplash: () => void;
  setPendingTarget: (target: PendingTarget | null) => void;
  consumePendingTarget: () => PendingTarget | null;
}

/**
 * routeFromSplash (docs/01 §2 AppNavigator):
 * `!isLanguageSelected` → Language; `!isProfileDone && !hasSeenNameScreenOnce`
 * → Name (web has no Remote Config; `show_name_screen` defaults to shown);
 * else consume PendingTarget → Chat/ChatQuery/Home. All popUpTo(0){inclusive}.
 */
export function computeRouteFromSplash(
  store: SessionStore,
  pending: PendingTarget | null,
  mode: FarmerChatMode = 'FULL_JOURNEY',
): Route {
  const languageDone = store.getBool(PrefKeys.LANGUAGE_DONE, false);
  if (!languageDone) return { name: 'language' };

  // CHAT_ONLY (docs/07 C3): skip Enter-Name/Home; land directly in a fresh chat.
  if (mode === 'CHAT_ONLY') {
    if (pending?.type === 'chat') return { name: 'chat', params: { source: 'history', conversationId: pending.chatId } };
    if (pending?.type === 'chatQuery') return { name: 'chat', params: { source: 'home', question: pending.question, channel: pending.channel } };
    return { name: 'chat', params: { source: 'home' } };
  }

  const nameDone = store.getBool(PrefKeys.KEY_NAME_DONE, false);
  const nameSeen = store.getBool(PrefKeys.KEY_NAME_SCREEN_SEEN, false);
  if (!nameDone && !nameSeen) return { name: 'name' };

  if (pending) {
    if (pending.type === 'chat') {
      return { name: 'chat', params: { source: 'history', conversationId: pending.chatId } };
    }
    if (pending.type === 'chatQuery') {
      return {
        name: 'chat',
        params: { source: 'home', question: pending.question, channel: pending.channel },
      };
    }
  }
  return { name: 'home' };
}

export function useNavigator(store: SessionStore, mode: FarmerChatMode = 'FULL_JOURNEY'): Navigator {
  const [stack, setStack] = useState<Route[]>([{ name: 'splash' }]);
  const pendingRef = useRef<PendingTarget | null>(null);

  const push = useCallback((route: Route) => {
    setStack((s) => [...s, route]);
  }, []);

  const pushSingleTop = useCallback((route: Route) => {
    setStack((s) => {
      const top = s[s.length - 1];
      if (top && top.name === route.name) return [...s.slice(0, -1), route];
      return [...s, route];
    });
  }, []);

  const replaceAll = useCallback((route: Route) => {
    setStack([route]);
  }, []);

  const popUpToAndPush = useCallback((upTo: RouteName, inclusive: boolean, route: Route) => {
    setStack((s) => {
      const idx = s.map((r) => r.name).lastIndexOf(upTo);
      if (idx < 0) return [...s, route];
      const base = s.slice(0, inclusive ? idx : idx + 1);
      return [...base, route];
    });
  }, []);

  const pop = useCallback((): boolean => {
    let popped = false;
    setStack((s) => {
      if (s.length <= 1) return s;
      popped = true;
      return s.slice(0, -1);
    });
    return popped;
  }, []);

  const setPendingTarget = useCallback((target: PendingTarget | null) => {
    pendingRef.current = target;
  }, []);

  const consumePendingTarget = useCallback((): PendingTarget | null => {
    const t = pendingRef.current;
    pendingRef.current = null;
    return t;
  }, []);

  const routeFromSplash = useCallback(() => {
    const pending = pendingRef.current;
    const route = computeRouteFromSplash(store, pending, mode);
    if (route.name === 'chat') pendingRef.current = null;
    setStack([route]);
  }, [store, mode]);

  return useMemo(
    () => ({
      stack,
      current: stack[stack.length - 1] ?? { name: 'splash' },
      push,
      pushSingleTop,
      replaceAll,
      popUpToAndPush,
      pop,
      routeFromSplash,
      setPendingTarget,
      consumePendingTarget,
    }),
    [stack, push, pushSingleTop, replaceAll, popUpToAndPush, pop, routeFromSplash, setPendingTarget, consumePendingTarget],
  );
}
