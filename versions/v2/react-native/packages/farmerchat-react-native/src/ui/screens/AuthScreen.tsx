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
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { DefaultAppBar, Toast, useToastState } from '../components/Chrome';
import { CountryCodeSelector, OtpInput, TextInputField } from '../components/Inputs';
import { CountryPickerModal } from '../components/CountryPicker';
import { spacing, typography } from '../theme';

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <DefaultAppBar navIcon="close" onNavPress={props.onClose} title={null} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {state.step === 'PhoneEntry' ? (
            <>
              {/* App parity (AuthScreen.kt:801-814). THREE things were wrong, not just the type:
                  `auth_title` / `auth_subtitle` are SDK-invented keys that endpoint #3 serves for
                  nobody, so every farmer read the English fallback whatever their language; the
                  fallback copy was invented rather than the app's; and the headings sat at the
                  24 pt legacy `title` alias, left-aligned, where the app centres them at 22/17. */}
              <Text
                style={[
                  typography.titleLarge,
                  { color: theme.textPrimary, textAlign: 'center' },
                ]}
              >
                {label(Labels.ENTER_YOUR_PHONE_NUMBER, 'Enter your phone number')}
              </Text>
              <Text
                style={[
                  typography.bodyMedium,
                  { color: theme.textSecondary, textAlign: 'center' },
                ]}
              >
                {label(Labels.SEND_OTP_SIGNIN, "We'll send a one-time code to sign you in")}
              </Text>
              <View style={styles.phoneRow}>
                <CountryCodeSelector
                  countryCode={state.countryCode}
                  flag={state.selectedCountry?.flag ?? null}
                  loading={state.countries.kind === 'loading'}
                  onPress={() => setPickerVisible(true)}
                />
                <TextInputField
                  value={state.phoneLocal}
                  onChangeText={auth.setPhoneLocal}
                  placeholder="00000 00000"
                  keyboardType="phone-pad"
                  style={{ flex: 1 }}
                  testID="fc-auth-phone"
                />
              </View>
              {state.phoneError ? (
                <Text style={[typography.bodySmall, { color: theme.error }]}>
                  {state.phoneError}
                </Text>
              ) : null}
              {state.isLoadingChannels ? (
                <Text style={[typography.bodySmall, { color: theme.textTertiary }]}>
                  {label('auth_loading_channels', 'Checking available channels…')}
                </Text>
              ) : (
                <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                  {state.availableChannels.whatsappEnabled ? (
                    <PrimaryButton
                      label={label('auth_send_whatsapp', 'Get code on WhatsApp')}
                      state={isSending ? 'Loading' : 'Default'}
                      onPress={() => auth.sendOtp('whatsapp')}
                      testID="fc-auth-whatsapp"
                    />
                  ) : null}
                  {state.availableChannels.smsEnabled ? (
                    <SecondaryButton
                      label={label('auth_send_sms', 'Get code by SMS')}
                      enabled={!isSending}
                      onPress={() => auth.sendOtp('sms')}
                      testID="fc-auth-sms"
                    />
                  ) : null}
                </View>
              )}
              <Text style={[typography.caption, { color: theme.textTertiary }]}>
                {label('auth_legal_prefix', 'By continuing you agree to our')}{' '}
                <Text
                  style={{ color: theme.brandPrimary, textDecorationLine: 'underline' }}
                  onPress={() =>
                    props.onOpenLegal(
                      'https://digitalgreen.org/terms-of-use/',
                      label('fc_v2_app_label_terms_of_use', 'Terms of use'),
                    )
                  }
                >
                  {label('fc_v2_app_label_terms_of_use', 'Terms of use')}
                </Text>
              </Text>
            </>
          ) : (
            <>
              {/* App parity (AuthScreen.kt:1039-1050) — same three problems as the phone step.
                  Note the app's OTP subtitle is a FIXED sentence with no phone number and no
                  channel suffix interpolated into it. */}
              <Text
                style={[
                  typography.titleLarge,
                  { color: theme.textPrimary, textAlign: 'center' },
                ]}
              >
                {label(Labels.ENTER_CODE_WE_SENT, 'Enter the code we sent')}
              </Text>
              <Text
                style={[
                  typography.bodyMedium,
                  { color: theme.textSecondary, textAlign: 'center' },
                ]}
              >
                {label(Labels.CHECK_YOUR_MESSAGES_CODE, 'Check your messages for the code')}
              </Text>
              <OtpInput value={state.otp} onChange={auth.setOtp} error={state.otpError} />
              <PrimaryButton
                label={label('fc_v2_app_label_verify', 'Verify')}
                state={isVerifying ? 'Loading' : 'Default'}
                enabled={state.otp.length === 4}
                onPress={auth.verifyOtp}
                testID="fc-auth-verify"
              />
              {!state.timerExpired ? (
                <Text
                  style={[
                    typography.body,
                    { color: theme.textSecondary, textAlign: 'center' },
                  ]}
                >
                  {label('otp_resend_in', 'Resend code in {name}', {
                    name: formatTimer(state.timerSeconds),
                  })}
                </Text>
              ) : (
                <View style={{ gap: spacing.md }}>
                  <SecondaryButton
                    label={label('fc_v2_app_label_resend_code', 'Resend code')}
                    onPress={() => auth.resendOtp(state.sentVia ?? 'sms')}
                  />
                  <Text
                    onPress={() => {
                      sdk.analytics.track(AnalyticsEvents.START_OVER_CLICKED, {});
                      auth.startOver();
                    }}
                    style={[
                      typography.body,
                      {
                        color: theme.brandPrimary,
                        textAlign: 'center',
                        textDecorationLine: 'underline',
                      },
                    ]}
                  >
                    {label('fc_v2_app_label_start_over', 'Start over')}
                  </Text>
                </View>
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

function formatTimer(totalSeconds: number): string {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  phoneRow: { flexDirection: 'row', gap: spacing.md },
});
