/**
 * LanguageChooser — Settings→Language (docs/01 §3.13): radio list with
 * priority + "All languages" expand, per-row label-fetch loading, bottom
 * "Save language" / "Setting language" button; label-fetch failure →
 * onFetchLabelsFailure; success → toast + onLanguageSaved (delay 500 ms).
 */

import { useEffect } from 'react';
import { useLabel, useSdk } from '../context';
import { DefaultAppBar, LogoSpinner, PrimaryButton, RadioRow, Toast } from '../components/common';
import { languageRows } from './LanguageSelectionScreen';
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
      toast.show(label('fc_v2_app_label_language_updated', 'Language updated'), { kind: 'success' });
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
    if (state.submitErrorMessage) toast.show(state.submitErrorMessage, { kind: 'error' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.submitErrorMessage]);

  const groups = state.languageState.status === 'success' ? state.languageState.data : null;

  const renderRow = (lang: SupportedLanguage) => (
    <RadioRow
      key={lang.id}
      label={lang.display_name || lang.name || String(lang.id)}
      selected={state.selectedLanguageId === lang.id}
      loading={state.fetchingLabelsForId === lang.id}
      onClick={() => void actions.selectLanguage(lang)}
    />
  );

  const listing = groups ? languageRows(groups, state.expandedLanguages, state.selectedLanguageId) : null;

  // LanguageChooserScreen.kt: rows 6 apart in a 32/20/20 padded column, the "All languages" pill
  // centred after a 10dp spacer, and a flat white footer (16/24/8) holding the 56dp Save button.
  return (
    <div className="fcsdk-screen fcsdk-c-screen">
      <DefaultAppBar title={label('fc_v2_app_label_choose_your_language', 'Choose your language')} leadingIcon="menu" onLeadingClick={props.onOpenDrawer} />
      {!listing ? (
        <div className="fcsdk-c-center">
          <LogoSpinner message={label('fc_v2_app_label_loading_languages', 'Loading languages...')} />
        </div>
      ) : (
        <>
          <div className="fcsdk-scroll">
            <div
              className="fcsdk-c-section"
              style={{ gap: 6, padding: '32px 20px 20px' }}
              role="radiogroup"
              aria-label={label('fc_v2_app_label_choose_your_language', 'Choose your language')}
            >
              {listing.rows.map(renderRow)}
              {listing.hasMore && !state.expandedLanguages ? (
                <button type="button" className="fcsdk-c-chip-primary" style={{ marginTop: 10, alignSelf: 'center' }} onClick={actions.toggleExpanded}>
                  <span className="fc-t-labelLarge">{label('fc_v2_app_label_all_languages', 'All languages')}</span>
                </button>
              ) : null}
              <div style={{ height: 8 }} />
            </div>
          </div>
          <div className="fcsdk-c-footer">
            <PrimaryButton
              height={56}
              label={state.isSubmitting ? label('fc_v2_app_label_setting_language', 'Setting language') : label('fc_v2_app_label_save_language', 'Save language')}
              onClick={() => void actions.submitLanguage()}
              disabled={state.selectedLanguageId === null || state.fetchingLabelsForId !== null}
              state={state.isSubmitting ? 'loading' : 'chevron'}
            />
          </div>
        </>
      )}
      <Toast message={toast.message} />
    </div>
  );
}
