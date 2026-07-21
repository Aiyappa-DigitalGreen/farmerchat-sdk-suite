# Screen Functionality Matrix

Derived from docs/01-app-specification.md. A "functionality" = one distinct user-facing capability or one distinct automatic behavior (API call, gate, or lifecycle action) of the screen. Every one of these must exist on every platform (or appear as a documented gap in docs/04).

**Total: 17 screens/surfaces · 123 functionalities**

| # | Screen | Count | Functionalities |
|---|--------|-------|-----------------|
| 1 | Splash | 6 | boot animation (rotating logo); system-bars hidden; min-duration gate (200 ms) + "starting…" toast after 2 s; pending-error gate (won't auto-route if an error is queued); startup analytics (App_Opened, identify user, BUILD_VERSION); auto-route via `routeFromSplash()` decision tree |
| 2 | Language onboarding | 9 | geo-detect country (Google geolocate, P1 fallback); fetch supported languages (priority list); expand "All languages"; select language (debounced); per-language label fetch (server-driven strings); legal links fetch + Terms/Privacy WebView; accept terms (API); submit language (API) → route onward; loading/silent-retry states + analytics |
| 3 | Enter Name | 7 | fetch profile (when logged in, prefer server name); name input with normalization (letters/single spaces); validation (min 3 / max 100 + error toast); save name (update-profile API); skip-for-now (hidden once typing starts); keyboard autofocus; success routing + analytics |
| 4 | Auth (Phone + OTP) | 15 | auto-detect country from location; fetch country list; searchable country picker; SIM number prefill (permission-gated); manual country-code entry; per-country phone validation (length/pattern); OTP channel discovery (SMS/WhatsApp per country); send OTP via SMS; send OTP via WhatsApp (OTP-less SDK handoff); 4-digit OTP input; 180 s countdown timer; resend / start-over after timeout; SMS auto-read (Retriever API); verify OTP → token save + login state; device-limit check + analytics per step |
| 5 | AccountBenefits | 3 | sign-up CTA → Auth (offline-gated → error screen); skip/back dismiss; screen analytics (Plotline-only) |
| 6 | AccountSuccess | 3 | continue → Home (back-stack cleared); hardware-back handled identically; analytics (Signup_Continue_Clicked) |
| 7 | Home | 16 | personalized greeting (+skeleton); weather chip (temp+icon) → weather-advice chat (location-gated); daily feed load (per-device-time); content cards → pre-generated chat; single-select card (gender) → profile update; multi-select cards (crops/livestock) → profile update; SSFR card (wheat/maize) → SSFR chat; card dismiss; mark-viewed impressions (≥50% visible); photo input (camera/gallery + permission deny counting → settings dialog); voice input (record → server transcription, confidence>0.7); text input; new-conversation bootstrap; feed error UI + retry; drawer (hamburger); push-permission prompt after feed (5 s) + scroll-to-card deep-link handling |
| 8 | Chat | 17 | 5 entry modes (text question / pre-generated answer / image question / voice-only / history conversation); send follow-up text; follow-up question chips (fetched separately + click tracking); send image question (camera/gallery); send voice question (record→transcribe→send); clarification-required labels; retry failed message; "Read full advice" (replace pre-generated with live answer); Listen (server TTS → audio playback with play/pause + listened-seconds analytics); voice-clip bubbles (play/pause, duration, position); share answer card (rendered to PNG); download answer card (to gallery/files); history pagination (load older + scroll-position restore); scroll-to-bottom indicator; audio auto-pause on background (ON_STOP); error state with question preserved + re-ask inputs; close/back navigation by entry source |
| 9 | ChatHistory | 6 | grouped conversation list (server grouping headers); per-type icons (text/audio/image/card); infinite-scroll pagination; refresh on entry; open conversation → Chat; initial-load error → error screen vs inline pagination retry |
| 10 | Drawer (shared) | 6 | navigate to Home/Settings/Language/Help/Recent Chats; recent 8 questions (typed icons) → reopen chat; current-question highlight; sign-up CTA (question-count API decides interstitial bypass); history error + retry; silent refresh on open |
| 11 | Settings | 6 | appearance Day/Night/Auto (persisted + theme attr tracking); profile fetch on entry; "Your name" row → name editor; sign-up (guest) with interstitial-bypass logic; logout (API + full pref/identity teardown → Splash); "name updated" toast |
| 12 | SettingsName | 4 | prefilled name input (normalized); validation (3–100 + error toast); save (API) → persist + return; back navigation |
| 13 | LanguageChooser | 6 | load languages (priority + expandable); select → fetch labels for that language (per-row loading); save language (API); success → toast + Home (back-stack cleared); label-fetch failure → Home fallback; analytics (preferred-language attr) |
| 14 | Help | 5 | FAQ list fetch (lang/theme/country-aware, skeleton loading); FAQ item → WebView dialog; Terms/Privacy links → WebView; version + copyright footer; error → error screen with retry token |
| 15 | Error / NoInternet | 3 | typed copy (no-internet vs API-error, full-screen green layout); Try Again with per-source retry semantics (7 different `fromScreen` behaviors); debounced primary CTA |
| 16 | LocationPrompt (overlay) | 8 | share-location interstitial (Share/Skip/Back); runtime permission request; GPS-enable system resolution; fresh location fetch (10 s + 1 retry) → last-known fallback; server location update (logged-in) vs local save (guest); recovery bottom-sheet → app settings; 3 typed error screens (no-network/GPS-unavailable/failed); campaign frequency gating + GPS analytics + ON_RESUME permission recheck |
| 17 | LegalContent (dialog) | 3 | WebView with JS (Terms/Privacy/FAQ, title switching); loading spinner; close/back dismiss + parent page re-track |

## Cross-cutting (not screen-bound, must also exist everywhere)
- Guest initialization (device-id → tokens) on first run — 1
- Token refresh + guest-token fallback on 401 (transparent) — 1
- Server-driven label resolution for every string — 1
- Analytics event emission (~90 named events) via host listener — 1
- Deep-link/`openChat` routing (pending-target queue through onboarding) — 1
- Appearance mode + language code reactive re-theming — 1

Grand total including cross-cutting: **129**.
