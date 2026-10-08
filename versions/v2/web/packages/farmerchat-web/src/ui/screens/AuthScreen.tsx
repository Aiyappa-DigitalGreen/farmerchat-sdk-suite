/**
 * Auth (docs/01 §3.4): PhoneEntry (country selector + phone input +
 * WhatsApp/SMS buttons conditional on endpoint #20 channels, full country
 * picker with search) and OtpEntry (4-digit OtpInput with Web OTP API assist,
 * Verify, 180 s countdown, Resend/Start-over after timeout — no auto-submit).
 * On verify success → onSuccess(phoneE164, existingUser) after a short delay.
 */

import { useEffect, useRef, useState } from 'react';
import { useLabel, useSdk } from '../context';
import { CircularProgress, DefaultAppBar, OtpInput, PrimaryButton, RadioRow, SecondaryButton, TextInput, Toast } from '../components/common';
import { FcIcon } from '../components/FcIcon';
import { useAuth } from '../../state/useAuth';
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
  const [pendingCountry, setPendingCountry] = useState<CountryItem | null>(null);
  const [privacyUrl, setPrivacyUrl] = useState<string | null>(null);
  useEffect(() => {
    void services.api.getPrivacyPolicy().then((res) => {
      if (res.ok) setPrivacyUrl(res.data.privacy_policy_url ?? res.data.privacy_policy ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      toast.show(state.toast, { kind: 'error' });
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
    // AuthScreen.kt country picker: search field, 48dp country radio rows (flag at the end), and
    // a pending selection committed by "Save selection".
    const countries = state.countries.status === 'success' ? state.countries.data : [];
    const q = countrySearch.trim().toLowerCase();
    const filtered = countries.filter(
      (c) =>
        (c.display_name ?? '').toLowerCase().includes(q) ||
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.phone_country_code ?? '').toLowerCase().includes(q),
    );
    const chosen = pendingCountry ?? state.selectedCountry;
    return (
      <div className="fcsdk-screen fcsdk-c-screen">
        <DefaultAppBar
          title={label('fc_v2_app_label_select_country_code', 'Select country code')}
          leadingIcon="back"
          onLeadingClick={() => {
            setPendingCountry(null);
            setShowCountryPicker(false);
          }}
        />
        <div className="fcsdk-scroll">
          <div className="fcsdk-c-section" style={{ padding: '12px 16px', gap: 12 }}>
            <div className="fcsdk-c-search">
              <FcIcon name="m_search" size={23} tint="var(--fc-c-fg-secondary)" />
              <input
                className="fc-t-bodyMedium"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                placeholder={label('fc_v2_app_label_search', 'Search')}
                aria-label={label('fc_v2_app_label_search', 'Search')}
              />
            </div>
            <div className="fcsdk-c-section" style={{ gap: 6 }} role="radiogroup">
              {filtered.map((c: CountryItem, i) => (
                <div key={c.id ?? i} className="fcsdk-c-countryrow">
                  <RadioRow
                    label={`${c.display_name || c.name || ''} (${c.phone_country_code ?? ''})`}
                    selected={chosen?.id === c.id}
                    onClick={() => setPendingCountry(c)}
                    trailing={<CountryFlag flag={c.flag} width={30} height={20} radius={2} />}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="fcsdk-c-footer" style={{ paddingTop: 8, paddingBottom: 'calc(12px + var(--fc-inset-bottom))', paddingLeft: 16, paddingRight: 16, background: 'transparent' }}>
          <PrimaryButton
            height={56}
            label={label('fc_v2_app_label_save_selection', 'Save selection')}
            disabled={!pendingCountry}
            onClick={() => {
              if (pendingCountry) actions.selectCountry(pendingCountry);
              setPendingCountry(null);
              setShowCountryPicker(false);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fcsdk-screen fcsdk-c-screen">
      <DefaultAppBar
        title={state.step === 'phoneEntry' ? label('fc_v2_app_label_sign_up', 'Sign up') : label('fc_v2_app_label_verify', 'Verify')}
        leadingIcon="close"
        onLeadingClick={props.onClose}
      />
      {state.step === 'phoneEntry' ? (
        <PhoneEntryContent
          state={state}
          actions={actions}
          onOpenCountryPicker={() => setShowCountryPicker(true)}
          onOpenPrivacy={() => {
            services.analytics.track(Events.PRIVACY_POLICY_OPENED, { screen_name: Screens.AUTH });
            if (privacyUrl) props.onOpenLegal(privacyUrl, label('fc_v2_app_label_privacy_policy', 'Privacy Policy'));
          }}
        />
      ) : (
        <OtpEntryContent state={state} actions={actions} />
      )}
      <Toast message={toast.message} />
    </div>
  );
}

/** A served flag: an image URL, else an emoji / text fallback (the 🇮🇳-style glyph). */
function CountryFlag(props: { flag?: string | null; width: number; height: number; radius: number }) {
  const f = (props.flag ?? '').trim();
  if (/^https?:\/\//.test(f)) {
    // SvgImage in a fixed box: the (rectangular) flag is fitted, so the clip radius barely shows.
    return <img src={f} alt="" style={{ width: props.width, height: props.height, borderRadius: props.radius, objectFit: 'contain', display: 'block' }} />;
  }
  return <span className="fc-t-bodyMedium">{f || '\u{1F310}'}</span>;
}

function PhoneEntryContent(props: {
  state: ReturnType<typeof useAuth>[0];
  actions: ReturnType<typeof useAuth>[1];
  onOpenCountryPicker: () => void;
  onOpenPrivacy: () => void;
}) {
  const label = useLabel();
  const { state, actions } = props;
  const sending = state.sendOtpState.status === 'loading';
  const valid = actions.isPhoneValid();
  const channelButton = (channel: 'whatsapp' | 'sms') => {
    const loading = sending && state.lastChannel === channel;
    return (
      <PrimaryButton
        key={channel}
        label={
          loading
            ? label('fc_v2_app_label_sending_code', 'Sending code...')
            : channel === 'whatsapp'
              ? label('fc_v2_app_label_send_via_whatsapp', 'Send via WhatsApp')
              : label('fc_v2_app_label_send_via_sms', 'Send via SMS')
        }
        leadingIcon={loading ? undefined : channel === 'whatsapp' ? 'icon_whatsapp' : 'icon_sms'}
        onClick={() => void actions.sendOtp(channel)}
        disabled={sending || !valid}
        state={loading ? 'loading' : 'default'}
      />
    );
  };

  // AuthScreen.kt phone entry: heading 8 subtitle 24 [country | phone] 20 agreement card 12
  // channel buttons (8 apart) 8 consent paragraph.
  return (
    <div className="fcsdk-scroll">
      <div className="fcsdk-c-auth">
        <h2 className="fcsdk-c-title fc-t-titleLarge">
          {sending
            ? label('fc_v2_app_label_enter_phone_number', 'Enter phone number')
            : label('fc_v2_app_label_enter_your_phone_number', 'Enter your phone number')}
        </h2>
        <p className="fcsdk-c-subtitle fc-t-bodyMedium" style={{ marginTop: 8 }}>
          {sending
            ? label('fc_v2_app_label_send_otp_signin_short', 'And we will send you a one time code')
            : label('fc_v2_app_label_send_otp_signin', "We'll send a one-time code to sign you in")}
        </p>
        <div style={{ height: 24 }} />
        {state.countries.status === 'loading' ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <CircularProgress size={40} stroke={4} color="#00C950" />
          </div>
        ) : (
          <>
            <div className="fcsdk-c-phonerow">
              <button type="button" className="fcsdk-c-countrysel" onClick={props.onOpenCountryPicker}>
                <CountryFlag flag={state.selectedCountry?.flag} width={20} height={20} radius={8} />
                <span className="fc-t-bodyMedium">{state.countryCode}</span>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TextInput
                  value={state.phoneLocal}
                  onChange={actions.setPhoneLocal}
                  placeholder="00000 00000"
                  inputMode="tel"
                  type="tel"
                  error={!!state.phoneError}
                  ariaLabel={label('fc_v2_app_label_enter_your_phone_number', 'Enter your phone number')}
                />
                {state.phoneError ? (
                  <div className="fc-t-labelSmall" style={{ color: '#E5533D', marginTop: 8 }}>
                    {state.phoneError}
                  </div>
                ) : null}
              </div>
            </div>
            <div style={{ height: 20 }} />
            <div className="fcsdk-c-agreement">
              <div className="fcsdk-c-agreement-title">{label('fc_v2_app_label_agreement_card_title', 'What you are agreeing to:')}</div>
              <div className="fcsdk-c-agreement-points">
                {[
                  label('fc_v2_app_label_agreement_point_verification_code', 'A verification code by SMS or WhatsApp'),
                  label(
                    'fc_v2_app_label_agreement_point_updates',
                    'FarmerChat updates, farming information, and occasional surveys or research by SMS, phone, or WhatsApp',
                  ),
                ].map((t, i) => (
                  <div key={i} className="fcsdk-c-agreement-point">
                    <span className="fcsdk-c-agreement-bullet">•</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
              <div className="fcsdk-c-agreement-info">
                {label(
                  'fc_v2_app_label_agreement_card_info_text',
                  'Surveys or research may be conducted by Digital Green or trusted partners working with us.',
                )}
              </div>
            </div>
            <div style={{ height: 12 }} />
            <div className="fcsdk-c-section" style={{ gap: 8 }}>
              {state.availableChannels.isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={40} stroke={4} color="#00C950" />
                </div>
              ) : (
                <>
                  {state.availableChannels.whatsappEnabled ? channelButton('whatsapp') : null}
                  {state.availableChannels.smsEnabled ? channelButton('sms') : null}
                </>
              )}
            </div>
            <div style={{ height: 8 }} />
            <p className="fcsdk-c-consent">
              {label('fc_v2_app_label_auth_consent_prefix', 'By continuing, you agree to these communications.\nSee our ')}
              <span role="link" tabIndex={0} className="fcsdk-c-consent-link" onClick={props.onOpenPrivacy}>
                {label('fc_v2_app_label_privacy_policy', 'Privacy Policy')}
              </span>{' '}
              {label('fc_v2_app_label_auth_consent_suffix', 'for more information, including how to withdraw your consent.')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function OtpEntryContent(props: { state: ReturnType<typeof useAuth>[0]; actions: ReturnType<typeof useAuth>[1] }) {
  const label = useLabel();
  const { state, actions } = props;
  const verifying = state.verifyOtpState.status === 'loading';
  const verified = state.verifyOtpState.status === 'success';

  // AuthScreen.kt OTP: everything 16 apart — centred heading, start-aligned subtitle, four 64dp
  // boxes, red labelSmall error, 56dp Verify (chevron), then the countdown or Resend / Start over.
  return (
    <div className="fcsdk-scroll">
      <div className="fcsdk-c-auth" style={{ gap: 16, display: 'flex', flexDirection: 'column' }}>
        <h2 className="fcsdk-c-title fc-t-titleLarge">{label('fc_v2_app_label_enter_code_we_sent', 'Enter the code we sent')}</h2>
        <p className="fc-t-bodyMedium fcsdk-c-muted" style={{ margin: 0 }}>
          {label('fc_v2_app_label_check_your_messages_code', 'Check your messages for the code')}
        </p>
        <OtpInput value={state.otp} onChange={actions.setOtp} error={!!state.otpError} disabled={verifying || verified} />
        {state.otpError ? (
          <div className="fc-t-labelSmall" style={{ color: '#E5533D' }}>
            {state.otpError}
          </div>
        ) : null}
        <PrimaryButton
          height={56}
          label={verifying ? label('fc_v2_app_label_verifying', 'Verifying') : label('fc_v2_app_label_verify', 'Verify')}
          onClick={() => void actions.verifyOtp()}
          disabled={state.otp.length !== 4 || verifying || verified}
          state={verifying ? 'loading' : 'chevron'}
        />
        {!state.timerExpired ? (
          <div className="fc-t-bodySmall fcsdk-c-muted" style={{ textAlign: 'center' }}>
            {label('fc_v2_app_label_resend_code', 'Resend code')} · {state.secondsRemaining} {label('fc_v2_app_label_seconds', 'seconds')}
          </div>
        ) : (
          <div className="fcsdk-c-section" style={{ gap: 10 }}>
            <SecondaryButton label={label('fc_v2_app_label_resend_code', 'Resend code')} onClick={() => void actions.resendOtp()} />
            <SecondaryButton label={label('fc_v2_app_label_start_over', 'Start over')} onClick={actions.startOver} />
          </div>
        )}
      </div>
    </div>
  );
}
