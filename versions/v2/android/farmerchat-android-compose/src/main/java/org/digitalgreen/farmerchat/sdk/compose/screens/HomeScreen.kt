package org.digitalgreen.farmerchat.sdk.compose.screens

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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.zIndex
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.R
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
import org.digitalgreen.farmerchat.sdk.core.audio.AudioRecorder
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.LiveStockDetail
import org.digitalgreen.farmerchat.sdk.core.model.SectionDto
import org.digitalgreen.farmerchat.sdk.core.model.UserNameRequest
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.home.HomeAction
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
    onTermsOfUseRequestConsumed: () -> Unit = {}
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

    // 2.0.0 composer/agentic Home. The app gates this on two independent Firebase Remote
    // Config flags (`getComposerUiEnabled()` for the input surface, `getAgenticChatEnabled()`
    // for the visual theme + card-tap API routing). The SDK carries no Remote Config and
    // exposes exactly one host-set switch, so both collapse onto `enableAgenticChat`. Read
    // once — SDK config is immutable after initialize(), so the app's post-fetch re-read
    // (`OnboardingRemoteConfig.refresh()` on every feed state change) has no analogue here.
    val isComposerUi = graph.config.enableAgenticChat

    val userId = remember { graph.prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "") }
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
            toast.show(label(Labels.NO_CAMERA_APP_AVAILABLE, "No camera app available"), ToastState.Error)
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
                    "Voice input is not available for your selected language"
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
    }

    // ------------------------------------------------------------------ terms-of-use dialog
    var showTermsOfUseDialog by remember { mutableStateOf(false) }

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
            graph.analytics.track(AnalyticsEvents.TERMS_OF_USE_OPENED)
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
                            "We couldn't hear that clearly. Please try again."
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
        graph.analytics.track(AnalyticsEvents.WEATHER_FORECAST_VIEWED)
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
    val isWidgetGpsLoading = locationState is LocationPromptState.FetchingLocation

    // App parity (HomeScreen.kt:976): in agentic mode the app surface is the grey reading
    // surface and the green lives only in the gradient band below, which bleeds down behind
    // the header and first card. Non-agentic keeps the v1 green base untouched.
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(if (isComposerUi) colors.surfacePrimary else brand.surfacePrimary)
    ) {
        if (isComposerUi) {
            // Fixed green→transparent vertical gradient fading into the grey surface (Figma 1.2
            // Home). Solid green to ~58.8% of a band ~36.6% of the screen tall, transparent by
            // its bottom. It sits BEHIND the list and fades out over ~215dp of scroll so it does
            // not linger once scrolled. Sunbeams sway inside it; the yellow glow sits top-centre.
            val configuration = LocalConfiguration.current
            val density = LocalDensity.current
            val fadeEndDp = (configuration.screenHeightDp * 0.366f).dp
            val fadeEndPx = with(density) { fadeEndDp.toPx() }
            val gradientFadePx = with(density) { 215.dp.toPx() }
            val gradientAlpha by remember {
                derivedStateOf {
                    if (listState.firstVisibleItemIndex > 0) 0f
                    else (1f - listState.firstVisibleItemScrollOffset / gradientFadePx)
                        .coerceIn(0f, 1f)
                }
            }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(fadeEndDp)
                    .graphicsLayer { alpha = gradientAlpha }
                    .background(
                        Brush.verticalGradient(
                            colorStops = arrayOf(
                                0f to brand.surfacePrimary,
                                0.588f to brand.surfacePrimary,
                                1f to brand.surfacePrimary.copy(alpha = 0f),
                            ),
                            startY = 0f,
                            endY = fadeEndPx,
                        )
                    )
            ) {
                Sunbeams(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(280.dp)
                        .align(Alignment.TopCenter),
                    visibleProvider = { gradientAlpha },
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
                    graph.analytics.track(AnalyticsEvents.HAMBURGER_MENU_CLICKED)
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
                                graph.analytics.track(AnalyticsEvents.CONTENT_TRY_AGAIN_CLICKED)
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

                    LazyColumn(
                        state = listState,
                        modifier = Modifier.weight(1f),
                        // App parity (HomeScreen.kt:886): reserve the floating composer's height
                        // so the last feed card is not hidden behind it. composerBarHeight already
                        // folds in max(navBar, 20), so it REPLACES the nav-bar inset, not stacks.
                        contentPadding = PaddingValues(
                            bottom = if (isComposerUi) composerBarHeight(floating = true) else 24.dp
                        )
                    ) {
                        // Greeting (1.0.0) / agentic top section (2.0.0)
                        item(key = "greeting") {
                          if (isComposerUi) {
                            // App parity (HomeScreen.kt:1042): centred logo mark + leaf-flanked
                            // "For your farm today" + the location pill (Figma 1.2 Home). It is
                            // the list's FIRST item so its buttons stay tappable, but it is
                            // PINNED and FADED as the list scrolls so cards rise and draw over it
                            // instead of it scrolling away:
                            //   • translationY = firstVisibleItemScrollOffset → counters the scroll
                            //   • alpha fades over ~90dp
                            //   • zIndex(-1) forces later card items to draw on top
                            //   • the pin is released once invisible (a > 0f) so faded controls
                            //     do not eat taps meant for cards risen to the top strip
                            // SDK deviation: the app pins the app bar inside this same block. Here
                            // the app bar sits in a Column ABOVE the list (it must survive the
                            // loading and error branches, which render no list at all), so it is
                            // already fixed and only this block is pinned.
                            val headerDensity = LocalDensity.current
                            val headerFadePx = with(headerDensity) { 90.dp.toPx() }
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .zIndex(-1f)
                                    .graphicsLayer {
                                        val idx = listState.firstVisibleItemIndex
                                        val off = listState.firstVisibleItemScrollOffset
                                        val a = if (idx > 0) 0f
                                        else (1f - off / headerFadePx).coerceIn(0f, 1f)
                                        alpha = a
                                        translationY =
                                            if (idx == 0 && a > 0f) off.toFloat() else 0f
                                    }
                                    .padding(top = 2.dp, bottom = 16.dp),
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
                                    prefs = graph.prefs
                                )
                            }
                          } else {
                            // `greeting` is ABSENT from the #12 response whenever the feed is
                            // empty (no resolved location), so keying the skeleton off it alone
                            // shimmers forever on a loaded-but-empty feed. App parity:
                            // fc-compose HomeScreen.kt:892 renders this label and never uses the
                            // API greeting at all. Here we prefer the API greeting when present
                            // and fall back to the label — never a permanent skeleton.
                            val greetingText = feed.greeting?.takeIf { it.isNotBlank() }
                                ?: label(
                                    Labels.GET_STARTED_BY_CLICKING_ON_PHOTO_SPEAK_OR_TYPE_TO_ASK_YOUR_QUESTION,
                                    "Ask by Voice, Photo or Text"
                                ).takeIf { it.isNotBlank() }
                            Crossfade(
                                targetState = greetingText,
                                label = "greetingCrossfade"
                            ) { greeting ->
                                if (greeting != null) {
                                    Text(
                                        text = greeting,
                                        style = MaterialTheme.typography.displaySmall,
                                        color = brand.foregroundPrimary,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 24.dp, vertical = 20.dp)
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
                                        onNavigateToChat(
                                            Destination.Chat(
                                                question = label(
                                                    Labels.SSFR_WHEAT_QUESTION,
                                                    "Give me fertilizer recommendation for my wheat farm"
                                                ),
                                                isSSFR = true,
                                                ssfrCrop = "wheat"
                                            )
                                        )
                                    },
                                    onMaizeClick = {
                                        onNavigateToChat(
                                            Destination.Chat(
                                                question = label(
                                                    Labels.SSFR_MAIZE_QUESTION,
                                                    "Give me fertilizer recommendation for my maize farm"
                                                ),
                                                isSSFR = true,
                                                ssfrCrop = "maize"
                                            )
                                        )
                                    },
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
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
                                        graph.analytics.track(
                                            AnalyticsEvents.CARD_CLICKED,
                                            mapOf(
                                                AnalyticsProps.CARD_POSITION to index,
                                                AnalyticsProps.SENTENCE_ID to
                                                    (section.statement_id ?: section.id)?.toString()
                                            )
                                        )
                                        // App parity (HomeScreen.kt:633): with agentic chat on,
                                        // the card tap SKIPS the pre-generated-answer API (#13
                                        // FetchImageStatement) and sends the card question into
                                        // chat as a normal text query, for both image and
                                        // statement cards.
                                        //
                                        // SDK deviation: the app also forwards the card image url
                                        // so chat can show it as a display-only banner on the user
                                        // bubble. Destination.Chat has no display-only image
                                        // field — its `imageUri` routes the query through image
                                        // analysis, which is exactly what this path must avoid —
                                        // so the banner is dropped. Likewise the app's
                                        // `cardTriggerType` (triggered_input_type / click_type)
                                        // has no carrier on Destination.Chat and is dropped.
                                        if (isComposerUi) {
                                            val question = section.question_text
                                                ?: section.title.orEmpty()
                                            if (question.isNotBlank()) {
                                                onNavigateToChat(
                                                    Destination.Chat(
                                                        question = question,
                                                        homeStatementId =
                                                            (section.statement_id ?: section.id)
                                                                ?.toString()
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
                                                // App parity (HomeScreen.kt:580-584): content-card
                                                // tap sends image_card / text_card by section type.
                                                triggered_input_type = when (section.type?.lowercase()) {
                                                    "image" -> "image_card"
                                                    "statement" -> "text_card"
                                                    else -> "card"
                                                }
                                            )
                                        )
                                    },
                                    onMarkViewed = { statementId ->
                                        if (markedViewed.add(statementId) && userId.isNotBlank()) {
                                            vm.onAction(HomeAction.MarkImageViewed(statementId, userId))
                                        }
                                    },
                                    onSingleConfirmed = { optionId, optionText ->
                                        // Gender question card
                                        vmProfile.onAction(
                                            UserNameAction.UpdateUserName(
                                                UserNameRequest(
                                                    user_id = userId,
                                                    gender = optionId ?: optionText
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
                                        if (isLivestock) {
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
                            }
                        }

                        item(key = "feedFooter") {
                            FeedFooter()
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
                        // The app also tracks a Plotline ToS event here; the SDK emits no
                        // Plotline-named event (root CLAUDE.md §2 forbids new event names), so
                        // only the existing TERMS_OF_USE_OPENED above reaches the host.
                        vm.onAction(HomeAction.AcceptTerms(userId))
                        showTermsOfUseDialog = false
                    }
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
    prefs: SdkPreferences
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
    val hasPermission = remember(resumeTick, locationState) {
        hasLocationPermission(context)
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
        prefs.getInt(SdkPreferences.Keys.PERMISSION_DENY_COUNT, 0) >= 2 && !hasPermission
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
    // revocation is picked up immediately via resumeTick above.
    val locationPlaceName = prefs.getString(SdkPreferences.Keys.APPROX_LOCATION_NAME, "")

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
    onMarkViewed: (String) -> Unit,
    onSingleConfirmed: (optionId: String?, optionText: String) -> Boolean,
    onMultiConfirmed: (ids: List<String>, texts: List<String>) -> Boolean,
    onDismissed: () -> Unit
) {
    val type = section.type?.lowercase().orEmpty()

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
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
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
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
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
                viewCount = section.badge?.takeIf { it.show == true }?.count,
                personalizationLabel = section.meta?.asset_name,
                isButtonLoading = isFetchingStatement,
                onClick = onCardClick,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
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
