/**
 * Reusable components — web ports of components/ (docs/01 §5): app bars,
 * buttons, spinner, toast, form inputs, radio/checkbox rows, list card/item,
 * FullScreenMessage (green full-screen layout).
 */

import { ReactNode, useEffect, useRef, useState } from 'react';
import { useSdk, type ToastKind } from '../context';
import { FcIcon } from './FcIcon';

// --- Icons (inline glyphs; no external assets allowed in the SDK bundle) ----

export const Icon = {
  menu: '☰',
  close: '✕',
  back: '←',
  chevronRight: '›',
  chevronDown: '⌄',
  mic: '🎙️',
  camera: '📷',
  keyboard: '⌨️',
  send: '➤',
  play: '▶',
  pause: '⏸',
  speaker: '🔊',
  share: '⤴️',
  download: '⬇️',
  retry: '↻',
  weatherDefault: '⛅',
  logo: '🌱',
  farmer: '🧑‍🌾',
  sky: '🌤️',
  phone: '📱',
  chat: '💬',
  card: '📄',
  check: '✓',
  location: '📍',
  // 2.0.0 agentic surfaces (stream error card / alignment escape hatch).
  warning: '⚠️',
  wifiOff: '📵',
  info: 'ℹ️',
} as const;

/**
 * Brand mark honoring a host `theme.logo` override (docs/07 Part B). A string is
 * treated as an image URL; any other node is rendered as-is; otherwise the
 * built-in glyph (or a caller fallback) is used.
 */
export function LogoGlyph(props: { fallback?: ReactNode; alt?: string; size?: number; tint?: string }) {
  const { logo } = useSdk();
  const size = props.size;
  if (typeof logo === 'string' && logo) {
    return (
      <img
        src={logo}
        alt={props.alt ?? 'logo'}
        style={{ width: size ?? '1em', height: size ?? '1em', objectFit: 'contain', display: 'block' }}
      />
    );
  }
  if (logo) return <>{logo}</>;
  if (props.fallback != null) return <>{props.fallback}</>;
  // The app's `fc_logo_mark`, a solid-black drawable that every call site tints.
  return <FcIcon name="logo_mark" size={size ?? 32} tint={props.tint ?? 'currentColor'} />;
}

/**
 * Material3 indeterminate `CircularProgressIndicator`: a rotating arc whose sweep grows
 * and shrinks. `size` and `stroke` are dp, as at the Compose call sites.
 */
export function CircularProgress(props: { size: number; stroke: number; color: string; className?: string }) {
  const r = (props.size - props.stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      className={`fcsdk-c-progress${props.className ? ' ' + props.className : ''}`}
      width={props.size}
      height={props.size}
      viewBox={`0 0 ${props.size} ${props.size}`}
      role="progressbar"
      aria-busy="true"
      style={{ ['--fc-c-circ' as string]: String(c) }}
    >
      <circle
        cx={props.size / 2}
        cy={props.size / 2}
        r={r}
        fill="none"
        stroke={props.color}
        strokeWidth={props.stroke}
        strokeLinecap="square"
      />
    </svg>
  );
}

// --- App bars -----------------------------------------------------------------

export function DefaultAppBar(props: {
  title: string;
  leadingIcon: 'menu' | 'back' | 'close';
  onLeadingClick: () => void;
  trailing?: ReactNode;
}) {
  const { services } = useSdk();
  const glyph = props.leadingIcon === 'menu' ? Icon.menu : props.leadingIcon === 'back' ? Icon.back : Icon.close;
  // C3: when the drawer is disabled there is nowhere for the hamburger to go.
  const hideLeading = props.leadingIcon === 'menu' && !services.config.showDrawer;
  return (
    <div className="fcsdk-appbar">
      {hideLeading ? (
        <span style={{ width: 10 }} />
      ) : (
        <button type="button" className="fcsdk-iconbtn" aria-label={props.leadingIcon} onClick={props.onLeadingClick}>
          {glyph}
        </button>
      )}
      <div className="fcsdk-appbar-title">{props.title}</div>
      {props.trailing}
    </div>
  );
}

// --- Buttons ---------------------------------------------------------------------

export type PrimaryButtonState = 'default' | 'chevron' | 'loading';

