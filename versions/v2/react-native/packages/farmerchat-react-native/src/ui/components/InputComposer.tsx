/**
 * InputComposer — port of the Compose SDK `components/InputComposer.kt` (2.0.0).
 *
 * ONE bar replaces the separate text input sheet + Photo/Speak/Type tile row:
 * camera / text field / mic-or-send. Home uses it `floating` (10dp horizontal
 * margins, radius-24 sheet, lifted above the safe area); Chat uses it
 * `compact` (shorter button row + tighter internal padding once focused).
 *
 * Deviations from the Compose reference (all deliberate — see the RN report):
 *  - **Aura drawn with Views.** The Compose idle state strokes the field with a
 *    rotating multi-colour sweep gradient (7s flow, breathing intensity). Here it
 *    is a {@link SweepBorder} ring (`./Gradients`) — the same colours, flow and
 *    breathing — without the two faint bloom strokes under the core stroke.
 *  - **Placeholder shimmer** uses `ShimmerText` from `./Gradients` (2250ms, as
 *    Compose); its base colour switches with the field state instead of fading.
 *  - **Flow layout, not an overlay.** Compose renders the composer in a
 *    `fillMaxSize` Box over the screen. Because `FloatingFadeHeight` is 0.dp
 *    and the floating wrapper paints `fadeColor` opaquely, nothing behind the
 *    bar is ever visible — so a bottom flow element is visually equivalent and
 *    avoids RN overlay/keyboard fights. The non-anchored tap-to-dismiss scrim
 *    is therefore not ported (both call sites pass `isAnchored`).
 *  - **Imperative handle instead of callback registration.** Compose hands the
 *    parent `focus`/`setText`/`clear` lambdas through `onFocusRequest` etc.;
 *    here they are a `ref` (`InputComposerHandle`).
 *  - **Keyboard seating.** Compose consumes `WindowInsets.ime`. On iOS the
 *    window does not resize, so the keyboard height is added as bottom
 *    padding; on Android the host activity's `windowSoftInputMode="adjustResize"`
 *    (a documented SDK requirement, see the package README) already resizes the
 *    window, so only the smaller focused gap is applied. This is the same
 *    ime-inset behaviour, expressed per platform.
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context';
import { dayTheme, radius, typography } from '../theme';
import { FcIcon } from './Icon';
import { ShimmerText, SweepBorder, type SweepStop } from './Gradients';

// ---------------------------------------------------------------------------
// Composer geometry — single source of truth, values copied 1:1 from
// InputComposer.kt so the two platforms measure the same.
// ---------------------------------------------------------------------------

/** Padding above the button row, inside the composer sheet. Figma floating: 12. */
const COMPOSER_TOP_INSIDE = 12;
const COMPOSER_TOP_INSIDE_COMPACT = 10;

/** Height of the circular button row (camera / text-field / mic-or-send). */
const COMPOSER_BUTTON_ROW = 48;
const COMPOSER_BUTTON_ROW_COMPACT = 42;

/** Icon size inside the action buttons. Figma uses a uniform 22 for all three. */
const COMPOSER_ACTION_ICON = 22;
const COMPOSER_ACTION_ICON_COMPACT = 20;

/** Padding below the button row, inside the composer sheet. Figma floating: 12. */
const COMPOSER_AT_REST_GAP = 12;
const COMPOSER_AT_REST_GAP_COMPACT = 8;

/** Visual breathing room above the keyboard when focused. */
const COMPOSER_KEYBOARD_GAP = 12;
const COMPOSER_KEYBOARD_GAP_COMPACT = 10;

/** Floating mode: horizontal inset from screen edges. Figma Home: 10dp. */
const FLOATING_HORIZONTAL_MARGIN = 10;

/** Floating mode: gap between sheet bottom and the system nav inset. Figma Home: 20dp. */
const FLOATING_BOTTOM_GAP = 20;

/** Floating mode: gap between the sheet's bottom edge and the keyboard when focused. */
const FLOATING_KEYBOARD_GAP = 4;

