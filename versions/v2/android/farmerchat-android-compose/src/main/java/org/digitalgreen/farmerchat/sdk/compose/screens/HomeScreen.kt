package org.digitalgreen.farmerchat.sdk.compose.screens

import org.digitalgreen.farmerchat.sdk.compose.util.isNetworkAvailable
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationErrorType
import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.painterResource
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.flow.map
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.components.attentionWobble
import org.digitalgreen.farmerchat.sdk.compose.components.Glow
import org.digitalgreen.farmerchat.sdk.compose.components.GlowType
import org.digitalgreen.farmerchat.sdk.compose.components.HomeAppBar
import org.digitalgreen.farmerchat.sdk.compose.components.InputComposer
import org.digitalgreen.farmerchat.sdk.compose.components.LocationButton
import org.digitalgreen.farmerchat.sdk.compose.components.LocationButtonState
import org.digitalgreen.farmerchat.sdk.compose.components.SectionHeader
import org.digitalgreen.farmerchat.sdk.compose.components.Sunbeams
import org.digitalgreen.farmerchat.sdk.compose.components.composerBarHeight
import org.digitalgreen.farmerchat.sdk.compose.components.ContentCard
import org.digitalgreen.farmerchat.sdk.compose.components.FeedFooter
import org.digitalgreen.farmerchat.sdk.compose.components.FeedHeader
import org.digitalgreen.farmerchat.sdk.compose.components.HomeFeedErrorUI
import org.digitalgreen.farmerchat.sdk.compose.components.LogoSpinnerVertical
import org.digitalgreen.farmerchat.sdk.compose.components.MultiSelectCard
import org.digitalgreen.farmerchat.sdk.compose.components.PermissionSettingsDialog
import org.digitalgreen.farmerchat.sdk.compose.components.PhotoInput
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryInputButtons
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryInputButtonsType
import org.digitalgreen.farmerchat.sdk.compose.components.SingleSelectCard
import org.digitalgreen.farmerchat.sdk.compose.components.SsfrCard
import org.digitalgreen.farmerchat.sdk.compose.components.TermsOfUseDialog
import org.digitalgreen.farmerchat.sdk.compose.components.TermsOfUseContentDialog
import org.digitalgreen.farmerchat.sdk.compose.components.TermsOfUseUpdatedBottomSheet
import org.digitalgreen.farmerchat.sdk.compose.components.TextInputOverlay
import org.digitalgreen.farmerchat.sdk.compose.components.Toast
import org.digitalgreen.farmerchat.sdk.compose.components.ToastState
import org.digitalgreen.farmerchat.sdk.compose.components.VoiceInput
import org.digitalgreen.farmerchat.sdk.compose.components.WeatherButtonState
import org.digitalgreen.farmerchat.sdk.compose.components.openAppSettings
import org.digitalgreen.farmerchat.sdk.compose.components.rememberToastState
import org.digitalgreen.farmerchat.sdk.compose.navigation.Destination
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.hasLocationPermission
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.vm.rememberCoreViewModel
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.cardPositionLabels
import org.digitalgreen.farmerchat.sdk.core.analytics.toHomeCardAnalytics
import org.digitalgreen.farmerchat.sdk.core.audio.AudioRecorder
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.LiveStockDetail
import org.digitalgreen.farmerchat.sdk.core.model.SectionDto
import org.digitalgreen.farmerchat.sdk.core.model.UserNameRequest
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.home.HomeAction
import org.digitalgreen.farmerchat.sdk.core.ui.home.latestTermsOfServiceUrl
import org.digitalgreen.farmerchat.sdk.core.ui.home.requiresTermsAcceptance
import org.digitalgreen.farmerchat.sdk.core.ui.home.isAcceptedTranscription
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptEvent
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptManager
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptState
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationTriggerSource
import org.digitalgreen.farmerchat.sdk.core.ui.name.UserNameAction
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.wrapContentHeight