/**
 * Buttons.kt `PrimaryButton`: a full-width pill on `buttonPrimarySurface`, labelLarge text.
 * Disabled fades only the label and icon (to 0.5); the surface keeps its colour. The loading
 * spinner sits AFTER the label, and padding depends on the state (Default 24/16, else 16/8).
 */
export function PrimaryButton(props: {
  label: string;
  onClick: () => void;
  state?: PrimaryButtonState;
  disabled?: boolean;
  /** Compose `height` (dp); the onboarding screens pass 56, the default is 48. */
  height?: number;
  /** @deprecated kept for FullScreenMessage until that screen is ported. */
  light?: boolean;
  className?: string;
}) {
  const state = props.state ?? 'default';
  const enabled = !props.disabled;
  return (
    <button
      type="button"
      className={`fcsdk-c-btn-primary fcsdk-c-btn-primary--${state}${props.light ? ' fcsdk-c-btn-primary--light' : ''}${
        props.className ? ' ' + props.className : ''
      }`}
      style={{ height: props.height ?? 48 }}
      onClick={props.onClick}
      disabled={!enabled || state === 'loading'}
      data-enabled={enabled}
    >
      <span className="fcsdk-c-btn-label fc-t-labelLarge">{props.label}</span>
      {state === 'chevron' ? (
        <FcIcon name="m_chevron_right" size={24} tint="var(--fc-c-button-accent)" className="fcsdk-c-btn-icon" style={{ marginLeft: 8 }} />
      ) : null}
      {state === 'loading' ? (
        <CircularProgress size={20} stroke={2} color="var(--fc-c-button-accent)" className="fcsdk-c-btn-spinner" />
      ) : null}
    </button>
  );
}

/** Buttons.kt `SecondaryButton`: a borderless pill on `surfaceSecondary`, 48 tall. */
export function SecondaryButton(props: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="fcsdk-c-btn-secondary"
      onClick={props.onClick}
      disabled={props.disabled}
      data-enabled={!props.disabled}
    >
      <span className="fc-t-labelLarge">{props.label}</span>
    </button>
  );
}

export function TextButton(props: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="fcsdk-btn-text" onClick={props.onClick} disabled={props.disabled}>
      {props.label}
    </button>
  );
}

// --- Spinner / Toast ---------------------------------------------------------------

/**
 * LogoSpinner.kt (Vertical): a 55dp Green500 progress ring around a static 32dp mark, and a
 * labelMedium caption. With several `labels` the caption cycles every 3000ms, crossfading
 * over 400ms.
 */
export function LogoSpinner(props: { message?: string; labels?: string[] }) {
  const labels = props.labels ?? (props.message ? [props.message] : []);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (labels.length < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % labels.length), 3000);
    return () => window.clearInterval(t);
  }, [labels.length]);
  const text = labels.length ? labels[index % labels.length] : null;
  return (
    <div className="fcsdk-c-logospinner" role="status">
      <div className="fcsdk-c-logospinner-mark">
        <CircularProgress size={55} stroke={3} color="#00C950" />
        <FcIcon name="logo_mark" size={32} tint="#00C950" className="fcsdk-c-logospinner-logo" />
      </div>
      {text ? (
        <span key={index} className="fcsdk-c-logospinner-label fc-t-labelMedium">
          {text}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Toast.kt: a white card pinned 20dp from the sides and 24dp from the bottom, with a 32dp
 * status badge (success ✓ / error ✕ / loading spinner) and wrapping bodySmall text.
 */
export function Toast(props: { message: string | null; kind?: ToastKind }) {
  const { toast } = useSdk();
  const kind = props.kind ?? toast.kind;
  if (!props.message) return null;
  return (
    <div className="fcsdk-c-toast" role="status">
      <span className={`fcsdk-c-toast-badge fcsdk-c-toast-badge--${kind}`} aria-hidden>
        {kind === 'loading' ? (
          <CircularProgress size={18} stroke={2} color="#FFFFFF" />
        ) : (
          <FcIcon name={kind === 'error' ? 'm_close' : 'm_check'} size={18} tint="#FFFFFF" />
        )}
      </span>
      <span className="fcsdk-c-toast-text fc-t-bodySmall">{props.message}</span>
    </div>
  );
}

export function Skeleton(props: { width?: number | string; height?: number | string; style?: React.CSSProperties }) {
  return <div className="fcsdk-skeleton" style={{ width: props.width ?? '100%', height: props.height ?? 16, ...props.style }} />;
}

// --- Form ------------------------------------------------------------------------------

export function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel';
  maxLength?: number;
  onEnter?: () => void;
  ariaLabel?: string;
}) {
  return (
    <input
      className="fcsdk-input"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      autoFocus={props.autoFocus}
      type={props.type ?? 'text'}
      inputMode={props.inputMode}
      maxLength={props.maxLength}
      aria-label={props.ariaLabel ?? props.placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && props.onEnter) props.onEnter();
      }}
    />
  );
}

