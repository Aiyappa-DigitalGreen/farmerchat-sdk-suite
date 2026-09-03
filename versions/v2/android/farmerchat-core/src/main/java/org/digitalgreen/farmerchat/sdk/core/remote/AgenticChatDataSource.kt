package org.digitalgreen.farmerchat.sdk.core.remote

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okio.BufferedSource
import org.digitalgreen.farmerchat.sdk.core.model.AgenticDonePayload
import org.digitalgreen.farmerchat.sdk.core.model.AgenticEvent
import org.digitalgreen.farmerchat.sdk.core.model.AgenticStatusPayload
import org.digitalgreen.farmerchat.sdk.core.model.AgenticSurfacePayload
import org.digitalgreen.farmerchat.sdk.core.model.AgenticTextDeltaPayload
import org.digitalgreen.farmerchat.sdk.core.model.AgenticToolPayload
import org.digitalgreen.farmerchat.sdk.core.model.StreamErrorKind
import org.digitalgreen.farmerchat.sdk.core.model.TextPromptRequest
import org.digitalgreen.farmerchat.sdk.core.model.TextPromptResponse
import java.io.IOException

/**
 * Streams endpoint #27a (`api/chat/get_answer_for_text_query_agentic/`) as a flow of
 * [AgenticEvent]. **SDK 2.0.0 only** — 1.0.0 keeps the synchronous #27 path.
 *
 * Port of the app's `data/remote/AgenticChatDataSource.kt` (fc-compose-agentic @ c0524dd6).
 *
 * Transport, verified live 2026-09-02 on dev / stage / prod:
 * - The response is `Content-Type: text/event-stream`, `Transfer-Encoding: chunked`.
 * - The request must send `Accept: application/json`. The backend **406s**
 *   `Accept: text/event-stream`, which is why okhttp-sse is not used and the body is read
 *   line-by-line here instead.
 * - [client] must have **no read timeout** — agentic answers stream for a long time — so it can
 *   never be the ApiPriority timeout client. It still carries the auth interceptors, so
 *   `Authorization` and 401 refresh apply exactly as on every other call.
 *
 * **The framing is CONFIRMED against a real stream** (captured live from stage 2026-09-03,
 * docs/02 §#27a; the raw captures are checked in under `docs/captures/` and are fed through
 * [readEvents] verbatim by `AgenticCaptureReplayTest`). Real SSE: an `event:` line, a `data:`
 * line of JSON, blank-line separated. Seven event names: `status`, `tool_call`, `tool_result`,
 * `text_delta` (payload key `delta`), `surface`, `done` (NON-terminal) and `metadata` (last, and
 * terminal).
 *
 * The reader stays permissive beyond that — it also accepts bare NDJSON and resolves the event
 * type from a `type` field inside the JSON when no `event:` line came — because that costs
 * nothing and a dropped `text_delta` is a silently truncated answer.
 */