/**
 * Home / dashboard (doc 01 §3.7). App bar with weather, greeting, sticky
 * Photo/Speak/Type buttons, SSFR card, daily feed (content / single-select /
 * multi-select cards), input overlays, permission counters.
 *
 * @param openTermsOfUseRequested 2.0.0: something outside Home asked for the in-app
 *   Terms-of-Use dialog. In the app this arrives as a Plotline card CTA
 *   (`open_terms_of_use=true`) via `PlotlineHomeEvents.openTermsOfUse`; the SDK carries no
 *   Plotline, so the host raises it instead (see FarmerChatRoot). Set back to false through
 *   [onTermsOfUseRequestConsumed] once the request has been acted on, so a later terms fetch
 *   can never re-open the dialog unprompted.
 * @param onTermsOfUseRequestConsumed Called once [openTermsOfUseRequested] has been handled
 *   (dialog opened, or the terms URL failed to arrive and the error toast was shown).
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HomeScreen(
    openDrawer: () -> Unit,
    onNavigateToChat: (Destination.Chat) -> Unit,
    openTermsOfUseRequested: Boolean = false,
    onTermsOfUseRequestConsumed: () -> Unit = {},
    /**
     * App parity: Home's offline weather / card taps and any location-flow error raised while Home
     * is showing go to the shared Error destination (`fromScreen` = home_weather / home_card / home).
     */
    onNavigateToError: (isNetworkError: Boolean, fromScreen: String) -> Unit = { _, _ -> }
) {
    val graph = FarmerChat.requireGraph()
    val context = LocalContext.current
    val brand = LocalBrandColors.current
    val colors = LocalContentColors.current
    val toast = rememberToastState()

    val vm = rememberCoreViewModel("home") { graph.homeViewModel() }
    val vmProfile = rememberCoreViewModel("homeProfile") { graph.enterNameViewModel() }
    val homeState by vm.state.collectAsState()
    val locationState by graph.locationPromptManager.state.collectAsState()

    // App parity (HomeScreen.kt:238-266): a location-flow error while Home is showing is not drawn
    // by the prompt host — Home routes it to the shared Error screen and closes the flow silently.
    LaunchedEffect(locationState) {
        val st = locationState
        if (st is LocationPromptState.Error) {
            onNavigateToError(st.type == LocationErrorType.NoNetwork, "home")
            graph.locationPromptManager.dismiss(emitContinue = false)
        }
    }

    // 2.0.0 composer/agentic Home. The app gates this on two independent Firebase Remote
    // Config flags (`getComposerUiEnabled()` for the input surface, `getAgenticChatEnabled()`
    // for the visual theme + card-tap API routing). The SDK carries no Remote Config, so the
    // host supplies both: `enableComposerUi` (null ⇒ follow `enableAgenticChat`, the historical
    // collapse) resolved through `resolvedComposerUi`. Read once — SDK config is immutable after
    // initialize(), so the app's post-fetch re-read (`OnboardingRemoteConfig.refresh()` on every
    // feed state change) has no analogue here; a host that needs a live flip re-initializes.
    val isComposerUi = graph.config.resolvedComposerUi

    // App parity (HomeScreen.kt 70adc5fd): in agentic mode the header CONTENT is a FIXED overlay
    // drawn over the feed, and this is its measured height — item 0 reserves exactly it and the
    // feed's top fade mask ends exactly there, where the first card rests, so the resting card is
    // never faded.
    //
    // Declared HERE, at the screen's top level, and NOT inside the feed's `Success` branch: that
    // branch composes fresh on the initial load, on retry and on every refresh, so a `remember`
    // scoped to it re-initialises to 0f each time. For one frame the reservation would be zero and
    // the mask would end at 1px — the first card visibly flashes half-faded. The app declares it
    // at the top of `HomeScreen` for the same reason.
    //
    // `rememberSaveable`, not `remember`, so the height also survives Home leaving and re-entering
    // composition (Chat -> back): otherwise it resets to 0 on return, item 0's Spacer collapses for
    // a frame while scroll is being restored, then re-measures and grows — shifting the first card.
    val feedDensity = LocalDensity.current
    var headerContentPx by rememberSaveable { mutableFloatStateOf(0f) }

    // docs/02 Step 3: re-read when a rejected guest is replaced mid-session, so actions dispatched
    // after the replacement carry the new user_id (the ViewModel already re-ran its entry loads).
    val guestGeneration by remember {
        graph.guestReplacedSignal.events.map { graph.guestReplacedSignal.generation }
    }.collectAsState(initial = graph.guestReplacedSignal.generation)
    val userId = remember(guestGeneration) { graph.prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "") }
    val isAuthenticated = remember {
        graph.prefs.getBoolean(SdkPreferences.Keys.OTP_VERIFIED, false)
    }

    // ------------------------------------------------------------------ input overlay controls
    var openTextInput by remember { mutableStateOf<(() -> Unit)?>(null) }
    var focusTextInput by remember { mutableStateOf<(() -> Unit)?>(null) }
    var clearTextInput by remember { mutableStateOf<(() -> Unit)?>(null) }
    var openVoiceInput by remember { mutableStateOf<(() -> Unit)?>(null) }
    var openPhotoInput by remember { mutableStateOf<(() -> Unit)?>(null) }
    var closePhotoInput by remember { mutableStateOf<(() -> Unit)?>(null) }
    var photoUris by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var cameraTempUri by remember { mutableStateOf<Uri?>(null) }

    var permissionDialogType by remember { mutableStateOf<String?>(null) }
    var pendingVoiceFile by remember { mutableStateOf<File?>(null) }

    // Content-card tap bookkeeping (FetchImageStatement then navigate).
    var pendingCardSection by remember { mutableStateOf<SectionDto?>(null) }
    val markedViewed = remember { mutableSetOf<String>() }
    /** Card_Viewed is emitted at most once per card id (app HomeScreen.kt:2072 viewedCardIds). */
    val viewedCardIds = remember { mutableSetOf<String>() }

    // ------------------------------------------------------------------ launchers
    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        val uri = cameraTempUri
        if (success && uri != null) {
            closePhotoInput?.invoke()
            graph.analytics.track(
                AnalyticsEvents.IMAGE_OPTION_DIALOG_CLICK_EVENT,
                mapOf(AnalyticsProps.OPTION to "camera", AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
            )
            if (isComposerUi) {
                // App parity: in composer mode a picked photo is ATTACHED so it can be sent
                // together with typed text (fc-compose-agentic HomeScreen.kt:350/386). Only one
                // image is allowed, so a new pick replaces the old. Without this the composer's
                // thumbnail strip and onRemovePhoto are unreachable and image+text is impossible.
                photoUris = listOf(uri)
            } else {
                onNavigateToChat(Destination.Chat(question = "", imageUri = uri.toString()))
            }
        }
    }

    val galleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            closePhotoInput?.invoke()
            graph.analytics.track(
                AnalyticsEvents.IMAGE_OPTION_DIALOG_CLICK_EVENT,
                mapOf(AnalyticsProps.OPTION to "gallery", AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
            )
            if (isComposerUi) {
                // App parity: in composer mode a picked photo is ATTACHED so it can be sent
                // together with typed text (fc-compose-agentic HomeScreen.kt:350/386). Only one
                // image is allowed, so a new pick replaces the old. Without this the composer's
                // thumbnail strip and onRemovePhoto are unreachable and image+text is impossible.
                photoUris = listOf(uri)
            } else {
                onNavigateToChat(Destination.Chat(question = "", imageUri = uri.toString()))
            }
        }
    }

    fun launchCamera() {
        runCatching {
            val file = File.createTempFile("fc_sdk_capture_", ".jpg", context.cacheDir)
            val uri = FileProvider.getUriForFile(
                context, "${context.packageName}.fc_sdk_fileprovider", file
            )
            cameraTempUri = uri
            cameraLauncher.launch(uri)
        }.onFailure {
            toast.show(label(Labels.NO_CAMERA_APP_AVAILABLE, "No camera app available on this device"), ToastState.Error)
        }
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            graph.analytics.track(
                AnalyticsEvents.PERMISSION_GRANTED,
                mapOf(AnalyticsProps.PERMISSION_TYPE to "Camera")
            )
            graph.prefs.putInt(SdkPreferences.Keys.CAMERA_PERMISSION_DENY_COUNT, 0)
            launchCamera()
        } else {
            graph.analytics.track(
                AnalyticsEvents.PERMISSION_DENIED,
                mapOf(AnalyticsProps.PERMISSION_TYPE to "Camera")
            )
            val denyCount = graph.prefs.getInt(SdkPreferences.Keys.CAMERA_PERMISSION_DENY_COUNT, 0) + 1
            graph.prefs.putInt(SdkPreferences.Keys.CAMERA_PERMISSION_DENY_COUNT, denyCount)
            if (denyCount >= 2) permissionDialogType = "camera"
        }
    }

    val micPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            graph.analytics.track(
                AnalyticsEvents.PERMISSION_GRANTED,
                mapOf(AnalyticsProps.PERMISSION_TYPE to "Microphone")
            )
            graph.prefs.putInt(SdkPreferences.Keys.MICROPHONE_PERMISSION_DENY_COUNT, 0)
            openVoiceInput?.invoke()
        } else {
            graph.analytics.track(
                AnalyticsEvents.PERMISSION_DENIED,
                mapOf(AnalyticsProps.PERMISSION_TYPE to "Microphone")
            )
            val denyCount =
                graph.prefs.getInt(SdkPreferences.Keys.MICROPHONE_PERMISSION_DENY_COUNT, 0) + 1
            graph.prefs.putInt(SdkPreferences.Keys.MICROPHONE_PERMISSION_DENY_COUNT, denyCount)
            if (denyCount >= 2) permissionDialogType = "microphone"
        }
    }

    fun requestCamera() {
        val attempts = graph.prefs.getInt(SdkPreferences.Keys.CAMERA_PERMISSION_ATTEMPT_COUNT, 0) + 1
        graph.prefs.putInt(SdkPreferences.Keys.CAMERA_PERMISSION_ATTEMPT_COUNT, attempts)
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            launchCamera()
        } else {
            val denyCount = graph.prefs.getInt(SdkPreferences.Keys.CAMERA_PERMISSION_DENY_COUNT, 0)
            if (denyCount >= 2) {
                permissionDialogType = "camera"
            } else {
                graph.analytics.track(
                    AnalyticsEvents.PERMISSION_POPUP_SHOWN,
                    mapOf(AnalyticsProps.PERMISSION_TYPE to "Camera")
                )
                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        }
    }

    fun requestMicThenOpenVoice() {
        graph.analytics.track(
            AnalyticsEvents.MICROPHONE_CLICK_EVENT,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
        )
        if (!graph.prefs.getBoolean(SdkPreferences.Keys.ASR_ENABLED, true)) {
            toast.show(
                label(
                    Labels.ASR_IS_DISABLED_FOR_YOUR_SELECTED_LANGUAGE,
                    "ASR is disabled for your selected language"
                ),
                ToastState.Error
            )
            return
        }
        val attempts =
            graph.prefs.getInt(SdkPreferences.Keys.MICROPHONE_PERMISSION_ATTEMPT_COUNT, 0) + 1
        graph.prefs.putInt(SdkPreferences.Keys.MICROPHONE_PERMISSION_ATTEMPT_COUNT, attempts)
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            openVoiceInput?.invoke()
        } else {
            val denyCount =
                graph.prefs.getInt(SdkPreferences.Keys.MICROPHONE_PERMISSION_DENY_COUNT, 0)
            if (denyCount >= 2) {
                permissionDialogType = "microphone"
            } else {
                graph.analytics.track(
                    AnalyticsEvents.PERMISSION_POPUP_SHOWN,
                    mapOf(AnalyticsProps.PERMISSION_TYPE to "Microphone")
                )
                micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }

    // ------------------------------------------------------------------ entry effects
    LaunchedEffect(Unit) {
        graph.analytics.trackScreenView(AnalyticsScreens.HOME)
        graph.errorNavigationManager.setActiveScreen("home")

        val deviceTime = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(Date())
        if (userId.isNotBlank()) {
            vm.onAction(HomeAction.NewConversation(context, userId, null))
            vm.onAction(HomeAction.FetchUserProfile(context, userId))
        }
        // Guest passes userId=null for the feed (doc 01 §3.7).
        vm.onAction(
            HomeAction.LoadHome(
                context = context,
                userDeviceTime = deviceTime,
                userId = if (isAuthenticated) userId else null
            )
        )
        if (userId.isNotBlank()) {
            vm.onAction(HomeAction.LoadWeather(context, userId))
        }
        // App parity (HomeScreen.kt:842): fetch the legal links on EVERY Home entry, not lazily
        // when the dialog is asked for — farmerchatTermsOfUse has to already be in state by the
        // time an open request arrives. Best-effort in core; a failure only leaves it null.
        vm.onAction(HomeAction.FetchPrivacyPolicy)
        // App parity (HomeScreen.kt:858): the mandatory Terms-of-Use gate (#7a) is re-checked on
        // EVERY Home entry so an updated policy version re-prompts. Guests with no provisioned
        // userId are skipped inside the ViewModel.
        vm.onAction(HomeAction.FetchPolicyAcceptanceStatus(userId))
    }

    // ------------------------------------------------------------------ terms-of-use dialog
    var showTermsOfUseDialog by remember { mutableStateOf(false) }

    // Mandatory Terms-of-Use acceptance gate (#7a). Separate from the dismissible dialog above:
    // this one blocks Home until accepted. "Read terms" opens a local full-screen overlay rather
    // than a nav destination, matching the app.
    var showTermsContentScreen by remember { mutableStateOf(false) }
    // Which CTA (sheet "Accept" vs content screen "Accept terms") most recently dispatched
    // AcceptTerms — read once #7 succeeds so Terms_Of_Use_Accept_Click_Event carries the right
    // screen_name despite both CTAs sharing one acceptTermsState.
    var pendingAcceptSource by remember { mutableStateOf<String?>(null) }

    // The terms URL is fetched on Home entry, so an open request can arrive before the fetch
    // completes. Wait briefly for a non-blank URL, then open — otherwise toast and consume the
    // request so it never opens "unprompted" on a later fetch (avoids a stale re-open).
    LaunchedEffect(openTermsOfUseRequested) {
        if (!openTermsOfUseRequested) return@LaunchedEffect
        val termsUrl = withTimeoutOrNull(5_000) {
            snapshotFlow { homeState.farmerchatTermsOfUse }.first { !it.isNullOrBlank() }
        }
        onTermsOfUseRequestConsumed()
        if (!termsUrl.isNullOrBlank()) {
            graph.analytics.track(
                AnalyticsEvents.TERMS_OF_USE_OPENED,
                mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
            )
            showTermsOfUseDialog = true
        } else {
            toast.show(
                label(Labels.UNABLE_TO_LOAD_LEGAL_LINKS, "Unable to load Terms of Use"),
                ToastState.Error
            )
        }
    }

    // App parity (HomeScreen.kt:270): refresh the feed once when location is successfully
    // updated while we are already on Home. Keyed on the success signals only (not a
    // state -> Idle transition, which also fires on dismiss/deny) so a backed-out prompt
    // does not trigger a wasted reload:
    //   • LocationUpdatedFromWidget       → campaign flow
    //   • Continue(LocalContext, fetched) → the Home location pill's own flow
    LaunchedEffect(Unit) {
        graph.locationPromptManager.events.collect { event ->
            val isWidgetUpdate = event is LocationPromptEvent.LocationUpdatedFromWidget
            val isLocalContextSuccess = event is LocationPromptEvent.Continue &&
                event.source == LocationTriggerSource.LocalContext &&
                event.reason == "location_fetched"
            if (isWidgetUpdate || isLocalContextSuccess) {
                val deviceTime = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(Date())
                vm.onAction(
                    HomeAction.LoadHome(
                        context = context,
                        userDeviceTime = deviceTime,
                        userId = if (isAuthenticated) userId else null,
                        skipLoadingCheck = true
                    )
                )
                // App parity: the weather chip follows the new location too.
                vm.onAction(HomeAction.LoadWeather(context, userId, skipLoadingCheck = true))
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose { graph.analytics.trackScreenExit(AnalyticsScreens.HOME) }
    }

    // ------------------------------------------------------------------ voice transcription result
    LaunchedEffect(homeState.voiceTranscribeState) {
        when (val s = homeState.voiceTranscribeState) {
            is UiState.Success -> {
                val data = s.data
                val file = pendingVoiceFile
                if (data.isAcceptedTranscription()) {
                    val audioUri = file?.let {
                        runCatching {
                            FileProvider.getUriForFile(
                                context, "${context.packageName}.fc_sdk_fileprovider", it
                            )
                        }.getOrNull() ?: Uri.fromFile(it)
                    }
                    vm.onAction(HomeAction.ClearTranscriptionState)
                    pendingVoiceFile = null
                    toast.dismiss()
                    onNavigateToChat(
                        Destination.Chat(
                            question = data.heard_input_query.orEmpty(),
                            transcriptionId = data.transcription_id,
                            audioUri = audioUri?.toString()
                        )
                    )
                } else {
                    vm.onAction(HomeAction.ClearTranscriptionState)
                    pendingVoiceFile = null
                    toast.show(
                        label(
                            Labels.TRANSCRIPTION_UNCLEAR,
                            "Transcription unclear"
                        ),
                        ToastState.Error
                    )
                }
            }
            is UiState.Error -> {
                vm.onAction(HomeAction.ClearTranscriptionState)
                pendingVoiceFile = null
                toast.show(
                    s.message.ifBlank {
                        label(Labels.TRANSCRIPTION_FAILED_PLEASE_TRY_AGAIN, "Transcription failed. Please try again.")
                    },
                    ToastState.Error
                )
            }
            is UiState.Loading -> {
                toast.show(label(Labels.PROCESSING, "Processing..."), ToastState.Loading)
            }
            else -> Unit
        }
    }

    // ------------------------------------------------------------------ content card tap flow
    LaunchedEffect(homeState.imageStatementState) {
        val s = homeState.imageStatementState
        val section = pendingCardSection
        if (s is UiState.Success && section != null) {
            pendingCardSection = null
            vm.onAction(HomeAction.ConsumeResult)
            // App parity: the query carried into Chat is question_text first,
            // then title (app HomeScreen.kt:549 `question_text ?: title`).
            val question = section.question_text ?: section.title.orEmpty()
            onNavigateToChat(
                Destination.Chat(
                    question = question,
                    preGeneratedAnswer = s.data.short_answer,
                    followUpQuestions = s.data.follow_up_questions?.map { it.question } ?: emptyList(),
                    homeStatementId = (section.statement_id ?: section.id)?.toString(),
                    imageUri = section.image_url
                )
            )
        } else if (s is UiState.Error && section != null) {
            pendingCardSection = null
            vm.onAction(HomeAction.ConsumeResult)
            toast.show(s.message, ToastState.Error)
        }
    }

    // ------------------------------------------------------------------ weather click
    fun onWeatherClick() {
        // App parity (HomeScreen.kt:546-575): offline → No Internet; ignored while the feed is
        // still loading or another location flow is running.
        if (!isNetworkAvailable(context)) {
            onNavigateToError(true, "home_weather")
            return
        }
        if (homeState.homeFeedState is UiState.Loading) return
        graph.analytics.track(
            AnalyticsEvents.WEATHER_FORECAST_VIEWED,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
        ) // app HomeScreen.kt:559
        if (graph.locationPromptManager.state.value != LocationPromptState.Idle) return
        val weatherQuestion = label(Labels.WHAT_IS_THE_PRESENT_WEATHER, "What is the present weather?")
        if (graph.locationPromptManager.hasStoredLocation()) {
            onNavigateToChat(
                Destination.Chat(question = weatherQuestion, isWeatherAdviceCTA = true)
            )
        } else {
            graph.locationPromptManager.triggerFromWeather {
                onNavigateToChat(
                    Destination.Chat(question = weatherQuestion, isWeatherAdviceCTA = true)
                )
            }
        }
    }

    // ------------------------------------------------------------------ send helpers
    fun sendMessage(text: String, imageUri: Uri?) {
        clearTextInput?.invoke()
        photoUris = emptyList()
        if (imageUri != null) {
            onNavigateToChat(Destination.Chat(question = text, imageUri = imageUri.toString()))
        } else if (text.isNotBlank()) {
            onNavigateToChat(Destination.Chat(question = text))
        }
    }

    fun onVoiceAudioRecorded(file: File) {
        pendingVoiceFile = file
        val conversationId = graph.prefs.getString(SdkPreferences.Keys.NEW_CONVERSATION_ID, "")
        vm.viewModelScopeLaunchTranscribe(context, conversationId, file, toast::show)
    }

    // ------------------------------------------------------------------ UI
    val listState = rememberLazyListState()
    val isInputSticky by remember {
        derivedStateOf { listState.firstVisibleItemIndex > 0 }
    }

    val homeFeedState = homeState.homeFeedState
    val weatherState = homeState.weatherState
    // App parity (HomeScreen.kt:241-255): only the CAMPAIGN (widget) flow swaps the feed for the
    // "Getting your location" spinner — and for its whole permission → GPS → fetch run. The pill
    // and weather flows leave the feed in place (the pill shows its own Searching state).
    val isWidgetGpsLoading = when (val st = locationState) {
        is LocationPromptState.RequestPermission -> st.source == LocationTriggerSource.Campaign
        is LocationPromptState.RequestEnableGps -> st.source == LocationTriggerSource.Campaign
        is LocationPromptState.FetchingLocation -> st.source == LocationTriggerSource.Campaign
        else -> false
    }

    // App parity (HomeScreen.kt:1006): the base is the grey `surfacePrimary` in BOTH modes —
    // the green lives only in the gradient band below, which bleeds down behind the header and
    // first card. The app is explicit about this ("Non-agentic looks identical — the list still
    // sits on this same grey base"), and it has no conditional here at all.
    //
    // The SDK previously painted the non-agentic base with the BRAND green, so Home's ground
    // colour was wrong for any host that had not opted into agentic chat.
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.surfacePrimary)
    ) {
        if (isComposerUi) {
            // App parity (HomeScreen.kt 70adc5fd): BACKGROUND green→transparent gradient band
            // (+ sunbeams + glow), fixed BEHIND the transparent feed. Solid green to ~58.8% of a
            // band ~36.6% of the screen tall, transparent by its bottom (Figma 1.2 Home).
            // It no longer fades out over ~215dp of scroll: the header above it is fixed now, so
            // a fading band would leave the pinned logo/title sitting on bare grey. Because it is
            // behind the cards it never washes over them — cards sit on top and the green shows
            // only in their margins.
            val configuration = LocalConfiguration.current
            val density = LocalDensity.current
            val bandDp = (configuration.screenHeightDp * 0.366f).dp
            val bandPx = with(density) { bandDp.toPx() }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .height(bandDp)
                    .background(
                        Brush.verticalGradient(
                            colorStops = arrayOf(
                                0f to brand.surfacePrimary,
                                0.588f to brand.surfacePrimary,
                                1f to brand.surfacePrimary.copy(alpha = 0f),
                            ),
                            startY = 0f,
                            endY = bandPx,
                        )
                    )
            ) {
                Sunbeams(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(280.dp)
                        .align(Alignment.TopCenter),
                    visibleProvider = { 1f },
                )
                Glow(
                    type = GlowType.Yellow,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(148.dp)
                        .align(Alignment.TopCenter)
                )
            }
        }
        Column(modifier = Modifier.fillMaxSize()) {
            HomeAppBar(
                openDrawer = {
                    graph.analytics.track(
                    AnalyticsEvents.HAMBURGER_MENU_CLICKED,
                    mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
                ) // app HomeScreen.kt:1072
                    openDrawer()
                },
                weatherState = if (weatherState is UiState.Loading) WeatherButtonState.Loading
                else WeatherButtonState.Default,
                weatherMessage = (weatherState as? UiState.Success)?.data?.current_temp ?: "",
                weatherIconUrl = (weatherState as? UiState.Success)?.data?.weather_icon,
                showWeather = graph.config.enableWeather &&
                    (weatherState is UiState.Success || weatherState is UiState.Loading),
                onWeatherClick = { onWeatherClick() },
                // Transparent in agentic mode — the green (and the glow) come from the
                // gradient band drawn behind the whole top section.
                showBackground = !isComposerUi
            )

            when {
                homeFeedState is UiState.Loading || homeFeedState is UiState.Idle || isWidgetGpsLoading -> {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        LogoSpinnerVertical(
                            label = if (isWidgetGpsLoading)
                                label(Labels.GETTING_YOUR_LOCATION, "Getting your location…")
                            else
                                label(Labels.GETTING_TODAYS_ADVICE, "Getting today's advice")
                        )
                    }
                }

                homeFeedState is UiState.Error -> {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        HomeFeedErrorUI(
                            onRetry = {
                                graph.analytics.track(
                        AnalyticsEvents.CONTENT_TRY_AGAIN_CLICKED,
                        mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
                    ) // app HomeScreen.kt:1239
                                val deviceTime = SimpleDateFormat(
                                    "yyyy-MM-dd'T'HH:mm:ss", Locale.US
                                ).format(Date())
                                vm.onAction(
                                    HomeAction.LoadHome(
                                        context = context,
                                        userDeviceTime = deviceTime,
                                        userId = if (isAuthenticated) userId else null,
                                        skipLoadingCheck = true
                                    )
                                )
                            }
                        )
                    }
                }

                homeFeedState is UiState.Success -> {
                    val feed = homeFeedState.data
                    // renderableSections() drops plotline_widget entries, which carry no
                    // headline/image/statement_id — the catch-all branch below would render each
                    // as a blank ContentCard (14 of 21 prod sections on 2026-09-01).
                    val visibleSections = feed.renderableSections().filter {
                        it.stableId() !in homeState.dismissedCardIds
                    }
                    // App HomeScreen.kt:2023-2040 — "image 1" / "statement 2" per type.
                    val positionLabels = cardPositionLabels(visibleSections)
                    // App HomeScreen.kt:925-935 — one Card_Shown per visible section when the
                    // feed response arrives.
                    LaunchedEffect(feed) {
                        visibleSections.forEachIndexed { i, section ->
                            graph.analytics.trackHomeCardEvent(
                                AnalyticsEvents.CARD_SHOWN,
                                section.toHomeCardAnalytics(positionLabels.getOrElse(i) { "" })
                            )
                        }
                    }

                    Box(modifier = Modifier.weight(1f)) {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier
                            .fillMaxSize()
                            .then(
                                // Fade the feed's TOP STRIP to transparent so cards dissolve INTO
                                // the background gradient as they scroll up behind the fixed
                                // header, instead of covering it. DstIn keeps card pixels where
                                // the mask is opaque; the mask stays transparent through the
                                // header body and ramps to fully-kept only in the last fifth,
                                // right where cards emerge below the header — so the resting
                                // first card is not faded and nothing ghosts through the gaps
                                // around the logo and title. Offscreen compositing is required
                                // for DstIn to blend against the list, not the framebuffer.
                                if (isComposerUi) Modifier
                                    .graphicsLayer {
                                        compositingStrategy = CompositingStrategy.Offscreen
                                    }
                                    .drawWithContent {
                                        drawContent()
                                        drawRect(
                                            brush = Brush.verticalGradient(
                                                colorStops = arrayOf(
                                                    0f to Color.Transparent,
                                                    0.80f to Color.Transparent,
                                                    1f to Color.Black,
                                                ),
                                                startY = 0f,
                                                endY = headerContentPx.coerceAtLeast(1f),
                                            ),
                                            blendMode = BlendMode.DstIn,
                                        )
                                    }
                                else Modifier
                            ),
                        // App parity (HomeScreen.kt:886): reserve the floating composer's height
                        // so the last feed card is not hidden behind it. composerBarHeight already
                        // folds in max(navBar, 20), so it REPLACES the nav-bar inset, not stacks.
                        contentPadding = PaddingValues(
                            bottom = if (isComposerUi) composerBarHeight(floating = true, hasAttachment = photoUris.isNotEmpty()) else 24.dp
                        )
                    ) {
                        // Greeting (1.0.0) / agentic top section (2.0.0)
                        item(key = "greeting") {
                          if (isComposerUi) {
                            // App parity (HomeScreen.kt 70adc5fd): the agentic header CONTENT
                            // (centred logo mark + leaf-flanked "For your farm today" + the
                            // location pill, Figma 1.2 Home) is a FIXED overlay drawn above this
                            // list — see the end of the enclosing Box. It used to be this list
                            // item, pinned by countering the scroll offset and faded over ~90dp,
                            // with zIndex(-1) so later cards drew over it; the pin fought the
                            // list and the header scrolled away under fast flings.
                            // Item 0 now reserves exactly the overlay's height so the first card
                            // rests right below it, and keeping the item present preserves every
                            // downstream feed index.
                            // Floor of 1px: before the overlay is measured (first load only —
                            // headerContentPx is saveable) a 0-height item 0 is skipped as the
                            // anchor, so the list anchored on the FIRST CARD and kept it pinned
                            // under the header once the spacer grew — the image rendered half
                            // hidden. A non-zero item 0 stays the anchor and grows downward.
                            Spacer(
                                modifier = Modifier
                                    .height(with(feedDensity) { headerContentPx.coerceAtLeast(1f).toDp() })
                            )
                          } else {
                            // App parity (HomeScreen.kt:1117): the LABEL, and only the label.
                            //
                            // This used to prefer `feed.greeting` from the #12 response and fall
                            // back to the label. That was a LOCALISATION BUG: the API's `greeting`
                            // is English-only, so preferring it meant a Kannada device rendered
                            // "Get started by clicking on Photo, Speak, or Type to ask your
                            // question" while the served `..._kn` value
                            // ("ಮಾತನಾಡಿ, ಫೋಟೋ ಕಳುಹಿಸಿ ಅಥವಾ ಬರೆದು ಕೇಳಿ") sat unused. Observed on
                            // emulator-5554. The app reads `.greeting` nowhere — its variable is
                            // misleadingly NAMED `greetingFromApi` but holds `getLabel(...)`.
                            //
                            // The old comment justified the divergence as avoiding a permanent
                            // skeleton on an empty feed. That reasoning inverts: `label()` always
                            // returns something (the served string, the fallback, or the key), so
                            // the label alone can never be null and the skeleton cannot stick.
                            val greetingText = label(
                                Labels.GET_STARTED_BY_CLICKING_ON_PHOTO_SPEAK_OR_TYPE_TO_ASK_YOUR_QUESTION,
                                "Tap a button to ask a question"
                            ).takeIf { it.isNotBlank() }
                            Crossfade(
                                targetState = greetingText,
                                animationSpec = tween(durationMillis = 300),
                                // App parity (HomeScreen.kt:1121). The SDK had NO modifier here at
                                // all, and the missing `.background()` was a readability bug, not a
                                // spacing one: the greeting is `foregroundPrimary` — WHITE on this
                                // brand — and without the green band behind it the text landed on
                                // the page's light grey. Measured on emulator-5554 straight after
                                // onboarding: #FFFFFF on #ECECEE, a contrast ratio of **1.18:1**
                                // where WCAG AA wants 3.0:1 for large text. The line was there and
                                // effectively invisible.
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 40.dp)
                                    .background(brand.surfacePrimary)
                                    .wrapContentHeight(Alignment.CenterVertically),
                                label = "greetingCrossfade"
                            ) { greeting ->
                                if (greeting != null) {
                                    Text(
                                        text = greeting,
                                        // App parity (HomeScreen.kt:1165): the LEGACY (non-composer)
                                        // Home greeting is titleMedium (18sp), not displaySmall
                                        // (24sp) — a two-step overshoot. The agentic header above
                                        // is a `SectionHeader` and is unaffected; this branch is
                                        // what a host that leaves `enableComposerUi` off sees.
                                        style = MaterialTheme.typography.titleMedium,
                                        color = brand.foregroundPrimary,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            // App parity: 16 dp horizontal, and the one-second
                                            // attention wobble. `attentionWobble` was ported into
                                            // `components/AttentionWobble.kt` but had NO call site
                                            // anywhere in the SDK — a component that exists is not
                                            // a feature until something invokes it.
                                            .padding(horizontal = 16.dp)
                                            .attentionWobble(trigger = true, delayMs = 1000L)
                                    )
                                } else {
                                    GreetingSkeleton()
                                }
                            }
                          }
                        }

                        // Sticky Photo / Speak / Type.
                        // App parity (HomeScreen.kt:1184): the slot is kept but rendered empty in
                        // agentic mode — the floating composer replaces these buttons.
                        stickyHeader(key = "inputButtons") {
                            if (!isComposerUi) {
                                PrimaryInputButtons(
                                    type = PrimaryInputButtonsType.HomeScreen,
                                    onPhotoClick = { openPhotoInput?.invoke() },
                                    onSpeakClick = { requestMicThenOpenVoice() },
                                    onTypeClick = {
                                        openTextInput?.invoke()
                                        focusTextInput?.invoke()
                                    },
                                    isSticky = isInputSticky
                                )
                            } else {
                                Spacer(modifier = Modifier.height(0.dp))
                            }
                        }

                        // SSFR card (C3: gated by config.enableSsfr)
                        if (feed.ssfr_enable == true && graph.config.enableSsfr) {
                            item(key = "ssfr") {
                                SsfrCard(
                                    onWheatClick = {
                                        if (!isNetworkAvailable(context)) {
                                            onNavigateToError(true, "home_card")
                                            return@SsfrCard
                                        }
                                        onNavigateToChat(
                                            Destination.Chat(
                                                question = label(
                                                    Labels.SSFR_WHEAT_QUESTION,
                                                    "What is the recommended quantity of fertiliser for wheat?"
                                                ),
                                                isSSFR = true,
                                                ssfrCrop = "wheat"
                                            )
                                        )
                                    },
                                    onMaizeClick = {
                                        if (!isNetworkAvailable(context)) {
                                            onNavigateToError(true, "home_card")
                                            return@SsfrCard
                                        }
                                        onNavigateToChat(
                                            Destination.Chat(
                                                question = label(
                                                    Labels.SSFR_MAIZE_QUESTION,
                                                    "What is the recommended quantity of fertiliser for maize?"
                                                ),
                                                isSSFR = true,
                                                ssfrCrop = "maize"
                                            )
                                        )
                                    },
                                    modifier = Modifier.padding(horizontal = 16.dp)
                                )
                            }
                        }

                        // App parity (HomeScreen.kt:1308): agentic mode already shows
                        // "For your farm today" as the top-of-feed SectionHeader under the app
                        // bar, so the in-feed FeedHeader is skipped to avoid a duplicate title.
                        if (!isComposerUi) {
                            item(key = "feedHeader") {
                                FeedHeader(
                                    title = label(Labels.FOR_YOUR_FARM_TODAY, "For your farm today")
                                )
                            }
                        }

                        // Feed sections
                        visibleSections.forEachIndexed { index, section ->
                            item(key = "section_${section.stableId()}_$index") {
                                HomeFeedSection(
                                    section = section,
                                    index = index,
                                    userId = userId,
                                    isFetchingStatement = pendingCardSection?.stableId() == section.stableId() &&
                                        homeState.imageStatementState is UiState.Loading,
                                    onCardClick = onCardClick@{
                                        // App HomeScreen.kt:607 — offline → No Internet, nothing sent.
                                        if (!isNetworkAvailable(context)) {
                                            onNavigateToError(true, "home_card")
                                            return@onCardClick
                                        }
                                        // App HomeScreen.kt:610 — full HomeCardAnalytics payload.
                                        graph.analytics.trackHomeCardEvent(
                                            AnalyticsEvents.CARD_CLICKED,
                                            section.toHomeCardAnalytics(
                                                positionLabels.getOrElse(index) { "" }
                                            )
                                        )
                                        // App parity (HomeScreen.kt:616-660).
                                        val cardType = section.type.orEmpty()
                                        val isImageCard = cardType == "image"
                                        val cardTriggerType = when (cardType) {
                                            "image" -> "image_card"
                                            "statement" -> "text_card"
                                            else -> null
                                        }

                                        // With AGENTIC CHAT on, the card tap SKIPS the
                                        // pre-generated-answer API (#26 FetchImageStatement) and
                                        // sends the card question into chat as a normal text
                                        // query, for both image and statement cards.
                                        //
                                        // The gate is `enableAgenticChat`, NOT the composer flag.
                                        // The app branches on getAgenticChatEnabled(), and the two
                                        // config flags are independent by design
                                        // (FarmerChatConfig: `enableComposerUi` null ⇒ follow
                                        // agentic). Gating on the composer meant a host running
                                        // composer-UI WITHOUT agentic chat skipped the
                                        // pre-generated answer it should have fetched, and a host
                                        // running agentic chat WITHOUT the composer fetched one
                                        // the app would have skipped.
                                        if (graph.config.enableAgenticChat) {
                                            val question = section.question_text
                                                ?: section.title.orEmpty()
                                            if (question.isNotBlank()) {
                                                onNavigateToChat(
                                                    Destination.Chat(
                                                        question = question,
                                                        // Display-only banner, image cards only —
                                                        // `takeIf { isImageCard }` mirrors the app.
                                                        contentCardImageUrl = section.image_url
                                                            ?.takeIf { isImageCard && it.isNotBlank() },
                                                        contentCardTriggerType = cardTriggerType
                                                        // NO homeStatementId here: the app does not
                                                        // pass one on this path, and setting it
                                                        // routed the tap into the PRE-GENERATED
                                                        // branch of ChatScreen — which then had no
                                                        // answer, fell back to a bare
                                                        // initializeWithQuestion(), and so sent no
                                                        // triggered_input_type and fired neither
                                                        // Send_Query_Initiated nor Send_Query.
                                                    )
                                                )
                                            }
                                            return@onCardClick
                                        }
                                        pendingCardSection = section
                                        vm.onAction(
                                            HomeAction.FetchImageStatement(
                                                statementId = (section.statement_id ?: section.id)
                                                    ?.toString().orEmpty(),
                                                // App parity (HomeScreen.kt:660): the non-agentic
                                                // path falls back to `statement_type`, not a
                                                // literal "card".
                                                triggered_input_type = cardTriggerType
                                                    ?: section.statement_type
                                                    ?: "NA"
                                            )
                                        )
                                    },
                                    onCardVisible = {
                                        // App HomeScreen.kt:2074 — Card_Viewed once per card,
                                        // with the full HomeCardAnalytics payload.
                                        if (viewedCardIds.add(section.stableId())) {
                                            graph.analytics.trackHomeCardEvent(
                                                AnalyticsEvents.CARD_VIEWED,
                                                section.toHomeCardAnalytics(
                                                    positionLabels.getOrElse(index) { "" }
                                                )
                                            )
                                        }
                                    },
                                    onMarkViewed = { statementId ->
                                        if (markedViewed.add(statementId) && userId.isNotBlank()) {
                                            vm.onAction(HomeAction.MarkImageViewed(statementId, userId))
                                        }
                                    },
                                    onSingleConfirmed = { optionId, optionText ->
                                        // Gender question card
                                        val genderValue = optionId ?: optionText
                                        // App HomeScreen.kt:1401 — Card_Clicked carries the
                                        // selection as `Value`.
                                        graph.analytics.trackHomeCardEvent(
                                            AnalyticsEvents.CARD_CLICKED,
                                            section.toHomeCardAnalytics(""),
                                            value = genderValue
                                        )
                                        // App HomeScreen.kt:1407 — `{screen_name, gender}`.
                                        graph.analytics.track(
                                            AnalyticsEvents.QUESTION_CARD_DATA_SUBMITTED,
                                            mapOf(
                                                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
                                                AnalyticsProps.GENDER to genderValue
                                            )
                                        )
                                        vmProfile.onAction(
                                            UserNameAction.UpdateUserName(
                                                UserNameRequest(
                                                    user_id = userId,
                                                    gender = genderValue
                                                )
                                            ),
                                            AnalyticsScreens.HOME
                                        )
                                        true
                                    },
                                    onMultiConfirmed = { ids, texts ->
                                        val statementType = section.statement_type.orEmpty()
                                        val isLivestock =
                                            statementType.contains("livestock", ignoreCase = true) ||
                                                ids.any { it.contains("livestock", ignoreCase = true) }
                                        // App HomeScreen.kt:1454 — Card_Clicked carries the
                                        // selected ids as `Value`.
                                        graph.analytics.trackHomeCardEvent(
                                            AnalyticsEvents.CARD_CLICKED,
                                            section.toHomeCardAnalytics(""),
                                            value = ids.joinToString(",")
                                        )
                                        if (isLivestock) {
                                            // App HomeScreen.kt:1492 —
                                            // `{screen_name, livestock}`.
                                            graph.analytics.track(
                                                AnalyticsEvents.QUESTION_CARD_DATA_SUBMITTED,
                                                mapOf(
                                                    AnalyticsProps.SCREEN_NAME to
                                                        AnalyticsScreens.HOME,
                                                    AnalyticsProps.LIVESTOCK to
                                                        ids.joinToString(",")
                                                )
                                            )
                                            vmProfile.onAction(
                                                UserNameAction.UpdateUserName(
                                                    UserNameRequest(
                                                        user_id = userId,
                                                        live_stock_details = texts.map {
                                                            LiveStockDetail(count = 1, type = it)
                                                        }
                                                    )
                                                ),
                                                AnalyticsScreens.HOME
                                            )
                                        } else {
                                            vm.onAction(
                                                HomeAction.UpdateCultivatedCrops(
                                                    context = context,
                                                    userId = userId,
                                                    cropIds = ids
                                                )
                                            )
                                        }
                                        true
                                    },
                                    onDismissed = { vm.dismissCard(section.stableId()) }
                                )
                                // App parity (HomeScreen.kt:1507, commit 891142ce "16 dp space
                                // added between each cards"): the gap between feed cards is this
                                // TRAILING spacer, skipped only for plotline_widget (which the SDK
                                // already filters out of visibleSections). Trailing, so the first
                                // card still rests right under the header.
                                Spacer(modifier = Modifier.height(16.dp))
                            }
                        }

                        item(key = "feedFooter") {
                            FeedFooter()
                        }
                    }

                    if (isComposerUi) {
                        // App parity (HomeScreen.kt 70adc5fd): the FIXED header CONTENT — centred
                        // logo, leaf-flanked "For your farm today", location pill — pinned at the
                        // top of the feed while cards scroll beneath it. Drawn AFTER the
                        // LazyColumn so it sits above the cards, but with a TRANSPARENT background
                        // so the green gradient band behind the whole list shows through. Measured
                        // so item 0 reserves exactly this height and the feed's fade mask ends
                        // right here.
                        // SDK deviation (unchanged by this port): the app's fixed overlay also
                        // carries the app bar. Here the app bar sits in the Column ABOVE this
                        // list, because it must survive the loading and error branches that render
                        // no list at all — so it is already fixed and stays where it is.
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .align(Alignment.TopCenter)
                                .onSizeChanged { headerContentPx = it.height.toFloat() }
                                .padding(top = 0.dp, bottom = 16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Image(
                                painter = painterResource(id = R.drawable.fc_logo_mark),
                                contentDescription = null,
                                colorFilter = ColorFilter.tint(brand.foregroundPrimary),
                                modifier = Modifier.size(42.dp)
                            )
                            SectionHeader(
                                title = label(
                                    Labels.FOR_YOUR_FARM_TODAY,
                                    "For your farm today"
                                ),
                                titleColor = brand.foregroundPrimary,
                                verticalPadding = 0.dp,
                            )
                            HomeLocationPill(
                                manager = graph.locationPromptManager,
                                locationState = locationState,
                                prefs = graph.prefs,
                                profileApproxLocationName = homeState.approxLocationName
                            )
                        }
                    }
                    }
                }
            }
        }

        // ------------------------------------------------------------------ overlays
        if (isComposerUi) {
            // App parity (HomeScreen.kt:1590): persistent floating composer (camera / text
            // field / mic|send) replacing BOTH the sticky PrimaryInputButtons and the text
            // overlay. Floating mode consumes nav + IME insets internally, so this takes a
            // plain Modifier — imePadding()/navigationBarsPadding() here would double the
            // bottom inset and float the pill too high. isAnchored keeps it always visible.
            InputComposer(
                floating = true,
                isAnchored = true,
                showAura = true,
                surfaceColor = brand.surfacePrimary,
                placeholder = label(Labels.ASK_ABOUT_YOUR_FARM, "Ask about your farm..."),
                photoUris = photoUris,
                onRemovePhoto = { index ->
                    photoUris = photoUris.toMutableList().also { it.removeAt(index) }
                },
                // With the buttons gone this is the only focus entry point left, so it takes
                // over both refs the legacy Type button drove.
                onFocusRequest = { requester ->
                    focusTextInput = requester
                    openTextInput = requester
                },
                onClearRequest = { clear -> clearTextInput = clear },
                onPhotoClick = {
                    // Camera is only offered when no image is attached; same guard and same
                    // CHAT_ICON_CLICKED (Image) event as the legacy Photo button.
                    if (photoUris.isEmpty()) {
                        graph.analytics.track(
                            AnalyticsEvents.CHAT_ICON_CLICKED,
                            mapOf(
                                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
                                AnalyticsProps.ICON_TYPE to "Image"
                            )
                        )
                        openPhotoInput?.invoke()
                    }
                },
                // Delegates to the same helper the legacy Speak button used, so the mic
                // permission guard and its events are not duplicated here.
                onVoiceClick = { requestMicThenOpenVoice() },
                // Tapping the field to type is the composer's equivalent of the legacy Type
                // button, so CHAT_ICON_CLICKED (Text) fires on focus gain — a reliable tap
                // signal, since the field's own gesture would starve a parent click handler.
                onFocusChange = { focused ->
                    if (focused) {
                        graph.analytics.track(
                            AnalyticsEvents.CHAT_ICON_CLICKED,
                            mapOf(
                                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
                                AnalyticsProps.ICON_TYPE to "Text"
                            )
                        )
                    }
                },
                onSend = { query -> sendMessage(query, photoUris.firstOrNull()) }
            )
        } else {
            TextInputOverlay(
                // App parity (HomeScreen.kt:1276) — see the note in ChatScreen: without
                // imePadding() the composer hides behind the keyboard.
                modifier = Modifier.imePadding().navigationBarsPadding(),
                onSend = { text, imageUri -> sendMessage(text, imageUri) },
                onPhotoClick = { openPhotoInput?.invoke() },
                onVoiceClick = { requestMicThenOpenVoice() },
                onFocusRequest = { requester ->
                    focusTextInput = requester
                    openTextInput = requester
                },
                onClearRequest = { clear -> clearTextInput = clear },
                photoUris = photoUris,
                onRemovePhoto = { index ->
                    photoUris = photoUris.toMutableList().also { it.removeAt(index) }
                }
            )
        }

        VoiceInput(
            onAudioRecorded = { file -> onVoiceAudioRecorded(file) },
            onOpenRequest = { open -> openVoiceInput = open },
            onRecordingFailed = { message -> toast.show(message, ToastState.Error) }
        )

        PhotoInput(
            onCameraClick = { requestCamera() },
            onGalleryClick = {
                runCatching { galleryLauncher.launch("image/*") }
            },
            onOpenRequest = { open -> openPhotoInput = open },
            onCloseRequest = { close -> closePhotoInput = close }
        )

        permissionDialogType?.let { type ->
            PermissionSettingsDialog(
                permissionType = type,
                screenName = AnalyticsScreens.HOME,
                onDismiss = { permissionDialogType = null },
                onGoToSettings = { openAppSettings(context) }
            )
        }

        // 2.0.0 in-app Terms-of-Use dialog. Guarded on a non-blank URL by the effect above; the
        // takeIf here keeps it correct even if state is refetched to null while it is open.
        if (showTermsOfUseDialog) {
            homeState.farmerchatTermsOfUse?.takeIf { it.isNotBlank() }?.let { termsUrl ->
                TermsOfUseDialog(
                    url = termsUrl,
                    title = label(Labels.TERMS_OF_USE, "Terms of Use"),
                    onDismiss = { showTermsOfUseDialog = false },
                    onAcceptAndContinue = {
                        // accept_terms (#7) — best-effort in core; the dialog closes either way.
                        // App TermsOfUseDialog.kt:161 — `ToS_Aug26_Accept_Terms` with
                        // `{screen_name: "TermsOfUseDialog", Accepted: true}`. The app's
                        // constant is named after Plotline but the EVENT NAME is an app
                        // constant, so emitting it is parity, not a new event; it reaches the
                        // host through FarmerChatAnalytics with no Plotline dependency
                        // (root CLAUDE.md §6).
                        graph.analytics.track(
                            AnalyticsEvents.PLOTLINE_ACCEPT_TERMS_CLICK_EVENT,
                            mapOf(
                                AnalyticsProps.SCREEN_NAME to
                                    AnalyticsScreens.TERMS_OF_USE_DIALOG_LITERAL,
                                AnalyticsProps.ACCEPTED to true
                            )
                        )
                        vm.onAction(HomeAction.AcceptTerms(userId))
                        showTermsOfUseDialog = false
                    }
                )
            }
        }

        // ---------------------------------------------------------------- ToU acceptance gate
        // App parity (HomeScreen.kt:1818): a non-cancellable bottom sheet shown whenever #7a
        // reports requires_acceptance=true, overlaying Home until the user accepts from either
        // the sheet's "Accept" or the content screen's "Accept terms" — both dispatch the same
        // HomeAction.AcceptTerms, and both are gated on the same acceptTermsState.
        // Both predicates live in core so this flavour and Views cannot drift on them.
        val requiresTermsAcceptance = homeState.requiresTermsAcceptance()
        // The gate loads latest_policy_version.terms_of_service_url from #7a — NOT
        // farmerchatTermsOfUse (#4), which belongs to the dismissible dialog above.
        val latestTermsOfServiceUrl = homeState.latestTermsOfServiceUrl()

        if (requiresTermsAcceptance) {
            // The app self-tracks this inside the sheet via AnalyticsManager; the SDK raises it
            // here through FarmerChatAnalytics instead (root CLAUDE.md §6).
            LaunchedEffect(Unit) {
                graph.analytics.track(
                    AnalyticsEvents.TERMS_OF_USE_SHEET_SHOWN,
                    mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
                )
            }
            TermsOfUseUpdatedBottomSheet(
                acceptState = homeState.acceptTermsState,
                onReadTerms = {
                    graph.analytics.track(
                        AnalyticsEvents.TERMS_OF_USE_READ_TERMS_CLICK_EVENT,
                        mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
                    )
                    showTermsContentScreen = true
                },
                onAccept = {
                    // Which CTA initiated this accept — read once #7 succeeds below, since
                    // Terms_Of_Use_Accept_Click_Event only fires on a successful response.
                    pendingAcceptSource = AnalyticsScreens.HOME
                    vm.onAction(HomeAction.AcceptTerms(userId))
                }
            )
        }

        // TermsOfUseContentDialog is a Dialog (separate window), so it visually covers the sheet
        // above regardless of composition order — no need to also hide the sheet here.
        if (showTermsContentScreen && !latestTermsOfServiceUrl.isNullOrBlank()) {
            LaunchedEffect(Unit) {
                graph.analytics.track(
                    AnalyticsEvents.TERMS_OF_USE_CONTENT_SCREEN_VIEWED,
                    mapOf(
                        AnalyticsProps.SCREEN_NAME to AnalyticsScreens.TERMS_OF_USE_CONTENT_SCREEN
                    )
                )
            }
            DisposableEffect(Unit) {
                onDispose {
                    graph.analytics.track(
                        AnalyticsEvents.TERMS_OF_USE_CONTENT_SCREEN_EXITED,
                        mapOf(
                            AnalyticsProps.SCREEN_NAME to AnalyticsScreens.TERMS_OF_USE_CONTENT_SCREEN
                        )
                    )
                }
            }
            TermsOfUseContentDialog(
                url = latestTermsOfServiceUrl,
                title = label(Labels.TERMS_OF_USE, "Terms of Use"),
                acceptState = homeState.acceptTermsState,
                onClose = { showTermsContentScreen = false },
                onAcceptTerms = {
                    pendingAcceptSource = AnalyticsScreens.TERMS_OF_USE_CONTENT_SCREEN
                    vm.onAction(HomeAction.AcceptTerms(userId))
                }
            )
        }

        // App parity (HomeScreen.kt:1856): Terms_Of_Use_Accept_Click_Event fires only once #7
        // actually succeeds (not on the raw tap); pendingAcceptSource, set right before
        // dispatching AcceptTerms, says which of the two CTAs triggered this success.
        LaunchedEffect(homeState.acceptTermsState) {
            val source = pendingAcceptSource
            if (homeState.acceptTermsState is UiState.Success<*> && source != null) {
                pendingAcceptSource = null
                graph.analytics.track(
                    AnalyticsEvents.TERMS_OF_USE_ACCEPT_CLICK_EVENT,
                    mapOf(AnalyticsProps.SCREEN_NAME to source)
                )
            }
        }

        // App parity (HomeScreen.kt:1874): let the user briefly see the "Accepted" checkmark
        // before the content screen closes (requiresTermsAcceptance flips false immediately, so
        // the sheet goes with it).
        LaunchedEffect(homeState.acceptTermsState) {
            if (homeState.acceptTermsState is UiState.Success<*> && showTermsContentScreen) {
                delay(1200)
                showTermsContentScreen = false
            }
        }

        // A failed #7 must not leave the gate inert: the sheet's buttons re-enable on
        // UiState.Error (acceptState is no longer Loading) so the farmer can retry. Surface the
        // reason too, since the sheet itself has no error slot in the app either.
        LaunchedEffect(homeState.acceptTermsState) {
            val error = homeState.acceptTermsState as? UiState.Error
            if (error != null && requiresTermsAcceptance) {
                toast.show(
                    error.message.ifBlank {
                        label(Labels.SOMETHING_WENT_WRONG, "Something went wrong")
                    },
                    ToastState.Error
                )
            }
        }

        Toast(
            message = toast.message,
            state = toast.state,
            visible = toast.isVisible,
            onDismiss = { toast.dismiss() }
        )
    }
}

