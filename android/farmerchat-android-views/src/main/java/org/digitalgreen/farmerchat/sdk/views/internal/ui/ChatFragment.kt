package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.content.ContentValues
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.view.LayoutInflater
import android.view.View
import androidx.core.content.FileProvider
import androidx.core.net.toUri
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.audio.AudioPlayback
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.chat.ChatAction
import org.digitalgreen.farmerchat.sdk.core.ui.chat.ChatMessage
import org.digitalgreen.farmerchat.sdk.core.ui.chat.ChatState
import org.digitalgreen.farmerchat.sdk.core.ui.chat.ChatViewModel
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentChatBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcShareCardBinding
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.coreVm
import org.digitalgreen.farmerchat.sdk.views.internal.input.InputOverlaysController
import org.digitalgreen.farmerchat.sdk.views.internal.journeyHost
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ToastView
import java.io.File

/** Chat thread (doc 01 §3.8). */
internal class ChatFragment : BaseFragment(R.layout.fc_fragment_chat), ChatAdapter.Callbacks {

    override val analyticsScreenName: String = AnalyticsScreens.CHAT

    private val vm: ChatViewModel by lazy { coreVm("chat") { graph.chatViewModel() } }

    private lateinit var binding: FcFragmentChatBinding
    private lateinit var adapter: ChatAdapter
    private var overlays: InputOverlaysController? = null

    private val source: String get() = arguments?.getString("source") ?: "home"

    // Voice clip playback (user bubbles)
    private val clipPlayback = AudioPlayback()
    private var playingClipId: String? = null
    private val clipDurations = mutableMapOf<String, Long>()
    private val durationRequests = mutableSetOf<String>()
    private val clipProgressTicker = object : Runnable {
        override fun run() {
            if (playingClipId != null) {
                refreshRows(vm.state.value)
                binding.fcChatList.postDelayed(this, 500L)
            }
        }
    }

    // Synthesised answer audio (Listen / TTS)
    private val ttsPlayback = AudioPlayback()
    private var ttsPreparedUrl: String? = null

    private var lastRenderedLastKey: String? = null
    private var initialHistoryScrollDone = false

    // History pagination anchors
    private var restoreAnchorKey: String? = null
    private var restoreAnchorOffset = 0

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentChatBinding.bind(view)

        adapter = ChatAdapter(this)
        val layoutManager = LinearLayoutManager(requireContext())
        binding.fcChatList.layoutManager = layoutManager
        binding.fcChatList.adapter = adapter

