# v2.0.0 — Agentic streaming chat

Source of truth: **`/Users/Aiyappa/AndroidStudioProjects/fc-compose-agentic`** at `c0524dd6`
(app v4.1.2, versionCode 107). That checkout descends from the v1 source of truth
(`fc-compose` @ `9f5e4ca`, v4.0.3) — same repo lineage, so v2 is a delta, not a rewrite.

## Scale of the change

```
104 commits, 83 files, +6,705 / −580   (9f5e4ca..c0524dd6, app/src/main)
309 → 322 Kotlin files
```

Most of it is one thing: **the chat transport changed.**

## The headline change: chat is no longer request/response

v1 froze this invariant in the root `CLAUDE.md` §3:

> Chat replies are synchronous JSON. Do not introduce streaming/SSE/WebSocket.

That was correct for v1 and is **wrong for v2**. The agentic endpoint streams. The guardrail is
lifted for 2.0.0 only — 1.0.0 keeps the synchronous contract, and a host that does not opt in
keeps request/response chat.

| | v1 (1.0.0) | v2 (2.0.0) |
|---|---|---|
| Endpoint | `api/chat/get_answer_for_text_query/` | `api/chat/get_answer_for_text_query_agentic/` |
| Transport | POST → one JSON reply | POST → `text/event-stream`, chunked |
| Client shape | `suspend fun → TextPromptResponse` | `fun → Flow<AgenticEvent>` |
| Timeouts | ApiPriority P1/P2/P3 | **no read timeout** — answers stream for a long time |
| Rendering | answer appears complete | answer accretes from `TextDelta` events |

## The event contract

Six events, from `domain/model/chat/AgenticEvent.kt`:

| Event | Carries | UI meaning |
|---|---|---|
| `ToolCall` | tool name + args | "looking up the weather…" — agent is working |
| `ToolResult` | tool output | that step finished |
| `TextDelta` | a text fragment | append to the answer as it arrives |
| `Metadata` | message/conversation ids | ids for TTS, follow-ups, feedback |
| `Done` | final payload | stream complete; enable actions |
| `Failure` | error | render `StreamErrorCard`, offer retry |

This contract is stable regardless of wire framing — only the reader changes if the framing does.

## ⚠ Wire framing is NOT yet verified

The app's own `AgenticChatDataSource` carries this note:

> NOTE: The exact wire framing should be confirmed against a real authenticated stream; if it
> differs, only `readStream`/`parseEvent` need to change.

**It still is not confirmed.** Probed live on 2026-09-02 against dev, stage and prod with a
freshly minted guest (language and location set, conversation created):

```
POST api/chat/get_answer_for_text_query_agentic/
  → HTTP 200
  → Content-Type: text/event-stream
  → Transfer-Encoding: chunked
  → body: 0 bytes on ALL THREE environments
```

So the transport is confirmed as SSE, but **no event has been observed on the wire**. The likely
explanation is that agentic answers require a signed-up (OTP-verified) user or a server-side
feature flag, not a guest — that needs confirming with the backend team.

What the app implements, and what the SDK will therefore implement as the conservative reading:

- Send `Accept: application/json` — **not** `text/event-stream`, which the backend 406s.
- Read the body line by line; accept **both** `data:`-prefixed SSE lines (blank line ends an
  event) and bare NDJSON (one JSON object per line).
- Resolve the event type from an SSE `event:` line when present, else a `type` field in the JSON.
- Use a dedicated OkHttp client with **no read timeout**, sharing the auth interceptors so token
  refresh still applies.

Tracked in [../../docs/05-open-questions.md](../../docs/05-open-questions.md).

## Beyond chat

New UI in the same delta, to port after the transport works:

| Component | Purpose |
|---|---|
| `InputComposer` | reworked chat input |
| `LocationChatBubble` | location shown as a chat bubble |
| `Chip` | agentic status chips (selected / skipped / available / none) |
| `StreamErrorCard` | mid-stream failure with retry |
| `TermsOfUseDialog` | terms acceptance as a dialog |
| `ShimmerText`, `Sunbeams`, `SectionHeader`, `LocationButton`, `AlignmentSurface` | supporting visuals |

## Plan

1. **Docs first** (root `CLAUDE.md` §3, `docs/02`, `docs/03`) — lift the sync-only rule for 2.0.0
   and document the agentic endpoint and event contract. *Docs before code is the project rule.*
2. **Confirm the wire format** with the backend team, or capture a real authenticated stream.
3. **Android** (`farmerchat-core` + `farmerchat-android-views`) behind a config flag.
4. **Verify on device** in RationSmart — the only host with a real integration.
5. **Port** to iOS, React Native and Web against the proven implementation.
6. **Update `docs/04`** honestly, including anything that does not make it.

Android goes first because it is the only platform that is device-verified and the only one with a
real host consuming it. iOS, RN and Web also still carry the label-key bug that stops them
localizing at all (`docs/04`), which is worth weighing against agentic parity.
