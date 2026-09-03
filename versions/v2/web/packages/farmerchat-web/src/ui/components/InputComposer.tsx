/**
 * InputComposer (SDK 2.0.0) — the unified composer bar that replaces the separate
 * Photo / Speak / Type row plus text overlay with ONE bar:
 *
 *     [ camera ] [ ------- text field ------- ] [ mic | send ]
 *
 * Port of the Compose reference `components/InputComposer.kt`. Home renders it
 * floating (horizontal margins, 24px corners, drop shadow, decorative aura); Chat
 * renders it compact, so it shrinks on focus. Every measurable value comes from
 * `composerLayout.ts`, which transcribes the Kotlin geometry constants 1:1.
 *
 * Gated by the host on `config.enableAgenticChat`, exactly as Compose gates it on
 * `isComposerUi` — with the flag off the screens keep PrimaryInputButtons.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './common';
import {
  COMPOSER_ANCHORED_RADIUS,
  COMPOSER_FIELD_MAX_HEIGHT,
  COMPOSER_FIELD_PADDING_X,
  COMPOSER_FIELD_RADIUS,
  COMPOSER_FLOATING,
  COMPOSER_ROW_GAP,
  COMPOSER_SHEET_PADDING_X,
  COMPOSER_THUMB_SIZE,
  PLACEHOLDER_ROTATE_MS,
  composerActionKind,
  composerMetrics,
  hasComposerContent,
  nextPlaceholderIndex,
  resolvePlaceholder,
  shouldRotatePlaceholder,
  showCameraButton,
  visibleAttachments,
} from './composerLayout';

/** One attached image. A single attachment per query is allowed (Compose `photoUris.take(1)`). */
export interface ComposerAttachment {
  /** Object URL / data URL to preview. */
  url: string;
  /** Optional alt text; falls back to a generic label. */
  alt?: string;
  /**
   * The picked file itself. The composer never reads it — it is carried here so the owning screen
   * can hand it to image analysis (#28) on send, keeping the thumbnail and its bytes together.
   * Compose's equivalent is a `Uri` in `photoUris`, which is both preview and payload; the web
   * needs the `File` as well as the object URL, so both travel on this one object.
   */
  file?: File;
}

export interface InputComposerHandle {
  /** Focus the text field (Compose `onFocusRequest`). */
  focus: () => void;
  /** Replace the field's contents (Compose `onSetTextRequest`). */
  setText: (text: string) => void;
  /** Clear the field and drop focus (Compose `onClearRequest`). */
  clear: () => void;
}

export interface InputComposerProps {
  onSend: (text: string) => void;
  onPhotoClick?: () => void;
  onVoiceClick?: () => void;
  onFocusChange?: (focused: boolean) => void;
  /** Receives the imperative handle once mounted (mirrors Compose's request callbacks). */
  onReady?: (handle: InputComposerHandle) => void;
  /** Attached images. Only the first is rendered — one image per query. */
  attachments?: readonly ComposerAttachment[];
  onRemoveAttachment?: (index: number) => void;
  /** Static placeholder. */
  placeholder: string;
  /**
   * When supplied with 2+ entries the placeholder crossfades through the list every
   * ~3 s, paused while the field is focused. No reference screen supplies a list yet
   * (Compose Home passes a single label), so this normally stays dormant.
   */
  placeholders?: readonly string[] | null;
  /** Floating sheet: horizontal margins, all-corner radius, drop shadow. Home. */
  floating?: boolean;
  /** Shrinks the button row + internal padding once the field is focused. Chat. */
  compact?: boolean;
  /** When false the bar slides off-screen (Chat hides it while an answer generates). */
  visible?: boolean;
  /** Decorative flowing gradient ring around the idle field. Home only. */
  showAura?: boolean;
  /** aria-label for the camera button. */
  photoLabel?: string;
  /** aria-label for the mic button. */
  voiceLabel?: string;
  /** aria-label for the send button. */
  sendLabel?: string;
  /** aria-label for an attachment's remove button. */
  removeLabel?: string;
  /** Hides the camera button entirely (host disabled images). */
  enableImages?: boolean;
  /** Hides the mic button entirely; the button then always sends. */
  enableVoice?: boolean;
}

