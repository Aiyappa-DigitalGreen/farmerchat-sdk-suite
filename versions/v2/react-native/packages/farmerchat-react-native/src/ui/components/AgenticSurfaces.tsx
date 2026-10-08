/**
 * Agentic (2.0.0) chat surfaces — the streaming stall hint, the interrupted-stream error card,
 * and the server-driven alignment chip surfaces.
 *
 * Ports of the Android Compose components `StreamErrorCard.kt` and `AlignmentSurface.kt`
 * (fc-compose-agentic @ c0524dd6). Every user-visible string resolves through the label manager.
 *
 * ⚠ Known package-level bug, unrelated to this file: several of this package's label base keys do
 * not match the ones the server ships, so those strings fall back to their English defaults.
 * Localization on React Native is NOT verified — see the README / docs/04.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Labels } from '../../core/labels';
import {
  AlignmentKinds,
  isAdditiveAlignment,
  type AlignmentChip,
  type AlignmentKind,
} from '../../core/types';
import { StreamErrorKinds, type StreamErrorKind } from '../../core/agenticModels';
import { useLabel, useTheme } from '../context';
import { radius, spacing, typography } from '../theme';
import { PrimaryButton } from './Buttons';
import { LogoSpinner } from './Chrome';
import { FcIcon } from './Icon';

/**
 * How long a streamed answer may stall, with no tool status, before the UI shows a transient
 * "paused, resuming" hint. Port of the Compose `PAUSE_HINT_DELAY_MS`.
 */
export const PAUSE_HINT_DELAY_MS = 4000;

