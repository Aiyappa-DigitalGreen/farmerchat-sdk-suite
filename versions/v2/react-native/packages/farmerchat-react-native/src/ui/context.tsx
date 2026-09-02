/**
 * SDK React context — exposes the FarmerChatSdk instance, resolved theme
 * (Day/Night/Auto), label lookup and appearance control to every screen.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import type { AppearanceMode } from '../core/config';
import type { FarmerChatSdk } from '../core/sdk';
import { StorageKeys } from '../core/sessionStore';
import type { LabelParams } from '../core/labelManager';
import { dayTheme, nightTheme, type FarmerChatTheme } from './theme';
import { AnalyticsEvents } from '../core/analytics';

export interface SdkContextValue {
  sdk: FarmerChatSdk;
  theme: FarmerChatTheme;
  appearanceMode: AppearanceMode;
  setAppearanceMode: (mode: AppearanceMode) => void;
  /** LabelManager.getLabel bound to the current language + re-render on change. */
  label: (baseKey: string, englishFallback: string, params?: LabelParams) => string;
  /** Bumps when labels or language change so screens re-render. */
  labelsVersion: number;
}

const SdkContext = createContext<SdkContextValue | null>(null);

export function useSdkContext(): SdkContextValue {
  const value = useContext(SdkContext);
  if (!value) {
    throw new Error(
      '[FarmerChat] Missing <FarmerChatProvider>. Wrap your app (or <FarmerChatView/>) in FarmerChatProvider.',
    );
  }
  return value;
}

export function useSdk(): FarmerChatSdk {
  return useSdkContext().sdk;
}

export function useTheme(): FarmerChatTheme {
  return useSdkContext().theme;
}

export function useLabel(): SdkContextValue['label'] {
  return useSdkContext().label;
}

export function SdkContextProvider(props: {
  sdk: FarmerChatSdk;
  children: React.ReactNode;
}): React.ReactElement {
  const { sdk } = props;
  const systemScheme = useColorScheme();
  const [appearanceMode, setAppearanceModeState] = useState<AppearanceMode>(
    (sdk.store.getString(StorageKeys.APPEARANCE_MODE) as AppearanceMode | null) ??
      sdk.config.appearance,
  );
  const [labelsVersion, setLabelsVersion] = useState(0);

  useEffect(() => {
    const unsubLabels = sdk.labels.subscribe(() => setLabelsVersion((v) => v + 1));
    const unsubStore = sdk.store.subscribe(() => {
      const mode = sdk.store.getString(StorageKeys.APPEARANCE_MODE) as
        | AppearanceMode
        | null;
      if (mode) setAppearanceModeState(mode);
      // language changes also affect label resolution
      setLabelsVersion((v) => v + 1);
    });
    return () => {
      unsubLabels();
      unsubStore();
    };
  }, [sdk]);

  const setAppearanceMode = useCallback(
    (mode: AppearanceMode) => {
      sdk.store.set(StorageKeys.APPEARANCE_MODE, mode);
      setAppearanceModeState(mode);
      sdk.analytics.track(AnalyticsEvents.SETTINGS_OPTION_SELECTED, {
        option: 'appearance',
        value: mode,
      });
    },
    [sdk],
  );

  const isDark =
    appearanceMode === 'night' ||
    (appearanceMode === 'auto' && systemScheme === 'dark');
  const theme = isDark ? nightTheme : dayTheme;

  const label = useCallback(
    (baseKey: string, englishFallback: string, params?: LabelParams) =>
      sdk.labels.getLabel(baseKey, englishFallback, params),
    // labelsVersion forces new identity when the label map / language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sdk, labelsVersion],
  );

  const value = useMemo<SdkContextValue>(
    () => ({ sdk, theme, appearanceMode, setAppearanceMode, label, labelsVersion }),
    [sdk, theme, appearanceMode, setAppearanceMode, label, labelsVersion],
  );

  return <SdkContext.Provider value={value}>{props.children}</SdkContext.Provider>;
}
