# Open Questions / Ambiguities Ledger

Rule (root CLAUDE.md §2): when the docs and app source leave something ambiguous, implement the conservative reading and record it here — never silently guess. Each entry: what was ambiguous, what was implemented, what would resolve it.

| # | Area | Ambiguity | Conservative choice implemented | Resolution needed |
|---|---|---|---|---|
| 1 | iOS/RN/Web audio format | App sends `input_audio_encoding_format` = "ogg" (API 29+) or "aac". Server support for m4a/webm containers unverified. | Send the platform's real container ("aac" for m4a on iOS/RN, "ogg" for webm/opus on web where opus codec is used) and surface transcription errors normally. | Confirm accepted formats with backend team. |
| 2 | Guest API key | `GUEST_USER_API_KEY` is hardcoded in app source. Shipping it inside distributable SDKs exposes it to every host. | Built-in default, overridable via `FarmerChatConfig.guestApiKey`. | Product decision on per-host key issuance. |
| 3 | Web location | App uses Play Services fused location + OSM reverse geocode. | `navigator.geolocation` + same `update_user_location` payload without `osm_response`. | Confirm backend tolerates missing osm_response (field is optional in model). |

| 4 | Home feed card typing | docs/02 `SectionDto` carries `type`/`selection_type`/`options`/`unique_key` but the exact server values that select ContentCard vs SingleSelect vs MultiSelect (and gender vs crop vs livestock submission target) are not enumerated. | Web: `selection_type` contains "single"/"multi" → select cards, else content card; `unique_key`/`label` containing "gender" → profile update, "livestock" → `live_stock_details` profile update, otherwise `update_crop_details`. | Enumerate real `selection_type`/`unique_key` values from backend or app QA build. |
| 5 | Weather CTA question text | docs/01 says weather click opens `Chat(question, isWeatherAdviceCTA=true)` but the exact question string is not documented. | Web sends LabelManager key `weather_advice_question` (fallback "What does the weather mean for my farm today?") with `weather_cta_triggered=true`. | Extract the exact string/label key from the app source. |
| 6 | Post-update language screen (Home → SettingsLanguage, non-Kenya) | Driven by `AppInstallUpdateTracker.isUpdateLanguageScreenPending` — an app install/update signal with no SDK equivalent. | Omitted on web (no install/update lifecycle in an embedded SDK); same on react-native. | Product decision whether SDKs need an update-language nudge. |
| 7 | Label key names (RN + web) | docs/01–02 don't enumerate the app's label base keys; the app uses `fc_v2_app_label_*` constants (`core/labels/Labels.kt`). SDK UIs were written with short invented base keys + app English fallbacks, so server translations won't resolve. | English fallbacks render correctly everywhere; RN weather CTA now uses the exact app key `fc_v2_app_label_what_is_the_present_weather` (resolves #5 for RN). | Sweep `Labels.kt` and map every SDK string to the app's exact base key on all platforms. |
| 8 | RN "download answer card" | App writes the PNG to MediaStore. RN has no MediaStore/photo-library write without an extra native dep (expo-media-library not in the approved peer list). | Download button captures the card (react-native-view-shot) and opens the share sheet, whose "Save image" flow is the platform path; text share when view-shot absent. | Decide whether expo-media-library should join the peer list for true silent save. |
| 9 | RN home card submission targets | Same ambiguity as #4 for react-native. | `selection_type` startsWith "single"/"multi" → select cards; single-select submits `gender` via `update_user_profile`; multi-select submits `update_crop_details` unless `statement_type`/`type` contains "livestock" → `live_stock_details` profile update. | Same as #4 — enumerate real server values. |

| 10 | Android Device-Info app version | App's `Device-Info` header reports the host app's `BuildConfig.VERSION_NAME/CODE`; the SDK has no host BuildConfig. | android-core reports the SDK's own version (`app_version_name`=1.0.0) plus an extra `"sdk":"farmerchat-android"` marker in the same URL-encoded JSON. | Decide whether hosts should inject their app version into the header via config. |
| 11 | Android home feed card typing | Same ambiguity as #4/#9 for the Android SDK UIs. | Compose/views modules follow the same conservative mapping as web/RN: `selection_type` single/multi → select cards, gender→profile, livestock→`live_stock_details`, else `update_crop_details`. | Same as #4 — enumerate real server values. |
| 12 | Android 204 empty feed | `api/images/v2/daily/` returns 204 for an empty feed; Retrofit delivers a null body which `executeApiCall` treats as an error (app behavior identical — doc 02 notes "204 → empty"). | android-core HomeViewModel maps a code-204 error to `UiState.Success(empty HomeUdfResponse)` so the feed renders empty instead of erroring. | Confirm with backend that 204 is the only empty-feed signal. |