/**
 * Form.kt `RadioButton`: a white 12-radius card, padding 14/16, a 20dp indicator (a solid
 * grey disc, or a white disc with a 10dp green dot), a 12dp gap and a single-line bodyMedium
 * label. The selected tint is painted twice in Compose, so its effective alpha is about 0.296.
 */
export function RadioRow(props: {
  label: string;
  selected: boolean;
  onClick: () => void;
  loading?: boolean;
  trailing?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      className={`fcsdk-c-radio${props.selected ? ' fcsdk-c-radio--selected' : ''}`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      <span className="fcsdk-c-radio-indicator" aria-hidden>
        <span className="fcsdk-c-radio-dot" />
      </span>
      <span className="fcsdk-c-radio-label fc-t-bodyMedium" style={nativeScriptMetrics(props.label)}>
        {props.label}
      </span>
      {props.loading ? (
        <CircularProgress size={20} stroke={2} color="var(--fc-c-border-active)" className="fcsdk-c-radio-trailing" />
      ) : props.trailing ? (
        <span className="fcsdk-c-radio-trailing">{props.trailing}</span>
      ) : null}
    </button>
  );
}

/**
 * Natural line-box factor (line box / font size) of the Noto face Android draws a script with,
 * measured on the rs_qa emulator (API 36): a bodyMedium Kannada row label is 24.76dp tall,
 * Devanagari 22.48dp, against Roboto's 19.92dp. Feeds the line-height trim (`--fc-tn`), so a
 * native-script row is as tall as on Android even though Chrome draws it with another font.
 */
const SCRIPT_LINE_BOX: Array<[RegExp, number]> = [
  [/[\u0C80-\u0CFF]/, 1.456], // Kannada
  [/[\u0900-\u097F]/, 1.322], // Devanagari
];
function nativeScriptMetrics(text: string): React.CSSProperties | undefined {
  for (const [re, factor] of SCRIPT_LINE_BOX) {
    if (re.test(text)) return { ['--fc-tn' as string]: String(factor) } as React.CSSProperties;
  }
  return undefined;
}

export function CheckboxRow(props: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={props.checked} className="fcsdk-checkboxrow" onClick={props.onClick}>
      <span className="fcsdk-checkbox">{props.checked ? Icon.check : ''}</span>
      <span style={{ flex: 1 }}>{props.label}</span>
    </button>
  );
}

