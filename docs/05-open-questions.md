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

### Two MORE keys, added by the app on 2026-09-08 and NOT yet probed

App `2a5cf2b8` / `ae37b28e` added two label keys to the auth screen. They are **unverified, not
known-missing** — they are separate from the ten counted above because no probe has been run
against them at all: this tree has no API key, so there was no way to curl `get_labels` while
porting them.

| Key | English fallback in use | Where it shows |
|---|---|---|
| `fc_v2_app_label_agreement_card_info_text` | "Surveys or research may be conducted by Digital Green or trusted partners working with us." | italic attribution line in the auth agreement card |
| `fc_v2_app_label_auth_consent_suffix` | "for more information, including how to withdraw your consent." | tail of the privacy-consent sentence under the send-code buttons |

**Action for whoever has a key:** probe stage for both in en/hi/sw and either move them into the
"served" column of `docs/04` (which currently claims *five* agreement-card labels verified, and
must not be read as covering these two) or add them to the request above. Both are displayed to
every farmer who reaches the signup screen, so they matter.

A third key is affected the other way round: `fc_v2_app_label_agreement_point_surveys` is **still
served but no longer rendered** — the app folded that bullet into `..._agreement_point_updates`
and kept the constant. The SDK keeps the constant too rather than dropping a served key, and both
android v2 flavours have stopped rendering it.

---

## The Home location backfill is ported with a DIFFERENT reason than the app's (2026-09-08)

App `b72ea4da` backfills the location pill's place name from the user profile's geography on Home
entry. The mechanism is ported (android core, ios, react-native; web partially — `docs/04`), but
**the app's stated rationale does not apply to the SDK and the code comments say so.**

The app is repairing its own upgrade: its V1 stored `FARMER_APP_LATITUDE/LONGITUDE`, which survive
an update, but never wrote `APPROX_LOCATION_NAME`, a V2-only key — so a farmer who had already
shared their location saw a name-less "— Change" pill after updating. The SDK has **never had that
gap**: `APPROX_LOCATION_NAME` has existed for as long as the pill has, and there is no SDK V1→V2
pref migration of this kind at all.

What *is* true for the SDK, and what the ported comments claim instead: geography can exist
server-side while this install's prefs are empty — a reinstall, a fresh host app, or any
already-onboarded farmer reaching Home without re-running the GPS flow. Those farmers see the
"Set location" invite even though the place is known, and the profile response already carries it.

Two deliberate reductions, both recorded at the call sites:

- **The SDK has one approx-name key, not two.** The app also seeds a never-overwritten
  `IP_APPROX_LOCATION_NAME`; the SDK has no such key by design, so that half is dropped rather
  than inventing a key (§2).
- **The `IS_PROFILE_LOADED` reset-ordering move is not ported.** The app shifted
  `IS_PROFILE_LOADED = false` from the top of its profile-success block to the bottom. That flag
  is an app global (`AppConstants`) gating `HomeScreen`'s fetch; android SDK core has no
  equivalent, so there was nothing to reorder and no guard was invented to give it a home.

**Question for the app team:** is the profile's `geography_level3` the intended source for the
pill's *district*, or is `address.district` preferred when both are present? The app reads
`geography_level3` first and the SDK follows it literally, but the two fields are not documented as
equivalent.

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

---

## Q: what is the SDK's equivalent of the app's "app was updated" signal? (2026-09-03)

docs/01 §2 has a nav edge the SDK deliberately does not implement:

| From | Trigger | To | Backstack |
|---|---|---|---|
| Home (post-update, non-Kenya) | `AppInstallUpdateTracker.isUpdateLanguageScreenPending` | `SettingsLanguage` | singleTop |

The app shows the language chooser **once** after an app update (excluding Kenya) by comparing the
stored versionCode against the running one (`utils/AppInstallUpdateTracker`,
`shouldShowLanguageScreen(countryCode, languageCode)`).

**Why it is not ported:** an embedded SDK has no meaningful "the app was updated" event. The host's
`versionCode` is the *host's*, and it moves for reasons that have nothing to do with FarmerChat; the
SDK's own artifact version moves only when the host bumps a Gradle coordinate, which is not a user
event and not observable at the point the edge fires. Reusing either signal would pop a language
chooser over the host's Home for reasons the host never asked for.