/**
 * Location 2.0 pill (app parity: HomeScreen.kt:1789 `HomeLocationPill`). Real acquisition,
 * driven by the shared [LocationPromptManager] singleton — the same state machine the weather
 * button uses. Only reacts to states this pill itself raised (`source == LocalContext`) so the
 * weather flow does not visually hijack it.
 *
 * SDK adaptation of three app-only manager helpers, all derived here without touching core:
 *  • `isLocationEnabledOnce()`      → [LocationPromptManager.hasStoredLocation]
 *  • `hasCurrentLocationPermission()` → a live [ContextCompat] check in this layer
 *  • `isBlockedByPermission()`      → `PERMISSION_DENY_COUNT >= 2 && !hasPermission`
 *  • `getApproxLocationName()`      → `APPROX_LOCATION_NAME`, which core already writes from
 *    the #16 response's `display_address`. The app's separate never-overwritten
 *    IP_APPROX_LOCATION_NAME key does not exist in the SDK, so there is one name, not two.
 */
@Composable
private fun HomeLocationPill(
    manager: LocationPromptManager,
    locationState: LocationPromptState,
    prefs: SdkPreferences,
    /**
     * Profile-derived approximate place name, published to [HomeState.approxLocationName] after
     * `fetchUserProfile`'s async backfill (app parity: b72ea4da). Passed in as a CHANGING input
     * so the pill recomposes — and so re-reads the approx pref — once the backfill lands;
     * otherwise a farmer whose place name only exists server-side keeps seeing the "Set location"
     * invite until the next resume. Consumed only on the no-permission path.
     */
    profileApproxLocationName: String? = null
) {
    val context = LocalContext.current

    // Permission is changed in system Settings, so re-check on every resume. hasStoredLocation()
    // alone only means "a GPS fix was ever saved" — it stays true after the permission is
    // revoked, so it must be paired with a live check or the pill keeps showing a stale exact
    // location.
    val lifecycleOwner = LocalLifecycleOwner.current
    var resumeTick by remember { mutableStateOf(0) }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) resumeTick++
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    // FINE only — the same check the manager's decision tree uses (app parity).
    val hasPermission = remember(resumeTick, locationState) {
        manager.hasCurrentLocationPermission()
    }
    val hasExactLocation = remember(resumeTick, locationState) {
        manager.hasStoredLocation() && hasPermission
    }

    val isLocationButtonFlowActive = when (val st = locationState) {
        is LocationPromptState.Interstitial -> st.source == LocationTriggerSource.LocalContext
        is LocationPromptState.RequestPermission -> st.source == LocationTriggerSource.LocalContext
        is LocationPromptState.RequestEnableGps -> st.source == LocationTriggerSource.LocalContext
        is LocationPromptState.FetchingLocation -> st.source == LocationTriggerSource.LocalContext
        is LocationPromptState.Recovery -> st.source == LocationTriggerSource.LocalContext
        else -> false
    }

    // Permission-blocked is persistent (denyCount >= 2 && !hasPermission) rather than tied to
    // LocationPromptState.Recovery, so dismissing the "We need your location" sheet does not
    // make the pill fall back to approximate text while the permission is still blocked.
    val isLocationButtonBlocked = remember(resumeTick, locationState) {
        manager.isBlockedByPermission()
    }

    // Only show the "Getting your location" spinner once permission is granted and acquisition
    // has actually started — not while the OS permission dialog is still up, which reads as
    // "started too early".
    val isLocationButtonSearching = when (val st = locationState) {
        is LocationPromptState.RequestEnableGps -> st.source == LocationTriggerSource.LocalContext
        is LocationPromptState.FetchingLocation -> st.source == LocationTriggerSource.LocalContext
        else -> false
    }

    // Derived fresh every recomposition (cheap prefs read) rather than cached, so a permission
    // revocation is picked up immediately via resumeTick above. Falls back to the profile-derived
    // name from state so the pill resolves in the brief window before the backfill's pref write
    // is observed (and so it recomposes at all once the profile fetch lands).
    val locationPlaceName = prefs.getString(SdkPreferences.Keys.APPROX_LOCATION_NAME, "")
        .ifBlank { profileApproxLocationName.orEmpty() }

    var showLocationSuccess by remember { mutableStateOf(false) }
    var wasLocationButtonFlowActive by remember { mutableStateOf(false) }
    LaunchedEffect(locationState) {
        if (wasLocationButtonFlowActive &&
            locationState == LocationPromptState.Idle &&
            manager.hasStoredLocation()
        ) {
            // Flow just completed successfully — hold the checkmark briefly.
            showLocationSuccess = true
            delay(1500)
            showLocationSuccess = false
        }
        wasLocationButtonFlowActive = isLocationButtonFlowActive
    }

    val locationButtonState = when {
        isLocationButtonBlocked -> LocationButtonState.Blocked
        isLocationButtonSearching -> LocationButtonState.Searching
        showLocationSuccess -> LocationButtonState.Success
        hasExactLocation || locationPlaceName.isNotBlank() -> LocationButtonState.Located
        else -> LocationButtonState.Invite
    }

    LocationButton(
        state = locationButtonState,
        placeName = locationPlaceName,
        onClick = {
            // Re-run the flow rather than jumping straight to Settings — with denyCount >= 2
            // and no permission, the manager lands on Recovery, which is what shows the
            // "We need your location" sheet (with its own "Turn on in Settings" button) again.
            if (manager.state.value == LocationPromptState.Idle) {
                manager.triggerFromLocalContext()
            }
        }
    )
}

