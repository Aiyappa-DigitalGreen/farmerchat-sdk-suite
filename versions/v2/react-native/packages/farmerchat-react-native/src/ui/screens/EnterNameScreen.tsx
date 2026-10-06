/**
 * Enter Name (docs/01 §3.3) — logo, "What should we call you?", normalized
 * TextInput (autofocus), "Save name" (Loading/Chevron), animated "Skip for
 * now" hidden once text is typed; min-3/max-100 validation with error toast;
 * navigation only on API success.
 */
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalyticsEvents, ScreenNames } from '../../core/analytics';
import { StorageKeys } from '../../core/sessionStore';
import { useLabel, useSdk, useTheme } from '../context';
import {
  NAME_MAX_LENGTH,
  normalizeNameInput,
  sanitizeStoredName,
  useEnterName,
} from '../../state/useEnterName';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { LogoMark, Toast, useToastState } from '../components/Chrome';
import { TextInputField } from '../components/Inputs';
import { spacing, typography } from '../theme';

export function EnterNameScreen(props: { onDone: () => void }): React.ReactElement {
  const theme = useTheme();
  const sdk = useSdk();
  const label = useLabel();
  const { state, dispatch, profileState, fetchProfile, validateName } =
    useEnterName(sdk);
  const { toast, showToast } = useToastState();
  const [name, setName] = useState(() =>
    sanitizeStoredName(sdk.store.getString(StorageKeys.USER_NAME)),
  );

  useEffect(() => {
    sdk.analytics.trackScreenView(ScreenNames.NAME);
    // fetch profile when logged in; prefer the server name (EnterNameRoute)
    if (sdk.session.isAuthenticated) fetchProfile('name');
    return () => sdk.analytics.trackScreenExit(ScreenNames.NAME);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profileState.kind === 'success') {
      const server = sanitizeStoredName(sdk.store.getString(StorageKeys.USER_NAME));
      if (server) setName(server);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileState.kind]);

  // On API success: KEY_NAME_DONE + USER_NAME(+ADDED) saved by the hook →
  // ConsumeUpdateResult → routeFromSplash (one-time).
  useEffect(() => {
    if (state.updateUserNameState.kind === 'success') {
      sdk.store.set(StorageKeys.KEY_NAME_DONE, true);
      sdk.store.set(StorageKeys.KEY_NAME_SCREEN_SEEN, true);
      dispatch({ type: 'ConsumeUpdateResult' });
      props.onDone();
    } else if (state.updateUserNameState.kind === 'error') {
      showToast(state.updateUserNameState.message, 'error');
      dispatch({ type: 'ConsumeUpdateResult' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.updateUserNameState.kind]);

  const isSaving = state.updateUserNameState.kind === 'loading';
  const showSkip = name.trim().length === 0;

  const save = () => {
    const validationError = validateName(name);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }
    const userId = sdk.session.userId;
    if (!userId) {
      showToast(label('fc_v2_app_label_something_went_wrong_please_try_again', 'Something went wrong. Please try again.'), 'error');
      return;
    }
    dispatch({
      type: 'UpdateUserName',
      body: { user_id: userId, name: name.trim() },
      screenName: ScreenNames.NAME,
    });
  };

  const skip = () => {
    sdk.analytics.track(AnalyticsEvents.NAME_SKIP_CLICK, {});
    sdk.store.set(StorageKeys.KEY_NAME_DONE, true);
    sdk.store.set(StorageKeys.KEY_NAME_SCREEN_SEEN, true);
    props.onDone();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <LogoMark size={56} style={{ alignSelf: 'center' }} />
          {/* App parity (EnterNameScreen.kt:127): titleLarge (22), not the legacy `title` alias
              which is 24 — one type step too large. */}
          <Text style={[typography.titleLarge, { color: theme.textPrimary, textAlign: 'center' }]}>
            {label('fc_v2_app_label_what_should_we_call_you', 'What should we call you?')}
          </Text>
          <Text
            style={[typography.body, { color: theme.textSecondary, textAlign: 'center' }]}
          >
            {label('name_subtitle', 'We will use this to make FarmerChat personal to you')}
          </Text>
          <TextInputField
            value={name}
            onChangeText={(text) => setName(normalizeNameInput(text))}
            placeholder={label('fc_v2_app_label_your_name_or_nickname', 'Your name')}
            autoFocus
            maxLength={NAME_MAX_LENGTH}
            onSubmitEditing={save}
            testID="fc-name-input"
          />
        </View>
        <View style={styles.footer}>
          <PrimaryButton
            label={label('fc_v2_app_label_save_name', 'Save name')}
            state={isSaving ? 'Loading' : 'Chevron'}
            enabled={name.trim().length >= 1}
            onPress={save}
            testID="fc-name-save"
          />
          {showSkip ? (
            <SecondaryButton
              label={label('fc_v2_app_label_skip_for_now', 'Skip for now')}
              onPress={skip}
              testID="fc-name-skip"
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
      <Toast toast={toast} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  footer: { padding: spacing.xl, gap: spacing.md },
});
