/**
 * SettingsName (docs/01 §3.11) — Back app bar "Name", normalized TextInput +
 * "Save name" (Loading/Default), min-3/max-100 validation with error toast;
 * one-shot onSaveComplete on API success.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenNames } from '../../core/analytics';
import { StorageKeys } from '../../core/sessionStore';
import { useLabel, useSdk, useTheme } from '../context';
import {
  NAME_MAX_LENGTH,
  normalizeNameInput,
  sanitizeStoredName,
  useEnterName,
} from '../../state/useEnterName';
import { PrimaryButton } from '../components/Buttons';
import { DefaultAppBar, Toast, useToastState } from '../components/Chrome';
import { TextInputField } from '../components/Inputs';
import { spacing } from '../theme';

export function SettingsNameScreen(props: {
  onBack: () => void;
  onSaveComplete: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const sdk = useSdk();
  const label = useLabel();
  const { state, dispatch, validateName } = useEnterName(sdk);
  const { toast, showToast } = useToastState();
  const [name, setName] = useState(() =>
    sanitizeStoredName(sdk.store.getString(StorageKeys.USER_NAME)),
  );

  useEffect(() => {
    sdk.analytics.trackScreenView('Settings Name Screen');
    return () => sdk.analytics.trackScreenExit('Settings Name Screen');
  }, [sdk]);

  useEffect(() => {
    if (state.updateUserNameState.kind === 'success') {
      dispatch({ type: 'ConsumeUpdateResult' });
      props.onSaveComplete();
    } else if (state.updateUserNameState.kind === 'error') {
      showToast(state.updateUserNameState.message, 'error');
      dispatch({ type: 'ConsumeUpdateResult' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.updateUserNameState.kind]);

  const save = () => {
    const validationError = validateName(name);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }
    const userId = sdk.session.userId;
    if (!userId) return;
    dispatch({
      type: 'UpdateUserName',
      body: { user_id: userId, name: name.trim() },
      screenName: ScreenNames.SETTINGS,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <DefaultAppBar
        title={label('fc_v2_app_label_name', 'Name')}
        navIcon="back"
        onNavPress={props.onBack}
      />
      <View style={styles.body}>
        <TextInputField
          value={name}
          onChangeText={(text) => setName(normalizeNameInput(text))}
          placeholder={label('fc_v2_app_label_your_name_or_nickname', 'Your name')}
          autoFocus
          maxLength={NAME_MAX_LENGTH}
          onSubmitEditing={save}
          testID="fc-settings-name-input"
        />
        <PrimaryButton
          label={label('fc_v2_app_label_save_name', 'Save name')}
          state={state.updateUserNameState.kind === 'loading' ? 'Loading' : 'Default'}
          enabled={name.trim().length >= 1}
          onPress={save}
        />
      </View>
      <Toast toast={toast} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: spacing.xl, gap: spacing.lg },
});
