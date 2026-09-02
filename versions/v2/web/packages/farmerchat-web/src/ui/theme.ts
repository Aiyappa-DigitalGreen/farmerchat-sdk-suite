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

/* --- markdown ------------------------------------------------------------------------------------------------ */
.fcsdk-md p { margin: 0 0 10px; }
.fcsdk-md p:last-child { margin-bottom: 0; }
.fcsdk-md h1, .fcsdk-md h2, .fcsdk-md h3, .fcsdk-md h4 { margin: 14px 0 6px; line-height: 1.3; }
.fcsdk-md h1 { font-size: 19px; } .fcsdk-md h2 { font-size: 17px; } .fcsdk-md h3, .fcsdk-md h4 { font-size: 15.5px; }
.fcsdk-md ul, .fcsdk-md ol { margin: 4px 0 10px; padding-left: 22px; }
.fcsdk-md li { margin: 3px 0; }
.fcsdk-md code { background: var(--fc-surface); border-radius: 5px; padding: 1px 5px; font-size: 0.92em; }
.fcsdk-md pre { background: var(--fc-surface); border-radius: 10px; padding: 10px 12px; overflow-x: auto; }
.fcsdk-md a { color: var(--fc-brand-bright); }
.fcsdk-md blockquote { margin: 8px 0; padding: 4px 12px; border-left: 3px solid var(--fc-brand-bright); color: var(--fc-text-muted); }

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
