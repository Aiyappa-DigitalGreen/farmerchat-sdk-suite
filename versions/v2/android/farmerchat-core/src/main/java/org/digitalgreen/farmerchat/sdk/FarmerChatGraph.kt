package org.digitalgreen.farmerchat.sdk

import android.content.Context
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import org.digitalgreen.farmerchat.sdk.core.analytics.DeviceUserAttributes
import org.digitalgreen.farmerchat.sdk.core.analytics.FarmerChatAnalytics
import org.digitalgreen.farmerchat.sdk.core.auth.AuthApi
import org.digitalgreen.farmerchat.sdk.core.auth.GuestReplacedSignal
import org.digitalgreen.farmerchat.sdk.core.auth.GuestReplacement
import org.digitalgreen.farmerchat.sdk.core.auth.PreferenceTokenStore
import org.digitalgreen.farmerchat.sdk.core.auth.SessionManager
import org.digitalgreen.farmerchat.sdk.core.auth.TokenStore
import org.digitalgreen.farmerchat.sdk.core.base.ErrorHandler
import org.digitalgreen.farmerchat.sdk.core.labels.LabelManager
import org.digitalgreen.farmerchat.sdk.core.model.ConversationListResponse
import org.digitalgreen.farmerchat.sdk.core.model.ConversationListResponseDeserializer
import org.digitalgreen.farmerchat.sdk.core.navigation.ErrorNavigationManager
import org.digitalgreen.farmerchat.sdk.core.navigation.RouteDecider
import org.digitalgreen.farmerchat.sdk.core.network.DeviceIdProvider
import org.digitalgreen.farmerchat.sdk.core.network.authenticator.AuthHeaderInterceptor
import org.digitalgreen.farmerchat.sdk.core.network.authenticator.TokenAuthenticator
import org.digitalgreen.farmerchat.sdk.core.network.timeout.ApiPriorityHeaderInterceptor
import org.digitalgreen.farmerchat.sdk.core.network.timeout.PriorityRequestIdInterceptor
import org.digitalgreen.farmerchat.sdk.core.network.timeout.TimeoutTypeInterceptor
import org.digitalgreen.farmerchat.sdk.core.location.CountryLatLngProvider
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.model.NewConversationRequest
import kotlinx.coroutines.flow.first
import org.digitalgreen.farmerchat.sdk.core.remote.ApiConstants
import org.digitalgreen.farmerchat.sdk.core.remote.ApiServices
import org.digitalgreen.farmerchat.sdk.core.remote.GoogleGeoApi
import org.digitalgreen.farmerchat.sdk.core.repository.AuthRepository
import org.digitalgreen.farmerchat.sdk.core.repository.ChatRepository
import org.digitalgreen.farmerchat.sdk.core.repository.GeoRepository
import org.digitalgreen.farmerchat.sdk.core.repository.GuestAuthRepository
import org.digitalgreen.farmerchat.sdk.core.repository.HelpRepository
import org.digitalgreen.farmerchat.sdk.core.repository.HistoryRepository
import org.digitalgreen.farmerchat.sdk.core.repository.HomeRepository
import org.digitalgreen.farmerchat.sdk.core.repository.LanguageRepository
import org.digitalgreen.farmerchat.sdk.core.repository.LocationRepository
import org.digitalgreen.farmerchat.sdk.core.repository.NameRepository
import org.digitalgreen.farmerchat.sdk.core.repository.ProfileRepository
import org.digitalgreen.farmerchat.sdk.core.ui.auth.AuthViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.chat.ChatViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.history.ChatHistoryViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.home.HomeViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptManager
import org.digitalgreen.farmerchat.sdk.core.ui.name.EnterNameViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.onboarding.OnboardingSharedViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.profile.UserProfileViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.settings.SettingsViewModel
import org.digitalgreen.farmerchat.sdk.core.usecase.ChatUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.FetchGeoLocationUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.GetHelpSupportUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.GetLanguageLabelsUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.GetSupportedLanguagesUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.GetUserProfileUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.HistoryUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.HomeUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.InitializeGuestUserUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.PhoneAuthUseCases
import org.digitalgreen.farmerchat.sdk.core.usecase.UpdateBuildVersionUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.UpdateUserLocationUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.UpdateUserNameUseCase
import org.digitalgreen.farmerchat.sdk.core.model.SetPreferredLanguageRequest
import org.digitalgreen.farmerchat.sdk.core.remote.AgenticChatDataSource
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

