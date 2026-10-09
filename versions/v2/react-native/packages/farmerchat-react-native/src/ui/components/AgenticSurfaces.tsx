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
import { AnalyticsEvents, ScreenNames } from '../../core/analytics';
import { useLabel, useSdk, useTheme } from '../context';
import { radius, typography } from '../theme';
import { INLINE_SPINNER_STYLE, LogoSpinner } from './Chrome';
import { FcIcon } from './Icon';
import { MarkdownText } from './Markdown';

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
  return (
    <LogoSpinner
      message={label(Labels.RESPONSE_PAUSED_RESUMING, 'Paused, resuming…')}
      style={INLINE_SPINNER_STYLE}
    />
  );
}

// ---------------------------------------------------------------------------
// Stream error card
// ---------------------------------------------------------------------------

/**
 * StreamErrorCard.kt — inline card shown when an agentic stream ends without a complete answer,
 * below the preserved partial text (if any).
 *
 * The copy is driven by BOTH `errorKind` and `hasPartial`:
 * - `hasPartial` → "Connection stopped. Your partial answer is saved."
 * - network      → "No internet connection"
 * - otherwise    → "Something went wrong"
 *
 * Layout (app): 16dp above; a radius-12 card, 8% red fill, 1dp 16% red border, padding 16;
 * [24dp icon, 12dp, bold bodyMedium title]; 16dp; a full-width radius-12 (not pill) button on
 * buttonPrimarySurface with 14dp vertical padding holding a 20dp Refresh tinted
 * buttonPrimaryAccent, 8dp, and a bold labelLarge "Try again". The tap tracks
 * Content_Try_Again_Clicked (screen_name = Chat Screen) exactly as the app's card does.
 *
 * The tint comes from `brand.feedbackFail` so a host that themes the SDK gets its own failure
 * colour (Red500 by default — the app's constant).
 */
