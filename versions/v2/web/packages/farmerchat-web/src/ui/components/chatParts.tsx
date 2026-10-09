/**
 * Chat building blocks ported from the compose module: Chip.kt, ChatScreen.kt's SuggestedCard /
 * FollowUpSection / ChatResponseActions / ChatActionChip, ListenButton.kt, Tips.kt, the Feed.kt
 * ScrollIndicator and AppBars.kt LogoAppBar. Values are cited in the stylesheet (`.fcsdk-c-chat*`).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FcIcon, type IconName } from './FcIcon';
import { ActionButton, CircularProgress } from './common';
import { Assets } from '../assets';
import { useLabel, useSdk } from '../context';
import { answerGenerationTips, type TipData } from '../../core/tips';

// ------------------------------------------------------------------------------------- Chip.kt

export type ChipType = 'suggested' | 'agentic' | 'escalate';

/**
 * Chip.kt: a full-width 12-radius row — numbered 24dp badge, bold labelMedium label, 24dp chevron.
 * Suggested = reading-secondary; Agentic = surfaceActive; Escalate = solid red. Selected adds a
 * 1.5dp accent ring and a check badge; disabled greys out.
 */
export function Chip(props: {
  label: string;
  number?: number;
  type: ChipType;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const clickable = !!props.onClick && !props.disabled && !props.selected;
  const cls = [
    'fcsdk-c-chip',
    `fcsdk-c-chip--${props.type}`,
    props.selected ? 'fcsdk-c-chip--selected' : '',
    props.disabled && !props.selected ? 'fcsdk-c-chip--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} disabled={!clickable} onClick={clickable ? props.onClick : undefined}>
      {props.selected ? (
        <span className="fcsdk-c-chip-badge fcsdk-c-chip-badge--check">
          <FcIcon name="m_check" size={16} tint="#FFFFFF" />
        </span>
      ) : props.number != null ? (
        <span className="fcsdk-c-chip-badge fc-t-labelMedium">{props.number}</span>
      ) : null}
      <span className="fcsdk-c-chip-label fc-t-labelMedium">{props.label}</span>
      {clickable ? <FcIcon name="m_keyboard_arrow_right" size={24} className="fcsdk-c-chip-chevron" tint="currentColor" /> : null}
    </button>
  );
}

/** ChatScreen.kt SuggestedCard: a white 16-radius card with a 35% accent border and an arrow disc. */
export function SuggestedCard(props: { text: string; onClick: () => void }) {
  return (
    <button type="button" className="fcsdk-c-suggested fcsdk-c-press" onClick={props.onClick}>
      <span className="fc-t-bodyMedium fcsdk-c-suggested-text">{props.text}</span>
      <span className="fcsdk-c-suggested-arrow">
        <FcIcon name="m_arrow_forward" size={16} tint="var(--fc-c-brand-fg-secondary)" />
      </span>
    </button>
  );
}

/**
 * ChatResponseActions.kt follow-ups: 16dp, a titleMedium foregroundPrimary title, 10dp, then the
 * chips (or cards) 8dp apart.
 */
export function FollowUpSection(props: {
  title: string;
  questions: string[];
  useChips: boolean;
  clarificationRequired: boolean;
  onClick: (index: number, question: string) => void;
}) {
  return (
    <div className="fcsdk-c-followups">
      <div className="fc-t-titleMedium fcsdk-c-followups-title">{props.title}</div>
      <div className="fcsdk-c-followups-list">
      {props.questions.map((q, i) =>
        props.useChips ? (
          <Chip
            key={i}
            label={q}
            number={i + 1}
            type={props.clarificationRequired ? 'agentic' : 'suggested'}
            onClick={() => props.onClick(i, q)}
          />
        ) : (
          <SuggestedCard key={i} text={q} onClick={() => props.onClick(i, q)} />
        ),
      )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- action row

/** ChatActionChip: 42dp pill on reading-secondary, 23dp tinted icon + labelMedium; optional sweep. */
export function ChatActionChip(props: { icon: IconName; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button type="button" className={`fcsdk-c-action${props.accent ? ' fcsdk-c-action--accent' : ''}`} onClick={props.onClick}>
      <span className="fcsdk-c-action-inner">
        <FcIcon name={props.icon} size={23} tint="var(--fc-c-fg-primary)" />
        <span className="fc-t-labelMedium">{props.label}</span>
      </span>
    </button>
  );
}

const STATIC_WAVE = [0.15, 0.23, 0.31, 0.5, 0.31, 0.54, 0.73, 0.5, 0.73, 0.38, 0.5, 0.5, 0.31, 0.15];

/** ListenButton.kt SoundWave: 14 green 2dp bars over 54×26; random jitter while playing. */
function SoundWave(props: { playing: boolean }) {
  const [heights, setHeights] = useState(STATIC_WAVE);
  useEffect(() => {
    if (!props.playing) {
      setHeights(STATIC_WAVE);
      return;
    }
    let t: number;
    const tick = () => {
      setHeights((cur) =>
        cur.map((c, i) => Math.min(0.85, Math.max(0.15, STATIC_WAVE[i] * 0.5 + (c * 0.5 + Math.random() * 0.5) * 0.5))),
      );
      t = window.setTimeout(tick, 100 + Math.random() * 50);
    };
    tick();
    return () => window.clearTimeout(t);
  }, [props.playing]);
  return (
    <span className="fcsdk-c-wave" aria-hidden>
      {heights.map((h, i) => (
        <span key={i} style={{ height: `${h * 26}px`, transitionDuration: props.playing ? '120ms' : '200ms' }} />
      ))}
    </span>
  );
}

/**
 * ListenButton.kt (light): Default / Loading / Playing (animated wave) / Paused (static wave).
 * TTS off → still drawn, at alpha 0.4 and not clickable.
 */
export function ListenButton(props: { enabled?: boolean; loading: boolean; playing: boolean; hasAudio: boolean; onClick: () => void }) {
  const label = useLabel();
  const enabled = props.enabled ?? true;
  return (
    <button
      type="button"
      className="fcsdk-c-listen"
      onClick={enabled ? props.onClick : undefined}
      disabled={props.loading || !enabled}
      style={enabled ? undefined : { opacity: 0.4 }}
    >
      {props.loading ? (
        <>
          <CircularProgress size={20} stroke={2} color="var(--fc-c-fg-primary)" />
          <span className="fc-t-labelMedium fcsdk-c-ellipsis" style={{ marginLeft: 8 }}>
            {label('fc_v2_app_label_loading', 'Loading...')}
          </span>
        </>
      ) : props.playing ? (
        <>
          <FcIcon name="m_pause" size={23} tint="var(--fc-c-fg-primary)" />
          <span style={{ width: 6 }} />
          <SoundWave playing />
        </>
      ) : props.hasAudio ? (
        <>
          <FcIcon name="m_play_arrow" size={23} tint="var(--fc-c-fg-primary)" />
          <span style={{ width: 6 }} />
          <SoundWave playing={false} />
        </>
      ) : (
        <>
          <FcIcon name="m_volume_up" size={23} tint="var(--fc-c-fg-primary)" />
          <span className="fc-t-labelMedium" style={{ marginLeft: 6 }}>
            {label('fc_v2_app_label_listen', 'Listen')}
          </span>
        </>
      )}
    </button>
  );
}

/**
 * ChatResponseActions. Agentic: an "AI may be wrong" note, 12dp, then Share (accent sweep) +
 * Listen. Legacy: Share · Save · Listen, 10dp apart.
 */
export function ChatResponseActions(props: {
  agentic: boolean;
  showShare: boolean;
  tts: { enabled: boolean; loading: boolean; playing: boolean; hasAudio: boolean; onClick: () => void } | null;
  onShare: () => void;
  onSave: () => void;
}) {
  const label = useLabel();
  const listen = props.tts ? (
    <ListenButton
      enabled={props.tts.enabled}
      loading={props.tts.loading}
      playing={props.tts.playing}
      hasAudio={props.tts.hasAudio}
      onClick={props.tts.onClick}
    />
  ) : null;
  if (props.agentic) {
    return (
      <div>
        <div className="fcsdk-c-aiwarn">
          <FcIcon name="icon_info" size={18} tint="var(--fc-c-button-accent)" />
          <span className="fc-t-labelSmall">
            {label('fc_v2_app_label_tips_ai_may_be_wrong_please_double_check', 'AI may be wrong. Please double-check.')}
          </span>
        </div>
        <div className="fcsdk-c-actions" style={{ marginTop: 12, gap: 8 }}>
          {props.showShare ? (
            <ChatActionChip accent icon="icon_share" label={label('fc_v2_app_label_share_download', 'Share')} onClick={props.onShare} />
          ) : null}
          {listen}
        </div>
      </div>
    );
  }
  return (
    <div className="fcsdk-c-actions" style={{ gap: 10 }}>
      {props.showShare ? (
        <>
          <ChatActionChip icon="icon_share" label={label('fc_v2_app_label_share_download', 'Share')} onClick={props.onShare} />
          <ChatActionChip icon="icon_save" label={label('fc_v2_app_label_save', 'Save')} onClick={props.onSave} />
        </>
      ) : null}
      {listen}
    </div>
  );
}

// ---------------------------------------------------------------------------------- Tips.kt

/**
 * Tips.kt: bottom-anchored carousel shown while an answer is generated. 24dp fade, then 104dp
 * #08361B tip cards (side cards peek 24dp, 8dp apart), advancing every 8s with a 400ms slide and
 * an icon wobble; pagination dots with the active one filling over the 8s.
 */
export function Tips() {
  const { services } = useSdk();
  const tips = useMemo<TipData[]>(() => {
    const list = answerGenerationTips(services.labels);
    // Shuffled once per mount, as the app does.
    return list
      .map((t) => ({ t, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map((x) => x.t);
  }, [services.labels]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (tips.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => i + 1), 8000);
    return () => window.clearInterval(id);
  }, [tips.length]);
  const active = index % Math.max(1, tips.length);
  const trackRef = useRef<HTMLDivElement | null>(null);
  return (
    <div className="fcsdk-c-tips" aria-live="polite">
      <div className="fcsdk-c-tips-fade" />
      <div className="fcsdk-c-tips-body">
        <div className="fcsdk-c-tips-viewport">
          <div ref={trackRef} className="fcsdk-c-tips-track" style={{ transform: `translateX(calc(${-index} * (100% + 8px)))` }}>
            {Array.from({ length: index + 2 }, (_, i) => {
              const tip = tips[i % tips.length];
              return (
                <div key={i} className="fcsdk-c-tip">
                  <span key={i === index ? `w${index}` : undefined} className={`fcsdk-c-tip-icon${i === index ? ' fcsdk-c-tip-icon--wobble' : ''}`}>
                    <FcIcon name="m_lightbulb_outlined" size={18} tint="#FFFFFF" />
                  </span>
                  <div className="fcsdk-c-tip-text">
                    <div className="fc-t-labelLarge">{tip.title}</div>
                    <div className="fc-t-bodySmall" style={{ marginTop: 6 }}>
                      {tip.body}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {tips.length > 1 ? (
          <div className="fcsdk-c-tips-dots">
            {tips.map((_, i) =>
              i === active ? (
                <span key={`a${index}`} className="fcsdk-c-tips-dot fcsdk-c-tips-dot--active">
                  <span />
                </span>
              ) : (
                <span key={i} className="fcsdk-c-tips-dot" />
              ),
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- ScrollIndicator (Feed.kt)

/**
 * ScrollIndicator.kt: a 40dp accent circle with a white 20dp arrow, bottom-centre `bottom` px up.
 * 1500ms after the trigger it fades in (200ms); 300ms later it bounces 3× (280 down / 320 up /
 * 150 rest); 400ms after the last bounce it fades out (300ms). The bounce offset is
 * `IntOffset(0, 14)` — 14 device PIXELS, not dp — so it is divided by the device pixel ratio.
 */
export function ScrollIndicator(props: { triggerKey: string | null; bottom: number; hasContentBelow: () => boolean; onClick: () => void }) {
  const [phase, setPhase] = useState<'hidden' | 'shown' | 'hiding'>('hidden');
  useEffect(() => {
    setPhase('hidden');
    if (!props.triggerKey) return;
    const t1 = window.setTimeout(() => {
      if (props.hasContentBelow()) setPhase('shown');
    }, 1500);
    const hideAt = 1500 + 300 + 3 * 750 + 400;
    const t2 = window.setTimeout(() => setPhase((p) => (p === 'shown' ? 'hiding' : p)), hideAt);
    const t3 = window.setTimeout(() => setPhase('hidden'), hideAt + 300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.triggerKey]);
  if (phase === 'hidden') return null;
  const dpr = typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
  return (
    <button
      type="button"
      className={`fcsdk-c-scrollind${phase === 'hiding' ? ' fcsdk-c-scrollind--hiding' : ''}`}
      style={{ bottom: props.bottom, ['--fc-c-bounce' as string]: `${14 / dpr}px` }}
      aria-label="Scroll for more"
      onClick={() => {
        setPhase('hidden');
        props.onClick();
      }}
    >
      <FcIcon name="icon_arrow_down" size={20} tint="var(--fc-c-button-fg)" />
    </button>
  );
}

// --------------------------------------------------------------------- LogoAppBar (AppBars.kt)

/**
 * LogoAppBar: 64dp #008236 with the 80dp yellow glow; a 42dp ActionButton on the left, the 36dp
 * white mark centred (fading in once the thread settles), and on the right either a 42dp spacer
 * or — with the drawer off — History and Language buttons.
 */
export function LogoAppBar(props: {
  leading: { icon: IconName; radius: 'rounded' | 'md'; onClick: () => void; ariaLabel: string };
  showLogo: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div className="fcsdk-c-appbar">
      <img className="fcsdk-c-appbar-glow" src={Assets.glowYellow} alt="" aria-hidden />
      {props.leading.icon === 'm_arrow_back' && props.leading.radius === 'rounded' ? (
        // Home entry: R.drawable.leftbutton — a 42dp #08361B disc with a STROKED white arrow
        // (2dp, round caps), not the filled Material glyph the other entries use.
        <button type="button" className="fcsdk-c-appbar-leftbutton" aria-label={props.leading.ariaLabel} onClick={props.leading.onClick}>
          <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden>
            <circle cx="21" cy="21" r="21" fill="#08361B" />
            <path d="M27.708 21.261H14.292M21 27.97L14.292 21.261L21 14.553" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
      ) : (
        <ActionButton icon={props.leading.icon} radius={props.leading.radius} ariaLabel={props.leading.ariaLabel} onClick={props.leading.onClick} />
      )}
      {/* LogoAppBar.kt: fade in 600ms EaseOut, fade out 300ms EaseOut. */}
      <div
        className="fcsdk-c-appbar-logo"
        style={{ opacity: props.showLogo ? 1 : 0, transitionDuration: props.showLogo ? '600ms' : '300ms' }}
      >
        <FcIcon name="logo_mark" size={36} tint="#FFFFFF" />
      </div>
      {props.trailing ?? <span className="fcsdk-c-appbar-spacer" aria-hidden />}
    </div>
  );
}
