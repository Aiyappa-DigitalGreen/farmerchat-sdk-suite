/**
 * Small pure decisions for the chat hook (useChat), kept out of React so they can be unit-tested.
 * Ported from the Android SDK (commit a689450): `SynthesisGuard.kt` and the host-callback sites
 * in `ChatViewModel.kt`.
 */

/** The parts of the chat state the synthesis guard reads. */
export interface SynthesisGuardState {
  isLoading: boolean;
  messages: ReadonlyArray<{ kind: string; messageId?: string | null }>;
}

/** The server message_id of the newest AI answer in the thread (undefined when there is none). */
export function latestAiMessageId(state: SynthesisGuardState): string | null | undefined {
  for (let i = state.messages.length - 1; i >= 0; i--) {
    if (state.messages[i].kind === 'ai') return state.messages[i].messageId ?? null;
  }
  return undefined;
}

/**
 * Whether a #31 synthesise_audio reply may still be played: only while no new answer is loading
 * and the newest AI answer is the same one as when the clip was requested
 * (`latestAtRequest` = {@link latestAiMessageId} read on the tap). Otherwise the farmer has moved
 * on (a new question, a follow-up chip) and the clip would play the OLD answer over the new turn.
 * The app has the same race; this drops a reply nobody can use (Android SynthesisGuard.kt).
 * Android's Listen always reads the newest answer, so it compares against the requested id; the
 * web pill passes the tapped answer's id, so comparing the newest id keeps Listen on an older
 * answer working while still dropping a reply that lands after a newer send.
 */
export function synthesisStillWanted(
  latestAtRequest: string | null | undefined,
  state: SynthesisGuardState,
): boolean {
  if (state.isLoading) return false;
  return latestAiMessageId(state) === latestAtRequest;
}

/**
 * `onMessageSent(text)` fires once per question the farmer sends, beside Send_Query_Initiated
 * (Android ChatViewModel: `pendingSendQueryProperties?.let { …; analytics.messageSent(q) }`).
 * A retry of the same question re-sends nothing new, so it does not fire again.
 */
export function firesMessageSent(opts: { retry?: boolean }): boolean {
  return opts.retry !== true;
}

/**
 * The thread after a photo send (app ChatViewModel.sendQuestionWithImage :1121-1149) or after its
 * retry (retryLastRequest :2160-2207, InputType.IMAGE). A first send appends the photo bubble and
 * a loading row. A retry keeps the thread — the farmer's photo bubble stays the ONE bubble (here
 * un-flagged, since the web marks it failed) — and appends only a new loading row, then re-runs
 * fetchPlantixResponse with `retry = true`.
 */
export function imageSendMessages<M extends { kind: string; id: string; isFailed?: boolean }>(
  messages: readonly M[],
  bubble: M,
  placeholder: M,
  retryOfUserMessageId?: string,
): M[] {
  if (retryOfUserMessageId === undefined) return [...messages, bubble, placeholder];
  return [
    ...messages.map((m) => (m.id === retryOfUserMessageId && m.kind === 'user' ? { ...m, isFailed: false } : m)),
    placeholder,
  ];
}
