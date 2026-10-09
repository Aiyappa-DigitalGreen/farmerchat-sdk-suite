/**
 * Design tokens + scoped stylesheet. Green brand surface (#146152-family, per
 * docs/03 "Design tokens"), day/night palettes, mobile-first, embeddable in a
 * container div. Appearance `auto` follows prefers-color-scheme.
 */

import type { AppearanceMode, FarmerChatTheme, FarmerChatThemeColors } from '../core/config';
import { robotoFontFaces } from './fonts';
import { ICONS } from './icons';

export const STYLE_ELEMENT_ID = 'farmerchat-web-styles';

const css = `
/* ---------------------------------------------------------------------------
   Tokens — a faithful port of the compose module's theme (Color.kt, Type.kt,
   Shapes.kt), which is itself a port of the app. --fc-c-* are the compose
   semantic roles; resolveThemeVars() overlays a host theme onto them exactly as
   HostTheme.kt does. The older --fc-* names are aliases kept for the CSS that
   still uses them.
   --------------------------------------------------------------------------- */
.fcsdk-root {
  /* BrandColors (BrandSemanticColors) — same in day and night */
  --fc-c-brand-surface-primary: #008236;   /* Green700 */
  --fc-c-brand-surface-secondary: #08361B; /* Green800 */
  --fc-c-brand-surface-tertiary: #032E15;  /* Green950 */
  --fc-c-brand-fg-primary: #FFFFFF;
  --fc-c-brand-fg-secondary: #00C950;      /* Green500 */
  --fc-c-feedback-success: #00C950;
  --fc-c-feedback-fail: #E5533D;           /* Red500 */
  --fc-accent-gradient-green: #00C950;
  --fc-accent-gradient-cyan: #22D3EE;
  --fc-accent-gradient-yellow: #FFF947;

  /* Radius tokens (Shapes.kt) + FcShapes defaults */
  --fc-r-rounded: 999px; --fc-r-xxl: 24px; --fc-r-xl: 20px; --fc-r-lg: 16px; --fc-r-md: 12px; --fc-r-sm: 8px;
  --fc-radius: 12px;
  --fc-radius-lg: 24px;     /* FcShapes.card */
  --fc-radius-btn: 999px;   /* FcShapes.button */
  --fc-radius-input: 12px;  /* FcShapes.input */
  --fc-radius-bubble: 20px;

  /* Type (Type.kt): FontFamily.SansSerif = Roboto on Android; bundled as "FC Roboto". */
  /* System-bar insets. Default to the browser's safe areas; a host embedding the SDK under a
     native status/navigation bar (a WebView) can set these, as Compose reads WindowInsets. */
  --fc-inset-top: var(--farmerchat-inset-top, env(safe-area-inset-top, 0px));
  --fc-inset-bottom: var(--farmerchat-inset-bottom, env(safe-area-inset-bottom, 0px));

  --fc-font-scale: 1;
  --fc-font: "FC Roboto", Roboto, "Noto Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --fc-t-displayLarge: 700 calc(35px * var(--fc-font-scale)) / calc(42px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-displayMedium: 700 calc(28px * var(--fc-font-scale)) / calc(36px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-displaySmall: 700 calc(24px * var(--fc-font-scale)) / calc(32px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-titleLarge: 700 calc(22px * var(--fc-font-scale)) / calc(28px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-titleMedium: 700 calc(18px * var(--fc-font-scale)) / calc(24px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-titleSmall: 700 calc(16px * var(--fc-font-scale)) / calc(22px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-bodyLarge: 400 calc(19px * var(--fc-font-scale)) / calc(27px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-bodyMedium: 400 calc(17px * var(--fc-font-scale)) / calc(25px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-bodySmall: 400 calc(15px * var(--fc-font-scale)) / calc(22px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-labelLarge: 600 calc(17px * var(--fc-font-scale)) / calc(22px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-labelMedium: 600 calc(15px * var(--fc-font-scale)) / calc(20px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-labelSmall: 600 calc(13px * var(--fc-font-scale)) / calc(18px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-caption: 400 calc(13px * var(--fc-font-scale)) / calc(18px * var(--fc-font-scale)) var(--fc-font);
}
.fcsdk-root[data-fc-script="deva"] {
  --fc-tl-displayLarge: 48px;
  --fc-tl-displaySmall: 34px;
  --fc-tl-titleMedium: 26px;
  --fc-tl-titleSmall: 24px;
  --fc-t-displayLarge: 700 calc(35px * var(--fc-font-scale)) / calc(48px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-displaySmall: 700 calc(24px * var(--fc-font-scale)) / calc(34px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-titleMedium: 700 calc(18px * var(--fc-font-scale)) / calc(26px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-titleSmall: 700 calc(16px * var(--fc-font-scale)) / calc(24px * var(--fc-font-scale)) var(--fc-font);
}
.fcsdk-root[data-fc-script="ethi"] {
  --fc-tl-displayLarge: 46px;
  --fc-tl-displayMedium: 34px;
  --fc-tl-displaySmall: 30px;
  --fc-tl-titleLarge: 30px;
  --fc-tl-titleSmall: 20px;
  --fc-tl-bodyLarge: 28px;
  --fc-t-displayLarge: 700 calc(35px * var(--fc-font-scale)) / calc(46px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-displayMedium: 700 calc(28px * var(--fc-font-scale)) / calc(34px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-displaySmall: 700 calc(24px * var(--fc-font-scale)) / calc(30px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-titleLarge: 700 calc(22px * var(--fc-font-scale)) / calc(30px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-titleSmall: 700 calc(16px * var(--fc-font-scale)) / calc(20px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-bodyLarge: 400 calc(19px * var(--fc-font-scale)) / calc(28px * var(--fc-font-scale)) var(--fc-font);
}
.fcsdk-root[data-fc-script="knda"] {
  --fc-tl-displayLarge: 48px;
  --fc-tl-displayMedium: 40px;
  --fc-tl-displaySmall: 34px;
  --fc-tl-titleLarge: 32px;
  --fc-tl-titleMedium: 26px;
  --fc-tl-titleSmall: 24px;
  --fc-tl-bodyLarge: 28px;
  --fc-tl-bodyMedium: 26px;
  --fc-tl-bodySmall: 23px;
  --fc-t-displayLarge: 700 calc(35px * var(--fc-font-scale)) / calc(48px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-displayMedium: 700 calc(28px * var(--fc-font-scale)) / calc(40px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-displaySmall: 700 calc(24px * var(--fc-font-scale)) / calc(34px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-titleLarge: 700 calc(22px * var(--fc-font-scale)) / calc(32px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-titleMedium: 700 calc(18px * var(--fc-font-scale)) / calc(26px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-titleSmall: 700 calc(16px * var(--fc-font-scale)) / calc(24px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-bodyLarge: 400 calc(19px * var(--fc-font-scale)) / calc(28px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-bodyMedium: 400 calc(17px * var(--fc-font-scale)) / calc(26px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-bodySmall: 400 calc(15px * var(--fc-font-scale)) / calc(23px * var(--fc-font-scale)) var(--fc-font);
}
.fcsdk-root[data-fc-script="orya"] {
  --fc-tl-displayLarge: 46px;
  --fc-tl-displayMedium: 34px;
  --fc-tl-displaySmall: 30px;
  --fc-tl-titleLarge: 30px;
  --fc-tl-titleSmall: 20px;
  --fc-tl-bodyLarge: 28px;
  --fc-t-displayLarge: 700 calc(35px * var(--fc-font-scale)) / calc(46px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-displayMedium: 700 calc(28px * var(--fc-font-scale)) / calc(34px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-displaySmall: 700 calc(24px * var(--fc-font-scale)) / calc(30px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-titleLarge: 700 calc(22px * var(--fc-font-scale)) / calc(30px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-titleSmall: 700 calc(16px * var(--fc-font-scale)) / calc(20px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-bodyLarge: 400 calc(19px * var(--fc-font-scale)) / calc(28px * var(--fc-font-scale)) var(--fc-font);
}
.fcsdk-root[data-fc-script="telu"] {
  --fc-tl-displayLarge: 44px;
  --fc-tl-displaySmall: 30px;
  --fc-t-displayLarge: 700 calc(35px * var(--fc-font-scale)) / calc(44px * var(--fc-font-scale)) var(--fc-font);
  --fc-t-displaySmall: 700 calc(24px * var(--fc-font-scale)) / calc(30px * var(--fc-font-scale)) var(--fc-font);
}

.fcsdk-root[data-fc-theme="day"] {
  /* LightContentColors */
  --fc-c-surface-primary: #ECECEE;          /* Neutral150 */
  --fc-c-surface-secondary: #FFFFFF;
  --fc-c-surface-tertiary: #E4E4E7;         /* Neutral200 */
  --fc-c-surface-active: rgba(0, 201, 80, 0.16);
  --fc-c-reading-primary: #FFFFFF;
  --fc-c-reading-secondary: #ECECEE;
  --fc-c-reading-tertiary: #FFFFFF;
  --fc-c-fg-primary: #000000;
  --fc-c-fg-secondary: #52525C;             /* Neutral600 */
  --fc-c-fg-tertiary: #D4D4D8;              /* Neutral300 */
  --fc-c-button-surface: #08361B;           /* Green800 */
  --fc-c-button-fg: #FFFFFF;
  --fc-c-button-accent: #00C950;
  --fc-c-border-default: #D4D4D8;
  --fc-c-border-active: #00C950;
  --fc-c-placeholder: #71717B;              /* Neutral500 */
  --fc-c-scrim: rgba(0, 0, 0, 0.5);
  --fc-c-shimmer: #F4F4F5;
  --fc-c-shine: #000000;
}
.fcsdk-root[data-fc-theme="night"] {
  /* DarkContentColors */
  --fc-c-surface-primary: #18181B;          /* Neutral900 */
  --fc-c-surface-secondary: #27272A;        /* Neutral800 */
  --fc-c-surface-tertiary: #3F3F46;         /* Neutral700 */
  --fc-c-surface-active: rgba(0, 201, 80, 0.16);
  --fc-c-reading-primary: #18181B;
  --fc-c-reading-secondary: #27272A;
  --fc-c-reading-tertiary: #18181B;
  --fc-c-fg-primary: #FFFFFF;
  --fc-c-fg-secondary: #9F9FA9;             /* Neutral400 */
  --fc-c-fg-tertiary: #3F3F46;
  --fc-c-button-surface: #008236;           /* Green700 */
  --fc-c-button-fg: #FFFFFF;
  --fc-c-button-accent: #00C950;
  --fc-c-border-default: #3F3F46;
  --fc-c-border-active: #00C950;
  --fc-c-placeholder: #9F9FA9;
  --fc-c-scrim: rgba(0, 0, 0, 0.6);
  --fc-c-shimmer: #18181B;
  --fc-c-shine: #FFFFFF;
}
/* Legacy aliases onto the compose roles. */
.fcsdk-root[data-fc-theme] {
  --fc-bg: var(--fc-c-surface-primary);
  --fc-surface: var(--fc-c-surface-primary);
  --fc-surface-reading: var(--fc-c-reading-primary);
  --fc-card: var(--fc-c-surface-secondary);
  --fc-text: var(--fc-c-fg-primary);
  --fc-text-muted: var(--fc-c-fg-secondary);
  --fc-border: var(--fc-c-border-default);
  --fc-brand: var(--fc-c-brand-surface-primary);
  --fc-brand-deep: var(--fc-c-button-surface);
  --fc-brand-bright: var(--fc-c-brand-fg-secondary);
  --fc-brand-soft: var(--fc-c-surface-active);
  --fc-accent: var(--fc-c-brand-fg-secondary);
  --fc-danger: var(--fc-c-feedback-fail);
  --fc-chip: var(--fc-c-surface-active);
  --fc-chip-text: var(--fc-c-brand-surface-primary);
  --fc-appbar: var(--fc-c-surface-primary);
  --fc-appbar-text: var(--fc-c-fg-primary);
  --fc-bubble-user: var(--fc-c-surface-secondary);
  --fc-bubble-user-text: var(--fc-c-fg-primary);
  --fc-bubble-ai: var(--fc-c-reading-primary);
  --fc-overlay: var(--fc-c-scrim);
  --fc-skeleton: var(--fc-c-shimmer);
}
.fcsdk-root .fc-t-displayLarge { font: var(--fc-t-displayLarge); }
.fcsdk-root .fc-t-displayMedium { font: var(--fc-t-displayMedium); }
.fcsdk-root .fc-t-displaySmall { font: var(--fc-t-displaySmall); }
.fcsdk-root .fc-t-titleLarge { font: var(--fc-t-titleLarge); }
.fcsdk-root .fc-t-titleMedium { font: var(--fc-t-titleMedium); }
.fcsdk-root .fc-t-titleSmall { font: var(--fc-t-titleSmall); }
.fcsdk-root .fc-t-bodyLarge { font: var(--fc-t-bodyLarge); }
.fcsdk-root .fc-t-bodyMedium { font: var(--fc-t-bodyMedium); }
.fcsdk-root .fc-t-bodySmall { font: var(--fc-t-bodySmall); }
.fcsdk-root .fc-t-labelLarge { font: var(--fc-t-labelLarge); }
.fcsdk-root .fc-t-labelMedium { font: var(--fc-t-labelMedium); }
.fcsdk-root .fc-t-labelSmall { font: var(--fc-t-labelSmall); }
.fcsdk-root .fc-t-caption { font: var(--fc-t-caption); }
/* Android text is narrower than Chrome's for the SAME Roboto file: at 420dpi (the rs_qa
   reference, 2.625x) Android lays glyphs out on hinted advances. Measured on matched app/web
   strings (uiautomator bounds vs DOM rects, 2026-10-09): weight 400 is 98.4-98.7% of Chrome's
   width, 600 is 99.3-99.6%, 700 is 99.0%. Without this, lines that just fit on the device wrap
   on the web (e.g. a 255.6dp question in the 258dp bubble). Like the line-height trim below, it
   emulates the reference device's rasterizer, not a design value. */
.fcsdk-root { letter-spacing: -0.0066em; }
.fcsdk-root .fc-t-labelLarge, .fcsdk-root .fc-t-labelMedium, .fcsdk-root .fc-t-labelSmall { letter-spacing: -0.0026em; }
.fcsdk-root .fc-t-displayLarge, .fcsdk-root .fc-t-displayMedium, .fcsdk-root .fc-t-displaySmall,
.fcsdk-root .fc-t-titleLarge, .fcsdk-root .fc-t-titleMedium, .fcsdk-root .fc-t-titleSmall { letter-spacing: -0.0052em; }
/* Compose's default LineHeightStyle (Alignment.Proportional, Trim.Both) trims the extra
   leading above the first line and below the last: a text block is natural + (n-1)*lineHeight,
   where CSS gives n*lineHeight. CSS splits leading evenly, so pulling (L - natural)/2 off both
   ends lands the first baseline and every line exactly where Compose puts them. The trims
   are zero-height pseudo-elements so they never fight a layout margin. */
.fcsdk-root {
  --fc-tl-displayLarge: 42px;
  --fc-tl-displayMedium: 36px;
  --fc-tl-displaySmall: 32px;
  --fc-tl-titleLarge: 28px;
  --fc-tl-titleMedium: 24px;
  --fc-tl-titleSmall: 22px;
  --fc-tl-bodyLarge: 27px;
  --fc-tl-bodyMedium: 25px;
  --fc-tl-bodySmall: 22px;
  --fc-tl-labelLarge: 22px;
  --fc-tl-labelMedium: 20px;
  --fc-tl-labelSmall: 18px;
  --fc-tl-caption: 18px;
}
/* --fc-tn: the natural line box of the font actually rendering the text, as a multiple of the
   font size. Roboto is 2400/2048. Native-script names (a language list) are drawn by Noto on
   Android, whose boxes are taller; RadioRow sets the measured factor for those. */
.fcsdk-root [class*="fc-t-"]::before, .fcsdk-root [class*="fc-t-"]::after { content: ""; display: block; height: 0; }
.fcsdk-root .fc-t-displayLarge::before { margin-bottom: calc(-1 * ((var(--fc-tl-displayLarge) - 35px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-displayLarge::after { margin-top: calc(-1 * ((var(--fc-tl-displayLarge) - 35px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-displayMedium::before { margin-bottom: calc(-1 * ((var(--fc-tl-displayMedium) - 28px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-displayMedium::after { margin-top: calc(-1 * ((var(--fc-tl-displayMedium) - 28px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-displaySmall::before { margin-bottom: calc(-1 * ((var(--fc-tl-displaySmall) - 24px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-displaySmall::after { margin-top: calc(-1 * ((var(--fc-tl-displaySmall) - 24px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-titleLarge::before { margin-bottom: calc(-1 * ((var(--fc-tl-titleLarge) - 22px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-titleLarge::after { margin-top: calc(-1 * ((var(--fc-tl-titleLarge) - 22px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-titleMedium::before { margin-bottom: calc(-1 * ((var(--fc-tl-titleMedium) - 18px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-titleMedium::after { margin-top: calc(-1 * ((var(--fc-tl-titleMedium) - 18px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-titleSmall::before { margin-bottom: calc(-1 * ((var(--fc-tl-titleSmall) - 16px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-titleSmall::after { margin-top: calc(-1 * ((var(--fc-tl-titleSmall) - 16px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-bodyLarge::before { margin-bottom: calc(-1 * ((var(--fc-tl-bodyLarge) - 19px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-bodyLarge::after { margin-top: calc(-1 * ((var(--fc-tl-bodyLarge) - 19px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-bodyMedium::before { margin-bottom: calc(-1 * ((var(--fc-tl-bodyMedium) - 17px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-bodyMedium::after { margin-top: calc(-1 * ((var(--fc-tl-bodyMedium) - 17px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-bodySmall::before { margin-bottom: calc(-1 * ((var(--fc-tl-bodySmall) - 15px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-bodySmall::after { margin-top: calc(-1 * ((var(--fc-tl-bodySmall) - 15px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-labelLarge::before { margin-bottom: calc(-1 * ((var(--fc-tl-labelLarge) - 17px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-labelLarge::after { margin-top: calc(-1 * ((var(--fc-tl-labelLarge) - 17px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-labelMedium::before { margin-bottom: calc(-1 * ((var(--fc-tl-labelMedium) - 15px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-labelMedium::after { margin-top: calc(-1 * ((var(--fc-tl-labelMedium) - 15px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-labelSmall::before { margin-bottom: calc(-1 * ((var(--fc-tl-labelSmall) - 13px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-labelSmall::after { margin-top: calc(-1 * ((var(--fc-tl-labelSmall) - 13px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-caption::before { margin-bottom: calc(-1 * ((var(--fc-tl-caption) - 13px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }
.fcsdk-root .fc-t-caption::after { margin-top: calc(-1 * ((var(--fc-tl-caption) - 13px * var(--fc-tn, 1.171875)) / 2 * var(--fc-font-scale))); }

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
  /* Material3 Text's default style is bodyLarge. */
  font: var(--fc-t-bodyLarge);
  border-radius: var(--fc-radius);
  box-sizing: border-box;
}
/* Inline embedding (docs/07 C1): fill the host container flush, no rounded frame. */
/* Inline: the host container owns the height (a widget panel on a landscape phone is ~350 px), so
   the standalone 480 px floor would push the bottom of every screen out of reach. */
.fcsdk-root--inline { border-radius: 0; height: 100%; min-height: 0; }
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

/* Filled primary pill — the web port of the app's "All languages" chip
   (Surface(color = buttonPrimarySurface, shape = Radius.Rounded), labelLarge, 20px padding).
   Web rendered that chip as a transparent fcsdk-btn-text link at 14px, so it read as a
   tertiary action where the app draws a solid green button. */
.fcsdk-btn-pill-primary {
  border: none; background: var(--fc-brand-strong, #08361B); color: #ffffff;
  font-size: 17px; font-weight: 600; padding: 10px 20px; border-radius: 999px;
  cursor: pointer;
}

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
/* The AGENTIC Share chip carries the accent sweep border (app ChatResponseActions.kt @ bda80659,
   Compose brand.accentSweepBorder). CSS conic-gradient IS the same brush; Compose's sweep starts
   at 3 o'clock while conic-gradient starts at 12, which is why the Kotlin stops are rotated +90
   and these degrees are not. The legacy Share chip stays plain, as in the app.
   border-image cannot follow a border-radius, so the gradient is painted as a background layer
   and the chip's own surface is masked over the middle with two backgrounds and border-box/
   padding-box clipping — the standard gradient-border technique. */
.fcsdk-action-chip--accent {
  border: 3px solid transparent; border-radius: 999px;
  background:
    linear-gradient(var(--fc-surface), var(--fc-surface)) padding-box,
    conic-gradient(from 0deg at 50% 50%,
      var(--fc-accent-gradient-green) 0deg,
      var(--fc-accent-gradient-cyan) 90deg,
      var(--fc-accent-gradient-green) 180deg,
      var(--fc-accent-gradient-yellow) 270deg,
      var(--fc-accent-gradient-green) 360deg) border-box;
}
.fcsdk-action-chip--accent:hover { border-color: transparent; }
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
/* Related-questions variant. App parity (ChatResponseActions.kt 0456f364): 300ms, and fade ONLY
   — no translate — so the answer the farmer is still reading doesn't shift while it settles. */
@keyframes fcsdk-fade-in-only { from { opacity: 0; } to { opacity: 1; } }
@keyframes fcsdk-dot-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: no-preference) {
  .fcsdk-fade-in { animation: fcsdk-fade-in 0.32s ease both; }
  .fcsdk-fade-in-only { animation: fcsdk-fade-in-only 0.3s ease both; }
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
/* Tables. 1-2 columns render as a weighted grid that fills the answer width. */
.fcsdk-md-tablewrap { position: relative; max-width: 100%; }
.fcsdk-md-table { border-collapse: collapse; width: 100%;
  border: 1px solid var(--fc-border); border-radius: 8px; overflow: hidden; }
.fcsdk-md-table th, .fcsdk-md-table td { padding: 10px 12px; vertical-align: top; }
.fcsdk-md-table th { background: var(--fc-surface); font-size: 12.5px; font-weight: 700; }
.fcsdk-md-table td { font-size: 13.5px; }
/* Body rows alternate, as in the Kotlin (surfaceSecondary / surfaceReadingSecondary). */
.fcsdk-md-table tbody tr:nth-child(odd) { background: var(--fc-bg); }
.fcsdk-md-table tbody tr:nth-child(even) { background: var(--fc-surface); }
/* 3+ columns: one card per data row (app parity, MarkdownText.kt 1b0553d2). Cell 0 is the card
   title; every other column is a label/value pair, the label stacked ABOVE the value and each
   full width, so neither wraps inside a narrow half-column. Nothing here scrolls sideways. */
.fcsdk-md-rowcards { display: flex; flex-direction: column; gap: 12px; max-width: 100%; }
.fcsdk-md-rowcard { background: var(--fc-surface); border-radius: 16px; padding: 14px 16px;
  display: flex; flex-direction: column; gap: 10px; }
.fcsdk-md-rowcard-title { margin: 0; font-size: 14px; font-weight: 700; color: var(--fc-text);
  padding-bottom: 10px; border-bottom: 1px solid var(--fc-border); }
.fcsdk-md-rowcard-pairs { margin: 0; display: flex; flex-direction: column; gap: 10px; }
.fcsdk-md-rowcard-pair { display: flex; flex-direction: column; gap: 2px; }
.fcsdk-md-rowcard-pair dt { min-width: 0; overflow-wrap: anywhere;
  font-size: 13.5px; color: var(--fc-text-muted); }
.fcsdk-md-rowcard-pair dd { min-width: 0; overflow-wrap: anywhere; margin: 0;
  font-size: 13.5px; font-weight: 700; color: var(--fc-text); }

/* Answer card: a 3-column table whose header row is a title plus two empty cells, and whose body rows are
   label / value / meaning triples (Kotlin MarkdownAnswerCard). Same filled surface as a row
   card; a divider sits under the title and between readings, and the card edge closes the last. */
.fcsdk-md-answercard { background: var(--fc-surface); border-radius: 16px; padding: 14px 16px;
  display: flex; flex-direction: column; gap: 12px; max-width: 100%; }
.fcsdk-md-answercard-title { margin: 0; font-size: 14px; font-weight: 700; color: var(--fc-text);
  padding-bottom: 12px; border-bottom: 1px solid var(--fc-border); }
.fcsdk-md-answercard-reading { display: flex; flex-direction: column; gap: 2px;
  padding-bottom: 12px; border-bottom: 1px solid var(--fc-border); }
.fcsdk-md-answercard-reading:last-child { padding-bottom: 0; border-bottom: none; }
.fcsdk-md-answercard-label { margin: 0; font-size: 13.5px; color: var(--fc-text-muted);
  overflow-wrap: anywhere; }
.fcsdk-md-answercard-value { margin: 0; font-size: 15px; font-weight: 700; color: var(--fc-text);
  overflow-wrap: anywhere; }
.fcsdk-md-answercard-meaning { margin: 2px 0 0; font-size: 15px; color: var(--fc-text-muted);
  overflow-wrap: anywhere; }

/* --- agentic Home + Terms-of-Use dialog (2.0.0) ---------------------------------------------------
   App parity (HomeScreen.kt:534): in agentic mode the surface is the grey READING surface and the
   green lives only in a gradient band behind the header and first card, so the app bar is
   transparent and the band shows through it. */
.fcsdk-home--agentic { background: var(--fc-surface-reading); }
/* App parity (HomeAppBar @ 2cd71328): Home trims its bar so the logo below it is not left
   with a large gap under the vertically-centered menu/weather buttons. Scoped to agentic
   Home — every other screen keeps the shared 54px bar, as the app keeps 64 elsewhere. */
.fcsdk-home--agentic .fcsdk-appbar { background: transparent; color: var(--fc-appbar-text);
  min-height: 52px; }
/* Band + glow sit behind; the app bar and scroller are lifted above them. */
.fcsdk-home-band { position: absolute; left: 0; right: 0; top: 0; height: 36.6%; z-index: 0;
  pointer-events: none;
  background: linear-gradient(to bottom, var(--fc-brand) 0%, var(--fc-brand) 58.8%,
    rgba(0, 0, 0, 0) 100%); }
.fcsdk-home-band-glow { position: absolute; left: 50%; top: 0; transform: translateX(-50%);
  width: 100%; height: 148px; pointer-events: none;
  background: radial-gradient(ellipse at top center, rgba(255, 249, 71, 0.30), rgba(255, 249, 71, 0) 70%); }
.fcsdk-home--agentic .fcsdk-appbar, .fcsdk-home--agentic .fcsdk-scroll { position: relative; z-index: 1; }
/* FIXED centred top section: 42px logo mark, leaf-flanked section title, location pill. Sits
   above the scroller (so cards pass beneath it) on a transparent ground, so the band shows
   through. App parity, HomeScreen.kt 70adc5fd. */
/* The feed and its fixed header share a positioned container, so the header's absolute origin
   is the top of the FEED, not the top of the screen. Without it the header would resolve to the
   flex container's content-box origin and cover the app bar. */
.fcsdk-home-feedwrap { position: relative; flex: 1; min-height: 0;
  display: flex; flex-direction: column; }
.fcsdk-home-feedwrap > .fcsdk-scroll { flex: 1; min-height: 0; }
.fcsdk-home-agentic-head { position: absolute; top: 0; left: 0; right: 0; z-index: 2;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 0 16px 16px; text-align: center; color: var(--fc-appbar-text); }
/* The feed's top strip masks out behind the fixed header, so cards dissolve INTO the band as
   they scroll up rather than covering it. The --fcsdk-headmask-end var is the measured header
   height; the ramp sits in its last fifth, where cards emerge below the header. */
.fcsdk-scroll--headmask {
  -webkit-mask-image: linear-gradient(to bottom, transparent 0,
    transparent calc(var(--fcsdk-headmask-end, 0px) * 0.8), #000 var(--fcsdk-headmask-end, 0px));
  mask-image: linear-gradient(to bottom, transparent 0,
    transparent calc(var(--fcsdk-headmask-end, 0px) * 0.8), #000 var(--fcsdk-headmask-end, 0px));
}
/* The greeting stays in the scroller (feed content), directly under the fixed header. */
.fcsdk-home-agentic-greeting { padding: 0 16px 12px; text-align: center; }
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
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; }
.fcsdk-composer > * { pointer-events: auto; }
/* InputComposer.kt: the floating wrapper paints an opaque surfacePrimary slab from the sheet's
   top edge to the bottom, so no feed content shows in the gutters or below the pill. */
.fcsdk-composer--floating { padding-bottom: max(var(--fc-inset-bottom), 20px); background: var(--fc-c-surface-primary); }
.fcsdk-composer--anchored { padding-bottom: var(--fc-inset-bottom); background: var(--fc-bg); }
/* InputComposer.kt: offset(y = 400.dp), tween(300). */
.fcsdk-composer--hidden { transform: translateY(400px); }
.fcsdk-composer--hidden > * { pointer-events: none; }
.fcsdk-composer-sheet { background: var(--fc-c-brand-surface-primary);
  transition: padding 250ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 250ms cubic-bezier(0.4, 0, 0.2, 1); }
.fcsdk-composer-row { display: flex; align-items: flex-end; }
.fcsdk-composer-btn { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%; background: #08361B; line-height: 1; padding: 0;
  transition: width 250ms cubic-bezier(0.4, 0, 0.2, 1), height 250ms cubic-bezier(0.4, 0, 0.2, 1), font-size 250ms cubic-bezier(0.4, 0, 0.2, 1); }
.fcsdk-composer-field { position: relative; flex: 1 1 auto; min-width: 0; overflow: hidden;
  display: flex; flex-direction: column; justify-content: center; cursor: text;
  background: var(--fc-c-surface-secondary);
  transition: background 220ms cubic-bezier(0.4, 0, 0.2, 1), min-height 250ms cubic-bezier(0.4, 0, 0.2, 1); }
.fcsdk-composer-field--active { background: var(--fc-c-reading-tertiary); }
.fcsdk-composer-thumbs, .fcsdk-composer-fieldrow { position: relative; z-index: 2; }
.fcsdk-composer-thumbs { display: flex; gap: 5px; padding: 10px 0; }
.fcsdk-composer-thumb { position: relative; flex: 0 0 auto; border-radius: 8px; overflow: hidden; }
.fcsdk-composer-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.fcsdk-composer-thumb button { position: absolute; top: 3px; right: 3px; width: 20px; height: 20px;
  display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: 50%;
  background: var(--fc-c-surface-secondary); padding: 0; }
.fcsdk-composer-fieldrow { display: flex; align-items: center; width: 100%; padding: 0; }
.fcsdk-composer-input { flex: 1 1 auto; width: 100%; min-height: 24px; max-height: 72px;
  border: none; outline: none; resize: none; background: transparent; color: var(--fc-c-fg-primary);
  caret-color: var(--fc-c-fg-primary); font: var(--fc-t-bodyMedium); padding: 0; overflow-y: auto; }
.fcsdk-composer-placeholder { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%);
  pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: clip;
  color: var(--fc-c-placeholder); font: var(--fc-t-bodyMedium); transition: color 220ms cubic-bezier(0.4, 0, 0.2, 1); }
.fcsdk-composer-field:not(.fcsdk-composer-field--active) .fcsdk-composer-placeholder { color: var(--fc-c-fg-primary); }
.fcsdk-composer-placeholder--in { animation: fcsdk-ph-in 400ms ease both; }
.fcsdk-composer-placeholder--out { animation: fcsdk-ph-out 400ms ease both; }
/* Placeholder shimmer sweep — Compose ShimmerText.kt, 2250ms linear, idle only. The band is 1.2x
   the text width (ramp 0-35%, plateau 35-65%, ramp 65-100%) and travels from fully off the left
   edge to fully off the right. Tile = 3.2W laid out base [0,W] band [W,2.2W] base [2.2W,3.2W],
   no repeat, so position 100% -> 0% sweeps the band across once with no wrap-around copy. */
.fcsdk-composer-placeholder--shimmer {
  background-image: linear-gradient(95deg, currentColor 0%, currentColor 31.25%,
    var(--fc-c-border-active) 44.375%, var(--fc-c-border-active) 55.625%, currentColor 68.75%, currentColor 100%);
  background-size: 320% 100%; background-repeat: no-repeat; -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: fcsdk-ph-shimmer 2250ms linear infinite; }
.fcsdk-root[data-fc-theme="day"] .fcsdk-composer-placeholder--shimmer,
.fcsdk-root[data-fc-theme="night"] .fcsdk-composer-placeholder--shimmer { -webkit-text-fill-color: transparent; }
@keyframes fcsdk-ph-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes fcsdk-ph-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes fcsdk-ph-shimmer { from { background-position: 100% 0; } to { background-position: 0% 0; } }
/* Ambient "aura": a conic gradient rotating behind the field, with an inset panel of the
   field's own background drawn over it so only a ~2.4px ring shows. Home-only, idle-only.
   Colours are InputComposer.kt AuraColors; 7s rotation; the opacity keyframes replay the
   Kotlin breath (2 gentle breaths, then a deep ebb and slow swell) over its 15s cycle. */
.fcsdk-composer-field--aura::before { content: ''; position: absolute; z-index: 0;
  left: 50%; top: 50%; width: 260%; aspect-ratio: 1; border-radius: 50%;
  background: conic-gradient(from 0turn, #00C950, #22D3EE, #00C950, #FFF947, #00C950);
  animation: fcsdk-aura-spin 7s linear infinite, fcsdk-aura-breathe 15s ease-in-out infinite; }
/* The panel's edge is blurred so the ring fades inward, standing in for the Kotlin bloom
   (a crisp 2.4dp core over wider 3.6dp / 5.4dp strokes at 0.30 / 0.16 alpha). */
.fcsdk-composer-field--aura::after { content: ''; position: absolute; z-index: 1; inset: 3.4px;
  border-radius: 13px; background: inherit; filter: blur(1.6px); }
@keyframes fcsdk-aura-spin {
  from { transform: translate(-50%, -50%) rotate(0turn); }
  to { transform: translate(-50%, -50%) rotate(1turn); } }
@keyframes fcsdk-aura-breathe {
  0% { opacity: 1; } 16% { opacity: 1; } 32% { opacity: 0.5; } 48% { opacity: 1; }
  64% { opacity: 0.5; } 82.667% { opacity: 0.04; } 100% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .fcsdk-composer-field--aura::before { animation: none; opacity: 0.7; }
  .fcsdk-composer-placeholder--shimmer { animation: none; color: var(--fc-text-muted);
    -webkit-text-fill-color: currentColor; background-image: none; }
}

/* --- misc ------------------------------------------------------------------------------------------------------ */
.fcsdk-error-inline { color: var(--fc-danger); font-size: 13px; }
.fcsdk-bottombar { border-top: 1px solid var(--fc-border); background: var(--fc-surface);
  border-radius: 18px 18px 0 0; padding: 14px 16px 18px; display: flex; flex-direction: column; gap: 10px; }
/* App parity (LanguageScreen.kt 47bc8524): one flowing paragraph, justified end-to-end and
   capped at the app's 260dp measure. The inline buttons sit in the text flow, so they wrap
   with it instead of forming their own centred line. */
.fcsdk-legal-links { font-size: 12.5px; color: var(--fc-text-muted); text-align: justify;
  max-width: 260px; margin: 0 auto; }
.fcsdk-legal-links button { border: none; background: none; color: var(--fc-brand-bright); font-size: 12.5px; text-decoration: underline; padding: 0; font-family: inherit; line-height: inherit; cursor: pointer; }
.fcsdk-countrysel { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 10px 14px;
  border: 1.5px solid var(--fc-border); border-radius: var(--fc-radius-input); background: var(--fc-card); color: var(--fc-text); font-size: 16px; }
.fcsdk-timer { text-align: center; font-size: 14px; color: var(--fc-text-muted); }

/* --- location prompt (docs/01 section 3.15) ---------------------------------------------------- */
.fcsdk-location-layer { padding: 0; align-items: stretch; justify-content: stretch; }
.fcsdk-location-layer > .fcsdk-fullmsg { width: 100%; height: 100%; }
.fcsdk-fullmsg-bartitle { flex: 1; text-align: center; font-size: 17px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fcsdk-fullmsg-barspacer { width: 40px; height: 40px; flex-shrink: 0; }
.fcsdk-fullmsg-barright { border: none; background: transparent; color: inherit; font-size: 15px; font-weight: 600;
  padding: 8px 10px; min-width: 40px; }
.fcsdk-fullmsg-illustration--node { font-size: inherit; filter: none; width: 100%; display: flex; justify-content: center; }
/* Interstitial illustration: Fit, max width 322, with the illustration gradient overlay. */
.fcsdk-location-illustration { position: relative; width: 100%; max-width: 322px; aspect-ratio: 1 / 1;
  display: flex; align-items: center; justify-content: center; font-size: 120px; line-height: 1; }
.fcsdk-location-illustration::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 40%;
  background: linear-gradient(to bottom, rgba(0,0,0,0), var(--fc-brand)); pointer-events: none; }
/* Recovery sheet: no drag handle, 24 top corners, light surfacePrimary, 20/16 padding, 12 spacing. */
.fcsdk-location-sheet-scrim { z-index: 51; }
.fcsdk-location-sheet { z-index: 52; background: #ECECEE; color: #000; border-radius: 24px 24px 0 0;
  padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; max-height: 100%; overflow-y: auto; }
.fcsdk-location-sheet-image { position: relative; width: 100%; height: 382px; max-height: 50vh; flex-shrink: 0;
  border-radius: 24px; overflow: hidden; background: linear-gradient(180deg, #cfe3d6 0%, #9cc7a9 100%);
  display: flex; align-items: center; justify-content: center; font-size: 140px; line-height: 1; }
.fcsdk-location-sheet-close { position: absolute; top: 12px; right: 12px; width: 44px; height: 44px;
  border: none; border-radius: 14px; background: #fff; color: #000; font-size: 18px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center; }
.fcsdk-location-sheet-spacer { height: 4px; flex-shrink: 0; }
.fcsdk-location-sheet-title { text-align: center; font-size: 22px; line-height: 28px; font-weight: 600; color: #000; }
.fcsdk-location-sheet-body { text-align: center; font-size: 14px; line-height: 20px; color: #000; }
.fcsdk-location-sheet-cta { padding-bottom: 8px; }
.fcsdk-location-sheet-cta .fcsdk-btn-primary { min-height: 56px; }
/* Settings "My Farm" helper caption. */
.fcsdk-settings-location-helper { padding: 6px 20px 0; font-size: 12.5px; color: var(--fc-text-muted); }
.fcsdk-settings-location-helper em { font-style: normal; color: var(--fc-brand); }
.fcsdk-li-trailing-text { color: var(--fc-text-muted); font-size: 14px; display: inline-flex; align-items: center; gap: 6px;
  max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ===========================================================================
   Compose-fidelity components (fcsdk-c-*). Values come from the compose module;
   comments name the source.
   =========================================================================== */

/* Material3 1.4.0 (compose-bom 2026.02.01) indeterminate CircularProgressIndicator, round caps:
   one 6000ms cycle — the arc grows 10% -> 87% linearly over 3000ms, then shrinks back with
   cubic-bezier(.2,0,0,1); the whole ring turns 1080deg linearly plus a +90deg step (300ms) at
   0/1500/3000/4500ms = 1440deg per cycle. Most frames read as a near-full ring. */
.fcsdk-c-progress { display: block; flex: 0 0 auto; animation: fcsdk-c-rotate 6000ms linear infinite; }
.fcsdk-c-progress circle {
  stroke-dasharray: calc(var(--fc-c-circ) * 1px) calc(var(--fc-c-circ) * 1px);
  animation: fcsdk-c-arc 6000ms infinite;
}
@keyframes fcsdk-c-rotate {
  0% { transform: rotate(0deg); } 5% { transform: rotate(144deg); } 25% { transform: rotate(360deg); }
  30% { transform: rotate(504deg); } 50% { transform: rotate(720deg); } 55% { transform: rotate(864deg); }
  75% { transform: rotate(1080deg); } 80% { transform: rotate(1224deg); } 100% { transform: rotate(1440deg); } }
@keyframes fcsdk-c-arc {
  0%   { stroke-dashoffset: calc(var(--fc-c-circ) * 0.9px); animation-timing-function: linear; }
  50%  { stroke-dashoffset: calc(var(--fc-c-circ) * 0.13px); animation-timing-function: cubic-bezier(0.2, 0, 0, 1); }
  100% { stroke-dashoffset: calc(var(--fc-c-circ) * 0.9px); }
}

/* Buttons.kt PrimaryButton */
.fcsdk-c-btn-primary {
  display: flex; align-items: center; justify-content: center; width: 100%;
  margin: 0; border: none; border-radius: var(--fc-radius-btn);
  background: var(--fc-c-button-surface); color: var(--fc-c-button-fg);
  padding: 0 8px 0 16px; -webkit-tap-highlight-color: transparent;
}
.fcsdk-root .fcsdk-c-btn-primary { cursor: pointer; }
.fcsdk-c-btn-primary--default { padding: 0 16px 0 24px; }
.fcsdk-c-btn-primary:disabled { cursor: default; }
.fcsdk-c-btn-label { text-align: center; color: var(--fc-c-button-fg); }
.fcsdk-c-btn-primary[data-enabled="false"] .fcsdk-c-btn-label,
.fcsdk-c-btn-primary[data-enabled="false"] .fcsdk-c-btn-icon { opacity: 0.5; }
.fcsdk-c-btn-spinner { margin-left: 12px; }
.fcsdk-c-btn-primary--light { background: #FFFFFF; }
.fcsdk-c-btn-primary--light .fcsdk-c-btn-label { color: #08361B; }

/* Buttons.kt SecondaryButton */
.fcsdk-c-btn-secondary {
  display: flex; align-items: center; justify-content: center; width: 100%; height: 48px;
  margin: 0; padding: 0 16px 0 24px; border: none; border-radius: 999px;
  background: var(--fc-c-surface-secondary); color: var(--fc-c-fg-primary);
}
.fcsdk-c-btn-secondary[data-enabled="false"] span { opacity: 0.5; }

/* LogoSpinner.kt — Vertical */
.fcsdk-c-logospinner { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.fcsdk-c-logospinner-mark { position: relative; width: 55px; height: 55px; }
.fcsdk-c-logospinner-logo { position: absolute; left: 11.5px; top: 11.5px; }
.fcsdk-c-logospinner-label { color: var(--fc-c-fg-primary); text-align: center; animation: fcsdk-c-fadein 400ms ease-in-out; }
@keyframes fcsdk-c-fadein { from { opacity: 0; } to { opacity: 1; } }

/* Toast.kt */
.fcsdk-c-toast {
  position: absolute; left: 20px; right: 20px; bottom: 24px; z-index: 70;
  display: flex; align-items: center; padding: 13px 16px; border-radius: 16px;
  background: var(--fc-c-surface-secondary);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
  animation: fcsdk-c-toast-in 300ms ease-out;
}
@keyframes fcsdk-c-toast-in { from { transform: translateY(calc(100% + 24px)); } to { transform: none; } }
.fcsdk-c-toast-badge { flex: 0 0 32px; width: 32px; height: 32px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; background: #00C950; }
.fcsdk-c-toast-badge--error { background: #E5533D; }
.fcsdk-c-toast-text { flex: 1; padding-left: 12px; color: var(--fc-c-fg-primary); }

/* Form.kt RadioButton */
.fcsdk-c-radio {
  display: flex; align-items: center; width: 100%; margin: 0; padding: 14px 16px;
  border: none; border-radius: 12px; text-align: left;
  background: var(--fc-c-surface-secondary); color: var(--fc-c-fg-primary);
  -webkit-tap-highlight-color: transparent;
}
.fcsdk-c-radio--selected { background: var(--fc-c-surface-active); background-image: linear-gradient(var(--fc-c-surface-active), var(--fc-c-surface-active)); }
.fcsdk-c-radio:disabled { cursor: default; }
.fcsdk-c-radio-indicator { flex: 0 0 20px; width: 20px; height: 20px; border-radius: 50%;
  background: var(--fc-c-surface-secondary); display: flex; align-items: center; justify-content: center; }
.fcsdk-c-radio-dot { width: 20px; height: 20px; border-radius: 50%; background: var(--fc-c-surface-tertiary); }
.fcsdk-c-radio--selected .fcsdk-c-radio-dot { width: 10px; height: 10px; background: var(--fc-c-border-active); }
.fcsdk-c-radio-label { flex: 1; min-width: 0; margin-left: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--fc-c-fg-primary); }
.fcsdk-c-radio-trailing { margin-left: 14px; }

/* "All languages" chip — Surface(onClick), labelLarge, 20/10 padding inside a 48dp target. */
.fcsdk-c-chip-primary {
  display: inline-flex; align-items: center; height: 48px; padding: 0 20px; border: none;
  border-radius: 999px; background: var(--fc-c-button-surface); color: var(--fc-c-button-fg);
}

/* Screen scaffolding shared by the ported screens */
.fcsdk-c-screen { position: relative; background: var(--fc-c-surface-primary); }
.fcsdk-c-center { flex: 1; display: flex; align-items: center; justify-content: center; }
.fcsdk-c-title { margin: 0; text-align: center; color: var(--fc-c-fg-primary); }
.fcsdk-c-subtitle { margin: 0; text-align: center; color: var(--fc-c-fg-secondary); }

/* LanguageScreen.kt */
.fcsdk-c-lang-scroll { display: flex; flex-direction: column; align-items: center; padding: 32px 24px 24px; }
.fcsdk-c-lang-list { display: flex; flex-direction: column; gap: 6px; width: 100%; margin-top: 24px; }
.fcsdk-c-lang-panel {
  flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 20px;
  padding: 28px 24px calc(16px + var(--fc-inset-bottom)); border-radius: 24px 24px 0 0; background: var(--fc-c-surface-secondary);
}
.fcsdk-c-legal { margin: 0; max-width: 260px; text-align: justify; color: var(--fc-c-fg-secondary); }
.fcsdk-c-legal [role="link"] { color: var(--fc-c-fg-secondary); text-decoration: underline; cursor: pointer; }

/* Form.kt TextInput (M3 OutlinedTextField) */
.fcsdk-c-input {
  box-sizing: border-box; width: 100%; height: 56px; margin: 0; padding: 0 16px;
  border: none; border-radius: var(--fc-radius-input); outline: none;
  background: var(--fc-c-surface-secondary); color: var(--fc-c-fg-primary); caret-color: var(--fc-c-border-active);
  box-shadow: inset 0 0 0 1px var(--fc-c-border-default);
  font: var(--fc-t-bodyLarge);
}
.fcsdk-c-input:focus { box-shadow: inset 0 0 0 2px var(--fc-c-border-active); }
.fcsdk-c-input--error, .fcsdk-c-input--error:focus { box-shadow: inset 0 0 0 2px var(--fc-c-feedback-fail); }
.fcsdk-c-input::placeholder { color: var(--fc-c-fg-secondary); opacity: 1; }

/* EnterNameScreen.kt */
.fcsdk-c-name-scroll { display: flex; flex-direction: column; align-items: center; padding: 32px 24px 24px; }
.fcsdk-c-fade { transition: opacity 250ms ease; }
.fcsdk-c-fade--out { opacity: 0; pointer-events: none; }

/* SplashScreen.kt */
.fcsdk-c-splash { position: relative; align-items: center; justify-content: center;
  background-color: var(--fc-c-brand-surface-primary); background-size: cover; background-position: center; }
.fcsdk-c-splash-mark { animation: fcsdk-c-splash-spin 3600ms infinite; }
@keyframes fcsdk-c-splash-spin {
  0%, 83.333% { transform: rotate(0deg); animation-timing-function: cubic-bezier(0, 0, 0.58, 1); }
  100% { transform: rotate(360deg); }
}

/* Buttons.kt ActionButton */
.fcsdk-c-actionbtn {
  display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; height: 42px; margin: 0;
  border: none; background: var(--fc-c-brand-surface-secondary); color: var(--fc-c-brand-fg-primary);
  -webkit-tap-highlight-color: transparent;
}
.fcsdk-c-actionbtn-label { white-space: nowrap; color: var(--fc-c-brand-fg-primary); }

/* AppBars.kt DefaultAppBar */
.fcsdk-c-appbar {
  position: relative; flex: 0 0 64px; height: 64px; display: flex; align-items: center;
  justify-content: space-between; padding: 0 16px; background: var(--fc-c-brand-surface-primary);
}
.fcsdk-c-appbar > :not(.fcsdk-c-appbar-glow) { position: relative; }
.fcsdk-c-appbar-glow { position: absolute; left: 0; top: 0; width: 100%; height: 80px; pointer-events: none; }
/* LogoAppBar.kt: the glow's 80dp is clamped by the bar's own box (64 + status-bar inset), so it
   never paints below the bar; the bar takes the status-bar inset as top padding. */
.fcsdk-c-chat > .fcsdk-c-appbar { overflow: hidden; flex-basis: calc(64px + var(--fc-inset-top, 0px));
  height: calc(64px + var(--fc-inset-top, 0px)); padding-top: var(--fc-inset-top, 0px); }
.fcsdk-c-appbar-leftbutton { flex: 0 0 42px; width: 42px; height: 42px; margin: 0; padding: 0; border: none;
  background: none; border-radius: 50%; cursor: pointer; }
.fcsdk-c-appbar-leftbutton > svg { display: block; }
.fcsdk-c-appbar-title { flex: 1; min-width: 0; text-align: center; color: var(--fc-c-brand-fg-primary); }
.fcsdk-c-appbar-spacer { flex: 0 0 42px; width: 42px; height: 42px; }

/* Lists.kt ListCard / ListItem */
.fcsdk-c-listcard { border-radius: 12px; background: var(--fc-c-surface-secondary); padding: 6px 16px 4px; }
.fcsdk-c-li {
  display: flex; align-items: center; width: 100%; min-height: 48px; margin: 0; padding: 0;
  border: none; background: none; text-align: left; color: var(--fc-c-fg-primary);
}
.fcsdk-c-li--multi { align-items: flex-start; min-height: 0; padding: 12px 0; }
.fcsdk-c-divider { height: 1px; background: var(--fc-c-border-default); }
.fcsdk-c-li-text { flex: 0 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--fc-c-fg-primary); }
.fcsdk-c-li-right { flex: 1; min-width: 0; margin-left: 12px; text-align: right; color: var(--fc-c-fg-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fcsdk-c-li-right--multi { white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; }
.fcsdk-c-li-trailing { margin-left: 12px; }

/* Settings / Help / History scaffolding */
.fcsdk-c-page { display: flex; flex-direction: column; padding: 32px 20px; }
.fcsdk-c-section { display: flex; flex-direction: column; gap: 10px; }
.fcsdk-c-section-title { margin: 0; color: var(--fc-c-fg-primary); }
.fcsdk-c-muted { color: var(--fc-c-fg-secondary); }

/* SettingsScreen.kt appearance tiles */
.fcsdk-c-modes { display: flex; gap: 6px; }
.fcsdk-c-mode {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 0; padding: 16px 0 14px;
  border: none; border-radius: 16px; background: var(--fc-c-surface-secondary); color: var(--fc-c-fg-primary);
  box-shadow: inset 0 0 0 2px transparent;
}
.fcsdk-c-mode--active { box-shadow: inset 0 0 0 2px var(--fc-c-border-active); }
.fcsdk-c-accent { color: #008236; }

.fcsdk-c-skeleton-bar { height: 48px; border-radius: 12px; background: var(--fc-c-shimmer); }

/* LegalContentScreen.kt */
.fcsdk-c-legalscreen { position: absolute; inset: 0; z-index: 60; display: flex; flex-direction: column;
  background: var(--fc-c-reading-primary); }
.fcsdk-c-legalscreen-body { position: relative; flex: 1; min-height: 0; }
.fcsdk-c-legalscreen-body iframe { display: block; width: 100%; height: 100%; border: 0; background: var(--fc-c-reading-primary); }
.fcsdk-c-legalscreen-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: var(--fc-c-reading-primary); }

.fcsdk-c-logospinner--h { flex-direction: row; gap: 12px; }
/* ShimmerText.kt as LogoSpinnerHorizontal uses it: base foregroundPrimary, highlight borderActive
   (#00C950), a 1.2W band (ramp 0-35%, plateau 35-65%, ramp 65-100%) swept from fully off the left
   to fully off the right every 1200ms, linear. Same tile geometry as the composer placeholder. */
.fcsdk-c-shimmer {
  color: transparent; -webkit-text-fill-color: transparent; -webkit-background-clip: text; background-clip: text;
  background-image: linear-gradient(95deg, var(--fc-c-fg-primary) 0%, var(--fc-c-fg-primary) 31.25%,
    var(--fc-c-border-active) 44.375%, var(--fc-c-border-active) 55.625%, var(--fc-c-fg-primary) 68.75%, var(--fc-c-fg-primary) 100%);
  background-size: 320% 100%; background-repeat: no-repeat; animation: fcsdk-c-shimmer 1200ms linear infinite;
}
@keyframes fcsdk-c-shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
.fcsdk-c-btn-wrap { width: auto; }

.fcsdk-c-footer { flex: 0 0 auto; padding: 16px 24px calc(8px + var(--fc-inset-bottom)); background: var(--fc-c-surface-secondary); }

/* ---------------------------------------------------------------- HomeScreen.kt */
.fcsdk-c-home { position: relative; }
.fcsdk-c-home-band { position: absolute; left: 0; right: 0; top: 0; height: 36.6%; z-index: 0; pointer-events: none;
  background: linear-gradient(to bottom, var(--fc-c-brand-surface-primary) 0%, var(--fc-c-brand-surface-primary) 58.8%, rgba(0, 130, 54, 0) 100%); }
.fcsdk-c-home-glow { position: absolute; left: 0; top: 0; width: 100%; height: 148px; }
.fcsdk-c-home-appbar { position: relative; z-index: 3; flex: 0 0 52px; height: 52px; display: flex; align-items: center;
  justify-content: space-between; padding: 0 16px; }
.fcsdk-c-home-appbar--legacy { background: var(--fc-c-brand-surface-primary); }
.fcsdk-c-home-appbar--legacy .fcsdk-c-appbar-glow { height: 52px; }
.fcsdk-c-home-appbar > :not(.fcsdk-c-appbar-glow) { position: relative; }
/* Buttons.kt WeatherButton */
.fcsdk-c-weather { display: inline-flex; align-items: center; height: 44px; margin: 0; padding: 0 8px 0 14px; border: none;
  border-radius: 999px; background: var(--fc-c-brand-surface-secondary); color: var(--fc-c-brand-fg-primary); }
.fcsdk-c-weather--loading { padding-right: 16px; }
.fcsdk-c-home .fcsdk-home-feedwrap { z-index: 1; }
/* Agentic fixed header (HomeScreen.kt FixedHeader) */
.fcsdk-c-home-head { position: absolute; top: 0; left: 0; right: 0; z-index: 2; display: flex; flex-direction: column;
  align-items: center; gap: 12px; padding: 0 0 16px; }
.fcsdk-c-sectionheader { display: flex; align-items: center; gap: 10px; width: 100%; padding: 0 24px; box-sizing: border-box; }
.fcsdk-c-sectionheader-title { font-weight: 600; text-align: center; color: #FFFFFF; }
.fcsdk-c-leafdivider { flex: 1; height: 4px; background-color: var(--fc-c-button-accent);
  -webkit-mask: var(--fc-leaf-mask) repeat-x center / 8px 4px; mask: var(--fc-leaf-mask) repeat-x center / 8px 4px; }
/* LocationButton.kt */
.fcsdk-c-pill { display: inline-flex; align-items: center; max-width: calc(100% - 32px); height: 42px; margin: 0;
  padding: 0 22px 0 14px; border: none; border-radius: 999px; background: var(--fc-c-brand-surface-secondary);
  color: #FFFFFF; transition: background-color 300ms ease; }
.fcsdk-c-pill--invite { background: rgba(8, 54, 27, 0.72); }
.fcsdk-c-pill--success, .fcsdk-c-pill--located { height: 40px; }
.fcsdk-c-pill-text { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #FFFFFF; }
/* Legacy header blocks */
.fcsdk-c-greeting { display: flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 16px;
  background: var(--fc-c-brand-surface-primary); text-align: center; color: var(--fc-c-brand-fg-primary); }
.fcsdk-c-wobble { display: inline-block; animation: fcsdk-c-wobble 900ms ease-in-out 1000ms 1 both; }
@keyframes fcsdk-c-wobble {
  0% { transform: scale(1); } 15% { transform: scale(0.95); } 33% { transform: scale(1); }
  42% { transform: rotate(1.5deg); } 58% { transform: rotate(-1.5deg); } 67% { transform: rotate(0); }
  75% { transform: rotate(1.5deg); } 92% { transform: rotate(-1.5deg); } 100% { transform: rotate(0); } }
.fcsdk-c-tiles { position: sticky; top: 0; z-index: 2; background: var(--fc-c-brand-surface-primary); padding: 8px 16px 10px; }
.fcsdk-c-tilerow { display: flex; gap: 6px; }
.fcsdk-c-tile { flex: 1; height: 78px; display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  margin: 0; padding: 17px 8px 12px; border: none; border-radius: 16px; background: var(--fc-c-brand-surface-secondary);
  transition: transform 200ms cubic-bezier(.42, 0, .58, 1); }
.fcsdk-c-tile:active { transform: scale(0.92); transition-duration: 100ms; }
.fcsdk-c-tile-label { font: 600 13px/18px var(--fc-font); color: var(--fc-c-button-fg); }
.fcsdk-c-feedheader { padding: 16px 24px; text-align: center; color: var(--fc-c-fg-primary); }
/* Feed items */
.fcsdk-c-feeditem { padding: 0 16px; }
.fcsdk-c-feeditem--gap { padding-bottom: 16px; }
.fcsdk-c-card { position: relative; overflow: hidden; border-radius: var(--fc-radius-lg); background: var(--fc-c-surface-secondary);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05), 0 16px 40px rgba(0, 0, 0, 0.06); transition: opacity 400ms ease; }
.fcsdk-c-card--leaving { opacity: 0; }
.fcsdk-c-press { transition: transform 200ms cubic-bezier(.42, 0, .58, 1); }
.fcsdk-c-press:active { transform: scale(0.95); transition: transform 100ms cubic-bezier(0, 0, .58, 1); }
.fcsdk-c-card-imgwrap { padding: 8px 8px 0; margin-bottom: 8px; }
.fcsdk-c-card-imgframe { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 16px; background: var(--fc-c-surface-primary); }
.fcsdk-c-card-imgframe img { display: block; width: 100%; height: 220px; object-fit: cover; object-position: center top; }
.fcsdk-c-card-badge { position: absolute; top: 12px; right: 12px; display: inline-flex; align-items: center; gap: 5px; height: 28px;
  padding: 0 10px 0 8px; border-radius: 8px; background: var(--fc-c-scrim); color: #FFFFFF; }
.fcsdk-c-card-body { display: flex; flex-direction: column; gap: 16px; padding: 4px 24px 20px; }
.fcsdk-c-card-headline { color: var(--fc-c-fg-primary); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
.fcsdk-c-qbody { display: flex; flex-direction: column; padding: 26px 24px 20px; }
.fcsdk-c-qoptions { display: flex; flex-direction: column; gap: 6px; }
.fcsdk-c-qradio .fcsdk-c-radio:not(.fcsdk-c-radio--selected) { background: var(--fc-c-surface-primary); }
.fcsdk-c-qchecks { display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto; }
.fcsdk-c-qcheck { display: flex; align-items: center; margin: 0; padding: 12px 15px; border: none; border-radius: 12px; text-align: left;
  background: var(--fc-c-surface-primary); color: var(--fc-c-fg-primary); box-shadow: inset 0 0 0 0.25px var(--fc-c-border-default); }
.fcsdk-c-qcheck span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fcsdk-c-qcheck--on { background: var(--fc-c-surface-active); box-shadow: inset 0 0 0 0.25px var(--fc-c-border-active); }
.fcsdk-c-confirm { display: flex; align-items: center; justify-content: center; width: 100%; height: 48px; margin: 0; border: none;
  border-radius: 0; background: var(--fc-c-button-surface); color: var(--fc-c-button-fg); }
.fcsdk-c-qfeedback { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px 40px; }
.fcsdk-c-qfeedback-check { width: 40px; height: 40px; border-radius: 50%; background: #00C950; display: flex; align-items: center;
  justify-content: center; animation: fcsdk-c-pop 600ms cubic-bezier(.34, 1.56, .64, 1); }
.fcsdk-c-qfeedback-text { text-align: center; color: var(--fc-c-fg-primary); animation: fcsdk-c-fadein 400ms ease 150ms both; }
@keyframes fcsdk-c-pop { from { transform: scale(0.3); } to { transform: scale(1); } }
.fcsdk-c-ssfr { display: flex; flex-direction: column; gap: 4px; padding: 16px; }
.fcsdk-c-ssfr-btn { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; height: 44px; margin: 0; padding: 0 8px 0 10px;
  border: none; border-radius: 12px; background: var(--fc-c-button-surface); color: #FFFFFF; }
.fcsdk-c-ssfr-btn-label { flex: 1; min-width: 0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fcsdk-c-ellipsis { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fcsdk-c-clamp2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.fcsdk-c-feederror { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 0 16px; }
.fcsdk-c-feederror-icon { width: 64px; height: 64px; border-radius: 50%; background: #E5533D; display: flex; align-items: center; justify-content: center; }
.fcsdk-c-retry { display: inline-flex; align-items: center; gap: 8px; height: 48px; margin: 0; padding: 0 16px; border: none;
  border-radius: 12px; background: var(--fc-c-surface-tertiary); color: var(--fc-c-fg-primary); }
.fcsdk-c-feedfooter { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px 16px 40px; text-align: center;
  animation: fcsdk-c-fadein 900ms cubic-bezier(.4, 0, .2, 1); }
.fcsdk-c-feedfooter-wave { display: inline-block; font-size: 40px; line-height: 1.17; transform-origin: 50% 100%;
  animation: fcsdk-c-wave 1180ms cubic-bezier(.4, 0, .2, 1) 200ms 1 both; }
@keyframes fcsdk-c-wave { 0% { transform: rotate(0); } 13.6% { transform: rotate(16deg); } 28.8% { transform: rotate(-12deg); }
  42.4% { transform: rotate(16deg); } 57.6% { transform: rotate(-12deg); } 71.2% { transform: rotate(16deg); } 86.4% { transform: rotate(-12deg); } 100% { transform: rotate(0); } }
.fcsdk-c-feedfooter-text { white-space: pre-line; color: var(--fc-c-fg-primary); }
/* LogoSpinnerVertical: the mark spins every 3s (600ms EaseOut). */
.fcsdk-c-logospinner-logo > svg { display: block; }
.fcsdk-c-logospinner-logo--spin { animation: fcsdk-c-splash-spin 3600ms infinite; }
/* Sunbeams.kt */
.fcsdk-c-sunbeams { position: absolute; left: 0; top: 0; max-height: 100%; overflow: visible; }
.fcsdk-c-sunbeams-sway { transform-origin: 0 -40px; transform-box: view-box;
  animation: fcsdk-c-sway 16s cubic-bezier(.37, 0, .63, 1) infinite alternate; }
@keyframes fcsdk-c-sway { from { transform: rotate(-1.4deg); } to { transform: rotate(1.4deg); } }
/* group A: 0.55 + 0.45·sin(b), b over 8s; group B: 0.55 + 0.45·sin(2b + 2.4) */
.fcsdk-c-sunbeams-g0 { animation: fcsdk-c-beams 8s linear infinite; }
.fcsdk-c-sunbeams-g1 { animation: fcsdk-c-beams 4s linear -1.528s infinite; }
@keyframes fcsdk-c-beams {
  0% { opacity: 0.55; } 12.5% { opacity: 0.868; } 25% { opacity: 1; } 37.5% { opacity: 0.868; } 50% { opacity: 0.55; }
  62.5% { opacity: 0.232; } 75% { opacity: 0.1; } 87.5% { opacity: 0.232; } 100% { opacity: 0.55; } }
@media (prefers-reduced-motion: reduce) { .fcsdk-c-sunbeams-sway, .fcsdk-c-sunbeams-g0, .fcsdk-c-sunbeams-g1 { animation: none; } }
/* ---------------------------------------------------------------- ChatScreen.kt */
.fcsdk-c-chat { position: relative; background: var(--fc-c-reading-primary); }
.fcsdk-c-appbar-logo { flex: 1; display: flex; justify-content: center; transition: opacity 600ms cubic-bezier(0, 0, .58, 1); }
.fcsdk-c-chat-body { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
/* ChatThreadContent.kt: LazyColumn padding(horizontal = 20.dp), contentPadding top 20, spacedBy 16. */
.fcsdk-c-chat-scroll { position: relative; display: flex; flex-direction: column; gap: 16px; padding: 20px 20px 0; overflow-anchor: none; }
.fcsdk-c-chat-scroll > * { flex: 0 0 auto; }
.fcsdk-c-row-end { display: flex; justify-content: flex-end; }
.fcsdk-c-ai { display: flex; flex-direction: column; gap: 12px; color: var(--fc-c-fg-primary); }
/* ChatResponseActions.kt Column(padding top 24) — 12 here + the .fcsdk-c-ai gap of 12. Its
   AnimatedVisibility enter is fadeIn() only (no slide). */
.fcsdk-c-settle { display: flex; flex-direction: column; margin-top: 12px; animation: fcsdk-c-settle 350ms ease-out both; }
@keyframes fcsdk-c-settle { from { opacity: 0; } to { opacity: 1; } }
/* Read full advice: attentionWobble(delayMs = 1800) on a full-width button. */
.fcsdk-c-wobble--block { display: block; animation-delay: 1800ms; }
.fcsdk-c-fadein300 { animation: fcsdk-c-fadein 300ms ease both; }
/* InlineErrorContent.kt — Row(fillMaxWidth, padding start 4, CenterVertically). */
.fcsdk-c-inlineerror { display: flex; align-items: center; width: 100%; box-sizing: border-box; padding-left: 4px; }
.fcsdk-c-inlineerror-icon { flex: 0 0 48px; width: 48px; height: 48px; border-radius: 50%; display: flex;
  align-items: center; justify-content: center; background: var(--fc-c-feedback-fail); }
.fcsdk-c-inlineerror-text { flex: 1 1 auto; min-width: 0; margin: 0 8px 0 12px; color: var(--fc-c-fg-primary); }
.fcsdk-c-inlineerror-retry { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px; margin: 0;
  padding: 12px 10px; border: none; border-radius: 12px; background: var(--fc-c-surface-tertiary);
  color: var(--fc-c-fg-primary); cursor: pointer; }
/* ChatThreadContent.kt: the user item is a Column(spacedBy 12) — bubble row (start padding 64, End)
   then the inline error of a failed question. Bubbles fade in over 500ms. */
.fcsdk-c-usercol { display: flex; flex-direction: column; gap: 12px; animation: fcsdk-c-fadein 500ms ease both; }
.fcsdk-c-row-user { padding-left: 64px; }
.fcsdk-c-btn-secondary--reading { background: var(--fc-c-reading-secondary); }
/* UserChatBubble.kt */
.fcsdk-root[data-fc-theme] { --fc-bubble-user: var(--fc-c-reading-secondary); }
.fcsdk-c-user { display: flex; flex-direction: column; gap: 10px; max-width: 290px; padding: 16px; box-sizing: border-box;
  border-radius: var(--fc-radius-bubble) var(--fc-radius-bubble) 0 var(--fc-radius-bubble); background: var(--fc-bubble-user); }
.fcsdk-c-user-text { color: var(--fc-bubble-user-text, var(--fc-c-fg-primary)); white-space: pre-wrap; }
.fcsdk-c-user-banner { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 16px; }
.fcsdk-c-user-thumb { display: block; width: 80px; height: 80px; object-fit: cover; border-radius: 8px; }
.fcsdk-c-userimg { display: block; width: 220px; height: 160px; object-fit: cover; border-radius: 16px; }
/* ChatResponseActions */
.fcsdk-c-aiwarn { display: flex; align-items: center; gap: 6px; color: var(--fc-c-fg-secondary); }
.fcsdk-c-actions { display: flex; flex-wrap: wrap; align-items: center; }
.fcsdk-c-action { position: relative; display: inline-flex; height: 42px; margin: 0; padding: 0; border: none; border-radius: 999px;
  background: var(--fc-c-reading-secondary); color: var(--fc-c-fg-primary); }
.fcsdk-c-action-inner { display: inline-flex; align-items: center; gap: 10px; padding: 0 16px 0 12px; border-radius: 999px;
  background: var(--fc-c-reading-secondary); white-space: nowrap; }
.fcsdk-c-action--accent { padding: 3px; background: conic-gradient(from 0deg, var(--fc-accent-gradient-green) 0deg,
  var(--fc-accent-gradient-cyan) 90deg, var(--fc-accent-gradient-green) 180deg, var(--fc-accent-gradient-yellow) 270deg, var(--fc-accent-gradient-green) 360deg); }
.fcsdk-c-action--accent .fcsdk-c-action-inner { padding: 0 13px 0 9px; }
/* ListenButton.kt (light) */
.fcsdk-c-listen { display: inline-flex; align-items: center; justify-content: center; height: 42px; margin: 0; padding: 0 12px;
  border: none; border-radius: 999px; background: var(--fc-c-reading-secondary); color: var(--fc-c-fg-primary); max-width: 100%; }
.fcsdk-c-wave { display: inline-flex; align-items: center; justify-content: space-between; width: 54px; height: 26px; }
.fcsdk-c-wave span { width: 2px; border-radius: 8px; background: var(--fc-c-button-accent); transition: height 120ms cubic-bezier(.4, 0, .2, 1); }
/* FollowUpSection / SuggestedCard */
.fcsdk-c-followups { display: flex; flex-direction: column; gap: 10px; padding-top: 16px; }
.fcsdk-c-followups-title { color: var(--fc-c-fg-primary); }
.fcsdk-c-followups-list { display: flex; flex-direction: column; gap: 8px; }
.fcsdk-c-suggested { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; margin: 0; padding: 12px 10px 12px 16px;
  border: none; border-radius: 16px; background: var(--fc-c-surface-secondary); text-align: left;
  box-shadow: inset 0 0 0 1px rgba(0, 201, 80, 0.35); }
.fcsdk-c-suggested-text { flex: 1; min-width: 0; color: var(--fc-c-fg-primary); }
.fcsdk-c-suggested-arrow { flex: 0 0 30px; width: 30px; height: 30px; border-radius: 50%; background: rgba(0, 201, 80, 0.16);
  display: flex; align-items: center; justify-content: center; }
/* Chip.kt */
.fcsdk-c-chip { display: flex; align-items: center; gap: 8px; width: 100%; margin: 0; padding: 14px 10px 14px 14px; border: none;
  border-radius: 12px; text-align: left; background: var(--fc-c-reading-secondary); color: var(--fc-c-fg-primary); }
/* Chip.kt: labelMedium (600); Bold only when selected. */
.fcsdk-c-chip-label { flex: 1; min-width: 0; }
.fcsdk-c-chip--selected .fcsdk-c-chip-label { font-weight: 700; }
.fcsdk-c-chip-badge { flex: 0 0 24px; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: var(--fc-c-button-accent); color: #FFFFFF; }
.fcsdk-c-chip-chevron { color: var(--fc-c-fg-secondary); }
.fcsdk-c-chip--agentic { background: var(--fc-c-surface-active); }
.fcsdk-c-chip--agentic .fcsdk-c-chip-chevron { color: var(--fc-c-button-accent); }
.fcsdk-c-chip--escalate { background: var(--fc-c-feedback-fail); color: var(--fc-c-button-fg); }
/* Chip.kt escalate: white badge with a red number; selected = Red500_8 fill, red badge. */
.fcsdk-c-chip--escalate .fcsdk-c-chip-badge { background: #FFFFFF; color: #E5533D; }
.fcsdk-c-chip--escalate .fcsdk-c-chip-chevron { color: #FFFFFF; }
.fcsdk-c-chip--selected { background: var(--fc-c-surface-active); color: var(--fc-c-fg-primary); box-shadow: inset 0 0 0 1.5px var(--fc-c-button-accent); }
.fcsdk-c-chip--escalate.fcsdk-c-chip--selected { background: rgba(229, 83, 61, 0.08); box-shadow: inset 0 0 0 1.5px #E5533D; }
.fcsdk-c-chip--escalate.fcsdk-c-chip--selected .fcsdk-c-chip-badge { background: #E5533D; color: #FFFFFF; }
.fcsdk-c-chip--disabled { background: var(--fc-c-surface-tertiary); color: var(--fc-c-fg-secondary); box-shadow: inset 0 0 0 0.5px var(--fc-c-border-default); }
.fcsdk-c-chip--disabled .fcsdk-c-chip-badge { background: var(--fc-c-fg-secondary); color: var(--fc-c-surface-tertiary); }
.fcsdk-c-chip:disabled { cursor: default; }
/* AlignmentSurface.kt */
.fcsdk-c-align { display: flex; flex-direction: column; }
.fcsdk-c-align--escalate { padding: 16px; border-radius: 16px; background: rgba(229, 83, 61, 0.08); box-shadow: inset 0 0 0 1px rgba(229, 83, 61, 0.16); }
.fcsdk-c-align-chips { display: flex; flex-direction: column; gap: 8px; }
/* Capability prompts: header + chips in a 16-radius card, 1dp borderDefault, padding 16. */
.fcsdk-c-align-card { padding: 16px; border-radius: 16px; box-shadow: inset 0 0 0 1px var(--fc-c-border-default); }
.fcsdk-c-align-hatch { display: flex; align-items: center; gap: 6px; margin-top: 12px; }
.fcsdk-c-align-hatch-action { margin: 0; padding: 0; border: none; background: none; font-weight: 600; color: var(--fc-c-button-accent); }
/* StreamErrorCard.kt */
/* 16dp above the card: the .fcsdk-c-ai gap (12) + 4. */
.fcsdk-c-streamerror { display: flex; flex-direction: column; gap: 16px; margin-top: 4px; padding: 16px; border-radius: 12px;
  background: rgba(229, 83, 61, 0.08); box-shadow: inset 0 0 0 1px rgba(229, 83, 61, 0.16); }
.fcsdk-c-streamerror-head { display: flex; align-items: center; gap: 12px; color: var(--fc-c-fg-primary); }
.fcsdk-c-streamerror-retry { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin: 0;
  padding: 14px 0; border: none; border-radius: 12px; background: var(--fc-c-button-surface); color: var(--fc-c-button-fg); cursor: pointer; }
/* Tips.kt */
.fcsdk-c-tips { position: absolute; left: 0; right: 0; bottom: 0; z-index: 12; pointer-events: none; }
.fcsdk-c-tips-fade { height: 24px; background: linear-gradient(to bottom, rgba(255, 255, 255, 0), var(--fc-c-reading-primary)); }
.fcsdk-root[data-fc-theme="night"] .fcsdk-c-tips-fade { background: linear-gradient(to bottom, rgba(24, 24, 27, 0), var(--fc-c-reading-primary)); }
.fcsdk-c-tips-body { display: flex; flex-direction: column; align-items: center; padding-bottom: 44px;
  background: var(--fc-c-reading-primary); }
.fcsdk-c-tips-viewport { width: 100%; box-sizing: border-box; padding: 0 24px; overflow: hidden; }
.fcsdk-c-tips-track { display: flex; gap: 8px; align-items: flex-end; transition: transform 400ms cubic-bezier(.4, 0, .2, 1); }
.fcsdk-c-tip { flex: 0 0 100%; box-sizing: border-box; display: flex; align-items: flex-start; gap: 12px; min-height: 104px;
  padding: 16px 20px; border-radius: 16px; background: var(--fc-c-brand-surface-secondary); color: #FFFFFF; }
.fcsdk-c-tip-icon { flex: 0 0 36px; width: 36px; height: 36px; border-radius: 50%; background: var(--fc-c-feedback-success);
  display: flex; align-items: center; justify-content: center; }
.fcsdk-c-tip-icon--wobble { animation: fcsdk-c-tipwobble 700ms ease-in-out 400ms both; }
@keyframes fcsdk-c-tipwobble { 0% { transform: scale(1); } 20% { transform: scale(0.85); } 45% { transform: scale(1); }
  55% { transform: rotate(3deg); } 70% { transform: rotate(-3deg); } 78% { transform: rotate(0); } 86% { transform: rotate(3deg); } 94% { transform: rotate(-3deg); } 100% { transform: rotate(0); } }
.fcsdk-c-tip-text { flex: 1; min-width: 0; }
.fcsdk-c-tips-dots { display: flex; gap: 10px; margin-top: 14px; }
.fcsdk-c-tips-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--fc-c-surface-active); }
.fcsdk-c-tips-dot--active { width: 24px; overflow: hidden; }
.fcsdk-c-tips-dot--active span { display: block; height: 100%; width: 0; background: var(--fc-c-feedback-success);
  animation: fcsdk-c-tipprogress 8000ms linear forwards; }
@keyframes fcsdk-c-tipprogress { to { width: 100%; } }
/* ScrollIndicator (Feed.kt) */
.fcsdk-c-scrollind { position: absolute; left: 50%; bottom: 108px; z-index: 13; width: 40px; height: 40px; margin: 0 0 0 -20px;
  padding: 0; border: none; border-radius: 50%; background: var(--fc-c-button-accent); display: flex; align-items: center; justify-content: center;
  animation: fcsdk-c-fadein 200ms ease both, fcsdk-c-bounce 750ms ease-in-out 300ms 3; }
.fcsdk-c-scrollind--hiding { animation: fcsdk-c-fadeout 300ms ease forwards; }
@keyframes fcsdk-c-fadeout { from { opacity: 1; } to { opacity: 0; } }
@keyframes fcsdk-c-bounce { 0% { transform: translateY(0); } 37% { transform: translateY(var(--fc-c-bounce, 14px)); } 80% { transform: translateY(0); } 100% { transform: translateY(0); } }
/* ---------------------------------------------------------------- MarkdownText.kt */
.fcsdk-md { font: var(--fc-t-bodyMedium); color: inherit; }
.fcsdk-md strong { font-weight: 700; }
.fcsdk-md h1, .fcsdk-md h2, .fcsdk-md h3 { margin: 0; line-height: inherit; }
.fcsdk-md ul, .fcsdk-md ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.fcsdk-md li + li { margin-top: 0; }
.fcsdk-c-md-bullet { display: flex; align-items: flex-start; gap: 10px; }
.fcsdk-c-md-dot { flex: 0 0 5px; width: 5px; height: 5px; margin-top: 10px; border-radius: 50%; background: currentColor; }
.fcsdk-c-md-numbered { display: flex; align-items: flex-start; gap: 4px; }
.fcsdk-c-md-litext { flex: 1; min-width: 0; }
.fcsdk-md blockquote.fcsdk-c-md-quote { margin: 0; padding: 0; border: none; color: inherit; display: flex; flex-direction: column; gap: 5px; }
.fcsdk-c-md-quoteline { display: flex; align-items: stretch; gap: 12px; }
.fcsdk-c-md-quotebar { flex: 0 0 3px; width: 3px; border-radius: 999px; background: var(--fc-c-border-default); }
.fcsdk-md-divider { height: 3px; border-radius: 999px; background: var(--fc-c-border-default); }
/* Card table (3 cols, header[0] only) */
.fcsdk-md-answercard { display: flex; flex-direction: column; gap: 12px; padding: 14px 16px; border-radius: 16px; background: var(--fc-c-reading-secondary); }
.fcsdk-md-answercard-title { margin: 0; font: var(--fc-t-labelLarge); font-weight: 700; color: inherit; padding-bottom: 12px;
  border-bottom: 1px solid var(--fc-c-border-default); }
.fcsdk-md-answercard-reading { display: flex; flex-direction: column; gap: 2px; padding-bottom: 12px; border-bottom: 1px solid var(--fc-c-border-default); }
.fcsdk-md-answercard-reading:last-child { padding-bottom: 0; border-bottom: none; }
.fcsdk-md-answercard-label { margin: 0; font: var(--fc-t-bodySmall); color: var(--fc-c-fg-secondary); }
.fcsdk-md-answercard-value { margin: 0; font: var(--fc-t-bodyMedium); font-weight: 700; color: inherit; }
.fcsdk-md-answercard-meaning { margin: 2px 0 0; font: var(--fc-t-bodyMedium); color: var(--fc-c-fg-secondary); }
/* Row cards (>=2 cols) */
.fcsdk-md-rowcards { display: flex; flex-direction: column; gap: 12px; max-width: 100%; }
.fcsdk-md-rowcard { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 16px; background: var(--fc-c-reading-secondary); }
.fcsdk-md-rowcard-title { margin: 0; font: var(--fc-t-labelLarge); font-weight: 700; color: inherit; padding-bottom: 10px;
  border-bottom: 1px solid var(--fc-c-border-default); }
.fcsdk-md-rowcard-pair dt { font: var(--fc-t-bodySmall); color: var(--fc-c-fg-secondary); }
.fcsdk-md-rowcard-pair dd { font: var(--fc-t-bodySmall); font-weight: 700; color: inherit; }
/* 1-col bordered grid */
.fcsdk-md-table { border-radius: 8px; overflow: hidden; box-shadow: inset 0 0 0 1px var(--fc-c-border-default); }
.fcsdk-md-table th { font: var(--fc-t-labelSmall); font-weight: 700; background: var(--fc-c-surface-tertiary); padding: 10px 12px; }
.fcsdk-md-table td { font: var(--fc-t-bodySmall); padding: 10px 12px; }
.fcsdk-md-table tbody tr:nth-child(odd) { background: var(--fc-c-surface-secondary); }
.fcsdk-md-table tbody tr:nth-child(even) { background: var(--fc-c-reading-secondary); }
/* PrimaryInputButtons(ChatScreen) — legacy chat input row */
.fcsdk-chat-inputbar { flex: 0 0 auto; background: var(--fc-c-brand-surface-primary); border: none;
  box-shadow: inset 0 0.5px 0 rgba(0, 0, 0, 0.1); padding: 8px 16px var(--fc-inset-bottom); }
.fcsdk-chat-inputbar .fcsdk-c-tile { height: 72px; padding: 13px 8px 9px; }
/* ---------------------------------------------------------------- Drawer.kt */
.fcsdk-c-btn-primary--dark { background: var(--fc-c-brand-surface-primary); }
.fcsdk-c-drawer-host { position: absolute; inset: 0; z-index: 45; pointer-events: none; }
.fcsdk-c-drawer-host--open { pointer-events: auto; }
.fcsdk-c-drawer-scrim { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.32); opacity: 0; transition: opacity 150ms ease-out; }
.fcsdk-c-drawer-host--open .fcsdk-c-drawer-scrim { opacity: 1; transition: opacity 350ms cubic-bezier(.2, 0, 0, 1); }
.fcsdk-c-drawer { position: absolute; top: 0; bottom: 0; left: 0; width: 300px; max-width: 86%; display: flex; flex-direction: column;
  padding-bottom: var(--fc-inset-bottom);
  background: var(--fc-c-brand-surface-secondary); transform: translateX(-100%); transition: transform 150ms ease-out; }
.fcsdk-c-drawer-host--open .fcsdk-c-drawer { transform: none; transition: transform 350ms cubic-bezier(.2, 0, 0, 1); }
.fcsdk-c-drawer-wordmark { margin: calc(56px + var(--fc-inset-top)) 0 20px 24px; }
.fcsdk-c-drawer-nav { display: flex; flex-direction: column; padding: 0 12px; }
.fcsdk-c-drawer-btn { display: flex; align-items: center; gap: 12px; height: 52px; margin: 0; padding: 0 14px; border: none;
  border-radius: 12px; background: var(--fc-c-brand-surface-secondary); color: #FFFFFF; text-align: left; }
.fcsdk-c-drawer-btn--active { background: var(--fc-c-brand-surface-tertiary); }
.fcsdk-c-drawer-btn-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #FFFFFF; }
.fcsdk-c-drawer-rule { flex: 0 0 1px; height: 1px; margin-top: 8px; background: rgba(0, 130, 54, 0.2); }
.fcsdk-c-drawer-history { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.fcsdk-c-drawer-historyscroll { flex: 1; min-height: 0; overflow-y: auto; }
.fcsdk-c-drawer-recent { display: block; width: 100%; margin: 0; padding: 26px 22px 10px; border: none; background: none; text-align: left; color: #FFFFFF; }
.fcsdk-c-drawer-error { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 20px 16px; }
.fcsdk-c-drawer-seeall { position: absolute; left: 0; right: 0; bottom: 8px; }
.fcsdk-c-drawer-seeall-fade { height: 14px; background: linear-gradient(to bottom, transparent, var(--fc-c-brand-surface-secondary)); }
.fcsdk-c-drawer-signup { display: flex; flex-direction: column; align-items: center; gap: 16px; margin: 0 12px;
  padding: 18px 10px 10px; border-radius: 16px; background: var(--fc-c-brand-surface-tertiary); }
/* ---------------------------------------------------------------- AuthScreen.kt */
.fcsdk-c-auth { padding: 32px 20px calc(24px + var(--fc-inset-bottom)); }
.fcsdk-c-phonerow { display: flex; align-items: flex-start; gap: 8px; }
.fcsdk-c-countrysel { display: flex; align-items: center; justify-content: center; gap: 6px; flex: 0 0 auto; min-width: 90px; height: 56px;
  margin: 0; padding: 0 10px; border: none; border-radius: 12px; background: var(--fc-c-surface-secondary); color: var(--fc-c-fg-primary);
  box-shadow: inset 0 0 0 0.5px var(--fc-c-border-default); }
.fcsdk-c-agreement { padding: 12px 18px; border-radius: 16px; background: var(--fc-c-surface-tertiary); color: var(--fc-c-fg-primary); }
.fcsdk-c-agreement-title { font: 700 18px/27px var(--fc-font); }
.fcsdk-c-agreement-points { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; }
.fcsdk-c-agreement-point { display: flex; font: 400 15px/27px var(--fc-font); }
.fcsdk-c-agreement-bullet { flex: 0 0 16px; }
.fcsdk-c-agreement-info { margin-top: 8px; font: italic 700 14px/27px var(--fc-font); }
.fcsdk-c-consent { margin: 0; text-align: center; white-space: pre-line; font: 400 15px/1.171875 var(--fc-font); color: var(--fc-c-fg-secondary); }
.fcsdk-c-consent-link { text-decoration: underline; cursor: pointer; }
.fcsdk-c-otp { display: flex; gap: 8px; }
.fcsdk-c-otp input { flex: 1; min-width: 0; height: 64px; margin: 0; padding: 0; border: none; border-radius: 12px; outline: none;
  background: var(--fc-c-surface-secondary); color: var(--fc-c-fg-primary); caret-color: transparent; text-align: center;
  font: 400 28px/36px var(--fc-font); box-shadow: inset 0 0 0 0.5px var(--fc-c-border-default); }
.fcsdk-c-otp input:disabled { color: var(--fc-c-fg-secondary); }
.fcsdk-c-otp input.fcsdk-c-otp-active { box-shadow: inset 0 0 0 2px var(--fc-c-border-active); }
.fcsdk-c-otp--error input { box-shadow: inset 0 0 0 2px var(--fc-c-feedback-fail); }
.fcsdk-c-search { display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 16px; border-radius: 12px;
  background: var(--fc-c-surface-secondary); box-shadow: inset 0 0 0 1px var(--fc-c-border-default); }
.fcsdk-c-search:focus-within { box-shadow: inset 0 0 0 2px var(--fc-c-border-active); }
.fcsdk-c-search input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: var(--fc-c-fg-primary); padding: 0; }
.fcsdk-c-search input::placeholder { color: var(--fc-c-placeholder); }
.fcsdk-c-countryrow .fcsdk-c-radio { height: 48px; padding: 12px 16px; }
.fcsdk-c-countryrow .fcsdk-c-radio-label { margin-left: 14px; }
/* ---------------------------------------------------------------- FullScreenMessage.kt */
.fcsdk-c-fullmsg { position: relative; flex: 1; min-height: 0; height: 100%; display: flex; flex-direction: column;
  background: var(--fc-c-brand-surface-primary); color: #FFFFFF; }
.fcsdk-c-fullmsg-body { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 0 28px; }
.fcsdk-c-fullmsg-illustration { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 16px 0; }
.fcsdk-c-fullmsg-text { display: flex; flex-direction: column; gap: 10px; padding-bottom: 28px; text-align: center; }
.fcsdk-c-fullmsg-main, .fcsdk-c-fullmsg-sub { color: #FFFFFF; white-space: pre-line; }
.fcsdk-c-fullmsg-cta { padding: 0 20px calc(8px + var(--fc-inset-bottom)); }
.fcsdk-c-fullmsg-secondary { display: block; width: 100%; margin: 0; padding: 12px 0; border: none; background: none; color: #FFFFFF; text-align: center; }
/* FullScreenMessage forces the LIGHT palette on its CTA: #08361B even in night mode. */
.fcsdk-c-btn-primary--forcelight { background: #08361B; }
/* Farmer illustrations */
.fcsdk-c-farmer { display: block; }
.fcsdk-c-farmer--farmer { width: 100%; max-width: 322px; max-height: 100%; aspect-ratio: 300 / 450; object-fit: cover; border-radius: 9999px; }
.fcsdk-c-farmer--fit { width: 100%; height: 100%; object-fit: contain; }
.fcsdk-c-farmer--crop { width: 100%; height: 100%; object-fit: cover; }
.fcsdk-location-layer { position: absolute; inset: 0; z-index: 55; display: flex; flex-direction: column; padding: 0; background: none; }
/* M3 ModalBottomSheet (Recovery) */
.fcsdk-c-sheet-host { position: absolute; inset: 0; z-index: 65; display: flex; flex-direction: column; justify-content: flex-end; }
.fcsdk-c-sheet-scrim { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.32); animation: fcsdk-c-fadein 250ms ease both; }
.fcsdk-c-sheet { position: relative; width: 100%; max-width: 640px; margin: 0 auto; box-sizing: border-box; border-radius: 24px 24px 0 0;
  animation: fcsdk-c-sheetin 350ms cubic-bezier(.2, 0, 0, 1) both; }
@keyframes fcsdk-c-sheetin { from { transform: translateY(100%); } to { transform: none; } }
.fcsdk-c-recovery { display: flex; flex-direction: column; gap: 12px; padding: 16px 20px calc(16px + var(--fc-inset-bottom)); background: #ECECEE; }
.fcsdk-c-recovery-image { position: relative; height: 382px; max-height: 50vh; border-radius: 24px; overflow: hidden; background: #E4E4E7; }
.fcsdk-c-recovery-close { position: absolute; top: 12px; right: 12px; width: 44px; height: 44px; margin: 0; padding: 0; border: none;
  border-radius: 14px; background: #FFFFFF; display: flex; align-items: center; justify-content: center; }
/* ---------------------------------------------------------------- UserInput.kt sheets */
.fcsdk-c-inputsheet-host { position: absolute; inset: 0; z-index: 40; display: flex; flex-direction: column; justify-content: flex-end;
  background: rgba(0, 0, 0, 0.25); animation: fcsdk-c-fadein 300ms ease both; }
.fcsdk-c-inputsheet { box-sizing: border-box; width: 100%; border-radius: 16px 16px 0 0; background: var(--fc-c-surface-secondary);
  animation: fcsdk-c-sheetin 300ms ease-out both; }
.fcsdk-c-actioncircle { flex: 0 0 48px; width: 48px; height: 48px; margin: 0; padding: 0; border: none; border-radius: 50%;
  background: #08361B; display: flex; align-items: center; justify-content: center; }
.fcsdk-c-actioncircle:disabled { cursor: default; }
.fcsdk-c-textsheet-row { display: flex; align-items: flex-end; gap: 6px; }
.fcsdk-c-textsheet-field { flex: 1; min-width: 0; min-height: 48px; max-height: 105px; box-sizing: border-box; margin: 0; padding: 12px 14px;
  border: none; outline: none; resize: none; border-radius: 999px; background: var(--fc-c-surface-primary); color: var(--fc-c-fg-primary);
  caret-color: var(--fc-c-fg-primary); transition: border-radius 200ms ease; }
.fcsdk-c-textsheet-field--active, .fcsdk-c-textsheet-field:focus { border-radius: 16px; }
.fcsdk-c-textsheet-field::placeholder { color: var(--fc-c-placeholder); }
.fcsdk-c-voicesheet { display: flex; flex-direction: column; justify-content: center; min-height: 320px; }
.fcsdk-c-voicesheet-row { display: flex; align-items: center; gap: 12px; }
.fcsdk-c-livewave { flex: 1; min-width: 0; height: 36px; display: flex; align-items: center; justify-content: space-between; }
.fcsdk-c-livewave span { width: 3px; border-radius: 8px; background: var(--fc-c-button-accent); transition: height 120ms ease; }
.fcsdk-c-voicesheet-tip { display: flex; align-items: center; justify-content: center; gap: 8px; }
.fcsdk-c-photosheet-row { display: flex; gap: 12px; height: 168px; padding: 0 8px; }
.fcsdk-c-photosheet-tile { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; margin: 0;
  border: none; border-radius: 16px; background: var(--fc-c-surface-tertiary); }
/* VoiceClip */
.fcsdk-c-voiceclip { display: flex; align-items: center; gap: 8px; height: 50px; box-sizing: border-box; padding: 6px 16px 6px 8px;
  border-radius: 999px; background: var(--fc-c-surface-secondary); }
.fcsdk-c-voiceclip-btn { flex: 0 0 38px; width: 38px; height: 38px; margin: 0; padding: 0; border: none; border-radius: 50%; background: #08361B;
  display: flex; align-items: center; justify-content: center; }
.fcsdk-c-voiceclip-wave { flex: 1; min-width: 0; height: 38px; display: flex; align-items: center; justify-content: space-between; }
.fcsdk-c-voiceclip-wave span { width: 3px; border-radius: 8px; }
/* LocationChatBubble.kt */
.fcsdk-c-locbubble { width: 290px; max-width: 100%; height: 184px; display: flex; flex-direction: column; overflow: hidden;
  border-radius: 20px 20px 0 20px; background: var(--fc-c-reading-secondary); }
.fcsdk-c-locbubble-map { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(0, 201, 80, 0.16); }
.fcsdk-c-locbubble-footer { flex: 0 0 auto; display: flex; flex-direction: column; gap: 4px; padding: 12px 16px; }
/* Short viewports (landscape phone, on-screen keyboard, widget fullscreen sheet): the pinned
   welcome panel would take the whole height and hide every language. Scroll the screen as one page
   instead, so the list comes first and the panel follows it. */
@media (max-height: 520px) {
  .fcsdk-c-lang-screen { overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .fcsdk-c-lang-screen > .fcsdk-c-lang-scroll { flex: none; overflow: visible; }
  .fcsdk-c-lang-screen > .fcsdk-c-lang-panel { flex: none; }
  /* The drawer's rows + sign-up / recent-chats block exceed ~350 px: scroll the drawer as a whole. */
  .fcsdk-c-drawer { overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
  .fcsdk-c-drawer > * { flex-shrink: 0; }
  .fcsdk-c-drawer-historyscroll { flex: none; overflow: visible; }
}

/* Empty-chat placeholder (ChatEmptyState): centred in the space above the composer. */
.fcsdk-c-empty { position: absolute; left: 0; right: 0; top: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 0 32px; text-align: center; pointer-events: none; animation: fcsdk-empty-in 360ms ease-out both; }
.fcsdk-c-empty > * { pointer-events: auto; }
.fcsdk-c-empty-mark { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; margin-bottom: 6px; background: radial-gradient(circle at 30% 25%, #2BD46B, var(--fc-c-brand-surface-primary) 70%); box-shadow: 0 0 0 8px color-mix(in srgb, var(--fc-c-brand-surface-primary) 12%, transparent), 0 10px 24px -10px var(--fc-c-brand-surface-primary); }
.fcsdk-c-empty-title { margin: 0; max-width: 300px; font-size: 18px; line-height: 24px; font-weight: 600; color: var(--fc-c-fg-primary); text-wrap: balance; }
.fcsdk-c-empty-sub { margin: 0; max-width: 280px; font-size: 14px; line-height: 20px; color: var(--fc-c-fg-secondary); text-wrap: balance; }
.fcsdk-c-empty-ways { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 10px; }
.fcsdk-c-empty-way { display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 14px 0 8px; border-radius: 999px; border: 1px solid var(--fc-c-border-default); background: var(--fc-c-surface-primary); color: var(--fc-c-fg-primary); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
.fcsdk-c-empty-way:hover { border-color: var(--fc-c-brand-surface-primary); }
.fcsdk-c-empty-way:focus-visible { outline: 2px solid var(--fc-c-brand-surface-primary); outline-offset: 2px; }
.fcsdk-c-empty-way-ico { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--fc-c-brand-surface-primary) 12%, transparent); }
@keyframes fcsdk-empty-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .fcsdk-c-empty { animation: none; } }
/* @@END-OF-STYLESHEET@@ */
`;

