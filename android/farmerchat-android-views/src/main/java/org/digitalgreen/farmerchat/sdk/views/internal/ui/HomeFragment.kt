package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.graphics.Rect
import android.net.Uri
import android.os.Bundle
import android.view.View
import androidx.core.net.toUri
import androidx.core.view.isVisible
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.audio.AudioRecorder
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.LiveStockDetail
import org.digitalgreen.farmerchat.sdk.core.model.OptionDto
import org.digitalgreen.farmerchat.sdk.core.model.SectionDto
import org.digitalgreen.farmerchat.sdk.core.model.UserNameRequest
import org.digitalgreen.farmerchat.sdk.core.network.NetworkUtils
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.home.HomeAction
import org.digitalgreen.farmerchat.sdk.core.ui.home.HomeViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.home.isAcceptedTranscription
import org.digitalgreen.farmerchat.sdk.core.ui.name.EnterNameViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.name.UserNameAction
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentHomeBinding
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.coreVm
import org.digitalgreen.farmerchat.sdk.views.internal.input.InputOverlaysController
import org.digitalgreen.farmerchat.sdk.views.internal.journeyHost
import org.digitalgreen.farmerchat.sdk.views.internal.util.loadSvgOrImage
import org.digitalgreen.farmerchat.sdk.views.internal.util.weatherFallbackRes
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ToastView
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/** Home dashboard (doc 01 §3.7). */
internal class HomeFragment : BaseFragment(R.layout.fc_fragment_home), HomeFeedAdapter.Callbacks {

    override val analyticsScreenName: String = AnalyticsScreens.HOME

    private val vm: HomeViewModel by lazy { coreVm("home") { graph.homeViewModel() } }
    private val vmProfile: EnterNameViewModel by lazy {
        coreVm("home_profile") { graph.enterNameViewModel() }
    }

    private lateinit var binding: FcFragmentHomeBinding
    private lateinit var adapter: HomeFeedAdapter
    private var overlays: InputOverlaysController? = null

    private val viewedStatementIds = mutableSetOf<String>()

    // Content-card tap bookkeeping (FetchImageStatement → navigate).
    private var pendingQuestion: String? = null
    private var pendingCardImageUrl: String? = null
    private var pendingStatementId: String? = null

    // Voice transcription bookkeeping.
    private var pendingAudioFile: File? = null
    private var voiceMessageReferenceId: String? = null

    private fun userId(): String = graph.prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentHomeBinding.bind(view)

