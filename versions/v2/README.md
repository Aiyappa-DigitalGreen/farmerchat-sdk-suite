# v2.0.0 — Agentic streaming chat

A complete, self-contained SDK: `android/`, `ios/`, `react-native/`, `web/` in this folder are
buildable and publishable independently of v1.

Source of truth: **`/Users/Aiyappa/AndroidStudioProjects/fc-compose-agentic`** at **`0c8c740f`**
(branch `features/dev_v2.3`, merged from `origin/dev/v2.4`; was `c0524dd6` / app v4.1.2,
versionCode 107 — 21 commits newer as of 2026-09-03), which descends from the v1 source of truth
`fc-compose` @ `9f5e4ca` (v4.0.3). Same repo lineage, so v2 is a delta.

The chat/alignment part of the `c0524dd6 → 0c8c740f` delta is folded in: **43ba5de4** "no follow up
in case of chips" (an additive alignment surface suppresses the follow-up list) and the chat-history
`isAgentic` mirroring, which the SDK already had. The rest of that delta — auth agreement card, chip
colours, device/carrier user attributes, new labels — is tracked separately in
`docs/04-parity-matrix.md`.

## What v2 changes

Three things: two in chat, one on Home.

### 1. Chat streams

v1 froze this invariant in the root `CLAUDE.md` §3:

> Chat replies are synchronous JSON. Do not introduce streaming/SSE/WebSocket.

Correct for v1, wrong for v2. The guardrail is now scoped to 1.0.0 and lifted for the agentic
endpoint only. **Endpoint #27 is unchanged**, and `enableAgenticChat` defaults to `false`, so a
host on 2.0.0 artifacts that does nothing keeps v1 behaviour exactly.

