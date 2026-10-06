/**
 * Auth (docs/01 §3.4): PhoneEntry (country selector + phone input +
 * WhatsApp/SMS buttons conditional on endpoint #20 channels, full country
 * picker with search) and OtpEntry (4-digit OtpInput with Web OTP API assist,
 * Verify, 180 s countdown, Resend/Start-over after timeout — no auto-submit).
 * On verify success → onSuccess(phoneE164, existingUser) after a short delay.
 */

import { useEffect, useRef, useState } from 'react';
import { useLabel, useSdk } from '../context';
import { DefaultAppBar, LogoSpinner, OtpInput, PrimaryButton, RadioRow, TextButton, TextInput, Toast } from '../components/common';
import { useAuth } from '../../state/useAuth';
import { formatSeconds } from '../../state/helpers';
import { Events, Screens } from '../../core/analytics';
import type { CountryItem } from '../../core/types';

export function AuthScreen(props: {
  onSuccess: (phoneE164: string, existingUser: boolean) => void;
  onClose: () => void;
  onOpenLegal: (url: string, title: string) => void;
}) {
  const { services, toast } = useSdk();
  const label = useLabel();
  const [state, actions] = useAuth(services);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const successFiredRef = useRef(false);

  useEffect(() => {
    services.analytics.screenView(Screens.AUTH);
    services.analytics.track(Events.MOBILE_VERIFICATION_STARTED, {});
    void actions.fetchCountries();
    return () => services.analytics.screenExit(Screens.AUTH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-step screen tracking (AUTH + VERIFY_OTP).
  useEffect(() => {
    if (state.step === 'otpEntry') {
      services.analytics.screenView(Screens.VERIFY_OTP);
      return () => services.analytics.screenExit(Screens.VERIFY_OTP);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  useEffect(() => {
    if (state.toast) {
      toast.show(state.toast);
      actions.consumeToast();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.toast]);

  // Verify success → delay 800 ms then onSuccess (docs/01 §3.4 lifecycle).
  useEffect(() => {
    if (state.verifyOtpState.status === 'success' && !successFiredRef.current) {
      successFiredRef.current = true;
      const timer = window.setTimeout(() => {
        props.onSuccess(`${state.countryCode}${state.phoneLocal}`, state.existingUser);
      }, 800);
      return () => window.clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.verifyOtpState.status]);

  if (showCountryPicker) {
    const countries = state.countries.status === 'success' ? state.countries.data : [];
    const filtered = countries.filter((c) =>
      (c.display_name ?? c.name ?? '').toLowerCase().includes(countrySearch.trim().toLowerCase()),
    );
    return (
      <div className="fcsdk-screen">
        <DefaultAppBar title={label('auth_country_title', 'Select your country')} leadingIcon="back" onLeadingClick={() => setShowCountryPicker(false)} />
        <div className="fcsdk-pad">
          <TextInput value={countrySearch} onChange={setCountrySearch} placeholder={label('auth_country_search', 'Search countries')} />
        </div>
        <div className="fcsdk-scroll" role="radiogroup">
          {filtered.map((c: CountryItem, i) => (
            <RadioRow
              key={c.id ?? i}
              label={`${c.flag ?? ''} ${c.display_name ?? c.name ?? ''} (${c.phone_country_code ?? ''})`}
              selected={state.selectedCountry?.id === c.id}
              onClick={() => actions.selectCountry(c)}
            />
          ))}
        </div>
        <div className="fcsdk-bottombar">
          <PrimaryButton label={label('fc_v2_app_label_save', 'Save')} onClick={() => setShowCountryPicker(false)} disabled={!state.selectedCountry} />
        </div>
      </div>
    );
  }

  return (
    <div className="fcsdk-screen">
      <DefaultAppBar title={label('fc_v2_app_label_sign_up', 'Sign up')} leadingIcon="close" onLeadingClick={props.onClose} />
      {state.step === 'phoneEntry' ? (
        <PhoneEntryContent
          state={state}
          actions={actions}
          onOpenCountryPicker={() => setShowCountryPicker(true)}
        />
      ) : (
        <OtpEntryContent state={state} actions={actions} />
      )}
      <Toast message={toast.message} />
    </div>
  );
}

function PhoneEntryContent(props: {
  state: ReturnType<typeof useAuth>[0];
  actions: ReturnType<typeof useAuth>[1];
  onOpenCountryPicker: () => void;
}) {
  const label = useLabel();
  const { state, actions } = props;
  const sending = state.sendOtpState.status === 'loading';

  return (
    <div className="fcsdk-scroll fcsdk-pad">
      {/* App parity (AuthScreen.kt:801-814). Three problems, as on iOS and react-native:
          `auth_phone_title` / `auth_phone_subtitle` are SDK-invented keys endpoint #3 serves for
          nobody (so every farmer read English whatever their language); the subtitle copy was
          invented rather than the app's; and the heading was 21px left-aligned where the app
          centres titleLarge (22px). */}
      <h2 style={{ margin: '4px 0 8px', fontSize: 22, textAlign: 'center' }}>
        {label('fc_v2_app_label_enter_your_phone_number', 'Enter your phone number')}
      </h2>
      <p style={{ margin: '0 0 16px', color: 'var(--fc-text-muted)', textAlign: 'center' }}>
        {label('fc_v2_app_label_send_otp_signin', "We'll send a one-time code to sign you in")}
      </p>

      {state.countries.status === 'loading' ? (
        <LogoSpinner message={label('auth_loading_countries', 'Loading countries…')} />
      ) : (
        <>
          <button type="button" className="fcsdk-countrysel" onClick={props.onOpenCountryPicker} style={{ width: '100%', marginBottom: 10 }}>
            <span aria-hidden>{state.selectedCountry?.flag ?? '🌍'}</span>
            <span style={{ flex: 1, textAlign: 'left' }}>
              {state.selectedCountry?.display_name ?? state.selectedCountry?.name ?? label('auth_country_title', 'Select your country')}
            </span>
            <span>{state.countryCode}</span>
          </button>
          {/* App parity: the placeholder is the literal digit mask, and the app never
              auto-focuses the phone field (only its OTP input). The accessible name keeps a
              real served key -- `auth_phone_placeholder` was never one. */}
          <TextInput
            value={state.phoneLocal}
            onChange={actions.setPhoneLocal}
            placeholder="00000 00000"
            inputMode="tel"
            type="tel"
            ariaLabel={label('fc_v2_app_label_enter_your_phone_number', 'Enter your phone number')}
          />
          {state.phoneError ? <div className="fcsdk-error-inline" style={{ marginTop: 6 }}>{state.phoneError}</div> : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
            {state.availableChannels.isLoading ? (
              <LogoSpinner />
            ) : (
              <>
                {state.availableChannels.whatsappEnabled ? (
                  <PrimaryButton
                    label={label('auth_send_whatsapp', 'Get code on WhatsApp')}
                    onClick={() => void actions.sendOtp('whatsapp')}
                    disabled={!actions.isPhoneValid()}
                    state={sending && state.lastChannel === 'whatsapp' ? 'loading' : 'default'}
                  />
                ) : null}
                {state.availableChannels.smsEnabled ? (
                  <PrimaryButton
                    label={label('auth_send_sms', 'Get code by SMS')}
                    onClick={() => void actions.sendOtp('sms')}
                    disabled={!actions.isPhoneValid()}
                    state={sending && state.lastChannel === 'sms' ? 'loading' : 'default'}
                  />
                ) : null}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function OtpEntryContent(props: { state: ReturnType<typeof useAuth>[0]; actions: ReturnType<typeof useAuth>[1] }) {
  const label = useLabel();
  const { state, actions } = props;
  const verifying = state.verifyOtpState.status === 'loading';
  const verified = state.verifyOtpState.status === 'success';

  return (
    <div className="fcsdk-scroll fcsdk-pad" style={{ textAlign: 'center' }}>
      {/* App parity (AuthScreen.kt:1039-1050) — same three problems. The app's OTP subtitle is a
          FIXED sentence: it interpolates no phone number. */}
      <h2 style={{ margin: '4px 0 8px', fontSize: 22 }}>
        {label('fc_v2_app_label_enter_code_we_sent', 'Enter the code we sent')}
      </h2>
      <p style={{ margin: '0 0 18px', color: 'var(--fc-text-muted)' }}>
        {label('fc_v2_app_label_check_your_messages_code', 'Check your messages for the code')}
      </p>
      <OtpInput value={state.otp} onChange={actions.setOtp} />
      {state.otpError ? <div className="fcsdk-error-inline" style={{ marginTop: 10 }}>{state.otpError}</div> : null}
      {verified ? <div style={{ marginTop: 10, color: 'var(--fc-brand-bright)', fontWeight: 700 }}>{label('auth_otp_verified', 'Verified!')}</div> : null}

      <div style={{ marginTop: 18 }}>
        <PrimaryButton
          label={label('fc_v2_app_label_verify', 'Verify')}
          onClick={() => void actions.verifyOtp()}
          disabled={state.otp.length !== 4 || verified}
          state={verifying ? 'loading' : 'default'}
        />
      </div>

      <div className="fcsdk-timer" style={{ marginTop: 16 }}>
        {!state.timerExpired
          ? label('auth_otp_timer', 'Resend available in {time}', { time: formatSeconds(state.secondsRemaining) })
          : null}
      </div>
      {state.timerExpired ? (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          <TextButton label={label('fc_v2_app_label_resend_code', 'Resend code')} onClick={() => void actions.resendOtp()} />
          <TextButton label={label('fc_v2_app_label_start_over', 'Start over')} onClick={actions.startOver} />
        </div>
      ) : null}
    </div>
  );
}