/** 4-digit OTP input with Web OTP API assist where available (docs/03 fidelity map). */
export function OtpInput(props: { value: string; onChange: (v: string) => void; length?: number }) {
  const length = props.length ?? 4;
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  // App parity (app `OtpInput.kt:46-52`): the OTP input auto-focuses on mount — it is the ONE
  // field the app focuses, which is why the phone field deliberately does not. Android's
  // `Form.kt:401` OtpInput already ports this (`autoFocus = true` + a LaunchedEffect); RN's
  // does too. Web was the only platform where no field took focus at all.
  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  // Web OTP API: autofill the code from an SMS when the browser supports it.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('credentials' in navigator)) return;
    const controller = new AbortController();
    type OtpCredential = Credential & { code?: string };
    const nav = navigator as Navigator & {
      credentials: CredentialsContainer & {
        get(options?: { otp?: { transport: string[] }; signal?: AbortSignal }): Promise<OtpCredential | null>;
      };
    };
    try {
      nav.credentials
        .get({ otp: { transport: ['sms'] }, signal: controller.signal })
        .then((cred) => {
          if (cred?.code) props.onChange(cred.code.replace(/[^\d]/g, '').slice(0, length));
        })
        .catch(() => {
          // Unsupported / dismissed — manual entry continues to work.
        });
    } catch {
      // Older browsers throw synchronously on unknown options.
    }
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const digits = Array.from({ length }, (_, i) => props.value[i] ?? '');

  const handleChange = (index: number, raw: string) => {
    const ch = raw.replace(/[^\d]/g, '');
    if (!ch) {
      props.onChange(props.value.slice(0, index));
      return;
    }
    const next = (props.value.slice(0, index) + ch).slice(0, length);
    props.onChange(next);
    const target = Math.min(next.length, length - 1);
    refs.current[target]?.focus();
  };

  return (
    <div className="fcsdk-otp">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`OTP digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i > 0) {
              refs.current[i - 1]?.focus();
              props.onChange(props.value.slice(0, i - 1));
            }
          }}
        />
      ))}
    </div>
  );
}

// --- Lists -----------------------------------------------------------------------------------

export function ListCard(props: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="fcsdk-listcard" style={props.style}>
      {props.children}
    </div>
  );
}

export function ListItem(props: { icon?: ReactNode; text: string; onClick?: () => void; trailing?: ReactNode }) {
  return (
    <button type="button" className="fcsdk-listitem" onClick={props.onClick}>
      {props.icon ? <span aria-hidden>{props.icon}</span> : null}
      <span className="fcsdk-li-text">{props.text}</span>
      {props.trailing ?? <span aria-hidden>{Icon.chevronRight}</span>}
    </button>
  );
}

// --- FullScreenMessage (docs/01 §3.14) ----------------------------------------------------------

export function FullScreenMessage(props: {
  title: string;
  subtitle?: string;
  /** Glyph illustration, or any node (e.g. an image) when {@link illustrationNode} is given. */
  illustration: string;
  illustrationNode?: ReactNode;
  /**
   * Larger message under the title (Compose `mainMessage`). When present, [title] renders as the
   * small app-bar title, as the app's FullScreenMessage does.
   */
  mainMessage?: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  primaryState?: PrimaryButtonState;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onClose?: () => void;
  /** Leading Back (←) action (Compose `leftIcon`). */
  onBack?: () => void;
  /** Trailing text action, e.g. "Skip" (Compose `rightLabel`). */
  rightLabel?: string;
  onRight?: () => void;
}) {
  const withHeaderTitle = props.mainMessage !== undefined;
  return (
    <div className="fcsdk-fullmsg">
      <div className="fcsdk-appbar" style={{ background: 'transparent' }}>
        {props.onBack ? (
          <button type="button" className="fcsdk-iconbtn" aria-label="back" onClick={props.onBack}>
            {Icon.back}
          </button>
        ) : props.onClose ? (
          <button type="button" className="fcsdk-iconbtn" aria-label="close" onClick={props.onClose}>
            {Icon.close}
          </button>
        ) : withHeaderTitle ? (
          <span className="fcsdk-fullmsg-barspacer" aria-hidden />
        ) : null}
        {withHeaderTitle ? <div className="fcsdk-fullmsg-bartitle">{props.title}</div> : null}
        {props.rightLabel && props.onRight ? (
          <button type="button" className="fcsdk-fullmsg-barright" onClick={props.onRight}>
            {props.rightLabel}
          </button>
        ) : withHeaderTitle ? (
          <span className="fcsdk-fullmsg-barspacer" aria-hidden />
        ) : null}
      </div>
      <div className="fcsdk-fullmsg-body">
        {props.illustrationNode !== undefined ? (
          <div className="fcsdk-fullmsg-illustration fcsdk-fullmsg-illustration--node" aria-hidden>
            {props.illustrationNode}
          </div>
        ) : (
          <div className="fcsdk-fullmsg-illustration" aria-hidden>
            {props.illustration}
          </div>
        )}
        <div className="fcsdk-fullmsg-title">{withHeaderTitle ? props.mainMessage : props.title}</div>
        {props.subtitle ? <div className="fcsdk-fullmsg-sub">{props.subtitle}</div> : null}
      </div>
      <div className="fcsdk-fullmsg-footer">
        <PrimaryButton
          label={props.primaryLabel}
          onClick={props.onPrimary}
          light
          disabled={props.primaryDisabled}
          state={props.primaryLoading ? 'loading' : (props.primaryState ?? 'default')}
        />
        {props.secondaryLabel && props.onSecondary ? <SecondaryButton label={props.secondaryLabel} onClick={props.onSecondary} /> : null}
      </div>
    </div>
  );
}
