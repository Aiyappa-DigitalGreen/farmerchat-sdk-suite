/**
 * Agentic chat UI (**SDK 2.0.0**) — ports of the Android Compose components
 * `AlignmentSurface.kt`, `StreamErrorCard.kt` and the streaming/stall indicators inlined in
 * `ChatScreen.kt`.
 *
 * Only rendered for messages produced by the #27a stream (`enableAgenticChat`), so a 1.0.0 host
 * never sees any of it.
 *
 * NOTE on strings: every visible string goes through the label manager with an English fallback.
 * This package's label keys are a KNOWN pre-existing mismatch with the server's keys (they are not
 * the app's `fc_v2_app_label_*` names), so in practice the English fallbacks are what render —
 * localization of the SDK web UI is unverified, and these new keys inherit that.
 */

import { useEffect, useState } from 'react';
import { useLabel } from '../context';
import { Icon } from './common';
import type { AlignmentChip } from '../../core/types';
import type { AlignmentKind } from '../../core/alignment';
import { isAdditiveAlignment } from '../../core/alignment';
import type { StreamErrorKind } from '../../core/agentic';

/**
 * How long a streamed answer may stall, with no tool status, before the UI shows a transient
 * "Paused, resuming…" hint. Client-side only — not a failure, and it clears on the next delta.
 * Parity with Android's `PAUSE_HINT_DELAY_MS`.
 */
const PAUSE_HINT_DELAY_MS = 4000;

/** Inline spinner + label, the web equivalent of Compose's horizontal `LogoSpinner`. */
function InlineProgress(props: { label: string }) {
  return (
    <div className="fcsdk-stream-progress" role="status" aria-live="polite">
      <span className="fcsdk-spinner fcsdk-stream-progress-spinner" aria-hidden />
      <span className="fcsdk-stream-progress-label">{props.label}</span>
    </div>
  );
}

/**
 * Live stream feedback below a streaming answer:
 * - tool progress (or "Getting your answer…" before any text has arrived);
 * - a 4 s stall hint once text is flowing but nothing has arrived recently. Keyed on the text
 *   length, so the next delta clears it automatically.
 */