/** #RRGGBB / #RGB → rgba() at alpha; passes anything else through unchanged. */
function withAlpha(color: string, alpha: number): string {
  const value = color.trim();
  const m6 = /^#([0-9a-fA-F]{6})$/.exec(value);
  const m3 = /^#([0-9a-fA-F]{3})$/.exec(value);
  let r: number;
  let g: number;
  let b: number;
  if (m6) {
    r = parseInt(m6[1].slice(0, 2), 16);
    g = parseInt(m6[1].slice(2, 4), 16);
    b = parseInt(m6[1].slice(4, 6), 16);
  } else if (m3) {
    r = parseInt(m3[1][0] + m3[1][0], 16);
    g = parseInt(m3[1][1] + m3[1][1], 16);
    b = parseInt(m3[1][2] + m3[1][2], 16);
  } else {
    return color;
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Stall hint
// ---------------------------------------------------------------------------

/**
 * Transient client-side hint for a stream that has gone quiet mid-answer. NOT a failure: it
 * clears on the next delta because the caller keys it on the answer's length, so the timer
 * restarts whenever text grows.
 */
export function StreamStallHint(props: {
  /** Changes whenever new text arrives — resets the 4 s timer. */
  textLength: number;
  messageId: string;
}): React.ReactElement | null {
  const label = useLabel();
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    setStalled(false);
    const timer = setTimeout(() => setStalled(true), PAUSE_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [props.messageId, props.textLength]);
  if (!stalled) return null;
  return <LogoSpinner message={label(Labels.RESPONSE_PAUSED_RESUMING, 'Paused, resuming…')} />;
}

// ---------------------------------------------------------------------------
// Stream error card
// ---------------------------------------------------------------------------

/**
 * Inline card shown when an agentic stream ends without a complete answer. Renders below the AI
 * response — below the preserved partial text, if any — with a state-specific message and a
 * full-width "Try again" action.
 *
 * The copy is driven by BOTH `errorKind` and `hasPartial`, because "we lost the connection but
 * kept what you have" and "nothing arrived" are very different messages to a farmer:
 * - `hasPartial` → "Connection stopped. Your partial answer is saved."
 * - network      → "No internet connection"
 * - otherwise    → "Something went wrong"
 *
 * The tint comes from `brand.feedbackFail` so a host that themes the SDK gets its own failure
 * colour rather than a hardcoded red.
 */
export function StreamErrorCard(props: {
  errorKind: StreamErrorKind;
  hasPartial: boolean;
  onRetry: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();
  const fail = theme.brand.feedbackFail;

  const title = props.hasPartial
    ? label(
        Labels.CONNECTION_STOPPED_PARTIAL_SAVED,
        'Connection stopped. Your partial answer is saved.',
      )
    : props.errorKind === StreamErrorKinds.NETWORK
      ? label(Labels.NO_INTERNET_CONNECTION, 'No internet connection')
      : label(Labels.SOMETHING_WENT_WRONG, 'Something went wrong');

  return (
    <View
      style={[
        styles.errorCard,
        { backgroundColor: withAlpha(fail, 0.08), borderColor: withAlpha(fail, 0.16) },
      ]}
    >
      <View style={styles.errorTitleRow}>
        {/* Compose uses WifiOff / Warning here; this package's bundled icon set has neither, so
            both states share `info` tinted with the failure colour. Asset gap, noted in the
            report — the copy already distinguishes the two cases. */}
        <FcIcon name="info" size={20} tint={fail} />
        <Text style={[typography.bodyMedium, { color: theme.content.foregroundPrimary, flex: 1 }]}>
          {title}
        </Text>
      </View>
      <PrimaryButton
        label={label(Labels.TRY_AGAIN, 'Try again')}
        onPress={props.onRetry}
        style={styles.fullWidth}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Alignment surface
// ---------------------------------------------------------------------------

export type ChipVisual = 'agentic' | 'suggested' | 'escalate';

/**
 * Numbered quick-reply chip (Compose `Chip(number = …, type = ChipType.…)`). Shared by the
 * alignment surfaces and the related-questions list under every answer
 * (`ChatResponseActions.kt` `useChips = true`). Locks (and stays highlighted) once picked.
 */
export function NumberedChip(props: {
  label: string;
  number: number;
  visual: ChipVisual;
  selected?: boolean;
  enabled?: boolean;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const selected = props.selected === true;
  const enabled = props.enabled !== false;
  const accent =
    props.visual === 'escalate' ? theme.brand.feedbackFail : c.buttonPrimaryAccent;
  const isMuted = props.visual === 'suggested';
  const background = selected ? withAlpha(accent, 0.16) : c.surfaceSecondary;
  const border = isMuted ? c.borderDefault : withAlpha(accent, selected ? 0.55 : 0.32);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled, selected }}
      accessibilityLabel={props.label.length > 0 ? props.label : undefined}
      disabled={!enabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: background,
          borderColor: border,
          opacity: enabled ? (pressed ? 0.8 : 1) : selected ? 1 : 0.55,
        },
      ]}
    >
      <View style={[styles.chipNumber, { backgroundColor: withAlpha(accent, 0.16) }]}>
        <Text style={[typography.labelMedium, { color: accent }]}>{props.number}</Text>
      </View>
      <Text style={[typography.bodyMedium, { color: c.foregroundPrimary, flex: 1 }]}>
        {props.label}
      </Text>
      {selected ? <FcIcon name="check" size={16} tint={accent} /> : null}
    </Pressable>
  );
}

/** An alignment chip rendered as a {@link NumberedChip}. */
function AlignmentChipRow(props: {
  chip: AlignmentChip;
  number: number;
  visual: ChipVisual;
  selected: boolean;
  enabled: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <NumberedChip
      label={props.chip.label ?? ''}
      number={props.number}
      visual={props.visual}
      selected={props.selected}
      enabled={props.enabled}
      onPress={props.onPress}
    />
  );
}

/**
 * A server-driven alignment surface: a short prompt the farmer answers by tapping a chip, instead
 * of reading a normal answer.
 *
 * Two shapes, decided by {@link isAdditiveAlignment}:
 * - **Exclusive** (clarify / confirm / escalate / capability prompts) — owns the message area and
 *   replaces the answer, so it renders its own heading and, where appropriate, an escape hatch.
 * - **Additive** (gender-select / commodity-confirm) — a nudge BELOW a real answer, so it renders
 *   no heading and no escape hatch; the answer above already owns the action row.
 *
 * Escalate gets an urgent treatment derived from `brand.feedbackFail`, keeping the card coherent
 * rather than dropping the brand accent into a red surface.
 */
export function AlignmentSurface(props: {
  kind: AlignmentKind;
  message: string;
  chips: AlignmentChip[];
  selectedValues: string[];
  isLoading: boolean;
  isLatest: boolean;
  onChipPress: (chip: AlignmentChip) => void;
  onTypeInstead?: () => void;
  /** True when rendering below a real answer; suppresses the heading and escape hatch. */
  additive?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();
  const c = theme.content;
  const { kind } = props;
  const additive = props.additive ?? isAdditiveAlignment(kind);
  const isEscalate = kind === AlignmentKinds.ESCALATE;
  const isCapabilityPrompt =
    kind === AlignmentKinds.GPS_PROMPT || kind === AlignmentKinds.UPLOAD_PHOTO;
  const hasPick = props.selectedValues.length > 0;
  // Capability and additive surfaces are single-shot: one tap settles them, so every chip locks.
  // Clarify/confirm stay open so the farmer can pick a different option.
  const chipsLocked = (isCapabilityPrompt || additive) && hasPick;

  const heading =
    kind === AlignmentKinds.GPS_PROMPT
      ? label(Labels.SHARE_LOCATION_TITLE, 'Share location')
      : kind === AlignmentKinds.UPLOAD_PHOTO
        ? label(Labels.ADD_ONE_CLEAR_PHOTO, 'Add one clear photo')
        : kind === AlignmentKinds.CONFIRM
          ? label(Labels.PLEASE_CONFIRM, 'Please Confirm')
          : label(Labels.CHOOSE_ONE, 'Choose one');

  const body = (
    <>
      {props.message.trim().length > 0 ? (
        <Text style={[typography.body, { color: c.foregroundPrimary }]}>{props.message}</Text>
      ) : null}
      {!isEscalate && !additive ? (
        <Text style={[typography.titleSmall, { color: c.foregroundPrimary }]}>{heading}</Text>
      ) : null}
      {props.chips.length > 0 ? (
        <View style={styles.chipList}>
          {props.chips.map((chip, index) => {
            const selected =
              (chip.value != null &&
                chip.value.length > 0 &&
                props.selectedValues.includes(chip.value)) ||
              (chip.label != null &&
                chip.label.length > 0 &&
                props.selectedValues.includes(chip.label));
            const tappable = !selected && !props.isLoading && !chipsLocked;
            // Once a pick exists the unpicked chips fade back to "suggested", so the chosen one
            // reads as the answer rather than one of several live options.
            const visual: ChipVisual = isEscalate
              ? !hasPick || selected
                ? 'escalate'
                : 'suggested'
              : !hasPick || selected
                ? 'agentic'
                : 'suggested';
            return (
              <AlignmentChipRow
                key={`${index}-${chip.value ?? chip.label ?? ''}`}
                chip={chip}
                number={index + 1}
                visual={visual}
                selected={selected}
                enabled={tappable}
                onPress={() => props.onChipPress(chip)}
              />
            );
          })}
        </View>
      ) : null}
      {/* Escape hatch: only on an open, exclusive, non-urgent surface that is still the latest.
          Without it a farmer whose answer is not among the chips has no way forward. */}
      {props.chips.length > 0 &&
      !isEscalate &&
      !isCapabilityPrompt &&
      !additive &&
      !hasPick &&
      props.isLatest &&
      !props.isLoading ? (
        <View style={styles.escapeRow}>
          <FcIcon name="info" size={16} tint={c.buttonPrimaryAccent} />
          <Text style={[typography.bodySmall, { color: c.foregroundSecondary }]}>
            {label(Labels.DONT_SEE_YOUR_OPTION, "Don't see your option?")}
          </Text>
          <Pressable accessibilityRole="button" onPress={props.onTypeInstead}>
            <Text
              style={[
                typography.bodySmall,
                { color: c.buttonPrimaryAccent, fontWeight: '600' },
              ]}
            >
              {label(Labels.TYPE_OR_SAY_IT, 'Type or say it.')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );

  if (isEscalate) {
    // Urgent surfaces get a tinted, bordered card so they read differently at a glance.
    const fail = theme.brand.feedbackFail;
    return (
      <View
        style={[
          styles.escalateCard,
          { backgroundColor: withAlpha(fail, 0.08), borderColor: withAlpha(fail, 0.16) },
        ]}
      >
        {body}
      </View>
    );
  }
  return <View style={styles.surface}>{body}</View>;
}

const styles = StyleSheet.create({
  errorCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  errorTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fullWidth: { alignSelf: 'stretch' },
  surface: { gap: spacing.md },
  escalateCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  chipList: { gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  chipNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  escapeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
});
