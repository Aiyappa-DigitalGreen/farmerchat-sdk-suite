package org.digitalgreen.farmerchat.sdk

/**
 * Server environment for the FarmerChat SDK. Base URLs mirror the production app flavors.
 */
enum class FarmerChatEnvironment(val baseUrl: String) {
    DEV("https://farmerchat.farmstack.co/mobile-app-dev/"),
    STAGE("https://farmerchat.farmstack.co/mobile-app-stage/"),
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
    val enableVoice: Boolean,
    val enableImages: Boolean,
    val enableWeather: Boolean,
    /** Analytics fan-out callback (same payloads as [FarmerChatAnalyticsListener]). */
    val onEvent: ((name: String, props: Map<String, Any?>) -> Unit)?,
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
    val enableSsfr: Boolean,

    // --- C4: semantic event hooks -----------------------------------------
    val hooks: FarmerChatHooks,

    // --- C5: host string overrides + forced locale ------------------------
    /** Highest-precedence label overrides (labelKey → string), win over server labels. */
    val stringOverrides: Map<String, String>,
    /** Force this language code regardless of device/onboarding. */
    val locale: String?
) {

    /** The base URL actually used: [customBaseUrl] when set (non-blank), else [environment]'s. */
    val resolvedBaseUrl: String
        get() = customBaseUrl?.takeIf { it.isNotBlank() } ?: environment.baseUrl

    fun newBuilder(): Builder = Builder(environment)
        .customBaseUrl(customBaseUrl)
        .geoApiKey(geoApiKey)
        .guestApiKey(guestApiKey)
        .appearance(appearance)
        .languageCode(languageCode)
        .enableVoice(enableVoice)
        .enableImages(enableImages)
        .enableWeather(enableWeather)
        .onEvent(onEvent)
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
        .onChatOpened(hooks.onChatOpened)
        .onMessageSent(hooks.onMessageSent)
        .onAnswerReceived(hooks.onAnswerReceived)
        .onScreenView(hooks.onScreenView)
        .onError(hooks.onError)
        .onSessionStart(hooks.onSessionStart)
        .stringOverrides(stringOverrides)
        .locale(locale)

    class Builder(private val environment: FarmerChatEnvironment) {
        private var customBaseUrl: String? = null
        private var geoApiKey: String? = null
        private var guestApiKey: String? = null
        private var appearance: FarmerChatAppearance = FarmerChatAppearance.AUTO
        private var languageCode: String? = null
        private var enableVoice: Boolean = true
        private var enableImages: Boolean = true
        private var enableWeather: Boolean = true
        private var onEvent: ((String, Map<String, Any?>) -> Unit)? = null
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
        private var enableSsfr: Boolean = true

        private var onChatOpened: (() -> Unit)? = null
        private var onMessageSent: ((String) -> Unit)? = null
        private var onAnswerReceived: ((String) -> Unit)? = null
        private var onScreenView: ((String) -> Unit)? = null
        private var onError: ((Int, String) -> Unit)? = null
        private var onSessionStart: (() -> Unit)? = null

        private var stringOverrides: Map<String, String> = emptyMap()
        private var locale: String? = null

        /** Override the environment base URL (e.g. a local mock or a host backend). Must end with `/`. */
        fun customBaseUrl(url: String?) = apply { customBaseUrl = url }
        fun geoApiKey(key: String?) = apply { geoApiKey = key }
        fun guestApiKey(key: String?) = apply { guestApiKey = key }
        fun appearance(mode: FarmerChatAppearance) = apply { appearance = mode }
        fun languageCode(code: String?) = apply { languageCode = code }
        fun enableVoice(enabled: Boolean) = apply { enableVoice = enabled }
        fun enableImages(enabled: Boolean) = apply { enableImages = enabled }
        fun enableWeather(enabled: Boolean) = apply { enableWeather = enabled }
        fun onEvent(callback: ((String, Map<String, Any?>) -> Unit)?) = apply { onEvent = callback }
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
        fun enableSsfr(enabled: Boolean) = apply { enableSsfr = enabled }

        // C4 -------------------------------------------------------------
        fun onChatOpened(cb: (() -> Unit)?) = apply { onChatOpened = cb }
        fun onMessageSent(cb: ((String) -> Unit)?) = apply { onMessageSent = cb }
        fun onAnswerReceived(cb: ((String) -> Unit)?) = apply { onAnswerReceived = cb }
        fun onScreenView(cb: ((String) -> Unit)?) = apply { onScreenView = cb }
        fun onError(cb: ((Int, String) -> Unit)?) = apply { onError = cb }
        fun onSessionStart(cb: (() -> Unit)?) = apply { onSessionStart = cb }

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
            enableVoice = enableVoice,
            enableImages = enableImages,
            enableWeather = enableWeather,
            onEvent = onEvent,
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
            enableSsfr = enableSsfr,
            hooks = FarmerChatHooks(
                onChatOpened, onMessageSent, onAnswerReceived,
                onScreenView, onError, onSessionStart
            ),
            stringOverrides = stringOverrides,
            locale = locale
        )
    }

    companion object {
        @JvmStatic
        fun builder(environment: FarmerChatEnvironment): Builder = Builder(environment)
    }
}