class AgenticChatDataSource internal constructor(
    private val client: OkHttpClient,
    private val gson: Gson,
    private val baseUrl: String
) {

    private val jsonMediaType = "application/json".toMediaType()

    fun stream(request: TextPromptRequest): Flow<AgenticEvent> = callbackFlow {
        val httpRequest = Request.Builder()
            .url(baseUrl.trimEnd('/') + "/" + ApiConstants.GET_TEXT_PROMPT_AGENTIC)
            // Must NOT be text/event-stream — the server 406s that. application/json passes
            // negotiation; the streaming view sets its own response Content-Type regardless.
            .header("Accept", "application/json")
            .post(gson.toJson(request).toRequestBody(jsonMediaType))
            .build()

        val call = client.newCall(httpRequest)
        // Capture the ProducerScope: inside the IO coroutine below `this` is the child scope, so
        // trySend/close must be invoked on the outer channel explicitly.
        val producer = this

        val readerJob = launch(Dispatchers.IO) {
            try {
                call.execute().use { response ->
                    if (!response.isSuccessful) {
                        producer.trySend(
                            AgenticEvent.Failure("HTTP ${response.code}", StreamErrorKind.SERVER)
                        )
                        producer.close()
                        return@use
                    }
                    val source = response.body?.source()
                    if (source == null) {
                        producer.trySend(
                            AgenticEvent.Failure("Empty agentic response body", StreamErrorKind.SERVER)
                        )
                        producer.close()
                        return@use
                    }

                    // `isActive` here is the READER coroutine's, so a cancelled collector stops
                    // the loop rather than draining the rest of the stream.
                    readEvents(source, isActive = { isActive }) { producer.trySend(it) }
                    // Close on EVERY exit, terminal `metadata` included. The previous version
                    // returned out of the reader on metadata and left the callbackFlow channel
                    // open, so the collector suspended until its scope was cancelled.
                    producer.close()
                }
            } catch (e: Exception) {
                // Collector cancelled (screen left): propagate, don't emit a spurious Failure.
                if (e is kotlinx.coroutines.CancellationException) throw e
                if (isActive) {
                    // A mid-stream throw is a transport problem (socket dropped, timeout, DNS).
                    val kind =
                        if (e is IOException) StreamErrorKind.NETWORK else StreamErrorKind.UNKNOWN
                    producer.trySend(AgenticEvent.Failure(e.message, kind))
                }
                producer.close(e)
            }
        }

        awaitClose {
            call.cancel()
            readerJob.cancel()
        }
    }

    /**
     * Reads the SSE / NDJSON framing off [source], handing every parsed event to [emit]. Returns
     * when the terminal `metadata` event has been emitted, when [isActive] goes false, or when the
     * source is exhausted.
     *
     * Internal so the CHECKED-IN captures (the two `.sse` files under `docs/captures/`) can be replayed through the real
     * reader byte-for-byte — see `AgenticCaptureReplayTest`. That is the strongest available test
     * of the framing and it only became possible once the stream was captured (2026-09-03).
     */
    internal fun readEvents(
        source: BufferedSource,
        isActive: () -> Boolean = { true },
        emit: (AgenticEvent) -> Unit
    ) {
        var eventType: String? = null
        val dataBuffer = StringBuilder()

        /** Parses + emits what has accumulated. Returns true once `metadata` went out. */
        fun flush(): Boolean {
            val event = parseEvent(eventType, dataBuffer.toString())
            eventType = null
            dataBuffer.setLength(0)
            if (event != null) emit(event)
            return event is AgenticEvent.Metadata
        }

        while (isActive()) {
            val line = source.readUtf8Line() ?: break
            when {
                // Event boundary: dispatch whatever has accumulated.
                line.isBlank() -> if (flush()) return
                // SSE comment / keep-alive.
                line.startsWith(":") -> Unit
                // SSE event name.
                line.startsWith("event:") -> eventType = line.substringAfter("event:").trim()
                // SSE data. Per the spec multiple data: lines in one event join with a
                // newline (harmless whitespace inside a JSON payload).
                line.startsWith("data:") -> {
                    if (dataBuffer.isNotEmpty()) dataBuffer.append('\n')
                    dataBuffer.append(line.substringAfter("data:").trim())
                }
                // Bare JSON object on its own line (NDJSON): dispatch immediately.
                line.trimStart().startsWith("{") -> {
                    dataBuffer.setLength(0)
                    dataBuffer.append(line.trim())
                    if (flush()) return
                }
                // Any other non-blank line: continuation of the payload.
                else -> dataBuffer.append(line)
            }
        }

        // Flush a final event not terminated by a trailing blank line.
        flush()
    }

    /** `TOOL_CALL`, `tool_call` and `toolCall` all normalize to the same key. */
    private fun normalizeType(raw: String?): String =
        raw.orEmpty().lowercase().filter { it.isLetterOrDigit() }

    /** Reads a `type` discriminator from inside the JSON payload when no SSE `event:` line came. */
    private fun readTypeField(data: String): String? = try {
        JsonParser.parseString(data)
            ?.takeIf { it.isJsonObject }
            ?.asJsonObject
            ?.let { o -> o.get("type") ?: o.get("event") }
            ?.takeIf { it.isJsonPrimitive }
            ?.asString
    } catch (_: Exception) {
        null
    }

    /**
     * Maps one `event:` name + `data:` JSON payload to an [AgenticEvent]. Visible for tests; the
     * checked-in captures pin every branch down to the exact live payloads (docs/02 §#27a).
     */
    internal fun parseEvent(type: String?, data: String): AgenticEvent? {
        if (data.isBlank()) return null
        val normalized = normalizeType(type).ifEmpty { normalizeType(readTypeField(data)) }
        return try {
            when (normalized) {
                "textdelta" ->
                    gson.fromJson(data, AgenticTextDeltaPayload::class.java)?.delta
                        ?.takeIf { it.isNotEmpty() }
                        ?.let { AgenticEvent.TextDelta(it) }

                // Progress ping. Emitted BEFORE the first delta on both live captures — the
                // only signal the farmer has during time-to-first-token (6.7 s on the capture).
                "status" -> gson.fromJson(data, AgenticStatusPayload::class.java)
                    ?.let { AgenticEvent.Status(it.stage) }

                // Alignment surface delivered mid-stream. `type` lives on the envelope while the
                // rest of the surface lives in `payload`, so lift it across: the result is
                // field-identical to `metadata.alignments` and both feed one rendering path.
                "surface" -> gson.fromJson(data, AgenticSurfacePayload::class.java)
                    ?.let { envelope ->
                        val payload = envelope.payload ?: return@let null
                        AgenticEvent.Surface(
                            id = envelope.id,
                            alignment = payload.copy(
                                type = payload.type ?: envelope.type
                            )
                        )
                    }

                "toolcall" -> gson.fromJson(data, AgenticToolPayload::class.java).let {
                    AgenticEvent.ToolCall(name = it?.name, statusText = it?.statusText)
                }

                "toolresult" -> gson.fromJson(data, AgenticToolPayload::class.java).let {
                    AgenticEvent.ToolResult(name = it?.name, statusText = it?.statusText)
                }

                "metadata" -> gson.fromJson(data, TextPromptResponse::class.java)
                    ?.let { AgenticEvent.Metadata(it) }

                // Non-terminal fallback: dispatch() does NOT stop here, so a following
                // `metadata` still wins.
                "done" -> gson.fromJson(data, AgenticDonePayload::class.java).let {
                    AgenticEvent.Done(answer = it?.answer, followUps = it?.followUps.orEmpty())
                }

                // Unknown / missing type: never silently drop a real answer. Some backend variants
                // stream the final response as a bare, typeless JSON object with no
                // `event:`/`type` discriminator — which would otherwise surface to the user as
                // "Something went wrong". Recover it: a payload carrying answer text or follow-ups
                // is the terminal response; one carrying an incremental chunk is a delta. Genuine
                // section headers carry neither and correctly map to null.
                else -> {
                    val full = runCatching {
                        gson.fromJson(data, TextPromptResponse::class.java)
                    }.getOrNull()
                    if (full != null &&
                        (!full.response.isNullOrBlank() || !full.follow_up_questions.isNullOrEmpty())
                    ) {
                        AgenticEvent.Metadata(full)
                    } else {
                        runCatching {
                            gson.fromJson(data, AgenticTextDeltaPayload::class.java)?.delta
                        }.getOrNull()
                            ?.takeIf { it.isNotEmpty() }
                            ?.let { AgenticEvent.TextDelta(it) }
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse agentic event type=$type", e)
            null
        }
    }

    private companion object {
        const val TAG = "FarmerChatAgentic"
    }
}
