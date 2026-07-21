/**
 * LanguageChooser — Settings→Language (docs/01 §3.13): radio list with
 * priority + "All languages" expand, per-row label-fetch loading, bottom
 * "Save language" / "Setting language" button; label-fetch failure →
 * onFetchLabelsFailure; success → toast + onLanguageSaved (delay 500 ms).
 */

import { useEffect } from 'react';
import { useLabel, useSdk } from '../context';
import { DefaultAppBar, Icon, LogoSpinner, PrimaryButton, RadioRow, Toast } from '../components/common';
import { useSettingsLanguage } from '../../state/useSettingsLanguage';
import { Screens } from '../../core/analytics';
import type { SupportedLanguage } from '../../core/types';

export function LanguageChooserScreen(props: {
  onOpenDrawer: () => void;
  onLanguageSaved: () => void;
  onFetchLabelsFailure: () => void;
}) {
  const { services, toast } = useSdk();
  const label = useLabel();
  const [state, actions] = useSettingsLanguage(services);

  useEffect(() => {
    services.analytics.screenView(Screens.LANGUAGE_CHOOSER);
    void actions.loadLanguages();
    return () => services.analytics.screenExit(Screens.LANGUAGE_CHOOSER);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.submitSuccess) {
      toast.show(label('language_saved_toast', 'Language updated.'));
      actions.consumeLanguageResult();
      const t = window.setTimeout(() => props.onLanguageSaved(), 500);
      return () => window.clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.submitSuccess]);

  useEffect(() => {
    if (state.labelsFetchFailed) props.onFetchLabelsFailure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.labelsFetchFailed]);

  useEffect(() => {
    if (state.submitErrorMessage) toast.show(state.submitErrorMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.submitErrorMessage]);

  const groups = state.languageState.status === 'success' ? state.languageState.data : null;

  const renderRow = (lang: SupportedLanguage) => (
    <RadioRow
      key={lang.id}
      label={lang.display_name ?? lang.name ?? String(lang.id)}
      selected={state.selectedLanguageId === lang.id}
      loading={state.fetchingLabelsForId === lang.id}
      disabled={state.fetchingLabelsForId !== null && state.fetchingLabelsForId !== lang.id}
      onClick={() => void actions.selectLanguage(lang)}
    />
  );

  return (
    <div className="fcsdk-screen">
      <DefaultAppBar title={label('language_chooser_title', 'Choose your language')} leadingIcon="menu" onLeadingClick={props.onOpenDrawer} />
      <div className="fcsdk-scroll fcsdk-pad">
        {!groups ? (
          <LogoSpinner message={label('language_loading', 'Loading languages…')} />
        ) : (
          <div role="radiogroup" aria-label={label('language_chooser_title', 'Choose your language')}>
            {groups.map((group, gi) => (
              <div key={gi}>
                {group.display_name ? <div className="fcsdk-sectionheader">{group.display_name}</div> : null}
                {(group.priority_view ?? []).map(renderRow)}
                {state.expandedLanguages ? (group.expanded_view ?? []).map(renderRow) : null}
              </div>
            ))}
            {groups.some((g) => (g.expanded_view ?? []).length > 0) && !state.expandedLanguages ? (
              <button type="button" className="fcsdk-btn-text" onClick={actions.toggleExpanded}>
                {label('language_all_languages', 'All languages')} {Icon.chevronDown}
              </button>
            ) : null}
          </div>
        )}
      </div>
      <div className="fcsdk-bottombar">
        <PrimaryButton
          label={state.isSubmitting ? label('language_saving_button', 'Setting language') : label('language_save_button', 'Save language')}
          onClick={() => void actions.submitLanguage()}
          disabled={state.selectedLanguageId === null || state.languageState.status !== 'success'}
          state={state.isSubmitting ? 'loading' : 'default'}
        />
      </div>
      <Toast message={toast.message} />
    </div>
  );
}