        adapter = HomeFeedAdapter(this)
        binding.fcHomeFeed.layoutManager = LinearLayoutManager(requireContext())
        binding.fcHomeFeed.adapter = adapter
        binding.fcHomeFeed.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                trackVisibleCards()
            }
        })

        overlays = InputOverlaysController(
            fragment = this,
            binding = binding.fcHomeOverlays,
            onTextSubmitted = { text -> navigateToChat(question = text) },
            onImagePicked = { uri -> navigateToChat(imageUri = uri.toString()) },
            onVoiceFinished = { file -> transcribeVoice(file) },
            onRecordingFailed = {
                binding.fcHomeToast.show(
                    label(Labels.FAILED_TO_START_RECORDING, "Failed to start recording"),
                    ToastView.Type.ERROR
                )
            }
        )

        renderStaticTexts()

        binding.fcHomeAppBar.fcAppBarLeft.setOnClickListener { journeyHost()?.openDrawer() }
        binding.fcHomeAppBar.fcAppBarLeft.isVisible = graph.config.showDrawer  // C3
        binding.fcInputPhoto.setOnClickListener {
            graph.analytics.track(
                AnalyticsEvents.CHAT_ICON_CLICKED,
                mapOf(
                    AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
                    AnalyticsProps.ICON_TYPE to "Image"
                )
            )
            overlays?.showPhotoInput()
        }
        binding.fcInputSpeak.setOnClickListener { onSpeakClick() }
        binding.fcInputType.setOnClickListener {
            graph.analytics.track(
                AnalyticsEvents.CHAT_ICON_CLICKED,
                mapOf(
                    AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
                    AnalyticsProps.ICON_TYPE to "Text"
                )
            )
            overlays?.showTextInput()
        }
        binding.fcHomeAppBar.fcAppBarTitle.text = ""
        binding.fcHomeAppBar.fcAppBarWeather.setOnClickListener { onWeatherClick() }
        binding.fcHomeErrorRetry.setOnClickListener {
            graph.analytics.track(AnalyticsEvents.CONTENT_TRY_AGAIN_CLICKED)
            loadHome()
        }

        // Entry effects (doc 01 §3.7): NewConversation, FetchUserProfile, LoadHome, LoadWeather.
        val uid = userId()
        val context = requireContext().applicationContext
        vm.onAction(HomeAction.NewConversation(context, uid, null))
        if (uid.isNotBlank()) {
            vm.onAction(HomeAction.FetchUserProfile(context, uid))
        }
        loadHome()
        vm.onAction(HomeAction.LoadWeather(context, uid))

        observeState()
    }

    private fun renderStaticTexts() {
        binding.fcHomeGreeting.text = label(
            Labels.GET_STARTED_BY_CLICKING_ON_PHOTO_SPEAK_OR_TYPE_TO_ASK_YOUR_QUESTION,
            "Tap a button to ask a question"
        )
        binding.fcInputPhotoLabel.text = label(Labels.PHOTO, "Photo")
        binding.fcInputSpeakLabel.text = label(Labels.SPEAK, "Speak")
        binding.fcInputTypeLabel.text = label(Labels.TYPE, "Type")
        binding.fcHomeErrorTitle.text = label(Labels.CANT_LOAD_RIGHT_NOW, "Can't load right now")
        binding.fcHomeErrorRetry.text = label(Labels.TRY_AGAIN, "Try again")
        binding.fcHomeLoading.text = label(Labels.GETTING_TODAYS_ADVICE, "Getting today's advice")
    }

    private fun loadHome() {
        val time = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(Date())
        // Guest passes userId = null (doc 01).
        vm.onAction(
            HomeAction.LoadHome(
                context = requireContext().applicationContext,
                userDeviceTime = time,
                userId = userId().ifBlank { null }
            )
        )
    }

    private fun observeState() {
        vm.state.collectWhenStarted { state ->
            // Feed
            when (val feed = state.homeFeedState) {
                is UiState.Loading, UiState.Idle -> {
                    binding.fcHomeLoading.isVisible = true
                    binding.fcHomeError.isVisible = false
                    binding.fcHomeFeed.isVisible = false
                }
                is UiState.Success -> {
                    binding.fcHomeLoading.isVisible = false
                    binding.fcHomeError.isVisible = false
                    binding.fcHomeFeed.isVisible = true
                    // renderStaticTexts() already seeded this TextView with the
                    // GET_STARTED_BY_CLICKING... label, so a missing API greeting (the case on an
                    // empty feed) leaves the label in place rather than blanking the header.
                    feed.data.greeting?.takeIf { it.isNotBlank() }?.let {
                        binding.fcHomeGreeting.text = it
                    }
                    adapter.submit(
                        // Drops plotline_widget (unrenderable in-SDK; would be blank cards).
                        sections = feed.data.renderableSections(),
                        // C3: SSFR card gated by config.enableSsfr.
                        ssfrEnabled = feed.data.ssfr_enable == true && graph.config.enableSsfr,
                        dismissedIds = state.dismissedCardIds
                    )
                    binding.fcHomeFeed.post { trackVisibleCards() }
                }
                is UiState.Error -> {
                    binding.fcHomeLoading.isVisible = false
                    binding.fcHomeFeed.isVisible = false
                    binding.fcHomeError.isVisible = true
                }
            }

            // Weather pill (silent failures — pill hides). C3: gated by config.enableWeather.
            val weather = state.weatherState as? UiState.Success
            binding.fcHomeAppBar.fcAppBarWeather.isVisible = weather != null && graph.config.enableWeather
            weather?.let {
                binding.fcHomeAppBar.fcAppBarWeatherTemp.text = it.data.current_temp
                binding.fcHomeAppBar.fcAppBarWeatherIcon.setImageResource(
                    weatherFallbackRes(it.data.weather_icon)
                )
                if (it.data.weather_icon.startsWith("http")) {
                    binding.fcHomeAppBar.fcAppBarWeatherIcon.loadSvgOrImage(it.data.weather_icon)
                }
            }

            // Content-card statement result → navigate to chat.
            handleImageStatementState(state.imageStatementState)

            // Voice transcription result.
            handleTranscriptionState(state.voiceTranscribeState)

            // Crop update success → thank-you toast.
            if (state.cropUpdateState is UiState.Success) {
                binding.fcHomeToast.show(
                    label(
                        Labels.THANK_YOU_YOUR_ANSWER_HELPS_US_GIVE_MORE_ACCURATE_ADVICE,
                        "Thank you. Your answer helps us give more accurate advice."
                    ),
                    ToastView.Type.SUCCESS
                )
                vm.onAction(HomeAction.ConsumeResult)
            }
        }
    }

    // ------------------------------------------------------------------ mark viewed (≥50% visible)

    private fun trackVisibleCards() {
        val layoutManager = binding.fcHomeFeed.layoutManager as? LinearLayoutManager ?: return
        val first = layoutManager.findFirstVisibleItemPosition()
        val last = layoutManager.findLastVisibleItemPosition()
        if (first == RecyclerView.NO_POSITION) return
        val uid = userId()
        for (position in first..last) {
            val section = adapter.sectionAt(position) ?: continue
            if (section.type != "image" && section.type != "statement") continue
            if (section.is_viewed == true) continue
            val statementId = section.statement_id?.toString() ?: continue
            if (statementId.isBlank() || viewedStatementIds.contains(statementId)) continue
            val child = layoutManager.findViewByPosition(position) ?: continue
            val visibleRect = Rect()
            if (!child.getGlobalVisibleRect(visibleRect)) continue
            if (visibleRect.height() * 2 >= child.height) {
                viewedStatementIds.add(statementId)
                vm.onAction(HomeAction.MarkImageViewed(statementId, uid))
            }
        }
    }

    // ------------------------------------------------------------------ card callbacks

    override fun onContentCardClick(section: SectionDto) {
        if (!NetworkUtils.isOnline(requireContext())) {
            findNavController().navigate(
                R.id.fc_dest_error,
                NavRoutes.errorArgs(isNetworkError = true, fromScreen = "home_card"),
                NavRoutes.singleTop()
            )
            return
        }
        graph.analytics.track(
            AnalyticsEvents.CARD_CLICKED,
            mapOf(
                AnalyticsProps.CARD_TYPE to (section.type ?: ""),
                AnalyticsProps.SENTENCE_ID to (section.statement_id?.toString() ?: "")
            )
        )
        val question = section.question_text ?: section.title.orEmpty()
        pendingQuestion = question
        pendingCardImageUrl = section.image_url?.takeIf { section.type == "image" }
        pendingStatementId = section.statement_id?.toString().orEmpty()
        val triggerType = when (section.type) {
            "image" -> "image_card"
            "statement" -> "text_card"
            else -> section.statement_type ?: ""
        }
        vm.onAction(HomeAction.FetchImageStatement(pendingStatementId.orEmpty(), triggerType))
    }

    private fun handleImageStatementState(state: UiState<org.digitalgreen.farmerchat.sdk.core.model.ImageStatementResponse>) {
        val question = pendingQuestion ?: return
        when (state) {
            is UiState.Success -> {
                val followUps = state.data.follow_up_questions
                    ?.sortedBy { it.sequence }
                    ?.map { it.question }
                    ?.takeIf { it.isNotEmpty() }
                navigateToChat(
                    question = question,
                    preGeneratedAnswer = state.data.short_answer,
                    followUpQuestions = followUps,
                    homeStatementId = pendingStatementId,
                    imageUri = pendingCardImageUrl
                )
                clearPendingCard()
                vm.onAction(HomeAction.ConsumeResult)
            }
            is UiState.Error -> {
                navigateToChat(
                    question = question,
                    homeStatementId = pendingStatementId,
                    imageUri = pendingCardImageUrl
                )
                clearPendingCard()
                vm.onAction(HomeAction.ConsumeResult)
            }
            else -> Unit
        }
    }

    private fun clearPendingCard() {
        pendingQuestion = null
        pendingCardImageUrl = null
        pendingStatementId = null
    }

    override fun onSingleSelect(section: SectionDto, option: OptionDto) {
        val uid = userId()
        if (uid.isBlank()) return
        // Gender question card (doc 01 §3.7).
        vmProfile.onAction(
            UserNameAction.UpdateUserName(
                UserNameRequest(user_id = uid, gender = option.id ?: option.text)
            ),
            AnalyticsScreens.HOME
        )
        graph.analytics.track(
            AnalyticsEvents.QUESTION_CARD_DATA_SUBMITTED,
            mapOf(
                AnalyticsProps.CARD_TYPE to (section.statement_type ?: "gender"),
                AnalyticsProps.VALUE to (option.id ?: option.text ?: "")
            )
        )
        vm.dismissCard(section.stableId())
        binding.fcHomeToast.show(
            label(
                Labels.THANK_YOU_YOUR_ANSWER_HELPS_US_GIVE_MORE_ACCURATE_ADVICE,
                "Thank you. Your answer helps us give more accurate advice."
            ),
            ToastView.Type.SUCCESS
        )
    }

    override fun onMultiSelectConfirm(section: SectionDto, optionIds: List<String>) {
        val uid = userId()
        if (uid.isBlank() || optionIds.isEmpty()) return
        val isLivestock = section.statement_type?.contains("livestock", ignoreCase = true) == true
        if (isLivestock) {
            vmProfile.onAction(
                UserNameAction.UpdateUserName(
                    UserNameRequest(
                        user_id = uid,
                        live_stock_details = optionIds.map { LiveStockDetail(type = it) }
                    )
                ),
                AnalyticsScreens.HOME
            )
            graph.analytics.track(
                AnalyticsEvents.QUESTION_CARD_DATA_SUBMITTED,
                mapOf(
                    AnalyticsProps.CARD_TYPE to "livestock",
                    AnalyticsProps.VALUE to optionIds.joinToString(",")
                )
            )
            binding.fcHomeToast.show(
                label(
                    Labels.THANK_YOU_YOUR_ANSWER_HELPS_US_GIVE_MORE_ACCURATE_ADVICE,
                    "Thank you. Your answer helps us give more accurate advice."
                ),
                ToastView.Type.SUCCESS
            )
        } else {
            vm.onAction(HomeAction.UpdateCultivatedCrops(requireContext().applicationContext, uid, optionIds))
        }
        vm.dismissCard(section.stableId())
    }

    override fun onDismiss(section: SectionDto) {
        vm.dismissCard(section.stableId())
    }

    override fun onSsfrWheat() {
        onSsfrClick(
            label(
                Labels.SSFR_WHEAT_QUESTION,
                "Give me fertilizer recommendation for my wheat farm"
            ),
            "wheat"
        )
    }

    override fun onSsfrMaize() {
        onSsfrClick(
            label(
                Labels.SSFR_MAIZE_QUESTION,
                "Give me fertilizer recommendation for my maize farm"
            ),
            "maize"
        )
    }

    private fun onSsfrClick(question: String, crop: String) {
        if (!NetworkUtils.isOnline(requireContext())) {
            findNavController().navigate(
                R.id.fc_dest_error,
                NavRoutes.errorArgs(isNetworkError = true, fromScreen = "home_card"),
                NavRoutes.singleTop()
            )
            return
        }
        navigateToChat(question = question, isSSFR = true, ssfrCrop = crop)
    }

    override fun labelFor(key: String, fallback: String): String = label(key, fallback)

    // ------------------------------------------------------------------ weather

    private fun onWeatherClick() {
        if (!NetworkUtils.isOnline(requireContext())) {
            findNavController().navigate(
                R.id.fc_dest_error,
                NavRoutes.errorArgs(isNetworkError = true, fromScreen = "home_weather"),
                NavRoutes.singleTop()
            )
            return
        }
        graph.analytics.track(AnalyticsEvents.WEATHER_FORECAST_VIEWED)
        val weatherQuestion =
            label(Labels.WHAT_IS_THE_PRESENT_WEATHER, "What is the present weather?")
        if (graph.locationPromptManager.hasStoredLocation()) {
            navigateToChat(question = weatherQuestion, isWeatherAdviceCTA = true)
        } else {
            graph.locationPromptManager.triggerFromWeather {
                if (isAdded) {
                    navigateToChat(question = weatherQuestion, isWeatherAdviceCTA = true)
                }
            }
        }
    }

    // ------------------------------------------------------------------ voice

    private fun onSpeakClick() {
        if (!graph.prefs.getBoolean(SdkPreferences.Keys.ASR_ENABLED, true)) {
            binding.fcHomeToast.show(
                label(
                    Labels.ASR_IS_DISABLED_FOR_YOUR_SELECTED_LANGUAGE,
                    "ASR is disabled for your selected language"
                ),
                ToastView.Type.ERROR
            )
            return
        }
        graph.analytics.track(
            AnalyticsEvents.CHAT_ICON_CLICKED,
            mapOf(
                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
                AnalyticsProps.ICON_TYPE to "Voice"
            )
        )
        overlays?.showVoiceInput()
    }

    private fun transcribeVoice(file: File) {
        val conversationId =
            graph.prefs.getString(SdkPreferences.Keys.NEW_CONVERSATION_ID, "")
        val base64 = AudioRecorder.convertAudioToBase64(file)
        if (conversationId.isBlank() || base64 == null) {
            overlays?.hide()
            binding.fcHomeToast.show(
                label(
                    Labels.NO_AUDIO_RECORDED_OR_CONVERSATION_NOT_STARTED,
                    "No audio recorded or conversation not started"
                ),
                ToastView.Type.ERROR
            )
            return
        }
        pendingAudioFile = file
        voiceMessageReferenceId = UUID.randomUUID().toString()
        overlays?.setVoiceProcessing(true)
        vm.onAction(
            HomeAction.TranscribeAudio(
                context = requireContext().applicationContext,
                conversationId = conversationId,
                query = base64,
                messageReferenceId = voiceMessageReferenceId.orEmpty(),
                audioFormat = AudioRecorder.getAudioFormat(),
                triggeredType = "voice"
            )
        )
    }

    private fun handleTranscriptionState(state: UiState<org.digitalgreen.farmerchat.sdk.core.model.GetVoiceResponse>) {
        val file = pendingAudioFile ?: return
        when (state) {
            is UiState.Success -> {
                pendingAudioFile = null
                overlays?.hide()
                vm.onAction(HomeAction.ClearTranscriptionState)
                val data = state.data
                if (data.isAcceptedTranscription()) {
                    navigateToChat(
                        question = data.heard_input_query.orEmpty(),
                        transcriptionId = data.transcription_id,
                        audioUri = Uri.fromFile(file).toString()
                    )
                } else {
                    binding.fcHomeToast.show(
                        label(
                            Labels.TRANSCRIPTION_UNCLEAR,
                            "Transcription unclear"
                        ),
                        ToastView.Type.ERROR
                    )
                }
            }
            is UiState.Error -> {
                pendingAudioFile = null
                overlays?.hide()
                vm.onAction(HomeAction.ClearTranscriptionState)
                binding.fcHomeToast.show(
                    state.message.ifBlank {
                        label(
                            Labels.TRANSCRIPTION_FAILED_PLEASE_TRY_AGAIN,
                            "Transcription failed. Please try again."
                        )
                    },
                    ToastView.Type.ERROR
                )
            }
            else -> Unit
        }
    }

    // ------------------------------------------------------------------ navigation

    private fun navigateToChat(
        question: String? = null,
        imageUri: String? = null,
        transcriptionId: String? = null,
        audioUri: String? = null,
        preGeneratedAnswer: String? = null,
        followUpQuestions: List<String>? = null,
        homeStatementId: String? = null,
        isWeatherAdviceCTA: Boolean = false,
        isSSFR: Boolean = false,
        ssfrCrop: String? = null
    ) {
        if (!isAdded) return
        findNavController().navigate(
            R.id.fc_dest_chat,
            NavRoutes.chatArgs(
                source = "home",
                question = question,
                imageUri = imageUri,
                transcriptionId = transcriptionId,
                audioUri = audioUri,
                preGeneratedAnswer = preGeneratedAnswer,
                followUpQuestions = followUpQuestions,
                homeStatementId = homeStatementId,
                isWeatherAdviceCTA = isWeatherAdviceCTA,
                isSSFR = isSSFR,
                ssfrCrop = ssfrCrop
            )
        )
    }

    override fun onDestroyView() {
        overlays?.release()
        overlays = null
        super.onDestroyView()
    }
}
