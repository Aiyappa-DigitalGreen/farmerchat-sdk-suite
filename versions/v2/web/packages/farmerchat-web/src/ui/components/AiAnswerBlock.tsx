/**
 * AiAnswerBlock — client-side "typewriter" reveal for AI answers.
 *
 * IMPORTANT (honesty note): the FarmerChat backend returns the whole answer in a
 * single synchronous JSON response (docs/02 — chat replies are NOT streamed; no
 * SSE/WebSocket, per root CLAUDE.md §3). This reveal is a purely cosmetic
 * view-layer animation that re-renders a growing word-prefix of the
 * already-received markdown. It never touches useChat, the network or ChatState.
 * History and pre-generated answers pass `animate={false}` and render in full
 * immediately; only a fresh, newest answer animates once.
 *
 * Respects `prefers-reduced-motion`: when the user asks for reduced motion the
 * answer is revealed instantly (no reveal, no caret).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MarkdownText } from './markdown';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Split into "word + trailing whitespace" chunks so newlines / markdown survive a prefix cut. */
function revealChunks(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

export function AiAnswerBlock(props: {
  text: string;
  animate: boolean;
  onRevealComplete?: () => void;
  onRevealProgress?: () => void;
}) {
  const { text, animate } = props;
  // Decide once per (text, animate) whether this instance actually animates.
  const willAnimate = animate && !prefersReducedMotion() && text.trim().length > 0;

  const chunks = useMemo(() => revealChunks(text), [text]);
  const total = chunks.length;

  const [revealed, setRevealed] = useState(willAnimate ? 0 : total);
  const [finished, setFinished] = useState(!willAnimate);
  const [caretOn, setCaretOn] = useState(true);

  // Keep the latest callbacks without re-triggering the reveal timer.
  const completeRef = useRef(props.onRevealComplete);
  completeRef.current = props.onRevealComplete;
  const progressRef = useRef(props.onRevealProgress);
  progressRef.current = props.onRevealProgress;

  // Reveal timer. Keyed ONLY on the primitive `text` + `willAnimate` (never the
  // message object) so follow-ups/TTS state arriving mid-reveal cannot restart it.
  useEffect(() => {
    if (!willAnimate || total === 0) {
      setRevealed(total);
      setFinished(true);
      completeRef.current?.();
      return;
    }
    setRevealed(0);
    setFinished(false);
    // AiAnswer.kt: 35 ms / word, bounded so long answers never crawl (words-per-tick scales up).
    const intervalMs = 35;
    const maxDurationMs = 6000;
    const perTick = Math.max(1, Math.ceil((total * intervalMs) / maxDurationMs));
    let current = 0;
    const id = window.setInterval(() => {
      current = Math.min(current + perTick, total);
      setRevealed(current);
      progressRef.current?.();
      if (current >= total) {
        window.clearInterval(id);
        setFinished(true);
        completeRef.current?.();
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [text, willAnimate, total]);

  // Blinking caret while revealing (JS toggle; the caret glyph lives inline in
  // the growing markdown prefix so it always trails the last revealed word).
  useEffect(() => {
    if (finished) return;
    const id = window.setInterval(() => setCaretOn((c) => !c), 450);
    return () => window.clearInterval(id);
  }, [finished]);

  // Tap anywhere on the answer to skip the reveal and show the full text.
  const skip = useCallback(() => {
    setRevealed(total);
    setFinished(true);
    completeRef.current?.();
  }, [total]);

  const display = finished
    ? text
    : chunks.slice(0, revealed).join('').replace(/\s+$/, '') + (caretOn ? ' \u258C' : '');

  return (
    <div
      className={`fcsdk-ai-answer${finished ? '' : ' fcsdk-ai-answer--revealing'}`}
      onClick={finished ? undefined : skip}
    >
      <MarkdownText text={display} />
    </div>
  );
}
