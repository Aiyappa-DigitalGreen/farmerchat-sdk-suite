/**
 * Agentic (streaming) chat events for endpoint #27a
 * `api/chat/get_answer_for_text_query_agentic/` — **SDK 2.0.0 only**. The 1.0.0 path keeps the
 * synchronous #27 contract (root CLAUDE.md §3), and `enableAgenticChat` defaults to false, so a
 * host that does nothing is unaffected.
 *
 * TypeScript port of the Android v2 core
 * (`core/model/AgenticModels.kt` + the reader in `core/remote/AgenticChatDataSource.kt`).
 *
 * This module is deliberately **pure**: no fetch, no DOM, no React. It owns
 *  - the {@link AgenticEvent} discriminated union (same six variants as Kotlin's sealed class),
 *  - the payload field aliases,
 *  - {@link AgenticStreamDecoder} — the framing reader, fed plain strings,
 *  - {@link sanitizeAgenticStreamText} — the control-token scrubber.
 * Everything here is therefore unit-testable without a network or a browser.
 *
 * Event ordering observed by the app: `tool_call`/`tool_result` → `text_delta`* → `done` →
 * `metadata`. The stream finalizes on `metadata` (the richest payload). `done` is a NON-terminal
 * fallback used only if the stream ends WITHOUT a `metadata`, so the answer is never lost.
 *
 * ⚠ **The wire framing is not confirmed against a real stream.** A guest receives 0 bytes on
 * dev/stage/prod (agentic answers are likely gated on an OTP-verified user — docs/05). The reader
 * is therefore deliberately permissive, exactly like Android's: it accepts BOTH `data:`-prefixed
 * SSE framing and bare NDJSON, and resolves the event type from an SSE `event:` line when present,
 * else a `type`/`event` field inside the JSON.
 */

import type { TextPromptResponse } from './types';

/**
 * Why an agentic stream ended without a complete answer. Drives distinct error UI.
 *
 * - `NETWORK` connectivity drop mid-stream (fetch threw / socket closed).
 * - `SERVER`  non-2xx status or an error payload.
 * - `TOOL`    an MCP tool/action failed. **Reserved** — the current wire protocol has no
 *   tool-failure signal, so this is never emitted yet (parity with Android).
 * - `UNKNOWN` stream closed without a terminal event and no transport error was seen.
 */
export type StreamErrorKind = 'NETWORK' | 'SERVER' | 'TOOL' | 'UNKNOWN';

/** A tool the agent decided to invoke; `statusText` is a short human-readable progress label. */
export interface AgenticToolCallEvent {
  type: 'tool_call';
  name: string | null;
  statusText: string | null;
}

/** Result of a previously called tool; `statusText` is a short progress label. */
export interface AgenticToolResultEvent {
  type: 'tool_result';
  name: string | null;
  statusText: string | null;
}

/** Incremental chunk of the answer; accumulate these for live typing. */
export interface AgenticTextDeltaEvent {
  type: 'text_delta';
  delta: string;
}

/** Terminal event carrying the full response, follow-up questions and display flags. */
export interface AgenticMetadataEvent {
  type: 'metadata';
  response: TextPromptResponse;
}

/**
 * Non-terminal "done": generation finished. Carries the final answer and plain follow-up strings
 * but NOT the richer {@link TextPromptResponse} fields (message_id, follow-up ids). A `metadata`
 * normally follows and takes precedence; this is kept only as a fallback.
 */
export interface AgenticDoneEvent {
  type: 'done';
  answer: string | null;
  followUps: string[];
}

/** Transport/stream failure (connection dropped, non-2xx, malformed stream). */
export interface AgenticFailureEvent {
  type: 'failure';
  message: string | null;
  kind: StreamErrorKind;
}

export type AgenticEvent =
  | AgenticToolCallEvent
  | AgenticToolResultEvent
  | AgenticTextDeltaEvent
  | AgenticMetadataEvent
  | AgenticDoneEvent
  | AgenticFailureEvent;

// ---------------------------------------------------------------------------
// Payload field aliases (Gson @SerializedName(alternate = [...]) equivalents)
// ---------------------------------------------------------------------------

/** `text_delta`: backend variants name the incremental chunk differently. */
const DELTA_KEYS = ['delta', 'text', 'content', 'token', 'chunk'] as const;
/** `tool_call` / `tool_result` progress label. */
const STATUS_KEYS = ['status_text', 'statusText', 'status', 'label'] as const;
/** `done` final answer. */
const ANSWER_KEYS = ['answer', 'response', 'text', 'final_answer'] as const;
/** `done` follow-up questions. */
const FOLLOWUP_KEYS = ['followups', 'follow_ups', 'followUps', 'follow_up_questions'] as const;

type JsonObject = Record<string, unknown>;

