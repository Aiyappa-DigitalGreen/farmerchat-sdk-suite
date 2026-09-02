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
