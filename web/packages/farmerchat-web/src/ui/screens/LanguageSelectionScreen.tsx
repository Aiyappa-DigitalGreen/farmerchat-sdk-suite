/**
 * Language onboarding (docs/01 §3.2): logo, title/subtitle, radio list with
 * priority + expandable "All languages", per-row label-fetch loading, bottom
 * bar with tagline + "Start using FarmerChat" + legal links → legal modal.
 * languageState Idle/Loading/Error → LogoSpinner (errors silently retry).
 */

import { useEffect } from 'react';
import { useLabel, useSdk } from '../context';
import { Icon, LogoGlyph, LogoSpinner, PrimaryButton, RadioRow, Toast } from '../components/common';
import { useOnboardingLanguage } from '../../state/useOnboardingLanguage';
import { Screens, Events } from '../../core/analytics';
import type { SupportedLanguage } from '../../core/types';

export function LanguageSelectionScreen(props: {
  onLanguageSubmitted: () => void;
  onOpenLegal: (url: string, title: string) => void;
}) {
  const { services, toast } = useSdk();
  const label = useLabel();
  const [state, actions] = useOnboardingLanguage(services);

  useEffect(() => {
    services.analytics.screenView(Screens.LANGUAGE);
    void actions.bootstrap();
    void actions.fetchLegalLinks();
    return () => services.analytics.screenExit(Screens.LANGUAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.languageSubmitSuccess) {
      actions.consumeLanguageResult();
      props.onLanguageSubmitted();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.languageSubmitSuccess]);

  useEffect(() => {
    if (state.submitErrorMessage) toast.show(state.submitErrorMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.submitErrorMessage]);

  const languageGroups = state.languageState.status === 'success' ? state.languageState.data : null;

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
      <div className="fcsdk-scroll fcsdk-pad">
        <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden>
          <LogoGlyph />
        </div>
        <h2 style={{ margin: '4px 0 2px', fontSize: 22 }}>{label('language_title', 'Choose your language')}</h2>
        <p style={{ margin: '0 0 14px', color: 'var(--fc-text-muted)' }}>
          {label('language_subtitle', 'You can change this later')}
        </p>

        {!languageGroups ? (
          <LogoSpinner
            message={
              state.languageState.status === 'idle'
                ? label('splash_loading', 'FarmerChat is starting…')
                : label('language_loading', 'Loading languages…')
            }
          />
        ) : (
          <div role="radiogroup" aria-label={label('language_title', 'Choose your language')}>
            {languageGroups.map((group, gi) => (
              <div key={gi}>
                {group.display_name ? <div className="fcsdk-sectionheader">{group.display_name}</div> : null}
                {(group.priority_view ?? []).map(renderRow)}
                {state.expandedLanguages ? (group.expanded_view ?? []).map(renderRow) : null}
              </div>
            ))}
            {languageGroups.some((g) => (g.expanded_view ?? []).length > 0) && !state.expandedLanguages ? (
              <button type="button" className="fcsdk-btn-text" onClick={actions.toggleExpanded}>
                {label('language_all_languages', 'All languages')} {Icon.chevronDown}
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="fcsdk-bottombar">
        <div style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--fc-text-muted)' }}>
          {label('language_tagline', 'Your personal farming advisor')}
        </div>
        <PrimaryButton
          label={label('language_start_button', 'Start using FarmerChat')}
          onClick={() => void actions.getStartedClicked()}
          disabled={state.selectedLanguageId === null || state.languageState.status !== 'success'}
          state={state.isSubmittingLanguage ? 'loading' : 'default'}
        />
        <div className="fcsdk-legal-links">
          {label('language_legal_prefix', 'By continuing you agree to our')}{' '}
          <button
            type="button"
            onClick={() => {
              services.analytics.track(Events.TERMS_OF_USE_OPENED, {});
              if (state.termsOfUseUrl) props.onOpenLegal(state.termsOfUseUrl, label('legal_terms_title', 'Terms of use'));
            }}
          >
            {label('legal_terms_title', 'Terms of use')}
          </button>{' '}
          {label('language_legal_and', 'and')}{' '}
          <button
            type="button"
            onClick={() => {
              services.analytics.track(Events.PRIVACY_POLICY_OPENED, {});
              if (state.privacyPolicyUrl) props.onOpenLegal(state.privacyPolicyUrl, label('legal_privacy_title', 'Privacy policy'));
            }}
          >
            {label('legal_privacy_title', 'Privacy policy')}
          </button>
        </div>
      </div>
      <Toast message={toast.message} />
    </div>
  );
}
