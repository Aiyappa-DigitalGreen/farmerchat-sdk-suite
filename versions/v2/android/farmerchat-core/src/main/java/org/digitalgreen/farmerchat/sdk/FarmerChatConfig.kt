package org.digitalgreen.farmerchat.sdk

import androidx.annotation.ColorInt

/**
 * Server environment for the FarmerChat SDK. Base URLs mirror the production app flavors.
 */
enum class FarmerChatEnvironment(val baseUrl: String) {
    DEV("https://farmerchat.farmstack.co/mobile-app-dev/"),
    // STAGE base URL switched to the agentic demo backend (requested 2026-09-08). It applies to
    // BOTH debug and release — the SDK has one base URL per environment, not per build type.
    // The previous farmstack stage host is kept immediately below, commented, so this is a
    // one-line revert.
    //   STAGE("https://farmerchat.farmstack.co/mobile-app-stage/"),
    // The trailing slash is REQUIRED: every path is joined as `baseUrl + "api/..."`, so without
    // it the first request would resolve to `...farmer.chatapi/user/...`.
    STAGE("https://demo.agent.farmer.chat/"),
    DEMO("https://farmerchat.farmstack.co/mobile-app-demo/"),
    PROD("https://v2.api.farmer.chat/"),
    EKS("https://api.farmerchat.in/");

    companion object {
        fun fromString(value: String): FarmerChatEnvironment = when (value.trim().lowercase()) {
            "dev" -> DEV
            "stage" -> STAGE
            "demo" -> DEMO
            "prod", "production" -> PROD
            "eks" -> EKS
            else -> throw IllegalArgumentException("Unknown FarmerChat environment: $value")
        }
    }
}

/** UI appearance mode, mirrors the app's AppearanceMode pref (Day/Night/Auto). */
enum class FarmerChatAppearance { DAY, NIGHT, AUTO }

/**
 * Identity source (C2). [SDK_OTP] = today's behavior (SDK owns the phone/OTP flow).
 * [HOST_TOKEN] = the host is already authenticated and supplies the access token
 * (+ optional refresh) or a [FarmerChatConfig.tokenProvider]; the SDK skips the
 * phone/OTP UI and, on 401, asks the host for a fresh token instead of forcing OTP.
 */
enum class FarmerChatAuthMode { SDK_OTP, HOST_TOKEN }

/**
 * Journey scope (C3). [FULL_JOURNEY] = today's behavior (splash → language → name
 * → home → chat). [CHAT_ONLY] skips onboarding/home and lands directly in chat.
 */
enum class FarmerChatMode { FULL_JOURNEY, CHAT_ONLY }

/**
 * Semantic host callbacks (C4). All optional; complements the raw [onEvent]
 * analytics fan-out with higher-level lifecycle signals.
 */
class FarmerChatHooks internal constructor(
    val onChatOpened: (() -> Unit)?,
    val onMessageSent: ((text: String) -> Unit)?,
    val onAnswerReceived: ((messageId: String) -> Unit)?,
    val onScreenView: ((name: String) -> Unit)?,
    val onError: ((code: Int, message: String) -> Unit)?,
    val onSessionStart: (() -> Unit)?,
    /** The user picked a language inside the SDK (id + code as the backend knows them). */
    val onLanguageChanged: ((languageId: Int, languageCode: String) -> Unit)? = null,
)

/**
 * Host-pluggable analytics sink. The SDK emits every analytics event the production app
 * tracks (same names, same property keys) through this listener; no third-party
 * analytics SDKs are bundled.
 */
fun interface FarmerChatAnalyticsListener {
    fun onEvent(name: String, properties: Map<String, Any?>)
}

/**
 * Immutable SDK configuration passed to [FarmerChat.initialize].
 */
