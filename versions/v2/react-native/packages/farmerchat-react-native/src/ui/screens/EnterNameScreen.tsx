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
  ScrollView,
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
import { typography } from '../theme';
import { Labels } from '../../core/labels';

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

  const trimmed = name.trim();
  // App: Save is "enabled" for 1..max chars (validation toasts 1–2 chars on tap); Chevron then.
  const canSave = trimmed.length >= 1 && trimmed.length <= NAME_MAX_LENGTH && !isSaving;
  const c = theme.content;

  // App EnterNameScreen.kt:100-218: one top-aligned scrolling column (24 sides, 32 top), the
  // buttons directly under the field — not pinned to the bottom.
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.surfacePrimary }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <LogoMark size={32} color={c.borderActive} style={{ alignSelf: 'center' }} />
          <View style={{ height: 14 }} />
          <Text style={[typography.titleLarge, { color: c.foregroundPrimary, textAlign: 'center' }]}>
            {label(Labels.WHAT_SHOULD_WE_CALL_YOU, 'What should we call you?')}
          </Text>
          <View style={{ height: 8 }} />
          <Text
            style={[typography.bodyMedium, { color: c.foregroundSecondary, textAlign: 'center', maxWidth: 260 }]}
          >
            {label(Labels.WE_GREET_YOU_NAME, 'So we can greet you by name')}
          </Text>
          <View style={{ height: 24 }} />
          <TextInputField
            value={name}
            onChangeText={(text) => setName(normalizeNameInput(text))}
            placeholder={label(Labels.YOUR_NAME_OR_NICKNAME, 'Your name or nickname')}
            autoFocus
            maxLength={NAME_MAX_LENGTH}
            onSubmitEditing={save}
            style={styles.stretch}
            testID="fc-name-input"
          />
          <View style={{ height: 16 }} />
          <PrimaryButton
            label={isSaving ? label(Labels.SAVING, 'Saving') : label(Labels.SAVE_NAME, 'Save name')}
            state={isSaving ? 'Loading' : canSave ? 'Chevron' : 'Default'}
            enabled={canSave}
            height={56}
            onPress={save}
            style={styles.stretch}
            testID="fc-name-save"
          />
          <View style={{ height: 12 }} />
          {showSkip ? (
            <SecondaryButton
              label={label(Labels.SKIP_FOR_NOW, 'Skip for now')}
              onPress={skip}
              backgroundColor={c.surfacePrimary}
              contentColor={c.foregroundPrimary}
              style={styles.stretch}
              testID="fc-name-skip"
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast toast={toast} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24, alignItems: 'center' },
  stretch: { alignSelf: 'stretch' },
});
