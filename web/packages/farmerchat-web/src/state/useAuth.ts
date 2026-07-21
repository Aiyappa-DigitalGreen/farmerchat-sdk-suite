/**
 * AuthViewModel port — phone + OTP with 180 s countdown, WhatsApp/SMS channel
 * discovery and country picker (docs/01 §3.4). Web adaptation: manual OTP
 * entry with Web OTP API assist where available (docs/03 fidelity map).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import type { CountryItem, SendOtpResponse, VerifyOtpResponse } from '../core/types';
import { UiState, idle, loading } from './uiState';
import { toUiState } from './helpers';
import { Events } from '../core/analytics';

export type AuthStep = 'phoneEntry' | 'otpEntry';

export interface AvailableChannels {
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  isLoading: boolean;
}

export const OTP_TIMER_SECONDS = 180;

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
  countries: UiState<CountryItem[]>;
  selectedCountry: CountryItem | null;
  toast: string | null;
  existingUser: boolean;
  secondsRemaining: number;
  timerExpired: boolean;
  lastChannel: string | null;
}

const initialState: AuthState = {
  step: 'phoneEntry',
  countryCode: '',
  phoneLocal: '',
  otp: '',
  phoneError: null,
  otpError: null,
  sendOtpState: idle(),
  verifyOtpState: idle(),
  availableChannels: { smsEnabled: true, whatsappEnabled: false, isLoading: false },
  countries: idle(),
  selectedCountry: null,
  toast: null,
  existingUser: false,
  secondsRemaining: OTP_TIMER_SECONDS,
  timerExpired: false,
  lastChannel: null,
};

export interface AuthActions {
  fetchCountries: () => Promise<void>;
  autoDetectCountryFromLocation: () => void;
  setCountryCode: (code: string) => void;
  selectCountry: (country: CountryItem) => void;
  setPhoneLocal: (phone: string) => void;
  setOtp: (otp: string) => void;
  isPhoneValid: () => boolean;
  refreshOtpModeForCountry: (phoneCountryCode: string) => Promise<void>;
  sendOtp: (channel: 'whatsapp' | 'sms') => Promise<void>;
  resendOtp: () => Promise<void>;
  verifyOtp: () => Promise<void>;
  startOver: () => void;
  consumeToast: () => void;
}

export function useAuth(services: SdkServices): [AuthState, AuthActions] {
  const [state, setState] = useState<AuthState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const { api, session, store, labels, analytics } = services;

  const patch = useCallback((p: Partial<AuthState>) => setState((s) => ({ ...s, ...p })), []);

  // 180 s countdown while on the OTP step.
  useEffect(() => {
    if (state.step !== 'otpEntry' || state.timerExpired) return;
    const interval = setInterval(() => {
      setState((s) => {
        if (s.secondsRemaining <= 1) return { ...s, secondsRemaining: 0, timerExpired: true };
        return { ...s, secondsRemaining: s.secondsRemaining - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state.step, state.timerExpired]);

  const fetchCountries = useCallback(async () => {
    patch({ countries: loading() });
    const res = await api.getAllCountries();
    patch({ countries: toUiState(res) });
    if (res.ok && !stateRef.current.selectedCountry) {
      const storedCode = store.getString(PrefKeys.USER_COUNTRY_CODE);
      const match = storedCode
        ? res.data.find((c) => (c.code ?? '').toLowerCase() === storedCode.toLowerCase())
        : undefined;
      const fallback = match ?? res.data[0] ?? null;
      if (fallback) {
        patch({ selectedCountry: fallback, countryCode: fallback.phone_country_code ?? '' });
        if (fallback.phone_country_code) void refreshOtpModeForCountryImpl(fallback.phone_country_code);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, patch, store]);

  const autoDetectCountryFromLocation = useCallback(() => {
    const storedCode = store.getString(PrefKeys.USER_COUNTRY_CODE);
    const countries = stateRef.current.countries;
    if (storedCode && countries.status === 'success') {
      const match = countries.data.find((c) => (c.code ?? '').toLowerCase() === storedCode.toLowerCase());
      if (match) {
        patch({ selectedCountry: match, countryCode: match.phone_country_code ?? '' });
        if (match.phone_country_code) void refreshOtpModeForCountryImpl(match.phone_country_code);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patch, store]);

  const refreshOtpModeForCountryImpl = useCallback(
    async (phoneCountryCode: string) => {
      patch({ availableChannels: { smsEnabled: true, whatsappEnabled: false, isLoading: true } });
      const res = await api.getCommunicationChannels(phoneCountryCode);
      if (res.ok && res.data.length > 0) {
        const item = res.data[0]!;
        patch({
          availableChannels: {
            smsEnabled: item.sms_enabled ?? true,
            whatsappEnabled: item.whatsapp_enabled ?? false,
            isLoading: false,
          },
        });
      } else {
        patch({ availableChannels: { smsEnabled: true, whatsappEnabled: false, isLoading: false } });
      }
    },
    [api, patch],
  );

  const setCountryCode = useCallback(
    (code: string) => {
      patch({ countryCode: code });
    },
    [patch],
  );

  const selectCountry = useCallback(
    (country: CountryItem) => {
      analytics.track(Events.COUNTRY_SELECTED, { country: country.name ?? '', phone_country_code: country.phone_country_code ?? '' });
      patch({ selectedCountry: country, countryCode: country.phone_country_code ?? '' });
      if (country.phone_country_code) void refreshOtpModeForCountryImpl(country.phone_country_code);
    },
    [analytics, patch, refreshOtpModeForCountryImpl],
  );

  const setPhoneLocal = useCallback(
    (phone: string) => {
      patch({ phoneLocal: phone.replace(/[^\d]/g, ''), phoneError: null });
    },
    [patch],
  );

  const setOtp = useCallback(
    (otp: string) => {
      patch({ otp: otp.replace(/[^\d]/g, '').slice(0, 4), otpError: null });
    },
    [patch],
  );

  const isPhoneValid = useCallback((): boolean => {
    const s = stateRef.current;
    const len = s.phoneLocal.length;
    const expected = s.selectedCountry?.phone_length ?? null;
    if (expected && expected > 0) return len === expected;
    const pattern = s.selectedCountry?.phone_number_pattern;
    if (pattern) {
      try {
        return new RegExp(pattern).test(s.phoneLocal);
      } catch {
        // fall through to the generic check
      }
    }
    return len >= 6 && len <= 15;
  }, []);

  const sendOtp = useCallback(
    async (channel: 'whatsapp' | 'sms') => {
      const s = stateRef.current;
      if (!isPhoneValid()) {
        patch({ phoneError: labels.getLabel('auth_invalid_phone', 'Please enter a valid phone number.') });
        return;
      }
      patch({ sendOtpState: loading(), lastChannel: channel });
      analytics.track(Events.SEND_OTP_CLICK_EVENT, { channel, phone_country_code: s.countryCode });
      const res = await api.generateOtp({
        phone: s.phoneLocal,
        phone_country_code: s.countryCode,
        channel: [channel],
        device_id: session.deviceId,
        user_id: session.userId ?? '',
      });
      patch({ sendOtpState: toUiState(res) });
      if (res.ok) {
        patch({
          step: 'otpEntry',
          otp: '',
          secondsRemaining: OTP_TIMER_SECONDS,
          timerExpired: false,
          toast: labels.getLabel('auth_otp_sent', 'We sent you a verification code.'),
        });
      } else {
        patch({ toast: res.message });
      }
    },
    [analytics, api, isPhoneValid, labels, patch, session],
  );

  const resendOtp = useCallback(async () => {
    const channel = (stateRef.current.lastChannel ?? 'sms') as 'whatsapp' | 'sms';
    analytics.track(Events.RESEND_OTP_CLICK_EVENT, { channel });
    patch({ secondsRemaining: OTP_TIMER_SECONDS, timerExpired: false, otp: '' });
    await sendOtp(channel);
  }, [analytics, patch, sendOtp]);

  const verifyOtp = useCallback(async () => {
    const s = stateRef.current;
    if (s.otp.length !== 4) {
      patch({ otpError: labels.getLabel('auth_invalid_otp', 'Please enter the 4-digit code.') });
      return;
    }
    patch({ verifyOtpState: loading() });
    analytics.track(Events.SUBMIT_OTP, { phone_country_code: s.countryCode });
    const res = await api.verifyOtp({
      otp: s.otp,
      phone: s.phoneLocal,
      phone_country_code: s.countryCode,
      guest_onboarding: !session.isAuthenticated(),
      user_id: session.userId ?? '',
    });
    patch({ verifyOtpState: toUiState(res) });
    if (res.ok) {
      const phoneE164 = `${s.countryCode}${s.phoneLocal}`;
      session.completeOtpLogin(phoneE164, res.data);
      const existing = res.data.existing_user ?? false;
      patch({ existingUser: existing });
      analytics.track(existing ? Events.LOGIN_COMPLETED : Events.REGISTRATION_COMPLETED, {
        phone_country_code: s.countryCode,
        existing_user: existing,
      });
    } else {
      patch({ otpError: res.message });
    }
  }, [analytics, api, labels, patch, session]);

  const startOver = useCallback(() => {
    analytics.track(Events.START_OVER_CLICKED, {});
    setState((s) => ({
      ...initialState,
      countries: s.countries,
      selectedCountry: s.selectedCountry,
      countryCode: s.countryCode,
      phoneLocal: s.phoneLocal,
      availableChannels: s.availableChannels,
    }));
  }, []);

  const consumeToast = useCallback(() => patch({ toast: null }), [patch]);

  return [
    state,
    {
      fetchCountries,
      autoDetectCountryFromLocation,
      setCountryCode,
      selectCountry,
      setPhoneLocal,
      setOtp,
      isPhoneValid,
      refreshOtpModeForCountry: refreshOtpModeForCountryImpl,
      sendOtp,
      resendOtp,
      verifyOtp,
      startOver,
      consumeToast,
    },
  ];
}