export function InputComposer(props: InputComposerProps) {
  const {
    onSend,
    onPhotoClick,
    onVoiceClick,
    onFocusChange,
    onReady,
    attachments = [],
    onRemoveAttachment,
    placeholder,
    placeholders = null,
    floating = false,
    compact = false,
    visible = true,
    showAura = false,
    enableImages = true,
    enableVoice = true,
  } = props;

  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  const shown = visibleAttachments(attachments);
  const imageCount = shown.length;
  const hasContent = hasComposerContent(text, imageCount);
  const action = composerActionKind(text, imageCount);
  const metrics = composerMetrics(compact, isFocused);
  // Compose: the field tints to its "reading" surface once focused OR holding content.
  const isFieldActive = isFocused || hasContent;

  // Rotating placeholder — 3 s interval, paused while focused, needs 2+ entries.
  const rotating = shouldRotatePlaceholder(placeholders, isFocused);
  useEffect(() => {
    if (!rotating) return;
    const count = placeholders?.length ?? 0;
    const timer = window.setInterval(() => {
      setPlaceholderIndex((i) => nextPlaceholderIndex(i, count));
    }, PLACEHOLDER_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [rotating, placeholders]);

  const displayedPlaceholder = resolvePlaceholder(placeholder, placeholders, placeholderIndex);

  // Auto-grow the field between min and max height (Compose heightIn(24, 72) / maxLines 3).
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_FIELD_MAX_HEIGHT)}px`;
  }, [text, metrics.buttonRow]);

  const focus = useCallback(() => areaRef.current?.focus(), []);
  const clear = useCallback(() => {
    setText('');
    setIsFocused(false);
    areaRef.current?.blur();
  }, []);
  const handle = useMemo<InputComposerHandle>(
    () => ({ focus, setText: (value: string) => setText(value), clear }),
    [clear, focus],
  );
  const readyRef = useRef<((h: InputComposerHandle) => void) | undefined>(onReady);
  readyRef.current = onReady;
  useEffect(() => {
    readyRef.current?.(handle);
  }, [handle]);

  const send = useCallback(() => {
    const value = text;
    if (!hasComposerContent(value, imageCount)) return;
    setIsFocused(false);
    areaRef.current?.blur();
    onSend(value);
    setText('');
  }, [imageCount, onSend, text]);

  const rootClass =
    'fcsdk-composer' +
    (floating ? ' fcsdk-composer--floating' : ' fcsdk-composer--anchored') +
    (visible ? '' : ' fcsdk-composer--hidden');

  return (
    <div className={rootClass}>
      <div
        className="fcsdk-composer-sheet"
        style={{
          paddingTop: metrics.topInside,
          paddingBottom: metrics.atRestGap,
          paddingLeft: COMPOSER_SHEET_PADDING_X,
          paddingRight: COMPOSER_SHEET_PADDING_X,
          borderRadius: floating
            ? COMPOSER_FLOATING.sheetRadius
            : `${COMPOSER_ANCHORED_RADIUS}px ${COMPOSER_ANCHORED_RADIUS}px 0 0`,
          marginLeft: floating ? COMPOSER_FLOATING.horizontalMargin : 0,
          marginRight: floating ? COMPOSER_FLOATING.horizontalMargin : 0,
        }}
      >
        <div className="fcsdk-composer-row" style={{ gap: COMPOSER_ROW_GAP }}>
          {enableImages && showCameraButton(text, imageCount) ? (
            <button
              type="button"
              className="fcsdk-composer-btn"
              style={{ width: metrics.buttonRow, height: metrics.buttonRow, fontSize: metrics.actionIcon }}
              aria-label={props.photoLabel ?? 'Camera'}
              onClick={() => {
                areaRef.current?.blur();
                onPhotoClick?.();
              }}
            >
              <span aria-hidden>{Icon.camera}</span>
            </button>
          ) : null}

          <div
            className={
              'fcsdk-composer-field' +
              (isFieldActive ? ' fcsdk-composer-field--active' : '') +
              (showAura && !isFocused ? ' fcsdk-composer-field--aura' : '')
            }
            style={{
              minHeight: metrics.buttonRow,
              borderRadius: COMPOSER_FIELD_RADIUS,
              paddingLeft: COMPOSER_FIELD_PADDING_X,
              paddingRight: COMPOSER_FIELD_PADDING_X,
            }}
            onClick={focus}
          >
            {imageCount > 0 ? (
              <div className="fcsdk-composer-thumbs">
                {shown.map((attachment, index) => (
                  <div
                    key={`${attachment.url}_${index}`}
                    className="fcsdk-composer-thumb"
                    style={{ width: COMPOSER_THUMB_SIZE, height: COMPOSER_THUMB_SIZE }}
                  >
                    <img src={attachment.url} alt={attachment.alt ?? ''} />
                    <button
                      type="button"
                      aria-label={props.removeLabel ?? 'Remove image'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveAttachment?.(index);
                      }}
                    >
                      <span aria-hidden>{Icon.close}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="fcsdk-composer-fieldrow">
              {text.length === 0 ? (
                <span
                  key={displayedPlaceholder}
                  className={'fcsdk-composer-placeholder' + (isFocused ? '' : ' fcsdk-composer-placeholder--shimmer')}
                  aria-hidden
                >
                  {displayedPlaceholder}
                </span>
              ) : null}
              <textarea
                ref={areaRef}
                className="fcsdk-composer-input"
                value={text}
                rows={1}
                aria-label={displayedPlaceholder}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => {
                  setIsFocused(true);
                  onFocusChange?.(true);
                }}
                onBlur={() => {
                  setIsFocused(false);
                  onFocusChange?.(false);
                }}
                onKeyDown={(e) => {
                  // Compose maps the IME Done action to "dismiss the keyboard"; on the
                  // web an Enter without Shift is the send gesture farmers expect, and
                  // Shift+Enter keeps the newline.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
            </div>
          </div>

          <button
            type="button"
            className="fcsdk-composer-btn"
            style={{
              width: metrics.buttonRow,
              height: metrics.buttonRow,
              fontSize: action === 'send' ? metrics.actionIcon : metrics.voiceIcon,
            }}
            aria-label={
              action === 'send' ? (props.sendLabel ?? 'Send') : (props.voiceLabel ?? 'Voice')
            }
            onClick={() => {
              if (action === 'send') {
                send();
                return;
              }
              areaRef.current?.blur();
              // With voice disabled by the host there is no mic to fall back to, so a
              // tap with an empty field is a no-op rather than an unhandled action.
              if (enableVoice) onVoiceClick?.();
            }}
          >
            <span aria-hidden>{action === 'send' ? Icon.send : enableVoice ? Icon.mic : Icon.send}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
