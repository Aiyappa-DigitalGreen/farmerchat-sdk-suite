/**
 * Form inputs — 1:1 port of the Compose SDK components/Form.kt:
 * TextInput (white rounded-12 outlined field), RadioButton (full-width white
 * card, gray disc → green dot + translucent green fill when selected),
 * Checkbox (bordered chip card, no box indicator), OtpInput (4 × 64dp boxes),
 * SearchInput, CountryCodeSelector.
 */
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../context';
import { radius, typography } from '../theme';
import { OTP_LENGTH } from '../../state/useAuth';
import { FcIcon } from './Icon';

export function TextInputField(props: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  onSubmitEditing?: () => void;
  isError?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const [focused, setFocused] = useState(false);
  const borderColor = props.isError
    ? theme.brand.feedbackFail
    : focused
      ? c.borderActive
      : c.borderDefault;
  return (
    <TextInput
      testID={props.testID}
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      placeholderTextColor={c.foregroundSecondary}
      autoFocus={props.autoFocus}
      keyboardType={props.keyboardType}
      maxLength={props.maxLength}
      onSubmitEditing={props.onSubmitEditing}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      selectionColor={c.borderActive}
      style={[
        styles.textInput,
        typography.bodyLarge,
        {
          backgroundColor: c.surfaceSecondary,
          borderColor,
          borderWidth: focused || props.isError ? 2 : 0.5,
          color: c.foregroundPrimary,
        },
        props.style,
      ]}
    />
  );
}

/** Full-width card radio row (Form.kt RadioButton). */
export function RadioRow(props: {
  label: string;
  sublabel?: string | null;
  selected: boolean;
  loading?: boolean;
  enabled?: boolean;
  backgroundColor?: string;
  onPress: () => void;
  trailing?: React.ReactNode;
  testID?: string;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const bg = props.selected
    ? c.surfaceActive
    : props.backgroundColor ?? c.surfaceSecondary;
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: props.selected }}
      disabled={props.enabled === false}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.radioRow,
        { backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.radioOuter, { backgroundColor: c.surfaceSecondary }]}>
        <View
          style={{
            width: props.selected ? 10 : 20,
            height: props.selected ? 10 : 20,
            borderRadius: 10,
            backgroundColor: props.selected ? c.borderActive : c.surfaceTertiary,
          }}
        />
      </View>
      <Text
        numberOfLines={1}
        style={[
          typography.bodyMedium,
          { color: c.foregroundPrimary, flex: 1, marginLeft: 12 },
        ]}
      >
        {props.label}
      </Text>
      {props.loading ? (
        <ActivityIndicator
          size="small"
          color={c.borderActive}
          style={{ marginLeft: 14 }}
        />
      ) : (
        props.trailing ?? null
      )}
    </Pressable>
  );
}

/** Bordered chip-card checkbox (Form.kt Checkbox — no box indicator). */
export function CheckboxRow(props: {
  label: string;
  checked: boolean;
  enabled?: boolean;
  backgroundColor?: string;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const bg = props.checked ? c.surfaceActive : props.backgroundColor ?? c.surfaceSecondary;
  const border = props.checked ? c.borderActive : c.borderDefault;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: props.checked }}
      disabled={props.enabled === false}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.checkbox,
        { backgroundColor: bg, borderColor: border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[typography.bodySmall, { color: c.foregroundPrimary }]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

/** 4-digit OTP boxes (64dp, white, border 0.5 → 2 active/error). */
export function OtpInput(props: {
  value: string;
  onChange: (otp: string) => void;
  error?: string | null;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const inputRef = useRef<TextInput>(null);
  const digits = props.value.split('');
  const isError = !!props.error;
  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <View style={styles.otpRow}>
        {Array.from({ length: OTP_LENGTH }).map((_, i) => {
          const isActiveBox = digits.length === i && !isError;
          return (
            <View
              key={i}
              style={[
                styles.otpBox,
                {
                  backgroundColor: c.surfaceSecondary,
                  borderColor: isError
                    ? theme.brand.feedbackFail
                    : isActiveBox
                      ? c.borderActive
                      : c.borderDefault,
                  borderWidth: isActiveBox || isError ? 2 : 0.5,
                },
              ]}
            >
              <Text style={[typography.displaySmall, { color: c.foregroundPrimary }]}>
                {digits[i] ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={props.value}
        onChangeText={props.onChange}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoFocus
        style={styles.otpHidden}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
      />
      {props.error ? (
        <Text
          style={[
            typography.labelSmall,
            { color: theme.brand.feedbackFail, marginTop: 8 },
          ]}
        >
          {props.error}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function SearchInput(props: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const isActive = props.value.length > 0;
  return (
    <View
      style={[
        styles.search,
        {
          backgroundColor: c.surfaceSecondary,
          borderColor: isActive ? c.borderActive : c.borderDefault,
        },
      ]}
    >
      <FcIcon name="search" size={22} tint={c.foregroundSecondary} />
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={c.formPlaceholder}
        selectionColor={c.borderActive}
        style={[styles.searchField, typography.bodyMedium, { color: c.foregroundPrimary }]}
      />
    </View>
  );
}

export function CountryCodeSelector(props: {
  countryCode: string;
  flag?: string | null;
  onPress: () => void;
  loading?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.countrySelector,
        {
          backgroundColor: c.surfaceSecondary,
          borderColor: c.borderDefault,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={typography.bodyMedium}>{props.flag ?? '🇮🇳'}</Text>
      <Text style={[typography.bodyMedium, { color: c.foregroundPrimary }]}>
        {props.loading ? '…' : props.countryCode}
      </Text>
      <FcIcon name="chevronDown" size={14} tint={c.foregroundSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  textInput: {
    minHeight: 56,
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    borderRadius: radius.md,
    borderWidth: 0.5,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  otpRow: { flexDirection: 'row', gap: 8 },
  otpBox: {
    flex: 1,
    height: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpHidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    borderWidth: 0.5,
    paddingHorizontal: 12,
  },
  searchField: { flex: 1, minHeight: 48 },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 56,
    minWidth: 90,
    borderRadius: radius.md,
    borderWidth: 0.5,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
});
