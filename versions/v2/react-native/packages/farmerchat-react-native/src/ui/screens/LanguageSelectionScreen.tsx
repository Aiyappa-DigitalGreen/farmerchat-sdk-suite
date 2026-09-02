/**
 * Language selection onboarding (docs/01 §3.2) — 1:1 with the Compose SDK
 * LanguageScreen: light surface, black-tinted logo mark, displaySmall title,
 * white rounded-card radio rows (green fill + dot when selected), centered
 * white "All languages" pill, bottom white rounded-top bar with tagline,
 * dark-green chevron CTA and "Terms of use · Privacy policy" legal row.
 */
import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenNames } from '../../core/analytics';
import { Labels } from '../../core/labels';
import { StorageKeys } from '../../core/sessionStore';
import { useLabel, useSdk, useTheme } from '../context';
import { useOnboarding } from '../../state/useOnboarding';
import { PrimaryButton } from '../components/Buttons';
import { LogoMark, LogoSpinnerVertical } from '../components/Chrome';
import { RadioRow } from '../components/Inputs';
import { radius, typography } from '../theme';

export function LanguageSelectionScreen(props: {
  onLanguageSubmitted: () => void;
  onOpenLegal: (url: string, title: string) => void;
  onNavigateToError: (isNetworkError: boolean, fromScreen: string, retry: () => void) => void;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const sdk = useSdk();
  const label = useLabel();
  const insets = useSafeAreaInsets();
  const { state, dispatch, toggleExpanded } = useOnboarding(sdk);

  useEffect(() => {
    if (!sdk.store.getBoolean(StorageKeys.LANGUAGE_DONE)) {
      dispatch({ type: 'ResetState' });
    }
    dispatch({ type: 'FetchGeoLocation', fromScreen: 'language' });
    dispatch({ type: 'FetchLegalLinks' });
    sdk.analytics.trackScreenView(ScreenNames.LANGUAGE);
    return () => sdk.analytics.trackScreenExit(ScreenNames.LANGUAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.languageSubmitSuccess) {
      dispatch({ type: 'ConsumeLanguageResult' });
      props.onLanguageSubmitted();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.languageSubmitSuccess]);

  useEffect(() => {
    if (state.shouldNavigateToError) {
      dispatch({ type: 'ConsumeErrorNavigation' });
      props.onNavigateToError(state.errorIsNetworkError, state.errorFromScreen, () =>
        dispatch({ type: 'FetchGeoLocation', fromScreen: 'language' }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.shouldNavigateToError]);

  // Idle/Loading/Error → LogoSpinner; the app silently retries on error.
  const languageStateKind = state.languageState.kind;
  useEffect(() => {
    if (languageStateKind !== 'error') return;
    const timer = setTimeout(
      () => dispatch({ type: 'FetchGeoLocation', fromScreen: 'language' }),
      2000,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageStateKind]);

  if (state.languageState.kind !== 'success') {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: c.surfacePrimary }]}>
        <LogoSpinnerVertical
          messages={[
            label(Labels.FARMERCHAT_STARTING, 'FarmerChat is Starting…'),
            label(Labels.LOADING_LANGUAGES, 'Loading languages…'),
          ]}
        />
      </View>
    );
  }

  const groups = state.languageState.data;
  const priority = groups.flatMap((g) => g.priority_view);
  const expanded = groups.flatMap((g) => g.expanded_view);
  const hasExpanded = expanded.length > 0;
  const startEnabled = state.selectedLanguageId !== null && !state.isFetchingLabels;

  const renderRadio = (lang: (typeof priority)[number]) => (
    <RadioRow
      key={lang.id}
      label={lang.display_name || lang.name}
      selected={state.selectedLanguageId === lang.id}
      loading={state.fetchingLabelsForId === lang.id}
      onPress={() => dispatch({ type: 'SelectLanguage', languageId: lang.id })}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: c.surfacePrimary }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24 },
        ]}
      >
        <LogoMark size={44} color={c.foregroundPrimary} style={{ alignSelf: 'center' }} />
        <Text
          style={[
            typography.displaySmall,
            { color: c.foregroundPrimary, textAlign: 'center', marginTop: 20 },
          ]}
        >
          {label(Labels.CHOOSE_YOUR_LANGUAGE, 'Choose your language')}
        </Text>
        <Text
          style={[
            typography.bodyMedium,
            { color: c.foregroundSecondary, textAlign: 'center', marginTop: 6, marginBottom: 24 },
          ]}
        >
          {label(Labels.YOU_CHANGE_LATER, 'You can change this later')}
        </Text>

        <View style={{ gap: 6 }}>
          {priority.map(renderRadio)}

          {hasExpanded && !state.expandedLanguages ? (
            <Pressable
              accessibilityRole="button"
              onPress={toggleExpanded}
              style={({ pressed }) => [
                styles.allPill,
                { backgroundColor: c.surfaceSecondary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[typography.labelMedium, { color: c.foregroundPrimary }]}>
                {label(Labels.ALL_LANGUAGES, 'All languages')}
              </Text>
            </Pressable>
          ) : null}

          {state.expandedLanguages ? expanded.map(renderRadio) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: c.surfaceSecondary, paddingBottom: 12 + insets.bottom },
        ]}
      >
        <Text
          style={[
            typography.bodySmall,
            { color: c.foregroundSecondary, textAlign: 'center' },
          ]}
        >
          {label(Labels.FARMERCHAT_TAGLINE, 'Practical advice for your crops and animals')}
        </Text>

        <PrimaryButton
          label={
            state.isSubmittingLanguage
              ? label(Labels.SETTING_LANGUAGE, 'Setting language')
              : label(Labels.START_USING_FARMERCHAT, 'Start using FarmerChat')
          }
          state={state.isSubmittingLanguage ? 'Loading' : 'Chevron'}
          enabled={startEnabled}
          height={56}
          onPress={() => {
            dispatch({ type: 'AcceptTerms' });
            dispatch({ type: 'GetStartedClicked' });
          }}
        />

        <View style={styles.legal}>
          <Text
            style={[typography.labelSmall, { color: c.foregroundSecondary, textAlign: 'center' }]}
          >
            {label(Labels.BY_CONTINUING_YOU_AGREE_TO_OUR, 'By continuing you agree to our')}
          </Text>
          <View style={styles.legalRow}>
            <Text
              style={[styles.legalLink, typography.labelSmall, { color: c.foregroundPrimary }]}
              onPress={() =>
                state.termsOfUseUrl &&
                props.onOpenLegal(state.termsOfUseUrl, label(Labels.TERMS_OF_USE, 'Terms of use'))
              }
            >
              {label(Labels.TERMS_OF_USE, 'Terms of use')}
            </Text>
            <Text style={[typography.labelSmall, { color: c.foregroundSecondary }]}>·</Text>
            <Text
              style={[styles.legalLink, typography.labelSmall, { color: c.foregroundPrimary }]}
              onPress={() =>
                state.privacyPolicyUrl &&
                props.onOpenLegal(state.privacyPolicyUrl, label(Labels.PRIVACY_POLICY, 'Privacy policy'))
              }
            >
              {label(Labels.PRIVACY_POLICY, 'Privacy policy')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 16 },
  allPill: {
    alignSelf: 'center',
    marginTop: 10,
    borderRadius: radius.rounded,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  bottomBar: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  legal: { alignItems: 'center', gap: 2 },
  legalRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legalLink: { textDecorationLine: 'underline' },
});
