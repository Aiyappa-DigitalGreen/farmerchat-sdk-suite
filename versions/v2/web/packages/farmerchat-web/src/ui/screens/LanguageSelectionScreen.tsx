/**
 * Language onboarding (docs/01 §3.2): logo, title/subtitle, radio list with
 * priority + expandable "All languages", per-row label-fetch loading, bottom
 * bar with tagline + "Start using FarmerChat" + legal links → legal modal.
 * languageState Idle/Loading/Error → LogoSpinner (errors silently retry).
 */

import { useEffect } from 'react';
import { useLabel, useSdk } from '../context';
import { LogoSpinner, PrimaryButton, RadioRow, Toast } from '../components/common';
import { FcIcon } from '../components/FcIcon';
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
      label={lang.display_name || lang.name || String(lang.id)}
      selected={state.selectedLanguageId === lang.id}
      loading={state.fetchingLabelsForId === lang.id}
      onClick={() => void actions.selectLanguage(lang)}
    />
  );

  if (!languageGroups) {
    // LanguageScreen.kt: until the list loads the WHOLE screen is one centred LogoSpinner
    // cycling two labels — no logo, title or subtitle above it.
    return (
      <div className="fcsdk-screen fcsdk-c-screen">
        <div className="fcsdk-c-center">
          <LogoSpinner
            labels={[
              label('fc_v2_app_label_farmerchat_starting', 'FarmerChat is Starting...'),
              label('fc_v2_app_label_loading_languages', 'Loading languages...'),
            ]}
          />
        </div>
      </div>
    );
  }

  const { rows, hasMore } = languageRows(languageGroups, state.expandedLanguages, state.selectedLanguageId);

  return (
    <div className="fcsdk-screen fcsdk-c-screen">
      <div className="fcsdk-scroll fcsdk-c-lang-scroll">
        <FcIcon name="logo_mark" size={32} tint="var(--fc-c-border-active)" title="FarmerChat" />
        <h2 className="fcsdk-c-title fc-t-titleLarge" style={{ marginTop: 14 }}>
          {label('fc_v2_app_label_choose_your_language', 'Choose your language')}
        </h2>
        <p className="fcsdk-c-subtitle fc-t-bodyMedium" style={{ marginTop: 8 }}>
          {label('fc_v2_app_label_you_change_later', 'You can change this later')}
        </p>
        <div
          className="fcsdk-c-lang-list"
          role="radiogroup"
          aria-label={label('fc_v2_app_label_choose_your_language', 'Choose your language')}
        >
          {rows.map(renderRow)}
        </div>
        {hasMore && !state.expandedLanguages ? (
          <button type="button" className="fcsdk-c-chip-primary" style={{ marginTop: 16 }} onClick={actions.toggleExpanded}>
            <span className="fc-t-labelLarge">{label('fc_v2_app_label_all_languages', 'All languages')}</span>
          </button>
        ) : null}
      </div>

      <div className="fcsdk-c-lang-panel">
        <div className="fcsdk-c-title fc-t-titleLarge">
          {label('fc_v2_app_label_farmerchat_tagline', 'FarmerChat: Practical advice for your crops & livestock')}
        </div>
        <PrimaryButton
          height={56}
          label={
            state.isSubmittingLanguage
              ? label('fc_v2_app_label_setting_language', 'Setting language')
              : label('fc_v2_app_label_start_using_farmerchat', 'Start using FarmerChat')
          }
          onClick={() => void actions.getStartedClicked()}
          disabled={state.selectedLanguageId === null || state.fetchingLabelsForId !== null}
          state={state.isSubmittingLanguage ? 'loading' : 'chevron'}
        />
        {/* LanguageScreen.kt LegalLinksRow: ONE justified caption paragraph (max 260dp), the
            links underlined in the same grey as the sentence, the full stop outside them. */}
        <p className="fcsdk-c-legal fc-t-caption">
          {label('fc_v2_app_label_by_continuing_you_agree_to_our', 'FarmerChat uses AI. By continuing, you agree to our')}{' '}
          <span
            role="link"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLElement).click(); }}
            onClick={() => {
              services.analytics.track(Events.TERMS_OF_USE_OPENED, { screen_name: Screens.LANGUAGE });
              if (state.termsOfUseUrl) props.onOpenLegal(state.termsOfUseUrl, label('fc_v2_app_label_terms_of_use', 'Terms of use'));
            }}
          >
            {label('fc_v2_app_label_terms_of_use', 'Terms of use')}
          </span>{' '}
          {alsoSee ? <>{alsoSee}{' '}</> : null}
          <span
            role="link"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLElement).click(); }}
            onClick={() => {
              services.analytics.track(Events.PRIVACY_POLICY_OPENED, { screen_name: Screens.LANGUAGE });
              if (state.privacyPolicyUrl) props.onOpenLegal(state.privacyPolicyUrl, label('fc_v2_app_label_privacy_policy', 'Privacy policy'));
            }}
          >
            {label('fc_v2_app_label_privacy_policy', 'Privacy policy')}
          </span>
          .
        </p>
      </div>
      <Toast message={toast.message} />
    </div>
  );
}

/**
 * LanguageDisplayOrder.rowsToShow: the groups are flattened (no headers). Collapsed, the
 * priority rows show, with the selection pinned to the top when it lives only in the
 * expanded list; expanded, priority then every expanded language.
 */
export function languageRows(
  groups: Array<{ priority_view?: SupportedLanguage[] | null; expanded_view?: SupportedLanguage[] | null }>,
  isExpanded: boolean,
  selectedId: number | null,
): { rows: SupportedLanguage[]; hasMore: boolean } {
  const priority = groups.flatMap((g) => g.priority_view ?? []);
  const expanded = groups.flatMap((g) => g.expanded_view ?? []);
  if (isExpanded) return { rows: [...priority, ...expanded], hasMore: expanded.length > 0 };
  const pinned =
    selectedId != null && !priority.some((l) => l.id === selectedId)
      ? expanded.find((l) => l.id === selectedId)
      : undefined;
  return { rows: pinned ? [pinned, ...priority] : priority, hasMore: expanded.length > 0 };
}
