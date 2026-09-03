/**
 * Design tokens + scoped stylesheet. Green brand surface (#146152-family, per
 * docs/03 "Design tokens"), day/night palettes, mobile-first, embeddable in a
 * container div. Appearance `auto` follows prefers-color-scheme.
 */

import type { AppearanceMode, FarmerChatTheme, FarmerChatThemeColors } from '../core/config';

export const STYLE_ELEMENT_ID = 'farmerchat-web-styles';

const css = `
.fcsdk-root {
  --fc-brand: #146152;
  --fc-brand-deep: #0e4a3e;
  --fc-brand-bright: #1b7a67;
  --fc-brand-soft: #e3f0ec;
  --fc-accent: #f2c94c;
  --fc-danger: #c94f3d;
  --fc-radius: 14px;
  --fc-radius-lg: 22px;
  --fc-radius-btn: 999px;
  --fc-radius-input: 12px;
  --fc-radius-bubble: 20px;
  --fc-font-scale: 1;
  --fc-font: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif;
}
.fcsdk-root[data-fc-theme="day"] {
  --fc-bg: #ffffff;
  --fc-surface: #f4f7f5;
  --fc-surface-reading: #f7f5ef;
  --fc-card: #ffffff;
  --fc-text: #1c2b26;
  --fc-text-muted: #5b6f68;
  --fc-border: #dbe5e1;
  --fc-bubble-user: #146152;
  --fc-bubble-user-text: #ffffff;
  --fc-bubble-ai: #ffffff;
  --fc-chip: #e3f0ec;
  --fc-chip-text: #146152;
  --fc-appbar: #146152;
  --fc-appbar-text: #ffffff;
  --fc-overlay: rgba(12, 28, 23, 0.55);
  --fc-skeleton: #e4eae7;
}
.fcsdk-root[data-fc-theme="night"] {
  --fc-bg: #0e1a16;
  --fc-surface: #142420;
  --fc-surface-reading: #12201b;
  --fc-card: #1a2e28;
  --fc-text: #e8f1ed;
  --fc-text-muted: #9db3ab;
  --fc-border: #2a4038;
  --fc-bubble-user: #1b7a67;
  --fc-bubble-user-text: #ffffff;
  --fc-bubble-ai: #1a2e28;
  --fc-chip: #1e3a32;
  --fc-chip-text: #9fd8c9;
  --fc-appbar: #0e4a3e;
  --fc-appbar-text: #ffffff;
  --fc-overlay: rgba(0, 0, 0, 0.65);
  --fc-skeleton: #22362f;
}

.fcsdk-root {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 480px;
  overflow: hidden;
  background: var(--fc-bg);
  color: var(--fc-text);
  font-family: var(--fc-font);
  font-size: calc(15px * var(--fc-font-scale, 1));
  line-height: 1.45;
  border-radius: var(--fc-radius);
  box-sizing: border-box;
}
/* Inline embedding (docs/07 C1): fill the host container flush, no rounded frame. */
.fcsdk-root--inline { border-radius: 0; height: 100%; }
.fcsdk-root *, .fcsdk-root *::before, .fcsdk-root *::after { box-sizing: border-box; }
.fcsdk-root button { font-family: inherit; cursor: pointer; }
.fcsdk-root input, .fcsdk-root textarea { font-family: inherit; }
.fcsdk-root img { max-width: 100%; }

/* --- layout ------------------------------------------------------------- */
.fcsdk-screen { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.fcsdk-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; min-height: 0; }
.fcsdk-pad { padding: 16px; }

/* --- app bars ------------------------------------------------------------ */
.fcsdk-appbar {
  display: flex; align-items: center; gap: 10px;
  min-height: 54px; padding: 0 10px;
  background: var(--fc-appbar); color: var(--fc-appbar-text);
  flex-shrink: 0;
}
.fcsdk-appbar-title { font-size: 17px; font-weight: 600; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fcsdk-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border: none; border-radius: 50%;
  background: transparent; color: inherit; font-size: 20px; line-height: 1;
}
.fcsdk-iconbtn:hover { background: rgba(255,255,255,0.12); }
.fcsdk-appbar .fcsdk-weatherbtn {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid rgba(255,255,255,0.35); border-radius: 999px;
  background: rgba(255,255,255,0.1); color: inherit;
  padding: 6px 12px; font-size: 14px; font-weight: 600;
}

/* --- buttons ------------------------------------------------------------- */
.fcsdk-btn-primary {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; min-height: 48px; padding: 12px 18px;
  border: none; border-radius: var(--fc-radius-btn);
  background: var(--fc-brand); color: #fff;
  font-size: 16px; font-weight: 700;
  transition: background 0.15s ease, transform 0.05s ease;
}
.fcsdk-btn-primary:hover:not(:disabled) { background: var(--fc-brand-bright); }
.fcsdk-btn-primary:active:not(:disabled) { transform: scale(0.985); }
.fcsdk-btn-primary:disabled { opacity: 0.5; cursor: default; }
.fcsdk-btn-primary--light { background: #fff; color: var(--fc-brand); }
.fcsdk-btn-primary--light:hover:not(:disabled) { background: #f1efe6; }
.fcsdk-btn-secondary {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; min-height: 46px; padding: 11px 18px;
  border: 1.5px solid var(--fc-brand); border-radius: var(--fc-radius-btn);
  background: transparent; color: var(--fc-brand);
  font-size: 15px; font-weight: 600;
}
.fcsdk-root[data-fc-theme="night"] .fcsdk-btn-secondary { border-color: var(--fc-chip-text); color: var(--fc-chip-text); }
.fcsdk-btn-secondary:disabled { opacity: 0.5; cursor: default; }
.fcsdk-btn-text {
  border: none; background: transparent; color: var(--fc-brand);
  font-size: 14px; font-weight: 600; padding: 8px 10px; border-radius: 8px;
}
.fcsdk-root[data-fc-theme="night"] .fcsdk-btn-text { color: var(--fc-chip-text); }

/* --- forms ---------------------------------------------------------------- */
.fcsdk-input {
  width: 100%; min-height: 48px; padding: 12px 14px;
  border: 1.5px solid var(--fc-border); border-radius: var(--fc-radius-input);
  background: var(--fc-card); color: var(--fc-text); font-size: 16px;
  outline: none;
}
.fcsdk-input:focus { border-color: var(--fc-brand-bright); }
.fcsdk-radiorow {
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 13px 14px; border: none; text-align: left;
  background: transparent; color: var(--fc-text); font-size: 16px;
  border-radius: 12px;
}
.fcsdk-radiorow:hover { background: var(--fc-surface); }
.fcsdk-radiorow[aria-checked="true"] { background: var(--fc-brand-soft); }
.fcsdk-root[data-fc-theme="night"] .fcsdk-radiorow[aria-checked="true"] { background: var(--fc-chip); }
.fcsdk-radio-dot {
  width: 20px; height: 20px; border-radius: 50%;
  border: 2px solid var(--fc-text-muted); flex-shrink: 0; position: relative;
}
.fcsdk-radiorow[aria-checked="true"] .fcsdk-radio-dot { border-color: var(--fc-brand-bright); }
.fcsdk-radiorow[aria-checked="true"] .fcsdk-radio-dot::after {
  content: ""; position: absolute; inset: 3px; border-radius: 50%; background: var(--fc-brand-bright);
}
.fcsdk-otp { display: flex; gap: 10px; justify-content: center; }
.fcsdk-otp input {
  width: 52px; height: 56px; text-align: center; font-size: 24px; font-weight: 700;
  border: 1.5px solid var(--fc-border); border-radius: var(--fc-radius-input);
  background: var(--fc-card); color: var(--fc-text); outline: none;
}
.fcsdk-otp input:focus { border-color: var(--fc-brand-bright); }
.fcsdk-checkboxrow { display: flex; align-items: center; gap: 12px; padding: 12px 14px; width: 100%;
  border: none; background: transparent; color: var(--fc-text); font-size: 15px; text-align: left; border-radius: 12px; }
.fcsdk-checkboxrow:hover { background: var(--fc-surface); }
.fcsdk-checkbox { width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--fc-text-muted);
  display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 13px; flex-shrink: 0; }
.fcsdk-checkboxrow[aria-checked="true"] .fcsdk-checkbox { background: var(--fc-brand-bright); border-color: var(--fc-brand-bright); }

/* --- spinner / skeleton ----------------------------------------------------- */
@keyframes fcsdk-spin { to { transform: rotate(360deg); } }
@keyframes fcsdk-splash-spin { 0% { transform: rotate(0); } 70% { transform: rotate(0); } 100% { transform: rotate(360deg); } }
.fcsdk-spinner {
  width: 34px; height: 34px; border-radius: 50%;
  border: 3px solid var(--fc-border); border-top-color: var(--fc-brand-bright);
  animation: fcsdk-spin 0.9s linear infinite;
}
.fcsdk-logospinner { display: flex; flex-direction: column; align-items: center; gap: 14px; justify-content: center; padding: 40px 20px; color: var(--fc-text-muted); }
@keyframes fcsdk-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
.fcsdk-skeleton { background: var(--fc-skeleton); border-radius: 10px; animation: fcsdk-pulse 1.4s ease-in-out infinite; }

/* --- toast --------------------------------------------------------------------- */
.fcsdk-toast {
  position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%);
  max-width: calc(100% - 40px); padding: 10px 18px; border-radius: 999px;
  background: rgba(20, 32, 28, 0.92); color: #fff; font-size: 14px;
  z-index: 60; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* --- full screen message (green) ----------------------------------------------- */
.fcsdk-fullmsg {
  display: flex; flex-direction: column; flex: 1; min-height: 0;
  background: var(--fc-brand); color: #fff;
}
.fcsdk-fullmsg-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px; text-align: center; overflow-y: auto; }
.fcsdk-fullmsg-title { font-size: 24px; font-weight: 800; }
.fcsdk-fullmsg-sub { font-size: 15px; opacity: 0.92; max-width: 340px; }
.fcsdk-fullmsg-illustration { font-size: 64px; line-height: 1; filter: drop-shadow(0 0 24px rgba(242, 201, 76, 0.45)); }
.fcsdk-fullmsg-footer { padding: 18px 20px 22px; display: flex; flex-direction: column; gap: 10px; }
.fcsdk-fullmsg .fcsdk-btn-secondary { border-color: rgba(255,255,255,0.7); color: #fff; }

/* --- splash ------------------------------------------------------------------------ */
.fcsdk-splash {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 18px; background: linear-gradient(160deg, var(--fc-brand-deep), var(--fc-brand) 55%, var(--fc-brand-bright));
  color: #fff;
}
.fcsdk-logo-mark {
  width: 72px; height: 72px; border-radius: 22px;
  background: rgba(255,255,255,0.14); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 40px;
  animation: fcsdk-splash-spin 4s ease-in-out infinite;
}

/* --- home ---------------------------------------------------------------------------- */
.fcsdk-greeting { font-size: 21px; font-weight: 800; padding: 18px 16px 6px; }
.fcsdk-feedheader { font-size: 16px; font-weight: 700; padding: 18px 16px 8px; color: var(--fc-text); }
.fcsdk-feedfooter { text-align: center; color: var(--fc-text-muted); font-size: 13px; padding: 26px 16px 90px; }
.fcsdk-sticky-inputs { position: sticky; top: 0; z-index: 12; background: var(--fc-bg); padding: 10px 12px; border-bottom: 1px solid var(--fc-border); }
.fcsdk-inputbtns { display: flex; gap: 8px; }
.fcsdk-inputbtn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
  min-height: 46px; border: 1.5px solid var(--fc-border); border-radius: 999px;
  background: var(--fc-card); color: var(--fc-text); font-size: 14px; font-weight: 600;
}
.fcsdk-inputbtn:hover { border-color: var(--fc-brand-bright); color: var(--fc-brand); }
.fcsdk-root[data-fc-theme="night"] .fcsdk-inputbtn:hover { color: var(--fc-chip-text); }
.fcsdk-card {
  margin: 10px 16px; border-radius: var(--fc-radius-lg); overflow: hidden;
  background: var(--fc-card); border: 1px solid var(--fc-border);
}
.fcsdk-card-img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; background: var(--fc-skeleton); }
.fcsdk-card-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.fcsdk-card-title { font-size: 16px; font-weight: 700; }
.fcsdk-card-statement { font-size: 15px; color: var(--fc-text); }
.fcsdk-card-cta { align-self: flex-start; }
.fcsdk-badge { display: inline-flex; align-items: center; gap: 5px; background: var(--fc-chip); color: var(--fc-chip-text);
  border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 700; }
.fcsdk-options { display: flex; flex-direction: column; gap: 6px; }
.fcsdk-ssfr { margin: 10px 16px; border-radius: var(--fc-radius-lg); padding: 16px;
  background: linear-gradient(135deg, var(--fc-brand), var(--fc-brand-bright)); color: #fff; }
.fcsdk-ssfr-row { display: flex; gap: 10px; margin-top: 12px; }
.fcsdk-ssfr-chip { flex: 1; border: none; border-radius: 999px; background: rgba(255,255,255,0.16); color: #fff;
  padding: 10px 12px; font-size: 14px; font-weight: 700; }
.fcsdk-ssfr-chip:hover { background: rgba(255,255,255,0.28); }
.fcsdk-feed-error { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 24px; text-align: center; color: var(--fc-text-muted); }

/* --- chat ------------------------------------------------------------------------------ */
.fcsdk-chat-surface { background: var(--fc-surface-reading); }
.fcsdk-thread { display: flex; flex-direction: column; gap: 18px; padding: 18px 14px 24px; }
.fcsdk-bubble-user {
  align-self: flex-end; max-width: 84%;
  background: var(--fc-bubble-user); color: var(--fc-bubble-user-text);
  border-radius: var(--fc-radius-bubble) var(--fc-radius-bubble) 6px var(--fc-radius-bubble);
  padding: 11px 15px; font-size: var(--fc-bubble-font-size, 15px);
  display: flex; flex-direction: column; gap: 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.10);
}
.fcsdk-bubble-user img { border-radius: 12px; max-height: 220px; object-fit: cover; }
.fcsdk-bubble-user--failed { opacity: 0.65; border: 1.5px dashed rgba(255,255,255,0.7); }
.fcsdk-bubble-ai {
  align-self: flex-start; max-width: min(94%, 640px);
  background: var(--fc-bubble-ai); color: var(--fc-bubble-ai-text, var(--fc-text));
  border: 1px solid var(--fc-border);
  border-radius: var(--fc-radius-bubble) var(--fc-radius-bubble) var(--fc-radius-bubble) 6px;
  padding: 14px 16px; font-size: var(--fc-bubble-font-size, 15px);
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
/* Tap-to-skip surface for the reveal; cursor hints it is interactive. */
.fcsdk-ai-answer--revealing { cursor: pointer; }

/* Refined "thinking" state before a fresh answer arrives. */
.fcsdk-thinking {
  align-self: flex-start; display: flex; align-items: center; gap: 12px;
  padding: 6px 2px; color: var(--fc-text-muted);
}
.fcsdk-thinking-spinner { width: 22px; height: 22px; border-width: 2.5px; }
.fcsdk-thinking-label { font-size: 14px; font-weight: 600; }
.fcsdk-thinking-dots { display: inline-flex; align-items: center; gap: 4px; }
.fcsdk-thinking-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--fc-brand-bright); opacity: 0.35;
}

.fcsdk-voiceclip { display: flex; align-items: center; gap: 10px; min-width: 170px; }
.fcsdk-voiceclip button { width: 34px; height: 34px; border-radius: 50%; border: none;
  background: rgba(255,255,255,0.22); color: #fff; font-size: 14px; flex-shrink: 0; }
.fcsdk-voiceclip-bar { flex: 1; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden; }
.fcsdk-voiceclip-bar span { display: block; height: 100%; background: #fff; }

/* Follow-ups — titled "Related questions" section with tappable pill/cards. */
.fcsdk-followups { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.fcsdk-followups-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 700; letter-spacing: 0.01em;
  color: var(--fc-text-muted);
}
.fcsdk-followups-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--fc-brand-bright); flex-shrink: 0; }
.fcsdk-followups-list { display: flex; flex-wrap: wrap; gap: 8px; }
.fcsdk-followup-chip {
  display: inline-flex; align-items: center; gap: 8px; text-align: left;
  min-height: 44px; max-width: 100%; padding: 10px 14px;
  border: 1.5px solid var(--fc-border); border-radius: var(--fc-radius);
  background: var(--fc-chip); color: var(--fc-chip-text);
  font-size: 14px; font-weight: 600; line-height: 1.35;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  transition: border-color 0.15s ease, transform 0.06s ease, box-shadow 0.15s ease;
}
.fcsdk-followup-chip-text { min-width: 0; }
.fcsdk-followup-chip-arrow { color: var(--fc-brand-bright); font-size: 17px; line-height: 1; flex-shrink: 0; }
.fcsdk-followup-chip:hover { border-color: var(--fc-brand-bright); box-shadow: 0 3px 10px rgba(0,0,0,0.10); }
.fcsdk-followup-chip:active { transform: scale(0.99); }

.fcsdk-response-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.fcsdk-action-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; border: 1px solid var(--fc-border);
  background: var(--fc-surface); color: var(--fc-text-muted); border-radius: 999px; padding: 8px 14px; font-size: 13px; font-weight: 600; }
.fcsdk-action-chip:hover { color: var(--fc-brand); border-color: var(--fc-brand-bright); }
.fcsdk-root[data-fc-theme="night"] .fcsdk-action-chip:hover { color: var(--fc-chip-text); }
.fcsdk-clarification { font-size: 13px; color: var(--fc-text-muted); font-style: italic; margin-top: 8px; }

/* --- agentic streaming (2.0.0) -------------------------------------------------------------- */
/* Live tool progress / stall hint under a streaming answer. */
.fcsdk-stream-progress {
  align-self: flex-start; display: flex; align-items: center; gap: 10px;
  margin-top: 10px; color: var(--fc-text-muted);
}
.fcsdk-stream-progress-spinner { width: 18px; height: 18px; border-width: 2.5px; }
.fcsdk-stream-progress-label { font-size: 13.5px; font-weight: 600; }

/* Terminal state of a stream that ended without a complete answer. */
.fcsdk-stream-error {
  display: flex; flex-direction: column; gap: 12px;
  margin-top: 16px; padding: 16px; border-radius: var(--fc-radius);
  /* Fallbacks first: color-mix() is unsupported on older browsers. */
  background: var(--fc-surface); border: 1px solid var(--fc-border);
  background: color-mix(in srgb, var(--fc-danger) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--fc-danger) 16%, transparent);
}
.fcsdk-stream-error-head { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--fc-text); }
.fcsdk-stream-error-icon { font-size: 17px; line-height: 1; flex-shrink: 0; }
.fcsdk-stream-error-retry { width: 100%; }

/* Alignment surfaces: clarify / confirm / escalate / capability prompts. */
.fcsdk-alignment { display: flex; flex-direction: column; gap: 12px; }
.fcsdk-alignment--escalate {
  padding: 16px; border-radius: var(--fc-radius);
  background: var(--fc-surface); border: 1px solid var(--fc-border);
  background: color-mix(in srgb, var(--fc-danger) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--fc-danger) 16%, transparent);
}
.fcsdk-alignment-message { font-size: 15.5px; line-height: 1.45; color: var(--fc-text); }
.fcsdk-alignment-heading { font-size: 15px; font-weight: 700; color: var(--fc-text); }
.fcsdk-alignment-chips { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.fcsdk-alignment-chip {
  display: inline-flex; align-items: center; gap: 10px; text-align: left; max-width: 100%;
  min-height: 44px; padding: 10px 14px;
  border: 1.5px solid var(--fc-border); border-radius: var(--fc-radius);
  background: var(--fc-chip); color: var(--fc-chip-text);
  font-size: 14px; font-weight: 600; line-height: 1.35;
  transition: border-color 0.15s ease, transform 0.06s ease;
}
.fcsdk-alignment-chip-index {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
  background: var(--fc-surface); color: var(--fc-text-muted); font-size: 11.5px; font-weight: 700;
}
.fcsdk-alignment-chip--accent { border-color: var(--fc-brand-bright); }
.fcsdk-alignment-chip--escalate { border-color: var(--fc-danger); }
.fcsdk-alignment-chip--selected { background: var(--fc-brand); color: #fff; border-color: var(--fc-brand); }
.fcsdk-alignment-chip--selected .fcsdk-alignment-chip-index { background: rgba(255,255,255,0.22); color: #fff; }
.fcsdk-alignment-chip:hover:not(:disabled) { border-color: var(--fc-brand-bright); }
.fcsdk-alignment-chip:active:not(:disabled) { transform: scale(0.99); }
.fcsdk-alignment-chip:disabled { cursor: default; }
.fcsdk-alignment-hatch {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  font-size: 12.5px; color: var(--fc-text-muted);
}
.fcsdk-alignment-hatch-action {
  border: none; background: none; padding: 0;
  color: var(--fc-brand-bright); font-size: 12.5px; font-weight: 700; text-decoration: underline;
}
.fcsdk-chat-inputbar { padding: 10px 12px; border-top: 1px solid var(--fc-border); background: var(--fc-bg); }
.fcsdk-scrolldown { position: absolute; right: 16px; bottom: 84px; width: 40px; height: 40px; border-radius: 50%;
  border: 1px solid var(--fc-border); background: var(--fc-card); color: var(--fc-text); font-size: 17px; z-index: 20;
  box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
.fcsdk-loadmore { text-align: center; padding: 8px; }

/* Reveal-gated fade-in for the action row + follow-ups; motion-safe only. */
@keyframes fcsdk-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes fcsdk-dot-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: no-preference) {
  .fcsdk-fade-in { animation: fcsdk-fade-in 0.32s ease both; }
  .fcsdk-thinking-dot { animation: fcsdk-dot-pulse 1s ease-in-out infinite; }
  .fcsdk-thinking-dot:nth-child(2) { animation-delay: 0.18s; }
  .fcsdk-thinking-dot:nth-child(3) { animation-delay: 0.36s; }
}

/* --- text/voice/photo overlays ---------------------------------------------------------------- */
.fcsdk-overlay { position: absolute; inset: 0; background: var(--fc-overlay); z-index: 40;
  display: flex; flex-direction: column; justify-content: flex-end; }
.fcsdk-overlay-sheet { background: var(--fc-bg); border-radius: 18px 18px 0 0; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.fcsdk-textinput-row { display: flex; gap: 8px; align-items: flex-end; }
.fcsdk-textinput-row textarea { flex: 1; resize: none; min-height: 48px; max-height: 130px; padding: 12px 14px;
  border: 1.5px solid var(--fc-border); border-radius: 14px; background: var(--fc-card); color: var(--fc-text); font-size: 16px; outline: none; }
.fcsdk-sendbtn { width: 48px; height: 48px; border-radius: 50%; border: none; background: var(--fc-brand); color: #fff; font-size: 18px; flex-shrink: 0; }
.fcsdk-sendbtn:disabled { opacity: 0.45; }
@keyframes fcsdk-recpulse { 0%,100% { box-shadow: 0 0 0 0 rgba(201, 79, 61, 0.55); } 50% { box-shadow: 0 0 0 16px rgba(201, 79, 61, 0); } }
.fcsdk-recbtn { width: 68px; height: 68px; border-radius: 50%; border: none; background: var(--fc-danger); color: #fff; font-size: 26px; align-self: center; animation: fcsdk-recpulse 1.6s ease-out infinite; }
.fcsdk-photothumb { position: relative; align-self: flex-start; }
.fcsdk-photothumb img { width: 96px; height: 96px; object-fit: cover; border-radius: 12px; }
.fcsdk-photothumb button { position: absolute; top: -8px; right: -8px; width: 26px; height: 26px; border-radius: 50%;
  border: none; background: var(--fc-danger); color: #fff; font-size: 13px; }

/* --- drawer -------------------------------------------------------------------------------------- */
.fcsdk-drawer-scrim { position: absolute; inset: 0; background: var(--fc-overlay); z-index: 45; }
.fcsdk-drawer { position: absolute; top: 0; bottom: 0; left: 0; width: min(310px, 86%);
  background: var(--fc-bg); z-index: 46; display: flex; flex-direction: column;
  box-shadow: 4px 0 24px rgba(0,0,0,0.3); animation: fcsdk-drawer-in 0.22s ease; }
@keyframes fcsdk-drawer-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }
.fcsdk-drawer-head { background: var(--fc-brand); color: #fff; padding: 20px 16px; }
.fcsdk-drawer-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 13px 16px;
  border: none; background: transparent; color: var(--fc-text); font-size: 15px; font-weight: 600; text-align: left; }
.fcsdk-drawer-item:hover { background: var(--fc-surface); }
.fcsdk-drawer-item--active { color: var(--fc-brand); background: var(--fc-brand-soft); }
.fcsdk-root[data-fc-theme="night"] .fcsdk-drawer-item--active { color: var(--fc-chip-text); background: var(--fc-chip); }
.fcsdk-drawer-section { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--fc-text-muted); padding: 16px 16px 6px; }
.fcsdk-drawer-q { display: flex; gap: 10px; width: 100%; padding: 10px 16px; border: none; background: transparent;
  color: var(--fc-text); font-size: 14px; text-align: left; align-items: flex-start; }
.fcsdk-drawer-q:hover { background: var(--fc-surface); }
.fcsdk-drawer-q span.fcsdk-qtext { flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

/* --- lists (history/help/settings) ------------------------------------------------------------------ */
.fcsdk-listcard { margin: 10px 16px; border-radius: var(--fc-radius-lg); overflow: hidden; background: var(--fc-card); border: 1px solid var(--fc-border); }
.fcsdk-listitem { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px;
  border: none; background: transparent; color: var(--fc-text); font-size: 15px; text-align: left; }
.fcsdk-listitem:hover { background: var(--fc-surface); }
.fcsdk-listitem + .fcsdk-listitem { border-top: 1px solid var(--fc-border); }
.fcsdk-listitem .fcsdk-li-text { flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.fcsdk-sectionheader { font-size: 13px; font-weight: 700; color: var(--fc-text-muted); padding: 16px 18px 4px; }

/* --- settings ------------------------------------------------------------------------------------------ */
.fcsdk-appearance-row { display: flex; gap: 8px; padding: 4px 16px 12px; }
.fcsdk-appearance-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 12px 8px; border: 1.5px solid var(--fc-border); border-radius: 14px; background: var(--fc-card);
  color: var(--fc-text); font-size: 13px; font-weight: 600; }
.fcsdk-appearance-btn--active { border-color: var(--fc-brand-bright); color: var(--fc-brand); background: var(--fc-brand-soft); }
.fcsdk-root[data-fc-theme="night"] .fcsdk-appearance-btn--active { color: var(--fc-chip-text); background: var(--fc-chip); }

/* --- modal / bottom sheet ---------------------------------------------------------------------------------- */
.fcsdk-modal-scrim { position: absolute; inset: 0; background: var(--fc-overlay); z-index: 50;
  display: flex; align-items: center; justify-content: center; padding: 18px; }
.fcsdk-modal { background: var(--fc-bg); border-radius: 18px; width: 100%; max-width: 560px; max-height: 92%;
  display: flex; flex-direction: column; overflow: hidden; }
.fcsdk-modal iframe { border: none; width: 100%; flex: 1; min-height: 320px; background: #fff; }
.fcsdk-bottomsheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 50;
  background: var(--fc-bg); border-radius: 18px 18px 0 0; padding: 20px 18px 22px; box-shadow: 0 -8px 30px rgba(0,0,0,0.3); }

/* --- markdown (2.0.0) -----------------------------------------------------------------------------
   Parity with components/MarkdownText.kt. The 24/20/16/12/5px block-pair rhythm is applied as an
   inline marginTop by the renderer (see markdownParse.blockTopSpacing), so every element here has
   its own margins zeroed — a stray default margin would stack on top of the computed spacing and
   silently break the rhythm. */
.fcsdk-md-block > * { margin: 0; }
.fcsdk-md p { margin: 0; }
.fcsdk-md h1, .fcsdk-md h2, .fcsdk-md h3 { margin: 0; line-height: 1.3; }
.fcsdk-md h1 { font-size: 19px; } .fcsdk-md h2 { font-size: 17px; } .fcsdk-md h3 { font-size: 15.5px; }
.fcsdk-md ul, .fcsdk-md ol { margin: 0; padding-left: 22px; }
.fcsdk-md li { margin: 0; }
/* Consecutive list items tighten to 5px — Kotlin's BulletItem-after-BulletItem spacing. */
.fcsdk-md li + li { margin-top: 5px; }
.fcsdk-md code { background: var(--fc-surface); border-radius: 5px; padding: 1px 5px; font-size: 0.92em; }
.fcsdk-md pre { background: var(--fc-surface); border-radius: 10px; padding: 10px 12px; overflow-x: auto; margin: 0; }
.fcsdk-md a { color: var(--fc-brand-bright); }
.fcsdk-md blockquote { margin: 0; padding: 4px 12px; border-left: 3px solid var(--fc-brand-bright); color: var(--fc-text-muted); }
/* Divider: a 3px fully-rounded rule (Compose height(3.dp) + RoundedCornerShape(50)). */
.fcsdk-md-divider { height: 3px; border-radius: 50px; background: var(--fc-border); }
/* Tables. The WRAPPER scrolls, never the page. 1-2 column tables fill the width; 3+ columns keep
   a 160px per-column minimum and pan, with a right-edge fade hinting there is more. */
.fcsdk-md-tablewrap { position: relative; max-width: 100%; }
.fcsdk-md-tablewrap--scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.fcsdk-md-table { border-collapse: collapse; width: 100%;
  border: 1px solid var(--fc-border); border-radius: 8px; overflow: hidden; }
.fcsdk-md-table--wide { width: auto; min-width: 100%; }
.fcsdk-md-table--wide th, .fcsdk-md-table--wide td { min-width: 160px; }
.fcsdk-md-table th, .fcsdk-md-table td { padding: 10px 12px; vertical-align: top; }
.fcsdk-md-table th { background: var(--fc-surface); font-size: 12.5px; font-weight: 700; }
.fcsdk-md-table td { font-size: 13.5px; }
/* Body rows alternate, as in the Kotlin (surfaceSecondary / surfaceReadingSecondary). */
.fcsdk-md-table tbody tr:nth-child(odd) { background: var(--fc-bg); }
.fcsdk-md-table tbody tr:nth-child(even) { background: var(--fc-surface); }
.fcsdk-md-tablefade { position: absolute; top: 0; right: 0; bottom: 0; width: 48px; pointer-events: none;
  background: linear-gradient(to right, rgba(0,0,0,0), var(--fc-surface-reading, var(--fc-bg))); }

/* --- agentic Home + Terms-of-Use dialog (2.0.0) ---------------------------------------------------
   App parity (HomeScreen.kt:534): in agentic mode the surface is the grey READING surface and the
   green lives only in a gradient band behind the header and first card, so the app bar is
   transparent and the band shows through it. */
.fcsdk-home--agentic { background: var(--fc-surface-reading); }
.fcsdk-home--agentic .fcsdk-appbar { background: transparent; color: var(--fc-appbar-text); }
/* Band + glow sit behind; the app bar and scroller are lifted above them. */
.fcsdk-home-band { position: absolute; left: 0; right: 0; top: 0; height: 36.6%; z-index: 0;
  pointer-events: none; transition: opacity 120ms linear;
  background: linear-gradient(to bottom, var(--fc-brand) 0%, var(--fc-brand) 58.8%,
    rgba(0, 0, 0, 0) 100%); }
.fcsdk-home-band-glow { position: absolute; left: 50%; top: 0; transform: translateX(-50%);
  width: 100%; height: 148px; pointer-events: none;
  background: radial-gradient(ellipse at top center, rgba(255, 249, 71, 0.30), rgba(255, 249, 71, 0) 70%); }
.fcsdk-home--agentic .fcsdk-appbar, .fcsdk-home--agentic .fcsdk-scroll { position: relative; z-index: 1; }
/* Centred top section: 42px logo mark, leaf-flanked section title, location pill, greeting. */
.fcsdk-home-agentic-head { display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 2px 16px 16px; text-align: center; color: var(--fc-appbar-text); }
.fcsdk-home-logomark { font-size: 34px; line-height: 42px; height: 42px; }
.fcsdk-home-sectionhead { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; }
.fcsdk-home-leaf { opacity: 0.75; font-size: 14px; }
.fcsdk-home-leaf--flip { transform: scaleX(-1); }
.fcsdk-home-locationpill { display: inline-flex; align-items: center; gap: 6px; max-width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.38); border-radius: 999px; padding: 6px 14px;
  background: rgba(255, 255, 255, 0.14); color: inherit; font-size: 13px; }
.fcsdk-home-locationpill span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fcsdk-greeting--centred { text-align: center; padding: 4px 8px 0; }
/* Terms-of-Use dialog: full-surface, document in the middle, elevated accept footer. */
.fcsdk-terms { max-width: 640px; height: 100%; max-height: 100%; }
.fcsdk-terms-body { position: relative; flex: 1; min-height: 0; display: flex; }
.fcsdk-terms-loading { position: absolute; inset: 0; background: #fff; display: flex;
  align-items: flex-start; justify-content: center; padding-top: 24px; }
.fcsdk-terms-footer { flex-shrink: 0; background: var(--fc-bg); padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.18); }

/* --- location chat bubble (2.0.0) ----------------------------------------------------------------
   Port of components/LocationChatBubble.kt: fixed 290x184 card, three corners at Radius.XL (20px)
   with the bottom-right sharp (same asymmetric shape as the user bubble, because this IS a
   user-side message), tinted map header above a caption/address footer. */
.fcsdk-bubble-location-row { display: flex; justify-content: flex-end; }
.fcsdk-locbubble { width: 290px; max-width: 100%; height: 184px; display: flex; flex-direction: column;
  overflow: hidden; border-radius: 20px 20px 0 20px; background: var(--fc-surface);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.10); }
/* Green500_16 — a 16% tint of the brand green, as in the Kotlin. */
.fcsdk-locbubble-map { flex: 1 1 auto; min-height: 0; display: flex; align-items: center;
  justify-content: center; background: var(--fc-brand-soft, rgba(0, 201, 80, 0.16)); }
.fcsdk-locbubble-mark { display: flex; flex-direction: column; align-items: center;
  color: var(--fc-brand-bright); line-height: 0; }
.fcsdk-locbubble-footer { flex: 0 0 auto; display: flex; flex-direction: column; gap: 4px;
  padding: 12px 16px; }
.fcsdk-locbubble-caption { font-size: 14px; color: var(--fc-text-muted); }
.fcsdk-locbubble-address { font-size: 14px; font-weight: 700; color: var(--fc-text); }

/* --- unified composer (2.0.0) -------------------------------------------------------------------------------
   Geometry mirrors components/composerLayout.ts, which transcribes the Compose
   InputComposer.kt constants 1:1 (dp read as px). Sizes that morph between the
   standard and compact metrics carry a 250ms transition, matching Compose's
   animateDpAsState(tween(250)). */
.fcsdk-screen--composer { position: relative; }
.fcsdk-composer { position: absolute; left: 0; right: 0; bottom: 0; z-index: 14;
  transition: transform 300ms ease; pointer-events: none; }
.fcsdk-composer > * { pointer-events: auto; }
.fcsdk-composer--floating { padding-bottom: max(env(safe-area-inset-bottom, 0px), 20px); }
.fcsdk-composer--anchored { padding-bottom: env(safe-area-inset-bottom, 0px); background: var(--fc-bg); }
.fcsdk-composer--hidden { transform: translateY(160%); }
.fcsdk-composer--hidden > * { pointer-events: none; }
.fcsdk-composer-sheet { background: var(--fc-brand);
  transition: padding 250ms ease, border-radius 250ms ease; }
.fcsdk-composer--floating .fcsdk-composer-sheet { box-shadow: 0 6px 24px rgba(0, 0, 0, 0.24); }
.fcsdk-composer-row { display: flex; align-items: flex-end; }
.fcsdk-composer-btn { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%; background: #fff; color: var(--fc-brand); line-height: 1; padding: 0;
  transition: width 250ms ease, height 250ms ease, font-size 250ms ease; }
.fcsdk-composer-btn:hover { filter: brightness(0.94); }
.fcsdk-composer-field { position: relative; flex: 1 1 auto; min-width: 0; overflow: hidden;
  display: flex; flex-direction: column; justify-content: center; cursor: text;
  background: var(--fc-surface);
  transition: background 220ms ease, min-height 250ms ease; }
.fcsdk-composer-field--active { background: var(--fc-bg); }
.fcsdk-composer-thumbs, .fcsdk-composer-fieldrow { position: relative; z-index: 2; }
.fcsdk-composer-thumbs { display: flex; gap: 5px; padding: 8px 0 10px; }
.fcsdk-composer-thumb { position: relative; flex: 0 0 auto; border-radius: 10px; overflow: hidden; }
.fcsdk-composer-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.fcsdk-composer-thumb button { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px;
  display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 50%;
  background: rgba(0, 0, 0, 0.55); color: #fff; font-size: 11px; line-height: 1; padding: 0; }
.fcsdk-composer-fieldrow { display: flex; align-items: center; width: 100%; padding: 7px 0; }
.fcsdk-composer-input { flex: 1 1 auto; width: 100%; min-height: 24px; max-height: 72px;
  border: none; outline: none; resize: none; background: transparent; color: var(--fc-text);
  font-size: 15px; line-height: 1.35; padding: 0; overflow-y: auto; }
.fcsdk-composer-placeholder { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%);
  pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  color: var(--fc-text-muted); font-size: 15px; }
.fcsdk-composer-placeholder--in { animation: fcsdk-ph-in 400ms ease both; }
.fcsdk-composer-placeholder--out { animation: fcsdk-ph-out 400ms ease both; }
/* Placeholder shimmer sweep — Compose ShimmerText, 2250ms, idle only. */
.fcsdk-composer-placeholder--shimmer {
  background-image: linear-gradient(100deg, currentColor 0%, currentColor 30%,
    var(--fc-brand-bright) 45%, var(--fc-brand-bright) 55%, currentColor 70%, currentColor 100%);
  background-size: 220% 100%; -webkit-background-clip: text; background-clip: text;
  color: transparent; -webkit-text-fill-color: transparent;
  animation: fcsdk-ph-shimmer 2250ms linear infinite; }
.fcsdk-root[data-fc-theme="day"] .fcsdk-composer-placeholder--shimmer,
.fcsdk-root[data-fc-theme="night"] .fcsdk-composer-placeholder--shimmer { -webkit-text-fill-color: transparent; }
@keyframes fcsdk-ph-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes fcsdk-ph-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes fcsdk-ph-shimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
/* Ambient "aura": a conic gradient rotating behind the field, with an inset panel of the
   field's own background drawn over it so only a ~2.4px ring shows. Home-only, idle-only.
   Colours are InputComposer.kt AuraColors; 7s rotation; the opacity keyframes replay the
   Kotlin breath (2 gentle breaths, then a deep ebb and slow swell) over its 15s cycle. */
.fcsdk-composer-field--aura::before { content: ''; position: absolute; z-index: 0;
  left: 50%; top: 50%; width: 260%; aspect-ratio: 1; border-radius: 50%;
  background: conic-gradient(from 0turn, #00C950, #22D3EE, #00C950, #FFF947, #00C950);
  filter: blur(3px);
  animation: fcsdk-aura-spin 7s linear infinite, fcsdk-aura-breathe 15s ease-in-out infinite; }
.fcsdk-composer-field--aura::after { content: ''; position: absolute; z-index: 1; inset: 2.4px;
  border-radius: 14px; background: inherit; }
@keyframes fcsdk-aura-spin {
  from { transform: translate(-50%, -50%) rotate(0turn); }
  to { transform: translate(-50%, -50%) rotate(1turn); } }
@keyframes fcsdk-aura-breathe {
  0% { opacity: 1; } 16% { opacity: 0.5; } 32% { opacity: 1; }
  48% { opacity: 0.5; } 66.67% { opacity: 0.04; } 100% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .fcsdk-composer-field--aura::before { animation: none; opacity: 0.7; }
  .fcsdk-composer-placeholder--shimmer { animation: none; color: var(--fc-text-muted);
    -webkit-text-fill-color: currentColor; background-image: none; }
}

/* --- misc ------------------------------------------------------------------------------------------------------ */
.fcsdk-error-inline { color: var(--fc-danger); font-size: 13px; }
.fcsdk-bottombar { border-top: 1px solid var(--fc-border); background: var(--fc-surface);
  border-radius: 18px 18px 0 0; padding: 14px 16px 18px; display: flex; flex-direction: column; gap: 10px; }
.fcsdk-legal-links { font-size: 12.5px; color: var(--fc-text-muted); text-align: center; }
.fcsdk-legal-links button { border: none; background: none; color: var(--fc-brand-bright); font-size: 12.5px; text-decoration: underline; padding: 0 2px; }
.fcsdk-countrysel { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 10px 14px;
  border: 1.5px solid var(--fc-border); border-radius: var(--fc-radius-input); background: var(--fc-card); color: var(--fc-text); font-size: 16px; }
.fcsdk-timer { text-align: center; font-size: 14px; color: var(--fc-text-muted); }
`;

