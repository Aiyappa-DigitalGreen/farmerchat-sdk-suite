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
import { LogoSpinner, PrimaryButton } from './common';
import { FcIcon } from './FcIcon';
import { Chip } from './chatParts';
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
  // LogoSpinner.kt Horizontal: 40dp ring + 23dp mark, shimmering labelMedium label.
  return (
    <div role="status" aria-live="polite">
      <LogoSpinner horizontal message={props.label} />
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

  // StreamErrorCard.kt: 16dp above, a 12-radius red-tinted card (8% fill, 16% border), icon + title,
  // then a full-width "Try again" PrimaryButton.
  return (
    <div className="fcsdk-c-streamerror" role="alert">
      <div className="fcsdk-c-streamerror-head">
        <FcIcon name={props.errorKind === 'NETWORK' ? 'm_wifi_off' : 'm_warning'} size={20} tint="#E5533D" />
        <span className="fc-t-bodyMedium">{title}</span>
      </div>
      <PrimaryButton label={label('fc_v2_app_label_try_again', 'Try again')} onClick={props.onRetry} />
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
      ? label('fc_v2_app_label_share_location_title', 'Share location')
      : kind === 'UPLOAD_PHOTO'
        ? label('fc_v2_app_label_add_one_clear_photo', 'Add one clear photo')
        : kind === 'CONFIRM'
          ? label('fc_v2_app_label_please_confirm', 'Please confirm')
          : label('fc_v2_app_label_choose_one', 'Choose one');
  const hasMessage = props.message.trim().length > 0;
  const showHeading = !isEscalate && !additive;

  // AlignmentSurface.kt: bodyLarge message, titleMedium heading, full-width numbered Chips 8 apart,
  // and the "Don't see your option? Type or say it." escape hatch. Only escalate gets a card.
  return (
    <div className={`fcsdk-c-align${isEscalate ? ' fcsdk-c-align--escalate' : ''}`}>
      {hasMessage ? (
        <div className="fc-t-bodyLarge" style={{ color: 'var(--fc-c-fg-primary)', marginBottom: isEscalate || additive ? 12 : 16 }}>
          {props.message}
        </div>
      ) : null}
      {showHeading ? (
        <div className="fc-t-titleMedium" style={{ color: 'var(--fc-c-fg-primary)', marginBottom: 16 }}>
          {heading}
        </div>
      ) : null}
      {chips.length > 0 ? (
        <div className="fcsdk-c-align-chips">
          {chips.map((chip, index) => {
            const isSelected =
              (!!chip.value && selectedValues.includes(chip.value)) || (!!chip.label && selectedValues.includes(chip.label));
            const tappable = !isSelected && !isLoading && !chipsLocked;
            const accented = !hasPick || isSelected;
            const type = isEscalate ? (accented ? 'escalate' : 'suggested') : accented ? 'agentic' : 'suggested';
            return (
              <Chip
                key={`${chip.value ?? chip.label ?? 'chip'}_${index}`}
                label={chip.label ?? ''}
                number={index + 1}
                type={type}
                selected={isSelected}
                disabled={!tappable && !isSelected}
                onClick={tappable ? () => props.onChipClick(chip) : undefined}
              />
            );
          })}
        </div>
      ) : null}
      {chips.length > 0 && !isEscalate && !isCapabilityPrompt && !additive && !hasPick && isLatest && !isLoading ? (
        <div className="fcsdk-c-align-hatch">
          <FcIcon name="m_info" size={16} tint="#00C950" />
          <span className="fc-t-bodySmall" style={{ color: 'var(--fc-c-fg-secondary)' }}>
            {label('fc_v2_app_label_dont_see_your_option', "Don't see your option?")}
          </span>
          <button type="button" className="fc-t-bodySmall fcsdk-c-align-hatch-action" onClick={props.onTypeInstead}>
            {label('fc_v2_app_label_type_or_say_it', 'Type or say it.')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
