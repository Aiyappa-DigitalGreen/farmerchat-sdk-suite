/**
 * Home feed cards — ContentCard, SingleSelectCard, MultiSelectCard, SsfrCard, HomeFeedErrorUI and
 * FeedFooter (docs/01 §3.7, §5), driven by SectionDto from endpoint #12. Ports of the compose
 * module's Cards.kt / Feed.kt; every number is cited in the stylesheet (`.fcsdk-c-card*`).
 */

import { useEffect, useRef, useState } from 'react';
import type { SectionDto, SectionOption } from '../../core/types';
import { CircularProgress, PrimaryButton, RadioRow } from './common';
import { FcIcon } from './FcIcon';
import { useLabel } from '../context';

/** Fires once when the card is ≥50% visible (MarkImageViewed trigger). */
export function useHalfVisible(onVisible: () => void): React.MutableRefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const firedRef = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio >= 0.5 && !firedRef.current) {
            firedRef.current = true;
            onVisible();
            observer.disconnect();
          }
        }
      },
      { threshold: [0.5] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);
  return ref;
}

/**
 * Cards.kt `ContentCard`: an elevated radius-24 card; an image card insets a 16:9, radius-16 frame
 * by 8dp holding a 220dp top-aligned crop (with the view-count badge over its top-end corner);
 * then ONE bodyLarge headline (`question_text ?: title`, 3 lines max) and a 42dp "Start chat" pill.
 */
