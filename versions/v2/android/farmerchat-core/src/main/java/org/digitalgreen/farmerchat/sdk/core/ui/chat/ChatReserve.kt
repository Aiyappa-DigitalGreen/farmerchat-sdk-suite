package org.digitalgreen.farmerchat.sdk.core.ui.chat

/**
 * The chat thread's "reserve" rule, in core so the two Android UI flavours cannot drift on it.
 *
 * ## What the reserve is
 *
 * The last response reserves at least a viewport of height below the farmer's question, so the
 * question stays pinned at the top of the screen and the answer grows into the space beneath it
 * (ChatGPT-style) instead of `LazyColumn` / `RecyclerView` clamping its scroll and dragging the
 * question back toward the centre as text arrives.
 *
 * ## Why it lives here
 *
 * `android/CLAUDE.md`: state machines live in core, and the two flavours must not drift. This is
 * exactly that case — the app has one UI where the SDK has two, and the reserve is a rule about
 * state (`isStreaming` / `isLoading` / alignment), not about pixels. The height itself IS a pixel
 * concern and stays in each flavour (compose derives it from `LazyListLayoutInfo.viewportSize`,
 * views from the `RecyclerView`'s measured height).
 *
 * Three call sites read these two functions and nothing else decides the question:
 *  - compose `ChatScreen.kt` → `streamReserve`
 *  - compose `ChatScreen.kt` → the auto-scroll `LaunchedEffect`
 *  - views `ChatAdapter.holdsReserve` (which `ChatFragment`'s scroll anchor also calls)
 *
 * ## App parity, and the one place the SDK deliberately differs
 *
 * App source: `fc-compose-agentic` `ui/chat/component/ChatThreadContent.kt`, commit `9023b57f`,
 * whose predicate is `isLastResponse && (isStreaming || isInterrupted || !isLoading)`.
 *
 * The SDK keeps all three of those AND an alignment clause, because **`isLoading` does not mean
 * the same thing here as in the app**:
 *  - core sets `isLoading = true` for the whole duration of a stream
 *    ([ChatViewModel] `updateStreamingResponse`), where the app has already cleared it — so
 *    `isStreaming` is load-bearing, not redundant;
 *  - core keeps `isLoading` true for a blocking alignment surface on purpose, to hold every chip
 *    disabled — so the alignment clause is load-bearing too.
 *
 * Ported and reasoned through on 2026-09-08; see `docs/04-parity-matrix.md`
 * §"Re-baseline to `193dbd64`".
 */

/**
 * Whether this AI response holds the reserve.
 *
 * @param isLastResponse whether this is the newest AI response in the thread (the app's
 *   `message == lastAiResponse`) AND the thread's final row. A response that is not the newest
 *   never reserves, and neither does one with a question below it: an unanswered alignment
 *   surface stays the newest response while the farmer's typed follow-up is in flight, and its
 *   alignment clause would otherwise keep a second screenful of space above the new question and
 *   push the pin off it (2026-10-09, seen on the web widget).
 * @param isLoading `ChatState.isLoading`. The `!isLoading` term is what extends the reserve to a
 *   FINISHED short answer — without it the reserve collapsed the instant a stream settled and the
 *   thread jumped one last time. It is also the term that makes that safe: while a follow-up is in
 *   flight the PREVIOUS answer is still the newest one, and it must stay collapsed so it scrolls
 *   up out of the new question's way.
 */
fun ChatMessage.AiResponse.holdsChatReserve(isLastResponse: Boolean, isLoading: Boolean): Boolean =
    isLastResponse && (
        isStreaming ||
            isInterrupted ||
            !isLoading ||
            (alignmentKind != null && alignmentSelectedValues.isEmpty())
        )

/**
 * Index of the row the chat list should anchor to the top of its viewport on a new message.
 *
 * When the final row is an AI response holding the reserve, this is the row ABOVE it — the
 * farmer's question — because that is the whole point of the reserve. Otherwise it is the final
 * row (a just-sent question, or a loading placeholder), which is the ordinary scroll-to-bottom.
 *
 * ### Why the anchor has to be derived from the same predicate
 *
 * Both flavours re-scroll when the thread's tail changes (compose: the last message id, views: the
 * last row key) **or `isLoading`** changes, and core clears
 * `isLoading` exactly when a stream settles — so the scroll effect re-runs at the precise moment a
 * finished answer starts holding the reserve. Anchoring the answer's own row there would park the
 * viewport at the top of the reserved space and push the question off-screen: the jump commit
 * `28be342` ("reserve and auto-scroll were fighting") fixed for the streaming case, reappearing at
 * the settle transition. The app does not need this because it disables auto-scroll during
 * streaming altogether and only scrolls on a newly submitted follow-up.
 *
 * Note this deliberately keys on the FINAL row rather than on "the newest AI response": the anchor
 * may only shift when nothing is rendered below the reserve holder. If a question or placeholder
 * follows it, the ordinary bottom anchor is correct and the reserve (if any) is off-screen above.
 */
fun ChatState.chatScrollAnchorIndex(): Int {
    if (messages.isEmpty()) return 0
    val lastIndex = messages.lastIndex
    val last = messages[lastIndex]
    val lastHoldsSpace = when (last) {
        // A settled / streaming / interrupted answer holding the reserve.
        is ChatMessage.AiResponse ->
            last.holdsChatReserve(isLastResponse = true, isLoading = isLoading)
        // The full-height placeholder appended while an answer is in flight. It holds the SAME
        // screenful of space the reserve does — that is its entire job — so the anchor must treat
        // it the same way.
        //
        // Missing this was a real defect, and a subtle one. The follow-up flow appends
        // [question + LoadingPlaceholder], which changes `messages.size` and re-runs the scroll
        // effect: anchoring the PLACEHOLDER pushed the just-asked question off the top. Worse, it
        // then stuck, because replacing the placeholder with the streaming answer changes neither
        // `messages.size` nor `isLoading` — so the effect did not re-run and the viewport stayed
        // parked past the question for the whole stream. The app never has this problem: it
        // anchors the question explicitly and disables auto-scroll during streaming entirely.
        is ChatMessage.LoadingPlaceholder -> true
        else -> false
    }
    return if (lastHoldsSpace && lastIndex > 0) lastIndex - 1 else lastIndex
}