/** Rotating-placeholder dwell + crossfade, matching the Compose LaunchedEffect/AnimatedContent. */
const PLACEHOLDER_ROTATION_MS = 3000;
const PLACEHOLDER_FADE_MS = 400;

/** Field background / placeholder colour crossfade. */
const FIELD_FADE_MS = 220;

/** Compact shrink/grow animation. */
const SIZE_ANIM_MS = 250;

/** Slide distance used to park the bar off-screen when `visible` is false. */
const SLIDE_OFF = 400;
const SLIDE_MS = 300;

/** Single attached image per query — thumbnail metrics from Compose PhotoThumbnail. */
const THUMBNAIL_SIZE = 64;
const THUMBNAIL_GAP_BELOW = 10;

/** InputComposer.kt aura: 2.4dp core stroke, one colour rotation per 7s. */
const AURA_WIDTH = 2.4;
/** InputComposer.kt `ComposerShimmerPeriodMs`: the placeholder shimmer's sweep period. */
const COMPOSER_SHIMMER_PERIOD_MS = 2250;
const AURA_FLOW_MS = 7000;
/** InputComposer.kt `AuraColors`: green → cyan → green → yellow → green, evenly spaced. */
const AURA_STOPS: readonly SweepStop[] = [
  [0, '#00C950'],
  [0.25, '#22D3EE'],
  [0.5, '#00C950'],
  [0.75, '#FFF947'],
  [1, '#00C950'],
];

/**
 * Height of the composer bar at rest, measured from the bottom of the screen.
 * Mirrors Compose's `composerBarHeight(floating, compact)`: floating seats the
 * sheet `max(bottomInset, FLOATING_BOTTOM_GAP)` above the screen bottom, so the
 * design gap REPLACES the safe-area inset rather than stacking on it.
 *
 * Only needed by callers that overlay content on the composer (e.g. positioning
 * a scroll-to-bottom pill above it) — the bar itself is a flow element.
 */
export function composerBarHeight(options: {
  floating?: boolean;
  compact?: boolean;
  bottomInset: number;
}): number {
  const compact = options.compact === true;
  const topInside = compact ? COMPOSER_TOP_INSIDE_COMPACT : COMPOSER_TOP_INSIDE;
  const buttonRow = compact ? COMPOSER_BUTTON_ROW_COMPACT : COMPOSER_BUTTON_ROW;
  const atRestGap = compact ? COMPOSER_AT_REST_GAP_COMPACT : COMPOSER_AT_REST_GAP;
  const restingBottom =
    options.floating === true
      ? Math.max(options.bottomInset, FLOATING_BOTTOM_GAP)
      : options.bottomInset;
  return topInside + buttonRow + atRestGap + restingBottom;
}

export interface InputComposerHandle {
  /** Focus the field and raise the keyboard (Compose `onFocusRequest`). */
  focus: () => void;
  /** Replace the field's text, caret at the end (Compose `onSetTextRequest`). */
  setText: (text: string) => void;
  /** Clear the text, drop focus and hide the keyboard (Compose `onClearRequest`). */
  clear: () => void;
}

