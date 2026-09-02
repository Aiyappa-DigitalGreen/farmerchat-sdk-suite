/**
 * Agentic streaming event model + wire parser for endpoint #27a
 * (`api/chat/get_answer_for_text_query_agentic/`). **SDK 2.0.0 only** — the 1.0.0 path keeps the
 * synchronous #27 contract (root CLAUDE.md §3).
 *
 * TypeScript port of the Android core's `core/model/AgenticModels.kt` +
 * `AgenticChatDataSource.parseEvent` (fc-compose-agentic @ c0524dd6). The transport lives in
 * `agenticStream.ts`; everything here is pure, synchronous and side-effect free so it can be
 * exercised without a device.
 *
 * The terminal `metadata` event reuses {@link TextPromptResponse} — its payload is
 * field-compatible — so the final UI state is built with exactly the same logic as the
 * non-agentic path.
 *
 * Event ordering observed by the app: `tool_call`/`tool_result` → `text_delta`* → `done` →
 * `metadata`. The stream finalizes on `metadata` (the richest payload). `done` is a non-terminal
 * fallback used only if the stream ends WITHOUT a `metadata`, so the answer is never lost.
 *
 * ⚠ The wire framing is NOT confirmed against a real stream (a guest receives 0 bytes on
 * dev/stage/prod — agentic answers are likely gated on an OTP-verified user). The reader is
 * therefore deliberately permissive: it accepts BOTH `data:`-prefixed SSE framing and bare
 * NDJSON, and resolves the event type from an SSE `event:` line when present, else a `type`
 * field inside the JSON. If the real framing differs, only {@link AgenticEventFramer} and
 * {@link parseAgenticEvent} change; the {@link AgenticEvent} contract holds.
 */
import type { TextPromptResponse } from './types';

// ---------------------------------------------------------------------------
// StreamErrorKind
// ---------------------------------------------------------------------------

/**
 * Why an agentic stream ended without a complete answer. Drives distinct error UI.
 *
 * - `NETWORK` connectivity drop mid-stream (transport error / unknown host).
 * - `SERVER`  non-2xx status or an error payload.
 * - `TOOL`    an MCP tool/action failed. **Reserved** — the current wire protocol has no
 *   tool-failure signal, so this is never emitted yet. It is the extension point for when the
 *   backend adds a `tool_error` event or an error field on `tool_result`.
 * - `UNKNOWN` stream closed without a terminal event and no transport error was seen.
 */
export const StreamErrorKinds = {
  NETWORK: 'NETWORK',
  SERVER: 'SERVER',
  TOOL: 'TOOL',
  UNKNOWN: 'UNKNOWN',
} as const;

export type StreamErrorKind = (typeof StreamErrorKinds)[keyof typeof StreamErrorKinds];

// ---------------------------------------------------------------------------
// AgenticEvent
// ---------------------------------------------------------------------------

/** A tool the agent decided to invoke. `statusText` is a short human-readable progress label. */
export interface AgenticToolCallEvent {
  type: 'tool_call';
  name: string | null;
  statusText: string | null;
}

/** Result of a previously called tool. `statusText` is a short progress label. */
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
 * Non-terminal "done": generation finished. Carries the final `answer` and plain follow-up
 * strings but NOT the richer {@link TextPromptResponse} fields (message_id, follow-up ids). A
 * `metadata` normally follows and takes precedence; this is kept only as a fallback.
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

/** Discriminated union of everything endpoint #27a can hand the consumer. */
export type AgenticEvent =
  | AgenticToolCallEvent
  | AgenticToolResultEvent
  | AgenticTextDeltaEvent
  | AgenticMetadataEvent
  | AgenticDoneEvent
  | AgenticFailureEvent;

// ---------------------------------------------------------------------------
// Payload field aliases
// ---------------------------------------------------------------------------

/**
 * `text_delta` payload aliases. The alternates cover backend variants that name the incremental
 * chunk differently, so live typing is never silently lost. Order matters — first match wins,
 * exactly like Gson's `@SerializedName(value=…, alternate=[…])`.
 */
