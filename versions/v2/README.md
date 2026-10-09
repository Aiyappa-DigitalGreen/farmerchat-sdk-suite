# v2 (2.2.0) — Agentic streaming chat

A complete, self-contained SDK: `android/`, `ios/`, `react-native/`, `web/` in this folder are
buildable and publishable independently of v1.

## Current state — 2026-10-09

- **Version 2.2.0 on every platform.** Android core/compose/views, iOS (`FarmerChatSDK.version`,
  podspec, tag `ios-v2.2.0`), React Native, the web SDK and the web widget all report 2.2.0,
  including lockfiles and the packaged examples.
- **Reference app:** `fc-compose-agentic`, origin `dev/v2.5` @ `393c5bb0`. A local checkout at
  `31a789e0` differs only in `useChips`; the SDKs follow origin.
- **Answers stream.** Stage streams the agentic answer (`status`, then `text_delta` chunks) only
  when `TextPromptRequest.streaming_required` is true. Every platform now sends the selected
  language's flag (language API `streaming_required`, default true), persisted as
  `fc_sdk_is_streaming_required`, as the app does. Verified live: the widget types the answer out.
- **Chat screen re-synced with the app line by line** (padding 20/20, inline error under the
  failed question, follow-ups inside the answer, stream error card, alignment surfaces, spinner,
  header, scroll indicator, composer shimmer). The web emulates Android's ~1% narrower text so
  lines break where the app breaks them.
- **The latest question is pinned to the top** while its answer grows below, on every platform
  (Android and web already did this; iOS and React Native were ported).
- **Web widget:** live at https://farmerchat-sdk-suite-production.up.railway.app (see `web/widget/README.md` for
  the Railway deploy and the streaming replay switch). Mouse-wheel scrolling on Home was fixed.
- **Showcase site:** https://farmerchat-sdk-suite-production.up.railway.app/ links the full-page web app
  (`/app/`, source `web/demo-app/`), the widget demo (`/demo/`) and the guide. The public stage proxy
  refuses the OTP endpoints, so the hosted demos are guest-only.
- **Integration guide:** live at https://farmerchat-sdk-suite-production.up.railway.app/guide/ — the same
  page as the shared Claude artifact, served by `web/railway/server.mjs` from `web/railway/guide/index.html`.
- **Chat-only by default, keys built in (all platforms).** `mode` defaults to `CHAT_ONLY` (only the
  language button in the chat bar — history is hidden unless `showHistory: true` — and a fresh
  conversation per journey); `FULL_JOURNEY` still works.
  A first-time user picks a language once on the language screen, then lands in chat (skipped when
  the host sets `languageCode`).
  `guestApiKey` was renamed `farmerChatApiKey` (no alias), and it and `geoApiKey` are built in.
- **Verification:** web is checked in a browser against stage. Android is checked on the emulator
  (two-question pinning). iOS and React Native are build- and test-verified only.
  `docs/04-parity-matrix.md` has the per-change detail.

Source of truth: **`/Users/Aiyappa/AndroidStudioProjects/fc-compose-agentic`** at **`919e5b2f`**
(re-baselined 2026-09-21 from `1b0553d2`; the 13-commit `1b0553d2..919e5b2f` delta — composer
photo-strip padding, app-bar corner radii, two Home scroll fixes, the 52dp Home bar and its round
weather pill, fully-opaque peeking tip cards, the Share button's accent sweep border, and markdown
answer cards — is ported and its per-platform gaps are recorded in `docs/04-parity-matrix.md`.)
Before that **`1b0553d2`** (re-baselined 2026-09-17 from `193dbd64`; the `cbfdcff8..1b0553d2`
delta — tip card height, related-questions fade, the language-screen legal paragraph, the Home
fixed header, and row-card markdown tables).
**All of it landed in `versions/v2/` only; the root `android/ ios/ react-native/ web/` trees are
the 1.0.0 line.** Previously **`193dbd64`**
(branch `features/dev_v2.3`, merged from `origin/dev/v2.4`; was `0c8c740f` — 17 commits newer as
of 2026-09-08, app still v4.1.3 / versionCode 108), which descends from the v1 source of truth
`fc-compose` @ `9f5e4ca` (v4.0.3). Same repo lineage, so v2 is a delta.

