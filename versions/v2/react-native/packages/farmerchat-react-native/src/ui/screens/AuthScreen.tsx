/**
 * Auth (docs/01 §3.4) — two steps:
 *  PhoneEntry: country-code selector (+flag), phone input, WhatsApp/SMS send
 *  buttons (conditional on endpoint #20 channels), full-screen country picker.
 *  OtpEntry: 4-digit OtpInput, Verify, 180 s countdown, Resend/Start-over
 *  after timeout. No auto-submit. SMS Retriever / WhatsApp SDK / SIM prefill
 *  are Android-app-only (docs/03 fidelity map → manual entry + channel buttons).
 */
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalyticsEvents, ScreenNames } from '../../core/analytics';
import { Labels } from '../../core/labels';
import { useLabel, useSdk, useTheme } from '../context';
import { useAuth } from '../../state/useAuth';
import { PrimaryButton } from '../components/Buttons';
import { FcIcon } from '../components/Icon';
import { legalLinksOf } from '../../core/chatWire';
import { DefaultAppBar, Toast, useToastState } from '../components/Chrome';
import { CountryCodeSelector, OtpInput, TextInputField } from '../components/Inputs';
import { CountryPickerModal } from '../components/CountryPicker';
import { Neutral200, radius, typography } from '../theme';