export function StreamProgress(props: { text: string; status?: string | null }) {
  const label = useLabel();
  const { text, status } = props;
  const hasStatus = (status ?? '').trim().length > 0;
  const showToolProgress = text.length === 0 || hasStatus;

  const [stalled, setStalled] = useState(false);
  const showStallCandidate = text.length > 0 && !hasStatus;
  useEffect(() => {
    if (!showStallCandidate) {
      setStalled(false);
      return;
    }
    setStalled(false);
    const id = window.setTimeout(() => setStalled(true), PAUSE_HINT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [showStallCandidate, text.length]);

  if (showToolProgress) {
    return <InlineProgress label={(status ?? '').trim() || label('fc_v2_app_label_getting_your_answer', 'Getting your answer…')} />;
  }
  if (showStallCandidate && stalled) {
    return <InlineProgress label={label('fc_v2_app_label_response_paused_resuming', 'Paused, resuming…')} />;
  }
  return null;
}

/**
 * Inline card shown when an agentic stream ends without a complete answer. Renders below the AI
 * response — below the preserved partial text, if any — with a state-specific message and a
 * full-width "Try again" action.
 *
 * The copy is driven by BOTH `errorKind` and `hasPartial`, because "we lost the connection but
 * kept what you have" and "nothing arrived" are very different messages to a farmer:
 * - hasPartial → "Connection stopped. Your partial answer is saved."
 * - NETWORK    → "No internet connection"
 * - otherwise  → "Something went wrong"
 */
export function StreamErrorCard(props: {
  errorKind: StreamErrorKind;
  hasPartial: boolean;
  onRetry: () => void;
}) {
  const label = useLabel();
  const title = props.hasPartial
    ? label('fc_v2_app_label_connection_stopped_partial_saved', 'Connection stopped. Your partial answer is saved.')
    : props.errorKind === 'NETWORK'
      ? label('fc_v2_app_label_no_internet_connection', 'No internet connection')
      : label('fc_v2_app_label_something_went_wrong', 'Something went wrong');

  return (
    <div className="fcsdk-stream-error" role="alert">
      <div className="fcsdk-stream-error-head">
        <span className="fcsdk-stream-error-icon" aria-hidden>
          {props.errorKind === 'NETWORK' ? Icon.wifiOff : Icon.warning}
        </span>
        <span>{title}</span>
      </div>
      <button type="button" className="fcsdk-btn-primary fcsdk-stream-error-retry" onClick={props.onRetry}>
        {label('fc_v2_app_label_try_again', 'Try again')}
      </button>
    </div>
  );
}

/**
 * A server-driven alignment surface: a short prompt the farmer answers by tapping a chip, instead
 * of reading a normal answer.
 *
 * Two shapes, decided by `isAdditiveAlignment(kind)`:
 * - **Exclusive** (clarify / confirm / escalate / capability prompts) — owns the message area and
 *   replaces the answer, so it renders its own heading and, where appropriate, an escape hatch.
 * - **Additive** (gender-select / commodity-confirm) — a nudge BELOW a real answer, so it renders
 *   no heading and no escape hatch; the answer above already owns the action row.
 *
 * Escalate gets an urgent tint derived from the theme's danger color, keeping the card coherent
 * rather than dropping the brand accent into a red surface.
 */
export function AlignmentSurface(props: {
  kind: AlignmentKind;
  message: string;
  chips: AlignmentChip[];
  selectedValues: string[];
  isLoading: boolean;
  isLatest: boolean;
  onChipClick: (chip: AlignmentChip) => void;
  onTypeInstead?: () => void;
  /** True when rendering below a real answer; suppresses the heading and escape hatch. */
  additive?: boolean;
}) {
  const label = useLabel();
  const { kind, chips, selectedValues, isLoading, isLatest } = props;
  const additive = props.additive ?? isAdditiveAlignment(kind);
  const isEscalate = kind === 'ESCALATE';
  const isCapabilityPrompt = kind === 'GPS_PROMPT' || kind === 'UPLOAD_PHOTO';
  const hasPick = selectedValues.length > 0;
  // Capability and additive surfaces are single-shot: one tap settles them, so every chip locks.
  // Clarify/confirm stay open so the farmer can pick a different option.
  const chipsLocked = (isCapabilityPrompt || additive) && hasPick;

  const heading =
    kind === 'GPS_PROMPT'
      ? label('fc_v2_app_label_share_location', 'Share location')
      : kind === 'UPLOAD_PHOTO'
        ? label('fc_v2_app_label_add_one_clear_photo', 'Add one clear photo')
        : kind === 'CONFIRM'
          ? label('fc_v2_app_label_please_confirm', 'Please Confirm')
          : label('fc_v2_app_label_choose_one', 'Choose one');

  return (
    <div className={`fcsdk-alignment${isEscalate ? ' fcsdk-alignment--escalate' : ''}`}>
      {props.message.trim().length > 0 ? <div className="fcsdk-alignment-message">{props.message}</div> : null}
      {!isEscalate && !additive ? <div className="fcsdk-alignment-heading">{heading}</div> : null}

      {chips.length > 0 ? (
        <div className="fcsdk-alignment-chips">
          {chips.map((chip, index) => {
            const isSelected =
              (!!chip.value && selectedValues.includes(chip.value)) ||
              (!!chip.label && selectedValues.includes(chip.label));
            const tappable = !isSelected && !isLoading && !chipsLocked;
            // Once a pick exists the unpicked chips fade back, so the chosen one reads as the
            // answer rather than one of several live options.
            const accented = !hasPick || isSelected;
            return (
              <button
                key={`${chip.value ?? chip.label ?? 'chip'}_${index}`}
                type="button"
                className={
                  'fcsdk-alignment-chip' +
                  (accented ? ' fcsdk-alignment-chip--accent' : '') +
                  (isEscalate && accented ? ' fcsdk-alignment-chip--escalate' : '') +
                  (isSelected ? ' fcsdk-alignment-chip--selected' : '')
                }
                disabled={!tappable}
                onClick={() => props.onChipClick(chip)}
              >
                <span className="fcsdk-alignment-chip-index" aria-hidden>
                  {index + 1}
                </span>
                <span>{chip.label ?? ''}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Escape hatch: only on an open, exclusive, non-urgent surface that is still the latest.
          Without it a farmer whose answer is not among the chips has no way forward. */}
      {chips.length > 0 && !isEscalate && !isCapabilityPrompt && !additive && !hasPick && isLatest && !isLoading ? (
        <div className="fcsdk-alignment-hatch">
          <span aria-hidden>{Icon.info}</span>
          <span>{label('chat_align_no_option', "Don't see your option?")}</span>
          <button type="button" className="fcsdk-alignment-hatch-action" onClick={props.onTypeInstead}>
            {label('fc_v2_app_label_type_or_say_it', 'Type or say it.')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
