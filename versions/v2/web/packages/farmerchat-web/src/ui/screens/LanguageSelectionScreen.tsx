/**
 * Language onboarding (docs/01 §3.2): logo, title/subtitle, radio list with
 * priority + expandable "All languages", per-row label-fetch loading, bottom
 * bar with tagline + "Start using FarmerChat" + legal links → legal modal.
 * languageState Idle/Loading/Error → LogoSpinner (errors silently retry).
 */

import { useEffect } from 'react';
import { useLabel, useSdk } from '../context';
import { LogoGlyph, LogoSpinner, PrimaryButton, RadioRow, Toast } from '../components/common';
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
  const alsoSee = label('fc_v2_app_label_also_see', 'also see').trim();

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
        <h2 style={{ margin: '4px 0 2px', fontSize: 22 }}>{label('fc_v2_app_label_choose_your_language', 'Choose your language')}</h2>
        <p style={{ margin: '0 0 14px', color: 'var(--fc-text-muted)' }}>
          {label('fc_v2_app_label_you_change_later', 'You can change this later')}
        </p>

        {!languageGroups ? (
          <LogoSpinner
            message={
              state.languageState.status === 'idle'
                ? label('fc_v2_app_label_farmerchat_starting', 'FarmerChat is starting…')
                : label('fc_v2_app_label_loading_languages', 'Loading languages…')
            }
          />
        ) : (
          <div role="radiogroup" aria-label={label('fc_v2_app_label_choose_your_language', 'Choose your language')}>
            {languageGroups.map((group, gi) => (
              <div key={gi}>
                {group.display_name ? <div className="fcsdk-sectionheader">{group.display_name}</div> : null}
                {(group.priority_view ?? []).map(renderRow)}
                {state.expandedLanguages ? (group.expanded_view ?? []).map(renderRow) : null}
              </div>
            ))}
            {/* App parity (LanguageScreen.kt:459-475): a FILLED PRIMARY pill — white on dark
                green at labelLarge, and NO chevron. The key is the app's real one; web's
                `language_all_languages` was an SDK invention that endpoint #3 never serves. */}
            {languageGroups.some((g) => (g.expanded_view ?? []).length > 0) && !state.expandedLanguages ? (
              <button
                type="button"
                className="fcsdk-btn-pill-primary"
                onClick={actions.toggleExpanded}
              >
                {label('fc_v2_app_label_all_languages', 'All languages')}
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="fcsdk-bottombar">
        {/* App parity (LanguageScreen.kt:250-252): the tagline is titleLarge (22px/700) on the
            primary text colour. Web had it at 13.5px muted AND with invented copy — "Your
            personal farming advisor" appears nowhere in the app, whose tagline label reads
            "FarmerChat: Practical advice for your crops & livestock". Real key restored. */}
        <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: 'var(--fc-text)' }}>
          {label(
            'fc_v2_app_label_farmerchat_tagline',
            'FarmerChat: Practical advice for your crops & livestock',
          )}
        </div>
        <PrimaryButton
          label={label('fc_v2_app_label_start_using_farmerchat', 'Start using FarmerChat')}
          onClick={() => void actions.getStartedClicked()}
          disabled={state.selectedLanguageId === null || state.languageState.status !== 'success'}
          state={state.isSubmittingLanguage ? 'loading' : 'default'}
        />
        <div className="fcsdk-legal-links">
          {/* The app's real server key, not the SDK short key this line used to carry:
              `language_legal_prefix` is served by nobody, so endpoint #3 could never translate
              it and every farmer read the English fallback. Copy from app b72ea4da. */}
          {label(
            'fc_v2_app_label_by_continuing_you_agree_to_our',
            'FarmerChat uses AI. By continuing, you agree to our',
          )}{' '}
          <button
            type="button"
            onClick={() => {
              services.analytics.track(Events.TERMS_OF_USE_OPENED, {});
              if (state.termsOfUseUrl) props.onOpenLegal(state.termsOfUseUrl, label('fc_v2_app_label_terms_of_use', 'Terms of use'));
            }}
          >
            {label('fc_v2_app_label_terms_of_use', 'Terms of use')}
          </button>{' '}
          {/* The served connector (`fc_v2_app_label_also_see` = "also see" on DEV), replacing
              the invented `language_legal_and` key — served by nobody — and its "and". A tenant
              that serves it empty gets the two links separated by one space, as the app
              degrades. */}
          {alsoSee ? <>{alsoSee}{' '}</> : null}
          <button
            type="button"
            onClick={() => {
              services.analytics.track(Events.PRIVACY_POLICY_OPENED, {});
              if (state.privacyPolicyUrl) props.onOpenLegal(state.privacyPolicyUrl, label('fc_v2_app_label_privacy_policy', 'Privacy policy'));
            }}
          >
            {label('fc_v2_app_label_privacy_policy', 'Privacy policy')}
          </button>
          {/* Outside the button so the full stop is neither underlined nor clickable. */}
          .
        </div>
      </div>
      <Toast message={toast.message} />
    </div>
  );
}
