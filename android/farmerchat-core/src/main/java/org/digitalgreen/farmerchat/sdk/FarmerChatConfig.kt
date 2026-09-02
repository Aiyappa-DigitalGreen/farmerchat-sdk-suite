package org.digitalgreen.farmerchat.sdk

import androidx.annotation.ColorInt

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
    /**
     * Country code used for the language list when `initialize_user` returns a null/blank
     * `country_code` (the normal case for a fresh guest on an IP the backend cannot resolve).
     * Endpoint #2 rejects a blank `country_code` with HTTP 400, so this must never be empty.
     */
    val defaultCountryCode: String,
    /** State/region paired with [defaultCountryCode] for the endpoint #2 `state` query param. */
    val defaultStateCode: String,
    /**
     * Latitude/longitude representing [defaultCountryCode]/[defaultStateCode].
     *
     * Endpoint #12 (home feed) is gated on the backend having a resolved location, and the
     * backend resolves it ONLY from coordinates — a country name alone is rejected (verified
     * live 2026-09-01: `{user_id, country, level_2}` left the profile empty and the feed at 0
     * sections, while `{user_id, lat, long}` produced 21). When guest init cannot resolve a
     * location and the host has no GPS permission, the SDK posts these coordinates to #11 so a
     * guest sees a populated home screen instead of a blank one.
     *
     * Set these to match [defaultCountryCode] when overriding it, or the feed will show advice
     * for the wrong region.
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
     * See versions/v2/README.md. Note the wire framing is not yet confirmed against a real
     * stream (docs/05-open-questions.md), so treat this as preview until it is.
     */
    val enableAgenticChat: Boolean,
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

    class Builder(private val environment: FarmerChatEnvironment) {
        private var customBaseUrl: String? = null
        private var geoApiKey: String? = null
        private var guestApiKey: String? = null
        private var appearance: FarmerChatAppearance = FarmerChatAppearance.AUTO
        private var languageCode: String? = null
        private var defaultCountryCode: String = DEFAULT_COUNTRY_CODE
        private var defaultStateCode: String = DEFAULT_STATE_CODE
        private var defaultLatitude: Double = DEFAULT_LATITUDE
        private var defaultLongitude: Double = DEFAULT_LONGITUDE
        private var enableVoice: Boolean = true
        private var enableImages: Boolean = true
        private var enableWeather: Boolean = true
        private var enableAgenticChat: Boolean = false
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
                onScreenView, onError, onSessionStart
            ),
            stringOverrides = stringOverrides,
            locale = locale
        )
    }

    companion object {
        /**
         * Fallback country for endpoint #2 when `initialize_user` returns no `country_code`.
         * The endpoint 400s on a blank value, so a non-blank default is required.
         */
        const val DEFAULT_COUNTRY_CODE = "IN"

        /**
         * Fallback state/region paired with [DEFAULT_COUNTRY_CODE].
         *
         * Endpoint #2 matches `state` on the **display name**, not the ISO code, and uses it only
         * to rank languages — a code or an unknown value returns the same set in default order.
         * Verified live 2026-09-01: `state=Karnataka` surfaces Kannada in `priority_view`, while
         * `state=KA` pushes it into `expanded_view` ("All languages").
         */
        const val DEFAULT_STATE_CODE = "Karnataka"

        /**
         * Coordinates representing [DEFAULT_COUNTRY_CODE]/[DEFAULT_STATE_CODE] (Bengaluru).
         *
         * Used to seed endpoint #11 when nothing else resolved a location, so the home feed is
         * never empty. Verified live 2026-09-01: the backend accepts coordinates only — a
         * country name alone leaves the profile (and the feed) empty.
         */
        const val DEFAULT_LATITUDE = 12.9716
        const val DEFAULT_LONGITUDE = 77.5946

        @JvmStatic
        fun builder(environment: FarmerChatEnvironment): Builder = Builder(environment)
    }
}
