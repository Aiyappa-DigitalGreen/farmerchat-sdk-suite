/**
 * LanguageChooser — Settings → Language (docs/01 §3.13): radio list
 * (priority + "All languages" expand), per-row label-fetch loading,
 * bottom "Save language"/"Setting language" button.
 */
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenNames } from '../../core/analytics';
import { useLabel, useSdk, useTheme } from '../context';
import { useLanguageSettings } from '../../state/useSettings';
import { PrimaryButton } from '../components/Buttons';
import { DefaultAppBar, LogoSpinnerVertical, Toast, useToastState } from '../components/Chrome';
import { RadioRow } from '../components/Inputs';
import { spacing, typography } from '../theme';

export function LanguageChooserScreen(props: {
  onOpenDrawer: () => void;
  onLanguageSaved: () => void;
  onFetchLabelsFailure: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const sdk = useSdk();
  const label = useLabel();
  const settings = useLanguageSettings(sdk);
  const { state } = settings;
  const { toast, showToast } = useToastState();

  useEffect(() => {
    sdk.analytics.trackScreenView(ScreenNames.LANGUAGE_SETTINGS);
    settings.loadLanguages();
    return () => sdk.analytics.trackScreenExit(ScreenNames.LANGUAGE_SETTINGS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On success (+labels loaded) → toast → delayed onLanguageSaved (500 ms nav delay)
  useEffect(() => {
    if (state.submitSuccess) {
      showToast(label('language_saved', 'Language updated'), 'success');
      settings.consumeLanguageResult();
      const timer = setTimeout(() => props.onLanguageSaved(), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.submitSuccess]);

  useEffect(() => {
    if (state.labelsFetchFailed) {
      settings.consumeLanguageResult();
      props.onFetchLabelsFailure();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.labelsFetchFailed]);

  useEffect(() => {
    if (state.submitErrorMessage) {
      showToast(state.submitErrorMessage, 'error');
      settings.consumeLanguageResult();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.submitErrorMessage]);

  const languageGroups = state.languageState.kind === 'success' ? state.languageState.data : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <DefaultAppBar
        title={label('language_chooser_title', 'Choose your language')}
        navIcon="menu"
        onNavPress={props.onOpenDrawer}
      />
      {languageGroups === null ? (
        <View style={styles.spinnerWrap}>
          <LogoSpinnerVertical message={label('language_loading', 'Loading languages…')} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll}>
            {(state.expandedLanguages
              ? dedupeLanguages(languageGroups.flatMap((g) => [...g.priority_view, ...g.expanded_view]))
              : languageGroups.flatMap((g) => g.priority_view)
            ).map((lang) => (
              <RadioRow
                key={lang.id}
                label={lang.display_name}
                sublabel={lang.name !== lang.display_name ? lang.name : null}
                selected={state.selectedLanguageId === lang.id}
                loading={state.fetchingLabelsForId === lang.id}
                onPress={() => settings.selectLanguage(lang.id, lang.code)}
              />
            ))}
            {languageGroups.some((g) => g.expanded_view.length > 0) ? (
              <Text
                onPress={settings.toggleExpanded}
                style={[
                  typography.body,
                  { color: theme.brandPrimary, fontWeight: '600', paddingVertical: spacing.md },
                ]}
              >
                {state.expandedLanguages
                  ? label('language_show_less', 'Show fewer languages')
                  : label('language_all', 'All languages')}
              </Text>
            ) : null}
          </ScrollView>
          <View style={[styles.footer, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <PrimaryButton
              label={
                state.isSubmitting
                  ? label('language_saving', 'Setting language')
                  : label('language_save', 'Save language')
              }
              state={state.isSubmitting ? 'Loading' : 'Default'}
              enabled={state.selectedLanguageId !== null && state.fetchingLabelsForId === null}
              onPress={settings.submitLanguage}
            />
          </View>
        </>
      )}
      <Toast toast={toast} />
    </SafeAreaView>
  );
}

function dedupeLanguages<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  spinnerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  footer: { padding: spacing.lg, borderTopWidth: 1 },
});