export function StreamErrorCard(props: {
  errorKind: StreamErrorKind;
  hasPartial: boolean;
  onRetry: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();
  const sdk = useSdk();
  const c = theme.content;
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
        {/* Compose uses WifiOff (network) / Warning here; this package's bundled icon set has
            neither, so both states share `info` tinted with the failure colour. Asset gap — the
            copy already distinguishes the two cases. */}
        <FcIcon name="info" size={24} tint={fail} />
        <Text
          style={[
            typography.bodyMedium,
            { color: c.foregroundPrimary, fontWeight: '700', flex: 1 },
          ]}
        >
          {title}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          props.onRetry();
          sdk.analytics.track(AnalyticsEvents.CONTENT_TRY_AGAIN_CLICKED, {
            screen_name: ScreenNames.CHAT,
          });
        }}
        style={({ pressed }) => [
          styles.errorRetry,
          { backgroundColor: c.buttonPrimarySurface, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <FcIcon name="refresh" size={20} tint={c.buttonPrimaryAccent} />
        <Text
          style={[typography.labelLarge, { color: c.buttonPrimaryForeground, fontWeight: '700' }]}
        >
          {label(Labels.TRY_AGAIN, 'Try again')}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Inline error (failed question)
// ---------------------------------------------------------------------------

/**
 * InlineErrorContent.kt — the row under a question whose request failed:
 * Row(fillMaxWidth, padding start 4, centred) [48dp feedbackFail circle + white Close 24] 12dp
 * ["Something went wrong" bodyMedium foregroundPrimary, weight 1] 8dp [Try again pill:
 * surfaceTertiary, radius 12, padding h10 v12, spacedBy 4: Refresh 16 + labelMedium].
 *
 * The text is ALWAYS the fixed label, never the raw error. The tap tracks
 * Content_Try_Again_Clicked (screen_name = Chat Screen), then retries — as the app does.
 */
export function InlineErrorContent(props: { onRetry: () => void }): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();
  const sdk = useSdk();
  const c = theme.content;
  return (
    <View style={styles.inlineError} accessibilityRole="alert">
      <View
        style={[styles.inlineErrorIcon, { backgroundColor: theme.brand.feedbackFail }]}
        accessibilityLabel="Error"
      >
        <FcIcon name="close" size={24} tint="#FFFFFF" />
      </View>
      <Text style={[typography.bodyMedium, styles.inlineErrorText, { color: c.foregroundPrimary }]}>
        {label(Labels.SOMETHING_WENT_WRONG, 'Something went wrong')}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          props.onRetry();
          sdk.analytics.track(AnalyticsEvents.CONTENT_TRY_AGAIN_CLICKED, {
            screen_name: ScreenNames.CHAT,
          });
        }}
        style={({ pressed }) => [
          styles.inlineErrorRetry,
          { backgroundColor: c.surfaceTertiary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <FcIcon name="refresh" size={16} tint={c.foregroundPrimary} />
        <Text style={[typography.labelMedium, { color: c.foregroundPrimary }]}>
          {label(Labels.TRY_AGAIN, 'Try again')}
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Alignment surface
// ---------------------------------------------------------------------------

export type ChipVisual = 'agentic' | 'suggested' | 'escalate';

/**
 * Chip.kt — the one option chip used across every agentic surface and the related-questions list
 * (`ChatResponseActions.kt` `useChips = true`). Full width, radius 12, padding s14 e10 t14 b14,
 * spacedBy 8: [24dp badge] [labelMedium label, weight 1] [24dp chevron while tappable].
 *
 * - Surface: selected → surfaceActive (escalate: escalateSurface = Red500 8%); disabled →
 *   surfaceTertiary; escalate → solid escalateForeground (Red500); agentic → surfaceActive;
 *   suggested → surfaceReadingSecondary.
 * - Border only when selected (1.5dp accent) or disabled (0.5dp borderDefault).
 * - Badge: selected → accent circle + white check; else number on accent (green) / white
 *   (escalate, red number) / foregroundSecondary (disabled, surfaceTertiary number).
 * - Label: labelMedium (600); Bold only when selected.
 * A selected chip is a record of the pick: it takes no taps and shows no chevron.
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
  const brand = theme.brand;
  const selected = props.selected === true;
  const enabled = props.enabled !== false;
  const isEscalate = props.visual === 'escalate';
  const clickable = enabled && !selected;
  // brand.escalateForeground / escalateSurface (ColorBrandSemantic.kt) = Red500 / Red500 8%,
  // derived from the host-themable failure colour.
  const escalateForeground = brand.feedbackFail;
  const selectedAccent = isEscalate ? escalateForeground : c.buttonPrimaryAccent;

  const surfaceColor = selected
    ? isEscalate
      ? withAlpha(escalateForeground, 0.08)
      : c.surfaceActive
    : !enabled
      ? c.surfaceTertiary
      : isEscalate
        ? escalateForeground
        : props.visual === 'agentic'
          ? c.surfaceActive
          : c.surfaceReadingSecondary;
  const labelColor = selected
    ? c.foregroundPrimary
    : !enabled
      ? c.foregroundSecondary
      : isEscalate
        ? brand.foregroundPrimary
        : c.foregroundPrimary;
  const chevronColor = !enabled
    ? c.foregroundTertiary
    : isEscalate
      ? brand.foregroundPrimary
      : props.visual === 'agentic'
        ? c.buttonPrimaryAccent
        : c.foregroundSecondary;
  const border = selected
    ? { borderWidth: 1.5, borderColor: selectedAccent }
    : !enabled
      ? { borderWidth: 0.5, borderColor: c.borderDefault }
      : null;
  const badgeColor = !enabled
    ? c.foregroundSecondary
    : isEscalate
      ? brand.foregroundPrimary
      : c.buttonPrimaryAccent;
  const numberColor = !enabled
    ? c.surfaceTertiary
    : isEscalate
      ? escalateForeground
      : c.buttonPrimaryForeground;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !clickable, selected }}
      accessibilityLabel={props.label.length > 0 ? props.label : undefined}
      disabled={!clickable}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: surfaceColor, opacity: pressed ? 0.85 : 1 },
        border,
      ]}
    >
      {selected ? (
        <View style={[styles.chipBadge, { backgroundColor: selectedAccent }]}>
          <FcIcon name="check" size={16} tint={c.buttonPrimaryForeground} />
        </View>
      ) : (
        <View style={[styles.chipBadge, { backgroundColor: badgeColor }]}>
          <Text style={[typography.labelMedium, { color: numberColor }]}>{props.number}</Text>
        </View>
      )}
      <Text
        style={[
          typography.labelMedium,
          { color: labelColor, flex: 1 },
          selected ? { fontWeight: '700' } : null,
        ]}
      >
        {props.label}
      </Text>
      {clickable ? <FcIcon name="chevronRight" size={24} tint={chevronColor} /> : null}
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
 * AlignmentSurface.kt — a server-driven prompt the farmer answers by tapping a chip.
 *
 * Two shapes, decided by {@link isAdditiveAlignment}:
 * - **Exclusive** (clarify / confirm / escalate / capability prompts) — owns the message area and
 *   replaces the answer, so it renders its own heading and, where appropriate, an escape hatch.
 * - **Additive** (gender-select / commodity-confirm) — a nudge BELOW a real answer, so it renders
 *   no heading, no Listen pill and no escape hatch; the answer above already owns those.
 *
 * Body (app): MarkdownText message (bodyMedium); [16dp + Listen pill while it is the live,
 * non-escalate, non-additive prompt]; 16dp; options = [titleMedium header (not escalate/additive);
 * 16dp (only under a header) + chips 8 apart] — inside a radius-16, 1dp borderDefault, padding-16
 * card for GPS_PROMPT / UPLOAD_PHOTO; then the escape hatch (12dp, icon 16 + ONE text run "hint"
 * + " " + "Type or say it." in accent SemiBold, bodySmall). Escalate wraps the whole body in a
 * radius-16 red-tinted card.
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
  /**
   * The light Listen pill (ListenButton(light = true)), supplied by the screen that owns TTS.
   * Rendered only on the live, non-escalate, non-additive prompt.
   */
  listen?: React.ReactNode;
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
  const showHeading = !isEscalate && !additive;

  const heading =
    kind === AlignmentKinds.GPS_PROMPT
      ? label(Labels.SHARE_LOCATION_TITLE, 'Share location')
      : kind === AlignmentKinds.UPLOAD_PHOTO
        ? label(Labels.ADD_ONE_CLEAR_PHOTO, 'Add one clear photo')
        : kind === AlignmentKinds.CONFIRM
          ? label(Labels.PLEASE_CONFIRM, 'Please confirm')
          : label(Labels.CHOOSE_ONE, 'Choose one');

  const options = (
    <>
      {showHeading ? (
        <Text style={[typography.titleMedium, { color: c.foregroundPrimary }]}>{heading}</Text>
      ) : null}
      {props.chips.length > 0 ? (
        <View style={[styles.chipList, showHeading ? { marginTop: 16 } : null]}>
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
    </>
  );

  const showListen = !isEscalate && !additive && props.isLatest && !props.isLoading && props.listen != null;

  const body = (
    <>
      {props.message.trim().length > 0 ? (
        <MarkdownText markdown={props.message} color={c.foregroundPrimary} />
      ) : null}
      {showListen ? <View style={styles.listenSlot}>{props.listen}</View> : null}
      <View style={{ height: 16 }} />
      {isCapabilityPrompt ? (
        <View style={[styles.capabilityCard, { borderColor: c.borderDefault }]}>{options}</View>
      ) : (
        options
      )}
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
          <Text style={[typography.bodySmall, { color: c.foregroundSecondary, flexShrink: 1 }]}>
            {label(Labels.DONT_SEE_YOUR_OPTION, "Don't see your option?")}{' '}
            <Text
              accessibilityRole="button"
              onPress={props.onTypeInstead}
              style={{ color: c.buttonPrimaryAccent, fontWeight: '600' }}
            >
              {label(Labels.TYPE_OR_SAY_IT, 'Type or say it.')}
            </Text>
          </Text>
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
  // StreamErrorCard.kt: padding(top = 16) outside the card.
  errorCard: {
    alignSelf: 'stretch',
    marginTop: 16,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  errorTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  errorRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  inlineError: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
  },
  inlineErrorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineErrorText: { flex: 1, marginLeft: 12, marginRight: 8 },
  inlineErrorRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  surface: { alignSelf: 'stretch' },
  escalateCard: {
    alignSelf: 'stretch',
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  capabilityCard: {
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  listenSlot: { marginTop: 16, alignItems: 'flex-start' },
  chipList: { gap: 8 },
  chip: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  chipBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  escapeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
});
