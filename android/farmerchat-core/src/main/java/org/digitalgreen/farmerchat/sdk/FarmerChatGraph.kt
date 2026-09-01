package org.digitalgreen.farmerchat.sdk

import android.content.Context
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import org.digitalgreen.farmerchat.sdk.core.analytics.FarmerChatAnalytics
import org.digitalgreen.farmerchat.sdk.core.auth.AuthApi
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
        // Env-scoped cache invalidation: a conversation id is only valid on the
        // backend that created it. If the effective base URL changed since the
        // last init, drop the stored conversation id — otherwise the answer
        // endpoint 500s on a stale/foreign id with no self-recovery.
        val currentBase = config.resolvedBaseUrl
        val lastBase = prefs.getString(SdkPreferences.Keys.LAST_BASE_URL, "")
        if (lastBase.isNotBlank() && lastBase != currentBase) {
            prefs.remove(SdkPreferences.Keys.NEW_CONVERSATION_ID)
        }
        prefs.putString(SdkPreferences.Keys.LAST_BASE_URL, currentBase)
    }
    val labelManager: LabelManager = LabelManager(
        prefs = prefs,
        stringOverrides = config.stringOverrides,
        localeOverride = config.locale?.takeIf { it.isNotBlank() }
    )
    val analytics: FarmerChatAnalytics = FarmerChatAnalytics(config.onEvent, config.hooks)
    val errorNavigationManager: ErrorNavigationManager = ErrorNavigationManager()

    private val guestApiKey: String =
        config.guestApiKey ?: ApiConstants.DEFAULT_GUEST_USER_API_KEY

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

    private val tokenAuthenticator = TokenAuthenticator(
        tokenStore = tokenStore,
        authApiProvider = { authApi },
        guestApiKey = guestApiKey,
        onSessionExpired = { config.onSessionExpired?.invoke() },
        hostTokenMode = config.authMode == org.digitalgreen.farmerchat.sdk.FarmerChatAuthMode.HOST_TOKEN,
        hostTokenProvider = config.tokenProvider
    )

    /**
     * Base client used by TimeoutTypeInterceptor to execute the per-request timeout
     * clone. Contains the tail of the chain (AuthHeader → Logging + authenticator)
     * but NOT the priority/timeout interceptors — mirrors the app's baseFarmerOkHttp.
     */
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
        .addInterceptor(TimeoutTypeInterceptor { baseMainClient })
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

    val fetchGeoLocationUseCase = FetchGeoLocationUseCase(geoRepository) { config.geoApiKey }
    val initializeGuestUserUseCase = InitializeGuestUserUseCase(guestAuthRepository) { guestApiKey }
    val getSupportedLanguagesUseCase = GetSupportedLanguagesUseCase(languageRepository)
    val getLanguageLabelsUseCase = GetLanguageLabelsUseCase(languageRepository)
    val updateUserNameUseCase = UpdateUserNameUseCase(nameRepository)
    val getUserProfileUseCase = GetUserProfileUseCase(profileRepository)
    val updateBuildVersionUseCase = UpdateBuildVersionUseCase(profileRepository)
    val updateUserLocationUseCase = UpdateUserLocationUseCase(locationRepository)
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
    val routeDecider = RouteDecider(prefs) { config.showNameScreen }

    val locationPromptManager = LocationPromptManager(
        prefs = prefs,
        updateUserLocationUseCase = updateUserLocationUseCase,
        analytics = analytics
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
        // Appearance from config (host may still change it in Settings).
        if (prefs.getString(SdkPreferences.Keys.APPEARANCE_MODE, "").isBlank()) {
            prefs.putString(SdkPreferences.Keys.APPEARANCE_MODE, config.appearance.name.lowercase())
        }
        // Wire error labels through LabelManager.
        ErrorHandler.labelResolver = { key, fallback -> labelManager.getLabel(key, fallback) }
    }

    // ------------------------------------------------------------------ state machine factories

    fun onboardingViewModel() = OnboardingSharedViewModel(
        fetchGeoLocationUseCase, getSupportedLanguagesUseCase, getLanguageLabelsUseCase,
        sessionManager, labelManager, prefs, analytics, config, updateUserLocationUseCase
    )

    fun enterNameViewModel() = EnterNameViewModel(updateUserNameUseCase, prefs, analytics)

    fun userProfileViewModel() = UserProfileViewModel(getUserProfileUseCase, prefs, errorNavigationManager)

    fun authViewModel() = AuthViewModel(
        phoneAuthUseCases, getSupportedLanguagesUseCase, sessionManager, prefs, labelManager, analytics
    )

    fun homeViewModel() = HomeViewModel(homeUseCase, chatUseCase, getUserProfileUseCase, prefs, analytics)

    fun chatViewModel() = ChatViewModel(appContext, chatUseCase, prefs, labelManager, analytics)

    fun chatHistoryViewModel() = ChatHistoryViewModel(historyUseCase, prefs)

    fun settingsViewModel() = SettingsViewModel(
        getSupportedLanguagesUseCase, getLanguageLabelsUseCase, labelManager, prefs, analytics, config
    )

    /**
     * CHAT_ONLY bootstrap. Onboarding + Home normally establish the guest session
     * and create the conversation; CHAT_ONLY skips both, so do them here before
     * entering chat — otherwise the first query is sent unauthenticated (401) or
     * with an empty conversation_id (500). Idempotent + best-effort: callers should
     * proceed to chat even if this throws (chat shows its own retry).
     */
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
        if (labelManager.areLabelsLoaded()) return

        val code = prefs.getString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, "")
            .ifBlank { config.locale ?: config.languageCode ?: "en" }
            .trim().lowercase()

        if (!sessionManager.hasSession()) {
            runCatching { sessionManager.initializeGuestUser() }
        }

        runCatching {
            val country = prefs.getString(SdkPreferences.Keys.USER_COUNTRY_CODE, "")
                .ifBlank { config.defaultCountryCode }
            val state = prefs.getString(SdkPreferences.Keys.USER_SELECTED_STATE_CODE, "")
                .ifBlank { config.defaultStateCode }

            val groups = getSupportedLanguagesUseCase.getSupportedLanguages(country, state).first()
            if (groups !is ApiResult.Success) return@runCatching
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

    suspend fun ensureChatOnlySession() {
        if (!sessionManager.hasSession()) {
            runCatching { sessionManager.initializeGuestUser() }
        }
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
}
