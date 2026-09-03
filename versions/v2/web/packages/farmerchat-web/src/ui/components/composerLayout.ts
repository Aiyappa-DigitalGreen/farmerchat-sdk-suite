/**
 * Pure geometry + behaviour rules for the unified InputComposer (SDK 2.0.0).
 *
 * Every number is transcribed from the Compose reference
 * (`farmerchat-android-compose/.../components/InputComposer.kt`, "Composer geometry"
 * block) with dp read as CSS px — the two flavours must measure the same. Kept in a
 * plain `.ts` module with NO DOM access so `test/composer.test.ts` can execute it on
 * Node's native TypeScript support (no test framework in this package).
 */

/** Composer sizing for one mode. All values in CSS px (Compose dp 1:1). */
export interface ComposerMetrics {
  /** Padding above the button row, inside the composer sheet. */
  topInside: number;
  /** Height (and width) of the circular camera / mic-or-send buttons. */
  buttonRow: number;
  /** Icon size inside the camera / send buttons. */
  actionIcon: number;
  /** Icon size inside the mic button. */
  voiceIcon: number;
  /** Padding below the button row when the keyboard is closed. */
  atRestGap: number;
  /** Padding below the button row when the keyboard (IME) is open. */
  keyboardGap: number;
}

/** Standard (Home, and Chat at rest) sizing — InputComposer.kt Composer* constants. */
export const COMPOSER_STANDARD: ComposerMetrics = {
  topInside: 12,
  buttonRow: 48,
  actionIcon: 22,
  voiceIcon: 22,
  atRestGap: 12,
  keyboardGap: 12,
};

/** Compact sizing — InputComposer.kt Composer*Compact constants. */
export const COMPOSER_COMPACT: ComposerMetrics = {
  topInside: 10,
  buttonRow: 42,
  actionIcon: 20,
  voiceIcon: 20,
  atRestGap: 8,
  keyboardGap: 10,
};

/** Floating-mode geometry (Figma Home). */
export const COMPOSER_FLOATING = {
  /** Horizontal inset from the screen edges. */
  horizontalMargin: 10,
  /** Gap between the sheet bottom and the system nav inset. */
  bottomGap: 20,
  /** Gap between the sheet bottom and the keyboard when focused. */
  keyboardGap: 4,
  /** Sheet corner radius (Radius.XXL). */
  sheetRadius: 24,
} as const;

/** Anchored (non-floating) sheet: top corners only (Compose RoundedCornerShape(top = 16)). */
export const COMPOSER_ANCHORED_RADIUS = 16;

/** Inner text-field corner radius (Radius.LG). */
export const COMPOSER_FIELD_RADIUS = 16;

/** Horizontal padding inside the sheet, around the button row. */
export const COMPOSER_SHEET_PADDING_X = 10;

/** Horizontal padding inside the text field. */
export const COMPOSER_FIELD_PADDING_X = 14;

/** Gap between camera / field / mic-or-send. */
export const COMPOSER_ROW_GAP = 6;

/** Text field min / max height — Compose heightIn(min = 24, max = 72), maxLines = 3. */
export const COMPOSER_FIELD_MIN_HEIGHT = 24;
export const COMPOSER_FIELD_MAX_HEIGHT = 72;

/** Attached-image thumbnail size and its spacing (Compose PhotoThumbnail size = 64). */
export const COMPOSER_THUMB_SIZE = 64;
export const COMPOSER_THUMB_GAP = 5;
export const COMPOSER_THUMB_BOTTOM = 10;

/** Rotating-placeholder interval, and the crossfade each swap runs (Compose: delay(3000) + fade 400). */
export const PLACEHOLDER_ROTATE_MS = 3000;
export const PLACEHOLDER_FADE_MS = 400;

/** Duration of the standard <-> compact size morph (Compose tween(250)). */
export const COMPOSER_RESIZE_MS = 250;

/** Idle/active field background crossfade (Compose tween(220)). */
export const COMPOSER_FIELD_FADE_MS = 220;

/**
 * Compact sizing only applies when the caller asked for it AND the field is focused —
 * Compose `effectivelyCompact = compact && isFocused`. At rest a compact composer
 * therefore measures exactly like the standard one, which is why parent screens can
 * reserve scroll padding once, at the standard height, without the layout jumping.
 */
