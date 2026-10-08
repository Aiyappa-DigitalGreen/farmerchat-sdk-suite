/**
 * Help (docs/01 §3.12): "How to use FarmerChat" FAQ list card (skeleton rows,
 * empty state, items → legal/FAQ iframe modal), "More" section (Terms/Privacy),
 * footer version + "© Digital Green". Error → error screen with retry.
 * Includes the LegalContentModal (docs/01 §3.17 dialog → iframe on web).
 */

import { useEffect, useState } from 'react';
import { useLabel, useSdk } from '../context';
import { DefaultAppBar, ListCard, ListItem, LogoSpinner } from '../components/common';
import { useHelp } from '../../state/useHelp';
import { Events, Screens } from '../../core/analytics';
import { FARMERCHAT_VERSION } from '../../core/version';

export const SDK_VERSION = FARMERCHAT_VERSION;

export function HelpScreen(props: {
  onOpenDrawer: () => void;
  onOpenUrl: (kind: string, url: string, title: string) => void;
  onNavigateToError: (isNetworkError: boolean, retry: () => void) => void;
}) {
  const { services } = useSdk();
  const label = useLabel();
  const [state, actions] = useHelp(services);

  useEffect(() => {
    services.analytics.screenView(Screens.HELP);
    void actions.loadHelp();
    return () => services.analytics.screenExit(Screens.HELP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.reloadToken]);

  useEffect(() => {
    if (state.helpState.status === 'error') {
      props.onNavigateToError(state.helpState.isNetworkError, () => actions.reload());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.helpState.status]);

  const help = state.helpState.status === 'success' ? state.helpState.data : null;
  const faqs = help?.data?.faqs ?? [];
  const legal = help?.data?.legal ?? null;

  // The API sends `webview-url` (hyphen primary, underscore alternate); legal
  // entries are `{ title, "webview-url" }` objects (docs/02 / app HelpSupport).
  const faqUrl = (faq: (typeof faqs)[number]): string | null =>
    faq['webview-url'] ?? faq.webview_url ?? faq.url ?? null;
  const linkUrl = (link: unknown): string | null => {
    if (!link) return null;
    if (typeof link === 'string') return link;
    const l = link as { 'webview-url'?: string | null; webview_url?: string | null };
    return l['webview-url'] ?? l.webview_url ?? null;
  };
  const termsUrl = linkUrl(legal?.['terms-of-use'] ?? legal?.terms_of_use);
  const privacyUrl = linkUrl(legal?.['privacy-policy'] ?? legal?.privacy_policy);

  const loading = state.helpState.status === 'loading' || state.helpState.status === 'idle';

  // HelpScreen.kt: 32/20 padded column, sections 24 apart (10 inside), rows without icons, and
  // a literal "FarmerChat v.X" + "© Digital Green" caption footer.
  return (
    <div className="fcsdk-screen fcsdk-c-screen">
      <DefaultAppBar title={label('fc_v2_app_label_help', 'Help')} leadingIcon="menu" onLeadingClick={props.onOpenDrawer} />
      <div className="fcsdk-scroll">
        <div className="fcsdk-c-page" style={{ gap: 24 }}>
          <section className="fcsdk-c-section">
            <h3 className="fcsdk-c-section-title fc-t-labelLarge">{label('fc_v2_app_label_how_to_use_farmerchat', 'How to use FarmerChat?')}</h3>
            {loading ? (
              <div className="fcsdk-c-section" style={{ gap: 8 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="fcsdk-c-skeleton-bar" />
                ))}
              </div>
            ) : faqs.length === 0 ? (
              <p className="fcsdk-c-muted fc-t-bodyMedium" style={{ margin: 0 }}>
                {label('fc_v2_app_label_no_faqs_available', 'No FAQs available')}
              </p>
            ) : (
              <ListCard>
                {faqs.map((faq, i) => (
                  <ListItem
                    key={faq.id ?? i}
                    text={faq.title ?? faq.question ?? ''}
                    divider={i < faqs.length - 1}
                    onClick={() => {
                      services.analytics.track(Events.FAQ_CLICKED, { question: faq.question ?? faq.title ?? '' });
                      const url = faqUrl(faq);
                      if (url) props.onOpenUrl('faq', url, label('fc_v2_app_label_faq', 'FAQ'));
                    }}
                  />
                ))}
              </ListCard>
            )}
          </section>

          <section className="fcsdk-c-section">
            <h3 className="fcsdk-c-section-title fc-t-labelLarge">{label('fc_v2_app_label_more', 'More')}</h3>
            <ListCard>
              <ListItem
                text={label('fc_v2_app_label_terms_of_use', 'Terms of use')}
                divider
                onClick={() => {
                  services.analytics.track(Events.TERMS_OF_USE_OPENED, {});
                  if (termsUrl) props.onOpenUrl('faq_terms', termsUrl, label('fc_v2_app_label_terms_of_use', 'Terms of use'));
                }}
              />
              <ListItem
                text={label('fc_v2_app_label_privacy_policy', 'Privacy policy')}
                onClick={() => {
                  services.analytics.track(Events.PRIVACY_POLICY_OPENED, {});
                  if (privacyUrl) props.onOpenUrl('privacy', privacyUrl, label('fc_v2_app_label_privacy_policy', 'Privacy policy'));
                }}
              />
            </ListCard>
          </section>

          <div className="fcsdk-c-section" style={{ gap: 4, alignItems: 'center' }}>
            <span className="fcsdk-c-muted fc-t-caption">FarmerChat v.{SDK_VERSION}</span>
            <span className="fcsdk-c-muted fc-t-caption">{label('fc_v2_app_label_digital_green', '© Digital Green')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** LegalContent dialog (docs/01 §3.17) — full-width iframe modal on web. */
export function LegalContentModal(props: { url: string; title: string; onClose: () => void }) {
  const { services } = useSdk();
  const label = useLabel();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    services.analytics.screenView(Screens.LEGAL_CONTENT, { url: props.url });
    return () => services.analytics.screenExit(Screens.LEGAL_CONTENT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LegalContentScreen.kt: a full-bleed screen on surfaceReadingPrimary, Close-circle app bar,
  // and a centred "Loading..." LogoSpinner over the page until it loads.
  return (
    <div className="fcsdk-c-legalscreen" role="dialog" aria-label={props.title}>
      <DefaultAppBar title={props.title} leadingIcon="close" onLeadingClick={props.onClose} />
      <div className="fcsdk-c-legalscreen-body">
        <iframe src={props.url} title={props.title} onLoad={() => setLoaded(true)} sandbox="allow-scripts allow-same-origin" />
        {!loaded ? (
          <div className="fcsdk-c-legalscreen-loading">
            <LogoSpinner message={label('fc_v2_app_label_loading', 'Loading...')} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
