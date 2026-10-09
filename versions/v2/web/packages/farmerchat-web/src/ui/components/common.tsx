/**
 * Reusable components — web ports of components/ (docs/01 §5): app bars,
 * buttons, spinner, toast, form inputs, radio/checkbox rows, list card/item,
 * FullScreenMessage (green full-screen layout).
 */

import { ReactNode, useEffect, useRef, useState } from 'react';
import { useSdk, type ToastKind } from '../context';
import { FcIcon, type IconName } from './FcIcon';
import { Assets } from '../assets';

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
        strokeLinecap="round"
      />
    </svg>
  );
}

// --- App bars -----------------------------------------------------------------

/**
 * Buttons.kt `ActionButton`: 42dp tall, `brand.surfaceSecondary` (#08361B) fill, 23dp white icon,
 * labelMedium label. Icon-only it is a 42dp square whose `radius` makes it a circle (Rounded)
 * or a 12dp rounded square (MD, the Compose default).
 */
export function ActionButton(props: {
  icon?: IconName;
  label?: string;
  onClick: () => void;
  radius?: 'rounded' | 'md';
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const iconOnly = !props.label;
  const pad = iconOnly ? '0' : props.icon ? '0 16px 0 12px' : '0 16px';
  return (
    <button
      type="button"
      className="fcsdk-c-actionbtn"
      aria-label={props.ariaLabel ?? props.label}
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        width: iconOnly ? 42 : undefined,
        padding: pad,
        borderRadius: (props.radius ?? 'md') === 'rounded' ? 999 : 12,
      }}
    >
      {props.icon ? <FcIcon name={props.icon} size={23} tint="var(--fc-c-brand-fg-primary)" /> : null}
      {props.label ? (
        <span className="fc-t-labelMedium fcsdk-c-actionbtn-label" style={{ marginLeft: props.icon ? 10 : 0 }}>
          {props.label}
        </span>
      ) : null}
    </button>
  );
}

const LEADING_ICON: Record<'menu' | 'back' | 'close', IconName> = { menu: 'm_menu', back: 'm_arrow_back', close: 'm_close' };

/**
 * AppBars.kt `DefaultAppBar`: 64dp on `brand.surfacePrimary` (#008236 in both themes), 16dp side
 * padding, a 42dp ActionButton at each end (an empty 42dp box when absent, so the title stays
 * centred) and a centred titleMedium white title. `glow` lays `fc_glow_yellow` across the top
 * 80dp — only FullScreenMessage keeps it. With the drawer disabled the menu becomes a back arrow.
 */