/**
 * SectionHeader.kt LeafDivider tile: `fc_leaf` (11×11) beside its mirror image, so a repeating
 * 8×4 mask reproduces the alternating 4dp leaves Compose draws on a Canvas.
 */
function leafMaskRule(): string {
  const d = ICONS.leaf.paths.map((p) => p.d).join(' ');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 11"><path d="${d}"/>` +
    `<g transform="translate(22 0) scale(-1 1)"><path d="${d}"/></g></svg>`;
  return `.fcsdk-root{--fc-leaf-mask:url("data:image/svg+xml,${encodeURIComponent(svg)}");}\n`;
}

/** Injects the stylesheet once per document. */
export function ensureStylesInjected(doc: Document = document): void {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = robotoFontFaces() + leafMaskRule() + css;
  doc.head.appendChild(style);
}

/**
 * Script group for a language code — compose Type.kt `typographyForLanguage`. Drives
 * `data-fc-script` on the root, which swaps in that script's line heights.
 */
export function scriptForLanguage(code: string | undefined): string | undefined {
  switch ((code ?? '').toLowerCase().trim()) {
    case 'hi': case 'mr': case 'ne': case 'bho': case 'mai': case 'doi': case 'kok': case 'sa': case 'brx': case 'raj':
      return 'deva';
    case 'am': case 'ti': case 'om': case 'so': case 'aa':
      return 'ethi';
    case 'kn':
      return 'knda';
    case 'or': case 'od':
      return 'orya';
    case 'te':
      return 'telu';
    default:
      return undefined;
  }
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



/** Auto on-colour, HostTheme.kt `contrastOn`: white on a dark brand, black on a light one. */
function contrastOn(color: string): string | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  const lin = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return lum < 0.5 ? '#FFFFFF' : '#000000';
}