export function ContentCard(props: {
  section: SectionDto;
  onTap: () => void;
  onVisible: () => void;
  loading?: boolean;
}) {
  const { section } = props;
  const ref = useHalfVisible(props.onVisible);
  const label = useLabel();
  const headline = section.question_text || section.title || '';
  const isImage = !!section.image_url;
  return (
    <div className="fcsdk-c-card fcsdk-c-press" ref={ref}>
      {isImage ? (
        <div className="fcsdk-c-card-imgwrap">
          <div className="fcsdk-c-card-imgframe">
            <img src={section.image_url ?? undefined} alt="" loading="lazy" />
            {section.badge?.show ? (
              <span className="fcsdk-c-card-badge">
                <FcIcon name="m_visibility" size={20} tint="#00C950" />
                <span className="fc-t-labelSmall">{section.badge.count ?? ''}</span>
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div style={{ height: 18 }} />
      )}
      <div className="fcsdk-c-card-body">
        <div className="fcsdk-c-card-headline fc-t-bodyLarge">{headline}</div>
        <PrimaryButton
          height={42}
          label={label('fc_v2_app_label_start_chat', 'Start chat')}
          onClick={props.onTap}
          state={props.loading ? 'loading' : 'chevron'}
        />
      </div>
    </div>
  );
}

type QuestionPhase = 'selecting' | 'saving' | 'feedback' | 'dismissed';

/**
 * The single/multi question card lifecycle (Cards.kt): Confirm → Saving (at least 1000ms) →
 * in-card thank-you for 3000ms → 400ms fade → removed.
 */
function useQuestionFlow(onDismissed: () => void) {
  const [phase, setPhase] = useState<QuestionPhase>('selecting');
  const run = async (submit: () => Promise<unknown>) => {
    setPhase('saving');
    await Promise.all([submit(), new Promise((r) => window.setTimeout(r, 1000))]);
    setPhase('feedback');
    window.setTimeout(() => {
      setPhase('dismissed');
      window.setTimeout(onDismissed, 400);
    }, 3000);
  };
  return { phase, run };
}

function QuestionFeedback() {
  const label = useLabel();
  return (
    <div className="fcsdk-c-qfeedback">
      <span className="fcsdk-c-qfeedback-check">
        <FcIcon name="m_check_rounded" size={24} tint="#FFFFFF" />
      </span>
      <div className="fcsdk-c-qfeedback-text fc-t-bodyLarge">
        {label(
          'fc_v2_app_label_thank_you_your_answer_helps_us_give_more_accurate_advice',
          'Thank you. Your answer helps us give more accurate advice.',
        )}
      </div>
    </div>
  );
}

function ConfirmBar(props: { saving: boolean; onClick: () => void }) {
  const label = useLabel();
  return (
    <button type="button" className="fcsdk-c-confirm" onClick={props.onClick} disabled={props.saving}>
      <span className="fc-t-labelLarge">
        {props.saving ? label('fc_v2_app_label_saving', 'Saving') : label('fc_v2_app_label_confirm', 'Confirm')}
      </span>
      {props.saving ? <CircularProgress size={20} stroke={2} color="#00C950" className="fcsdk-c-btn-spinner" /> : null}
    </button>
  );
}

/** Cards.kt `SingleSelectCard`: grey radio rows; tapping the selected row again clears it. */
export function SingleSelectCard(props: {
  section: SectionDto;
  onSubmit: (option: SectionOption) => Promise<unknown>;
  onDismissed: () => void;
}) {
  const { section } = props;
  const [selected, setSelected] = useState<SectionOption | null>(null);
  const flow = useQuestionFlow(props.onDismissed);
  return (
    <div className={`fcsdk-c-card${flow.phase === 'dismissed' ? ' fcsdk-c-card--leaving' : ''}`}>
      {flow.phase === 'feedback' || flow.phase === 'dismissed' ? (
        <QuestionFeedback />
      ) : (
        <>
          <div className="fcsdk-c-qbody" style={{ gap: 18 }}>
            <div className="fc-t-bodyLarge" style={{ color: 'var(--fc-c-fg-primary)' }}>
              {section.statement || section.title}
            </div>
            <div className="fcsdk-c-qoptions" role="radiogroup">
              {(section.options ?? []).map((opt, i) => (
                <div key={String(opt.id ?? i)} className="fcsdk-c-qradio">
                  <RadioRow
                    label={opt.text ?? ''}
                    selected={selected?.id === opt.id}
                    onClick={() => setSelected(selected?.id === opt.id ? null : opt)}
                  />
                </div>
              ))}
            </div>
          </div>
          {selected ? <ConfirmBar saving={flow.phase === 'saving'} onClick={() => void flow.run(() => props.onSubmit(selected))} /> : null}
        </>
      )}
    </div>
  );
}

const NONE_IDS = new Set(['profile_crop_all_none_of_the_above', 'none']);
function isNoneOption(opt: SectionOption): boolean {
  const id = String(opt.id ?? '').toLowerCase();
  const text = (opt.text ?? '').toLowerCase();
  return NONE_IDS.has(id) || id.includes('none_of_the_above') || text.includes('none of the above');
}

/**
 * Cards.kt `MultiSelectCard`: text-only checkbox chips (no square), a 240dp scrolling list, and an
 * exclusive "None of the above".
 */
export function MultiSelectCard(props: {
  section: SectionDto;
  onSubmit: (options: SectionOption[]) => Promise<unknown>;
  onDismissed: () => void;
}) {
  const { section } = props;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const flow = useQuestionFlow(props.onDismissed);
  const options = section.options ?? [];
  const keyOf = (opt: SectionOption, i: number) => String(opt.id ?? opt.text ?? i);
  const toggle = (opt: SectionOption, key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      if (isNoneOption(opt)) return new Set([key]);
      options.forEach((o, i) => {
        if (isNoneOption(o)) next.delete(keyOf(o, i));
      });
      next.add(key);
      return next;
    });
  };
  return (
    <div className={`fcsdk-c-card${flow.phase === 'dismissed' ? ' fcsdk-c-card--leaving' : ''}`}>
      {flow.phase === 'feedback' || flow.phase === 'dismissed' ? (
        <QuestionFeedback />
      ) : (
        <>
          <div className="fcsdk-c-qbody" style={{ gap: 20 }}>
            <div className="fc-t-bodyLarge" style={{ color: 'var(--fc-c-fg-primary)' }}>
              {section.statement || section.title}
            </div>
            <div className="fcsdk-c-qchecks">
              {options.map((opt, i) => {
                const key = keyOf(opt, i);
                const checked = selectedIds.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    className={`fcsdk-c-qcheck${checked ? ' fcsdk-c-qcheck--on' : ''}`}
                    onClick={() => toggle(opt, key)}
                  >
                    <span className="fc-t-bodySmall">{opt.text ?? ''}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {selectedIds.size > 0 ? (
            <ConfirmBar
              saving={flow.phase === 'saving'}
              onClick={() =>
                void flow.run(() => props.onSubmit(options.filter((o, i) => selectedIds.has(keyOf(o, i)))))
              }
            />
          ) : null}
        </>
      )}
    </div>
  );
}

/** Cards.kt `SsfrCard`: white elevated card, bold title, two 44dp crop buttons with chevrons. */
export function SsfrCard(props: { onCropClick: (crop: 'wheat' | 'maize') => void }) {
  const label = useLabel();
  const crop = (key: 'wheat' | 'maize', emoji: string, text: string) => (
    <button type="button" className="fcsdk-c-ssfr-btn fcsdk-c-press" onClick={() => props.onCropClick(key)}>
      <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden>
        {emoji}
      </span>
      <span className="fc-t-labelMedium fcsdk-c-ssfr-btn-label">{text}</span>
      <FcIcon name="m_chevron_right" size={20} tint="#00C950" />
    </button>
  );
  return (
    <div className="fcsdk-c-card fcsdk-c-ssfr">
      <div className="fc-t-bodyMedium fcsdk-c-ellipsis" style={{ fontWeight: 700, color: 'var(--fc-c-fg-primary)' }}>
        {label('fc_v2_app_label_ssfr_advisory', 'SSFR Advisory')}
      </div>
      <div className="fc-t-bodySmall fcsdk-c-clamp2" style={{ color: 'var(--fc-c-fg-primary)' }}>
        {label('fc_v2_app_label_ssfr_advisory_description', 'Access site specific fertilizer recommendations')}
      </div>
      <div style={{ height: 4 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        {crop('wheat', '🌾', label('fc_v2_app_label_ssfr_wheat', 'Wheat'))}
        {crop('maize', '🌽', label('fc_v2_app_label_ssfr_maize', 'Maize'))}
      </div>
    </div>
  );
}

/** Feed.kt `HomeFeedErrorUI`: red ✕ disc, "Can't load right now", grey Try-again pill. */
export function HomeFeedErrorUI(props: { onRetry: () => void }) {
  const label = useLabel();
  return (
    <div className="fcsdk-c-feederror">
      <span className="fcsdk-c-feederror-icon">
        <FcIcon name="m_close" size={32} tint="#FFFFFF" />
      </span>
      <div className="fc-t-bodyLarge" style={{ textAlign: 'center', color: 'var(--fc-c-fg-primary)' }}>
        {label('fc_v2_app_label_cant_load_right_now', "Can't load right now")}
      </div>
      <button type="button" className="fcsdk-c-retry" onClick={props.onRetry}>
        <FcIcon name="m_refresh" size={20} tint="var(--fc-c-fg-primary)" />
        <span className="fc-t-bodyMedium">{label('fc_v2_app_label_try_again', 'Try again')}</span>
      </button>
    </div>
  );
}

/** Feed.kt `FeedFooter`: a waving 👋🏾 and "Have a great day, come back tomorrow", fading in. */
export function FeedFooter() {
  const label = useLabel();
  return (
    <div className="fcsdk-c-feedfooter">
      <span className="fcsdk-c-feedfooter-wave" aria-hidden>
        {'\u{1F44B}\u{1F3FE}'}
      </span>
      <div className="fc-t-titleMedium fcsdk-c-feedfooter-text">
        {label('fc_v2_app_label_have_a_great_day_come_back_tomorrow', 'Have a great day,\ncome back tomorrow')}
      </div>
    </div>
  );
}
