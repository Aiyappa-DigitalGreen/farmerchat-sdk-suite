/**
 * Help (docs/01 §3.12): "How to use FarmerChat" FAQ list card (skeleton rows,
 * empty state, items → legal/FAQ iframe modal), "More" section (Terms/Privacy),
 * footer version + "© Digital Green". Error → error screen with retry.
 * Includes the LegalContentModal (docs/01 §3.17 dialog → iframe on web).
 */

import { useEffect, useState } from 'react';
import { useLabel, useSdk } from '../context';
import { DefaultAppBar, ListCard, ListItem, Skeleton } from '../components/common';
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

  return (
    <div className="fcsdk-screen">
      <DefaultAppBar title={label('fc_v2_app_label_help', 'Help')} leadingIcon="menu" onLeadingClick={props.onOpenDrawer} />
      <div className="fcsdk-scroll">
        <div className="fcsdk-sectionheader">{label('fc_v2_app_label_how_to_use_farmerchat', 'How to use FarmerChat')}</div>
        <ListCard>
          {state.helpState.status === 'loading' || state.helpState.status === 'idle' ? (
            <div className="fcsdk-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Skeleton height={18} />
              <Skeleton height={18} width="85%" />
              <Skeleton height={18} width="70%" />
            </div>
          ) : faqs.length === 0 ? (
            <div className="fcsdk-pad" style={{ color: 'var(--fc-text-muted)' }}>
              {label('help_faq_empty', 'No FAQs available right now.')}
            </div>
          ) : (
            faqs.map((faq, i) => (
              <ListItem
                key={faq.id ?? i}
                icon="❓"
                text={faq.question ?? faq.title ?? ''}
                onClick={() => {
                  services.analytics.track(Events.FAQ_CLICKED, { question: faq.question ?? faq.title ?? '' });
                  const url = faqUrl(faq);
                  if (url) props.onOpenUrl('faq', url, faq.title ?? faq.question ?? label('fc_v2_app_label_faq', 'FAQ'));
                }}
              />
            ))
          )}
        </ListCard>

        <div className="fcsdk-sectionheader">{label('fc_v2_app_label_more', 'More')}</div>
        <ListCard>
          <ListItem
            icon="📄"
            text={label('fc_v2_app_label_terms_of_use', 'Terms of use')}
            onClick={() => {
              services.analytics.track(Events.TERMS_OF_USE_OPENED, {});
              if (termsUrl) props.onOpenUrl('faq_terms', termsUrl, label('fc_v2_app_label_terms_of_use', 'Terms of use'));
            }}
          />
          <ListItem
            icon="🔒"
            text={label('fc_v2_app_label_privacy_policy', 'Privacy policy')}
            onClick={() => {
              services.analytics.track(Events.PRIVACY_POLICY_OPENED, {});
              if (privacyUrl) props.onOpenUrl('privacy', privacyUrl, label('fc_v2_app_label_privacy_policy', 'Privacy policy'));
            }}
          />
        </ListCard>

        <div className="fcsdk-feedfooter">
          {label('help_version', 'Version {version}', { version: SDK_VERSION })}
          <br />
          {label('fc_v2_app_label_digital_green', '© Digital Green')}
        </div>
      </div>
    </div>
  );
}

/** LegalContent dialog (docs/01 §3.17) — full-width iframe modal on web. */
export function LegalContentModal(props: { url: string; title: string; onClose: () => void }) {
  const { services } = useSdk();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    services.analytics.screenView(Screens.LEGAL_CONTENT, { url: props.url });
    return () => services.analytics.screenExit(Screens.LEGAL_CONTENT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fcsdk-modal-scrim" onClick={props.onClose}>
      <div className="fcsdk-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={props.title}>
        <DefaultAppBar title={props.title} leadingIcon="close" onLeadingClick={props.onClose} />
        {!loaded ? <Skeleton height={8} style={{ margin: 0, borderRadius: 0 }} /> : null}
        <iframe src={props.url} title={props.title} onLoad={() => setLoaded(true)} sandbox="allow-scripts allow-same-origin" />
      </div>
    </div>
  );
}