export interface InputComposerProps {
  /** Called with the typed text on send. The attached image, if any, is the caller's own state. */
  onSend?: (text: string) => void;
  onPhotoPress?: () => void;
  onVoicePress?: () => void;
  onFocusChange?: (focused: boolean) => void;
  /** Anchored (persistent) composer. Both SDK call sites are anchored. */
  isAnchored?: boolean;
  /** When false the bar slides off-screen (used to hide it while an answer generates). */
  visible?: boolean;
  /** Single attached image per query — Compose allows exactly one. */
  attachedImageUri?: string | null;
  onRemoveAttachedImage?: () => void;
  placeholder?: string;
  /** When length > 1 the placeholder crossfades through this list every ~3s. */
  placeholders?: readonly string[] | null;
  /**
   * Launcher mode: taps on the field area fire this instead of focusing, and no
   * TextInput is rendered (Compose `onTextFieldTap`).
   */
  onTextFieldTap?: (() => void) | null;
  /** Composer sheet background. Defaults to content/surfaceReadingSecondary. */
  surfaceColor?: string;
  /** Floating: horizontal margins, all-corner radius 24, lifted off the bottom edge. */
  floating?: boolean;
  /** Colour the floating wrapper paints behind + below the sheet. Defaults to surfacePrimary. */
  fadeColor?: string;
  /** Shrinks button row + internal padding once focused (chat-style). */
  compact?: boolean;
  /**
   * Bottom safe-area inset to consume. Defaults to the measured inset; pass 0
   * when an ancestor (e.g. a SafeAreaView with a bottom edge) already consumed it.
   */
  bottomInset?: number;
  /** Mirrors config.enableImages — hides the camera button entirely when false. */
  showPhoto?: boolean;
  /** Mirrors config.enableVoice — the mic never replaces send when false. */
  showVoice?: boolean;
  /**
   * The idle "alive" aura around the field (Compose `showAura`, default true). Only drawn while
   * the field is not focused.
   */
  showAura?: boolean;
}

