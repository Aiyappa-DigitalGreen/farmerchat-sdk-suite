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
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.audio.AudioPlayback
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptEvent
import org.digitalgreen.farmerchat.sdk.core.ui.location.isLocationObtained
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptState
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationTriggerSource
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentChip
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.chat.AlignmentChipRoute
import org.digitalgreen.farmerchat.sdk.core.ui.chat.ChatAction
import org.digitalgreen.farmerchat.sdk.core.ui.chat.routeAlignmentChip
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

    /**
     * 2.0.0 unified composer instead of the Photo/Speak/Type row — Compose parity with
     * `ChatScreen.isComposerUi`. Mirrors the app's `v2_composer_ui_enabled` flag via the host's
     * `enableComposerUi`, which defaults to following `enableAgenticChat` — so a host that opts
     * in to neither keeps the 1.0.0 input verbatim.
     */
    private val isComposerUi: Boolean get() = graph.config.resolvedComposerUi

    /**
     * The single image attached to the composer, awaiting send.
     *
     * App parity (fc-compose-agentic ChatScreen.kt:499/550 `photoUris = listOf(uri)`): in
     * composer mode a picked image is ATTACHED to the bar and sent together with whatever the
     * farmer types, instead of being sent on its own the moment the picker returns. Only one
     * image per query, so this is a single nullable rather than a list.
     */
    private var attachedPhoto: Uri? = null

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

        observeLocationOutcomes()

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
            screenName = AnalyticsScreens.CHAT,
            onTextSubmitted = { text -> vm.onAction(ChatAction.SendFollowUpQuestion(text)) },
            onImagePicked = { uri ->
                if (isComposerUi) {
                    // Attach, don't send: the composer owns the query until the farmer taps send.
                    attachedPhoto = uri
                    binding.fcChatComposer.setPhotoUris(listOf(uri))
                } else {
                    vm.onAction(ChatAction.SendQuestionWithImage("", uri))
                }
            },
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

        if (isComposerUi) setUpComposer() else setUpLegacyInputRow()

        initializeIfNeeded()
        observeState()
    }

    /** 1.0.0 input: the Photo / Speak / Type row driving the overlay panels. */
    private fun setUpLegacyInputRow() {
        binding.fcChatComposer.isVisible = false
        binding.fcChatInputButtons.isVisible = true
        binding.fcChatInputPhotoLabel.text = label(Labels.PHOTO, "Photo")
        binding.fcChatInputSpeakLabel.text = label(Labels.SPEAK, "Speak")
        binding.fcChatInputTypeLabel.text = label(Labels.TYPE, "Type")
        binding.fcChatInputPhoto.setOnClickListener { overlays?.showPhotoInput() }
        binding.fcChatInputSpeak.setOnClickListener { onSpeakClick() }
        binding.fcChatInputType.setOnClickListener { overlays?.showTextInput() }
    }

    /**
     * 2.0.0 input: the unified composer replaces the button row entirely.
     *
     * App parity (fc-compose-agentic ChatInputOverlays.kt:57) / Compose parity
     * (`ChatScreen.kt:1097`): anchored + compact, brand-green sheet on the reading surface, no
     * idle aura (that is a Home-only first-contact cue). The composer consumes the nav and IME
     * insets itself, so nothing here adds padding on top of them.
     */
    private fun setUpComposer() {
        binding.fcChatInputButtons.isVisible = false
        val composer = binding.fcChatComposer
        composer.isVisible = true
        composer.compact = true
        composer.setSurfaceColorRes(R.color.fc_green700)
        composer.setFadeColorRes(R.color.fc_surface_reading)
        composer.setPlaceholder(label(Labels.ASK_ABOUT_YOUR_FARM, "Ask about your farm..."))

        // Camera is only offered while nothing is attached (app: `if (photoUris.isEmpty())`).
        composer.onPhotoClick = { if (attachedPhoto == null) overlays?.showPhotoInput() }
        composer.onVoiceClick = { onSpeakClick() }
        composer.onRemovePhoto = {
            attachedPhoto = null
            composer.setPhotoUris(emptyList())
        }
        composer.onSend = { text -> sendFromComposer(text) }

        // The bar floats over the list, so the list must reserve its at-rest height. The
        // enclosing LinearLayout is fitsSystemWindows, so the nav-bar inset the bar folds in is
        // already outside the list — subtract it or the last bubble sits too high.
        // A config change destroys the view but keeps the fragment, so an image attached
        // before the rotation must be re-shown or the bar would send it with no thumbnail.
        attachedPhoto?.let { composer.setPhotoUris(listOf(it)) }

        composer.onBarHeightChanged = { height -> reserveComposerSpace(height) }
        reserveComposerSpace(composer.barHeightPx())

        // The composer's own listener reads ROOT insets, but its init-time requestApplyInsets()
        // ran before it was attached. Ask again now that it is in the hierarchy, then re-read
        // the settled bar height: insets are dispatched before the first layout, and the height
        // only changes (and only then re-fires onBarHeightChanged) when the nav-bar inset
        // exceeds the 20dp design gap.
        ViewCompat.requestApplyInsets(binding.root)
        binding.root.post { if (view != null) reserveComposerSpace(composer.barHeightPx()) }
    }

    /** ASR gate + voice overlay — shared by the legacy Speak button and the composer mic. */
    private fun onSpeakClick() {
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

    /**
     * Compose parity (`sendFromComposer`, ChatScreen.kt:1081): an attached image sends as
     * SendQuestionWithImage with whatever was typed; otherwise a non-blank text sends as a
     * follow-up. The composer has already cleared its own text field by the time this runs.
     */
    private fun sendFromComposer(text: String) {
        val uri = attachedPhoto
        attachedPhoto = null
        binding.fcChatComposer.setPhotoUris(emptyList())
        when {
            uri != null -> vm.onAction(ChatAction.SendQuestionWithImage(text, uri))
            text.isNotBlank() -> vm.onAction(ChatAction.SendFollowUpQuestion(text))
        }
    }

    private fun reserveComposerSpace(barHeightPx: Int) {
        val navBottom = ViewCompat.getRootWindowInsets(binding.root)
            ?.getInsets(WindowInsetsCompat.Type.navigationBars())?.bottom ?: 0
        binding.fcChatList.updatePadding(bottom = (barHeightPx - navBottom).coerceAtLeast(0))
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

            // Compose parity (ChatScreen.kt:1103 `visible = !(isThread && state.isLoading)`):
            // the composer slides off-screen while an answer is generating and back when it
            // lands — the same rhythm the legacy Photo/Speak/Type row has.
            if (isComposerUi) {
                val isThread = state.messages.isNotEmpty()
                binding.fcChatComposer.setBarVisible(!(isThread && state.isLoading))
            }

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
        val lastAi = state.messages.lastOrNull { it is ChatMessage.AiResponse }
            as? ChatMessage.AiResponse
        val lastAiId = lastAi?.id
        val rows = buildList {
            state.messages.forEach { message ->
                when (message) {
                    is ChatMessage.UserMessage -> add(ChatRow.User(message))

                    // 2.0.0: the farmer's resolved location, standing in for the text bubble they
                    // would otherwise have sent in reply to a GPS_PROMPT chip. Rendered by the
                    // dedicated location bubble (fc_item_chat_location) — the Views port of
                    // Compose's LocationChatBubble.
                    is ChatMessage.LocationMessage -> add(ChatRow.Location(message))
                    is ChatMessage.AiResponse -> {
                        val isLast = message.id == lastAiId
                        // 2.0.0: a live or interrupted agentic stream owns the message area —
                        // no action row, no related questions. Matches Compose, which gates the
                        // action row on `!isInterrupted` and the follow-up section on
                        // `!state.isLoading && errorMessage == null` (both hold here, because a
                        // stream keeps isLoading true and an interruption sets errorMessage).
                        val settled = !message.isStreaming && !message.isInterrupted
                        // An ADDITIVE alignment surface owns the space under the answer: while its
                        // chips are on screen the follow-up list is hidden, so the farmer answers
                        // the nudge instead of being offered two competing lists. ANDed with the
                        // existing gate, not replacing it. App parity — `fc-compose-agentic`
                        // 43ba5de4 "no follow up in case of chips". The backend agrees: the live
                        // prose capture's metadata carries `"followups_gated_by":
                        // "commodity-confirm"` with `followups: []`.
                        val additiveSurfaceOpen = message.alignmentKind?.isAdditive == true &&
                            !message.alignmentChips.isNullOrEmpty()
                        val showFollowUps = isLast && settled && !additiveSurfaceOpen
                        add(
                            ChatRow.Ai(
                                message = message,
                                isLast = isLast,
                                followUps = if (showFollowUps) state.suggestedQuestions.orEmpty()
                                else emptyList(),
                                followUpIds = if (showFollowUps) {
                                    state.suggestedQuestionIds
                                        ?: List(state.suggestedQuestions.orEmpty().size) { null }
                                } else emptyList(),
                                clarificationRequired = state.clarificationRequired,
                                showReadFullAdvice = message.isPreGenerated &&
                                    state.readFullAdviceRequestedForMessageId != message.id,
                                showActions = isLast && !state.isLoading && settled,
                                isTtsEnabled = state.isTtsEnabled,
                                isAudioLoading = state.isLoadingSynthesiseAudio,
                                isAudioPlaying = state.audioPlaybackUrl != null && state.isAudioPlaying,
                                isStateLoading = state.isLoading
                            )
                        )
                    }
                    is ChatMessage.LoadingPlaceholder -> add(ChatRow.Loading(message.id))
                }
            }
            // 2.0.0: an interrupted stream already carries its own inline error card, with the
            // same "Try again" action, attached to the partial answer. The ViewModel ALSO sets
            // state.errorMessage on interruption, so rendering the generic error row too would
            // show the farmer two error messages and two retry buttons.
            val streamErrorShown = lastAi?.isInterrupted == true
            if (state.errorMessage != null && !state.isLoading && !streamErrorShown) {
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

    // ------------------------------------------------------------------ agentic (2.0.0)

    /**
     * Routes an alignment chip tap. The decision table lives in core (`routeAlignmentChip`) so
     * this fragment, the Compose screen and the unit tests exercise ONE function — an inline copy
     * passes the test while drifting from it (docs/04).
     */
    override fun onAlignmentChipClick(messageId: String, kind: AlignmentKind, chip: AlignmentChip) {
        when (val route = routeAlignmentChip(kind, chip)) {
            AlignmentChipRoute.ShareLocation ->
                // Permission dialog / GPS fetch / recovery are owned by the journey's location
                // host; the outcome arrives on the collector installed in onViewCreated. Only
                // start when no other location flow is running (mirrors Home's guard).
                if (graph.locationPromptManager.state.value is LocationPromptState.Idle) {
                    pendingLocationSourceId = messageId
                    // fromAgenticChip = true → the whole GPS funnel is attributed to Chat and
                    // carries agentic_chip_type = gps-prompt (app parity).
                    graph.locationPromptManager.triggerFromLocalContext(fromAgenticChip = true)
                }
            AlignmentChipRoute.TakePhoto -> overlays?.launchCameraForCapability()
            AlignmentChipRoute.ChooseFromGallery -> overlays?.launchGalleryForCapability()
            AlignmentChipRoute.Ignore -> Unit
            is AlignmentChipRoute.SendText -> vm.onAction(
                ChatAction.SendAlignmentChip(
                    query = route.query,
                    selectionValue = route.selectionValue,
                    sourceMessageId = messageId,
                    displayLabel = route.displayLabel,
                    locationDeclined = route.locationDeclined,
                    photoDeclined = route.photoDeclined,
                    chipType = kind.analyticsType,
                    chipValue = chip.value,
                    chipLabel = chip.label
                )
            )
        }
    }

    /** Armed while a chat-initiated location flow is in progress; holds the surface's message id. */
    private var pendingLocationSourceId: String? = null

    /** The address shown in the location bubble, assembled exactly as the app does. */
    private fun resolvedAddress(): String {
        val best = graph.prefs.getString(SdkPreferences.Keys.APPROX_LOCATION_NAME, "")
        val stateName = graph.prefs.getString(SdkPreferences.Keys.USER_SELECTED_STATE_CODE, "")
        val country = graph.prefs.getString(SdkPreferences.Keys.USER_COUNTRY_NAME, "")
        return listOf(best, stateName, country).filter { it.isNotBlank() }.distinct()
            .joinToString(", ")
    }

    /**
     * Observes location outcomes for the chat share-location flow. Collected for the life of the
     * view but inert until armed, so an outcome belonging to Home or Settings is ignored.
     */
    private fun observeLocationOutcomes() {
        viewLifecycleOwner.lifecycleScope.launch {
            graph.locationPromptManager.events.collect { event ->
                val srcId = pendingLocationSourceId ?: return@collect
                val source = when (event) {
                    is LocationPromptEvent.Continue -> event.source
                    is LocationPromptEvent.Cancel -> event.source
                    else -> return@collect
                }
                if (source != LocationTriggerSource.LocalContext) return@collect
                pendingLocationSourceId = null
                if (event.isLocationObtained()) {
                    vm.onAction(
                        ChatAction.SendLocationSharedQuery(
                            sourceMessageId = srcId,
                            address = resolvedAddress()
                        )
                    )
                } else {
                    // Denied / cancelled / failed: still answer the blocking question. Sent as a
                    // chip pick exactly as the app does, so it carries `location_declined = true`
                    // and the surface's `parent_message_id` — the backend can then answer from an
                    // approximate location instead of waiting for coordinates.
                    val declineText = graph.labelManager.getLabel(
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
    }

    /**
     * Alignment escape hatch: opens the text input so a farmer whose answer is not among the
     * chips can type or dictate it (the Views equivalent of the Compose `focusTextInput`).
     */
    override fun onTypeInstead() {
        // In composer mode the composer IS the text input (Compose binds `focusTextInput` to the
        // composer's focus requester); opening the legacy panel would stack it over the bar.
        if (isComposerUi) {
            binding.fcChatComposer.requestInputFocus()
        } else {
            overlays?.showTextInput()
        }
    }

    /** The stall hint became due: re-render so the hint appears under the growing answer. */
    override fun onStallHintChanged() {
        if (view == null) return
        refreshRows(vm.state.value)
    }

    // ------------------------------------------------------------------ share / download

    override fun onShare(message: ChatMessage.AiResponse) {
        graph.analytics.track(
            AnalyticsEvents.SHARE_BUTTON_CLICKED,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.CHAT)
        ) // app ChatScreen.kt:907
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
        graph.analytics.track(
            AnalyticsEvents.SAVE_BUTTON_CLICKED,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.CHAT)
        ) // app ChatScreen.kt:931
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
            label(Labels.RECENT_CHATS, "Recent Chats")
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
