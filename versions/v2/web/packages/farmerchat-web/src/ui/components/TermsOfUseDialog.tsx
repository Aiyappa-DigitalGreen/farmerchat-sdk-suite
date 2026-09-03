/**
 * TermsOfUseDialog (**SDK 2.0.0**) — full-surface dialog rendering a Terms-of-Use / policy page
 * with an "Accept and continue" button pinned to the bottom.
 *
 * Port of the Compose reference `components/TermsOfUseDialog.kt`. Structure kept 1:1: close-left
 * app bar with a centred title, the document filling the middle with a spinner over it until the
 * page reports loaded, then an elevated footer surface lifting the accept button above the
 * scrolling content.
 *
 * Deviation, unavoidable: Compose loads the URL in an `AndroidView { WebView }`. The web has no
 * WebView, so the document goes in a sandboxed `<iframe>` — the same mechanism `LegalContentModal`
 * already uses for the 1.0.0 legal links, so a host that allows one allows the other. `sandbox`
 * is set for both, and the iframe is created only for a non-blank URL (the caller guarantees it).
 *
 * On analytics: the app tracks a Plotline ToS event on accept. Root CLAUDE.md §6 bans third-party
 * analytics inside SDK packages and §2 bans new event names, so this is a plain callback — the
 * caller owns whatever it reports, exactly as the Kotlin comments spell out.
 */

import { useEffect, useState } from 'react';
import { useLabel } from '../context';
import { DefaultAppBar, LogoSpinner, PrimaryButton } from './common';

export function TermsOfUseDialog(props: {
  /** Terms-of-use URL to load. The caller ensures it is non-blank. */
  url: string;
  /** Dialog header title. */
  title: string;
  /** Called when the user closes the dialog (scrim tap, Escape, or the X). */
  onDismiss: () => void;
  /** Called when the user taps "Accept and continue". */
  onAcceptAndContinue: () => void;
}) {
  const label = useLabel();
  const [loaded, setLoaded] = useState(false);

  // Compose gets back-button dismissal from `Dialog`; on the web that is Escape.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onDismiss]);

  return (
    <div className="fcsdk-modal-scrim" onClick={props.onDismiss}>
      <div
        className="fcsdk-modal fcsdk-terms"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
      >
        <DefaultAppBar title={props.title} leadingIcon="close" onLeadingClick={props.onDismiss} />

        <div className="fcsdk-terms-body">
          <iframe
            src={props.url}
            title={props.title}
            onLoad={() => setLoaded(true)}
            sandbox="allow-scripts allow-same-origin"
          />
          {!loaded ? (
            <div className="fcsdk-terms-loading">
              <LogoSpinner message={label('loading', 'Loading...')} />
            </div>
          ) : null}
        </div>

        {/* Elevated footer: lifts the accept button above the scrolling terms content. */}
        <div className="fcsdk-terms-footer">
          <PrimaryButton
            label={label('accept_and_continue', 'Accept and continue')}
            state="chevron"
            onClick={props.onAcceptAndContinue}
          />
        </div>
      </div>
    </div>
  );
}