/** Circular action button; always light-mode colours (Compose wraps these in LightContentColors). */
function CircleButton(props: {
  size: number;
  iconSize: number;
  icon: 'camera' | 'mic' | 'send';
  accessibilityLabel: string;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.onPress}
      style={({ pressed }) => ({
        width: props.size,
        height: props.size,
        borderRadius: props.size / 2,
        backgroundColor: dayTheme.content.buttonPrimarySurface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <FcIcon
        name={props.icon}
        size={props.iconSize}
        tint={dayTheme.content.buttonPrimaryAccent}
      />
    </Pressable>
  );
}

export const InputComposer = forwardRef<InputComposerHandle, InputComposerProps>(
  function InputComposer(props, ref): React.ReactElement {
    const theme = useTheme();
    const c = theme.content;
    const insets = useSafeAreaInsets();
    const inputRef = useRef<TextInput>(null);

    const [text, setText] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const compact = props.compact === true;
    const floating = props.floating === true;
    const visible = props.visible !== false;
    const showPhoto = props.showPhoto !== false;
    const showVoice = props.showVoice !== false;
    const showAura = props.showAura !== false;
    const attachedImageUri = props.attachedImageUri ?? null;
    const hasContent = text.trim().length > 0 || attachedImageUri !== null;

    const bottomInset = props.bottomInset ?? insets.bottom;
    const surfaceColor = props.surfaceColor ?? c.surfaceReadingSecondary;
    const fadeColor = props.fadeColor ?? c.surfacePrimary;

    // --- rotating placeholder -------------------------------------------------
    const rotating = useMemo(() => {
      const list = props.placeholders;
      return list !== null && list !== undefined && list.length > 0 ? list : null;
    }, [props.placeholders]);

    const displayedPlaceholder =
      rotating !== null
        ? (rotating[placeholderIndex % rotating.length] ?? props.placeholder ?? '')
        : (props.placeholder ?? '');

    // Compose: `delay(3000)` in a loop, and the effect returns early while focused —
    // so rotation pauses on focus and resumes from the same index.
    useEffect(() => {
      if (rotating === null || rotating.length < 2 || isFocused) return;
      const timer = setInterval(() => {
        setPlaceholderIndex((i) => (i + 1) % rotating.length);
      }, PLACEHOLDER_ROTATION_MS);
      return () => clearInterval(timer);
    }, [rotating, isFocused]);

    const placeholderOpacity = useRef(new Animated.Value(1)).current;
    const firstPlaceholderRender = useRef(true);
    useEffect(() => {
      if (firstPlaceholderRender.current) {
        firstPlaceholderRender.current = false;
        return;
      }
      placeholderOpacity.setValue(0);
      Animated.timing(placeholderOpacity, {
        toValue: 1,
        duration: PLACEHOLDER_FADE_MS,
        useNativeDriver: true,
      }).start();
    }, [displayedPlaceholder, placeholderOpacity]);

    // --- keyboard -------------------------------------------------------------
    useEffect(() => {
      const onShow = Keyboard.addListener('keyboardDidShow', (event) => {
        setKeyboardHeight(event.endCoordinates?.height ?? 0);
      });
      const onHide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
      return () => {
        onShow.remove();
        onHide.remove();
      };
    }, []);

    // Compose: `LaunchedEffect(isKeyboardVisible) { if (!visible && focused) clearFocus() }` —
    // dismissing the keyboard with the back gesture must also drop the field's focus.
    const isKeyboardVisible = keyboardHeight > 0;
    useEffect(() => {
      if (!isKeyboardVisible && isFocused) inputRef.current?.blur();
    }, [isKeyboardVisible, isFocused]);

    // --- imperative handle ----------------------------------------------------
    const clear = useCallback(() => {
      setText('');
      setIsFocused(false);
      inputRef.current?.blur();
      Keyboard.dismiss();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        setText: (next: string) => setText(next),
        clear,
      }),
      [clear],
    );

    // --- animations -----------------------------------------------------------
    // `effectivelyCompact` = compact requested AND focused (Compose): the bar shrinks
    // in place on focus so the chat thread keeps more room while typing.
    const effectivelyCompact = compact && isFocused;
    const sizeProgress = useRef(new Animated.Value(effectivelyCompact ? 1 : 0)).current;
    useEffect(() => {
      Animated.timing(sizeProgress, {
        toValue: effectivelyCompact ? 1 : 0,
        duration: SIZE_ANIM_MS,
        useNativeDriver: false,
      }).start();
    }, [effectivelyCompact, sizeProgress]);

    const lerp = useCallback(
      (standard: number, compactValue: number) =>
        sizeProgress.interpolate({ inputRange: [0, 1], outputRange: [standard, compactValue] }),
      [sizeProgress],
    );

    const animatedTopInside = lerp(COMPOSER_TOP_INSIDE, COMPOSER_TOP_INSIDE_COMPACT);
    const animatedButtonRow = lerp(COMPOSER_BUTTON_ROW, COMPOSER_BUTTON_ROW_COMPACT);
    // Icon sizes settle instantly (2px delta — imperceptible mid-animation, and
    // FcIcon takes a plain number).
    const actionIcon = effectivelyCompact ? COMPOSER_ACTION_ICON_COMPACT : COMPOSER_ACTION_ICON;
    const buttonRow = effectivelyCompact ? COMPOSER_BUTTON_ROW_COMPACT : COMPOSER_BUTTON_ROW;

    const atRestGap = effectivelyCompact ? COMPOSER_AT_REST_GAP_COMPACT : COMPOSER_AT_REST_GAP;
    const keyboardGap = effectivelyCompact
      ? COMPOSER_KEYBOARD_GAP_COMPACT
      : COMPOSER_KEYBOARD_GAP;

    // Field "active" = focused OR has content. Idle sits on content/surfaceSecondary so it
    // reads as an input before first touch (Compose comment: the old brand-green idle read
    // as decoration).
    const isFieldActive = isFocused || hasContent;
    const fieldProgress = useRef(new Animated.Value(isFieldActive ? 1 : 0)).current;
    useEffect(() => {
      Animated.timing(fieldProgress, {
        toValue: isFieldActive ? 1 : 0,
        duration: FIELD_FADE_MS,
        useNativeDriver: false,
      }).start();
    }, [isFieldActive, fieldProgress]);

    const fieldBackgroundColor = fieldProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [c.surfaceSecondary, c.surfaceReadingTertiary],
    });
    // InputComposer.kt aura intensity: two gentle 2.4s breaths (1 ↔ 0.5), then one slow ebb to
    // 0.04 and swell back over ~2.7s each way. Starts at 0.8.
    const auraIntensity = useRef(new Animated.Value(0.8)).current;
    const auraOn = showAura && !isFocused;
    useEffect(() => {
      if (!auraOn) return;
      const to = (toValue: number, duration: number) =>
        Animated.timing(auraIntensity, { toValue, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
      const loop = Animated.loop(
        Animated.sequence([to(1, 2400), to(0.5, 2400), to(1, 2400), to(0.5, 2400), to(0.04, 2800), to(1, 2600)]),
      );
      loop.start();
      return () => loop.stop();
    }, [auraOn, auraIntensity]);

    // The shimmering placeholder needs a plain colour, so it switches at the field state rather
    // than fading over FIELD_FADE_MS like the background.
    const placeholderBaseColor = isFieldActive ? c.formPlaceholder : c.foregroundPrimary;

    const slide = useRef(new Animated.Value(visible ? 0 : SLIDE_OFF)).current;
    useEffect(() => {
      Animated.timing(slide, {
        toValue: visible ? 0 : SLIDE_OFF,
        duration: SLIDE_MS,
        useNativeDriver: true,
      }).start();
    }, [visible, slide]);

    // --- seating --------------------------------------------------------------
    // Floating: sit max(bottomInset, FLOATING_BOTTOM_GAP) above the screen bottom at rest —
    // the design gap REPLACES the inset rather than stacking on it (Compose comment).
    const restingBottom = floating ? Math.max(bottomInset, FLOATING_BOTTOM_GAP) : bottomInset;
    // iOS keyboards overlay the window, so the composer must physically clear them.
    // On Android the host's adjustResize already shrank the window (package README).
    const keyboardLift = Platform.OS === 'ios' ? keyboardHeight : 0;
    const outerBottomPadding = isKeyboardVisible
      ? keyboardLift + (floating ? FLOATING_KEYBOARD_GAP : 0)
      : restingBottom;
    const sheetBottomPadding = isKeyboardVisible ? keyboardGap : atRestGap;

    // --- send / mic -----------------------------------------------------------
    const send = useCallback(() => {
      const value = text;
      setIsFocused(false);
      inputRef.current?.blur();
      Keyboard.dismiss();
      props.onSend?.(value);
      setText('');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, props.onSend]);

    const onTrailingPress = useCallback(() => {
      if (hasContent) {
        send();
        return;
      }
      inputRef.current?.blur();
      Keyboard.dismiss();
      props.onVoicePress?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasContent, send, props.onVoicePress]);

    const onCameraPress = useCallback(() => {
      inputRef.current?.blur();
      Keyboard.dismiss();
      props.onPhotoPress?.();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.onPhotoPress]);

    // Camera is hidden once an image is attached or text is being typed (Compose).
    const showCameraButton = showPhoto && attachedImageUri === null && text.trim().length === 0;
    // With voice disabled there is no mic to fall back to, so the trailing button
    // only appears once there is something to send.
    const showTrailingButton = hasContent || showVoice;

    const sheetShape = floating
      ? { borderRadius: radius.xxl }
      : { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg };

    return (
      <Animated.View
        style={{
          backgroundColor: floating ? fadeColor : 'transparent',
          transform: [{ translateY: slide }],
        }}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <View
          style={{
            paddingHorizontal: floating ? FLOATING_HORIZONTAL_MARGIN : 0,
            paddingBottom: outerBottomPadding,
          }}
        >
          <Animated.View
            style={[
              sheetShape,
              {
                backgroundColor: surfaceColor,
                paddingHorizontal: 10,
                paddingTop: animatedTopInside,
                paddingBottom: sheetBottomPadding,
              },
            ]}
          >
            <View style={styles.row}>
              {showCameraButton ? (
                <CircleButton
                  size={buttonRow}
                  iconSize={actionIcon}
                  icon="camera"
                  accessibilityLabel="Camera"
                  onPress={onCameraPress}
                />
              ) : null}

              <SweepBorder
                width={AURA_WIDTH}
                radius={radius.lg}
                rotateMs={AURA_FLOW_MS}
                stops={AURA_STOPS}
                visible={auraOn}
                opacity={auraIntensity}
                idleColor={fieldBackgroundColor}
                style={[styles.fieldOuter, { minHeight: animatedButtonRow }]}
                innerStyle={[styles.field, { backgroundColor: fieldBackgroundColor }]}
              >
                {attachedImageUri !== null ? (
                  <View style={styles.thumbnailRow}>
                    <View style={styles.thumbnail}>
                      <Image
                        source={{ uri: attachedImageUri }}
                        resizeMode="cover"
                        style={styles.thumbnailImage}
                        accessibilityLabel="Attached photo"
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remove photo"
                        onPress={() => props.onRemoveAttachedImage?.()}
                        style={[
                          styles.thumbnailRemove,
                          { backgroundColor: c.surfaceSecondary },
                        ]}
                      >
                        <FcIcon name="close" size={14} tint={c.foregroundPrimary} />
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {props.onTextFieldTap ? (
                  // Launcher mode: placeholder only; the field never takes focus.
                  <Pressable
                    accessibilityRole="button"
                    onPress={props.onTextFieldTap}
                    style={styles.launcherTap}
                  >
                    <Animated.View style={{ opacity: placeholderOpacity }}>
                      <ShimmerText
                        key={displayedPlaceholder}
                        text={displayedPlaceholder}
                        numberOfLines={1}
                        style={typography.bodyMedium}
                        baseColor={placeholderBaseColor}
                        highlightColor={c.borderActive}
                        durationMs={COMPOSER_SHIMMER_PERIOD_MS}
                      />
                    </Animated.View>
                  </Pressable>
                ) : (
                  <View style={styles.inputWrap}>
                    {text.length === 0 ? (
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.placeholderOverlay, { opacity: placeholderOpacity }]}
                      >
                        <ShimmerText
                          key={displayedPlaceholder}
                          text={displayedPlaceholder}
                          numberOfLines={1}
                          style={typography.bodyMedium}
                          baseColor={placeholderBaseColor}
                          highlightColor={c.borderActive}
                          durationMs={COMPOSER_SHIMMER_PERIOD_MS}
                        />
                      </Animated.View>
                    ) : null}
                    <TextInput
                      ref={inputRef}
                      value={text}
                      onChangeText={setText}
                      multiline
                      // Compose: maxLines = 3, heightIn(min 24, max 72).
                      numberOfLines={3}
                      returnKeyType="done"
                      blurOnSubmit
                      autoCapitalize="sentences"
                      onSubmitEditing={() => inputRef.current?.blur()}
                      onFocus={() => {
                        setIsFocused(true);
                        props.onFocusChange?.(true);
                      }}
                      onBlur={() => {
                        setIsFocused(false);
                        props.onFocusChange?.(false);
                      }}
                      selectionColor={c.borderActive}
                      style={[
                        typography.bodyMedium,
                        styles.input,
                        { color: c.foregroundPrimary },
                      ]}
                    />
                  </View>
                )}
              </SweepBorder>

              {showTrailingButton ? (
                <CircleButton
                  size={buttonRow}
                  iconSize={actionIcon}
                  icon={hasContent ? 'send' : 'mic'}
                  accessibilityLabel={hasContent ? 'Send' : 'Voice'}
                  onPress={onTrailingPress}
                />
              ) : null}
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  fieldOuter: {
    flex: 1,
  },
  field: {
    flex: 1,
    paddingHorizontal: 14 - AURA_WIDTH,
    justifyContent: 'center',
  },
  inputWrap: {
    justifyContent: 'center',
  },
  placeholderOverlay: {
    position: 'absolute',
    pointerEvents: 'none',
    left: 0,
    right: 0,
  },
  input: {
    minHeight: 24,
    maxHeight: 72,
    padding: 0,
    // Android TextInput adds vendor padding that breaks the 24dp min-height baseline.
    textAlignVertical: 'center',
  },
  launcherTap: {
    minHeight: 24,
    justifyContent: 'center',
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: THUMBNAIL_GAP_BELOW,
    marginTop: 10,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
  },
  thumbnailImage: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
  },
  thumbnailRemove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
