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
 * Event ordering observed by the app: `tool_call`/`tool_result` → `text_delta`* → `done` →
 * `metadata`. The stream finalizes on [Metadata] (the richest payload). [Done] is a non-terminal
 * fallback used only if the stream ends WITHOUT a [Metadata], so the answer is never lost.
 */
sealed class AgenticEvent {

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