export function DefaultAppBar(props: {
  title: string;
  leadingIcon: 'menu' | 'back' | 'close';
  onLeadingClick: () => void;
  /** Back action used when `leadingIcon` is 'menu' but the drawer is disabled (default: pop). */
  onBack?: () => void;
  leadingRadius?: 'rounded' | 'md';
  trailing?: ReactNode;
  glow?: boolean;
  background?: string;
  /** Replaces the leading ActionButton (FullScreenMessage passes its own or a spacer). */
  leading?: ReactNode;
}) {
  const { services, navigator } = useSdk();
  const drawerOff = props.leadingIcon === 'menu' && !services.config.showDrawer;
  const icon = drawerOff ? 'back' : props.leadingIcon;
  const onLeading = drawerOff ? props.onBack ?? (() => void navigator.pop()) : props.onLeadingClick;
  return (
    <div className="fcsdk-c-appbar" style={props.background ? { background: props.background } : undefined}>
      {props.glow ? <img className="fcsdk-c-appbar-glow" src={Assets.glowYellow} alt="" aria-hidden /> : null}
      {props.leading ?? (
        <ActionButton icon={LEADING_ICON[icon]} onClick={onLeading} radius={props.leadingRadius ?? 'rounded'} ariaLabel={icon} />
      )}
      <div className="fcsdk-c-appbar-title fc-t-titleMedium">{props.title}</div>
      {props.trailing ?? <span className="fcsdk-c-appbar-spacer" aria-hidden />}
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
  /** Compose `colors = Dark…`: the #008236 fill used on the dark-green drawer. */
  variant?: 'dark';
  /** Leading custom icon (24dp, accent): padding 8/16, 8dp before the label. */
  leadingIcon?: IconName;
  className?: string;
}) {
  const state = props.state ?? 'default';
  const enabled = !props.disabled;
  return (
    <button
      type="button"
      className={`fcsdk-c-btn-primary fcsdk-c-btn-primary--${state}${props.light ? ' fcsdk-c-btn-primary--light' : ''}${props.variant === 'dark' ? ' fcsdk-c-btn-primary--dark' : ''}${
        props.className ? ' ' + props.className : ''
      }`}
      style={{ height: props.height ?? 48, ...(props.leadingIcon ? { padding: '0 16px 0 8px' } : null) }}
      onClick={props.onClick}
      disabled={!enabled || state === 'loading'}
      data-enabled={enabled}
    >
      {props.leadingIcon ? (
        <FcIcon name={props.leadingIcon} size={24} tint="var(--fc-c-button-accent)" className="fcsdk-c-btn-icon" style={{ marginRight: 8 }} />
      ) : null}
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
export function LogoSpinner(props: {
  message?: string;
  labels?: string[];
  horizontal?: boolean;
  labelColor?: string;
  /** LogoSpinnerVertical: the mark spins 360° every 3s (600ms EaseOut). */
  rotating?: boolean;
  /** Label type style (default labelMedium; Home's feed spinner uses labelLarge). */
  labelStyle?: 'labelMedium' | 'labelLarge';
}) {
  const labels = props.labels ?? (props.message ? [props.message] : []);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (labels.length < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % labels.length), 3000);
    return () => window.clearInterval(t);
  }, [labels.length]);
  const text = labels.length ? labels[index % labels.length] : null;
  if (props.horizontal) {
    // LogoSpinner.kt Horizontal: 40dp ring (stroke 2.5) around a 23dp mark, shimmering label.
    return (
      <div className="fcsdk-c-logospinner fcsdk-c-logospinner--h" role="status">
        <div className="fcsdk-c-logospinner-mark" style={{ width: 40, height: 40 }}>
          <CircularProgress size={40} stroke={2.5} color="#00C950" />
          {/* LogoSpinnerHorizontal.kt: the mark turns 360° every 3s (600ms EaseOut). */}
          <span className="fcsdk-c-logospinner-logo fcsdk-c-logospinner-logo--spin" style={{ left: 8.5, top: 8.5 }}>
            <FcIcon name="logo_mark" size={23} tint="#00C950" />
          </span>
        </div>
        {text ? <span className="fcsdk-c-shimmer fc-t-labelMedium">{text}</span> : null}
      </div>
    );
  }
  return (
    <div className="fcsdk-c-logospinner" role="status">
      <div className="fcsdk-c-logospinner-mark">
        <CircularProgress size={55} stroke={3} color="#00C950" />
        <span className={`fcsdk-c-logospinner-logo${props.rotating ? ' fcsdk-c-logospinner-logo--spin' : ''}`}>
          <FcIcon name="logo_mark" size={32} tint="#00C950" />
        </span>
      </div>
      {text ? (
        <span key={index} className={`fcsdk-c-logospinner-label fc-t-${props.labelStyle ?? 'labelMedium'}`} style={props.labelColor ? { color: props.labelColor } : undefined}>
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

/**
 * Form.kt `TextInput` — an M3 OutlinedTextField: 56dp min height, 16dp content padding, radius
 * 12, `surfaceSecondary` container, a 1dp `borderDefault` outline that becomes 2dp
 * `borderActive` on focus, bodyLarge text, a `foregroundSecondary` placeholder and a green caret.
 */
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
  error?: boolean;
}) {
  return (
    <input
      className={`fcsdk-c-input${props.error ? ' fcsdk-c-input--error' : ''}`}
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
export function OtpInput(props: { value: string; onChange: (v: string) => void; length?: number; error?: boolean; disabled?: boolean }) {
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
    <div className={`fcsdk-c-otp${props.error ? ' fcsdk-c-otp--error' : ''}`}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          className={i === props.value.length && !props.error && !props.disabled ? 'fcsdk-c-otp-active' : undefined}
          disabled={props.disabled}
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

/** Lists.kt `ListCard`: radius 12, `surfaceSecondary`, padding 16 / 6 top / 4 bottom, no border. */
export function ListCard(props: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="fcsdk-c-listcard" style={props.style}>
      {props.children}
    </div>
  );
}

/**
 * Lists.kt `ListItem`: a 48dp row (or 12dp vertical padding, top-aligned, when the right text
 * may wrap) — optional 20dp icon tinted `foregroundPrimary`, bodyMedium left text at its natural
 * width, optional right text (muted, end-aligned, weighted), then a 24dp chevron 12dp after the
 * text, or a 16dp spinner. `divider` draws the 1dp `borderDefault` rule under the row.
 */
export function ListItem(props: {
  icon?: IconName;
  text: string;
  rightText?: string;
  rightMaxLines?: number;
  onClick?: () => void;
  /** Hide the chevron (non-tappable rows). */
  noChevron?: boolean;
  loading?: boolean;
  divider?: boolean;
}) {
  const multi = (props.rightMaxLines ?? 1) > 1;
  const body = (
    <>
      {props.icon ? <FcIcon name={props.icon} size={20} tint="var(--fc-c-fg-primary)" style={{ marginRight: 12 }} /> : null}
      <span className="fcsdk-c-li-text fc-t-bodyMedium">{props.text}</span>
      {props.rightText != null ? (
        <span
          className={`fcsdk-c-li-right fc-t-bodyMedium${multi ? ' fcsdk-c-li-right--multi' : ''}`}
          style={multi ? { WebkitLineClamp: props.rightMaxLines } : undefined}
        >
          {props.rightText}
        </span>
      ) : null}
      {props.loading ? (
        <CircularProgress size={16} stroke={2} color="var(--fc-c-fg-secondary)" className="fcsdk-c-li-trailing" />
      ) : props.noChevron ? null : (
        <FcIcon name="m_chevron_right_outlined" size={24} tint="var(--fc-c-fg-primary)" className="fcsdk-c-li-trailing" />
      )}
    </>
  );
  const cls = `fcsdk-c-li${multi ? ' fcsdk-c-li--multi' : ''}`;
  const row = props.onClick ? (
    <button type="button" className={cls} onClick={props.onClick}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
  // HorizontalDivider is a real 1dp element under the row, not an overlay.
  return props.divider ? (
    <>
      {row}
      <div className="fcsdk-c-divider" />
    </>
  ) : (
    row
  );
}

// --- FullScreenMessage (docs/01 §3.14) ----------------------------------------------------------

export type FarmerImage = 'camera' | 'sky' | 'phone' | 'phone_square';

/**
 * The country farmer illustration (`farmer_looking_at_*`) Android bundles as assets, served from
 * `config.assetBaseUrl` (the `illustrations/` folder shipped in dist). Country = the user's
 * country code when one of ke/et/ng/in, else ke — compose `rememberCountryFarmerPainter`.
 * Without an asset base URL nothing renders (the slot keeps its size).
 */
export function FarmerIllustration(props: {
  image: FarmerImage;
  /** farmer: max 322 wide, 300:450, stadium clip, crop · fit: contain the box · crop: cover the box */
  mode: 'farmer' | 'fit' | 'crop';
  className?: string;
}) {
  const { services } = useSdk();
  const base = services.config.assetBaseUrl;
  if (!base) return null;
  const cc = (services.store.getString('USER_COUNTRY_CODE') ?? '').toLowerCase();
  const country = ['ke', 'et', 'ng', 'in'].includes(cc) ? cc : 'ke';
  const src = `${base}${country}/farmer_looking_at_${props.image}.webp`;
  return <img className={`fcsdk-c-farmer fcsdk-c-farmer--${props.mode}${props.className ? ' ' + props.className : ''}`} src={src} alt="" />;
}

/**
 * FullScreenMessage.kt: a #008236 screen (both themes) — DefaultAppBar with the yellow glow and
 * optional 42dp actions (12dp radius unless given), the illustration filling the flexible box,
 * then a displaySmall white headline and a bodyMedium (or bodyLarge) subtitle 10 apart, and a 64dp
 * #08361B CTA. `debounce` switches the CTA to Loading for 1500ms after a tap.
 */
export function FullScreenMessage(props: {
  title: string;
  mainMessage?: string;
  subtitle?: string;
  subtitleLarge?: boolean;
  image?: FarmerImage;
  imageMode?: 'farmer' | 'fit' | 'crop';
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  primaryState?: PrimaryButtonState;
  /** Taps are ignored (busy) without dimming the button. */
  primaryInert?: boolean;
  debounce?: boolean;
  left?: { icon: IconName; onClick: () => void; radius?: 'rounded' | 'md'; ariaLabel: string };
  right?: { label: string; onClick: () => void; radius?: 'rounded' | 'md' };
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** @deprecated legacy glyph slot; ignored. */
  illustration?: string;
}) {
  const [debouncing, setDebouncing] = useState(false);
  const loading = props.primaryLoading || debouncing;
  return (
    <div className="fcsdk-c-fullmsg">
      <DefaultAppBar
        title={props.title}
        glow
        leadingIcon="back"
        onLeadingClick={() => undefined}
        background="transparent"
        trailing={
          props.right ? (
            <ActionButton label={props.right.label} radius={props.right.radius ?? 'md'} onClick={props.right.onClick} />
          ) : undefined
        }
        leading={
          props.left ? (
            <ActionButton icon={props.left.icon} radius={props.left.radius ?? 'md'} ariaLabel={props.left.ariaLabel} onClick={props.left.onClick} />
          ) : (
            <span className="fcsdk-c-appbar-spacer" aria-hidden />
          )
        }
      />
      <div className="fcsdk-c-fullmsg-body">
        <div className="fcsdk-c-fullmsg-illustration">
          {props.image ? <FarmerIllustration image={props.image} mode={props.imageMode ?? 'farmer'} /> : null}
        </div>
        <div className="fcsdk-c-fullmsg-text">
          {props.mainMessage ? <div className="fc-t-displaySmall fcsdk-c-fullmsg-main">{props.mainMessage}</div> : null}
          {props.subtitle ? (
            <div className={`${props.subtitleLarge ? 'fc-t-bodyLarge' : 'fc-t-bodyMedium'} fcsdk-c-fullmsg-sub`}>{props.subtitle}</div>
          ) : null}
        </div>
      </div>
      <div className="fcsdk-c-fullmsg-cta">
        <PrimaryButton
          height={64}
          className="fcsdk-c-btn-primary--forcelight"
          label={props.primaryLabel}
          state={loading ? 'loading' : (props.primaryState ?? 'default')}
          onClick={() => {
            if (props.primaryInert || debouncing) return;
            if (props.debounce) {
              setDebouncing(true);
              window.setTimeout(() => setDebouncing(false), 1500);
            }
            props.onPrimary();
          }}
        />
        {props.secondaryLabel && props.onSecondary ? (
          <button type="button" className="fc-t-bodyMedium fcsdk-c-fullmsg-secondary" onClick={props.onSecondary}>
            {props.secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