/**
 * The SDK's internal object graph (replaces the app's Koin modules).
 *
 * NOT part of the public API surface for host apps — it is public only so the
 * `farmerchat-android-compose` / `farmerchat-android-views` artifacts can reach
 * the shared core singletons. Hosts must only use [FarmerChat].
 */
@InternalFarmerChatApi
class FarmerChatGraph internal constructor(
    val appContext: Context,
    val config: FarmerChatConfig
) {

    // ------------------------------------------------------------------ storage / identity

    val prefs: SdkPreferences = SdkPreferences(appContext)
    val tokenStore: TokenStore = PreferenceTokenStore(prefs)
    val deviceIdProvider: DeviceIdProvider = DeviceIdProvider(appContext, prefs)

    init {
        // Env-scoped session invalidation: a session is only valid on the backend that created
        // it. If the effective base URL changed since the last init, drop the WHOLE stored
        // session (tokens, user id, conversation id, labels) — keeping only appearance and the
        // install's device id. Dropping just the conversation id left the old backend's token
        // and user id in place: every call 401'd, refresh 401'd, and the guest fallback
        // (send_tokens with the foreign user_id) 400'd, so the SDK could never recover. Seen
        // when a host moved the SDK from its own backend to FarmerChat's.
        val currentBase = config.resolvedBaseUrl
        val lastBase = prefs.getString(SdkPreferences.Keys.LAST_BASE_URL, "")
        if (lastBase.isNotBlank() && lastBase != currentBase) {
            prefs.clearAll(preserveAppearance = true)
        }
        prefs.putString(SdkPreferences.Keys.LAST_BASE_URL, currentBase)
    }
    val labelManager: LabelManager = LabelManager(
        prefs = prefs,
        stringOverrides = config.stringOverrides,
        localeOverride = config.locale?.takeIf { it.isNotBlank() }
    )
    val analytics: FarmerChatAnalytics = FarmerChatAnalytics(
        configOnEvent = config.onEvent,
        hooks = config.hooks,
        configOnUserIdentified = config.onUserIdentified,
        configOnUserAttribute = config.onUserAttribute,
        enabled = config.enableAnalytics
    )
    val errorNavigationManager: ErrorNavigationManager = ErrorNavigationManager()

    // Bundled default unless the host overrides it; blank counts as "no override".
    private val farmerChatApiKey: String =
        config.farmerChatApiKey?.takeIf { it.isNotBlank() } ?: ApiConstants.DEFAULT_FARMERCHAT_API_KEY

    // ------------------------------------------------------------------ networking

    private val gson: Gson = GsonBuilder()
        .registerTypeAdapter(
            ConversationListResponse::class.java,
            ConversationListResponseDeserializer()
        )
        .create()

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (config.debugLogging) HttpLoggingInterceptor.Level.BODY
        else HttpLoggingInterceptor.Level.NONE
    }

    private val authHeaderInterceptor = AuthHeaderInterceptor(tokenStore, appContext, prefs)

    /**
     * docs/02 Step 3 guest-replaced signal. Declared before [tokenAuthenticator], which fires it;
     * Home and Chat ViewModels collect it.
     */
    val guestReplacedSignal = GuestReplacedSignal()

    private val tokenAuthenticator = TokenAuthenticator(
        tokenStore = tokenStore,
        authApiProvider = { authApi },
        farmerChatApiKey = farmerChatApiKey,
        onSessionExpired = { config.onSessionExpired?.invoke() },
        hostTokenMode = config.authMode == org.digitalgreen.farmerchat.sdk.FarmerChatAuthMode.HOST_TOKEN,
        hostTokenProvider = config.tokenProvider,
        // Step 3 (guest re-initialisation) inputs — read from prefs at 401 time.
        isPhoneVerified = { prefs.getBoolean(SdkPreferences.Keys.OTP_VERIFIED, false) },
        deviceIdSupplier = { deviceIdProvider.getDeviceId() },
        storedLatLong = {
            prefs.getString(SdkPreferences.Keys.FARMER_APP_LATITUDE, "").toDoubleOrNull() to
                prefs.getString(SdkPreferences.Keys.FARMER_APP_LONGITUDE, "").toDoubleOrNull()
        },
        // No stored fix → the same fallback onboarding seeds the server with on a geo failure
        // (host default lat/long, else the device-locale centroid). Pure config + locale reads,
        // safe on the OkHttp thread this runs on.
        fallbackLatLong = {
            config.resolvedFallbackCoordinates(appContext)
                .takeIf { (lat, lng) -> CountryLatLngProvider.isResolved(lat, lng) }
        },
        // Prefs first, signal last: collectors read the new PREF_USER_ID / place prefs.
        onGuestReinitialized = { response ->
            GuestReplacement.rewritePrefs(
                response,
                remove = { prefs.remove(it) },
                put = { key, value -> prefs.putString(key, value) }
            )
            guestReplacedSignal.notifyGuestReplaced()
        }
    )

    /**
     * Base client used by TimeoutTypeInterceptor to execute the per-request timeout
     * clone. Contains the tail of the chain (AuthHeader → Logging + authenticator)
     * but NOT the priority/timeout interceptors — mirrors the app's baseFarmerOkHttp.
     */
    private val endpointOverrideInterceptor =
        org.digitalgreen.farmerchat.sdk.core.network.EndpointOverrideInterceptor(config.endpointOverrides)

    private val baseMainClient: OkHttpClient = OkHttpClient.Builder()
        .retryOnConnectionFailure(true)
        .addInterceptor(authHeaderInterceptor)
        .addInterceptor(loggingInterceptor)
        .authenticator(tokenAuthenticator)
        .build()

    /**
     * Main client. Interceptor order (fixed): PriorityRequestId → ApiPriorityHeader
     * → TimeoutClone → AuthHeader → Logging(debug) + authenticator(TokenAuthenticator).
     */
    private val mainClient: OkHttpClient = OkHttpClient.Builder()
        .retryOnConnectionFailure(true)
        .addInterceptor(PriorityRequestIdInterceptor())
        .addInterceptor(ApiPriorityHeaderInterceptor())
        .addInterceptor(endpointOverrideInterceptor)
        .addInterceptor(TimeoutTypeInterceptor { baseMainClient })
        .addInterceptor(authHeaderInterceptor)
        .addInterceptor(loggingInterceptor)
        .authenticator(tokenAuthenticator)
        .build()

    /**
     * Agentic streaming client (#27a, 2.0.0).
     *
     * Deliberately NOT [mainClient]: agentic answers stream for minutes, so this client has
     * **no read timeout**. It must also skip the ApiPriority/Timeout interceptors, whose whole
     * job is to impose the P1/P2/P3 deadlines that would cut a stream short.
     *
     * It keeps [authHeaderInterceptor] and the [tokenAuthenticator], so `Authorization` and the
     * 401 refresh behave exactly as on every other call.
     */
    private val agenticClient: OkHttpClient = OkHttpClient.Builder()
        .retryOnConnectionFailure(true)
        .readTimeout(0, java.util.concurrent.TimeUnit.MILLISECONDS)
        .callTimeout(0, java.util.concurrent.TimeUnit.MILLISECONDS)
        .addInterceptor(authHeaderInterceptor)
        .addInterceptor(loggingInterceptor)
        .authenticator(tokenAuthenticator)
        .build()

    /** Token client: no auth header interceptor, no authenticator (skip-listed endpoints). */
    private val baseAuthClient: OkHttpClient = OkHttpClient.Builder()
        .retryOnConnectionFailure(true)
        .addInterceptor(loggingInterceptor)
        .build()

    private val authClient: OkHttpClient = OkHttpClient.Builder()
        .retryOnConnectionFailure(true)
        .addInterceptor(PriorityRequestIdInterceptor())
        .addInterceptor(ApiPriorityHeaderInterceptor())
        .addInterceptor(endpointOverrideInterceptor)
        .addInterceptor(TimeoutTypeInterceptor { baseAuthClient })
        .addInterceptor(loggingInterceptor)
        .build()

    private val baseGoogleClient: OkHttpClient = OkHttpClient.Builder()
        .retryOnConnectionFailure(true)
        .addInterceptor(loggingInterceptor)
        .build()

    private val googleClient: OkHttpClient = OkHttpClient.Builder()
        .retryOnConnectionFailure(true)
        .addInterceptor(PriorityRequestIdInterceptor())
        .addInterceptor(ApiPriorityHeaderInterceptor())
        .addInterceptor(TimeoutTypeInterceptor { baseGoogleClient })
        .addInterceptor(loggingInterceptor)
        .build()

    private fun retrofit(baseUrl: String, client: OkHttpClient): Retrofit =
        Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()

    val apiServices: ApiServices =
        retrofit(config.resolvedBaseUrl, mainClient).create(ApiServices::class.java)

    val authApi: AuthApi =
        retrofit(config.resolvedBaseUrl, authClient).create(AuthApi::class.java)

    val googleGeoApi: GoogleGeoApi =
        retrofit(ApiConstants.GOOGLE_GEO_BASE_URL, googleClient).create(GoogleGeoApi::class.java)

    // ------------------------------------------------------------------ repositories

    val geoRepository = GeoRepository(googleGeoApi)
    val guestAuthRepository = GuestAuthRepository(apiServices)
    val languageRepository = LanguageRepository(apiServices)
    val nameRepository = NameRepository(apiServices)
    val profileRepository = ProfileRepository(apiServices)
    val locationRepository = LocationRepository(apiServices)
    val homeRepository = HomeRepository(apiServices)
    val chatRepository = ChatRepository(apiServices)
    val authRepository = AuthRepository(apiServices)
    val historyRepository = HistoryRepository(apiServices)
    val helpRepository = HelpRepository(apiServices)

    // ------------------------------------------------------------------ use cases

    // Mirrors the farmerChatApiKey fallback above: a host that supplies nothing still gets a working
    // location fallback. Blank is treated as absent — a host passing "" (e.g. an unset Gradle
    // property piped straight through, which is exactly how RationSmart wires FC_GEO_API_KEY)
    // means "I have no key", not "use an empty one".
    private val geoApiKey: String =
        config.geoApiKey?.takeIf { it.isNotBlank() } ?: ApiConstants.DEFAULT_GEO_API_KEY

    val fetchGeoLocationUseCase = FetchGeoLocationUseCase(geoRepository) { geoApiKey }
    val initializeGuestUserUseCase = InitializeGuestUserUseCase(guestAuthRepository) { farmerChatApiKey }
    val getSupportedLanguagesUseCase = GetSupportedLanguagesUseCase(languageRepository)
    val getLanguageLabelsUseCase = GetLanguageLabelsUseCase(languageRepository)
    val updateUserNameUseCase = UpdateUserNameUseCase(nameRepository)
    val getUserProfileUseCase = GetUserProfileUseCase(profileRepository)
    val updateBuildVersionUseCase = UpdateBuildVersionUseCase(profileRepository)
    val updateUserLocationUseCase = UpdateUserLocationUseCase(locationRepository)

    /**
     * Agentic streaming source (#27a). Present on 2.0.0 artifacts regardless of the flag —
     * constructing it is free; [FarmerChatConfig.enableAgenticChat] decides whether the chat
     * state machine uses it or the synchronous #27 path.
     */
    val agenticChatDataSource = AgenticChatDataSource(
        client = agenticClient,
        gson = gson,
        baseUrl = config.resolvedBaseUrl
    )
    val homeUseCase = HomeUseCase(homeRepository)
    val chatUseCase = ChatUseCase(chatRepository)
    val phoneAuthUseCases = PhoneAuthUseCases(authRepository)
    val historyUseCase = HistoryUseCase(historyRepository)
    val getHelpSupportUseCase = GetHelpSupportUseCase(helpRepository)

    // ------------------------------------------------------------------ session / routing

    val sessionManager = SessionManager(
        prefs = prefs,
        tokenStore = tokenStore,
        deviceIdProvider = deviceIdProvider,
        initializeGuestUserUseCase = initializeGuestUserUseCase,
        historyUseCase = historyUseCase
    )

    // showNameScreen mirrors the app's `show_name_screen` RemoteConfig flag. When false,
    // routeFromSplash() marks the profile step done and falls through to Home.
    // hostLanguageConfigured feeds the CHAT_ONLY first-launch language gate: a host-configured
    // language (the same pair ensureLabelsLoaded reads) keeps CHAT_ONLY going straight to chat.
    val routeDecider = RouteDecider(
        prefs,
        showNameScreen = { config.showNameScreen },
        hostLanguageConfigured = {
            !config.languageCode.isNullOrBlank() || !config.locale.isNullOrBlank()
        }
    )

    val locationPromptManager = LocationPromptManager(
        prefs = prefs,
        updateUserLocationUseCase = updateUserLocationUseCase,
        analytics = analytics,
        // App parity: the decision tree checks FINE only ("Approximate" counts as a deny).
        hasFineLocationPermission = {
            androidx.core.content.ContextCompat.checkSelfPermission(
                appContext, android.Manifest.permission.ACCESS_FINE_LOCATION
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED
        },
        isOnline = { org.digitalgreen.farmerchat.sdk.core.network.NetworkUtils.isOnline(appContext) }
    )

    init {
        // Config language preselection: mark the language step done only when the
        // host provided a code AND labels already exist for it (validated lazily by
        // the language screen otherwise).
        config.languageCode?.takeIf { it.isNotBlank() }?.let { code ->
            prefs.putString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, code.trim().lowercase())
        }
        // C5: forced locale overrides device/onboarding language and skips the language screen.
        config.locale?.takeIf { it.isNotBlank() }?.let { code ->
            prefs.putString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, code.trim().lowercase())
            prefs.putBoolean(SdkPreferences.Keys.LANGUAGE_DONE, true)
        }
        // C2: HOST_TOKEN — seed host tokens and treat the user as authenticated
        // (the SDK skips the phone/OTP UI; 401s route through config.tokenProvider).
        if (config.authMode == org.digitalgreen.farmerchat.sdk.FarmerChatAuthMode.HOST_TOKEN) {
            val seed = config.accessToken?.takeIf { it.isNotBlank() }
                ?: config.tokenProvider?.invoke()?.takeIf { it.isNotBlank() }
            if (seed != null) {
                tokenStore.saveTokens(seed, config.refreshToken)
                prefs.putBoolean(SdkPreferences.Keys.OTP_VERIFIED, true)
            }
        }
        // Appearance from config (the user may still change it in Settings). With Settings
        // hidden nobody can, so the host's value wins every launch — a mode saved by an older
        // install (e.g. "auto" on a dark device) must not outlive the host's `appearance(DAY)`.
        if (!config.showSettings ||
            prefs.getString(SdkPreferences.Keys.APPEARANCE_MODE, "").isBlank()
        ) {
            prefs.putString(SdkPreferences.Keys.APPEARANCE_MODE, config.appearance.name.lowercase())
        }
        // Wire error labels through LabelManager.
        ErrorHandler.labelResolver = { key, fallback -> labelManager.getLabel(key, fallback) }
    }

    // ------------------------------------------------------------------ state machine factories

    fun onboardingViewModel() = OnboardingSharedViewModel(
        appContext,
        fetchGeoLocationUseCase, getSupportedLanguagesUseCase, getLanguageLabelsUseCase,
        sessionManager, labelManager, prefs, analytics, config, updateUserLocationUseCase
    )

    fun enterNameViewModel() = EnterNameViewModel(updateUserNameUseCase, prefs, analytics)

    fun userProfileViewModel() = UserProfileViewModel(getUserProfileUseCase, prefs, errorNavigationManager)

    fun authViewModel() = AuthViewModel(
        phoneAuthUseCases, getSupportedLanguagesUseCase, sessionManager, prefs, labelManager, analytics
    )

    fun homeViewModel() = HomeViewModel(
        homeUseCase, chatUseCase, getUserProfileUseCase, prefs, analytics, getSupportedLanguagesUseCase,
        guestReplacedSignal = guestReplacedSignal
    )

    fun chatViewModel() = ChatViewModel(
        appContext, chatUseCase, prefs, labelManager, analytics, config, agenticChatDataSource,
        guestReplaced = guestReplacedSignal.events,
        // CHAT_ONLY has no Home to recreate the conversation after a guest replacement.
        createConversationOnGuestReplaced = config.mode == FarmerChatMode.CHAT_ONLY
    )

    fun chatHistoryViewModel() = ChatHistoryViewModel(historyUseCase, prefs)

    fun settingsViewModel() = SettingsViewModel(
        appContext,
        getSupportedLanguagesUseCase, getLanguageLabelsUseCase, labelManager, prefs, analytics, config
    )

    /**
     * Completes onboarding's API work when the language SCREEN was skipped.
     *
     * `config.locale` sets LANGUAGE_DONE so routeFromSplash() goes straight past the language
     * screen — but that screen is also what calls #3 `get_labels` and #6
     * `set_preferred_language`. Skipped, a fresh install would run with no server labels (every
     * string falling back to its hardcoded English) and a backend that never learned the user's
     * language.
     *
     * This runs the same calls headlessly: guest init → #2 languages → resolve the configured
     * code to its id → #3 labels → #6 preferred language. No UI, no change to the geolocation
     * or session flow. Fully best-effort: any failure leaves the English fallbacks in place,
     * which is exactly the pre-existing behaviour, so it can never block the splash.
     *
     * No-ops once labels exist, so it costs a returning user nothing.
     */
    suspend fun ensureSkippedOnboardingBootstrap() {
        if (!prefs.getBoolean(SdkPreferences.Keys.LANGUAGE_DONE, false)) return
        ensureLabelsLoaded()
    }

    /**
     * Fetches server labels (and sets the preferred language) when no onboarding screen has
     * done it. Shared by the skipped-onboarding path and CHAT_ONLY — CHAT_ONLY shows the
     * language screen only on a first launch without a host-configured language
     * ([RouteDecider.chatOnlyNeedsLanguage]); on every other CHAT_ONLY open (and whenever the host
     * configured the language) no screen has loaded labels, so without this the chat runs
     * entirely on hardcoded English fallbacks and the backend never learns the user's language.
     *
     * Best-effort and idempotent: no-ops once labels exist, and any failure leaves the English
     * fallbacks in place, which is the pre-existing behaviour.
     */
    /**
     * Set when the language list 404s this process. A backend without the endpoint (a host's own
     * server) would otherwise pay its P2 retries + backoff on every chat open, for a result that
     * is always the English fallback. Cleared by process death only.
     */
    @Volatile
    private var labelBootstrapUnavailable = false

    private suspend fun ensureLabelsLoaded() {
        if (labelManager.areLabelsLoaded() || labelBootstrapUnavailable) return

        val code = prefs.getString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, "")
            .ifBlank { config.locale ?: config.languageCode ?: "en" }
            .trim().lowercase()

        if (!sessionManager.hasSession()) {
            runCatching { sessionManager.initializeGuestUser() }
        }

        runCatching {
            val country = prefs.getString(SdkPreferences.Keys.USER_COUNTRY_CODE, "")
                .ifBlank { config.resolvedFallbackCountryCode(appContext) }
            val state = prefs.getString(SdkPreferences.Keys.USER_SELECTED_STATE_CODE, "")
                .ifBlank { config.defaultStateCode }

            val groups = getSupportedLanguagesUseCase.getSupportedLanguages(country, state).first()
            if (groups !is ApiResult.Success) {
                // 404 = this backend has no such endpoint; offline/5xx may succeed next open.
                if ((groups as? ApiResult.Error)?.code == 404) labelBootstrapUnavailable = true
                return@runCatching
            }
            val all = groups.data.flatMap { it.priorityView + it.expandedView }
            val match = all.firstOrNull { it.code.equals(code, ignoreCase = true) }
                ?: all.firstOrNull { it.code.equals("en", ignoreCase = true) }
                ?: return@runCatching

            val labels = getLanguageLabelsUseCase.getLanguageLabels(match.id).first()
            if (labels is ApiResult.Success) {
                labelManager.saveLabels(labels.data)
                prefs.putInt(SdkPreferences.Keys.SELECTED_LANGUAGE_ID, match.id)
                prefs.putString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, match.code)
                match.displayName.takeIf { it.isNotBlank() }?.let {
                    prefs.putString(SdkPreferences.Keys.SELECTED_LANGUAGE_DISPLAY_NAME, it)
                }
            }

            val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "").trim()
            if (userId.isNotBlank()) {
                getSupportedLanguagesUseCase.setPreferredLanguage(
                    SetPreferredLanguageRequest(user_id = userId, language_id = match.id.toString())
                ).first()
            }
        }
    }

    /**
     * A CHAT_ONLY journey opening fresh is the app's "Home entry", and the app starts a NEW
     * conversation on every Home entry (fc-compose-agentic HomeScreen.kt:855). Without this the
     * SDK reused the one stored conversation id forever: every question from every visit landed
     * in a single conversation and Past Advice showed one item. Opening a specific history
     * thread ([PendingTarget.Chat]) keeps its own id. Call once per fresh journey start, before
     * [ensureChatOnlySession] (which then creates the new conversation).
     */
    fun beginChatOnlyJourney() {
        if (routeDecider.peekPendingTarget() !is org.digitalgreen.farmerchat.sdk.core.navigation.PendingTarget.Chat) {
            prefs.putString(SdkPreferences.Keys.NEW_CONVERSATION_ID, "")
        }
    }

    /**
     * CHAT_ONLY bootstrap. Onboarding + Home normally establish the guest session
     * and create the conversation; CHAT_ONLY skips Home (and the language screen on every launch
     * but a first one without a host-configured language), so do them here before entering
     * chat — otherwise the first query is sent unauthenticated (401) or with an empty
     * conversation_id (500). Idempotent + best-effort: callers should proceed to chat even if
     * this throws (chat shows its own retry).
     *
     * Do NOT call it while [RouteDecider.chatOnlyNeedsLanguage] is true: the language screen does
     * the guest init, labels and preferred language itself. Call it after that screen completes
     * (its session + labels make this a cheap conversation-only pass).
     */
    suspend fun ensureChatOnlySession() {
        if (!sessionManager.hasSession()) {
            // Resolve coordinates FIRST. CHAT_ONLY usually skips onboarding, which is where the geo
            // pipeline normally lives, so this path used to call initializeGuestUser() with
            // lat/long/accuracy all null — the backend then had only the request IP to go on, and
            // the device-locale fallback never ran at all on the one flow a host embedding just
            // the chat actually uses. Verified on a device 2026-09-03:
            // `initializeGuestUser lat=null long=null acc=null`.
            val (lat, lng, accuracy) = resolveBootstrapCoordinates()
            runCatching { sessionManager.initializeGuestUser(lat, lng, accuracy) }
            // Onboarding is where the app identifies the user and raises the device/carrier
            // user attributes; CHAT_ONLY never runs it, so a host embedding just the chat would
            // otherwise get no identity and no attributes at all. Best-effort, like the rest of
            // this bootstrap.
            runCatching {
                analytics.identifyUser(sessionManager.currentUserId())
                DeviceUserAttributes.report(appContext, analytics)
            }
        }
        // CHAT_ONLY usually skips the language screen, which is the only other caller of #3
        // get_labels — without this the chat UI would render hardcoded English fallbacks.
        // No-op after the first-launch language screen already loaded them.
        ensureLabelsLoaded()
        if (prefs.getString(SdkPreferences.Keys.NEW_CONVERSATION_ID, "").isBlank()) {
            val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "").trim()
            if (userId.isNotBlank()) {
                runCatching {
                    val res = chatUseCase.newConversation(
                        NewConversationRequest(user_id = userId, content_provider_id = null)
                    ).first()
                    if (res is ApiResult.Success) {
                        prefs.putString(SdkPreferences.Keys.NEW_CONVERSATION_ID, res.data.conversation_id)
                    }
                }
            }
        }
    }

    /**
     * Coordinates for a CHAT_ONLY guest bootstrap: the real IP-geolocation first, then the
     * device-locale country centroid, then nothing.
     *
     * Mirrors `OnboardingSharedViewModel.fetchGeoAndInitialize` so both entry points place a guest
     * the same way. Returns nulls when nothing resolves — a guess would put the farmer's advice in
     * the wrong country, and (0,0) is a real point in the Gulf of Guinea.
     */
    private suspend fun resolveBootstrapCoordinates(): Triple<Double?, Double?, Double?> {
        when (val geo = fetchGeoLocationUseCase.fetchGeoLocation().first()) {
            is ApiResult.Success -> {
                val lat = geo.data.location?.lat
                val lng = geo.data.location?.lng
                if (lat != null && lng != null) return Triple(lat, lng, geo.data.accuracy)
            }
            is ApiResult.Error -> {
                // Tolerated: a missing geoApiKey fails here immediately, which is the common case
                // for a host that only embeds the chat.
            }
        }
        val (lat, lng) = config.resolvedFallbackCoordinates(appContext)
        return if (CountryLatLngProvider.isResolved(lat, lng)) {
            Triple(lat, lng, 0.0)
        } else {
            Triple(null, null, null)
        }
    }

}