/** Injects the stylesheet once per document. */
export function ensureStylesInjected(doc: Document = document): void {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = css;
  doc.head.appendChild(style);
}

/** Resolves 'auto' via prefers-color-scheme. */
export function resolveTheme(mode: AppearanceMode): 'day' | 'night' {
  if (mode === 'auto') {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'night';
    }
    return 'day';
  }
  return mode;
}

// ---------------------------------------------------------------------------
// Host theme resolver (docs/07 Part B).
//
// Produces a map of `--fc-*` custom properties that a host theme overrides for
// the ACTIVE appearance (day/night). Applied as INLINE style on `.fcsdk-root`,
// so it wins over both the base and the `[data-fc-theme]` blocks in the
// stylesheet — but ONLY for the keys the host actually set. Every token the
// host omits falls through to the built-in green day/night palette, so the
// day/night switch keeps working with a partial theme.
//
// The resolver is called on every re-render with the current mode, so when the
// appearance flips the correct (light/dark) host palette is re-emitted.
// ---------------------------------------------------------------------------

/** Parse `#rgb`/`#rrggbb` → [r,g,b]. Returns null for non-hex inputs. */
function parseHex(color: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = Number.parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A translucent tint of a hex color (for `--fc-brand-soft` derivation). */
function softTint(color: string, alpha: number): string | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** Perceived luminance (0..255-ish) → pick black/white on-color if host omits `onBrand`. */
function onColorFor(color: string): string | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return lum > 150 ? '#111111' : '#ffffff';
}