class FarmerChatConfig private constructor(
    val environment: FarmerChatEnvironment,
    /**
     * Optional custom base URL. When non-null (and non-blank) it OVERRIDES
     * [environment]'s base URL for the main + token Retrofit clients. Lets a host
     * point the SDK at its own backend (and lets samples target a local mock).
     * Must end with `/` (Retrofit requirement).
     */
    val customBaseUrl: String?,
    /** Google Geolocation API key used for the language auto-detect fallback (geolocate). */
    val geoApiKey: String?,
    /** Overrides the built-in guest-init / send_tokens `API-Key` header value. */
    val guestApiKey: String?,
    val appearance: FarmerChatAppearance,
    /** Preselect a language code; when it matches a supported language the language screen is skipped. */
    val languageCode: String?,
    /**
     * OPTIONAL override for the country used in the language list when `initialize_user` returns
     * a null/blank `country_code` (the normal case for a fresh guest on an IP the backend cannot
     * resolve — verified live 2026-09-03 on prod).
     *
     * **Leave this empty (the default) and the SDK derives the country from the device locale**,
     * exactly as the app does. Endpoint #2 rejects a blank `country_code` with HTTP 400, so if the
     * locale carries no region either, [LAST_RESORT_COUNTRY_CODE] is sent.
     *
     * Set it only to pin the SDK to one region regardless of where the device is.
     */
    val defaultCountryCode: String,
    /**
     * OPTIONAL `state` query param for endpoint #2. Empty by default and safe to leave empty:
     * the parameter is inert on every environment (verified live 2026-09-03).
     */
    val defaultStateCode: String,
    /**
     * OPTIONAL override for the coordinates posted to endpoint #11 when nothing else resolved a
     * location. **Leave these at [COORDINATE_UNSET] (the default) and the SDK uses the device
     * locale's country centroid**, exactly as the app does on IP-geolocation failure.
     *
     * Endpoint #12 (home feed) is gated on the backend having a resolved location, and the
     * backend resolves it ONLY from coordinates — a country name alone is rejected (verified
     * live 2026-09-01: `{user_id, country, level_2}` left the profile empty and the feed at 0
     * sections, while `{user_id, lat, long}` produced 21). That is why coordinates are needed.
     *
     * If both these and the device locale are unset, NO coordinates are sent — a guess would put
     * the farmer's advice in the wrong place. Set them to pin a region deliberately.
     */
    val defaultLatitude: Double,
    val defaultLongitude: Double,
    val enableVoice: Boolean,
    val enableImages: Boolean,
    val enableWeather: Boolean,
    /**
     * Opt in to agentic streaming chat (SDK 2.0.0, endpoint #27a).
     *
     * Default **false**: on 2.0.0 artifacts a host that does nothing keeps the 1.0.0 synchronous
     * chat contract (#27) unchanged. When true, text queries stream — the answer accretes from
     * `text_delta` events and tool progress is surfaced as it happens.
     *
     * See versions/v2/README.md. The wire framing IS confirmed against a real stream as of
     * 2026-09-03 (docs/02 §#27a; the two captures under `docs/captures/` are replayed through the
     * production reader by `AgenticCaptureReplayTest`).
     */
    val enableAgenticChat: Boolean,
    /**
     * Master switch for TELEMETRY leaving the SDK. **Defaults to `false`.**
     *
     * When false, every analytics event, user identity and user attribute is built exactly as
     * normal — same names, same properties, same call sites, same order — and then dropped at the
     * single dispatch point instead of reaching [onEvent], [FarmerChatAnalyticsListener],
     * [onUserIdentified] or [onUserAttribute]. Nothing else changes: the SDK does not skip work,
     * take a different branch, or behave differently in any way that a farmer or the backend
     * could observe.
     *
     * The C4 semantic hooks (`onChatOpened`, `onMessageSent`, `onAnswerReceived`, `onScreenView`,
     * `onError`) are **NOT** gated by this. They are product callbacks a host wires for behaviour,
     * not telemetry to an analytics vendor, and silencing them would be a functional regression.
     *
     * ⚠️ This default is deliberately OFF and is a behaviour change for hosts that were already
     * receiving events: set `.enableAnalytics(true)` to restore delivery. It exists so an
     * integration can be wired end-to-end and reviewed before any data is emitted.
     */
    val enableAnalytics: Boolean,
    /**
     * Whether Home and Chat use the unified floating InputComposer instead of the legacy
     * Photo/Speak/Type button row.
     *
     * Mirrors the app's `v2_composer_ui_enabled` RemoteConfig flag
     * (`core/constants/RemoteConfigKeys.kt`), which the app documents as **independent** of
     * `v2_agentic_chat_enabled`: it "only controls the composer UI, not which API the query is
     * routed to".
     *
     * **`null` (the default) means "follow [enableAgenticChat]"** — exactly what every UI
     * artifact hardcoded before this knob existed, so an existing host sees no change. Set it
     * explicitly to decouple the two: composer UI with synchronous #27 chat
     * (`enableComposerUi(true)` + `enableAgenticChat(false)`), or the legacy input row with
     * agentic streaming (`enableComposerUi(false)` + `enableAgenticChat(true)`).
     *
     * Read it through [resolvedComposerUi], never directly.
     */
    val enableComposerUi: Boolean?,
    /**
     * Present SYNCHRONOUS (#27) answers with the agentic chat UI, for a backend that does not
     * serve #27a yet. **Default false.**
     *
     * The wire is unchanged: one synchronous #27 request, one JSON reply. Only the presentation
     * follows the agentic path — the "getting your answer" status while waiting, the answer
     * revealed word by word, the agentic action row (accuracy note, Share, Listen), and the
     * stream error card with retry on failure. Also turns the composer on when
     * [enableComposerUi] is left `null`. Ignored when [enableAgenticChat] is true (a real
     * stream wins).
     */
    val simulateAgenticStream: Boolean = false,
    /**
     * Minimum time the splash/loading screen stays visible, in milliseconds.
     *
     * The splash's real job is to cover the session bootstrap (guest init, conversation, labels).
     * On a fast network that finishes in well under a second, so the screen flashes past — which
     * reads as a glitch rather than as loading, especially when the SDK is opened from a host's
     * FAB and the user has no idea what is starting up.
     *
     * This is a FLOOR, not a delay that is added on top: if the bootstrap already took longer,
     * nothing extra is waited. [DEFAULT_MIN_SPLASH_DURATION_MS] preserves the historical
     * behaviour, so an existing host sees no change.
     */
    val minSplashDurationMs: Long,
    /** Analytics fan-out callback (same payloads as [FarmerChatAnalyticsListener]). */
    val onEvent: ((name: String, props: Map<String, Any?>) -> Unit)?,
    /**
     * User IDENTITY callback. Invoked with the FarmerChat user id whenever the SDK resolves or
     * changes it (guest init, CHAT_ONLY bootstrap, OTP verification) — the app's
     * `AnalyticsUserIdentityManager.identifyUser()` moment.
     *
     * Identity is not an event, so [onEvent] structurally cannot carry it: a host wiring
     * MoEngage `identifyUser` / Firebase `setUserId` / Plotline `init` needs this hook. The SDK
     * bundles no vendor SDK (root CLAUDE.md §6) — it only hands over the id.
     * Never called with a blank id. Exceptions thrown by the host are swallowed.
     */
    val onUserIdentified: ((userId: String) -> Unit)?,
    /**
     * User ATTRIBUTE callback — a user PROPERTY, not an event property, so again outside what
     * [onEvent] can express. Keys are the app's own
     * (`core/analytics/UserAttributeKeys.kt`, mirrored in
     * [org.digitalgreen.farmerchat.sdk.core.analytics.UserAttributeKeys]); a host forwards them
     * to MoEngage `setUserAttribute` / Firebase `setUserProperty` / whatever it uses.
     *
     * Values are `String` deliberately: everything the SDK raises today is a string. The app
     * also tracks booleans/ints on OTHER keys, so a future lane widening this to `Any?` is a
     * source-breaking change — see docs/04-parity-matrix.md. Never called with a blank key or
     * value. Exceptions thrown by the host are swallowed.
     */
    val onUserAttribute: ((key: String, value: String) -> Unit)?,
    /** Invoked when both token refresh and the guest-token fallback fail (session unrecoverable). */
    val onSessionExpired: (() -> Unit)?,
    /** Enables OkHttp body logging. Never enable in production builds. */
    val debugLogging: Boolean,
    /** Optional host theme. `null` = built-in FarmerChat green brand. */
    val theme: FarmerChatTheme?,

    // --- C2: host identity injection --------------------------------------
    val authMode: FarmerChatAuthMode,
    /** HOST_TOKEN: initial access token to seed. */
    val accessToken: String?,
    /** HOST_TOKEN: optional initial refresh token. */
    val refreshToken: String?,
    /** HOST_TOKEN: called on 401 to obtain a fresh access token (null ⇒ session expired). */
    val tokenProvider: (() -> String?)?,

    // --- C3: screen/feature toggles ---------------------------------------
    val mode: FarmerChatMode,
    val showSettings: Boolean,
    val showHistory: Boolean,
    val showDrawer: Boolean,
    /**
     * Whether onboarding shows the "What should we call you?" screen.
     *
     * Mirrors the app's `show_name_screen` RemoteConfig flag, which `RouteDecider` already
     * models. Set false together with [locale] to land a fresh install straight on Home:
     * `locale` clears the language gate, this clears the name gate, and `routeFromSplash()`
     * then falls through to Home. Nothing about geolocation, guest init or the API flow changes.
     */
    val showNameScreen: Boolean,
    val enableSsfr: Boolean,

    // --- FAB customization (config-level defaults; per-instance params win) -
    /** Default launcher label; null = round icon-only FAB (current behavior). */
    val fabLabel: String?,
    /** Default launcher background as an ARGB color int; null = theme brand. */
    val fabBackgroundColor: Int?,
    /** Default launcher icon/text color as an ARGB color int; null = on-brand. */
    val fabContentColor: Int?,

    // --- Chat UI customization (config-level; null = current theme behavior) -
    /** User message bubble background (ARGB int); null = theme default. */
    val userBubbleColor: Int?,
    /** User message bubble text color (ARGB int); null = theme default. */
    val userBubbleTextColor: Int?,
    /** AI message body text color (ARGB int); null = theme default. */
    val aiBubbleTextColor: Int?,
    /** Message bubble corner radius in dp; null = theme default. */
    val bubbleCornerRadius: Int?,
    /** Chat message body font size in sp; null = theme default. */
    val messageFontSizeSp: Float?,

    // --- C4: semantic event hooks -----------------------------------------
    val hooks: FarmerChatHooks,

    // --- C5: host string overrides + forced locale ------------------------
    /** Highest-precedence label overrides (labelKey → string), win over server labels. */
    val stringOverrides: Map<String, String>,
    /** Force this language code regardless of device/onboarding. */
    val locale: String?,

    /**
     * Host backend path overrides: SDK path → host path, both relative to the base URL
     * (e.g. `"api/language/v2/get_labels/" to "api/language/get_labels/"`). For hosts whose
     * backend serves an endpoint under an older/different path. Empty = SDK paths unchanged.
     */
    val endpointOverrides: Map<String, String> = emptyMap()
) {

    /** The base URL actually used: [customBaseUrl] when set (non-blank), else [environment]'s. */
    val resolvedBaseUrl: String
        get() = customBaseUrl?.takeIf { it.isNotBlank() } ?: environment.baseUrl

    /**
     * Whether the unified InputComposer is shown: the host's explicit [enableComposerUi], else
     * [enableAgenticChat] (the historical collapse) or [simulateAgenticStream].
     *
     * Every UI call site MUST read this rather than [enableComposerUi] directly — that field
     * defaults to `null` meaning "derive", and a raw read is a nullable Boolean, not a decision.
     */
    val resolvedComposerUi: Boolean
        get() = enableComposerUi ?: (enableAgenticChat || simulateAgenticStream)

    fun newBuilder(): Builder = Builder(environment)
        .customBaseUrl(customBaseUrl)
        .geoApiKey(geoApiKey)
        .guestApiKey(guestApiKey)
        .appearance(appearance)
        .languageCode(languageCode)
        .enableVoice(enableVoice)
        .enableImages(enableImages)
        .enableWeather(enableWeather)
        // RC-mirroring knobs: these MUST round-trip or newBuilder() silently resets a host's
        // feature gating back to the defaults.
        .enableAgenticChat(enableAgenticChat)
        .enableAnalytics(enableAnalytics)
        .enableComposerUi(enableComposerUi)
        .simulateAgenticStream(simulateAgenticStream)
        .showNameScreen(showNameScreen)
        .onEvent(onEvent)
        .onUserIdentified(onUserIdentified)
        .onUserAttribute(onUserAttribute)
        .onSessionExpired(onSessionExpired)
        .debugLogging(debugLogging)
        .theme(theme)
        .authMode(authMode)
        .accessToken(accessToken)
        .refreshToken(refreshToken)
        .tokenProvider(tokenProvider)
        .mode(mode)
        .showSettings(showSettings)
        .showHistory(showHistory)
        .showDrawer(showDrawer)
        .enableSsfr(enableSsfr)
        .fabLabel(fabLabel)
        .fabBackgroundColor(fabBackgroundColor)
        .fabContentColor(fabContentColor)
        .userBubbleColor(userBubbleColor)
        .userBubbleTextColor(userBubbleTextColor)
        .aiBubbleTextColor(aiBubbleTextColor)
        .bubbleCornerRadius(bubbleCornerRadius)
        .messageFontSizeSp(messageFontSizeSp)
        .onChatOpened(hooks.onChatOpened)
        .onMessageSent(hooks.onMessageSent)
        .onAnswerReceived(hooks.onAnswerReceived)
        .onScreenView(hooks.onScreenView)
        .onError(hooks.onError)
        .onSessionStart(hooks.onSessionStart)
        .stringOverrides(stringOverrides)
        .locale(locale)
        .onLanguageChanged(hooks.onLanguageChanged)
        .endpointOverrides(endpointOverrides)

    class Builder(private val environment: FarmerChatEnvironment) {
        private var customBaseUrl: String? = null
        private var geoApiKey: String? = null
        private var guestApiKey: String? = null
        private var appearance: FarmerChatAppearance = FarmerChatAppearance.AUTO
        private var languageCode: String? = null
        // All four default to "unset" — resolved from the device locale at use time, the way the
        // app does it. A host that sets them explicitly still wins.
        private var defaultCountryCode: String = ""
        private var defaultStateCode: String = DEFAULT_STATE_CODE
        private var defaultLatitude: Double = COORDINATE_UNSET
        private var defaultLongitude: Double = COORDINATE_UNSET
        private var enableVoice: Boolean = true
        private var enableImages: Boolean = true
        private var enableWeather: Boolean = true
        private var enableAgenticChat: Boolean = false
        private var enableAnalytics: Boolean = false
        private var enableComposerUi: Boolean? = null
        private var simulateAgenticStream: Boolean = false
        private var minSplashDurationMs: Long = DEFAULT_MIN_SPLASH_DURATION_MS
        private var onEvent: ((String, Map<String, Any?>) -> Unit)? = null
        private var onUserIdentified: ((String) -> Unit)? = null
        private var onUserAttribute: ((String, String) -> Unit)? = null
        private var onSessionExpired: (() -> Unit)? = null
        private var debugLogging: Boolean = false
        private var theme: FarmerChatTheme? = null

        private var authMode: FarmerChatAuthMode = FarmerChatAuthMode.SDK_OTP
        private var accessToken: String? = null
        private var refreshToken: String? = null
        private var tokenProvider: (() -> String?)? = null

        private var mode: FarmerChatMode = FarmerChatMode.FULL_JOURNEY
        private var showSettings: Boolean = true
        private var showHistory: Boolean = true
        private var showDrawer: Boolean = true
        private var showNameScreen: Boolean = true
        private var enableSsfr: Boolean = true

        private var fabLabel: String? = null
        private var fabBackgroundColor: Int? = null
        private var fabContentColor: Int? = null

        private var userBubbleColor: Int? = null
        private var userBubbleTextColor: Int? = null
        private var aiBubbleTextColor: Int? = null
        private var bubbleCornerRadius: Int? = null
        private var messageFontSizeSp: Float? = null

        private var onChatOpened: (() -> Unit)? = null
        private var onMessageSent: ((String) -> Unit)? = null
        private var onAnswerReceived: ((String) -> Unit)? = null
        private var onScreenView: ((String) -> Unit)? = null
        private var onError: ((Int, String) -> Unit)? = null
        private var onSessionStart: (() -> Unit)? = null
        private var onLanguageChanged: ((Int, String) -> Unit)? = null
        private var endpointOverrides: Map<String, String> = emptyMap()

        private var stringOverrides: Map<String, String> = emptyMap()
        private var locale: String? = null

        /** Override the environment base URL (e.g. a local mock or a host backend). Must end with `/`. */
        fun customBaseUrl(url: String?) = apply { customBaseUrl = url }
        fun geoApiKey(key: String?) = apply { geoApiKey = key }
        fun guestApiKey(key: String?) = apply { guestApiKey = key }
        fun appearance(mode: FarmerChatAppearance) = apply { appearance = mode }
        fun languageCode(code: String?) = apply { languageCode = code }
        /** Fallback country for the language list when the backend cannot resolve one. Blank values are ignored. */
        fun defaultCountryCode(code: String) = apply { if (code.isNotBlank()) defaultCountryCode = code }
        /** Fallback state/region paired with [defaultCountryCode]. Blank values are ignored. */
        fun defaultStateCode(code: String) = apply { if (code.isNotBlank()) defaultStateCode = code }
        /** Coordinates representing the fallback region; used to seed #11 when no GPS is available. */
        fun defaultLocation(lat: Double, long: Double) = apply {
            defaultLatitude = lat
            defaultLongitude = long
        }
        fun enableVoice(enabled: Boolean) = apply { enableVoice = enabled }
        fun enableImages(enabled: Boolean) = apply { enableImages = enabled }
        fun enableWeather(enabled: Boolean) = apply { enableWeather = enabled }
        /** Opt in to agentic streaming chat (2.0.0, endpoint #27a). Default false. */
        fun enableAgenticChat(enabled: Boolean) = apply { enableAgenticChat = enabled }

        /**
         * Let analytics events, user identity and user attributes reach the host. Default
         * **false** — see [FarmerChatConfig.enableAnalytics]. Semantic hooks are unaffected.
         */
        fun enableAnalytics(enabled: Boolean) = apply { enableAnalytics = enabled }

        /**
         * Show the unified InputComposer in Home/Chat, independently of [enableAgenticChat]
         * (the app's `v2_composer_ui_enabled` flag). `null` = follow [enableAgenticChat],
         * which is the historical behaviour.
         */
        fun enableComposerUi(enabled: Boolean?) = apply { enableComposerUi = enabled }

        /**
         * Agentic chat UI over the synchronous #27 endpoint (no streaming on the wire). Default
         * false — see [FarmerChatConfig.simulateAgenticStream].
         */
        fun simulateAgenticStream(enabled: Boolean) = apply { simulateAgenticStream = enabled }

        /**
         * Keep the splash/loading screen up for at least [ms] milliseconds (a floor, not an
         * added delay). Negative values are clamped to 0.
         */
        fun minSplashDurationMs(ms: Long) = apply { minSplashDurationMs = ms.coerceAtLeast(0L) }
        fun onEvent(callback: ((String, Map<String, Any?>) -> Unit)?) = apply { onEvent = callback }

        /** Host sink for user IDENTITY (see [FarmerChatConfig.onUserIdentified]). */
        fun onUserIdentified(callback: ((String) -> Unit)?) = apply { onUserIdentified = callback }

        /** Host sink for user ATTRIBUTES (see [FarmerChatConfig.onUserAttribute]). */
        fun onUserAttribute(callback: ((String, String) -> Unit)?) =
            apply { onUserAttribute = callback }
        fun onSessionExpired(callback: (() -> Unit)?) = apply { onSessionExpired = callback }
        fun debugLogging(enabled: Boolean) = apply { debugLogging = enabled }
        /** Supply a host [FarmerChatTheme] to recolor/restyle the whole journey. */
        fun theme(theme: FarmerChatTheme?) = apply { this.theme = theme }

        // C2 -------------------------------------------------------------
        fun authMode(mode: FarmerChatAuthMode) = apply { authMode = mode }
        fun accessToken(token: String?) = apply { accessToken = token }
        fun refreshToken(token: String?) = apply { refreshToken = token }
        fun tokenProvider(provider: (() -> String?)?) = apply { tokenProvider = provider }

        // C3 -------------------------------------------------------------
        fun mode(mode: FarmerChatMode) = apply { this.mode = mode }
        fun showSettings(show: Boolean) = apply { showSettings = show }
        fun showHistory(show: Boolean) = apply { showHistory = show }
        fun showDrawer(show: Boolean) = apply { showDrawer = show }
        /** Show the onboarding name screen. False + [locale] lands a fresh install on Home. */
        fun showNameScreen(show: Boolean) = apply { showNameScreen = show }
        fun enableSsfr(enabled: Boolean) = apply { enableSsfr = enabled }

        // FAB customization ----------------------------------------------
        /** Default launcher label; null = round icon-only FAB. */
        fun fabLabel(label: String?) = apply { fabLabel = label }
        /** Default launcher background as an ARGB color int; null = theme brand. */
        fun fabBackgroundColor(@ColorInt color: Int?) = apply { fabBackgroundColor = color }
        /** Default launcher icon/text color as an ARGB color int; null = on-brand. */
        fun fabContentColor(@ColorInt color: Int?) = apply { fabContentColor = color }

        // Chat UI customization ------------------------------------------
        fun userBubbleColor(@ColorInt color: Int?) = apply { userBubbleColor = color }
        fun userBubbleTextColor(@ColorInt color: Int?) = apply { userBubbleTextColor = color }
        fun aiBubbleTextColor(@ColorInt color: Int?) = apply { aiBubbleTextColor = color }
        /** Message bubble corner radius in dp. */
        fun bubbleCornerRadius(dp: Int?) = apply { bubbleCornerRadius = dp }
        /** Chat message body font size in sp. */
        fun messageFontSizeSp(sp: Float?) = apply { messageFontSizeSp = sp }

        // C4 -------------------------------------------------------------
        fun onChatOpened(cb: (() -> Unit)?) = apply { onChatOpened = cb }
        fun onMessageSent(cb: ((String) -> Unit)?) = apply { onMessageSent = cb }
        fun onAnswerReceived(cb: ((String) -> Unit)?) = apply { onAnswerReceived = cb }
        fun onScreenView(cb: ((String) -> Unit)?) = apply { onScreenView = cb }
        fun onError(cb: ((Int, String) -> Unit)?) = apply { onError = cb }
        fun onSessionStart(cb: (() -> Unit)?) = apply { onSessionStart = cb }
        /** Language picked inside the SDK — keep the host's own language state in step. */
        fun onLanguageChanged(cb: ((languageId: Int, languageCode: String) -> Unit)?) =
            apply { onLanguageChanged = cb }

        /** SDK path → host path (relative to the base URL) for a host backend on other paths. */
        fun endpointOverrides(overrides: Map<String, String>) = apply { endpointOverrides = overrides }

        // C5 -------------------------------------------------------------
        fun stringOverrides(overrides: Map<String, String>) = apply { stringOverrides = overrides }
        fun locale(code: String?) = apply { locale = code }

        fun build(): FarmerChatConfig = FarmerChatConfig(
            environment = environment,
            customBaseUrl = customBaseUrl,
            geoApiKey = geoApiKey,
            guestApiKey = guestApiKey,
            appearance = appearance,
            languageCode = languageCode,
            defaultCountryCode = defaultCountryCode,
            defaultStateCode = defaultStateCode,
            defaultLatitude = defaultLatitude,
            defaultLongitude = defaultLongitude,
            enableVoice = enableVoice,
            enableImages = enableImages,
            enableWeather = enableWeather,
            enableAgenticChat = enableAgenticChat,
            enableAnalytics = enableAnalytics,
            enableComposerUi = enableComposerUi,
            simulateAgenticStream = simulateAgenticStream,
            minSplashDurationMs = minSplashDurationMs,
            onEvent = onEvent,
            onUserIdentified = onUserIdentified,
            onUserAttribute = onUserAttribute,
            onSessionExpired = onSessionExpired,
            debugLogging = debugLogging,
            theme = theme,
            authMode = authMode,
            accessToken = accessToken,
            refreshToken = refreshToken,
            tokenProvider = tokenProvider,
            mode = mode,
            showSettings = showSettings,
            showHistory = showHistory,
            showDrawer = showDrawer,
            showNameScreen = showNameScreen,
            enableSsfr = enableSsfr,
            fabLabel = fabLabel,
            fabBackgroundColor = fabBackgroundColor,
            fabContentColor = fabContentColor,
            userBubbleColor = userBubbleColor,
            userBubbleTextColor = userBubbleTextColor,
            aiBubbleTextColor = aiBubbleTextColor,
            bubbleCornerRadius = bubbleCornerRadius,
            messageFontSizeSp = messageFontSizeSp,
            hooks = FarmerChatHooks(
                onChatOpened, onMessageSent, onAnswerReceived,
                onScreenView, onError, onSessionStart, onLanguageChanged
            ),
            stringOverrides = stringOverrides,
            locale = locale,
            endpointOverrides = endpointOverrides
        )
    }

    /**
     * The country code to send when the caller has none: the host's explicit [defaultCountryCode],
     * else the DEVICE LOCALE's region, else [LAST_RESORT_COUNTRY_CODE]. **Never blank** — endpoint
     * #2 rejects a blank `country_code` with HTTP 400.
     *
     * Every caller that needs a fallback country must use this rather than reading
     * [defaultCountryCode] directly. That field defaults to "" (meaning "derive"), so a raw read
     * sends a blank value and 400s — which is exactly the bug this method exists to prevent.
     */
    fun resolvedFallbackCountryCode(context: android.content.Context): String =
        resolvedFallbackCountryCode(
            org.digitalgreen.farmerchat.sdk.core.location.CountryLatLngProvider
                .fromDeviceLocale(context).first
        )

    /**
     * The pure chain behind [resolvedFallbackCountryCode], with the device locale's region passed
     * in so it can be unit-tested without a `Context` (a mocked one returns a null `resources`).
     */
    internal fun resolvedFallbackCountryCode(localeRegion: String): String =
        defaultCountryCode.takeIf { it.isNotBlank() }
            ?: localeRegion.takeIf { it.isNotBlank() }
            ?: LAST_RESORT_COUNTRY_CODE

    /**
     * The coordinates to seed when nothing else resolved a location: the host's explicit
     * [defaultLatitude]/[defaultLongitude], else the device locale's country centroid.
     *
     * Returns (0.0, 0.0) when neither is available — callers MUST check
     * [org.digitalgreen.farmerchat.sdk.core.location.CountryLatLngProvider.isResolved] and send
     * nothing rather than post it. (0, 0) is a real point in the Gulf of Guinea.
     */
    fun resolvedFallbackCoordinates(context: android.content.Context): Pair<Double, Double> {
        val provider = org.digitalgreen.farmerchat.sdk.core.location.CountryLatLngProvider
        if (provider.isResolved(defaultLatitude, defaultLongitude)) {
            return defaultLatitude to defaultLongitude
        }
        val (_, lat, lng) = provider.fromDeviceLocale(context)
        return lat to lng
    }

    companion object {
        /**
         * LAST-RESORT country for endpoint #2, used only when the server returned none, nothing
         * is persisted, the host configured none, AND the device locale carries no region.
         *
         * The endpoint 400s on a blank value (verified live 2026-09-03: `country_code=` →
         * `{"error": "Country code is required"}`), so *something* non-blank must be sent. The app
         * does the same thing on its primary guest-init path, where the literal is `"KE"`
         * (`ui/onboarding/language/OnboardingSharedViewModel.kt` — its cached-geo retry path uses
         * `"IN"`). `"KE"` also matches the live data: dev, stage, prod and eks all return Kenya
         * only (verified live 2026-09-03).
         *
         * This is a floor, not a default. The normal answer comes from the device locale via
         * [org.digitalgreen.farmerchat.sdk.core.location.CountryLatLngProvider], exactly as the app
         * does — see [Builder.defaultCountryCode].
         */
        const val LAST_RESORT_COUNTRY_CODE = "KE"

        /**
         * No default state is invented.
         *
         * Endpoint #2's `state` is inert on every environment — dev, stage, prod and eks all
         * return the identical set for `state=Karnataka`, `state=KA`, `state=` and the parameter
         * omitted (verified live 2026-09-03). An earlier build shipped `"Karnataka"` as a default,
         * which is both unfaithful to the app and wrong for a Kenya-only backend.
         */
        const val DEFAULT_STATE_CODE = ""

        /**
         * Sentinel meaning "no coordinates configured — derive them from the device locale".
         *
         * The app has NO hardcoded coordinates: on IP-geolocation failure it calls
         * `CountryLatLngProvider.getLatLngFromDeviceLocale(context)` and uses that country's
         * centroid, accepting it only when `lat != 0.0 && lng != 0.0`. An earlier build of this
         * SDK shipped Bengaluru (12.9716, 77.5946) as a hardcoded default, which sent every
         * unplaceable guest advice for Karnataka regardless of where they actually are.
         *
         * Endpoint #12 (home feed) is gated on the backend having resolved a location, and it
         * resolves one ONLY from coordinates — a country name alone is rejected (verified live
         * 2026-09-01) — which is why coordinates are needed at all.
         */
        const val COORDINATE_UNSET = 0.0

        /**
         * Historical minimum splash duration (ms). Kept as the default so adding
         * [Builder.minSplashDurationMs] changes nothing for an existing host.
         */
        const val DEFAULT_MIN_SPLASH_DURATION_MS = 200L

        @JvmStatic
        fun builder(environment: FarmerChatEnvironment): Builder = Builder(environment)
    }
}
