/**
 * Reusable components — web ports of components/ (docs/01 §5): app bars,
 * buttons, spinner, toast, form inputs, radio/checkbox rows, list card/item,
 * FullScreenMessage (green full-screen layout).
 */

import { ReactNode, useEffect, useRef } from 'react';
import { useSdk } from '../context';

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
export function LogoGlyph(props: { fallback?: ReactNode; alt?: string }) {
  const { logo } = useSdk();
  if (typeof logo === 'string' && logo) {
    return <img src={logo} alt={props.alt ?? 'logo'} style={{ width: '1em', height: '1em', objectFit: 'contain', display: 'block' }} />;
  }
  if (logo) return <>{logo}</>;
  return <>{props.fallback ?? Icon.logo}</>;
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

export function PrimaryButton(props: {
  label: string;
  onClick: () => void;
  state?: PrimaryButtonState;
  disabled?: boolean;
  light?: boolean;
}) {
  const state = props.state ?? 'default';
  return (
    <button
      type="button"
      className={`fcsdk-btn-primary${props.light ? ' fcsdk-btn-primary--light' : ''}`}
      onClick={props.onClick}
      disabled={props.disabled || state === 'loading'}
    >
      {state === 'loading' ? <span className="fcsdk-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : null}
      <span>{props.label}</span>
      {state === 'chevron' ? <span>{Icon.chevronRight}</span> : null}
    </button>
  );
}

export function SecondaryButton(props: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="fcsdk-btn-secondary" onClick={props.onClick} disabled={props.disabled}>
      {props.label}
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

export function LogoSpinner(props: { message?: string }) {
  return (
    <div className="fcsdk-logospinner" role="status">
      <span className="fcsdk-spinner" />
      {props.message ? <span>{props.message}</span> : null}
    </div>
  );
}

export function Toast(props: { message: string | null }) {
  if (!props.message) return null;
  return (
    <div className="fcsdk-toast" role="status">
      {props.message}
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

export function RadioRow(props: {
  label: string;
  selected: boolean;
  onClick: () => void;
  loading?: boolean;
  trailing?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button type="button" role="radio" aria-checked={props.selected} className="fcsdk-radiorow" onClick={props.onClick} disabled={props.disabled}>
      <span className="fcsdk-radio-dot" />
      <span style={{ flex: 1 }}>{props.label}</span>
      {props.loading ? <span className="fcsdk-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : props.trailing}
    </button>
  );
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
  illustration: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="fcsdk-fullmsg">
      <div className="fcsdk-appbar" style={{ background: 'transparent' }}>
        {props.onClose ? (
          <button type="button" className="fcsdk-iconbtn" aria-label="close" onClick={props.onClose}>
            {Icon.close}
          </button>
        ) : null}
      </div>
      <div className="fcsdk-fullmsg-body">
        <div className="fcsdk-fullmsg-illustration" aria-hidden>
          {props.illustration}
        </div>
        <div className="fcsdk-fullmsg-title">{props.title}</div>
        {props.subtitle ? <div className="fcsdk-fullmsg-sub">{props.subtitle}</div> : null}
      </div>
      <div className="fcsdk-fullmsg-footer">
        <PrimaryButton label={props.primaryLabel} onClick={props.onPrimary} light state={props.primaryLoading ? 'loading' : 'default'} />
        {props.secondaryLabel && props.onSecondary ? <SecondaryButton label={props.secondaryLabel} onClick={props.onSecondary} /> : null}
      </div>
    </div>
  );
}