        binding.fcChatList.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                if (dy >= 0) return
                val state = vm.state.value
                val nextPage = state.historyNextPage ?: return
                if (state.isLoading) return
                if (layoutManager.findFirstVisibleItemPosition() == 0) {
                    val conversationId = arguments?.getString("conversationId") ?: return
                    // Anchor for position restore after prepend.
                    val firstRow = adapter.rows.firstOrNull()
                    restoreAnchorKey = firstRow?.key
                    restoreAnchorOffset =
                        layoutManager.findViewByPosition(0)?.top ?: 0
                    vm.onAction(ChatAction.LoadChatHistory(conversationId, nextPage))
                }
            }
        })

        // App bar: Close (home entry) / Menu (history entry); centered logo.
        val isHistoryEntry = source == "history"
        binding.fcChatAppBar.fcAppBarTitle.text = ""
        binding.fcChatAppBar.fcAppBarLeft.setImageResource(
            if (isHistoryEntry) R.drawable.fc_ic_menu else R.drawable.fc_ic_close
        )
        binding.fcChatAppBar.fcAppBarLeft.setOnClickListener {
            if (isHistoryEntry && graph.config.showDrawer) {
                journeyHost()?.openDrawer()
            } else if (isHistoryEntry) {
                // Drawer off (CHAT_ONLY): openDrawer() is a no-op, so this would strand the
                // user in a thread opened from history. Step back to the history list, or exit
                // if there is nothing to pop.
                if (!findNavController().popBackStack()) requireActivity().finish()
            } else {
                graph.analytics.track(AnalyticsEvents.CHAT_SCREEN_BACK_BUTTON_CLICK)
                // CHAT_ONLY has no SDK Home — close exits the SDK back to the host
                // (parity with android-compose FarmerChatRoot).
                if (graph.config.mode == org.digitalgreen.farmerchat.sdk.FarmerChatMode.CHAT_ONLY) {
                    requireActivity().finish()
                } else {
                    NavRoutes.navigateChatClose(findNavController())
                }
            }
        }
        // C3: with the drawer on, the left slot is the menu affordance and hides with it.
        // With the drawer OFF it must stay visible as a plain back control, otherwise a thread
        // opened from history has no way out.
        if (isHistoryEntry) {
            binding.fcChatAppBar.fcAppBarLeft.isVisible = true
            if (!graph.config.showDrawer) {
                binding.fcChatAppBar.fcAppBarLeft.setImageResource(R.drawable.fc_ic_back)
            }
        }
        setUpAppBarActions()

        overlays = InputOverlaysController(
            fragment = this,
            binding = binding.fcChatOverlays,
            onTextSubmitted = { text -> vm.onAction(ChatAction.SendFollowUpQuestion(text)) },
            onImagePicked = { uri -> vm.onAction(ChatAction.SendQuestionWithImage("", uri)) },
            onVoiceFinished = { file ->
                overlays?.hide()
                vm.onAction(
                    ChatAction.SendFollowUpVoiceQuestion(Uri.fromFile(file).toString())
                )
            },
            onRecordingFailed = {
                binding.fcChatToast.show(
                    label(Labels.FAILED_TO_START_RECORDING, "Failed to start recording"),
                    ToastView.Type.ERROR
                )
            }
        )

        binding.fcChatInputPhotoLabel.text = label(Labels.PHOTO, "Photo")
        binding.fcChatInputSpeakLabel.text = label(Labels.SPEAK, "Speak")
        binding.fcChatInputTypeLabel.text = label(Labels.TYPE, "Type")
        binding.fcChatInputPhoto.setOnClickListener { overlays?.showPhotoInput() }
        binding.fcChatInputSpeak.setOnClickListener {
            if (!graph.prefs.getBoolean(SdkPreferences.Keys.ASR_ENABLED, true)) {
                binding.fcChatToast.show(
                    label(
                        Labels.ASR_IS_DISABLED_FOR_YOUR_SELECTED_LANGUAGE,
                        "ASR is disabled for your selected language"
                    ),
                    ToastView.Type.ERROR
                )
            } else {
                overlays?.showVoiceInput()
            }
        }
        binding.fcChatInputType.setOnClickListener { overlays?.showTextInput() }

        initializeIfNeeded()
        observeState()
    }

    /** One-of initialization per nav args (doc 01 §3.8). */
    private fun initializeIfNeeded() {
        val state = vm.state.value
        if (state.messages.isNotEmpty() || state.isLoading) return

        val args = requireArguments()
        val question = args.getString("question")
        val conversationId = args.getString("conversationId")
        val imageUri = args.getString("imageUri")
        val transcriptionId = args.getString("transcriptionId")
        val audioUri = args.getString("audioUri")
        val homeStatementId = args.getString("homeStatementId")
        val preGeneratedAnswer = args.getString("preGeneratedAnswer")
        val followUps = args.getString("followUpQuestions")
            ?.split(NavRoutes.FOLLOW_UP_SEPARATOR)
            ?.filter { it.isNotBlank() }
            ?.takeIf { it.isNotEmpty() }
        val isWeatherAdviceCTA = args.getBoolean("isWeatherAdviceCTA", false)
        val isSSFR = args.getBoolean("isSSFR", false)
        val ssfrCrop = args.getString("ssfrCrop")
        val channel = args.getString("channel")

        when {
            source == "history" && conversationId != null ->
                vm.onAction(ChatAction.LoadChatHistory(conversationId))

            preGeneratedAnswer != null ->
                vm.onAction(
                    ChatAction.InitializeWithPreGeneratedContent(
                        question = question.orEmpty(),
                        answer = preGeneratedAnswer,
                        followUpQuestions = followUps,
                        homeStatementId = homeStatementId,
                        userMessageImageUri = imageUri?.toUri()
                    )
                )

            imageUri != null ->
                vm.onAction(ChatAction.SendQuestionWithImage(question.orEmpty(), imageUri.toUri()))

            audioUri != null && question.isNullOrBlank() ->
                vm.onAction(ChatAction.InitializeVoicePrototype(audioUri))

            !question.isNullOrBlank() ->
                vm.onAction(
                    ChatAction.InitializeWithQuestion(
                        question = question,
                        transcriptionId = transcriptionId,
                        audioUri = audioUri?.toUri(),
                        isWeatherAdviceCTA = isWeatherAdviceCTA,
                        isSSFR = isSSFR,
                        ssfrCrop = ssfrCrop,
                        channel = channel
                    )
                )
        }
    }

    // ------------------------------------------------------------------ state → rows

    private fun observeState() {
        vm.state.collectWhenStarted { state ->
            binding.fcChatLoading.isVisible = state.messages.isEmpty() && state.isLoading
            binding.fcChatLoading.text = label(Labels.GETTING_YOUR_ANSWER, "Getting your answer…")
            binding.fcChatAppBar.fcAppBarLogo.isVisible = state.messages.isNotEmpty()

            refreshRows(state)
            handleTtsPlayback(state)

            // Restore scroll position after a history prepend.
            restoreAnchorKey?.let { anchor ->
                val index = adapter.rows.indexOfFirst { it.key == anchor }
                if (index >= 0) {
                    (binding.fcChatList.layoutManager as LinearLayoutManager)
                        .scrollToPositionWithOffset(index, restoreAnchorOffset)
                }
                restoreAnchorKey = null
            }

            // One-time scroll-to-bottom when the first history page arrives.
            if (state.isInitialHistoryLoaded && !initialHistoryScrollDone) {
                initialHistoryScrollDone = true
                scrollToBottom()
            }

            // Scroll to bottom when a new message is appended.
            val lastKey = adapter.rows.lastOrNull()?.key
            if (lastKey != null && lastKey != lastRenderedLastKey) {
                lastRenderedLastKey = lastKey
                if (restoreAnchorKey == null) scrollToBottom()
            }
        }
    }

    private fun refreshRows(state: ChatState) {
        val lastAiId = state.messages.lastOrNull { it is ChatMessage.AiResponse }?.id
        val rows = buildList {
            state.messages.forEach { message ->
                when (message) {
                    is ChatMessage.UserMessage -> add(ChatRow.User(message))
                    is ChatMessage.AiResponse -> {
                        val isLast = message.id == lastAiId
                        add(
                            ChatRow.Ai(
                                message = message,
                                isLast = isLast,
                                followUps = if (isLast) state.suggestedQuestions.orEmpty()
                                else emptyList(),
                                followUpIds = if (isLast) {
                                    state.suggestedQuestionIds
                                        ?: List(state.suggestedQuestions.orEmpty().size) { null }
                                } else emptyList(),
                                clarificationRequired = state.clarificationRequired,
                                showReadFullAdvice = message.isPreGenerated &&
                                    state.readFullAdviceRequestedForMessageId != message.id,
                                showActions = isLast && !state.isLoading,
                                isTtsEnabled = state.isTtsEnabled,
                                isAudioLoading = state.isLoadingSynthesiseAudio,
                                isAudioPlaying = state.audioPlaybackUrl != null && state.isAudioPlaying
                            )
                        )
                    }
                    is ChatMessage.LoadingPlaceholder -> add(ChatRow.Loading(message.id))
                }
            }
            if (state.errorMessage != null && !state.isLoading) {
                add(ChatRow.InlineError(state.errorMessage.orEmpty()))
            }
        }
        adapter.submit(rows)
    }

    private fun scrollToBottom() {
        if (adapter.itemCount > 0) {
            binding.fcChatList.post {
                if (adapter.itemCount > 0) {
                    binding.fcChatList.smoothScrollToPosition(adapter.itemCount - 1)
                }
            }
        }
    }

    // ------------------------------------------------------------------ adapter callbacks

    override fun labelFor(key: String, fallback: String): String = label(key, fallback)

    override fun onFollowUpClick(question: String, followUpQuestionId: String?) {
        val lastAi = vm.state.value.messages.lastOrNull { it is ChatMessage.AiResponse }
            as? ChatMessage.AiResponse
        if (lastAi?.isPreGenerated == true && vm.state.value.messages.size == 2) {
            // Follow-up on pre-generated content replaces the block (app parity).
            vm.onAction(ChatAction.ReplacePreGeneratedWithQuestion(question))
        } else {
            vm.onAction(
                ChatAction.SendFollowUpQuestion(question, followUpQuestionId = followUpQuestionId)
            )
        }
    }

    override fun onReadFullAdvice(question: String) {
        val firstUser = vm.state.value.messages.firstOrNull { it is ChatMessage.UserMessage }
            as? ChatMessage.UserMessage
        vm.onAction(
            ChatAction.ReplacePreGeneratedWithQuestion(
                question = firstUser?.text ?: question,
                triggerInputType = "read_full_advice"
            )
        )
    }

    override fun onRetry() {
        vm.onAction(ChatAction.RetryLastRequest)
    }

    // ------------------------------------------------------------------ share / download

    override fun onShare(message: ChatMessage.AiResponse) {
        graph.analytics.track(AnalyticsEvents.SHARE_BUTTON_CLICKED)
        val bitmap = renderShareCard(message) ?: return
        runCatching {
            val file = File(requireContext().cacheDir, "fc_share_${System.currentTimeMillis()}.png")
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            val uri = FileProvider.getUriForFile(
                requireContext(),
                "${requireContext().packageName}.fc_sdk_views_fileprovider",
                file
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(intent, label(Labels.SHARE_DOWNLOAD, "Share")))
        }.onFailure {
            binding.fcChatToast.show(
                label(Labels.FAILED_TO_SAVE, "Failed to save"), ToastView.Type.ERROR
            )
        }
    }

    override fun onDownload(message: ChatMessage.AiResponse) {
        graph.analytics.track(AnalyticsEvents.SAVE_BUTTON_CLICKED)
        val bitmap = renderShareCard(message) ?: return
        runCatching {
            val values = ContentValues().apply {
                put(
                    MediaStore.Images.Media.DISPLAY_NAME,
                    "farmerchat_${System.currentTimeMillis()}.png"
                )
                put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/FarmerChat")
            }
            val resolver = requireContext().contentResolver
            val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                ?: error("MediaStore insert failed")
            resolver.openOutputStream(uri)?.use {
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)
            }
            binding.fcChatToast.show(
                label(Labels.SAVED_TO_GALLERY, "Saved to gallery"), ToastView.Type.SUCCESS
            )
        }.onFailure {
            binding.fcChatToast.show(
                label(Labels.FAILED_TO_SAVE, "Failed to save"), ToastView.Type.ERROR
            )
        }
    }

    /** Inflates fc_share_card offscreen, lays it out at 1080 px wide, draws to a Bitmap. */
    private fun renderShareCard(message: ChatMessage.AiResponse): Bitmap? = runCatching {
        val shareBinding = FcShareCardBinding.inflate(LayoutInflater.from(requireContext()))
        val questionText = vm.state.value.messages
            .filterIsInstance<ChatMessage.UserMessage>()
            .lastOrNull { it.text.isNotBlank() }?.text.orEmpty()
        shareBinding.fcShareAppName.text = label(Labels.FARMERCHAT, "FarmerChat")
        shareBinding.fcShareQuestion.text = questionText
        shareBinding.fcShareQuestion.isVisible = questionText.isNotBlank()
        shareBinding.fcShareAnswer.text = message.text
        shareBinding.fcShareFooter.text = label(Labels.DIGITAL_GREEN, "© Digital Green")

        val width = 1080
        val root = shareBinding.root
        root.measure(
            View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
        )
        root.layout(0, 0, root.measuredWidth, root.measuredHeight)
        val bitmap = Bitmap.createBitmap(
            root.measuredWidth, root.measuredHeight, Bitmap.Config.ARGB_8888
        )
        root.draw(Canvas(bitmap))
        bitmap
    }.getOrNull()

    // ------------------------------------------------------------------ Listen (TTS)

    override fun onListen(message: ChatMessage.AiResponse) {
        val state = vm.state.value
        when {
            state.audioPlaybackUrl == null -> vm.onAction(ChatAction.SynthesiseAudio)
            state.isAudioPlaying -> {
                ttsPlayback.pause()
                vm.onAction(ChatAction.SetAudioPlaying(false))
            }
            else -> {
                ttsPlayback.resume()
                vm.onAction(ChatAction.SetAudioPlaying(true))
            }
        }
    }

    private fun handleTtsPlayback(state: ChatState) {
        val url = state.audioPlaybackUrl
        if (url == null) {
            if (ttsPreparedUrl != null) {
                ttsPlayback.stop()
                ttsPreparedUrl = null
            }
            return
        }
        if (url != ttsPreparedUrl && state.isAudioPlaying) {
            ttsPreparedUrl = url
            stopClipPlayback()
            ttsPlayback.play(
                context = requireContext(),
                source = url,
                onCompletion = {
                    ttsPreparedUrl = null
                    vm.onAction(ChatAction.ClearAudioPlaybackUrl)
                },
                onError = {
                    ttsPreparedUrl = null
                    vm.onAction(ChatAction.ClearAudioPlaybackUrl)
                    binding.fcChatToast.show(
                        label(Labels.AUDIO_NOT_AVAILABLE, "Audio not available"),
                        ToastView.Type.ERROR
                    )
                }
            )
        }
    }

    // ------------------------------------------------------------------ voice clip playback

    override fun isClipPlaying(messageId: String): Boolean =
        playingClipId == messageId && clipPlayback.isPlaying

    override fun clipProgress(messageId: String): Float {
        if (playingClipId != messageId) return 0f
        val duration = clipPlayback.durationMs
        if (duration <= 0) return 0f
        return clipPlayback.currentPositionMs.toFloat() / duration
    }

    override fun clipDurationMs(message: ChatMessage.UserMessage): Long {
        val uri = message.audioUri?.toString() ?: return 0L
        clipDurations[uri]?.let { return it }
        if (durationRequests.add(uri)) {
            viewLifecycleOwner.lifecycleScope.launch {
                val duration = AudioPlayback.getAudioDurationMs(requireContext(), uri)
                clipDurations[uri] = duration
                refreshRows(vm.state.value)
            }
        }
        return 0L
    }

    override fun onClipPlayPause(message: ChatMessage.UserMessage) {
        val uri = message.audioUri?.toString() ?: return
        when {
            playingClipId == message.id && clipPlayback.isPlaying -> {
                clipPlayback.pause()
                refreshRows(vm.state.value)
            }
            playingClipId == message.id -> {
                clipPlayback.resume()
                binding.fcChatList.postDelayed(clipProgressTicker, 500L)
                refreshRows(vm.state.value)
            }
            else -> {
                playingClipId = message.id
                clipPlayback.play(
                    context = requireContext(),
                    source = uri,
                    onCompletion = {
                        playingClipId = null
                        refreshRows(vm.state.value)
                    },
                    onError = {
                        playingClipId = null
                        binding.fcChatToast.show(
                            label(
                                Labels.NO_AUDIO_AVAILABLE_MESSAGE,
                                "No audio available for this message"
                            ),
                            ToastView.Type.ERROR
                        )
                        refreshRows(vm.state.value)
                    }
                )
                binding.fcChatList.postDelayed(clipProgressTicker, 500L)
            }
        }
    }

    private fun stopClipPlayback() {
        playingClipId = null
        clipPlayback.stop()
    }

    // ------------------------------------------------------------------ lifecycle

    override fun onStop() {
        // Pause all audio on stop (app parity).
        clipPlayback.pause()
        if (vm.state.value.isAudioPlaying) {
            ttsPlayback.pause()
            vm.onAction(ChatAction.SetAudioPlaying(false))
        }
        super.onStop()
    }

    override fun onDestroyView() {
        binding.fcChatList.removeCallbacks(clipProgressTicker)
        clipPlayback.release()
        ttsPlayback.release()
        overlays?.release()
        overlays = null
        vm.onAction(ChatAction.ClearMessages)
        super.onDestroyView()
    }

    /**
     * Past Advice + language icons in the chat app bar.
     *
     * Only shown when the drawer is OFF — with `showDrawer(false)` (the CHAT_ONLY setup) there
     * is otherwise no way to reach either screen. When the drawer is on, these stay hidden and
     * the drawer remains the single navigation surface, exactly as before.
     *
     * Each icon is independently gated on its own config flag, so a host can expose history
     * without language or vice versa.
     */
    private fun setUpAppBarActions() {
        val bar = binding.fcChatAppBar
        val drawerOff = !graph.config.showDrawer
        val showHistory = drawerOff && graph.config.showHistory
        // Language is always reachable when the drawer is off: it is the only way for a user
        // to change language once onboarding is skipped.
        val showLanguage = drawerOff

        bar.fcAppBarHistory.isVisible = showHistory
        bar.fcAppBarLanguage.isVisible = showLanguage
        bar.fcAppBarActions.isVisible = showHistory || showLanguage

        bar.fcAppBarHistory.contentDescription =
            label(Labels.RECENT_CHATS, "Past Advice")
        bar.fcAppBarLanguage.contentDescription =
            label(Labels.LANGUAGE, "Language")

        bar.fcAppBarHistory.setOnClickListener {
            findNavController().navigate(
                R.id.fc_dest_chat_history, null, NavRoutes.drawerOptions(findNavController())
            )
        }
        bar.fcAppBarLanguage.setOnClickListener {
            findNavController().navigate(
                R.id.fc_dest_settings_language, null, NavRoutes.drawerOptions(findNavController())
            )
        }
    }
}
