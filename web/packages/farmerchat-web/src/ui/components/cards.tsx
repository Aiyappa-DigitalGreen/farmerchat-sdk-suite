/**
 * Home feed cards — ContentCard, SingleSelectCard, MultiSelectCard, SsfrCard
 * (docs/01 §3.7, §5), driven by SectionDto from endpoint #12.
 */

import { useEffect, useRef, useState } from 'react';
import type { SectionDto, SectionOption } from '../../core/types';
import { PrimaryButton, RadioRow, CheckboxRow, Icon } from './common';
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

export function ContentCard(props: { section: SectionDto; onTap: () => void; onVisible: () => void }) {
  const { section } = props;
  const ref = useHalfVisible(props.onVisible);
  const label = useLabel();
  return (
    <div className="fcsdk-card" ref={ref}>
      {section.image_url ? <img className="fcsdk-card-img" src={section.image_url} alt={section.title ?? ''} loading="lazy" /> : null}
      <div className="fcsdk-card-body">
        {section.badge?.show ? (
          <span className="fcsdk-badge">
            {section.badge.icon ?? '•'} {section.badge.count ?? ''}
          </span>
        ) : null}
        {section.title ? <div className="fcsdk-card-title">{section.title}</div> : null}
        {section.statement ? <div className="fcsdk-card-statement">{section.statement}</div> : null}
        {section.question_text ? <div className="fcsdk-card-statement">{section.question_text}</div> : null}
        <div className="fcsdk-card-cta" style={{ width: '100%' }}>
          <PrimaryButton label={section.cta?.text ?? label('card_cta_learn_more', 'Learn more')} onClick={props.onTap} state="chevron" />
        </div>
      </div>
    </div>
  );
}

export function SingleSelectCard(props: {
  section: SectionDto;
  onSubmit: (option: SectionOption) => void;
  isSubmitting: boolean;
}) {
  const { section } = props;
  const [selected, setSelected] = useState<SectionOption | null>(null);
  const label = useLabel();
  return (
    <div className="fcsdk-card">
      <div className="fcsdk-card-body">
        {section.title ? <div className="fcsdk-card-title">{section.title}</div> : null}
        {section.statement ? <div className="fcsdk-card-statement">{section.statement}</div> : null}
        <div className="fcsdk-options" role="radiogroup">
          {(section.options ?? []).map((opt, i) => (
            <RadioRow key={String(opt.id ?? i)} label={opt.text ?? ''} selected={selected?.id === opt.id} onClick={() => setSelected(opt)} />
          ))}
        </div>
        <PrimaryButton
          label={label('card_submit', 'Submit')}
          onClick={() => {
            if (selected) props.onSubmit(selected);
          }}
          disabled={!selected}
          state={props.isSubmitting ? 'loading' : 'default'}
        />
      </div>
    </div>
  );
}

export function MultiSelectCard(props: {
  section: SectionDto;
  onSubmit: (options: SectionOption[]) => void;
  isSubmitting: boolean;
}) {
  const { section } = props;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const label = useLabel();
  const toggle = (opt: SectionOption) => {
    const key = String(opt.id ?? opt.text ?? '');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  return (
    <div className="fcsdk-card">
      <div className="fcsdk-card-body">
        {section.title ? <div className="fcsdk-card-title">{section.title}</div> : null}
        {section.statement ? <div className="fcsdk-card-statement">{section.statement}</div> : null}
        <div className="fcsdk-options">
          {(section.options ?? []).map((opt, i) => {
            const key = String(opt.id ?? opt.text ?? i);
            return <CheckboxRow key={key} label={opt.text ?? ''} checked={selectedIds.has(key)} onClick={() => toggle(opt)} />;
          })}
        </div>
        <PrimaryButton
          label={label('card_submit', 'Submit')}
          onClick={() => {
            const chosen = (section.options ?? []).filter((opt) => selectedIds.has(String(opt.id ?? opt.text ?? '')));
            if (chosen.length > 0) props.onSubmit(chosen);
          }}
          disabled={selectedIds.size === 0}
          state={props.isSubmitting ? 'loading' : 'default'}
        />
      </div>
    </div>
  );
}

/** SSFR (wheat/maize) card shown when `ssfr_enable` (docs/01 §3.7). */
export function SsfrCard(props: { onCropClick: (crop: string) => void }) {
  const label = useLabel();
  return (
    <div className="fcsdk-ssfr">
      <div style={{ fontWeight: 800, fontSize: 16 }}>{label('ssfr_title', 'Get fertilizer advice for your crop')}</div>
      <div style={{ fontSize: 13.5, opacity: 0.92, marginTop: 4 }}>
        {label('ssfr_subtitle', 'Site-specific fertilizer recommendations')}
      </div>
      <div className="fcsdk-ssfr-row">
        <button type="button" className="fcsdk-ssfr-chip" onClick={() => props.onCropClick('wheat')}>
          🌾 {label('ssfr_wheat', 'Wheat')}
        </button>
        <button type="button" className="fcsdk-ssfr-chip" onClick={() => props.onCropClick('maize')}>
          🌽 {label('ssfr_maize', 'Maize')}
        </button>
      </div>
    </div>
  );
}

/** Feed error UI with retry (HomeFeedErrorUI). */
export function HomeFeedErrorUI(props: { message: string; onRetry: () => void }) {
  const label = useLabel();
  return (
    <div className="fcsdk-feed-error">
      <div style={{ fontSize: 40 }} aria-hidden>
        {Icon.sky}
      </div>
      <div>{props.message}</div>
      <div style={{ width: 200 }}>
        <PrimaryButton label={label('feed_try_again', 'Try again')} onClick={props.onRetry} />
      </div>
    </div>
  );
}