### The `0c8c740f → 193dbd64` delta (re-baselined 2026-09-08)

Eight app files, +143/−33 — all UI polish and copy, no new endpoint and no new wire field. What
landed where:

| App change | Commit | SDK |
|---|---|---|
| 2 new label keys (`agreement_card_info_text`, `auth_consent_suffix`) | `2a5cf2b8` `ae37b28e` | ✅ android v2 core `Labels.kt`. **NOT probed against #3** — no API key in this tree; listed as an ask in `docs/05` |
| Agreement card: 3 bullets → 2 + italic attribution line | `2a5cf2b8` | ✅ both android v2 flavours. ⛔ ios / react-native / web (the whole card was already a recorded gap) |
| Consent copy: trailing `"."` → `AUTH_CONSENT_SUFFIX` sentence; link span takes the body colour | `ae37b28e` | ✅ both android v2 flavours. The theme-aware body colour and the label-resolved legal title were **already** correct in the SDK — the app caught up to us there |
| Auth phone column scrolls + `navigationBarsPadding()` | `7e968df3` `b72ea4da` | ✅ compose: the SDK already scrolled (one level up, so OTP scrolls too); the missing half was the nav-bar inset, added as `WindowInsets.ime.union(navigationBars)` so it cannot double-count with `imePadding()`. Views already scrolls via `ScrollView` |
| Chat composer shows the idle aura (`showAura = true`) | `2a5cf2b8` | ✅ compose **already did this** — it was a requested divergence and the app has now converged on it (though compose's aura drew an empty path until the 2026-10-06 `addOutline` fix). ✅ views now draws it too (`ComposerAuraDrawable`) |
| Chat reserve: viewport-derived height, and held for a FINISHED short answer (`!isLoading`) | `9023b57f` `89f9ed17` | ✅ both android v2 flavours, **plus the matching auto-scroll anchor change the SDK needs and the app does not** — see below. ⛔ ios / react-native / web (no reserve there) |
| Scroll-down indicator suppressed inside the reserve | `9023b57f` | ⛔ the SDK has no scroll-down indicator in compose at all — recorded in `docs/04`, not invented here |
| Failed-last-message reserve | `9023b57f` | ⛔ the SDK renders its error card outside the message list, so the app's collapse cannot occur — recorded in `docs/04` |
| Home: backfill the location pill's place name from the user profile | `b72ea4da` | ✅ android core (both flavours) + ios + react-native; 🟡 web (no Home-entry profile fetch — see `docs/04`). Ported with a **rewritten rationale**: the app is repairing its own V1→V2 upgrade, a premise that is false for the SDK |
| Language screen legal intro now names the AI | `b72ea4da` | ✅ android v2 both flavours, react-native, web, ios |

**The reserve change needed a companion fix on the SDK that the app did not need.** The app
deliberately disables auto-scroll during streaming and only scrolls when a new follow-up question
is submitted. The SDK instead re-scrolls whenever `state.messages.size` **or `state.isLoading`**
changes — and core clears `isLoading` exactly when a stream settles. So the moment a finished
answer started holding a viewport of reserve, the SDK's own auto-scroll would have parked the
viewport at the top of that reserve and pushed the question off-screen: the very jump commit
`28be342` ("reserve and auto-scroll were fighting") had just fixed, moved to the settle
transition. Both flavours now anchor the row above **whichever** row holds the reserve.

The rule itself lives in **core** — `farmerchat-core/.../ui/chat/ChatReserve.kt`, exposing
`AiResponse.holdsChatReserve(isLastResponse, isLoading)` and `ChatState.chatScrollAnchorIndex()`.
It started as three copies of one boolean held in step by comment, which is the drift
`android/CLAUDE.md` explicitly forbids; all four call sites now read the core functions and only
the reserve *height* is per-flavour (compose from `LazyListLayoutInfo.viewportSize`, views from the
`RecyclerView`'s measured height). `ChatReserveTest` (13 tests) pins the predicate and the anchor,
including that they agree across the whole `isLoading` × `isStreaming` grid — a disagreement
between them is precisely what the blank-thread bug was.

Note also that `isLoading` does **not** mean the same thing in the SDK as in the app: core sets it
`true` for the whole duration of a stream and keeps it true for a blocking alignment surface on
purpose. So `isStreaming` and the alignment clause stay load-bearing in the SDK predicate where
the app's `!isLoading` alone would have been enough.

**Found while checking, not part of the app delta:** views dropped the reserve entirely for an
exclusive alignment surface (`minimumHeight = 0`), where both compose and the app keep it — so a
surface arriving after a streamed answer collapsed the thread upward. Fixed; recorded in
`docs/04`.

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

**Update 2026-10-09: the wire has now been exercised on stage.** A guest gets a real stream:
`event:` + `data:` SSE frames, with `status`, `tool_call` / `tool_result` (when tools run),
`text_delta`, `surface`, `done` and `metadata`. The text deltas come only when the request carries
`streaming_required: true` (see "Current state"). The web widget renders it live. The notes below
are kept for history; the empty-stream finding was from before that.

**(Historical) The wire framing has never been exercised.** The endpoint opens correctly — 200,
`text/event-stream`, chunked — but delivers **0 bytes to a guest on dev, stage and prod**. Agentic
answers are likely gated on an OTP-verified user or a server flag (`docs/05`).

Every platform's reader is therefore deliberately permissive: it accepts **both** `data:`-prefixed
SSE framing and bare NDJSON, and resolves the event type from an `event:` line when present, else
a `type` field in the JSON. If the real framing differs, only the reader changes — the event
contract holds.

Because the wire cannot be exercised, tests are the only guard:

| Platform | Tests |
|---|---|
| android | **43** unit tests — parser 14, sanitizer 9, `AlignmentKind` 5, alignment pick 3, capability chip 7, location outcome 5. Plus **18** for the 2026-09-08 re-baseline: `ChatReserveTest` 13, `ApproxPlaceNameTest` 5. (`:farmerchat-core:testDebugUnitTest` is **198** tests in total.) |
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

## Telemetry is OFF by default in 2.0.0

`FarmerChatConfig.enableAnalytics` defaults to **false**. While it is false, every analytics event,
user identity and user attribute is still built exactly as before — same names, same properties,
same call sites, same order — and then dropped at the single dispatch point in
`FarmerChatAnalytics` instead of reaching `onEvent`, `FarmerChatAnalyticsListener`,
`onUserIdentified` or `onUserAttribute`. Nothing else about the SDK changes: no skipped work, no
different branch, nothing a farmer or the backend can observe.

```kotlin
FarmerChatConfig.builder(env)
    .enableAnalytics(true)   // opt in when you are ready to receive telemetry
```

**The C4 semantic hooks are NOT gated by this** — `onChatOpened`, `onMessageSent`,
`onAnswerReceived`, `onScreenView`, `onError` are product callbacks a host wires for behaviour,
not telemetry to a vendor, so silencing them would be a functional regression. `AnalyticsGateTest`
pins both halves of that contract.

⚠️ **This is a behaviour change for hosts that were already receiving events.** It is deliberate:
an integration can now be wired end-to-end and reviewed before any data is emitted. Flip the flag
to restore delivery. Both sample apps set it to `true` so the verification harness still sees
events.

## SIM number pre-fill is host-opt-in

The Auth screen can read the device's SIM numbers to pre-fill the phone field — one SIM fills it,
several open a chooser. The SDK declares **neither** `READ_PHONE_STATE` nor `READ_PHONE_NUMBERS`:
a library manifest merges into every host, and a host that never shows the Auth screen should not
inherit sensitive permissions it then has to justify on its store listing.

A host opts in with two lines:

```xml
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
<uses-permission android:name="android.permission.READ_PHONE_NUMBERS" />
```

Without them the SDK is completely silent — it checks the merged manifest before prompting, so a
host that did not opt in never sees a permission dialog. See `docs/05-open-questions.md` for the
two deliberate divergences from the app here (the app declares a permission launcher it never
invokes, and the SDK splits numbers against endpoint #5's dial codes rather than taking a
libphonenumber dependency).

## Host toolchain floor (Android)

**A host consuming `farmerchat-android-compose:2.0.0` needs AGP 8.13.0 or newer.**

This is not a preference. The SDK is compiled with Kotlin 2.3.21 / AGP 8.13.0. On a host dexing
with **AGP 8.9.3** the app crashes on first launch of the chat screen:

```
java.lang.VerifyError: Verifier rejected class
  org.digitalgreen.farmerchat.sdk.compose.components.InputComposerKt:
  void InputComposer-SVl97cE(...): [0x5AC] register v302 has type
  Reference: androidx.compose.runtime.Composer but expected Boolean
    at ...compose.screens.ChatScreenKt.ChatScreen(ChatScreen.kt:841)
```

`InputComposer` takes 23 parameters, all defaulted, so the Compose compiler emits three `$changed`
masks plus a `$default` mask. The older D8 mis-verifies the resulting method; D8 from AGP 8.13.0
dexes the identical class file correctly. Reproduced and then cleared on RationSmart
(`feed-formulation-frontend`, minSdk 24) — debug **and** release, on an API 36 emulator, 2026-09-04.

Two consequences for hosts:

- **Below minSdk 26**, `tools:overrideLibrary` must name the compose package too, not just views:
  `org.digitalgreen.farmerchat.sdk.views, org.digitalgreen.farmerchat.sdk.compose,
  org.digitalgreen.farmerchat.sdk.core`. Missing the middle entry fails manifest merging.
- **`farmerchat-android-views` alone does not hit this** — it has no `InputComposer` Composable —
  so a host pinned to an older AGP can stay on the views artifact, at the cost of the fidelity gaps
  listed in `docs/04-parity-matrix.md`.

The durable fix on the SDK side is to shrink `InputComposer`'s parameter list (group the callbacks
and the appearance overrides into `@Immutable` holders) so no host toolchain can mis-dex it. Until
that lands, the AGP floor above is the requirement. Tracked in `docs/04-parity-matrix.md`.

**Both UI artifacts can be installed side by side.** `FarmerChat.resolveActivityClass()` tries the
compose activity first and falls back to views, so a host that adds
`farmerchat-android-compose` next to `farmerchat-android-views` gets the Compose screens from
`launch()`/`openChat()` while keeping the View-based `FarmerChatFab` (compose ships only a
`@Composable` FAB). That is how RationSmart is wired.

## Answer-generation tips are server-driven

While an answer is generating, the chat screen shows a rotating tip carousel (android v2, both
flavours). **The tip set is not in the SDK** — it is discovered from the `get_labels` payload, so
your backend can add, translate or retire tips without an SDK release. Any pair of labels

```
fc_v2_app_label_tips_<name>_title_<lang>
fc_v2_app_label_tips_<name>_statement_<lang>
```

becomes a card, ordered by `<name>`. Both halves must resolve (in the farmer's language or in
English) or the tip is skipped. With no discoverable pair the SDK falls back to three built-in
English tips.

Host string overrides (`stringOverrides`) still apply to the three built-ins, so a host can
reword them without touching the backend. The carousel is hidden the moment a streamed answer
produces its first text chunk, so it never competes with the answer.

Not yet on ios / react-native / web — see `docs/04-parity-matrix.md`.

## STAGE points at the agentic demo backend (2026-09-08)

`FarmerChatEnvironment.STAGE` resolves to **`https://demo.agent.farmer.chat/`** in this tree, on
all four platforms. v1 keeps the farmstack host, so stage is the one environment where the two
versions differ.

```kotlin
FarmerChatConfig.builder(FarmerChatEnvironment.STAGE)   // → https://demo.agent.farmer.chat/
```

- **Debug and release both use it.** The SDK has one base URL per environment, not per build type,
  so there is no separate stage-debug value to set and nothing for a host to override.
- **Reverting is one line per platform.** The previous farmstack URL is kept commented directly
  above the new one in `FarmerChatConfig.kt`, `FarmerChatConfig.swift` and both `config.ts` —
  uncomment it and delete the line below.

Unlike every farmstack URL, this host has no base path. The trailing slash is therefore load-bearing
(paths are joined as `baseUrl + "api/…"`), and `ApiPriority.normalizeApiName` is unaffected — its
`/mobile-app-stage/` strip becomes a no-op and the trailing `/` strip does the work. See `docs/02`
§Base URLs.

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