| 13 | iOS name-screen RemoteConfig gate | `routeFromSplash()` consults Firebase RemoteConfig `show_name_screen` (false ⇒ markProfileDone + skip). SDKs ship no Firebase. | ios-core `SplashRouter` shows the Name screen unless `KEY_NAME_DONE`/`KEY_NAME_SCREEN_SEEN` — i.e. behaves as `show_name_screen=true` (the RemoteConfig default). | Decide whether `FarmerChatConfig` needs a `showNameScreen` flag for hosts to replicate the RemoteConfig gate. |
| 14 | iOS UIKit ↔ SwiftUI packaging | Task spec says FarmerChatUIKit "may host the SwiftUI flow via UIHostingController on iOS 16+", but SPM forbids an iOS 15 package depending on an iOS 16 package. | FarmerChatUIKit is pure-native UIKit (iOS 15); the UIHostingController path ships as `FarmerChat.present(from:)` inside FarmerChatSwiftUI for iOS 16+ hosts. | Alternative: raise FarmerChatUIKit's floor to iOS 16 or duplicate a weak-linked shim; product call. |
| 15 | iOS home card submission targets | Same ambiguity as #4/#9/#11 for the iOS SDK UIs. | Same conservative mapping: `type`/`selection_type` single/multi → select cards; single-select submits `gender` via `update_user_profile`; multi-select submits `update_crop_details` unless `unique_key`/`statement_type` contains "livestock" → `live_stock_details` profile update. | Same as #4 — enumerate real server values. |
| 16 | iOS Device-Info payload | Same as #10: no host BuildConfig on iOS; exact Android JSON field names for the device config are not enumerated in docs/02. | ios-core sends URL-encoded JSON with `platform/sdk_name/sdk_version/device_id/device_model/os_version/locale/timezone` plus the host bundle's `CFBundleShortVersionString`/`CFBundleVersion` when present. | Enumerate the app's exact Device-Info JSON shape and align all platforms. |
| 17 | iOS conversation-list / thread-history envelope keys | docs/02 documents the dual bare-array vs paginated shape but not the paginated container's key names. | ios-core decoder accepts `results`/`data`/`conversations` (+`messages` for thread history) with `next_page`/`total_pages`/`count`, tolerating malformed entries lossily. | Capture a real paginated payload and pin the exact key. |
| 18 | iOS 204 empty feed | Same as #12: URLSession delivers an empty body on 204. | ios-core APIClient decodes empty bodies as `{}` so `HomeUdfResponse` succeeds with nil sections → feed renders empty instead of erroring. | Same as #12. |

Add new rows above this line.

---

## Q: What is the agentic stream's actual wire framing? (2026-09-02, blocks 2.0.0)

`api/chat/get_answer_for_text_query_agentic/` opens correctly but has never been observed
delivering an event.

