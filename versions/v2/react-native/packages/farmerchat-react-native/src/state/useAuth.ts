/**
 * useAuth — port of `AuthViewModel` (docs/01 §3.4): PhoneEntry/OtpEntry steps,
 * country picker, WhatsApp/SMS channels (endpoint #20), OTP send/verify,
 * 180 s countdown timer with resend/start-over. SIM prefill and SMS Retriever
 * are Android-app-only (platform fidelity map → manual entry on RN).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { UiStates, type UiState } from '../core/apiResult';
import { AnalyticsEvents } from '../core/analytics';
import type { FarmerChatSdk } from '../core/sdk';
import { StorageKeys } from '../core/sessionStore';
import type {
  CountryItem,
  SendOtpResponse,
  VerifyOtpResponse,
} from '../core/types';

export const OTP_LENGTH = 4;
export const OTP_TIMER_SECONDS = 180;

export type AuthStep = 'PhoneEntry' | 'OtpEntry';

export type OtpChannel = 'whatsapp' | 'sms';

export interface AvailableChannels {
  whatsappEnabled: boolean;
  smsEnabled: boolean;
}

export interface AuthToast {
  message: string;
  kind: 'error' | 'info' | 'success';
}

export interface AuthState {
  step: AuthStep;
  countryCode: string;
  phoneLocal: string;
  otp: string;
  phoneError: string | null;
  otpError: string | null;
  sendOtpState: UiState<SendOtpResponse>;
  verifyOtpState: UiState<VerifyOtpResponse>;
  availableChannels: AvailableChannels;
  isLoadingChannels: boolean;
  countries: UiState<CountryItem[]>;
  selectedCountry: CountryItem | null;
  toast: AuthToast | null;
  existingUser: boolean;
  /** Channel used for the last successful send (shown on OTP step). */
  sentVia: OtpChannel | null;
  timerSeconds: number;
  timerExpired: boolean;
}

const initialAuthState: AuthState = {
  step: 'PhoneEntry',
  countryCode: '+91',
  phoneLocal: '',
  otp: '',
  phoneError: null,
  otpError: null,
  sendOtpState: UiStates.idle(),
  verifyOtpState: UiStates.idle(),
  availableChannels: { whatsappEnabled: true, smsEnabled: true },
  isLoadingChannels: false,
  countries: UiStates.idle(),
  selectedCountry: null,
  toast: null,
  existingUser: false,
  sentVia: null,
  timerSeconds: OTP_TIMER_SECONDS,
  timerExpired: false,
};

export interface UseAuthResult {
  state: AuthState;
  fetchCountries: () => void;
  autoDetectCountryFromLocation: () => void;
  showLocationDetectionError: () => void;
  setCountryCode: (code: string) => void;
  selectCountry: (country: CountryItem) => void;
  setPhoneLocal: (phone: string) => void;
  setOtp: (otp: string) => void;
  isPhoneValid: () => boolean;
  refreshOtpModeForCountry: () => void;
  sendOtp: (channel: OtpChannel) => void;
  resendOtp: (channel: OtpChannel) => void;
  verifyOtp: () => void;
  startOver: () => void;
  consumeToast: () => void;
}

