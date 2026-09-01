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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.components.HomeAppBar
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
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptState
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
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HomeScreen(
    openDrawer: () -> Unit,
    onNavigateToChat: (Destination.Chat) -> Unit
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
            onNavigateToChat(Destination.Chat(question = "", imageUri = uri.toString()))
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
            onNavigateToChat(Destination.Chat(question = "", imageUri = uri.toString()))
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

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(brand.surfacePrimary)
    ) {
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
                onWeatherClick = { onWeatherClick() }
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
                        contentPadding = PaddingValues(bottom = 24.dp)
                    ) {
                        // Greeting
                        item(key = "greeting") {
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

                        // Sticky Photo / Speak / Type
                        stickyHeader(key = "inputButtons") {
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

                        item(key = "feedHeader") {
                            FeedHeader(title = label(Labels.FOR_YOUR_FARM_TODAY, "For your farm today"))
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
                                    onCardClick = {
                                        graph.analytics.track(
                                            AnalyticsEvents.CARD_CLICKED,
                                            mapOf(
                                                AnalyticsProps.CARD_POSITION to index,
                                                AnalyticsProps.SENTENCE_ID to
                                                    (section.statement_id ?: section.id)?.toString()
                                            )
                                        )
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
        TextInputOverlay(
            // App parity (HomeScreen.kt:1276) — see the note in ChatScreen: without imePadding()
            // the composer hides behind the keyboard.
            modifier = Modifier.imePadding().navigationBarsPadding(),
            onSend = { text, imageUri -> sendMessage(text, imageUri) },
            onPhotoClick = { openPhotoInput?.invoke() },
            onVoiceClick = { requestMicThenOpenVoice() },
            onFocusRequest = { requester -> focusTextInput = requester; openTextInput = requester },
            onClearRequest = { clear -> clearTextInput = clear },
            photoUris = photoUris,
            onRemovePhoto = { index ->
                photoUris = photoUris.toMutableList().also { it.removeAt(index) }
            }
        )

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

        Toast(
            message = toast.message,
            state = toast.state,
            visible = toast.isVisible,
            onDismiss = { toast.dismiss() }
        )
    }
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