/** First alias present as a non-empty string. Mirrors Gson picking the first matching name. */
function readAliasString(obj: JsonObject, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/**
 * Follow-ups as plain strings. The wire may send `["a","b"]` or
 * `[{question: "a", ...}]` (#27's `FollowUpQuestionOption` shape) — both collapse to strings,
 * because `AgenticDoneEvent` only carries the questions.
 */
function readAliasStringList(obj: JsonObject, keys: readonly string[]): string[] {
  for (const key of keys) {
    const value = obj[key];
    if (!Array.isArray(value)) continue;
    const out: string[] = [];
    for (const item of value) {
      if (typeof item === 'string') {
        if (item.length > 0) out.push(item);
      } else if (item && typeof item === 'object') {
        const question = (item as JsonObject)['question'];
        if (typeof question === 'string' && question.length > 0) out.push(question);
      }
    }
    return out;
  }
  return [];
}

/** `TOOL_CALL`, `tool_call` and `toolCall` all normalize to the same key. */
function normalizeType(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseJsonObject(data: string): JsonObject | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as JsonObject;
    return null;
  } catch {
    return null;
  }
}

/** Reads a `type` discriminator from inside the JSON payload when no SSE `event:` line came. */
function readTypeField(obj: JsonObject): string | null {
  const type = obj['type'];
  if (typeof type === 'string') return type;
  const event = obj['event'];
  if (typeof event === 'string') return event;
  return null;
}

/**
 * Maps one framed payload to an {@link AgenticEvent}, or null when it carries nothing usable
 * (a keep-alive, a section header, unparseable JSON).
 *
 * Exported for tests: the wire framing cannot be verified against a live stream yet (docs/05), so
 * this mapping is covered by unit tests instead. Faithful port of
 * `AgenticChatDataSource.parseEvent`.
 */
export function parseAgenticEvent(type: string | null | undefined, data: string): AgenticEvent | null {
  if (data.trim().length === 0) return null;
  const obj = parseJsonObject(data);
  if (!obj) return null;

  let normalized = normalizeType(type);
  if (normalized.length === 0) normalized = normalizeType(readTypeField(obj));

  switch (normalized) {
    case 'textdelta': {
      const delta = readAliasString(obj, DELTA_KEYS);
      return delta ? { type: 'text_delta', delta } : null;
    }
    case 'toolcall':
      return {
        type: 'tool_call',
        name: typeof obj['name'] === 'string' ? (obj['name'] as string) : null,
        statusText: readAliasString(obj, STATUS_KEYS),
      };
    case 'toolresult':
      return {
        type: 'tool_result',
        name: typeof obj['name'] === 'string' ? (obj['name'] as string) : null,
        statusText: readAliasString(obj, STATUS_KEYS),
      };
    case 'metadata':
      return { type: 'metadata', response: obj as unknown as TextPromptResponse };
    // Non-terminal fallback: the decoder does NOT stop here, so a following `metadata` still wins.
    case 'done':
      return {
        type: 'done',
        answer: readAliasString(obj, ANSWER_KEYS),
        followUps: readAliasStringList(obj, FOLLOWUP_KEYS),
      };
    default: {
      // Unknown / missing type: never silently drop a real answer. Some backend variants stream
      // the final response as a bare, typeless JSON object with no `event:`/`type` discriminator —
      // which would otherwise surface to the user as "Something went wrong". Recover it: a payload
      // carrying answer text or follow-ups is the terminal response; one carrying an incremental
      // chunk is a delta. Genuine section headers carry neither and correctly map to null.
      const response = obj['response'];
      const followUps = obj['follow_up_questions'];
      const hasAnswer = typeof response === 'string' && response.trim().length > 0;
      const hasFollowUps = Array.isArray(followUps) && followUps.length > 0;
      if (hasAnswer || hasFollowUps) {
        return { type: 'metadata', response: obj as unknown as TextPromptResponse };
      }
      const delta = readAliasString(obj, DELTA_KEYS);
      return delta ? { type: 'text_delta', delta } : null;
    }
  }
}

// ---------------------------------------------------------------------------
// Framing reader
// ---------------------------------------------------------------------------

/**
 * Incremental framing decoder: feed it decoded text, get back parsed events.
 *
 * Web-specific concern Android does not have: `ReadableStream` chunks are arbitrary byte slices,
 * so a JSON object — or even a single line — can be split across two reads. Everything after the
 * last `\n` of a chunk is therefore **retained** in {@link lineBuffer} and only completed by a
 * later chunk (or emitted by {@link flush} at EOF). Android gets this for free from okio's
 * `readUtf8Line()`.
 *
 * Accepted framings (both, permissively — see the module doc):
 * - SSE: `event: <name>` + one or more `data: <json>` lines, terminated by a blank line.
 * - NDJSON: one bare JSON object per line, dispatched immediately.
 */
export class AgenticStreamDecoder {
  /** Trailing partial line from the previous chunk (never yet terminated by `\n`). */
  private lineBuffer = '';
  private eventType: string | null = null;
  private dataBuffer = '';
  /** Latched once a terminal `metadata` event was emitted; further input is ignored. */
  private terminated = false;

  /** True once a terminal `metadata` event has been emitted. */
  get isTerminated(): boolean {
    return this.terminated;
  }