/** Slightly darken a hex color (for a `brandPrimaryDark` derivation from `brandPrimary`). */
function darken(color: string, factor: number): string | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  const d = rgb.map((c) => Math.max(0, Math.round(c * (1 - factor)))) as [number, number, number];
  return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
}

function colorVars(colors: FarmerChatThemeColors, softAlpha: number): Record<string, string> {
  const vars: Record<string, string> = {};
  const {
    brandPrimary,
    brandPrimaryDark,
    brandAccent,
    onBrand,
    background,
    readingSurface,
    cardSurface,
    error,
    onBackground,
    onSurface,
  } = colors;

  if (brandPrimary) {
    // Brand surfaces: app bar, brand fills, splash, drawer head, user bubble.
    vars['--fc-brand'] = brandPrimary;
    vars['--fc-appbar'] = brandPrimary;
    vars['--fc-bubble-user'] = brandPrimary;
    const deep = brandPrimaryDark ?? darken(brandPrimary, 0.28);
    if (deep) vars['--fc-brand-deep'] = deep;
    const soft = softTint(brandPrimary, softAlpha);
    if (soft) {
      vars['--fc-brand-soft'] = soft;
      vars['--fc-chip'] = soft;
    }
    const onBrandColor = onBrand ?? onColorFor(brandPrimary);
    if (onBrandColor) {
      vars['--fc-appbar-text'] = onBrandColor;
      vars['--fc-bubble-user-text'] = onBrandColor;
    }
  }
  if (brandPrimaryDark) vars['--fc-brand-deep'] = brandPrimaryDark;
  if (brandAccent) {
    // Accents: chevrons, active radio dot, spinner top, focus, links.
    vars['--fc-brand-bright'] = brandAccent;
    vars['--fc-chip-text'] = brandAccent;
  }
  if (onBrand) {
    vars['--fc-appbar-text'] = onBrand;
    vars['--fc-bubble-user-text'] = onBrand;
  }
  if (background) vars['--fc-bg'] = background;
  if (readingSurface) vars['--fc-surface-reading'] = readingSurface;
  if (cardSurface) {
    vars['--fc-card'] = cardSurface;
    vars['--fc-bubble-ai'] = cardSurface;
  }
  if (error) vars['--fc-danger'] = error;
  const text = onBackground ?? onSurface;
  if (text) vars['--fc-text'] = text;
  return vars;
}