export function AuthScreen(props: {
  onSuccess: (phoneE164: string, existingUser: boolean) => void;
  onClose: () => void;
  onOpenLegal: (url: string, title: string) => void;
}): React.ReactElement {
  const theme = useTheme();
  const sdk = useSdk();
  const label = useLabel();
  const auth = useAuth(sdk);
  const { state } = auth;
  const { toast, showToast } = useToastState();
  const [pickerVisible, setPickerVisible] = useState(false);
  // App AuthViewModel.fetchLegalLinks: the privacy-policy URL comes from endpoint privacy_policy;
  // the link opens only once a non-blank URL is known (AuthScreen.kt:490-493).
  const [privacyUrl, setPrivacyUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void sdk.api.getPrivacyPolicy().then((result) => {
      if (alive && result.ok) {
        setPrivacyUrl(legalLinksOf(result.data).privacyPolicyUrl);
      }
    });
    return () => {
      alive = false;
    };
  }, [sdk]);

  useEffect(() => {
    sdk.analytics.trackScreenView(ScreenNames.AUTH);
    sdk.analytics.track(AnalyticsEvents.MOBILE_VERIFICATION_STARTED, {});
    auth.fetchCountries();
    return () => sdk.analytics.trackScreenExit(ScreenNames.AUTH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // per-step screen view (AUTH + VERIFY_OTP)
  useEffect(() => {
    if (state.step === 'OtpEntry') {
      sdk.analytics.trackScreenView(ScreenNames.VERIFY_OTP);
      return () => sdk.analytics.trackScreenExit(ScreenNames.VERIFY_OTP);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  // channels refresh when the country code changes
  useEffect(() => {
    auth.refreshOtpModeForCountry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.countryCode]);

  useEffect(() => {
    if (state.toast) {
      showToast(state.toast.message, state.toast.kind === 'error' ? 'error' : 'info');
      auth.consumeToast();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.toast]);

  // verify success → delay 800 ms → onSuccess(e164, existingUser) (docs/01 §3.4)
  useEffect(() => {
    if (state.verifyOtpState.kind === 'success') {
      const phoneE164 = `${state.countryCode}${state.phoneLocal}`;
      const timer = setTimeout(
        () => props.onSuccess(phoneE164, state.existingUser),
        800,
      );
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.verifyOtpState.kind]);

  const isSending = state.sendOtpState.kind === 'loading';
  const isVerifying = state.verifyOtpState.kind === 'loading';
  const c = theme.content;
  // App: send buttons are enabled only for a valid number; an invalid tap toasts
  // PLEASE_CHECK_TRY_AGAIN (AuthScreen.kt:466-478).
  const canSend = !isSending && auth.isPhoneValid();
  const send = (channel: 'whatsapp' | 'sms') => {
    if (!auth.isPhoneValid()) {
      showToast(label(Labels.PLEASE_CHECK_TRY_AGAIN, 'Please check and try again.'), 'error');
      return;
    }
    auth.sendOtp(channel);
  };

  return (
    <SafeAreaView
      // DefaultAppBar draws under the status bar and pads its own top inset.
      edges={['left', 'right', 'bottom']}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* App: DefaultAppBar("Sign up", close, rounded, no glow, surfacePrimary) — AuthScreen.kt:426-433. */}
      <DefaultAppBar
        navIcon="close"
        onNavPress={props.onClose}
        title={label(Labels.SIGN_UP, 'Sign up')}
        showGlow={false}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {state.step === 'PhoneEntry' ? (
            <>
              {/* App PhoneEntryContent (AuthScreen.kt:783-929). */}
              <Text style={[typography.titleLarge, { color: c.foregroundPrimary, textAlign: 'center' }]}>
                {isSending
                  ? label(Labels.ENTER_PHONE_NUMBER, 'Enter phone number')
                  : label(Labels.ENTER_YOUR_PHONE_NUMBER, 'Enter your phone number')}
              </Text>
              <View style={{ height: 8 }} />
              <Text style={[typography.bodyMedium, { color: c.foregroundSecondary, textAlign: 'center' }]}>
                {isSending
                  ? label(Labels.SEND_OTP_SIGNIN_SHORT, 'And we will send you a one time code')
                  : label(Labels.SEND_OTP_SIGNIN, "We'll send a one-time code to sign you in")}
              </Text>
              <View style={{ height: 24 }} />
              <View style={styles.phoneRow}>
                <CountryCodeSelector
                  countryCode={state.countryCode}
                  flag={state.selectedCountry?.flag ?? null}
                  loading={state.countries.kind === 'loading' && state.selectedCountry == null}
                  onPress={() => {
                    if (!isSending) setPickerVisible(true);
                  }}
                />
                <TextInputField
                  value={state.phoneLocal}
                  onChangeText={(t) => auth.setPhoneLocal(t.replace(/\D/g, ''))}
                  placeholder="00000 00000"
                  keyboardType="phone-pad"
                  style={{ flex: 1 }}
                  testID="fc-auth-phone"
                />
              </View>
              {state.phoneError ? (
                <Text style={[typography.bodySmall, { color: theme.brand.feedbackFail, alignSelf: 'stretch' }]}>
                  {state.phoneError}
                </Text>
              ) : null}
              <View style={{ height: 20 }} />
              <AgreementCard label={label} />
              <View style={{ height: 12 }} />
              {isSending ? (
                <PrimaryButton
                  label={label(Labels.SENDING_CODE, 'Sending code...')}
                  state="Loading"
                  height={56}
                  onPress={() => undefined}
                  style={styles.stretch}
                />
              ) : (
                <View style={[styles.stretch, { gap: 8 }]}>
                  {state.availableChannels.whatsappEnabled ? (
                    <PrimaryButton
                      label={label(Labels.SEND_VIA_WHATSAPP, 'Send via WhatsApp')}
                      leadingIcon="whatsapp"
                      enabled={canSend}
                      onPress={() => send('whatsapp')}
                      testID="fc-auth-whatsapp"
                    />
                  ) : null}
                  {state.availableChannels.smsEnabled ? (
                    <PrimaryButton
                      label={label(Labels.SEND_VIA_SMS, 'Send via SMS')}
                      leadingIcon="sms"
                      enabled={canSend}
                      onPress={() => send('sms')}
                      testID="fc-auth-sms"
                    />
                  ) : null}
                </View>
              )}
              <View style={{ height: 8 }} />
              {/* AuthConsentText (:987-1023): prefix + underlined Privacy Policy link + suffix. */}
              <Text style={[styles.consent, { color: c.foregroundSecondary }]}>
                {label(Labels.AUTH_CONSENT_PREFIX, 'By continuing, you agree to these communications.\nSee our ')}
                <Text
                  style={{ textDecorationLine: 'underline' }}
                  onPress={() => {
                    // privacy_policy_opened is tracked by LegalContentScreen for every caller.
                    if (privacyUrl && privacyUrl.trim() !== '') {
                      props.onOpenLegal(privacyUrl, label(Labels.PRIVACY_POLICY, 'Privacy Policy'));
                    }
                  }}
                >
                  {label(Labels.PRIVACY_POLICY, 'Privacy Policy')}
                </Text>
                {' ' +
                  label(
                    Labels.AUTH_CONSENT_SUFFIX,
                    'for more information, including how to withdraw your consent.',
                  )}
              </Text>
            </>
          ) : (
            <>
              {/* App OtpEntryContent (AuthScreen.kt:1025-1146). The subtitle is a fixed sentence. */}
              <Text style={[typography.titleLarge, { color: c.foregroundPrimary, textAlign: 'center' }]}>
                {label(Labels.ENTER_CODE_WE_SENT, 'Enter the code we sent')}
              </Text>
              <View style={{ height: 8 }} />
              <Text style={[typography.bodyMedium, { color: c.foregroundSecondary, textAlign: 'center' }]}>
                {label(Labels.CHECK_YOUR_MESSAGES_CODE, 'Check your messages for the code')}
              </Text>
              <View style={{ height: 24 }} />
              <View style={styles.stretch}>
                <OtpInput value={state.otp} onChange={auth.setOtp} error={state.otpError} />
              </View>
              <View style={{ height: 16 }} />
              <PrimaryButton
                label={
                  isVerifying ? label(Labels.VERIFYING, 'Verifying') : label(Labels.VERIFY, 'Verify')
                }
                state={isVerifying ? 'Loading' : 'Default'}
                height={56}
                enabled={state.otp.length === 4 && !isVerifying}
                onPress={auth.verifyOtp}
                testID="fc-auth-verify"
                style={styles.stretch}
              />
              <View style={{ height: 16 }} />
              {!state.timerExpired ? (
                <>
                  <View style={styles.timerRow}>
                    <View style={[styles.timerDot, { backgroundColor: theme.brand.feedbackSuccess }]}>
                      <FcIcon name="history" size={18} tint="#FFFFFF" />
                    </View>
                    <Text style={[typography.bodyMedium, { color: c.foregroundPrimary }]}>
                      {`${label(Labels.PLEASE_ENTER, 'Please enter in')} ${formatTimer(state.timerSeconds)} ${label(Labels.SECONDS, 'seconds')}`}
                    </Text>
                  </View>
                  <View style={{ height: 16 }} />
                  {/* Disabled while the timer runs. */}
                  <Text style={[typography.labelLarge, styles.textAction, { color: c.foregroundSecondary }]}>
                    {label(Labels.RESEND_CODE, 'Resend code')}
                  </Text>
                </>
              ) : (
                <>
                  <Text
                    accessibilityRole="button"
                    onPress={
                      isVerifying
                        ? undefined
                        : () => {
                            sdk.analytics.track(AnalyticsEvents.START_OVER_CLICKED, {});
                            auth.startOver();
                          }
                    }
                    style={[
                      typography.labelLarge,
                      styles.textAction,
                      { color: isVerifying ? c.foregroundSecondary : c.foregroundPrimary },
                    ]}
                  >
                    {label(Labels.START_OVER, 'Start over')}
                  </Text>
                  <View style={{ height: 8 }} />
                  <Text
                    accessibilityRole="button"
                    onPress={isVerifying ? undefined : () => auth.resendOtp(state.sentVia ?? 'sms')}
                    style={[
                      typography.labelLarge,
                      styles.textAction,
                      { color: isVerifying ? c.foregroundSecondary : c.foregroundPrimary },
                    ]}
                  >
                    {label(Labels.RESEND_CODE, 'Resend code')}
                  </Text>
                </>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <CountryPickerModal
        visible={pickerVisible}
        countries={state.countries.kind === 'success' ? state.countries.data : []}
        isLoading={state.countries.kind === 'loading'}
        initialSelected={state.selectedCountry}
        onClose={() => setPickerVisible(false)}
        onSave={(country) => {
          auth.selectCountry(country);
          setPickerVisible(false);
        }}
      />
      <Toast toast={toast} />
    </SafeAreaView>
  );
}

/** App AgreementCard (AuthScreen.kt:931-985): Neutral200 card, radius LG, black copy. */
function AgreementCard(props: { label: (key: string, fallback: string) => string }): React.ReactElement {
  const { label } = props;
  const bullet = (text: string) => (
    <View style={styles.bulletRow}>
      <Text style={[styles.agreeText, { width: 16 }]}>•</Text>
      <Text style={[styles.agreeText, { flex: 1 }]}>{text}</Text>
    </View>
  );
  return (
    <View style={[styles.agreement, { backgroundColor: Neutral200 }]}>
      <Text style={styles.agreeTitle}>{label(Labels.AGREEMENT_CARD_TITLE, 'What you are agreeing to:')}</Text>
      <View style={{ height: 8 }} />
      <View style={{ gap: 2 }}>
        {bullet(label(Labels.AGREEMENT_POINT_VERIFICATION_CODE, 'A verification code by SMS or WhatsApp'))}
        {bullet(
          label(
            Labels.AGREEMENT_POINT_UPDATES,
            'FarmerChat updates, farming information, and occasional surveys or research by SMS, phone, or WhatsApp',
          ),
        )}
      </View>
      <View style={{ height: 8 }} />
      <Text style={styles.agreeInfo}>
        {label(
          Labels.AGREEMENT_CARD_INFO_TEXT,
          'Surveys or research may be conducted by Digital Green or trusted partners working with us.',
        )}
      </Text>
    </View>
  );
}

/** App formatTimer (AuthScreen.kt:1148-1152): "m:ss". */
export function formatOtpTimer(totalSeconds: number): string {
  const secs = Math.max(0, totalSeconds);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}
const formatTimer = formatOtpTimer;

const styles = StyleSheet.create({
  container: { flex: 1 },
  // App: 20 side padding, 32 top, 24 bottom, centred column.
  scroll: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 24, alignItems: 'center' },
  stretch: { alignSelf: 'stretch' },
  phoneRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  agreement: { alignSelf: 'stretch', borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 12 },
  agreeTitle: { fontWeight: '700', fontSize: 18, color: '#000000' },
  agreeText: { fontSize: 15, color: '#000000' },
  agreeInfo: { fontWeight: '700', fontSize: 14, fontStyle: 'italic', color: '#000000' },
  bulletRow: { flexDirection: 'row' },
  consent: { fontSize: 15, textAlign: 'center', alignSelf: 'stretch' },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  timerDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  textAction: { textAlign: 'center', paddingVertical: 8 },
});