/** `Color.darken(f)` in HostTheme.kt multiplies each channel by f. */
function scaleRgb(color: string, factor: number): string | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  const d = rgb.map((c) => Math.round(c * factor));
  return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
}

/**
 * Port of HostTheme.kt resolveBrandColors + resolveContentColors onto the --fc-c-* roles.
 * `night` is the host's dark set (null in day mode); like `pick(light, night, dark)` the night
 * value wins in dark mode and the light value is used otherwise.
 */
function hostColorVars(
  light: FarmerChatThemeColors,
  night: FarmerChatThemeColors | null,
  dark: boolean,
): Record<string, string> {
  const vars: Record<string, string> = {};
  const pick = <K extends keyof FarmerChatThemeColors>(k: K): string | undefined =>
    (dark ? night?.[k] ?? light[k] : light[k]) as string | undefined;

  const primary = pick('brandPrimary');
  const primaryDark = pick('brandPrimaryDark');
  const accent = pick('brandAccent');
  const onBrand = pick('onBrand') ?? (primary ? contrastOn(primary) ?? undefined : undefined);
  const error = pick('error');

  // Brand
  if (primary) vars['--fc-c-brand-surface-primary'] = primary;
  if (primaryDark) {
    vars['--fc-c-brand-surface-secondary'] = primaryDark;
    const tertiary = scaleRgb(primaryDark, 0.6);
    if (tertiary) vars['--fc-c-brand-surface-tertiary'] = tertiary;
  }
  if (onBrand) {
    vars['--fc-c-brand-fg-primary'] = onBrand;
    vars['--fc-c-button-fg'] = onBrand;
  }
  if (accent) {
    vars['--fc-c-brand-fg-secondary'] = accent;
    vars['--fc-c-feedback-success'] = accent;
    vars['--fc-accent-gradient-green'] = accent;
    vars['--fc-c-button-accent'] = accent;
    vars['--fc-c-border-active'] = accent;
    const active = softTint(accent, 0.16);
    if (active) vars['--fc-c-surface-active'] = active;
  }
  if (error) vars['--fc-c-feedback-fail'] = error;

  // Button surface: light uses brandPrimaryDark (Green800), dark uses brandPrimary (Green700).
  const buttonSurface = dark ? primary : light.brandPrimaryDark;
  if (buttonSurface) vars['--fc-c-button-surface'] = buttonSurface;

  // Neutral surfaces
  const background = pick('background');
  const card = pick('cardSurface');
  const reading = pick('readingSurface');
  if (background) {
    vars['--fc-c-surface-primary'] = background;
    vars['--fc-c-reading-secondary'] = background;
  }
  if (card) vars['--fc-c-surface-secondary'] = card;
  if (reading) {
    vars['--fc-c-reading-primary'] = reading;
    vars['--fc-c-reading-tertiary'] = reading;
  }
  const fg = pick('onSurface') ?? pick('onBackground');
  if (fg) vars['--fc-c-fg-primary'] = fg;
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

  Object.assign(vars, hostColorVars(theme.colors ?? {}, theme.dark ?? null, mode === 'night'));

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