export function useAuth(sdk: FarmerChatSdk): UseAuthResult {
  const [state, setState] = useState<AuthState>(initialAuthState);
  const mounted = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const patch = useCallback((partial: Partial<AuthState>) => {
    if (!mounted.current) return;
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  // --- 180 s countdown ------------------------------------------------------

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    patch({ timerSeconds: OTP_TIMER_SECONDS, timerExpired: false });
    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.timerSeconds <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return { ...prev, timerSeconds: 0, timerExpired: true };
        }
        return { ...prev, timerSeconds: prev.timerSeconds - 1 };
      });
    }, 1000);
  }, [patch]);

  // --- countries ------------------------------------------------------------

  const fetchCountries = useCallback(() => {
    setState((prev) => {
      if (prev.countries.kind === 'loading' || prev.countries.kind === 'success') {
        return prev;
      }
      return { ...prev, countries: UiStates.loading() };
    });
    void sdk.api.getAllCountries().then((result) => {
      if (!mounted.current) return;
      if (result.ok) {
        patch({ countries: UiStates.success(result.data) });
        // Auto-select from stored country code when possible.
        const storedCode = sdk.store.getString(StorageKeys.USER_COUNTRY_CODE);
        if (storedCode) {
          const match = result.data.find(
            (c) => c.code.toUpperCase() === storedCode.toUpperCase(),
          );
          if (match) {
            setState((prev) =>
              prev.selectedCountry
                ? prev
                : {
                    ...prev,
                    selectedCountry: match,
                    countryCode: normalizePhoneCode(match.phone_country_code),
                  },
            );
          }
        }
      } else {
        patch({
          countries: UiStates.error(
            result.message ?? 'Could not load countries',
            result.code,
            result.isNetworkError || result.isTimeout,
          ),
        });
      }
    });
  }, [patch, sdk]);

  const autoDetectCountryFromLocation = useCallback(() => {
    fetchCountries();
  }, [fetchCountries]);

  const showLocationDetectionError = useCallback(() => {
    patch({
      toast: {
        message: sdk.labels.getLabel(
          'auth_location_detect_failed',
          'Could not detect your country. Please pick it manually.',
        ),
        kind: 'error',
      },
    });
  }, [patch, sdk]);

  const setCountryCode = useCallback(
    (code: string) => {
      patch({ countryCode: normalizePhoneCode(code), phoneError: null });
    },
    [patch],
  );

  const refreshOtpModeForCountry = useCallback(() => {
    const code = digitsOnly(stateRef.current.countryCode);
    if (!code) return;
    patch({ isLoadingChannels: true });
    void sdk.api.getCommunicationChannels(code).then((result) => {
      if (!mounted.current) return;
      if (result.ok && result.data.length > 0) {
        const item = result.data[0]!;
        patch({
          isLoadingChannels: false,
          availableChannels: {
            whatsappEnabled: item.whatsapp_enabled,
            smsEnabled: item.sms_enabled,
          },
        });
      } else {
        // default both on when the lookup fails (app behavior: buttons conditional
        // only on a successful channels response)
        patch({
          isLoadingChannels: false,
          availableChannels: { whatsappEnabled: true, smsEnabled: true },
        });
      }
    });
  }, [patch, sdk]);

  // keep a ref of latest state for callbacks that need fresh values
  const stateRef = useRef(state);
  stateRef.current = state;

  const selectCountry = useCallback(
    (country: CountryItem) => {
      patch({
        selectedCountry: country,
        countryCode: normalizePhoneCode(country.phone_country_code),
        phoneError: null,
      });
    },
    [patch],
  );

  const setPhoneLocal = useCallback(
    (phone: string) => {
      patch({ phoneLocal: digitsOnly(phone), phoneError: null });
    },
    [patch],
  );

  const setOtp = useCallback(
    (otp: string) => {
      patch({ otp: digitsOnly(otp).slice(0, OTP_LENGTH), otpError: null });
    },
    [patch],
  );

  const isPhoneValid = useCallback((): boolean => {
    const s = stateRef.current;
    const phone = s.phoneLocal;
    if (phone.length === 0) return false;
    const expected = s.selectedCountry?.phone_length ?? null;
    if (expected && expected > 0) return phone.length === expected;
    const pattern = s.selectedCountry?.phone_number_pattern ?? null;
    if (pattern) {
      try {
        return new RegExp(pattern).test(phone);
      } catch {
        // invalid backend regex → fall through to length heuristic
      }
    }
    return phone.length >= 7 && phone.length <= 15;
  }, []);

  const sendOtpInternal = useCallback(
    (channel: OtpChannel, isResend: boolean) => {
      const s = stateRef.current;
      if (!isPhoneValid()) {
        patch({
          phoneError: sdk.labels.getLabel(
            'auth_invalid_phone',
            'Please enter a valid phone number.',
          ),
        });
        return;
      }
      const userId = sdk.session.userId ?? '';
      patch({ sendOtpState: UiStates.loading() });
      sdk.analytics.track(
        isResend
          ? AnalyticsEvents.RESEND_OTP_CLICK_EVENT
          : AnalyticsEvents.SEND_OTP_CLICK_EVENT,
        { channel },
      );
      void sdk.api
        .generateOtp({
          phone: s.phoneLocal,
          phone_country_code: digitsOnly(s.countryCode),
          channel: [channel],
          device_id: sdk.store.getOrCreateDeviceId(),
          user_id: userId,
        })
        .then((result) => {
          if (!mounted.current) return;
          if (result.ok) {
            patch({
              sendOtpState: UiStates.success(result.data),
              step: 'OtpEntry',
              sentVia: channel,
              otp: '',
              otpError: null,
            });
            startTimer();
          } else {
            patch({
              sendOtpState: UiStates.error(
                result.message ??
                  sdk.labels.getLabel(
                    'auth_send_otp_failed',
                    'Could not send the code. Please try again.',
                  ),
                result.code,
                result.isNetworkError || result.isTimeout,
              ),
              toast: {
                message:
                  result.message ??
                  sdk.labels.getLabel(
                    'auth_send_otp_failed',
                    'Could not send the code. Please try again.',
                  ),
                kind: 'error',
              },
            });
          }
        });
    },
    [isPhoneValid, patch, sdk, startTimer],
  );

  const sendOtp = useCallback(
    (channel: OtpChannel) => sendOtpInternal(channel, false),
    [sendOtpInternal],
  );
  const resendOtp = useCallback(
    (channel: OtpChannel) => sendOtpInternal(channel, true),
    [sendOtpInternal],
  );

  const verifyOtp = useCallback(() => {
    const s = stateRef.current;
    if (s.otp.length !== OTP_LENGTH) {
      patch({
        otpError: sdk.labels.getLabel(
          'auth_invalid_otp',
          'Please enter the 4-digit code.',
        ),
      });
      return;
    }
    patch({ verifyOtpState: UiStates.loading() });
    sdk.analytics.track(AnalyticsEvents.SUBMIT_OTP, {});
    void sdk.api
      .verifyOtp({
        otp: s.otp,
        phone: s.phoneLocal,
        phone_country_code: digitsOnly(s.countryCode),
        guest_onboarding: !sdk.session.isAuthenticated,
        user_id: sdk.session.userId ?? '',
      })
      .then((result) => {
        if (!mounted.current) return;
        if (result.ok && result.data.error !== true) {
          const phoneE164 = `+${digitsOnly(s.countryCode)}${s.phoneLocal}`;
          sdk.session.completeOtpLogin(result.data, phoneE164);
          patch({
            verifyOtpState: UiStates.success(result.data),
            existingUser: result.data.existing_user === true,
          });
        } else {
          const message = result.ok
            ? result.data.message ??
              sdk.labels.getLabel('auth_wrong_otp', 'That code is not correct. Please try again.')
            : result.message ??
              sdk.labels.getLabel('auth_verify_failed', 'Could not verify the code. Please try again.');
          patch({
            verifyOtpState: UiStates.error(
              message,
              result.ok ? null : result.code,
              !result.ok && (result.isNetworkError || result.isTimeout),
            ),
            otpError: message,
          });
        }
      });
  }, [patch, sdk]);

  const startOver = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setState((prev) => ({
      ...initialAuthState,
      countryCode: prev.countryCode,
      selectedCountry: prev.selectedCountry,
      countries: prev.countries,
      availableChannels: prev.availableChannels,
      phoneLocal: prev.phoneLocal,
    }));
  }, []);

  const consumeToast = useCallback(() => patch({ toast: null }), [patch]);

  return {
    state,
    fetchCountries,
    autoDetectCountryFromLocation,
    showLocationDetectionError,
    setCountryCode,
    selectCountry,
    setPhoneLocal,
    setOtp,
    isPhoneValid,
    refreshOtpModeForCountry,
    sendOtp,
    resendOtp,
    verifyOtp,
    startOver,
    consumeToast,
  };
}

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, '');
}

function normalizePhoneCode(code: string): string {
  const digits = digitsOnly(code);
  return digits.length > 0 ? `+${digits}` : '+';
}
