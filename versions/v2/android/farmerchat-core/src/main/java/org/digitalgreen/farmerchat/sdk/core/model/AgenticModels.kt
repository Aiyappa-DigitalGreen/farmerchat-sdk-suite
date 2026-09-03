package org.digitalgreen.farmerchat.sdk.core.model

import com.google.gson.annotations.SerializedName

/**
 * Events streamed from the agentic text-query endpoint (#27a,
 * `api/chat/get_answer_for_text_query_agentic/`). **SDK 2.0.0 only** — the 1.0.0 path keeps the
 * synchronous #27 contract (root CLAUDE.md §3).
 *
 * Port of the app's `domain/model/chat/AgenticEvent.kt` (fc-compose-agentic @ c0524dd6).
 *
 * The terminal [Metadata] event reuses [TextPromptResponse] — its payload is field-compatible —
 * so the final UI state is built with exactly the same logic as the non-agentic path.
 *
 * **Event ordering, captured live from stage 2026-09-03** (docs/02 §#27a, raw captures under
 * `docs/captures/`) — SEVEN event names, not the six the app handles:
 *
 * - prose answer: `status` → `tool_call` → `tool_result` → `text_delta`×9 → `done` → `surface`
 *   → `metadata`
 * - alignment surface: `status` → `surface` → `done` → `metadata`
 *
 * `metadata` arrives LAST and is the terminal event; [Done] is a non-terminal fallback used only
 * if the stream ends WITHOUT a [Metadata], so the answer is never lost. [Status] and [Surface] are
 * ahead of the app, which drops both into its typeless fallback.
 */
sealed class AgenticEvent {

    /**
     * Progress ping (`event: status`, payload `{"stage": "thinking"}`) — the FIRST event on both
     * live captures, well before any `text_delta`. Surfaced the same way as
     * [ToolCall.statusText]: it turns the loading placeholder into a live bubble so the farmer sees
     * activity immediately instead of a bare spinner (time-to-first-delta was 6.7 s on the
     * captured prose answer).
     *
     * [stage] is a machine token, never shown raw — the ViewModel maps it to a LabelManager
     * string.
     */
    data class Status(val stage: String?) : AgenticEvent()

    /**
     * An alignment surface delivered MID-STREAM (`event: surface`, payload `{id, type, payload}`).
     * The same surface arrives again on the terminal `metadata.alignments`; rendering on this
     * event is what stops a blocking question from waiting for the whole stream.
     *
     * [alignment] is the `payload` object with its `type` lifted in from the envelope (the payload
     * itself carries no `type`), so it is field-identical to `metadata.alignments`.
     */
    data class Surface(val id: String?, val alignment: Alignment) : AgenticEvent()

    /** A tool the agent decided to invoke. [statusText] is a short human-readable progress label. */
    data class ToolCall(val name: String?, val statusText: String?) : AgenticEvent()

    /** Result of a previously called tool. [statusText] is a short progress label. */
    data class ToolResult(val name: String?, val statusText: String?) : AgenticEvent()

    /** Incremental chunk of the answer; accumulate these for live typing. */
    data class TextDelta(val delta: String) : AgenticEvent()

    /** Terminal event carrying the full response, follow-up questions and display flags. */
    data class Metadata(val response: TextPromptResponse) : AgenticEvent()

    /**
     * Non-terminal "done": generation finished. Carries the final [answer] and plain follow-up
     * strings but NOT the richer [TextPromptResponse] fields (message_id, follow-up ids). A
     * [Metadata] normally follows and takes precedence; this is kept only as a fallback.
     */
    data class Done(val answer: String?, val followUps: List<String>) : AgenticEvent()

    /** Transport/stream failure (connection dropped, non-2xx, malformed stream). */
    data class Failure(
        val message: String?,
        val kind: StreamErrorKind = StreamErrorKind.UNKNOWN
    ) : AgenticEvent()
}

/**
 * Why an agentic stream ended without a complete answer. Drives distinct error UI.
 *
 * - [NETWORK] connectivity drop mid-stream (IOException / timeout / unknown host).
 * - [SERVER]  non-2xx status or an error payload.
 * - [TOOL]    an MCP tool/action failed. **Reserved** — the current wire protocol has no
 *   tool-failure signal, so this is never emitted yet. It is the extension point for when the
 *   backend adds a `tool_error` event or an error field on `tool_result`.
 * - [UNKNOWN] stream closed without a terminal event and no transport error was seen.
 */
enum class StreamErrorKind { NETWORK, SERVER, TOOL, UNKNOWN }

/**
 * `text_delta` payload. The `alternate` names cover backend variants that name the incremental
 * chunk differently, so live typing is never silently lost.
 */
data class AgenticTextDeltaPayload(
    @SerializedName(value = "delta", alternate = ["text", "content", "token", "chunk"])
    val delta: String?
)

/**
 * `status` payload. Live value: `{"stage": "thinking"}`.
 */
data class AgenticStatusPayload(
    @SerializedName(value = "stage", alternate = ["status", "state", "phase"])
    val stage: String?
)

/**
 * `surface` payload envelope: `{"id": "srf_…", "type": "gps-prompt", "payload": {…}}`.
 *
 * [payload] deliberately deserializes into [Alignment] — the surface payload and
 * `metadata.alignments` are the same object except that `alignments` carries `type` inline while
 * here it sits on the envelope. The reader copies it across so both paths produce one shape.
 */
data class AgenticSurfacePayload(
    @SerializedName("id")
    val id: String? = null,
    @SerializedName("type")
    val type: String? = null,
    @SerializedName("payload")
    val payload: Alignment? = null
)

/** `tool_call` / `tool_result` payload. */
data class AgenticToolPayload(
    @SerializedName("name")
    val name: String?,
    @SerializedName(value = "status_text", alternate = ["statusText", "status", "label"])
    val statusText: String?
)

/**
 * `done` payload (fallback terminal — see [AgenticEvent.Done]). The real payload carries far more
 * (model, trace, metrics); only the answer and follow-ups are needed to finalize when `metadata`
 * never arrives.
 */
data class AgenticDonePayload(
    @SerializedName(value = "answer", alternate = ["response", "text", "final_answer"])
    val answer: String?,
    @SerializedName(value = "followups", alternate = ["follow_ups", "followUps", "follow_up_questions"])
    val followUps: List<String>? = null
)