  /** Feeds one decoded chunk (any size, any boundary) and returns the events it completed. */
  feed(chunk: string): AgenticEvent[] {
    const out: AgenticEvent[] = [];
    if (this.terminated || chunk.length === 0) return out;
    this.lineBuffer += chunk;
    const lines = this.lineBuffer.split('\n');
    // The last element is whatever followed the final "\n" — possibly a partial line. Keep it.
    this.lineBuffer = lines.pop() ?? '';
    for (const line of lines) {
      // SSE permits CRLF; okio's readUtf8Line() strips it, so strip it here too.
      this.handleLine(line.endsWith('\r') ? line.slice(0, -1) : line, out);
      if (this.terminated) break;
    }
    return out;
  }

  /**
   * End of stream: completes the retained partial line and flushes a final event that was not
   * terminated by a trailing blank line (Android's post-loop `dispatch`).
   */
  flush(): AgenticEvent[] {
    const out: AgenticEvent[] = [];
    if (this.terminated) return out;
    const tail = this.lineBuffer;
    this.lineBuffer = '';
    if (tail.trim().length > 0) {
      this.handleLine(tail.endsWith('\r') ? tail.slice(0, -1) : tail, out);
    }
    if (!this.terminated) this.dispatch(out);
    return out;
  }

  private handleLine(line: string, out: AgenticEvent[]): void {
    // Event boundary: dispatch whatever has accumulated. `trim()` (not `length === 0`) so a
    // lone "\r" or an indented blank line still closes the event.
    if (line.trim().length === 0) {
      this.dispatch(out);
      return;
    }
    // SSE comment / keep-alive.
    if (line.startsWith(':')) return;
    // SSE event name.
    if (line.startsWith('event:')) {
      this.eventType = line.slice('event:'.length).trim();
      return;
    }
    // SSE data. Per the spec multiple data: lines in one event join with a newline (harmless
    // whitespace inside a JSON payload).
    if (line.startsWith('data:')) {
      if (this.dataBuffer.length > 0) this.dataBuffer += '\n';
      this.dataBuffer += line.slice('data:'.length).trim();
      return;
    }
    // Bare JSON object on its own line (NDJSON): dispatch immediately.
    if (line.trimStart().startsWith('{')) {
      const event = parseAgenticEvent(this.eventType, line.trim());
      this.eventType = null;
      this.dataBuffer = '';
      if (event) {
        out.push(event);
        if (event.type === 'metadata') this.terminated = true;
      }
      return;
    }
    // Any other non-blank line: continuation of the payload.
    this.dataBuffer += line;
  }

  /** Parses and emits one accumulated event, then resets the accumulator. */
  private dispatch(out: AgenticEvent[]): void {
    const data = this.dataBuffer;
    const type = this.eventType;
    this.dataBuffer = '';
    this.eventType = null;
    if (data.trim().length === 0) return;
    const event = parseAgenticEvent(type, data);
    if (!event) return;
    out.push(event);
    if (event.type === 'metadata') this.terminated = true;
  }
}

// ---------------------------------------------------------------------------
// Streamed-text sanitizer
// ---------------------------------------------------------------------------

const CONTROL_TOKEN_REGEX = /<<[^>]*>>/g;
const FOLLOWUPS_BLOCK_REGEX = /```followups[\s\S]*?```/g;

/**
 * Strips agentic control tokens that trail the streamed text but are absent from the clean
 * `metadata.response` — e.g. `<<commodities:chickpea>>` and a ```` ```followups ... ``` ````
 * block. Without this the farmer watches raw control tokens type themselves into the answer.
 *
 * Also cuts a still-streaming, not-yet-terminated token: mid-stream the text may end in a partial
 * `<<comm` or an unclosed fence, which must not be shown either.
 *
 * Port of `sanitizeAgenticStreamText` (Android `core/ui/chat/ChatViewModel.kt`).
 */
export function sanitizeAgenticStreamText(raw: string): string {
  let text = raw.replace(FOLLOWUPS_BLOCK_REGEX, '');
  text = text.replace(CONTROL_TOKEN_REGEX, '');
  const fenceStart = text.indexOf('```followups');
  if (fenceStart >= 0) text = text.slice(0, fenceStart);
  const tokenStart = text.indexOf('<<');
  if (tokenStart >= 0) text = text.slice(0, tokenStart);
  // Kotlin trimEnd() — trailing whitespace only.
  return text.replace(/\s+$/, '');
}

/**
 * Clean-up for a SETTLED agentic answer (terminal `metadata.response` or `done.answer`).
 *
 * The stage backend (mobile-app-stage, 2026-10-06) was observed leaking the control block into
 * `metadata.response`: a weather answer ended with a literal followups fence that the renderer
 * printed as raw text (Android v2 fix: `sanitizeAgenticFinalText`). Strips that block (closed, or
 * unclosed at the end) and complete `<<...>>` markers; unlike {@link sanitizeAgenticStreamText} it
 * does not cut at a lone `<<`. A pure trim on a clean answer.
 */
export function sanitizeAgenticFinalText(raw: string): string {
  let text = raw.replace(FOLLOWUPS_BLOCK_REGEX, '');
  text = text.replace(CONTROL_TOKEN_REGEX, '');
  const fenceStart = text.indexOf('```followups');
  if (fenceStart >= 0) text = text.slice(0, fenceStart);
  return text.replace(/\s+$/, '');
}
