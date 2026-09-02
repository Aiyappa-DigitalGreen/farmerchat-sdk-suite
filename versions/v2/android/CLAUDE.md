# Android rules (adds to root CLAUDE.md — read that first)

- Namespace `org.digitalgreen.farmerchat.sdk.*`; minSdk 26, compileSdk 36 (androidx.activity 1.13+ requires 36), Kotlin 2.x.
- `farmerchat-core` must have ZERO Compose/Views dependencies — it is shared by both UI artifacts. All ViewModels/state machines live in core over kotlinx `StateFlow`.
- Port UDF Action/State classes 1:1 from the app (`ui/*/udf/`); do not rename actions or state fields.
- Interceptor order is fixed: RequestId → PriorityHeader → TimeoutClone → AuthHeader → Logging(debug) + `.authenticator(TokenAuthenticator)`.
- SharedPreferences file + keys prefixed `fc_sdk_`; never touch default prefs.
- Compose package and Views package must expose identical entry APIs (`FarmerChatActivity`, `FarmerChatRoot()`/`FarmerChatFragment`).
- SMS Retriever + WhatsApp OTP SDK stay optional (reflection / play-services optional dep) — absence must never crash.
- Verify: `./gradlew :farmerchat-core:compileDebugKotlin` minimum before claiming done; record result in docs/04.