export function isEffectivelyCompact(compact: boolean, isFocused: boolean): boolean {
  return compact && isFocused;
}

/** The metrics actually in force for a (compact, focused) pair. */
export function composerMetrics(compact: boolean, isFocused: boolean): ComposerMetrics {
  return isEffectivelyCompact(compact, isFocused) ? COMPOSER_COMPACT : COMPOSER_STANDARD;
}

export interface ComposerBarHeightOptions {
  floating?: boolean;
  compact?: boolean;
  /** Field focus state; drives the compact morph. Defaults to false (at rest). */
  isFocused?: boolean;
  /**
   * The platform's bottom safe-area inset (Compose: `WindowInsets.navigationBars`).
   * Web reads it from `env(safe-area-inset-bottom)`; 0 on a desktop browser.
   */
  safeAreaBottom?: number;
}

/**
 * Height of the anchored composer bar at rest, measured from the bottom of the
 * viewport — the value Home and Chat use to reserve scroll padding so the last card
 * is not hidden behind the bar.
 *
 * Mirrors Compose `composerBarHeight()`: floating mode sits `max(inset, bottomGap)`
 * above the bottom edge rather than stacking the design gap on top of the inset.
 */
export function composerBarHeight(options: ComposerBarHeightOptions = {}): number {
  const { floating = false, compact = false, isFocused = false, safeAreaBottom = 0 } = options;
  const m = composerMetrics(compact, isFocused);
  const restingBottom = floating ? Math.max(safeAreaBottom, COMPOSER_FLOATING.bottomGap) : safeAreaBottom;
  return m.topInside + m.buttonRow + m.atRestGap + restingBottom;
}

/**
 * Bottom offset of a FLOATING sheet: `max(inset, bottomGap)` at rest, and a tight
 * `keyboardGap` while the keyboard is open (Compose consumes nav ∪ IME on the wrapper
 * then adds only the remainder).
 */
export function floatingBottomOffset(safeAreaBottom: number, isKeyboardVisible: boolean): number {
  if (isKeyboardVisible) return COMPOSER_FLOATING.keyboardGap;
  return Math.max(safeAreaBottom, COMPOSER_FLOATING.bottomGap);
}

/** Has the farmer put anything in the composer? Drives send-vs-mic and the active field tint. */
export function hasComposerContent(text: string, imageCount: number): boolean {
  return text.trim().length > 0 || imageCount > 0;
}

/**
 * Which action the right-hand button performs. Compose flips the icon on `hasContent`,
 * so an attached image alone (no text) already shows Send.
 */
export function composerActionKind(text: string, imageCount: number): 'send' | 'voice' {
  return hasComposerContent(text, imageCount) ? 'send' : 'voice';
}

/**
 * The camera button is hidden once there is an attachment or any typed text — Compose
 * guards it on `photoUris.isEmpty() && textFieldValue.text.isBlank()`. Note this uses
 * BLANK (not trimmed-empty content): a field holding only spaces still hides it.
 */
export function showCameraButton(text: string, imageCount: number): boolean {
  return imageCount === 0 && text.trim().length === 0;
}

/**
 * A single image per query — Compose renders `photoUris.take(1)`. Callers keep a list
 * for shape parity with Android, so the render path clamps rather than trusting it.
 */
export function visibleAttachments<T>(attachments: readonly T[]): T[] {
  return attachments.slice(0, 1);
}

/** Next index in the rotating-placeholder cycle. */
export function nextPlaceholderIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return (index + 1) % count;
}

/**
 * The placeholder currently shown. A rotation only happens with 2+ entries and only
 * while unfocused (Compose returns early from the LaunchedEffect otherwise); with no
 * list, or an empty one, the single `placeholder` string is used.
 */
export function resolvePlaceholder(
  placeholder: string,
  placeholders: readonly string[] | null | undefined,
  index: number,
): string {
  const list = placeholders && placeholders.length > 0 ? placeholders : null;
  if (!list) return placeholder;
  return list[index % list.length] ?? placeholder;
}

/** Whether the rotation timer should be running at all. */
export function shouldRotatePlaceholder(
  placeholders: readonly string[] | null | undefined,
  isFocused: boolean,
): boolean {
  return !!placeholders && placeholders.length >= 2 && !isFocused;
}