/** One feed section rendered per type (image/statement, single/multi question). */
@Composable
private fun HomeFeedSection(
    section: SectionDto,
    index: Int,
    userId: String,
    isFetchingStatement: Boolean,
    onCardClick: () -> Unit,
    /** Fired once when the card first composes — the SDK's Card_Viewed trigger. */
    onCardVisible: () -> Unit,
    onMarkViewed: (String) -> Unit,
    onSingleConfirmed: (optionId: String?, optionText: String) -> Boolean,
    onMultiConfirmed: (ids: List<String>, texts: List<String>) -> Boolean,
    onDismissed: () -> Unit
) {
    // App parity (HomeScreen.kt:1310 `cardModifier`, :1241 SsfrCard): horizontal 16dp ONLY. The
    // list uses spacedBy(0.dp) and the inter-card gap is a trailing 16dp Spacer in the list item
    // (see the caller), so an extra `vertical = 8.dp` here pushed the FIRST card 8dp below where the app rests it — measured
    // against the app on emulator-5554: app card top y=655, SDK y=676, with an identical header.
    val type = section.type?.lowercase().orEmpty()

    // App HomeScreen.kt:2059-2080 — the app's trackCardVisibility modifier is applied to
    // every feed card, not just content cards.
    LaunchedEffect(section.stableId()) { onCardVisible() }

    when {
        type == "question" || !section.options.isNullOrEmpty() -> {
            val options = section.options.orEmpty()
            val labels = options.map { it.text.orEmpty() }
            val ids = options.map { it.id.orEmpty() }
            val question = section.statement ?: section.title.orEmpty()

            if (section.selection_type?.lowercase() == "single") {
                SingleSelectCard(
                    question = question,
                    options = labels,
                    onConfirmed = { selectedIndex ->
                        onSingleConfirmed(
                            ids.getOrNull(selectedIndex),
                            labels.getOrNull(selectedIndex).orEmpty()
                        )
                    },
                    onDismissed = onDismissed,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
            } else {
                MultiSelectCard(
                    question = question,
                    options = labels,
                    optionIds = ids,
                    onConfirmed = { selectedIndices ->
                        onMultiConfirmed(
                            selectedIndices.mapNotNull { ids.getOrNull(it) },
                            selectedIndices.mapNotNull { labels.getOrNull(it) }
                        )
                    },
                    onDismissed = onDismissed,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
            }
        }

        else -> {
            // Content card (image / statement). Mark viewed once composed (visible).
            val statementId = (section.statement_id ?: section.id)?.toString().orEmpty()
            LaunchedEffect(statementId) {
                if (statementId.isNotBlank() && section.is_viewed != true && userId.isNotBlank()) {
                    onMarkViewed(statementId)
                }
            }

            ContentCard(
                headline = section.question_text ?: section.title.orEmpty(),
                imageUrl = section.image_url,
                // App parity (HomeScreen.kt:1337-1355): the view-count badge is passed for IMAGE
                // cards only, and NO personalisation tag at all — the app's ContentCard still
                // supports `personalizationLabel` but Home never sets it, so a statement card with
                // `meta.asset_name` ("Preventive pest management") renders headline-only there.
                viewCount = if (type == "image") section.badge?.takeIf { it.show == true }?.count else null,
                isButtonLoading = isFetchingStatement,
                onClick = onCardClick,
                modifier = Modifier.padding(horizontal = 16.dp)
            )
        }
    }
}

@Composable
private fun GreetingSkeleton() {
    val colors = LocalContentColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.7f)
                .height(28.dp)
                .background(colors.shimmer.copy(alpha = 0.4f), SmoothShapes.rounded(Radius.SM))
        )
        Box(
            modifier = Modifier
                .fillMaxWidth(0.45f)
                .height(28.dp)
                .background(colors.shimmer.copy(alpha = 0.4f), SmoothShapes.rounded(Radius.SM))
        )
        Spacer(modifier = Modifier.height(0.dp))
    }
}