**Probed live** on dev, stage and prod with a freshly minted guest (preferred language set,
location set via #11, conversation created via #15):

```
POST .../get_answer_for_text_query_agentic/
  Accept: application/json
  Authorization: Bearer <guest>
→ 200, Content-Type: text/event-stream, Transfer-Encoding: chunked
→ 0 bytes, all three environments
```

The app's own `AgenticChatDataSource` flags the same uncertainty: *"The exact wire framing should
be confirmed against a real authenticated stream."*

**Working hypothesis:** agentic answers require a signed-up (OTP-verified) user or a server-side
feature flag, not a guest session.

**Needed from the backend team:**
1. Does the agentic endpoint serve guest sessions, or only OTP-verified users?
2. Is there a per-user or per-environment feature flag gating it?
3. A captured sample stream — is it `data:`-prefixed SSE, or bare NDJSON?
4. Are event names sent on an SSE `event:` line, or only as a `type` field in the JSON?

**Conservative reading implemented meanwhile** (per CLAUDE.md §2): accept BOTH framings and
resolve the type from `event:` when present, else the JSON `type` field — which is what the app
does. If the real framing differs, only the reader changes; the `AgenticEvent` contract holds.

---

## Ask: TEN label keys are missing from endpoint #3 (2026-09-02, corrected)

**This section previously said "two". That was an undercount** — the audit behind it compared bare
SDK keys against server keys that carry a language suffix (`${key}_${lang}`, e.g.
`fc_v2_app_label_my_farm_en`), which reports every key as missing and hides the real answer. Redone
against a LIVE stage probe (guest token via `initialize_user`; `language=1` and `language=2` each
return 283 entries): of the 256 keys the SDK declares, **246 are served and 10 are not**.

The two originally listed, both user-facing during a failure or a slow answer — exactly when a
farmer most needs to read it in their own language:

| Key | English fallback in use | Where it shows |
|---|---|---|
| `fc_v2_app_label_response_paused_resuming` | "Paused, resuming…" | transient hint when a stream stalls mid-answer |
| `fc_v2_app_label_connection_stopped_partial_saved` | "Connection stopped. Your partial answer is saved." | stream error card when a partial answer was preserved |

And five more the undercount hid, all of them displayed to the farmer:

| Key | Where it shows |
|---|---|
| `fc_v2_app_label_cant_load_right_now` | generic load failure |
| `fc_v2_app_label_failed_to_load_chats` | conversation-list failure |
| `fc_v2_app_label_no_camera_app_available` | no camera app installed |
| `fc_v2_app_label_no_chats_yet` | empty conversation list |
| `fc_v2_app_label_this_permission_is_needed_..._device_settings` | permission settings dialog |

**So the actionable ask is SEVEN keys** — the two above plus these five.

Three further keys are also unserved but are **declared-for-parity only and displayed nowhere**, so
they are deliberately excluded from the request; no need to localize strings the SDK never shows:

```
fc_v2_app_label_permissions_are_required_to_auto_detect_sim_number.   (trailing "." is the app's own)
fc_v2_app_label_storage_exceeded
fc_v2_app_label_user_cancelled_or_provider_error
```

They are declared only in android `Labels.kt` and react-native `labels.ts` (a 1:1 copy of it),
absent from iOS and web entirely, and referenced by zero call sites on any platform — verified.

All ten appear in the app's own `Labels.kt`, so none is an SDK invention — the app falls back to
English for them too. **Impact is localization only, never a raw key on screen:** every used key's
call site passes an English fallback (each verified individually, including multi-line calls).
That matters because `LabelManager.getLabel` ends in `englishFallback.ifBlank { baseKey }` — an
omitted fallback would show a farmer the literal `fc_v2_app_label_storage_exceeded`.

**Request:** add the **seven displayed keys** to the label set for every supported language. The
three parity-only keys can be skipped.

Also worth noting for whoever audits next: stage served 276 keys when the first count was taken and
283 now, so **re-probe rather than trusting a cached response.**

No client change is needed once they land; `LabelManager` resolves `${key}_${lang}` →
`${key}_en` → the English fallback, so the strings switch over automatically.

---

## ~~Q: what should produce a `LocationMessage` chat bubble?~~ — ANSWERED, CLOSED (2026-09-02)

**Answer: the `gps-prompt` alignment surface's "Share my location" chip.** The app has the producer
all along (`ui/chat/ChatViewModel.kt` `sendLocationSharedQuery`, dispatched from
`ChatScreen.onAlignmentChipClick`); the SDK had simply not ported it, because every alignment chip
sent its own text as a follow-up. Now ported and reachable on **all four platforms** — see "The
capability-chip gap" in `docs/04`. Fixing it also surfaced three producer bugs (single-consumer
event channel, `dismiss()` emitting nothing, and the resulting "`Continue` no longer implies
success" trap), all recorded there.

**One related question stays OPEN** — the chat-history mapping, below: a location bubble does not
survive a conversation reload, because the app's own `message_type_id 12 → location_shared` mapping
is annotated `TODO(location-history)` with the type id and address field unconfirmed. Porting a
guessed type id would risk mis-rendering real messages (§2).

The original analysis is kept below for context.

`ChatMessage.LocationMessage(address, id)` WAS **defined and rendered but never produced**, on
every platform that has it:

| Platform | Defines | Renders | Produces |
|---|---|---|---|
| android core | `ui/chat/ChatModels.kt`:95 | — | **nothing** |
| android compose | — | `screens/ChatScreen.kt`:699 | — |
| android views | — | `ChatAdapter.kt`:276 (`fc_item_chat_location`) | — |
| react-native | `state/useChat.ts` (`kind: 'location'`) | `ui/screens/ChatScreen.tsx` `renderMessage` | ✅ `useChat.sendLocationSharedQuery` (2026-09-02) |
| ios core | `ViewModels/ChatViewModel.swift` (`ChatMessage.location`) | — | ✅ `ChatViewModel.sendLocationSharedQuery` (2026-09-02) |
| ios SwiftUI | — | `Components/ChatComponents.swift` `FCLocationChatBubble` | — |
| ios UIKit | — | `ChatCells.swift` `FCUILocationBubbleCell` | — |

The doc comment on the Android variant says it is shown "once a `GPS_PROMPT` alignment chip has
been satisfied", but no code path appends it: a `GPS_PROMPT` chip tap goes down the same route as
every other chip — `SendFollowUpQuestion` with the chip's `value`-or-label — so the farmer's reply
appears as an ordinary text bubble and the location card never renders.

This is the same hole as the unwired `chip.action == "select"` device-capability flows (docs/04
"Still to do" item 4): satisfying a capability chip locally (take a photo / share location) and
then re-sending the original query is not implemented anywhere, and the location bubble is the
missing *visual* half of that flow.

**Needed to close it:**
1. Which address string goes in the bubble — the #16 response's `display_address`, or something
   the agentic surface returns with the chip?
2. Is the bubble appended when the capability is satisfied (before the re-sent query), or when the
   backend acknowledges the location in its next turn?
3. Does the location bubble persist in chat history (#28 / #31), and under what message type? If
   not, a rehydrated conversation will silently lose it.

**Conservative reading implemented meanwhile** (per CLAUDE.md §2): react-native mirrored Android
exactly — the variant and its render path existed, nothing produced it. No producer was invented.

**RESOLVED for react-native (2026-09-02).** The android reference now HAS a producer
(`ChatViewModel.sendLocationSharedQuery` + `ChatAction.SendLocationSharedQuery`), so the flow no
longer had to be invented — it was ported: `useChat.sendLocationSharedQuery` is the only
constructor of the `'location'` variant, dispatched from `ChatScreen` when the armed location
outcome reports `location_fetched`. That answers the three questions above as the app answers
them: (1) the address is the stored geography (`display_address` on android, `USER_DISTRICT` in
its place on RN, then state, then country), (2) the bubble is appended when the capability is
satisfied, immediately before the re-sent query, and (3) it does **not** persist in chat history —
the app's `message_type_id 12 → location_shared` mapping carries its own `TODO(location-history)`
saying the type id and the address field are unconfirmed placeholders, so it was deliberately not
ported and a rehydrated conversation still loses the bubble. Question 3 therefore stays open for
the backend team; questions 1 and 2 are closed.

**RESOLVED for iOS too (2026-09-02), on the same reading.** `ChatAction.sendLocationSharedQuery`
→ `ChatViewModel.sendLocationSharedQuery` is the only constructor of `ChatMessage.location`,
dispatched from both flavours when the armed location outcome reports success
(`LocationPromptEvent.isLocationObtained`). Answers: (1) the address is
`USER_DISTRICT, USER_STATE, USER_COUNTRY_NAME` — iOS's `#11` response gives district/state/country
and no `display_address`-equivalent pref exists, the same substitution RN documents; (2) appended
when the capability is satisfied, immediately before the re-sent query, and a blank address
appends nothing; (3) not ported, same `TODO(location-history)` reason.

**Producer status: every platform that defines the variant now produces it** (android core,
react-native, web, iOS core). Question 3 — chat-history persistence and its `message_type_id` — is
the only part still open, and it is a **backend** question, not a platform gap.
