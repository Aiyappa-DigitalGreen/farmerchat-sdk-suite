/**
 * Cards — 1:1 port of the Compose SDK components/Cards.kt (ContentCard,
 * SingleSelectCard, MultiSelectCard, SsfrCard, SuggestedCard) + Lists.
 * White rounded-24 elevated cards with edge-to-edge confirm bars.
 */
import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { radius, typography, White } from '../theme';
import { useTheme } from '../context';
import type { SectionDto, SectionOption } from '../../core/types';
import { PrimaryButton } from './Buttons';
import { CheckboxRow, RadioRow } from './Inputs';
import { FcIcon } from './Icon';
import type { IconName } from '../assets';

const cardShadow: ViewStyle = {
  elevation: 8,
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
};

// ---------------------------------------------------------------------------
// ContentCard (image/statement feed card)
// ---------------------------------------------------------------------------

export function ContentCard(props: {
  section: SectionDto;
  onTap: () => void;
  ctaLabel: string;
  isButtonLoading?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const { section } = props;
  const headline = section.title ?? section.question_text ?? section.statement ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onTap}
      style={({ pressed }) => [
        styles.card,
        cardShadow,
        { backgroundColor: c.surfaceSecondary, transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      {section.image_url ? (
        <View style={styles.cardImageWrap}>
          <Image
            source={{ uri: section.image_url }}
            style={[styles.cardImage, { backgroundColor: c.surfacePrimary }]}
            resizeMode="cover"
          />
          {section.badge?.show === true && section.badge.count !== null ? (
            <View style={[styles.viewBadge, { backgroundColor: c.scrim }]}>
              <Text style={[typography.labelSmall, { color: White }]}>
                👁 {section.badge.count}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ height: 10 }} />
      )}
      <View style={styles.cardBody}>
        <Text
          numberOfLines={3}
          style={[typography.bodyLarge, { color: c.foregroundPrimary }]}
        >
          {headline}
        </Text>
        <PrimaryButton
          label={props.ctaLabel}
          state={props.isButtonLoading ? 'Loading' : 'Chevron'}
          height={42}
          onPress={props.onTap}
        />
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Select cards — shared confirm/feedback shell
// ---------------------------------------------------------------------------

type SelectCardPhase = 'selecting' | 'saving' | 'feedback' | 'dismissed';

function SelectCardShell(props: {
  question: string;
  phase: SelectCardPhase;
  successMessage: string;
  confirmLabel: string;
  savingLabel: string;
  hasSelection: boolean;
  onConfirm: () => void;
  children: React.ReactNode;
}): React.ReactElement | null {
  const theme = useTheme();
  const c = theme.content;
  if (props.phase === 'dismissed') return null;
  return (
    <View
      style={[
        styles.card,
        cardShadow,
        { backgroundColor: c.surfaceSecondary, overflow: 'hidden' },
      ]}
    >
      {props.phase === 'feedback' ? (
        <View style={styles.feedback}>
          <View style={[styles.feedbackCheck, { backgroundColor: c.borderActive }]}>
            <FcIcon name="check" size={22} tint={White} />
          </View>
          <Text
            style={[
              typography.bodyLarge,
              { color: c.foregroundPrimary, textAlign: 'center' },
            ]}
          >
            {props.successMessage}
          </Text>
        </View>
      ) : (
        <View>
          <View style={styles.selectBody}>
            <Text style={[typography.bodyLarge, { color: c.foregroundPrimary }]}>
              {props.question}
            </Text>
            <View style={{ gap: 6 }}>{props.children}</View>
          </View>
          {props.hasSelection ? (
            <PrimaryButton
              label={props.phase === 'saving' ? props.savingLabel : props.confirmLabel}
              state={props.phase === 'saving' ? 'Loading' : 'Default'}
              radiusOverride={0}
              onPress={props.onConfirm}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

function useSelectPhases(onDismissed: () => void): {
  phase: SelectCardPhase;
  startSaving: () => void;
} {
  const [phase, setPhase] = useState<SelectCardPhase>('selecting');
  useEffect(() => {
    if (phase === 'saving') {
      const t = setTimeout(() => {
        setPhase('feedback');
        onDismissed();
      }, 1000);
      return () => clearTimeout(t);
    }
    if (phase === 'feedback') {
      const t = setTimeout(() => setPhase('dismissed'), 3000);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  return { phase, startSaving: () => setPhase('saving') };
}

/** Single-select question card (gender). */
export function SingleSelectCard(props: {
  section: SectionDto;
  onSubmit: (option: SectionOption) => void;
  submitLabel: string;
  savingLabel: string;
  successMessage: string;
  isSubmitting?: boolean;
  onDismissed?: () => void;
}): React.ReactElement | null {
  const theme = useTheme();
  const c = theme.content;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { phase, startSaving } = useSelectPhases(props.onDismissed ?? (() => undefined));
  const options = props.section.options ?? [];
  const selected = options.find((o) => o.id === selectedId) ?? null;
  return (
    <SelectCardShell
      question={props.section.statement ?? props.section.question_text ?? props.section.title ?? ''}
      phase={phase}
      successMessage={props.successMessage}
      confirmLabel={props.submitLabel}
      savingLabel={props.savingLabel}
      hasSelection={selected !== null}
      onConfirm={() => {
        if (!selected || phase !== 'selecting') return;
        props.onSubmit(selected);
        startSaving();
      }}
    >
      {options.map((option) => (
        <RadioRow
          key={option.id}
          label={option.text}
          selected={option.id === selectedId}
          enabled={phase === 'selecting'}
          backgroundColor={c.surfacePrimary}
          onPress={() =>
            setSelectedId((prev) => (prev === option.id ? null : option.id))
          }
        />
      ))}
    </SelectCardShell>
  );
}

/** Multi-select question card (crops / livestock) with none-of-the-above logic. */
export function MultiSelectCard(props: {
  section: SectionDto;
  onSubmit: (options: SectionOption[]) => void;
  submitLabel: string;
  savingLabel: string;
  successMessage: string;
  isSubmitting?: boolean;
  onDismissed?: () => void;
}): React.ReactElement | null {
  const theme = useTheme();
  const c = theme.content;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { phase, startSaving } = useSelectPhases(props.onDismissed ?? (() => undefined));
  const options = props.section.options ?? [];

  const isNone = (option: SectionOption): boolean =>
    option.id.toLowerCase().includes('none_of_the_above') ||
    option.id.toLowerCase() === 'none' ||
    option.text.trim().toLowerCase() === 'none of the above';

  const toggle = (option: SectionOption) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isNone(option)) {
        return next.has(option.id) ? new Set<string>() : new Set([option.id]);
      }
      for (const o of options) {
        if (isNone(o)) next.delete(o.id);
      }
      if (next.has(option.id)) {
        next.delete(option.id);
      } else {
        next.add(option.id);
      }
      return next;
    });
  };

  return (
    <SelectCardShell
      question={props.section.statement ?? props.section.question_text ?? props.section.title ?? ''}
      phase={phase}
      successMessage={props.successMessage}
      confirmLabel={props.submitLabel}
      savingLabel={props.savingLabel}
      hasSelection={selectedIds.size > 0}
      onConfirm={() => {
        if (selectedIds.size === 0 || phase !== 'selecting') return;
        props.onSubmit(options.filter((o) => selectedIds.has(o.id)));
        startSaving();
      }}
    >
      {options.map((option) => (
        <CheckboxRow
          key={option.id}
          label={option.text}
          checked={selectedIds.has(option.id)}
          enabled={phase === 'selecting'}
          backgroundColor={c.surfacePrimary}
          onPress={() => toggle(option)}
        />
      ))}
    </SelectCardShell>
  );
}

// ---------------------------------------------------------------------------
// SsfrCard
// ---------------------------------------------------------------------------

export function SsfrCard(props: {
  title: string;
  subtitle: string;
  wheatLabel: string;
  maizeLabel: string;
  onCropPress: (crop: 'wheat' | 'maize') => void;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const CropButton = (p: { emoji: string; label: string; onPress: () => void }) => (
    <Pressable
      accessibilityRole="button"
      onPress={p.onPress}
      style={({ pressed }) => [
        styles.ssfrButton,
        { backgroundColor: c.buttonPrimarySurface, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <Text style={{ fontSize: 16 }}>{p.emoji}</Text>
      <Text
        numberOfLines={1}
        style={[
          typography.labelMedium,
          { color: c.buttonPrimaryForeground, flex: 1, marginLeft: 8 },
        ]}
      >
        {p.label}
      </Text>
      <FcIcon name="chevronRight" size={20} tint={c.buttonPrimaryAccent} />
    </Pressable>
  );
  return (
    <View style={[styles.card, cardShadow, { backgroundColor: c.surfaceSecondary, padding: 16 }]}>
      <Text
        numberOfLines={1}
        style={[typography.bodyMedium, { color: c.foregroundPrimary, fontWeight: '700' }]}
      >
        {props.title}
      </Text>
      <Text
        numberOfLines={2}
        style={[typography.bodySmall, { color: c.foregroundPrimary, marginTop: 4 }]}
      >
        {props.subtitle}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <CropButton emoji="🌾" label={props.wheatLabel} onPress={() => props.onCropPress('wheat')} />
        <CropButton emoji="🌽" label={props.maizeLabel} onPress={() => props.onCropPress('maize')} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SuggestedCard (follow-up / related question)
//
// Reads as a clearly-tappable card: a card surface with a brand-accent hairline
// border, a comfortable >=48dp touch target, and a trailing accent "ask" send
// affordance. Host theming recolors it automatically — border/affordance use the
// brand accent, surface uses cardSurface.
// ---------------------------------------------------------------------------

export function SuggestedCard(props: {
  question: string;
  askLabel: string;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const accent = theme.brand.foregroundSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.askLabel}: ${props.question}`}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.suggested,
        {
          backgroundColor: c.surfaceSecondary,
          borderColor: withAlpha(accent, 0.35),
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <Text style={[typography.bodyMedium, { color: c.foregroundPrimary, flex: 1 }]}>
        {props.question}
      </Text>
      <View style={[styles.askAffordance, { backgroundColor: withAlpha(accent, 0.16) }]}>
        <FcIcon name="send" size={16} tint={accent} />
      </View>
    </Pressable>
  );
}

/** #RRGGBB / rgb(a) → rgba() at alpha; passes named/rgba through unchanged. */
function withAlpha(color: string, alpha: number): string {
  const m6 = /^#([0-9a-fA-F]{6})$/.exec(color.trim());
  const m3 = /^#([0-9a-fA-F]{3})$/.exec(color.trim());
  let r: number, g: number, b: number;
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
// List (ListCard / ListItem — chat history, settings, help)
// ---------------------------------------------------------------------------

export function ListCard(props: {
  children: React.ReactNode;
  title?: string | null;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  return (
    <View style={{ gap: 8 }}>
      {props.title ? (
        <Text
          style={[
            typography.labelSmall,
            { color: c.foregroundSecondary, paddingHorizontal: 4 },
          ]}
        >
          {props.title}
        </Text>
      ) : null}
      <View style={[styles.listCard, { backgroundColor: c.surfaceSecondary }]}>
        {props.children}
      </View>
    </View>
  );
}

export function ListItem(props: {
  icon?: IconName | null;
  label: string;
  sublabel?: string | null;
  onPress?: () => void;
  showChevron?: boolean;
  testID?: string;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole={props.onPress ? 'button' : undefined}
      onPress={props.onPress}
      disabled={!props.onPress}
      style={({ pressed }) => [styles.listItem, pressed && { opacity: 0.7 }]}
    >
      {props.icon ? (
        <FcIcon name={props.icon} size={22} tint={c.foregroundPrimary} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={[typography.bodyMedium, { color: c.foregroundPrimary }]}
        >
          {props.label}
        </Text>
        {props.sublabel ? (
          <Text style={[typography.bodySmall, { color: c.foregroundSecondary }]}>
            {props.sublabel}
          </Text>
        ) : null}
      </View>
      {props.showChevron !== false && props.onPress ? (
        <FcIcon name="chevronRight" size={18} tint={c.formPlaceholder} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xxl,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
  },
  cardImageWrap: { paddingHorizontal: 8, paddingTop: 8 },
  cardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
  },
  viewBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    height: 28,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 12,
    gap: 16,
  },
  selectBody: {
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 20,
    gap: 18,
  },
  feedback: {
    paddingHorizontal: 40,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 16,
  },
  feedbackCheck: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ssfrButton: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 8,
  },
  suggested: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 12,
  },
  askAffordance: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
