package org.digitalgreen.farmerchat.sdk.compose.screens

import android.Manifest
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.layer.drawLayer
import androidx.compose.ui.graphics.rememberGraphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.components.AiAnswerBlock
import org.digitalgreen.farmerchat.sdk.compose.components.LogoAppBar
import org.digitalgreen.farmerchat.sdk.compose.components.LogoSpinner
import org.digitalgreen.farmerchat.sdk.compose.components.LogoSpinnerType
import org.digitalgreen.farmerchat.sdk.compose.components.MarkdownText
import org.digitalgreen.farmerchat.sdk.compose.components.PermissionSettingsDialog
import org.digitalgreen.farmerchat.sdk.compose.components.PhotoInput
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButton
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryInputButtons
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryInputButtonsType
import org.digitalgreen.farmerchat.sdk.compose.components.ScrollIndicator
import org.digitalgreen.farmerchat.sdk.compose.components.SecondaryButton
import org.digitalgreen.farmerchat.sdk.compose.components.SuggestedCard
import org.digitalgreen.farmerchat.sdk.compose.components.Chip
import org.digitalgreen.farmerchat.sdk.compose.components.ChipType
import org.digitalgreen.farmerchat.sdk.compose.components.InputComposer
import org.digitalgreen.farmerchat.sdk.compose.components.composerBarHeight
import org.digitalgreen.farmerchat.sdk.compose.components.TextInputOverlay
import org.digitalgreen.farmerchat.sdk.compose.components.ThinkingIndicator
import org.digitalgreen.farmerchat.sdk.compose.components.Toast
import org.digitalgreen.farmerchat.sdk.compose.components.ToastState
import org.digitalgreen.farmerchat.sdk.compose.components.UserChatBubble
import org.digitalgreen.farmerchat.sdk.compose.components.VoiceClipState
import org.digitalgreen.farmerchat.sdk.compose.components.VoiceInput
import org.digitalgreen.farmerchat.sdk.compose.components.openAppSettings
import org.digitalgreen.farmerchat.sdk.compose.components.rememberToastState
import org.digitalgreen.farmerchat.sdk.compose.navigation.Destination
import org.digitalgreen.farmerchat.sdk.compose.theme.Green500
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.vm.rememberCoreViewModel
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.audio.AudioPlayback
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.chat.AlignmentChipRoute
import org.digitalgreen.farmerchat.sdk.core.ui.chat.ChatAction
import org.digitalgreen.farmerchat.sdk.core.ui.chat.ChatMessage
import org.digitalgreen.farmerchat.sdk.core.ui.chat.routeAlignmentChip
import java.io.File
import androidx.compose.ui.platform.LocalConfiguration
import org.digitalgreen.farmerchat.sdk.compose.components.StreamErrorCard
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentChip
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
import org.digitalgreen.farmerchat.sdk.core.model.StreamErrorKind
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptEvent
import org.digitalgreen.farmerchat.sdk.core.ui.location.isLocationObtained
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptState
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationTriggerSource
import org.digitalgreen.farmerchat.sdk.compose.components.AlignmentSurface
import org.digitalgreen.farmerchat.sdk.compose.components.LocationChatBubble

/**
 * Chat thread (doc 01 §3.8). Handles all entry modes (history, pre-generated,
 * image, voice, plain question), follow-ups, read-full-advice, retry, Listen
 * (TTS), voice-clip playback, share/download card and history pagination.
 */
/**
 * How long a streamed answer may stall, with no tool status, before the UI shows a transient
 * "Paused, resuming…" hint. Client-side only — not a failure, and it clears on the next delta.
 */
private const val PAUSE_HINT_DELAY_MS = 4000L