/**
 * Resolve host theme → inline CSS custom properties for the active `mode`.
 * Returns an object usable directly as a React `style` prop.
 */
export function resolveThemeVars(
  theme: FarmerChatTheme | undefined,
  mode: 'day' | 'night',
): Record<string, string> {
  if (!theme) return {};
  const vars: Record<string, string> = {};

  // Colors: dark palette when in night mode (falls back to light set).
  const light = theme.colors ?? {};
  const dark = theme.dark ?? theme.colors ?? {};
  const active = mode === 'night' ? dark : light;
  // Slightly stronger tint in dark mode so the soft brand surface reads.
  Object.assign(vars, colorVars(active, mode === 'night' ? 0.22 : 0.12));

  // Shape.
  if (theme.shape) {
    if (theme.shape.cardCornerRadius != null) vars['--fc-radius-lg'] = `${theme.shape.cardCornerRadius}px`;
    if (theme.shape.buttonCornerRadius != null) vars['--fc-radius-btn'] = `${theme.shape.buttonCornerRadius}px`;
    if (theme.shape.inputCornerRadius != null) vars['--fc-radius-input'] = `${theme.shape.inputCornerRadius}px`;
  }

  // Typography.
  if (theme.typography) {
    if (theme.typography.fontFamily) vars['--fc-font'] = theme.typography.fontFamily;
    if (theme.typography.typeScale != null) vars['--fc-font-scale'] = String(theme.typography.typeScale);
  }

  return vars;
}
