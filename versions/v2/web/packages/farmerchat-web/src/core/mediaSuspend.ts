/**
 * Page-level "stop all live media" signal (web only).
 *
 * The SDK can be hidden while still mounted — the widget's closed panel, or a host that renders
 * `<FarmerChat inline active={false}>`. A hidden SDK must not keep the microphone open or keep
 * reading an answer aloud, so on suspend the voice recorder cancels (the half-recorded question is
 * discarded, never sent) and every playing clip / TTS answer pauses. Nothing resumes on its own.
 */
const listeners = new Set<() => void>();

export function onSuspendMedia(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function suspendMedia(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      // one failing listener never blocks the others
    }
  }
}
