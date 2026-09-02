/**
 * SDK-wide React context: services + navigator + label re-render hook + toast.
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { SdkServices } from '../core/services';
import type { Navigator } from './router';
import type { LabelParams } from '../core/labels';
import type { AppearanceMode } from '../core/config';

export interface ToastState {
  message: string | null;
  show: (message: string, durationMs?: number) => void;
}

export interface SdkContextValue {
  services: SdkServices;
  navigator: Navigator;
  toast: ToastState;
  appearance: AppearanceMode;
  setAppearance: (mode: AppearanceMode) => void;
  /** Host logo override (docs/07 Part B): image URL or React node. */
  logo?: string | ReactNode;
}

const SdkContext = createContext<SdkContextValue | null>(null);

export const SdkProvider = SdkContext.Provider;

export function useSdk(): SdkContextValue {
  const ctx = useContext(SdkContext);
  if (!ctx) throw new Error('[FarmerChat] Components must be rendered inside <FarmerChat/>');
  return ctx;
}

/** Reactive label getter — re-renders when labels/language change. */
export function useLabel(): (baseKey: string, englishFallback: string, params?: LabelParams) => string {
  const { services } = useSdk();
  const [, setTick] = useState(0);
  useEffect(() => services.labels.onChange(() => setTick((t) => t + 1)), [services.labels]);
  return useCallback(
    (baseKey: string, englishFallback: string, params?: LabelParams) =>
      services.labels.getLabel(baseKey, englishFallback, params),
    [services.labels],
  );
}

export function useToastState(): ToastState {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const show = useCallback((msg: string, durationMs = 2600) => {
    setMessage(msg);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setMessage(null), durationMs);
  }, []);
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );
  return { message, show };
}

/** Screen_Viewed / Screen_Exited lifecycle tracking. */
export function useScreenTracking(screenName: string): void {
  const { services } = useSdk();
  useEffect(() => {
    services.analytics.screenView(screenName);
    return () => services.analytics.screenExit(screenName);
  }, [screenName, services.analytics]);
}
