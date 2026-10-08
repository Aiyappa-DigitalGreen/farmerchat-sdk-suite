/**
 * Widget chrome styles. Every class is `fcw-` prefixed and nothing targets a
 * bare element, so the host page is untouched (web/CLAUDE.md: scoped styles,
 * no global resets). The SDK injects its own `.fcsdk-*` sheet separately.
 */
const STYLE_ELEMENT_ID = 'fcw-styles';

const css = `
.fcw-launcher {
  position: fixed; bottom: var(--fcw-offset-y); z-index: var(--fcw-z);
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  height: 56px; min-width: 56px; padding: 0; border: none; border-radius: 999px; cursor: pointer;
  background: var(--fcw-launcher-bg); color: var(--fcw-launcher-fg);
  box-shadow: 0 4px 14px rgba(0,0,0,0.22), 0 1px 3px rgba(0,0,0,0.12);
  font: 600 15px/1 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  transition: transform 160ms ease, box-shadow 160ms ease;
  -webkit-tap-highlight-color: transparent;
}
.fcw-launcher:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(0,0,0,0.26); }
.fcw-launcher:focus-visible { outline: 3px solid var(--fcw-launcher-bg); outline-offset: 3px; }
.fcw-launcher--extended { padding: 0 22px 0 18px; }
.fcw-launcher--right { right: var(--fcw-offset-x); }
.fcw-launcher--left { left: var(--fcw-offset-x); }
.fcw-launcher-icon { position: relative; display: inline-flex; width: 26px; height: 26px; }
.fcw-launcher-icon > * { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  transition: transform 200ms ease, opacity 200ms ease; }
.fcw-launcher-icon img { width: 26px; height: 26px; object-fit: contain; }
.fcw-launcher-icon .fcw-icon-close { opacity: 0; transform: rotate(-90deg) scale(0.6); }
.fcw-launcher--open .fcw-icon-open { opacity: 0; transform: rotate(90deg) scale(0.6); }
.fcw-launcher--open .fcw-icon-close { opacity: 1; transform: none; }

.fcw-panel {
  position: fixed; bottom: calc(var(--fcw-offset-y) + 56px + 16px); z-index: var(--fcw-z);
  width: var(--fcw-panel-w); height: var(--fcw-panel-h);
  max-height: calc(100vh - var(--fcw-offset-y) - 56px - 16px - 20px);
  border-radius: 16px; overflow: hidden; background: #fff;
  box-shadow: 0 12px 48px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.12);
  /* Makes the panel the containing block for any fixed-position descendant, so
     nothing the SDK renders can escape onto the host page. */
  transform: translateZ(0);
  transition: opacity 180ms ease, transform 180ms ease, visibility 0s linear 0s;
}
.fcw-panel--right { right: var(--fcw-offset-x); transform-origin: bottom right; }
.fcw-panel--left { left: var(--fcw-offset-x); transform-origin: bottom left; }
/* Closed panels stay MOUNTED (chat state survives a close) — only hidden. */
.fcw-panel--closed {
  visibility: hidden; opacity: 0; pointer-events: none; transform: translateY(12px) scale(0.98);
  transition: opacity 160ms ease, transform 160ms ease, visibility 0s linear 160ms;
}
.fcw-panel--fullscreen {
  inset: 0; width: 100%; height: 100%; max-height: none; border-radius: 0;
  bottom: 0; left: 0; right: 0;
}
.fcw-panel { display: flex; flex-direction: column; }
.fcw-panel-body { flex: 1 1 auto; min-height: 0; }
/* Fullscreen hides the launcher (it would cover the composer), so the panel gets
   its own slim bar to close from. It sits ABOVE the SDK rather than floating over
   it, so it can never cover an SDK control (the app bar's right-hand actions). */
.fcw-panel-bar {
  display: none; flex: 0 0 auto; align-items: center; justify-content: flex-end;
  height: 40px; padding: 0 6px; background: var(--fcw-launcher-bg); color: var(--fcw-launcher-fg);
}
.fcw-panel--fullscreen .fcw-panel-bar { display: flex; }
.fcw-panel-close {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; padding: 0 10px; border: none; border-radius: 999px; cursor: pointer;
  background: transparent; color: inherit; font: 600 14px/1 system-ui, -apple-system, sans-serif;
}
.fcw-panel-close:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }
.fcw-launcher--hidden { display: none; }
@media (prefers-reduced-motion: reduce) {
  .fcw-launcher, .fcw-panel, .fcw-launcher-icon > * { transition: none; }
}
`;

/** Injects the widget stylesheet once per document. */
export function ensureWidgetStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = css;
  doc.head.appendChild(style);
}