**Conservative reading implemented:** the edge is omitted on every platform and recorded in docs/04.

**Open question for product:** should this become an explicit host-driven API — e.g.
`FarmerChat.openScreen(context, "language")`, which the SDK **already supports** and which the host
can call from its own post-update logic where the signal genuinely exists — or should the SDK track
its own `fc_sdk_last_seen_sdk_version` pref and re-prompt on an SDK-version change? The first needs
no new code; the second needs a new preference key and a decision on whether the Kenya exclusion
(a FarmerChat product rule) belongs inside an SDK a third party embeds.

---

## Q: what should happen when `phone_length` is 0 or absent? (2026-09-03)

The app's `isPhoneValid` (`ui/auth/AuthViewModel.kt:867`) gates on the country's `phone_length`
unconditionally:

```kotlin
if (country != null && digits.length != country.phone_length) return false
```

and `setPhoneLocal` caps typed input at `selectedCountry?.phone_length ?: 15`. If endpoint #16 ever
returned `phone_length: 0` for a country, the app would cap the input at zero characters and reject
every number — the field would be permanently unusable for that country. `CountryItem.phone_length`
is a non-null `Int`, so a missing key deserialises to `0` rather than throwing.

**Conservative reading implemented:** the SDK guards both sites with `phone_length > 0`, so a
`0`/absent length falls through to the pattern gate and then the `6..15` fallback instead of locking
the field. Everything else is 1:1 with the app.

**Open question for the backend team:** is `phone_length: 0` a value #16 can actually return, and if
so is "reject everything" the intended behaviour, or is the SDK's degrade-gracefully reading correct?
If `phone_length` is guaranteed `> 0` for every row, the guard is dead code and the two readings are
indistinguishable.

---

## `gps-prompt`'s decline chip: `use_approximate_location` vs the app's `not_now` (2026-09-03)

**Status: discrepancy CONFIRMED against the live wire; SDK accepts both. Open for the backend team.**

`AlignmentChip.VALUE_NOT_NOW = "not_now"` comes from app source
(`domain/model/chat/TextPromptResponse.kt:104`), where it is documented as "the decline chip on a
capability prompt". The first live capture of a `gps-prompt` surface (docs/02 §#27a,
`docs/captures/agentic_stream_gps_surface_20260903.sse`) sends something else:

| | app constant | live `gps-prompt` | live `commodity-confirm` |
|---|---|---|---|
| `value` | `not_now` | **`use_approximate_location`** | `not_now` |
| `action` | `decline` | **`continue`** | `decline` |
| `behavior` | — (not modelled) | **`continue`** | — (absent) |
| `capability` | — | `location` | — |

So `not_now` is real — the additive `commodity-confirm` surface sends exactly it — but it is **not**
what `gps-prompt` sends. `VALUE_NOT_NOW` was therefore kept (it is app source and live-confirmed
elsewhere) and treated as **unconfirmed for `gps-prompt`**.

**Why it matters.** The decline chip is what sets `location_declined = true` on the next request. A
client that recognises only `not_now` routes the live decline chip as an unrecognised text chip: the
farmer's "Continue without location" reaches the backend with no decline flag, and a `blocking`
surface can be re-asked (`budget: {asked: 1, max: 2}`) instead of answered from an approximate
location.

**Conservative reading implemented** (per CLAUDE.md §2 — accept the union, invent nothing):
`routeAlignmentChip` treats a chip as a decline when **any** of these holds —
`behavior == "continue"`, `value == "use_approximate_location"`, `value == "not_now"`,
`action == "decline"`, `action == "continue"` — and prefers `behavior`/`capability` over
`action`/`value` when the newer fields are present. Both spellings decline; neither is normalized
away. `AlignmentChip.VALUE_USE_APPROXIMATE_LOCATION` was added alongside `VALUE_NOT_NOW`.

**Open questions for the backend team:**
1. Is `use_approximate_location` now the canonical `gps-prompt` decline value, and is `not_now`
   retired there (or still emitted by some path)?
2. Is `behavior` (`invoke_capability` / `continue`) the field clients should key on going forward,
   with `action` retained only for older clients? The two disagree on the live decline chip —
   `action: "continue"` is neither the app's `decline` nor its `invoke`.