| | v1 | v2 (opt-in) |
|---|---|---|
| Endpoint | `get_answer_for_text_query/` (#27) | `get_answer_for_text_query_agentic/` (#27a) |
| Transport | POST → one JSON reply | POST → `text/event-stream`, chunked |
| Timeouts | ApiPriority P1/P2/P3 | **none** — answers stream for minutes |
| Rendering | answer appears complete | accretes from `text_delta` events |

**Seven** wire events, confirmed against a live capture 2026-09-03 (docs/02 §#27a):
`status`, `tool_call`, `tool_result`, `text_delta`, `surface`, `done`, `metadata` — modelled as
`Status`, `ToolCall`, `ToolResult`, `TextDelta`, `Surface`, `Done`, `Metadata` plus a client-side
`Failure`. `status` and `surface` are handled on **android only**; ios/react-native/web still drop
them (docs/04).
`Metadata` is terminal and carries a `TextPromptResponse` — field-compatible with #27, so
finalization reuses the synchronous path and inherits its analytics, TTS gating and follow-ups
rather than reimplementing them.

### 2. The backend can answer with a surface instead of prose

`TextPromptResponse.alignments` carries a short prompt plus quick-reply chips, asking the farmer to
clarify, confirm, or respond to an escalation. Seven kinds; `gender-select` and `commodity-confirm`
are **additive** (they accompany a real answer), the rest **exclusive** (they replace it).

> An exclusive surface arrives with `response` **empty on purpose** — the prompt is
> `alignments.message`. Any client that treats a blank `response` as an error will show the farmer
> "Failed to get response" instead of the question.

### 3. Home has a mandatory policy-acceptance gate

New in app v4.1.2 and **absent from v1 entirely** (`fc-compose` has no
`policy_acceptance_status` anywhere). On every Home entry the app calls
`GET api/user/policy_acceptance_status/?user_id=…` (**#7a**); while `requires_acceptance` is true a
**non-cancellable** bottom sheet overlays Home until the farmer accepts through #7 `accept_terms`.
Swipe-down, back press and scrim taps are all rejected — the only exits are "Accept" and the
"Read terms" content screen's own accept CTA.

> This is **not** the Plotline-triggered `TermsOfUseDialog` already in the table below. The app's
> own comment (`HomeScreen.kt:331`) says the gate is "driven by GET policy_acceptance_status
> rather than a campaign card", and the two load different URLs: the gate uses
> `latest_policy_version.terms_of_service_url` from #7a, the dialog uses
> `farmerchat_terms_of_use` from #4. Both now exist on android and are independent.

Verified live on stage 2026-09-03 (guest token): 200 with the app's exact field set; no `user_id`
→ 400 `{"error":"user_id is required"}`. All seven of its label keys are served by #3 in **en, hi
and sw**. Details, deltas and the guest consequence: `docs/02` §Endpoint #7a and `docs/04`.

## Status

| Piece | android core | compose | views | ios | react-native | web |
|---|---|---|---|---|---|---|
| Agentic transport + events | ✅ | n/a | n/a | ✅ | ✅ | ✅ |
| Stream consumer + sanitizer | ✅ | n/a | n/a | ✅ | ✅ | ✅ |
| Streaming UI + stall hint + error card | n/a | ✅ | ✅ | ✅ SwiftUI | ✅ | ✅ |
| Alignment model + chip surfaces | ✅ | ✅ | ✅ | ✅ SwiftUI | ✅ | ✅ |
| `LocationChatBubble` | n/a | ✅ | ✅ | ✅ both | ✅ | ✅ |
| **Location bubble actually produced** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Capability chips** (`gps-prompt`, `upload-photo`) | ✅ | ✅ | ✅ | ✅ both | ✅ | ✅ |
| `InputComposer` wired into Home + Chat | n/a | ✅ | ✅ | ⛔ | ✅ | ✅ |
| Home agentic layout (surface, gradient, header) | n/a | ✅ | 🟡 header title only | ⛔ | 🟡 no sunbeams | 🟡 no sunbeams |
| `TermsOfUseDialog` (dismissible, #4) | n/a | ✅ | ⛔ | ⛔ | ✅ | ✅ |
| **Mandatory ToU gate** (#7a, blocking) | ✅ | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Settings "My Farm" | n/a | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| UIKit 2.0.0 UI | — | — | — | ✅ | — | — |

Until 2026-09-02 the `LocationChatBubble` row was ✅ on four platforms and **completely unreachable**
— every alignment chip sent its own text, so `gps-prompt` never ran the location flow and nothing
ever constructed the message the bubble renders. Hence the second row: a component that renders is
not a feature until something produces its input. See "The capability-chip gap" in `docs/04`.

`docs/04-parity-matrix.md` is the authoritative ledger for both versions.

## Not verified

**The wire framing has never been exercised.** The endpoint opens correctly — 200,
`text/event-stream`, chunked — but delivers **0 bytes to a guest on dev, stage and prod**. Agentic
answers are likely gated on an OTP-verified user or a server flag (`docs/05`).

Every platform's reader is therefore deliberately permissive: it accepts **both** `data:`-prefixed
SSE framing and bare NDJSON, and resolves the event type from an `event:` line when present, else
a `type` field in the JSON. If the real framing differs, only the reader changes — the event
contract holds.

Because the wire cannot be exercised, tests are the only guard:

| Platform | Tests |
|---|---|
| android | **43** unit tests — parser 14, sanitizer 9, `AlignmentKind` 5, alignment pick 3, capability chip 7, location outcome 5 |
| ios | **79** (`swift test`), including no-timeout session assertions, capability chip 12, location outcome 7 |
| web | **174** assertions (agentic 73, stream 12, alignment-pick 11, capability-chip 36, markdown 42), including a JSON object split one byte per chunk |
| react-native | 86 assertions, run out-of-tree — the package has no test runner (46 agentic/alignment + 40 capability-chip / location-outcome) |

**Nothing has run on a device or in a browser.** Everything is build- and test-verified only.

## Transport notes per platform

Each platform needed a different mechanism, and the differences are load-bearing:

- **web** — `fetch` + `response.body.getReader()`, **not** `EventSource`: EventSource cannot POST
  or set headers, and forces the `Accept` value the backend rejects with 406. Two-stage buffering —
  a streaming `TextDecoder` for multi-byte characters split across reads, plus a line buffer that
  retains the trailing fragment.
- **react-native** — `XMLHttpRequest` incremental mode; RN's `fetch` has no `response.body` at all.
  Caveat: `responseText` accumulates the whole response, and any buffering interposer (Flipper's
  network plugin, a buffering proxy) collapses it to one chunk so the answer lands at the end.
  Events still parse correctly.
- **ios** — a dedicated `URLSession` with a 7-day timeout, deliberately not built on
  `buildRequest`: a `URLRequest.timeoutInterval` overrides the session config and would have capped
  the stream at P3's 30 s.
- **android** — a dedicated OkHttp client with `readTimeout(0)`, skipping the ApiPriority and
  timeout interceptors whose entire job is imposing the deadlines that would cut a stream short.
  It keeps the auth interceptor and authenticator, so 401 refresh is unchanged.

`X-Timeout` and `X-Request-ID` are **not** sent on the stream on any platform. Root `CLAUDE.md` §3
lists `X-Timeout` as a header invariant; this is a deliberate, recorded exception — advertising a
timeout on a request that has none would be a lie.

## Known deviations from the app

- **No Plotline, MoEngage, Adjust or Firebase** (root `CLAUDE.md` §6). `PLabel` /
  `PlotlineConstants` hooks are stripped from `InputComposer`, and `TermsOfUseDialog`'s
  `AnalyticsManager` call is replaced by a plain `onAcceptAndContinue` callback — the host owns
  tracking, and events reach it through `config.onEvent`.
  The **mandatory ToU gate carries the identical deviation**: its sheet and content screen
  self-track five events through `AnalyticsManager` in the app, and in the SDK those five names
  are raised verbatim from the caller through `FarmerChatAnalytics` instead. The app's sixth,
  `Plotline_Accept_Terms_Click_Event` (`"ToS_Aug26_Accept_Terms"`), is **not** ported, and no
  Adjust tokens are. The app's timing quirk is kept — `Terms_Of_Use_Accept_Click_Event` fires on
  API success, not on the tap.
- **The gate fires for guests, and that is app behaviour, not an SDK bug.** `initialize_user`
  persists a `user_id` in both the app and the SDK; the app's guard skips only a *missing* one
  (`isBlank() || equals("null")`), which is ported literally, and the backend answers
  `requires_acceptance: true` for a guest token. A guest-only host (e.g. a `CHAT_ONLY` bootstrap
  that reaches Home) will therefore see the sheet.
- **iOS names the model `AlignmentSurface`**, not `Alignment`: `SwiftUI.Alignment` owns that name,
  and a public `Alignment` in Core made `FarmerChatFabButton` ambiguous for any host importing both
  modules. The wire key is still `alignments`.
- **The app's two Remote Config flags collapse to one.** The app has `getComposerUiEnabled()` and
  `getAgenticChatEnabled()`; the SDK exposes a single host switch, `enableAgenticChat`, read once
  because SDK config is immutable after `initialize()`.

## Building and publishing

Each tree is standalone. From `versions/v2/android`:

```bash
./gradlew :farmerchat-core:assembleDebug
./gradlew :farmerchat-core:testDebugUnitTest
./gradlew :farmerchat-core:publishToMavenLocal      # publishes 2.0.0
```

v1 and v2 resolve side by side, which is what lets a host choose:

```
farmerchat-core/1.0.0            farmerchat-core/2.0.0
farmerchat-android-views/1.0.0   farmerchat-android-views/2.0.0
```

See [../README.md](../README.md) for version selection, and note the standing cost of this layout:
the trees are independent copies, so **a fix in one does not reach the other.**