/**
 * Converts the recorded audio file to base64 off the main thread and dispatches
 * HomeAction.TranscribeAudio (doc 01 §3.7 voice-on-home flow).
 */
private fun org.digitalgreen.farmerchat.sdk.core.ui.home.HomeViewModel.viewModelScopeLaunchTranscribe(
    context: android.content.Context,
    conversationId: String,
    file: File,
    showToast: (String, ToastState) -> Unit
) {
    if (conversationId.isBlank()) {
        showToast(
            label(
                Labels.NO_AUDIO_RECORDED_OR_CONVERSATION_NOT_STARTED,
                "No audio recorded or conversation not started"
            ),
            ToastState.Error
        )
        return
    }
    // Base64 conversion is fast for ≤30 s clips; done inline (NO_WRAP as backend expects).
    val base64 = AudioRecorder.convertAudioToBase64(file)
    if (base64 == null) {
        showToast(label(Labels.FAILED_TO_PROCESS_AUDIO, "Failed to process audio"), ToastState.Error)
        return
    }
    onAction(
        HomeAction.TranscribeAudio(
            context = context,
            conversationId = conversationId,
            query = base64,
            messageReferenceId = UUID.randomUUID().toString(),
            audioFormat = AudioRecorder.getAudioFormat(),
            triggeredType = "voice"
        )
    )
}