3. Is there a `capability` string for the photo capability, matching `capability: "location"`? None
   has been observed, so `upload-photo` chips are still matched on `take_photo` /
   `choose_from_gallery` by value alone, which is the fragile half of the routing table.

---

## Does `blocking` mean "no escape hatch" on a non-capability surface? (2026-09-03)

**Status: implemented on the conservative reading for android v2; unobserved on the wire.**

`versions/v2/android` now withholds the alignment surfaces' "Don't see your option? Type or say it."
escape hatch when the surface's wire `blocking` is `true`. The reasoning: `blocking` is the backend
saying it cannot proceed until this is answered, so offering a way past it sends the farmer down a
path the backend will only re-ask (`budget: {asked, max}`).

The only `blocking: true` ever OBSERVED is on `gps-prompt` (docs/02 §#27a), where the hatch was
already suppressed because it is a capability prompt — so on the one surface there is evidence for,
the change is a no-op. It only bites on `alignment-clarify` / `alignment-confirm` /
`alignment-escalate`, and no capture of those surfaces exists at all. The pre-existing comment on
the hatch says it is there because "a farmer whose answer is not among the chips has no way
forward", so this trades one stranding risk for another on unobserved data.

**Open questions for the backend team:**
1. Is `blocking` ever `true` on `alignment-clarify` / `alignment-confirm` / `alignment-escalate`?
2. If so, is suppressing the type-instead escape hatch the intended client behaviour, or is
   `blocking` meant only to describe capability prompts — i.e. should a blocking clarify surface
   still let the farmer type a free-text answer?

A capture of any non-capability alignment surface would settle both, and is the single most useful
next capture to take.

## The app declares a SIM-permission launcher and never invokes it (2026-09-04)

**What the app does.** `AuthScreen.kt` builds a `RequestMultiplePermissions` launcher for
`READ_PHONE_STATE` + `READ_PHONE_NUMBERS` (line 377), and defines the failure copy for it
(`fc_v2_app_label_permissions_are_required_to_auto_detect_sim_number.`). `permissionsLauncher` is
then **never called** — a repo-wide grep finds exactly one occurrence, the declaration.

The consequence in the shipped app: `SimPhoneNumberProvider.canReadPhoneNumber()` is false on any
fresh install, so the SIM auto-detect at `AuthScreen.kt:266` never runs and the "Choose SIM
number" picker is unreachable. The feature is present in code and dormant in practice.

**What the SDK does.** It requests the permissions, so the feature actually works — but **only
when the host has declared them**. `SimPhoneNumberProvider.isDeclaredByHost()` checks the merged
manifest first, because Android denies a request for an undeclared permission instantly and
without a dialog, which would just show the farmer a failure toast for a feature their host never
enabled. A host that does not declare them sees no prompt and no behaviour change at all.

The SDK also declares **neither permission itself**. A library manifest merges into every host,
and these are sensitive enough to affect a store listing; a host that never shows the Auth screen
should not inherit them. Opting in is two lines in the host manifest — `sample-views` and
`sample-compose` do it, RationSmart deliberately does not (it runs `CHAT_ONLY` and never reaches
the Auth screen).

**Questions for the app team:**
1. Is the un-invoked launcher an oversight, or was the SIM pre-fill deliberately parked?
2. If deliberate — is it parked for a privacy/store reason the SDK should respect by leaving the
   request out too?

Until answered, the SDK's behaviour is: ask, but only where the host opted in.

## Splitting a SIM number without libphonenumber (2026-09-04)

The app splits a SIM line number into (dial code, local number) with
`com.google.i18n.phonenumbers.PhoneNumberUtil`. The SDK does not take that dependency: it is
~1 MB of metadata in every host for one optional pre-fill, and the SDK already holds the
authoritative dial codes — endpoint #5 returns every supported country with its
`phone_country_code`, and that list is loaded on the Auth screen before the split runs.

`core/util/PhoneNumberSplitter` matches **longest dial code first**, which is the case a naive
split gets wrong (`+1` and `+1876` both prefix a Jamaican number). It refuses rather than guesses
when nothing matches, so an unrecognised number leaves the user's country selection alone.
10 unit tests, including the overlapping-prefix case.

Known difference from libphonenumber: it does not validate national number *length or shape* per
country, so it will happily split a malformed number. `isPhoneValid` still runs afterwards, so a
bad number is rejected at send time exactly as before — but if the app team wants strict parsing
at pre-fill time, that is the gap.

## SIM pre-fill runs only when no country is resolved (2026-09-04)

Not an open question so much as a trap worth recording, because the SDK hit it and the app's
one-line guard is what prevents it.

The app reads the SIM **only** `if (savedIso.isBlank())` (`AuthScreen.kt:261`). Porting the SIM
read without that guard produced a race on a real device: the SIM pre-filled country and number,
and ~10 ms later the deferred GPS `applyIso` called `selectCountry`, which clears `phoneLocal` —
so the number appeared and vanished. Traced on an API 36 emulator; the guard removes the
collision entirely because `applyIso` no-ops on a blank ISO.

`AuthViewModel.shouldAutoDetectFromSim()` is that guard.

## The bundled Geolocation key is not, and cannot be, a secret (2026-09-04)

`ApiConstants.DEFAULT_GEO_API_KEY` now ships a Google Geolocation key so an integrator gets a
working location fallback without obtaining one, matching the existing `DEFAULT_GUEST_USER_API_KEY`
precedent. **It is embedded in the AAR and is therefore extractable by anyone who has the
artifact** — `unzip` + `strings` on the dex is enough. `internal` visibility, ProGuard and native
storage only raise the effort; none of them make a client-side key private. This was stated to the
requester, who chose to embed it as-is for now.

What can and cannot be done on the Google Cloud side, verified against the call the SDK actually
makes (`GoogleGeoApi.geolocate` — a plain Retrofit `POST …/geolocate?key=`):

| Restriction | Usable here? |
|---|---|
| **API restriction** → Geolocation API only | ✅ **Do this.** Caps an extracted key to one API instead of the whole project. |
| Application restriction → "Android apps" | ❌ Relies on `X-Android-Package` + `X-Android-Cert` headers, which this call does **not** send. Enabling it breaks geolocation for every host. Making it work needs those headers *and* registering each integrator's package + signing SHA-1 — at which point those integrators can use the key for their own calls anyway. |
| IP restriction | ❌ Callers are phones on mobile networks. |

**The durable fix, and the only one that satisfies "no one else can use it": proxy it.** Add a
`geolocate` endpoint on the FarmerChat backend, which already fronts every other call and already
authenticates the SDK via the guest token. The SDK calls that instead of Google, the key lives
server-side, and `DEFAULT_GEO_API_KEY` is deleted. Until then the key is billable against the
project by anyone holding the AAR.

**Open questions:**
1. Is the backend team willing to expose a `geolocate` proxy? That removes the exposure entirely.
2. In the meantime, has the key been restricted to the Geolocation API in Google Cloud, and is
   billing capped/alerted on that project?

## Two requested divergences from the app — chat composer aura and bold chips (2026-09-04)

Both were asked for directly during device testing. Neither is a port defect: the SDK matched the
app before the change, so they are recorded here rather than silently applied.

### 1. The composer aura now runs on the CHAT screen

The app's `InputComposer.showAura` KDoc is explicit:

> Home-only: the aura is an attention cue for first contact, so the chat screen passes false to
> keep the composer calm amid live content.

The SDK now passes `true` on chat as well, so the placeholder field carries the flowing gradient
on both screens. Still idle-only (`showAura && !isFocused`), so it stops when the field is
focused.

**For the app team:** is the Home-only rule a deliberate product decision we should keep, or an
artefact? If deliberate, the SDK is now louder than the app on the busiest screen and we should
either revert or make it a host flag. If the app is expected to follow, this is the SDK leading and
the app should catch up.

### 2. Alignment chip labels are bold in every state

The app bolds only the **selected** chip and leaves the rest at `labelMedium`'s weight 600
(`components/chips/Chip.kt:127`). The SDK now uses `FontWeight.Bold` unconditionally.

**For the app team:** the app's weight change is what signals "this is the one you picked". With
every chip bold, selection now reads only from the check badge and the surface tint. Is that
acceptable, or should selection regain a weight difference (e.g. bold everywhere, extra-bold when
selected)?

A genuine parity defect found alongside this — the numbered badge was `labelSmall`/`SemiBold` where
the app uses `labelMedium` — was fixed as parity, not as a divergence.

## Resume-after-process-death: which screens should come back? (2026-09-04)

Toggling a runtime permission in system Settings makes Android kill the app, so the SDK now
persists the farmer's last post-onboarding screen (`RESUME_SCREEN`) and returns them to it instead
of re-running `routeFromSplash()`. See `docs/04-parity-matrix.md`.

The app does not do this — it re-decides from splash like the SDK used to — so this is the SDK
behaving better than the reference, deliberately, because the SDK lives inside a host where losing
the farmer's place is more costly.

**Open questions for the app team:**

- Chat resumes only when `NEW_CONVERSATION_ID` can reopen the thread. A thread that never got an
  id falls through to the normal decision. Is silently landing on Home the right fallback, or
  should the SDK reopen chat empty with the question re-prefilled?
- Should this apply to a **cold start after a long absence** too, or only to a recreation? Today it
  is strictly recreation-only (`savedInstanceState != null`), so a farmer who force-quits still
  gets the normal splash decision. That felt right but it is a product call.
- An explicit `openChat`/`openScreen` pending target still wins over the resume. Confirm that is
  the desired precedence.

---

## Six iOS text elements with no Android counterpart to cite (2026-09-09)

The iOS type-scale pass (docs/04 §"iOS pass against the native app") migrated 141 text call sites
across the SwiftUI and UIKit flavours, each one mapped to a specific Android slot. Six could not
be, and root CLAUDE.md §2 says implement the conservative reading and record rather than guess —
so these keep their current size and remain the only text in the iOS SDK with no script-correct
leading.

**Elements that exist on iOS but were not found in the Android sources:**

| Element | Current | Note |
|---|---|---|
| Drawer wordmark (`DrawerView.swift:32`, `DrawerLocationError.swift:140`) | 20/bold | Android's drawer header is a logo mark; the reference iOS app measured its wordmark at 16 pt (`PARITY.md:341`), which is neither `titleSmall` (16/bold) nor `titleLarge` |
| Weather temperature (`HomeComponents.swift:67`) | 16/semibold | `FCWeatherButton` — no Android compose equivalent located |
| Feed footer, "You're all caught up" (`HomeComponents.swift:105`) | 14 | ditto |

**Questions for the app team:**

- Is the drawer wordmark meant to be a type slot at all, or a fixed-size brand lockup that should
  *not* scale with `typeScale`? If the latter, it belongs with the icon glyphs, which deliberately
  stay off the scale.
- Do the weather chip and feed footer exist in the current app? They may be SDK-only affordances,
  in which case `labelLarge` and `bodySmall` are the natural slots and we would like that confirmed
  rather than assumed.

**Also open, and larger:** the remaining multi-line `UILabel`s in `FarmerChatUIKit` have the right
size and weight but still natural leading, because `UILabel` exposes line height only through
attributed text — so it must be applied at each text assignment (`fcSetText`), not once at setup.
It is applied to the bodies that matter most (both chat bubbles, location address,
alignment-surface message, feed card title/statement, full-screen message). Finishing the rest is
mechanical but touches every `configure()` in the flavour. Worth deciding whether `FarmerChatUIKit`
should instead ship an `FCLabel` subclass that re-applies the paragraph style on `text` assignment,
which would close this permanently instead of per call site.

## iOS / react-native / web do not use the app's label keys OR its copy (2026-09-16)

**Found while porting a one-word fallback string. Measured, not fixed — the remediation is
~350 call sites across three platforms and needs a per-key mapping decision.**

Android (compose + views) resolves every string through `Labels.<CONST>`, whose values are the
canonical `fc_v2_app_label_*` keys copied from the app (`Labels.kt:300` matches the app's
`Labels.kt:314`). The other three platforms largely do not.

### Measured against the 261 canonical keys in `android/farmerchat-core/.../labels/Labels.kt`

| Platform | call sites | distinct keys | resolve if simply prefixed | **invented — no server counterpart** |
|---|---|---|---|---|
| ios (`fcLabel`) | 166 | 130 | 26 | **104 (80%)** |
| web (`label(`) | 214 | 170 | 6 | **164 (96%)** |
| react-native, raw-string sites | 101 | 89 | 0 | **89 (100%)** |
| react-native, `Labels.X` sites | 85 | — | n/a | 0 — these are correct |
| android compose / views | all | — | n/a | 0 — correct |

Two distinct defects are stacked here, and they have different consequences:

1. **Unprefixed keys.** No layer normalises them. On iOS the path was traced end to end:
   `FarmerChatAPI.getLabels` (`FarmerChatAPI.swift:56`) returns the server map verbatim; both
   callers (`OnboardingViewModel.swift:300`, `SettingsViewModel.swift:137`) pass it straight to
   `LabelManager.update(labels:)` (`LabelManager.swift:41`), which stores it verbatim; and
   `label(_ baseKey:)` (`LabelManager.swift:72`) looks up `"\(baseKey)_\(lang)"`. So a bare key
   never matches `fc_v2_app_label_*_en`. **These platforms are effectively English-only regardless
   of the farmer's selected language.**

2. **Invented copy, which is worse.** Where the key has no canonical counterpart the hardcoded
   English fallback is often not the app's string at all — so the wrong words render even in
   English. The Home feed footer is the clearest case:

   | | icon | text |
   |---|---|---|
   | app (`FeedFooter.kt`) | `👋🏾` at 40sp, fade-in + 3× wave | "Have a great day,\ncome back tomorrow" |
   | compose / views / react-native | logo mark | "Have a great day,\ncome back tomorrow" ✅ |
   | ios (`FCFeedFooter`) | logo mark, 28 | **"You're all caught up for today"** (key `feed_footer`) |
   | web | none | **"That's all for today. Ask me anything!"** (key `home_feed_footer`) |

   Neither iOS's nor web's string exists anywhere in the app. Both violate root CLAUDE.md §2
   ("user-visible text = the app's English strings") and the no-invented-keys rule.

### Why this was not caught earlier

`docs/04:1749` and `:1754` record that the react-native and iOS fidelity passes (2026-07-20) were
verified **against the Compose SDK module**, not against the app. That makes compose the de-facto
reference for those platforms, so anywhere compose itself diverges from the app the drift
propagates silently — and anywhere a platform invented a string, there was no app-side check to
catch it. See [[check-the-app-means-screen-fidelity]].

### Remediation is a mapping exercise, not a find-and-replace

Spot-checking the iOS keys shows three different cases, so a blanket prefix would fix only the
first:

- **Just needs the prefix** — `all_languages`, `try_again` exist canonically.
- **Needs a mapping** — `ask_follow_up` → `fc_v2_app_label_ask_a_followup_questions`.
- **No canonical counterpart at all** — `api_error_title`, `feed_footer`, `account_benefits_title`.
  Either the app renders that surface with a hardcoded (non-label) string, or the surface is
  SDK-only. Each needs a decision: map to the nearest real key, hardcode to the app's exact English
  and stop pretending it is server-driven, or request a new key from the backend.


### iOS remediated, 2026-09-16 — buckets A and B are closed

The measurement above understated iOS: it counted only `fcLabel` (SwiftUI, 168 sites) and missed
`fcuiLabel` (UIKit, 114) and 51 direct `labels.label(` calls. **The real total was 333 sites.**

A generated `FarmerChatCore/Sources/FarmerChatCore/Labels/Labels.swift` (`FCLabels`, 263 constants,
1:1 with Android `Labels.kt`) now exists, and **225 of the 333 sites were migrated to it**:

- **97 sites** already used a canonical key, or needed only the `fc_v2_app_label_` prefix.
- **128 sites** were matched to a canonical key by their English copy, then verified. Two
  ambiguous location keys resolved against Android's `LocationPromptHost`, which uses
  `SHARE_LOCATION` for both the interstitial title and its CTA (`SHARE_LOCATION_TITLE` belongs to
  the GPS_PROMPT chip only).
- **12 fallbacks were corrected to the app's exact English** in the same edit, per §2 — including
  `"Save your questions and answers"` → `"Save your past questions"` and `"Log out"` → `"Logout"`.
  These change what renders today. Where a key has several spellings in the app
  (`getting_your_location` has three) and iOS already used one of them, iOS is left alone.
- One correction mirrors copy that reads as an app bug: `choose_a_followup_option_below` is
  `"Choose an option from the below"` in the app. That is deliberate — §2 says the app's English
  wins — so do not "fix" the grammar here; fix it in the app and let it flow through.

Only **13 of the 333 sites resolved against the server before this pass**, not the ~97 that bucket
A's size suggests: 84 of bucket A's sites were bare keys that merely happened to have a canonical
counterpart once prefixed.

Verified by re-running the classifier after the rewrite: bucket A = 0, bucket B = 0, bucket C
unchanged at 108. `swift build` + 88 Core tests pass; `xcodebuild` succeeds for both
FarmerChatSwiftUI and FarmerChatUIKit.

**Breaking change for iOS hosts**, documented in `ios/README.md`: `FarmerChatConfig.stringOverrides`
is keyed on whatever key the SDK asks for, so overrides written against the old bare keys stop
applying. No shim is offered — the old keys never resolved against the server anyway.

### Bucket C — 108 sites, 66 keys, still open (iOS)

These have **no counterpart among the 263 canonical keys**, and spot-checks confirm the app has no
equivalent: there are no `type_placeholder`, `load_earlier`, or per-HTTP-status error labels in the
app at all. This is SDK-invented UI copy for surfaces the app either renders differently or does
not have. They still pass string literals and still render their fallback.

Each needs one of: map to the nearest real key, hardcode as an SDK-owned English string and stop
pretending it is server-driven, or request a new backend key. **Roughly half are error/permission
copy** (`error_*`, `*_permission_*`, `no_internet_message`), which is the cluster most likely to
deserve real backend keys, since a farmer hitting them is the farmer least able to read English.

| key | current fallback |
|---|---|
| `account_success_subtitle` | "Your questions and answers are now saved to your account" |
| `api_error_message` | "We're having trouble right now. Please try again." |
| `auth_legal` | "By continuing you agree to our Terms and Privacy policy" |
| `camera_permission_message` | "Allow camera access in Settings to ask questions with photos." |
| `camera_permission_title` | "Camera access needed" |
| `chat_answer_failed` | "We couldn't answer that right now. Please try again." |
| `chat_history_empty` | "Your chats will appear here" |
| `chat_history_failed` | "We couldn't load this conversation." |
| `country_detect_failed` | "We couldn't detect your country. Please pick it manually." |
| `downloaded` | "Saved to Photos" |
| `enter_name_subtitle` | "We'll greet you by your name" |
| `error_bad_request` | "Something went wrong with that request. Please try again." |
| `error_forbidden` | "You don't have permission to do that." |
| `error_not_found` | "We couldn't find what you were looking for." |
| `error_server` | "Our servers are having trouble. Please try again shortly." |
| `error_timeout` | "The request timed out. Please try again." |
| `error_too_many_requests` | "Too many attempts. Please wait a moment and try again." |
| `error_unauthorized` | "Your session has expired. Please try again." |
| `feed_footer` | "You're all caught up for today" |
| `greeting` | "fallback" |
| `help_empty` | "No help topics yet." |
| `help_load_failed` | "Couldn't load help topics." |
| `home_feed_error` | "We couldn't load today's advice." |
| `home_greeting` | "Hello!" |
| `invalid_otp` | "Please enter the 4-digit code." |
| `invalid_phone` | "Please enter a valid phone number." |
| `load_earlier` | "Load earlier messages" |
| `location_failed_message` | "We couldn't find your location. Please try again." |
| `location_gps_unavailable_message` | "Turn on Location Services to share your farm's location." |
| `location_gps_unavailable_title` | "Location is turned off" |
| `location_recovery_message` | "Location access is turned off. Turn it on in Settings to get local advice." |
| `location_subtitle` | "Get weather alerts and advice specific to your farm's location" |
| `logout_confirm` | "Are you sure you want to log out?" |
| `message_failed` | "Not sent" |
| `mic_permission_denied` | "Microphone access is needed to speak your question." |
| `mic_permission_message` | "Allow microphone access in Settings to ask questions with your voice." |
| `mic_permission_title` | "Microphone access needed" |
| `name_too_long` | "Name is too long." |
| `name_too_short` | "Please enter at least 3 characters." |
| `no_internet_message` | "You appear to be offline. Check your connection and try again." |
| `open_settings` | "Open Settings" |
| `otp_incorrect` | "That code doesn't look right. Please try again." |
| `otp_resend_in` | "Resend code in {time}" |
| `otp_send_failed` | "Could not send the code. Please try again." |
| `otp_subtitle` | "Sent to {phone}" |
| `otp_title` | "Enter the 4-digit code" |
| `phone_placeholder` | "Phone number" |
| `photo_gallery` | "Choose from gallery" |
| `photo_source_title` | "Add a photo" |
| `photo_take` | "Take a photo" |
| `profile_saved` | "Saved!" |
| `select_country` | "Select country" |
| `send_code_sms` | "Get code by SMS" |
| `send_code_whatsapp` | "Get code on WhatsApp" |
| `settings_no_name` | "Add your name" |
| `ssfr_question` | "Fertilizer advice for {crop}" |
| `ssfr_title` | "Get fertilizer advice for your crop" |
| `transcribing` | "Understanding your question…" |
| `transcription_failed` | "We couldn't hear that. Please try again." |
| `tts_failed` | "Audio is not available right now." |
| `type_placeholder` | "Ask anything about your farm" |
| `voice_clip` | "Voice message" |
| `voice_listening` | "Listening…" |
| `voice_preparing` | "Getting ready…" |
| `voice_start_failed` | "Could not start recording." |
| `weather_error` | "Weather unavailable" |

### Questions for the team

1. Confirm the direction: every platform resolves the canonical `fc_v2_app_label_*` keys, matching
   Android — or is there a reason iOS/web were written with their own vocabulary?
2. For the third bucket (no canonical counterpart), is requesting new backend keys acceptable, or
   should those surfaces hardcode the app's English?
3. Host overrides are currently keyed on whatever bare key the call site passes. Any fix has to
   migrate those too or they silently stop applying.
4. Is there any device/browser evidence that a non-English language has **ever** rendered
   correctly on iOS, react-native or web? If so this analysis is wrong somewhere and that should
   be found first. Android is unaffected either way.


## Location deny-count pref key naming across platforms (2026-10-06)

The app's `PreferenceKeys.PERMISSION_DENY_COUNT` (value `deny_count`) drives the "denied twice →
Recovery" rule. Android stores it as `fc_sdk_deny_count` (matches the app value). The 2026-10-06
ports added it on the other platforms in each package's own convention: web `fc_sdk_deny_count`,
iOS `fc_sdk_PERMISSION_DENY_COUNT`, react-native `PERMISSION_DENY_COUNT`. Conservative reading
implemented (same semantics, per-package naming). Open: align iOS/RN to the app's `deny_count`
value? Only matters if a host ever migrates prefs between platforms — none does today.


## Web widget can't pin the v2 web SDK by version (2026-10-08)

`@digitalgreenorg/farmerchat-widget` (`versions/v2/web/widget`) declares the web SDK as a peer
dependency (its ESM build keeps the SDK external). Both web lines, v1 `web/` and v2
`versions/v2/web/`, are published as `@digitalgreenorg/farmerchat-web@1.0.0`, so a semver
range cannot require v2. The conservative reading is implemented: peer `^1.0.0`, plus a README
note that the widget is built and verified against v2. The IIFE bundle is unaffected because it
embeds v2. Open: bump v2 web to `2.0.0` (as Android did) so the peer range can say `^2.0.0`?

## Weather icons are served with the wrong Content-Type (2026-10-08)

`weather_icon` URLs (e.g. `…/FARMER_CHAT/weather_icons/v2/mist.svg` on the dev S3 bucket) return
`Content-Type: binary/octet-stream` and no `Access-Control-Allow-Origin`. Android's `SvgImage` parses
the bytes itself, so it renders; a browser `<img>` refuses an SVG with that type and `fetch()` cannot
read it cross-origin. Web v2 falls back to the app's `fc_weather_sunclouds` drawable. Ask: serve the
icons as `image/svg+xml` (and ideally with CORS) so web shows the real condition icon.

## A guest the backend no longer recognises never recovers (2026-10-08)

When the stored guest's tokens are rejected and the guest fallback `send_tokens` answers
**400 "User not found or inactive."** (seen when a session from another backend survives, or a guest
is deleted server-side), every platform clears the tokens and fires `onSessionExpired`, but keeps
the stale `user_id` and never re-runs `initialize_user` — so every later request repeats the same
401 → `send_tokens` 400 loop and Home shows "Can't load right now". The base-URL wipe (docs/04,
2026-10-08) prevents the environment-switch case. Open: should a 400 from `send_tokens` for a
guest (no phone login) wipe the session and re-initialise a new guest? Not done without a decision —
it would change docs/02's 401 flow on all platforms. The widget demo has a "Reset session" test
control for now.