export const TEXT_DELTA_KEYS = ['delta', 'text', 'content', 'token', 'chunk'] as const;

/** `tool_call` / `tool_result` status label aliases. */
export const TOOL_STATUS_KEYS = ['status_text', 'statusText', 'status', 'label'] as const;

/** `done` answer aliases. */
export const DONE_ANSWER_KEYS = ['answer', 'response', 'text', 'final_answer'] as const;

/** `done` follow-up list aliases. */
export const DONE_FOLLOWUP_KEYS = [
  'followups',
  'follow_ups',
  'followUps',
  'follow_up_questions',
] as const;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

/** First alias key holding a string. Mirrors Gson picking `value` then each `alternate`. */
function firstString(obj: JsonRecord, keys: readonly string[]): string | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string') return v;
  }
  return null;
}

/** First alias key holding an array; non-string entries are dropped (Gson would coerce/skip). */
function firstStringArray(obj: JsonRecord, keys: readonly string[]): string[] | null {
  for (const key of keys) {
    const v = obj[key];
    if (Array.isArray(v)) {
      return v.filter((e): e is string => typeof e === 'string');
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sanitizer
// ---------------------------------------------------------------------------

const CONTROL_TOKEN_REGEX = /<<[^>]*>>/g;
const FOLLOWUPS_BLOCK_REGEX = /```followups[\s\S]*?```/g;

/**
 * Strips agentic control tokens that trail the streamed text but are absent from the clean
 * `metadata.response` — e.g. `<<commodities:chickpea>>` and a ```` ```followups … ``` ```` block.
 * Without this the farmer watches raw control tokens type themselves into the answer.
 *
 * Also cuts a still-streaming, not-yet-terminated token: mid-stream the text may end in a partial
 * `<<comm` or an unclosed fence, which must not be shown either.
 *
 * Port of `sanitizeAgenticStreamText` (Android core ChatViewModel.kt:65) — same four steps in the
 * same order, then `trimEnd()`.
 */
export function sanitizeAgenticStreamText(raw: string): string {
  let text = raw.replace(FOLLOWUPS_BLOCK_REGEX, '');
  text = text.replace(CONTROL_TOKEN_REGEX, '');
  const fenceStart = text.indexOf('```followups');
  if (fenceStart >= 0) text = text.slice(0, fenceStart);
  const tokenStart = text.indexOf('<<');
  if (tokenStart >= 0) text = text.slice(0, tokenStart);
  return text.replace(/\s+$/, '');
}

// ---------------------------------------------------------------------------
// Event parsing
// ---------------------------------------------------------------------------

/** `TOOL_CALL`, `tool_call` and `toolCall` all normalize to the same key. */
export function normalizeAgenticType(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Reads a `type` discriminator from inside the JSON payload when no SSE `event:` line came. */
function readTypeField(parsed: unknown): string | null {
  const obj = asRecord(parsed);
  if (!obj) return null;
  const t = obj['type'];
  if (typeof t === 'string') return t;
  const e = obj['event'];
  return typeof e === 'string' ? e : null;
}

function textDeltaFrom(obj: JsonRecord): AgenticTextDeltaEvent | null {
  const delta = firstString(obj, TEXT_DELTA_KEYS);
  return delta !== null && delta.length > 0 ? { type: 'text_delta', delta } : null;
}

/**
 * Maps one framed payload to an {@link AgenticEvent}, or null when it carries nothing usable
 * (SSE keep-alive, a section header, unparsable JSON).
 *
 * @param type the SSE `event:` name when the stream sent one, else null.
 * @param data the raw JSON payload text for this event.
 */
export function parseAgenticEvent(
  type: string | null,
  data: string,
): AgenticEvent | null {
  if (data.trim().length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    // Not JSON: nothing to do. A partially-arrived line never reaches here — the framer
    // only dispatches complete lines / events.
    return null;
  }
  const obj = asRecord(parsed);
  if (!obj) return null;

  const normalized =
    normalizeAgenticType(type) || normalizeAgenticType(readTypeField(parsed));

  switch (normalized) {
    case 'textdelta':
      return textDeltaFrom(obj);

    case 'toolcall':
      return {
        type: 'tool_call',
        name: firstString(obj, ['name']),
        statusText: firstString(obj, TOOL_STATUS_KEYS),
      };

    case 'toolresult':
      return {
        type: 'tool_result',
        name: firstString(obj, ['name']),
        statusText: firstString(obj, TOOL_STATUS_KEYS),
      };

    case 'metadata':
      return { type: 'metadata', response: obj as TextPromptResponse };

    // Non-terminal fallback: the framer does NOT stop here, so a following `metadata` still wins.
    case 'done':
      return {
        type: 'done',
        answer: firstString(obj, DONE_ANSWER_KEYS),
        followUps: firstStringArray(obj, DONE_FOLLOWUP_KEYS) ?? [],
      };

    default: {
      // Unknown / missing type: never silently drop a real answer. Some backend variants stream
      // the final response as a bare, typeless JSON object with no `event:`/`type` discriminator
      // — which would otherwise surface to the user as "Something went wrong". Recover it: a
      // payload carrying answer text or follow-ups is the terminal response; one carrying an
      // incremental chunk is a delta. Genuine section headers carry neither and correctly map to
      // null.
      const full = obj as TextPromptResponse;
      const hasResponse =
        typeof full.response === 'string' && full.response.trim().length > 0;
      const hasFollowUps =
        Array.isArray(full.follow_up_questions) && full.follow_up_questions.length > 0;
      if (hasResponse || hasFollowUps) {
        return { type: 'metadata', response: full };
      }
      return textDeltaFrom(obj);
    }
  }
}

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

/**
 * Line-oriented framer that turns the #27a byte stream into {@link AgenticEvent}s.
 *
 * Deliberately permissive, mirroring the Android reader line-for-line:
 * - a blank line ends an SSE event and dispatches whatever accumulated;
 * - `:` starts an SSE comment / keep-alive and is ignored;
 * - `event:` sets the event name;
 * - `data:` appends to the payload (multiple `data:` lines join with `\n`, per the SSE spec —
 *   harmless whitespace inside a JSON payload);
 * - a bare `{…}` line is NDJSON and dispatches immediately;
 * - anything else non-blank is treated as a continuation of the payload.
 *
 * Feed it **complete lines only** (see the transport's cursor/tail buffering) and call
 * {@link flush} at EOF for a final event with no trailing blank line.
 */
export class AgenticEventFramer {
  private eventType: string | null = null;
  private dataBuffer = '';

  /** Feeds one complete line. Returns the event it produced, if any. */
  pushLine(rawLine: string): AgenticEvent | null {
    // readUtf8Line() strips CRLF on Android; do the same for a CRLF stream here.
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

    if (line.trim().length === 0) {
      // Event boundary: dispatch whatever has accumulated.
      const event = this.dispatch();
      this.reset();
      return event;
    }
    if (line.startsWith(':')) {
      // SSE comment / keep-alive.
      return null;
    }
    if (line.startsWith('event:')) {
      this.eventType = line.slice('event:'.length).trim();
      return null;
    }
    if (line.startsWith('data:')) {
      if (this.dataBuffer.length > 0) this.dataBuffer += '\n';
      this.dataBuffer += line.slice('data:'.length).trim();
      return null;
    }
    if (line.trimStart().startsWith('{')) {
      // Bare JSON object on its own line (NDJSON): dispatch immediately.
      const event = parseAgenticEvent(this.eventType, line.trim());
      this.reset();
      return event;
    }
    // Any other non-blank line: continuation of the payload.
    this.dataBuffer += line;
    return null;
  }

  /** Flushes a final event not terminated by a trailing blank line. */
  flush(): AgenticEvent | null {
    const event = this.dispatch();
    this.reset();
    return event;
  }

  private dispatch(): AgenticEvent | null {
    if (this.dataBuffer.length === 0) return null;
    return parseAgenticEvent(this.eventType, this.dataBuffer);
  }

  private reset(): void {
    this.eventType = null;
    this.dataBuffer = '';
  }
}