@Composable
fun ChatScreen(
    args: Destination.Chat,
    openDrawer: () -> Unit,
    onClose: () -> Unit
) {
    val graph = FarmerChat.requireGraph()
    val context = LocalContext.current
    val colors = LocalContentColors.current
    val brand = LocalBrandColors.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    val toast = rememberToastState()

    val vm = rememberCoreViewModel("chat") { graph.chatViewModel() }
    val state by vm.state.collectAsState()

    val isHistoryEntry = args.source == "history"

    // 2.0.0 composer UI. The app gates this on its own Firebase Remote Config flag
    // (`OnboardingRemoteConfig.getComposerUiEnabled()`), which is separate from the agentic
    // API flag. The SDK carries no Remote Config, so the host supplies it via
    // `enableComposerUi` (null ⇒ follow `enableAgenticChat`) — see versions/v2/README.md. Read
    // once — SDK config is immutable after initialize(), so the app's post-fetch re-read has no
    // analogue.
    val isComposerUi = graph.config.resolvedComposerUi

    // ------------------------------------------------------------------ audio playback (voice bubbles + TTS)
    val voicePlayback = remember { AudioPlayback() }
    val ttsPlayback = remember { AudioPlayback() }
    var playingVoiceMessageId by remember { mutableStateOf<String?>(null) }
    var voicePositionMs by remember { mutableStateOf(0L) }
    val voiceDurations = remember { mutableStateMapOf<String, Long>() }

    // ------------------------------------------------------------------ input overlays
    var focusTextInput by remember { mutableStateOf<(() -> Unit)?>(null) }
    var clearTextInput by remember { mutableStateOf<(() -> Unit)?>(null) }
    var openVoiceInput by remember { mutableStateOf<(() -> Unit)?>(null) }
    var openPhotoInput by remember { mutableStateOf<(() -> Unit)?>(null) }
    var closePhotoInput by remember { mutableStateOf<(() -> Unit)?>(null) }
    var photoUris by remember { mutableStateOf<List<Uri>>(emptyList()) }
    // True while the text composer overlay is focused — hide the Photo/Speak/Type
    // row so the composer doesn't overlap it.
    var textComposerActive by remember { mutableStateOf(false) }
    var cameraTempUri by remember { mutableStateOf<Uri?>(null) }
    var permissionDialogType by remember { mutableStateOf<String?>(null) }

    // History pagination scroll restore
    var prependOldCount by remember { mutableStateOf<Int?>(null) }
    var initialScrollDone by remember { mutableStateOf(false) }

    val listState = rememberLazyListState()

    // ------------------------------------------------------------------ answer reveal (client-side typewriter)
    // Tracks AiResponse ids whose reveal has finished. Fresh answers animate once;
    // history + pre-generated answers are marked complete immediately (no reveal).
    // The follow-up chips + action row only appear after the last answer's reveal.
    // This is UI-only state — the backend still returns the whole answer at once.
    val revealedIds = remember { mutableStateListOf<String>() }
    fun markRevealed(id: String) {
        if (id !in revealedIds) revealedIds.add(id)
    }

    // ------------------------------------------------------------------ init (one entry mode)
    LaunchedEffect(Unit) {
        graph.analytics.trackScreenView(AnalyticsScreens.CHAT)
        graph.errorNavigationManager.setActiveScreen("chat")

        if (state.messages.isNotEmpty()) return@LaunchedEffect

        when {
            args.conversationId != null -> {
                vm.onAction(ChatAction.LoadChatHistory(args.conversationId, page = 1))
            }

            !args.preGeneratedAnswer.isNullOrBlank() || args.homeStatementId != null -> {
                vm.onAction(
                    ChatAction.InitializeWithPreGeneratedContent(
                        question = args.question.orEmpty(),
                        answer = args.preGeneratedAnswer,
                        followUpQuestions = args.followUpQuestions.takeIf { it.isNotEmpty() },
                        homeStatementId = args.homeStatementId,
                        userMessageImageUri = args.imageUri?.let(Uri::parse)
                    )
                )
            }

            args.imageUri != null -> {
                vm.onAction(
                    ChatAction.SendQuestionWithImage(
                        question = args.question.orEmpty(),
                        imageUri = Uri.parse(args.imageUri)
                    )
                )
            }

            args.audioUri != null && args.question.isNullOrBlank() -> {
                vm.onAction(ChatAction.InitializeVoicePrototype(audioUri = args.audioUri))
            }

            !args.question.isNullOrBlank() -> {
                vm.onAction(
                    ChatAction.InitializeWithQuestion(
                        question = args.question,
                        transcriptionId = args.transcriptionId,
                        audioUri = args.audioUri?.let(Uri::parse),
                        isWeatherAdviceCTA = args.isWeatherAdviceCTA,
                        isSSFR = args.isSSFR,
                        ssfrCrop = args.ssfrCrop,
                        channel = args.channel
                    )
                )
            }
        }
    }

    // ------------------------------------------------------------------ lifecycle: pause audio ON_STOP
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) {
                voicePlayback.pause()
                ttsPlayback.pause()
                playingVoiceMessageId = null
                if (state.isAudioPlaying) {
                    vm.onAction(ChatAction.SetAudioPlaying(false))
                }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Release players + ClearMessages on dispose.
    DisposableEffect(Unit) {
        onDispose {
            voicePlayback.release()
            ttsPlayback.release()
            vm.onAction(ChatAction.ClearMessages)
            graph.analytics.trackScreenExit(AnalyticsScreens.CHAT)
        }
    }

    // ------------------------------------------------------------------ voice durations preload
    LaunchedEffect(state.messages) {
        state.messages.filterIsInstance<ChatMessage.UserMessage>()
            .mapNotNull { it.audioUri?.toString() }
            .filter { it !in voiceDurations }
            .forEach { source ->
                val duration = AudioPlayback.getAudioDurationMs(context, source)
                voiceDurations[source] = duration
            }
    }

    // Voice playback position polling.
    LaunchedEffect(playingVoiceMessageId) {
        while (playingVoiceMessageId != null) {
            voicePositionMs = voicePlayback.currentPositionMs.toLong()
            delay(100L)
        }
        voicePositionMs = 0L
    }

    // TTS: play/pause on state changes.
    LaunchedEffect(state.audioPlaybackUrl, state.isAudioPlaying) {
        val url = state.audioPlaybackUrl
        if (url == null) {
            ttsPlayback.stop()
            return@LaunchedEffect
        }
        if (state.isAudioPlaying) {
            if (ttsPlayback.currentSourceKey == url) {
                ttsPlayback.resume()
            } else {
                ttsPlayback.play(
                    context = context,
                    source = url,
                    onCompletion = { vm.onAction(ChatAction.ClearAudioPlaybackUrl) },
                    onError = { vm.onAction(ChatAction.ClearAudioPlaybackUrl) }
                )
            }
        } else {
            ttsPlayback.pause()
        }
    }

    // ------------------------------------------------------------------ history pagination + scroll behavior
    LaunchedEffect(state.isInitialHistoryLoaded) {
        if (state.isInitialHistoryLoaded && !initialScrollDone && state.messages.isNotEmpty()) {
            initialScrollDone = true
            listState.scrollToItem((state.messages.size - 1).coerceAtLeast(0))
        }
    }

    LaunchedEffect(listState, isHistoryEntry) {
        if (!isHistoryEntry) return@LaunchedEffect
        snapshotFlow { listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset == 0 }
            .distinctUntilChanged()
            .collect { atTop ->
                val nextPage = state.historyNextPage
                val cid = args.conversationId
                if (atTop && initialScrollDone && nextPage != null && cid != null && !state.isLoading &&
                    prependOldCount == null
                ) {
                    prependOldCount = state.messages.size
                    vm.onAction(ChatAction.LoadChatHistory(cid, nextPage))
                }
            }
    }

    // Restore scroll position after older page prepends.
    LaunchedEffect(state.messages.size) {
        val old = prependOldCount
        if (old != null && state.messages.size > old) {
            listState.scrollToItem(state.messages.size - old)
            prependOldCount = null
        } else if (old != null && !state.isLoading) {
            prependOldCount = null
        }
    }

    // Auto-scroll to bottom on new messages (non-history appends).
    LaunchedEffect(state.messages.size, state.isLoading) {
        if (prependOldCount == null && state.messages.isNotEmpty() &&
            (!isHistoryEntry || initialScrollDone)
        ) {
            listState.animateScrollToItem((state.messages.size - 1).coerceAtLeast(0))
        }
    }

    // ------------------------------------------------------------------ share / download card capture
    val shareGraphicsLayer = rememberGraphicsLayer()
    val lastAiMessage = state.messages.lastOrNull { it is ChatMessage.AiResponse } as? ChatMessage.AiResponse
    val firstUserQuestion = (state.messages.firstOrNull { it is ChatMessage.UserMessage }
        as? ChatMessage.UserMessage)?.text.orEmpty()
    val lastUserQuestion = run {
        val lastAiIndex = state.messages.indexOfLast { it is ChatMessage.AiResponse }
        state.messages.take(if (lastAiIndex >= 0) lastAiIndex else state.messages.size)
            .lastOrNull { it is ChatMessage.UserMessage }
            .let { (it as? ChatMessage.UserMessage)?.text.orEmpty() }
    }

    fun captureShareCard(onBitmap: (Bitmap) -> Unit) {
        scope.launch {
            runCatching {
                val imageBitmap = shareGraphicsLayer.toImageBitmap()
                onBitmap(imageBitmap.asAndroidBitmap())
            }.onFailure {
                toast.show(label(Labels.FAILED_TO_SAVE, "Failed to save"), ToastState.Error)
            }
        }
    }

    fun shareImage() {
        graph.analytics.track(
            AnalyticsEvents.SHARE_BUTTON_CLICKED,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.CHAT)
        )
        captureShareCard { bitmap ->
            runCatching {
                val file = File(context.cacheDir, "fc_sdk_share_${System.currentTimeMillis()}.png")
                file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                val uri = FileProvider.getUriForFile(
                    context, "${context.packageName}.fc_sdk_fileprovider", file
                )
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "image/png"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(
                        Intent.EXTRA_TEXT,
                        label(Labels.SHARE_APP_MESSAGE, "Answered by FarmerChat")
                    )
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                context.startActivity(Intent.createChooser(intent, null))
            }.onFailure {
                toast.show(label(Labels.FAILED_TO_SAVE, "Failed to save"), ToastState.Error)
            }
        }
    }

    fun downloadImage() {
        graph.analytics.track(
            AnalyticsEvents.SAVE_BUTTON_CLICKED,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.CHAT)
        )
        captureShareCard { bitmap ->
            runCatching {
                val values = ContentValues().apply {
                    put(
                        MediaStore.Images.Media.DISPLAY_NAME,
                        "farmerchat_${System.currentTimeMillis()}.png"
                    )
                    put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/FarmerChat")
                    }
                }
                val uri = context.contentResolver.insert(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values
                )
                if (uri != null) {
                    context.contentResolver.openOutputStream(uri)?.use {
                        bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
                    }
                    toast.show(label(Labels.SAVED_TO_GALLERY, "Saved to gallery"), ToastState.Success)
                } else {
                    toast.show(label(Labels.FAILED_TO_SAVE, "Failed to save"), ToastState.Error)
                }
            }.onFailure {
                toast.show(label(Labels.FAILED_TO_SAVE, "Failed to save"), ToastState.Error)
            }
        }
    }

    // ------------------------------------------------------------------ camera / gallery / mic
    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        val uri = cameraTempUri
        if (success && uri != null) {
            closePhotoInput?.invoke()
            if (isComposerUi) {
                // App parity: in composer mode a picked photo is ATTACHED so it can be sent
                // together with typed text (fc-compose-agentic ChatScreen.kt:499/550). Only one
                // image is allowed, so a new pick replaces the old. Without this the composer's
                // thumbnail strip and onRemovePhoto are unreachable and image+text is impossible.
                photoUris = listOf(uri)
            } else {
                vm.onAction(ChatAction.SendQuestionWithImage(question = "", imageUri = uri))
            }
        }
    }

    val galleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            closePhotoInput?.invoke()
            if (isComposerUi) {
                // App parity: in composer mode a picked photo is ATTACHED so it can be sent
                // together with typed text (fc-compose-agentic ChatScreen.kt:499/550). Only one
                // image is allowed, so a new pick replaces the old. Without this the composer's
                // thumbnail strip and onRemovePhoto are unreachable and image+text is impossible.
                photoUris = listOf(uri)
            } else {
                vm.onAction(ChatAction.SendQuestionWithImage(question = "", imageUri = uri))
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
            graph.prefs.putInt(SdkPreferences.Keys.CAMERA_PERMISSION_DENY_COUNT, 0)
            launchCamera()
        } else {
            val denyCount = graph.prefs.getInt(SdkPreferences.Keys.CAMERA_PERMISSION_DENY_COUNT, 0) + 1
            graph.prefs.putInt(SdkPreferences.Keys.CAMERA_PERMISSION_DENY_COUNT, denyCount)
            if (denyCount >= 2) permissionDialogType = "camera"
        }
    }

    val micPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            graph.prefs.putInt(SdkPreferences.Keys.MICROPHONE_PERMISSION_DENY_COUNT, 0)
            openVoiceInput?.invoke()
        } else {
            val denyCount =
                graph.prefs.getInt(SdkPreferences.Keys.MICROPHONE_PERMISSION_DENY_COUNT, 0) + 1
            graph.prefs.putInt(SdkPreferences.Keys.MICROPHONE_PERMISSION_DENY_COUNT, denyCount)
            if (denyCount >= 2) permissionDialogType = "microphone"
        }
    }

    fun requestCamera() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            launchCamera()
        } else {
            val denyCount = graph.prefs.getInt(SdkPreferences.Keys.CAMERA_PERMISSION_DENY_COUNT, 0)
            if (denyCount >= 2) permissionDialogType = "camera"
            else cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    // ---------------------------------------------------------------- capability chips (2.0.0)
    // GPS_PROMPT and UPLOAD_PHOTO chips do NOT send their text as a question — they invoke a
    // device capability and only the OUTCOME is sent. Every other chip stays on the plain
    // follow-up path.
    var pendingLocationSourceId by remember { mutableStateOf<String?>(null) }

    // The address shown in the location bubble, assembled exactly as the app does.
    val composeResolvedAddress: () -> String = {
        val best = graph.prefs.getString(SdkPreferences.Keys.APPROX_LOCATION_NAME, "")
        val stateName = graph.prefs.getString(SdkPreferences.Keys.USER_SELECTED_STATE_CODE, "")
        val country = graph.prefs.getString(SdkPreferences.Keys.USER_COUNTRY_NAME, "")
        listOf(best, stateName, country).filter { it.isNotBlank() }.distinct().joinToString(", ")
    }

    // Observe location outcomes for the chat share-location flow. Subscribed for the life of the
    // screen but inert until armed (pendingLocationSourceId != null), so an outcome belonging to
    // Home or Settings is ignored.
    LaunchedEffect(Unit) {
        graph.locationPromptManager.events.collect { event ->
            val srcId = pendingLocationSourceId ?: return@collect
            val source = when (event) {
                is LocationPromptEvent.Continue -> event.source
                is LocationPromptEvent.Cancel -> event.source
                else -> return@collect
            }
            if (source != LocationTriggerSource.LocalContext) return@collect
            // A terminal event for our request — disarm before dispatching.
            pendingLocationSourceId = null
            if (event.isLocationObtained()) {
                vm.onAction(
                    ChatAction.SendLocationSharedQuery(
                        sourceMessageId = srcId,
                        address = composeResolvedAddress()
                    )
                )
            } else {
                // Denied / cancelled / fetch failed: still answer the blocking question. Sent as a
                // chip pick exactly as the app does, so it carries `location_declined = true` and
                // the surface's `parent_message_id` — the backend can then answer from an
                // approximate location instead of waiting for coordinates.
                val declineText = label(
                    Labels.LOCATION_PERMISSION_DECLINED,
                    "Continue without sharing my location"
                )
                vm.onAction(
                    ChatAction.SendAlignmentChip(
                        query = declineText,
                        selectionValue = declineText,
                        sourceMessageId = srcId,
                        locationDeclined = true,
                        chipType = AlignmentKind.GPS_PROMPT.analyticsType,
                        chipValue = AlignmentChip.VALUE_NOT_NOW,
                        chipLabel = declineText
                    )
                )
            }
        }
    }

    /**
     * Routes an alignment chip tap. The decision table itself lives in core
     * (`routeAlignmentChip`) so this screen, the Views fragment and the unit tests exercise ONE
     * function — an inline copy passes the test while drifting from it (docs/04).
     */
    val handleAlignmentChip: (String, AlignmentKind?, AlignmentChip) -> Unit =
        { messageId, kind, chip ->
            when (val route = routeAlignmentChip(kind, chip)) {
                AlignmentChipRoute.ShareLocation ->
                    // Permission dialog / GPS fetch / recovery are owned by LocationPromptHost;
                    // the outcome arrives on the collector above. Only start when no other
                    // location flow is running (mirrors Home's guard).
                    if (graph.locationPromptManager.state.value is LocationPromptState.Idle) {
                        pendingLocationSourceId = messageId
                        // fromAgenticChip = true → the whole GPS funnel is attributed to Chat and
                        // carries agentic_chip_type = gps-prompt (app parity).
                        graph.locationPromptManager.triggerFromLocalContext(fromAgenticChip = true)
                    }
                AlignmentChipRoute.TakePhoto -> requestCamera()
                AlignmentChipRoute.ChooseFromGallery ->
                    runCatching { galleryLauncher.launch("image/*") }
                AlignmentChipRoute.Ignore -> Unit
                is AlignmentChipRoute.SendText -> vm.onAction(
                    ChatAction.SendAlignmentChip(
                        query = route.query,
                        selectionValue = route.selectionValue,
                        sourceMessageId = messageId,
                        displayLabel = route.displayLabel,
                        locationDeclined = route.locationDeclined,
                        photoDeclined = route.photoDeclined,
                        chipType = kind?.analyticsType,
                        chipValue = chip.value,
                        chipLabel = chip.label
                    )
                )
            }
        }

    /** `Chat_Icon_Clicked` with `Icon` = Text / Voice / Image (app ChatScreen.kt:837/868/884). */
    fun trackChatIconClick(iconType: String) {
        graph.analytics.track(
            AnalyticsEvents.CHAT_ICON_CLICKED,
            mapOf(
                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.CHAT,
                AnalyticsProps.ICON_TYPE to iconType
            )
        )
    }

    /** `Content_Try_Again_Clicked` on the Chat screen (app InlineErrorContent.kt:97). */
    fun trackChatRetry() {
        graph.analytics.track(
            AnalyticsEvents.CONTENT_TRY_AGAIN_CLICKED,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.CHAT)
        )
    }

    fun requestMicThenOpenVoice() {
        graph.analytics.track(
            AnalyticsEvents.MICROPHONE_CLICK_EVENT,
            // App ChatScreen.kt:857.
            mapOf(
                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.CHAT,
                AnalyticsProps.ICON_TYPE to "Voice"
            )
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
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            openVoiceInput?.invoke()
        } else {
            val denyCount =
                graph.prefs.getInt(SdkPreferences.Keys.MICROPHONE_PERMISSION_DENY_COUNT, 0)
            if (denyCount >= 2) permissionDialogType = "microphone"
            else micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    // ------------------------------------------------------------------ voice bubble play/pause
    fun toggleVoicePlayback(message: ChatMessage.UserMessage) {
        val source = message.audioUri?.toString() ?: return
        if (playingVoiceMessageId == message.id) {
            voicePlayback.pause()
            playingVoiceMessageId = null
        } else {
            voicePlayback.play(
                context = context,
                source = source,
                onCompletion = { playingVoiceMessageId = null },
                onError = { playingVoiceMessageId = null }
            )
            playingVoiceMessageId = message.id
        }
    }

    // ------------------------------------------------------------------ follow-up click
    fun onFollowUpClicked(question: String, index: Int) {
        val lastAi = state.messages.lastOrNull { it is ChatMessage.AiResponse } as? ChatMessage.AiResponse
        if (lastAi?.isPreGenerated == true) {
            vm.onAction(ChatAction.ReplacePreGeneratedWithQuestion(question))
        } else {
            vm.onAction(
                ChatAction.SendFollowUpQuestion(
                    question = question,
                    followUpQuestionId = state.suggestedQuestionIds?.getOrNull(index)
                )
            )
        }
    }

    // ------------------------------------------------------------------ UI
    val isThread = state.messages.isNotEmpty()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.surfaceReadingPrimary)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            LogoAppBar(
                showLogo = isThread && !state.isLoading,
                leftIcon = if (isHistoryEntry) Icons.Filled.Menu else Icons.Filled.Close,
                onLeftClick = {
                    if (isHistoryEntry) {
                        graph.analytics.track(AnalyticsEvents.HAMBURGER_MENU_CLICKED)
                        openDrawer()
                    } else {
                        graph.analytics.track(AnalyticsEvents.CHAT_SCREEN_BACK_BUTTON_CLICK)
                        onClose()
                    }
                }
            )

            when {
                !isThread && state.isLoading -> {
                    // Initial loading — first question bubble + spinner.
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        if (!args.question.isNullOrBlank()) {
                            Box(
                                modifier = Modifier.fillMaxWidth(),
                                contentAlignment = Alignment.CenterEnd
                            ) {
                                UserChatBubble(
                                    text = args.question,
                                    imageUri = args.imageUri?.let(Uri::parse)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(24.dp))
                        ThinkingIndicator(
                            label = label(Labels.GETTING_YOUR_ANSWER, "Getting your answer…")
                        )
                    }
                }

                !isThread && state.errorMessage != null -> {
                    // Full error content with retry + question bubble.
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        if (!args.question.isNullOrBlank()) {
                            Box(
                                modifier = Modifier.fillMaxWidth(),
                                contentAlignment = Alignment.CenterEnd
                            ) {
                                UserChatBubble(
                                    text = args.question,
                                    imageUri = args.imageUri?.let(Uri::parse)
                                )
                            }
                        }
                        InlineErrorContent(
                            message = state.errorMessage.orEmpty(),
                            onRetry = {
                                trackChatRetry()
                                vm.onAction(ChatAction.RetryLastRequest)
                            }
                        )
                    }
                }

                else -> {
                    // Thread
                    Box(modifier = Modifier.weight(1f)) {
                        LazyColumn(
                            state = listState,
                            modifier = Modifier.fillMaxSize(),
                            // App parity (ChatThreadContent.kt:100): the composer UI reserves
                            // composerBarHeight(floating) at the bottom so the last bubble is not
                            // hidden behind the floating pill; the legacy input keeps 24.dp.
                            contentPadding = PaddingValues(
                                start = 16.dp, end = 16.dp, top = 16.dp,
                                bottom = if (isComposerUi) composerBarHeight(floating = true) else 24.dp
                            ),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            // Pagination header spinner
                            if (isHistoryEntry && state.historyNextPage != null) {
                                item(key = "history_loading_top") {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.Center
                                    ) {
                                        LogoSpinner(
                                            type = LogoSpinnerType.Horizontal,
                                            label = label(Labels.LOADING_MORE, "Loading more...")
                                        )
                                    }
                                }
                            }

                            state.messages.forEachIndexed { index, message ->
                                when (message) {
                                    // 2.0.0: the farmer's resolved location, standing in for the
                                    // text bubble they would otherwise have sent. Right-aligned
                                    // because it is their reply to a GPS_PROMPT chip.
                                    is ChatMessage.LocationMessage -> {
                                        item(key = "loc_${message.id}") {
                                            Box(
                                                modifier = Modifier.fillMaxWidth(),
                                                contentAlignment = Alignment.CenterEnd
                                            ) {
                                                LocationChatBubble(
                                                    address = message.address,
                                                    label = label(Labels.YOUR_LOCATION, "Your location:")
                                                )
                                            }
                                        }
                                    }

                                    is ChatMessage.UserMessage -> {
                                        item(key = "msg_${message.id}") {
                                            Box(
                                                modifier = Modifier.fillMaxWidth(),
                                                contentAlignment = Alignment.CenterEnd
                                            ) {
                                                val hasAudio = message.audioUri != null
                                                UserChatBubble(
                                                    text = message.text,
                                                    imageUri = message.imageUri,
                                                    userBubbleImageWideBanner = message.userBubbleImageWideBanner,
                                                    audioUri = message.audioUri,
                                                    showVoiceClip = hasAudio,
                                                    voiceClipState = when {
                                                        message.isFailed -> VoiceClipState.Error
                                                        playingVoiceMessageId == message.id -> VoiceClipState.Playing
                                                        else -> VoiceClipState.Playback
                                                    },
                                                    voiceDurationMs = message.audioUri
                                                        ?.toString()
                                                        ?.let { voiceDurations[it] } ?: 0L,
                                                    voicePositionMs = if (playingVoiceMessageId == message.id)
                                                        voicePositionMs else 0L,
                                                    onVoicePlayClick = { toggleVoicePlayback(message) },
                                                    onVoicePauseClick = { toggleVoicePlayback(message) }
                                                )
                                            }
                                        }
                                    }

                                    is ChatMessage.AiResponse -> {
                                        item(key = "msg_${message.id}") {
                                            val isLastAi = message.id == lastAiMessage?.id
                                            // Only fresh answers animate: not history, not pre-generated,
                                            // only the newest AI message, and only until it has revealed once.
                                            val shouldAnimate = isLastAi &&
                                                !isHistoryEntry &&
                                                !message.isPreGenerated &&
                                                message.id !in revealedIds
                                            val answerRevealed = message.id in revealedIds

                                            // 2.0.0 agentic streaming: while a stream is live the
                                            // answer grows in place, so reserve a screen's height to
                                            // pin the question at the top instead of letting the list
                                            // clamp it downward as text arrives. Also held for the
                                            // interrupted state so the error card sits near the top.
                                            val streamReserve = if (
                                                isLastAi && (message.isStreaming || message.isInterrupted)
                                            ) {
                                                Modifier.heightIn(
                                                    min = LocalConfiguration.current.screenHeightDp.dp
                                                )
                                            } else Modifier

                                            val alignmentKind = message.alignmentKind
                                            // An EXCLUSIVE surface owns the message area: it
                                            // replaces the answer, its action row and its
                                            // related-questions section. An ADDITIVE one falls
                                            // through to the normal answer branch and renders
                                            // below it as a nudge.
                                            if (alignmentKind != null && !alignmentKind.isAdditive) {
                                                AlignmentSurface(
                                                    kind = alignmentKind,
                                                    message = message.text,
                                                    chips = message.alignmentChips.orEmpty(),
                                                    selectedValues = message.alignmentSelectedValues,
                                                    isLoading = state.isLoading,
                                                    isLatest = isLastAi,
                                                    blocking = message.alignmentBlocking,
                                                    onChipClick = { chip ->
                                                        handleAlignmentChip(message.id, alignmentKind, chip)
                                                    },
                                                    onTypeInstead = { focusTextInput?.invoke() }
                                                )
                                                return@item
                                            }

                                            Column(
                                                modifier = streamReserve,
                                                verticalArrangement = Arrangement.spacedBy(12.dp)
                                            ) {
                                                AiAnswerBlock(
                                                    // A streaming answer must never run the typewriter
                                                    // reveal — the text is already arriving a token at
                                                    // a time, and animating it again double-types it.
                                                    text = message.text,
                                                    animate = shouldAnimate && !message.isStreaming,
                                                    onRevealComplete = { markRevealed(message.id) }
                                                )

                                                // Tool progress, or the initial "getting your answer"
                                                // state before any text has arrived.
                                                if (message.isStreaming &&
                                                    (message.text.isEmpty() ||
                                                        !message.streamingStatus.isNullOrBlank())
                                                ) {
                                                    LogoSpinner(
                                                        type = LogoSpinnerType.Horizontal,
                                                        label = message.streamingStatus
                                                            ?: label(
                                                                Labels.GETTING_YOUR_ANSWER,
                                                                "Getting your answer…"
                                                            )
                                                    )
                                                }

                                                // Text is flowing but has stalled with no tool status:
                                                // a transient client-side hint, NOT a failure. Keyed on
                                                // text.length so the next delta clears it automatically.
                                                if (message.isStreaming &&
                                                    message.text.isNotEmpty() &&
                                                    message.streamingStatus.isNullOrBlank()
                                                ) {
                                                    var stalled by remember(message.id) {
                                                        mutableStateOf(false)
                                                    }
                                                    LaunchedEffect(message.id, message.text.length) {
                                                        stalled = false
                                                        delay(PAUSE_HINT_DELAY_MS)
                                                        stalled = true
                                                    }
                                                    if (stalled) {
                                                        LogoSpinner(
                                                            type = LogoSpinnerType.Horizontal,
                                                            label = label(
                                                                Labels.RESPONSE_PAUSED_RESUMING,
                                                                "Paused, resuming…"
                                                            )
                                                        )
                                                    }
                                                }

                                                // ADDITIVE surface: a nudge below the real answer
                                                // (gender-select / commodity-confirm). Single-tap;
                                                // the answer above keeps its own action row.
                                                if (alignmentKind?.isAdditive == true) {
                                                    AlignmentSurface(
                                                        kind = alignmentKind,
                                                        message = message.alignmentMessage.orEmpty(),
                                                        chips = message.alignmentChips.orEmpty(),
                                                        selectedValues = message.alignmentSelectedValues,
                                                        isLoading = state.isLoading,
                                                        isLatest = isLastAi,
                                                        onChipClick = { chip ->
                                                            handleAlignmentChip(message.id, alignmentKind, chip)
                                                        }
                                                    )
                                                }

                                                // Interrupted terminal state: keep any partial answer
                                                // above and offer retry. Only the latest answer shows
                                                // the card — an older failed question keeps its partial
                                                // text but drops the retry action.
                                                if (message.isInterrupted && isLastAi) {
                                                    StreamErrorCard(
                                                        errorKind = message.streamErrorKind
                                                            ?: StreamErrorKind.UNKNOWN,
                                                        hasPartial = message.text.isNotBlank(),
                                                        onRetry = {
                                                            trackChatRetry()
                                                            vm.onAction(ChatAction.RetryLastRequest)
                                                        }
                                                    )
                                                }

                                                if (isLastAi && !state.isLoading &&
                                                    !message.isInterrupted && answerRevealed
                                                ) {
                                                    // Fade/slide the actions in once the reveal completes.
                                                    val actionsVisible = remember {
                                                        MutableTransitionState(false)
                                                    }
                                                    actionsVisible.targetState = true
                                                    AnimatedVisibility(
                                                        visibleState = actionsVisible,
                                                        enter = fadeIn(tween(350)) +
                                                            slideInVertically(tween(350)) { it / 4 }
                                                    ) {
                                                        Column(
                                                            verticalArrangement = Arrangement.spacedBy(12.dp)
                                                        ) {
                                                            // Read full advice (pre-generated only)
                                                            if (message.isPreGenerated &&
                                                                state.readFullAdviceRequestedForMessageId == null
                                                            ) {
                                                                PrimaryButton(
                                                                    label = label(
                                                                        Labels.READ_FULL_ADVICE,
                                                                        "Read full advice"
                                                                    ),
                                                                    onClick = {
                                                                        vm.onAction(
                                                                            ChatAction.ReplacePreGeneratedWithQuestion(
                                                                                question = firstUserQuestion,
                                                                                triggerInputType = "read_full_advice"
                                                                            )
                                                                        )
                                                                    },
                                                                    modifier = Modifier.fillMaxWidth()
                                                                )
                                                            }

                                                            ChatResponseActions(
                                                                isTtsEnabled = state.isTtsEnabled,
                                                                isLoadingAudio = state.isLoadingSynthesiseAudio,
                                                                isAudioPlaying = state.isAudioPlaying &&
                                                                    state.audioPlaybackUrl != null,
                                                                onShare = { shareImage() },
                                                                onDownload = { downloadImage() },
                                                                onListen = {
                                                                    if (state.audioPlaybackUrl != null) {
                                                                        vm.onAction(
                                                                            ChatAction.SetAudioPlaying(!state.isAudioPlaying)
                                                                        )
                                                                    } else {
                                                                        vm.onAction(ChatAction.SynthesiseAudio)
                                                                    }
                                                                },
                                                                // App parity
                                                                // (ChatThreadContent.kt:515).
                                                                useChips = message.isAgentic &&
                                                                    !message.isPreGenerated
                                                            )
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    is ChatMessage.LoadingPlaceholder -> {
                                        item(key = "msg_${message.id}") {
                                            ThinkingIndicator(
                                                label = label(
                                                    Labels.GETTING_YOUR_ANSWER,
                                                    "Getting your answer…"
                                                )
                                            )
                                        }
                                    }
                                }
                            }

                            // Inline error + retry
                            if (state.errorMessage != null) {
                                item(key = "inline_error") {
                                    InlineErrorContent(
                                        message = state.errorMessage.orEmpty(),
                                        onRetry = {
                                            trackChatRetry()
                                            vm.onAction(ChatAction.RetryLastRequest)
                                        }
                                    )
                                }
                            }

                            // Follow-up questions — appear only after the last answer's reveal.
                            val followUps = state.suggestedQuestions.orEmpty()
                            val lastAnswerRevealed =
                                lastAiMessage != null && lastAiMessage.id in revealedIds
                            // An ADDITIVE alignment surface owns the space under the answer: while
                            // its chips are on screen the follow-up list and the "ask a follow-up"
                            // prompt are hidden, so the farmer answers the nudge instead of being
                            // offered two competing lists. App parity — `fc-compose-agentic`
                            // 43ba5de4 "no follow up in case of chips"
                            // (`ChatThreadContent.kt`, `showFollowUps = ...`). The backend agrees:
                            // the live prose capture's metadata carries
                            // `"followups_gated_by": "commodity-confirm"` with `followups: []`.
                            val additiveSurfaceOpen = lastAiMessage?.alignmentKind?.isAdditive == true &&
                                !lastAiMessage.alignmentChips.isNullOrEmpty()
                            if (followUps.isNotEmpty() && !state.isLoading &&
                                state.errorMessage == null && lastAnswerRevealed &&
                                !additiveSurfaceOpen
                            ) {
                                item(key = "followups") {
                                    Column {
                                        val followUpsVisible =
                                            remember { MutableTransitionState(false) }
                                        followUpsVisible.targetState = true
                                        AnimatedVisibility(
                                            visibleState = followUpsVisible,
                                            enter = fadeIn(tween(350)) +
                                                slideInVertically(tween(350)) { it / 4 }
                                        ) {
                                            FollowUpSection(
                                                title = if (state.clarificationRequired)
                                                    label(
                                                        Labels.CHOOSE_A_FOLLOWUP_OPTION_BELOW,
                                                        "Choose an option from the below"
                                                    )
                                                else
                                                    label(
                                                        Labels.RELATED_QUESTIONS,
                                                        "Related questions"
                                                    ),
                                                questions = followUps,
                                                onQuestionClick = { qIndex, question ->
                                                    onFollowUpClicked(question, qIndex)
                                                },
                                                useChips = lastAiMessage?.isAgentic == true &&
                                                    lastAiMessage.isPreGenerated != true,
                                                clarificationRequired = state.clarificationRequired
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // Scroll-to-bottom indicator when an answer arrives.
                        if (lastAiMessage != null && !state.isLoading) {
                            ScrollIndicator(
                                triggerKey = lastAiMessage.id,
                                onClick = {
                                    scope.launch {
                                        listState.animateScrollToItem(
                                            (state.messages.size - 1).coerceAtLeast(0)
                                        )
                                    }
                                },
                                modifier = Modifier
                                    .align(Alignment.BottomCenter)
                                    .padding(bottom = 12.dp)
                            )
                        }
                    }
                }
            }

            // Bottom Photo/Speak/Type row (follow-up input entry points).
            //
            // App parity (fc-compose ChatThreadContent.kt:151) — the app does NOT add/remove
            // this row, it SLIDES it 150.dp down over 450ms whenever an answer is generating
            // (`showInputButtons = !isLoading`) and slides it back when the answer lands.
            // Hard-removing it made the chat input pop in and out, which is the difference from
            // the original app. The composer rule below is an SDK addition (the text composer
            // carries its own camera/mic, so the row is redundant while it is open) and is
            // applied through the same slide rather than a removal.
            //
            // App parity (ChatThreadContent.kt:243 / ChatErrorContent.kt:101): the composer UI
            // drops this row entirely — the InputComposer below already carries camera and mic.
            if (!isComposerUi) {
                val inputRowHidden = state.isLoading || textComposerActive
                val inputRowOffset by animateDpAsState(
                    targetValue = if (inputRowHidden) 150.dp else 0.dp,
                    animationSpec = tween(durationMillis = 450),
                    label = "buttonSlide"
                )
                PrimaryInputButtons(
                    type = PrimaryInputButtonsType.ChatScreen,
                    onPhotoClick = { trackChatIconClick("Image"); openPhotoInput?.invoke() },
                    onSpeakClick = { trackChatIconClick("Voice"); requestMicThenOpenVoice() },
                    onTypeClick = { trackChatIconClick("Text"); focusTextInput?.invoke() },
                    modifier = Modifier.offset(y = inputRowOffset)
                )
            }
        }

        // Invisible ShareCard rendered off-screen and captured for share/download.
        Box(
            modifier = Modifier
                .width(360.dp)
                .offset(x = 3000.dp)
                .drawWithContent {
                    shareGraphicsLayer.record { this@drawWithContent.drawContent() }
                    drawLayer(shareGraphicsLayer)
                }
        ) {
            ShareCard(
                question = lastUserQuestion.ifBlank { firstUserQuestion },
                answer = lastAiMessage?.text.orEmpty()
            )
        }

        // ------------------------------------------------------------------ overlays
        // Send is identical on both input surfaces, so it is defined once.
        val sendFromComposer: (String, Uri?) -> Unit = { text, imageUri ->
            clearTextInput?.invoke()
            photoUris = emptyList()
            if (imageUri != null) {
                vm.onAction(ChatAction.SendQuestionWithImage(question = text, imageUri = imageUri))
            } else if (text.isNotBlank()) {
                vm.onAction(ChatAction.SendFollowUpQuestion(question = text))
            }
        }
        if (isComposerUi) {
            // App parity (ChatInputOverlays.kt:57): anchored/compact composer. Floating mode
            // consumes nav + IME insets internally, so this takes a plain Modifier — adding
            // imePadding()/navigationBarsPadding() here would double the bottom inset and float
            // the pill too high. No idle aura in chat (Home-only cue); brand-green sheet.
            InputComposer(
                floating = true,
                isAnchored = true,
                compact = true,
                // Slides off-screen while an answer is generating, then back — the same
                // visibility rhythm PrimaryInputButtons has in the legacy layout.
                visible = !(isThread && state.isLoading),
                showAura = false,
                surfaceColor = brand.surfacePrimary,
                fadeColor = colors.surfaceReadingPrimary,
                photoUris = photoUris,
                onRemovePhoto = { index ->
                    photoUris = photoUris.toMutableList().also { it.removeAt(index) }
                },
                onFocusRequest = { requester -> focusTextInput = requester },
                onClearRequest = { clear -> clearTextInput = clear },
                onFocusChange = { focused -> textComposerActive = focused },
                onPhotoClick = { trackChatIconClick("Image"); openPhotoInput?.invoke() },
                onVoiceClick = { trackChatIconClick("Voice"); requestMicThenOpenVoice() },
                // InputComposer's onSend is (String) -> Unit; the single attached image, if
                // any, comes from photoUris — matching the Home composer.
                onSend = { query -> sendFromComposer(query, photoUris.firstOrNull()) }
            )
        } else {
            TextInputOverlay(
                // App parity (ChatInputOverlays.kt:49 / HomeScreen.kt:1276): the composer is
                // bottom-aligned inside a fillMaxSize Box, so under edge-to-edge + adjustResize it
                // sits at the RAW screen bottom — behind the IME. Without imePadding() the user
                // cannot see what they are typing. navigationBarsPadding() keeps it clear of the
                // gesture bar when the keyboard is closed.
                modifier = Modifier.imePadding().navigationBarsPadding(),
                onSend = sendFromComposer,
                onPhotoClick = { trackChatIconClick("Image"); openPhotoInput?.invoke() },
                onVoiceClick = { trackChatIconClick("Voice"); requestMicThenOpenVoice() },
                onFocusRequest = { requester -> focusTextInput = requester },
                onClearRequest = { clear -> clearTextInput = clear },
                onFocusChange = { focused -> textComposerActive = focused },
                photoUris = photoUris,
                onRemovePhoto = { index ->
                    photoUris = photoUris.toMutableList().also { it.removeAt(index) }
                }
            )
        }

        VoiceInput(
            onAudioRecorded = { file ->
                vm.onAction(
                    ChatAction.SendFollowUpVoiceQuestion(audioUri = Uri.fromFile(file).toString())
                )
            },
            onOpenRequest = { open -> openVoiceInput = open },
            onRecordingFailed = { message -> toast.show(message, ToastState.Error) }
        )

        PhotoInput(
            onCameraClick = { requestCamera() },
            onGalleryClick = { runCatching { galleryLauncher.launch("image/*") } },
            onOpenRequest = { open -> openPhotoInput = open },
            onCloseRequest = { close -> closePhotoInput = close }
        )

        permissionDialogType?.let { type ->
            PermissionSettingsDialog(
                permissionType = type,
                screenName = AnalyticsScreens.CHAT,
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

/** Inline error row + Try again button (RetryLastRequest with retry flag). */
@Composable
private fun InlineErrorContent(
    message: String,
    onRetry: () -> Unit
) {
    val colors = LocalContentColors.current
    val brand = LocalBrandColors.current

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = brand.feedbackFail
        )
        SecondaryButton(
            label = label(Labels.TRY_AGAIN, "Try again"),
            onClick = onRetry,
            backgroundColor = colors.surfaceReadingSecondary
        )
    }
}

/**
 * Titled "Related questions" section with tappable suggestion cards.
 * The accent dot + card affordances recolor with the host brand theme.
 */
@Composable
private fun FollowUpSection(
    title: String,
    questions: List<String>,
    onQuestionClick: (index: Int, question: String) -> Unit,
    /** Agentic answers render follow-ups as numbered chips instead of suggestion cards. */
    useChips: Boolean = false,
    /** Clarify moments get the green Agentic chip accent; related questions the neutral one. */
    clarificationRequired: Boolean = false
) {
    val colors = LocalContentColors.current
    val brand = LocalBrandColors.current

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(brand.foregroundSecondary)
            )
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                color = colors.foregroundSecondary
            )
        }
        questions.forEachIndexed { qIndex, question ->
            // App parity (ChatResponseActions.kt:212).
            if (useChips) {
                Chip(
                    label = question,
                    onClick = { onQuestionClick(qIndex, question) },
                    type = if (clarificationRequired) ChipType.Agentic else ChipType.Suggested,
                    number = qIndex + 1
                )
            } else {
                SuggestedCard(
                    text = question,
                    onClick = { onQuestionClick(qIndex, question) }
                )
            }
        }
    }
}

/** Share / Download / Listen actions under the last AI answer. */
@Composable
private fun ChatResponseActions(
    isTtsEnabled: Boolean,
    isLoadingAudio: Boolean,
    isAudioPlaying: Boolean,
    onShare: () -> Unit,
    onDownload: () -> Unit,
    onListen: () -> Unit,
    /** Agentic answers get the compact Share + Listen row under an "AI may be wrong" note. */
    useChips: Boolean = false
) {
    val colors = LocalContentColors.current
    // App parity (ChatResponseActions.kt:85): the agentic answer drops Save and the divider,
    // keeps Share then Listen, and puts the accuracy note above the row.
    if (useChips) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Image(
                    painter = painterResource(id = R.drawable.fc_icon_info),
                    contentDescription = null,
                    colorFilter = ColorFilter.tint(colors.buttonPrimaryAccent),
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    text = label(
                        Labels.AI_MAY_BE_WRONG_PLEASE_DOUBLE_CHECK,
                        "AI may be wrong. Please double-check."
                    ),
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.foregroundSecondary
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ChatActionChip(
                    iconRes = R.drawable.fc_icon_share,
                    text = label(Labels.SHARE_DOWNLOAD, "Share"),
                    onClick = onShare
                )
                if (isTtsEnabled) {
                    ChatActionChip(
                        iconRes = null,
                        imageVector = if (isAudioPlaying) Icons.Filled.Pause else Icons.Filled.VolumeUp,
                        text = label(Labels.LISTEN, "Listen"),
                        isLoading = isLoadingAudio,
                        onClick = onListen
                    )
                }
            }
        }
        return
    }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        ChatActionChip(
            iconRes = R.drawable.fc_icon_share,
            text = label(Labels.SHARE_DOWNLOAD, "Share"),
            onClick = onShare
        )
        ChatActionChip(
            iconRes = R.drawable.fc_icon_save,
            text = label(Labels.SAVE, "Save"),
            onClick = onDownload
        )
        if (isTtsEnabled) {
            ChatActionChip(
                iconRes = null,
                imageVector = if (isAudioPlaying) Icons.Filled.Pause else Icons.Filled.VolumeUp,
                text = label(Labels.LISTEN, "Listen"),
                isLoading = isLoadingAudio,
                onClick = onListen
            )
        }
    }
}

@Composable
private fun ChatActionChip(
    iconRes: Int?,
    text: String,
    onClick: () -> Unit,
    imageVector: androidx.compose.ui.graphics.vector.ImageVector? = null,
    isLoading: Boolean = false
) {
    val colors = LocalContentColors.current
    val brand = LocalBrandColors.current
    val accent = brand.foregroundSecondary

    Row(
        modifier = Modifier
            .heightIn(min = 40.dp)
            .clip(SmoothShapes.rounded(Radius.Rounded))
            .background(colors.surfaceSecondary)
            .border(
                width = 1.dp,
                color = accent.copy(alpha = 0.28f),
                shape = SmoothShapes.rounded(Radius.Rounded)
            )
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        if (isLoading) {
            androidx.compose.material3.CircularProgressIndicator(
                modifier = Modifier.size(16.dp),
                strokeWidth = 2.dp,
                color = accent
            )
        } else if (iconRes != null) {
            Image(
                painter = painterResource(id = iconRes),
                contentDescription = null,
                colorFilter = ColorFilter.tint(accent),
                modifier = Modifier.size(16.dp)
            )
        } else if (imageVector != null) {
            androidx.compose.material3.Icon(
                imageVector = imageVector,
                contentDescription = null,
                tint = accent,
                modifier = Modifier.size(16.dp)
            )
        }
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            color = colors.foregroundPrimary
        )
    }
}

/** Branded card rendered invisibly and captured to PNG for share/download. */
@Composable
private fun ShareCard(
    question: String,
    answer: String
) {
    val brand = LocalBrandColors.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(brand.surfacePrimary)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Image(
                painter = painterResource(id = R.drawable.fc_logo_mark),
                contentDescription = null,
                colorFilter = ColorFilter.tint(brand.foregroundPrimary),
                modifier = Modifier.size(28.dp)
            )
            Text(
                text = label(Labels.FARMERCHAT, "FarmerChat"),
                style = MaterialTheme.typography.titleMedium,
                color = brand.foregroundPrimary
            )
        }

        if (question.isNotBlank()) {
            Text(
                text = question,
                style = MaterialTheme.typography.titleSmall,
                color = Green500
            )
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    androidx.compose.ui.graphics.Color.White,
                    SmoothShapes.rounded(Radius.LG)
                )
                .padding(16.dp)
        ) {
            MarkdownText(
                text = answer,
                color = androidx.compose.ui.graphics.Color.Black
            )
        }

        Text(
            text = label(Labels.SHARE_APP_MESSAGE, "Answered by FarmerChat"),
            style = MaterialTheme.typography.labelSmall,
            color = brand.foregroundPrimary
        )
    }
}
