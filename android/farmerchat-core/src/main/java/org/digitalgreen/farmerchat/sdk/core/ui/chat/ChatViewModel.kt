package org.digitalgreen.farmerchat.sdk.core.ui.chat

import android.content.Context
import android.net.Uri
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.FarmerChatAnalytics
import org.digitalgreen.farmerchat.sdk.core.analytics.SendQueryProperties
import org.digitalgreen.farmerchat.sdk.core.audio.AudioRecorder
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.LabelManager
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.NewConversationRequest
import org.digitalgreen.farmerchat.sdk.core.model.PlantixRequest
import org.digitalgreen.farmerchat.sdk.core.model.SetVoiceRequest
import org.digitalgreen.farmerchat.sdk.core.model.SynthesiseAudioRequest
import org.digitalgreen.farmerchat.sdk.core.model.TextPromptRequest
import org.digitalgreen.farmerchat.sdk.core.model.followUpQuestionsMoengage
import org.digitalgreen.farmerchat.sdk.core.model.followUpQuestionsRequestMoengage
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel
import org.digitalgreen.farmerchat.sdk.core.usecase.ChatUseCase
import org.digitalgreen.farmerchat.sdk.core.util.ImageUtils
import java.io.File
import java.util.UUID

private enum class InputType { TEXT, AUDIO, IMAGE }

/**
 * Chat thread state machine (port of the app's ChatViewModel over ChatAction/ChatState).
 *
 * Covers: pre-generated content entry (incl. campaign QAPair insert), text/voice/image
 * questions, follow-ups (endpoint #29 only — never TextPromptResponse.follow_up_questions),
 * read-full-advice, retry-with-flag, Listen TTS, and paginated thread history.
 */
class ChatViewModel(
    private val appContext: Context,
    private val chatUseCase: ChatUseCase,
    private val prefs: SdkPreferences,
    private val labelManager: LabelManager,
    private val analytics: FarmerChatAnalytics,
    /** docs/02 Step 3 guest-replaced signal ([org.digitalgreen.farmerchat.sdk.core.auth.GuestReplacedSignal]). */
    private val guestReplaced: kotlinx.coroutines.flow.Flow<Unit> = kotlinx.coroutines.flow.emptyFlow(),
    /** True in CHAT_ONLY, where no Home exists to create the replaced guest's conversation. */
    private val createConversationOnGuestReplaced: Boolean = false
) : CoreViewModel() {

    private val _state = MutableStateFlow(
        ChatState(isTtsEnabled = prefs.getBoolean(SdkPreferences.Keys.TTS_ENABLED, true))
    )
    val state: StateFlow<ChatState> = _state

    private var currentConversationId: String? = null

    init {
        // docs/02 Step 3: a rejected guest was replaced by a new one. The conversation this
        // screen cached belonged to the old user_id; drop it so the next send reads the one Home
        // re-creates (NEW_CONVERSATION_ID). CHAT_ONLY has no Home, so create it here.
        scope.launch {
            guestReplaced.collect {
                currentConversationId = null
                if (createConversationOnGuestReplaced) createConversationForReplacedGuest()
            }
        }
    }

    private suspend fun createConversationForReplacedGuest() {
        if (prefs.getString(SdkPreferences.Keys.NEW_CONVERSATION_ID, "").isNotBlank()) return
        val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "").trim()
        if (userId.isBlank()) return
        val result = runCatching {
            chatUseCase.newConversation(
                NewConversationRequest(user_id = userId, content_provider_id = null)
            ).first()
        }.getOrNull()
        if (result is ApiResult.Success) {
            prefs.putString(SdkPreferences.Keys.NEW_CONVERSATION_ID, result.data.conversation_id)
        }
    }

    // Pre-generated content bookkeeping
    private var preGeneratedQuestion: String? = null
    private var preGeneratedAnswer: String? = null
    private var homeStatementIdForReadFullAdvice: String? = null

    // Retry bookkeeping
    private var lastFailedQuestion: String? = null
    private var lastFailedInputType: InputType? = null
    private var lastFailedTranscriptionId: String? = null
    private var lastFailedImageUri: Uri? = null
    private var lastFailedTriggeredOverride: String? = null
    private var lastFailedWeatherCta: Boolean = false
    private var lastFailedSsfrCrop: String? = null
    private var lastFailedStatementIdOverride: String? = null

    private var pendingSendQueryProperties: SendQueryProperties? = null

    // TTS analytics bookkeeping
    private var audioPlaybackStartedAtMs: Long = 0L

    fun onAction(action: ChatAction) {
        when (action) {
            is ChatAction.InitializeWithPreGeneratedContent -> initializeWithPreGenerated(action)
            is ChatAction.InitializeVoicePrototype -> initializeVoice(action.audioUri, replaceMessages = true)
            is ChatAction.InitializeWithQuestion -> initializeWithQuestionAction(action)
            is ChatAction.ReplacePreGeneratedWithQuestion ->
                replacePreGeneratedWithQuestion(action.question, action.triggerInputType)
            is ChatAction.SendFollowUpQuestion -> {
                pendingSendQueryProperties = action.sendQueryProperties ?: SendQueryProperties(
                    screenName = AnalyticsScreens.CHAT,
                    isFollowupPrompt = true,
                    isImageQuery = false,
                    isTextQuery = action.audioUri == null,
                    isVoiceQuery = action.audioUri != null,
                    lengthOfTextQuery = action.question.length
                )
                pendingSendQueryProperties?.let { analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED, it.toAnalyticsProperties()) }
                sendFollowUpQuestion(action.question, action.transcriptionId, action.audioUri, action.followUpQuestionId)
            }
            is ChatAction.SendQuestionWithImage -> {
                pendingSendQueryProperties = action.sendQueryProperties ?: SendQueryProperties(
                    screenName = AnalyticsScreens.CHAT,
                    isFollowupPrompt = false,
                    isImageQuery = true,
                    isTextQuery = false,
                    isVoiceQuery = false,
                    lengthOfTextQuery = action.question.length
                )
                pendingSendQueryProperties?.let { analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED, it.toAnalyticsProperties()) }
                sendQuestionWithImage(action.question, action.imageUri)
            }
            is ChatAction.SendFollowUpVoiceQuestion -> initializeVoice(action.audioUri, replaceMessages = false)
            is ChatAction.SendQuestionWithAudio ->
                sendFollowUpQuestion(action.question, transcriptionId = null, audioUri = action.audioUri, followUpQuestionId = null)
            is ChatAction.LoadChatHistory -> loadChatHistory(action.conversationId, action.page)
            is ChatAction.RetryLastRequest -> retryLastRequest()
            is ChatAction.ClearError ->
                _state.update { it.copy(errorMessage = null, failedMessageId = null, chatResponseState = UiState.Idle) }
            is ChatAction.ClearMessages -> {
                preGeneratedQuestion = null
                preGeneratedAnswer = null
                homeStatementIdForReadFullAdvice = null
                _state.value = ChatState(isTtsEnabled = prefs.getBoolean(SdkPreferences.Keys.TTS_ENABLED, true))
            }
            is ChatAction.SynthesiseAudio -> synthesiseAudio()
            is ChatAction.ClearAudioPlaybackUrl -> {
                trackStoppedPlaying()
                _state.update { it.copy(audioPlaybackUrl = null, isAudioPlaying = false) }
            }
            is ChatAction.SetAudioPlaying -> {
                if (action.isPlaying) {
                    audioPlaybackStartedAtMs = System.currentTimeMillis()
                    analytics.track(AnalyticsEvents.STARTED_PLAYING_RESPONSE_AUDIO)
                } else {
                    trackStoppedPlaying()
                }
                _state.update { it.copy(isAudioPlaying = action.isPlaying) }
            }
        }
    }

    private fun trackStoppedPlaying() {
        if (audioPlaybackStartedAtMs > 0 && _state.value.isAudioPlaying) {
            val seconds = (System.currentTimeMillis() - audioPlaybackStartedAtMs) / 1000
            analytics.track(
                AnalyticsEvents.STOPPED_PLAYING_RESPONSE_AUDIO,
                mapOf("No_of_seconds_played" to seconds)
            )
            audioPlaybackStartedAtMs = 0L
        }
    }

    private fun conversationId(): String =
        currentConversationId ?: prefs.getString(SdkPreferences.Keys.NEW_CONVERSATION_ID, "")

    // ------------------------------------------------------------------ init: pre-generated

    private fun initializeWithPreGenerated(action: ChatAction.InitializeWithPreGeneratedContent) {
        preGeneratedQuestion = action.question
        preGeneratedAnswer = action.answer
        homeStatementIdForReadFullAdvice = action.homeStatementId

        // Campaign QAPair: new conversation → add_query_to_history → show content.
        if (action.isFromCampaign && !action.answer.isNullOrBlank()) {
            _state.update { it.copy(isLoading = true, chatResponseState = UiState.Loading) }
            scope.launch {
                val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "").trim()
                if (userId.isBlank()) {
                    addPreGeneratedMessagesToState(action)
                    return@launch
                }
                when (val result = chatUseCase.newConversation(
                    NewConversationRequest(user_id = userId, content_provider_id = null)
                ).first()) {
                    is ApiResult.Success -> {
                        val cid = result.data.conversation_id
                        currentConversationId = cid
                        prefs.putString(SdkPreferences.Keys.NEW_CONVERSATION_ID, cid)
                        chatUseCase.addQueryToHistory(
                            followUpQuestionsRequestMoengage(
                                conversation_id = cid,
                                query = action.question,
                                response = action.answer,
                                follow_up_questions = action.followUpQuestions
                                    ?.map { followUpQuestionsMoengage(message = it) } ?: emptyList(),
                                video_resources = emptyList(),
                                triggered_input_type = "push"
                            )
                        ).collect { }
                        addPreGeneratedMessagesToState(action)
                    }
                    is ApiResult.Error -> {
                        Log.w(TAG, "Campaign: new conversation failed, showing content anyway")
                        addPreGeneratedMessagesToState(action)
                    }
                }
            }
            return
        }

        addPreGeneratedMessagesToState(action)
    }

    private fun addPreGeneratedMessagesToState(action: ChatAction.InitializeWithPreGeneratedContent) {
        val question = action.question
        val answer = action.answer
        val wideBanner = action.userMessageImageUri != null
        val messages = if (!answer.isNullOrBlank()) {
            listOf(
                ChatMessage.UserMessage(
                    text = question,
                    imageUri = action.userMessageImageUri,
                    userBubbleImageWideBanner = wideBanner,
                    id = "pregen_question_${question.hashCode()}"
                ),
                ChatMessage.AiResponse(
                    text = answer,
                    followUpQuestions = action.followUpQuestions,
                    id = "pregen_answer_${answer.hashCode()}",
                    isPreGenerated = true
                )
            )
        } else {
            listOf(
                ChatMessage.UserMessage(
                    text = question,
                    imageUri = action.userMessageImageUri,
                    userBubbleImageWideBanner = wideBanner,
                    id = "pregen_question_${question.hashCode()}"
                )
            )
        }
        _state.update {
            it.copy(
                messages = messages,
                suggestedQuestions = action.followUpQuestions,
                suggestedQuestionIds = null,
                isLoading = false,
                chatResponseState = UiState.Idle
            )
        }
        // No answer yet → fetch it like a normal question.
        if (answer.isNullOrBlank()) {
            initializeWithQuestion(question)
        }
    }

    /** Re-adds the pre-generated Q&A block when messages were cleared (app parity). */
    private fun ensurePreGeneratedContentAdded(current: List<ChatMessage>): List<ChatMessage> {
        val q = preGeneratedQuestion
        val a = preGeneratedAnswer
        if (q.isNullOrBlank() || a.isNullOrBlank()) return current
        val alreadyThere = current.any { it is ChatMessage.AiResponse && it.isPreGenerated }
        if (alreadyThere || current.isNotEmpty()) return current
        return listOf(
            ChatMessage.UserMessage(text = q, id = "pregen_question_${q.hashCode()}"),
            ChatMessage.AiResponse(
                text = a,
                id = "pregen_answer_${a.hashCode()}",
                isPreGenerated = true
            )
        )
    }

    // ------------------------------------------------------------------ init: question

    private fun initializeWithQuestionAction(action: ChatAction.InitializeWithQuestion) {
        val props = SendQueryProperties(
            screenName = action.originScreenName,
            isFollowupPrompt = false,
            isImageQuery = false,
            isTextQuery = action.audioUri == null,
            isVoiceQuery = action.audioUri != null,
            lengthOfTextQuery = action.question.length,
            isWeatherAdviceCTA = action.isWeatherAdviceCTA,
            isPush = action.isPush,
            isInApp = action.isInApp,
            isSSFR = action.isSSFR,
            channel = action.channel
        )
        pendingSendQueryProperties = props
        analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED, props.toAnalyticsProperties())

        val triggeredInputTypeOverride = when {
            action.isPush -> "push"
            action.isInApp -> "in-app"
            action.isWeatherAdviceCTA -> "weather"
            action.isSSFR -> "ssfr"
            !action.channel.isNullOrBlank() -> action.channel
            else -> null
        }

        if (action.isPush) {
            // Push queries always start a fresh conversation when possible.
            scope.launch {
                val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "").trim()
                if (userId.isNotBlank()) {
                    when (val result = chatUseCase.newConversation(
                        NewConversationRequest(user_id = userId, content_provider_id = null)
                    ).first()) {
                        is ApiResult.Success -> {
                            currentConversationId = result.data.conversation_id
                            prefs.putString(SdkPreferences.Keys.NEW_CONVERSATION_ID, result.data.conversation_id)
                            _state.update { it.copy(messages = emptyList()) }
                        }
                        is ApiResult.Error ->
                            Log.w(TAG, "New conversation failed for push query, using existing")
                    }
                }
                initializeWithQuestion(
                    action.question, action.transcriptionId, action.audioUri,
                    action.isWeatherAdviceCTA, triggeredInputTypeOverride, action.ssfrCrop
                )
            }
        } else {
            initializeWithQuestion(
                action.question, action.transcriptionId, action.audioUri,
                action.isWeatherAdviceCTA, triggeredInputTypeOverride, action.ssfrCrop
            )
        }
    }

    private fun initializeWithQuestion(
        question: String,
        transcriptionId: String? = null,
        audioUri: Uri? = null,
        isWeatherAdviceCTA: Boolean = false,
        triggeredInputTypeOverride: String? = null,
        ssfrCrop: String? = null
    ) {
        if (question.isBlank()) return
        clearAudioPlayback()
        val messagesWithPreGenerated = ensurePreGeneratedContentAdded(_state.value.messages)
        val placeholderId = UUID.randomUUID().toString()
        val inputType = if (transcriptionId != null) InputType.AUDIO else InputType.TEXT

        _state.update { current ->
            current.copy(
                messages = messagesWithPreGenerated +
                    ChatMessage.UserMessage(question, audioUri = audioUri) +
                    ChatMessage.LoadingPlaceholder(id = placeholderId),
                isLoading = true,
                errorMessage = null,
                failedMessageId = null,
                chatResponseState = UiState.Loading
            )
        }

        rememberForRetry(question, inputType, transcriptionId, null, triggeredInputTypeOverride, isWeatherAdviceCTA, ssfrCrop, null)
        fetchTextPromptResponse(
            question, inputType, placeholderId, transcriptionId,
            weatherCtaTriggered = isWeatherAdviceCTA,
            triggeredInputTypeOverride = triggeredInputTypeOverride,
            ssfrCrop = ssfrCrop
        )
    }

    // ------------------------------------------------------------------ read-full-advice / pre-gen follow-up

    private fun replacePreGeneratedWithQuestion(question: String, triggerInputType: String?) {
        clearAudioPlayback()
        val currentMessages = _state.value.messages
        if (currentMessages.size != 2) return
        val second = currentMessages[1]
        if (second !is ChatMessage.AiResponse || !second.isPreGenerated) return

        val isReadFullAdvice = triggerInputType == "read_full_advice"
        val placeholderId = UUID.randomUUID().toString()

        if (isReadFullAdvice) {
            // Append same question + loading; keep pre-generated block; hide "Read more".
            _state.update {
                it.copy(
                    readFullAdviceRequestedForMessageId = second.id,
                    messages = currentMessages + listOf(
                        ChatMessage.UserMessage(question),
                        ChatMessage.LoadingPlaceholder(id = placeholderId)
                    ),
                    isLoading = true,
                    errorMessage = null,
                    failedMessageId = null,
                    chatResponseState = UiState.Loading
                )
            }
            pendingSendQueryProperties = SendQueryProperties(
                screenName = AnalyticsScreens.CHAT,
                isFollowupPrompt = false,
                isImageQuery = false,
                isTextQuery = true,
                isVoiceQuery = false,
                lengthOfTextQuery = question.length,
                isReadFullAdvice = true
            )
            pendingSendQueryProperties?.let { analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED, it.toAnalyticsProperties()) }
            val statementIdToSend = homeStatementIdForReadFullAdvice
            rememberForRetry(question, InputType.TEXT, null, null, triggerInputType, false, null, statementIdToSend)
            fetchTextPromptResponse(
                question, InputType.TEXT, placeholderId, null,
                triggeredInputTypeOverride = triggerInputType,
                statementIdOverride = statementIdToSend
            )
            return
        }

        // Follow-up click on pre-generated content: replace the block entirely.
        preGeneratedQuestion = null
        preGeneratedAnswer = null
        _state.update {
            it.copy(
                readFullAdviceRequestedForMessageId = null,
                messages = listOf(
                    ChatMessage.UserMessage(question),
                    ChatMessage.LoadingPlaceholder(id = placeholderId)
                ),
                isLoading = true,
                errorMessage = null,
                failedMessageId = null,
                chatResponseState = UiState.Loading
            )
        }
        rememberForRetry(question, InputType.TEXT, null, null, triggerInputType, false, null, null)
        fetchTextPromptResponse(question, InputType.TEXT, placeholderId, null, triggeredInputTypeOverride = triggerInputType)
    }

    // ------------------------------------------------------------------ follow-up / image / voice

    private fun sendFollowUpQuestion(
        question: String,
        transcriptionId: String?,
        audioUri: Uri?,
        followUpQuestionId: String?
    ) {
        if (question.isBlank()) return
        if (_state.value.isLoading) return
        // CHAT_ONLY (and any directly-entered empty chat) has no prior turn, so the
        // first typed message is an INITIAL query, not a follow-up — sending it as
        // "follow_up" with an empty conversation_id makes the backend 500.
        val isFirstTurn = _state.value.messages.none { it is ChatMessage.UserMessage }
        if (followUpQuestionId != null) {
            scope.launch {
                chatUseCase.trackFollowUpQuestionClick(followUpQuestionId).collect { }
            }
        }
        clearAudioPlayback()
        val messagesWithPreGenerated = ensurePreGeneratedContentAdded(_state.value.messages)
        val placeholderId = UUID.randomUUID().toString()
        val inputType = if (transcriptionId != null) InputType.AUDIO else InputType.TEXT

        _state.update { current ->
            current.copy(
                messages = messagesWithPreGenerated +
                    ChatMessage.UserMessage(question, audioUri = audioUri) +
                    ChatMessage.LoadingPlaceholder(id = placeholderId),
                isLoading = true,
                errorMessage = null,
                failedMessageId = null,
                chatResponseState = UiState.Loading
            )
        }

        val followUpTriggeredType = when {
            transcriptionId != null -> "voice"
            isFirstTurn -> "text"
            pendingSendQueryProperties?.isFollowupPrompt == true -> "follow_up"
            else -> "text"
        }
        rememberForRetry(question, inputType, transcriptionId, null, followUpTriggeredType, false, null, null)
        fetchTextPromptResponse(question, inputType, placeholderId, transcriptionId, triggeredInputTypeOverride = followUpTriggeredType)
    }

    private fun getDefaultImageQuery(): String =
        labelManager.getLabel(Labels.WHAT_IS_WRONG_WITH_MY_CROP, "What is wrong with my crop?")

    private fun sendQuestionWithImage(question: String, imageUri: Uri) {
        clearAudioPlayback()
        val questionForDisplayAndApi = question.ifBlank { getDefaultImageQuery() }
        val messagesWithPreGenerated = ensurePreGeneratedContentAdded(_state.value.messages)
        val placeholderId = UUID.randomUUID().toString()

        _state.update { current ->
            current.copy(
                messages = messagesWithPreGenerated +
                    ChatMessage.UserMessage(questionForDisplayAndApi, imageUri = imageUri) +
                    ChatMessage.LoadingPlaceholder(id = placeholderId),
                isLoading = true,
                errorMessage = null,
                failedMessageId = null,
                chatResponseState = UiState.Loading
            )
        }

        rememberForRetry(questionForDisplayAndApi, InputType.IMAGE, null, imageUri, null, false, null, null)
        fetchPlantixResponse(questionForDisplayAndApi, imageUri, placeholderId)
    }

    /**
     * Voice entry: audio bubble → transcribe (accept only when
     * !error && confidence > 0.7 && text not blank) → text prompt with transcription_id.
     */
    private fun initializeVoice(audioUriString: String, replaceMessages: Boolean) {
        clearAudioPlayback()
        val audioUri = Uri.parse(audioUriString)
        val userMessageId = UUID.randomUUID().toString()
        val placeholderId = UUID.randomUUID().toString()
        val userMessage = ChatMessage.UserMessage(text = "", audioUri = audioUri, id = userMessageId)
        val base = if (replaceMessages) emptyList() else ensurePreGeneratedContentAdded(_state.value.messages)

        _state.update { current ->
            current.copy(
                messages = base + userMessage + ChatMessage.LoadingPlaceholder(id = placeholderId),
                isLoading = true,
                errorMessage = null,
                failedMessageId = null,
                chatResponseState = UiState.Loading
            )
        }

        scope.launch {
            val file = audioUri.path?.let { File(it) }
            val base64 = file?.takeIf { it.exists() }?.let { AudioRecorder.convertAudioToBase64(it) }
            if (base64 == null) {
                failVoiceBubble(
                    userMessageId, placeholderId,
                    labelManager.getLabel(Labels.FAILED_TO_PROCESS_AUDIO, "Failed to process audio")
                )
                return@launch
            }
            val cid = conversationId()
            if (cid.isBlank()) {
                failVoiceBubble(
                    userMessageId, placeholderId,
                    labelManager.getLabel(
                        Labels.NO_AUDIO_RECORDED_OR_CONVERSATION_NOT_STARTED,
                        "No audio recorded or conversation not started"
                    )
                )
                return@launch
            }
            val format = AudioRecorder.getAudioFormat()
            when (val result = chatUseCase.transcribeAudio(
                SetVoiceRequest(
                    conversation_id = cid,
                    query = base64,
                    message_reference_id = userMessageId,
                    input_audio_encoding_format = format,
                    triggered_input_type = "voice"
                )
            ).first()) {
                is ApiResult.Success -> {
                    val data = result.data
                    val accepted = !data.error &&
                        (data.confidence_score ?: 0.0) > 0.7 &&
                        !data.heard_input_query.isNullOrBlank()
                    if (accepted) {
                        analytics.track(
                            AnalyticsEvents.TRANSCRIPTION_SUCCESS,
                            mapOf("Confidence_Score" to (data.confidence_score ?: 0.0))
                        )
                        val text = data.heard_input_query.orEmpty()
                        // Update the voice bubble with the heard text.
                        _state.update { current ->
                            current.copy(
                                messages = current.messages.map { msg ->
                                    if (msg is ChatMessage.UserMessage && msg.id == userMessageId) {
                                        msg.copy(text = text)
                                    } else msg
                                }
                            )
                        }
                        pendingSendQueryProperties = SendQueryProperties(
                            screenName = AnalyticsScreens.CHAT,
                            isFollowupPrompt = !replaceMessages,
                            isImageQuery = false,
                            isTextQuery = false,
                            isVoiceQuery = true,
                            audioFormat = format,
                            lengthOfTextQuery = 0
                        )
                        pendingSendQueryProperties?.let { analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED, it.toAnalyticsProperties()) }
                        rememberForRetry(text, InputType.AUDIO, data.transcription_id, null, "voice", false, null, null)
                        fetchTextPromptResponse(
                            text, InputType.AUDIO, placeholderId, data.transcription_id,
                            triggeredInputTypeOverride = "voice"
                        )
                    } else {
                        analytics.track(
                            AnalyticsEvents.TRANSCRIPTION_FAILED,
                            mapOf("Confidence_Score" to (data.confidence_score ?: 0.0))
                        )
                        failVoiceBubble(
                            userMessageId, placeholderId,
                            labelManager.getLabel(
                                Labels.TRANSCRIPTION_UNCLEAR,
                                "We couldn't hear that clearly. Please try again."
                            )
                        )
                    }
                }
                is ApiResult.Error -> {
                    analytics.track(
                        AnalyticsEvents.TRANSCRIPTION_FAILED,
                        mapOf("Confidence_Score" to "N/A")
                    )
                    failVoiceBubble(
                        userMessageId, placeholderId,
                        result.message ?: labelManager.getLabel(
                            Labels.TRANSCRIPTION_FAILED_PLEASE_TRY_AGAIN,
                            "Transcription failed. Please try again."
                        )
                    )
                }
            }
        }
    }

    private fun failVoiceBubble(userMessageId: String, placeholderId: String, message: String) {
        _state.update { current ->
            current.copy(
                messages = current.messages
                    .filterNot { it.id == placeholderId }
                    .map { msg ->
                        if (msg is ChatMessage.UserMessage && msg.id == userMessageId) {
                            msg.copy(isFailed = true)
                        } else msg
                    },
                isLoading = false,
                errorMessage = message,
                failedMessageId = userMessageId,
                chatResponseState = UiState.Error(message)
            )
        }
    }

    // ------------------------------------------------------------------ API calls

    private fun rememberForRetry(
        question: String,
        inputType: InputType,
        transcriptionId: String?,
        imageUri: Uri?,
        triggeredOverride: String?,
        weatherCta: Boolean,
        ssfrCrop: String?,
        statementIdOverride: String?
    ) {
        lastFailedQuestion = question
        lastFailedInputType = inputType
        lastFailedTranscriptionId = transcriptionId
        lastFailedImageUri = imageUri
        lastFailedTriggeredOverride = triggeredOverride
        lastFailedWeatherCta = weatherCta
        lastFailedSsfrCrop = ssfrCrop
        lastFailedStatementIdOverride = statementIdOverride
    }

    private fun retryLastRequest() {
        val question = lastFailedQuestion ?: return
        val inputType = lastFailedInputType ?: InputType.TEXT
        val placeholderId = UUID.randomUUID().toString()

        // Replace any failed placeholder with a fresh loading placeholder.
        _state.update { current ->
            current.copy(
                messages = current.messages
                    .filterNot { it is ChatMessage.LoadingPlaceholder } +
                    ChatMessage.LoadingPlaceholder(id = placeholderId),
                isLoading = true,
                errorMessage = null,
                failedMessageId = null,
                chatResponseState = UiState.Loading
            )
        }

        if (inputType == InputType.IMAGE && lastFailedImageUri != null) {
            fetchPlantixResponse(question, lastFailedImageUri!!, placeholderId, retry = true)
        } else {
            fetchTextPromptResponse(
                question, inputType, placeholderId, lastFailedTranscriptionId,
                retry = true,
                triggeredInputTypeOverride = lastFailedTriggeredOverride,
                weatherCtaTriggered = lastFailedWeatherCta,
                statementIdOverride = lastFailedStatementIdOverride,
                ssfrCrop = lastFailedSsfrCrop
            )
        }
    }

    private fun fetchTextPromptResponse(
        question: String,
        inputType: InputType,
        placeholderId: String? = null,
        transcriptionId: String? = null,
        retry: Boolean = false,
        triggeredInputTypeOverride: String? = null,
        weatherCtaTriggered: Boolean = false,
        statementIdOverride: String? = null,
        ssfrCrop: String? = null
    ) {
        val triggeredInputType = triggeredInputTypeOverride ?: when (inputType) {
            InputType.TEXT -> "text"
            InputType.AUDIO -> "voice"
            InputType.IMAGE -> "image"
        }

        val request = TextPromptRequest(
            conversation_id = conversationId(),
            query = question,
            message_id = "",
            statement_id = statementIdOverride,
            weather_cta_triggered = weatherCtaTriggered,
            triggered_input_type = triggeredInputType,
            ssfr_crop = ssfrCrop,
            use_entity_extraction = true,
            transcription_id = transcriptionId,
            retry = retry
        )

        scope.launch {
            chatUseCase.getTextPrompt(request).collect { result ->
                handleTextPromptResult(result, placeholderId)
            }
        }
    }

    private fun handleTextPromptResult(
        result: ApiResult<org.digitalgreen.farmerchat.sdk.core.model.TextPromptResponse>,
        placeholderId: String?
    ) {
        when (result) {
            is ApiResult.Success -> {
                val data = result.data
                val answerText = data.response ?: data.translated_response ?: data.message.orEmpty()
                if (data.error || answerText.isBlank()) {
                    onAnswerError(
                        placeholderId,
                        data.message?.takeIf { it.isNotBlank() } ?: labelManager.getLabel(
                            Labels.FAILED_TO_GET_RESPONSE, "Failed to get response"
                        )
                    )
                    return
                }
                markFirstQueryAsked()
                val aiId = UUID.randomUUID().toString()
                _state.update { current ->
                    current.copy(
                        messages = current.messages.filterNot { it.id == placeholderId } +
                            ChatMessage.AiResponse(
                                text = answerText,
                                id = aiId,
                                messageId = data.message_id
                            ),
                        isLoading = false,
                        errorMessage = null,
                        failedMessageId = null,
                        chatResponseState = UiState.Success(answerText),
                        suggestedQuestions = null,
                        suggestedQuestionIds = null,
                        isTtsEnabled = prefs.getBoolean(SdkPreferences.Keys.TTS_ENABLED, true) &&
                            data.hide_tts_speaker != true
                    )
                }
                pendingSendQueryProperties?.let { base ->
                    val ico = data.intent_classification_output
                    analytics.track(
                        AnalyticsEvents.SEND_QUERY,
                        base.copy(
                            isValidQuery = !data.error,
                            assetType = ico?.asset_type,
                            assetName = ico?.asset_name,
                            concern = ico?.concern,
                            stage = ico?.stage,
                            intent = ico?.intent,
                            clarificationNeededAsset = ico?.clarification_needed?.asset == true,
                            clarificationNeededConcern = ico?.clarification_needed?.concern == true
                        ).toAnalyticsProperties()
                    )
                }
                pendingSendQueryProperties = null
                // Real follow-ups always come from endpoint #29.
                data.message_id?.let { applyFollowUpQuestionsFromApi(it) }
            }
            is ApiResult.Error -> {
                pendingSendQueryProperties?.let { base ->
                    analytics.track(
                        AnalyticsEvents.SEND_QUERY,
                        base.copy(isValidQuery = false).toAnalyticsProperties()
                    )
                }
                pendingSendQueryProperties = null
                onAnswerError(placeholderId, result.message ?: fallbackErrorMessage(result))
            }
        }
    }

    private fun fetchPlantixResponse(
        question: String?,
        imageUri: Uri,
        placeholderId: String? = null,
        retry: Boolean = false
    ) {
        scope.launch {
            val imageResult = ImageUtils.prepareImageForUpload(appContext, imageUri, prefs)
            if (imageResult == null) {
                pendingSendQueryProperties?.let { base ->
                    analytics.track(
                        AnalyticsEvents.SEND_QUERY,
                        base.copy(isValidQuery = false).toAnalyticsProperties()
                    )
                }
                pendingSendQueryProperties = null
                onAnswerError(
                    placeholderId,
                    labelManager.getLabel(Labels.FAILED_TO_PROCESS_IMAGE, "Failed to process image")
                )
                return@launch
            }

            val request = PlantixRequest(
                conversation_id = conversationId(),
                image = imageResult.base64Image,
                query = question?.takeIf { it.isNotBlank() } ?: getDefaultImageQuery(),
                triggered_input_type = "image",
                latitude = imageResult.latitude?.toString(),
                longitude = imageResult.longitude?.toString(),
                image_name = "image_${UUID.randomUUID()}.jpg",
                retry = retry
            )

            chatUseCase.getPlantix(request).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        val data = result.data
                        if (data.error || data.response.isBlank()) {
                            onAnswerError(
                                placeholderId,
                                data.message.ifBlank {
                                    labelManager.getLabel(Labels.FAILED_TO_GET_RESPONSE, "Failed to get response")
                                }
                            )
                            return@collect
                        }
                        markFirstQueryAsked()
                        _state.update { current ->
                            current.copy(
                                messages = current.messages.filterNot { it.id == placeholderId } +
                                    ChatMessage.AiResponse(
                                        text = data.response,
                                        messageId = data.message_id
                                    ),
                                isLoading = false,
                                errorMessage = null,
                                failedMessageId = null,
                                chatResponseState = UiState.Success(data.response),
                                suggestedQuestions = null,
                                suggestedQuestionIds = null,
                                isTtsEnabled = prefs.getBoolean(SdkPreferences.Keys.TTS_ENABLED, true) &&
                                    data.hide_tts_speaker != true
                            )
                        }
                        pendingSendQueryProperties?.let { base ->
                            analytics.track(
                                AnalyticsEvents.SEND_QUERY,
                                base.copy(isValidQuery = true, sizeOfImageKb = imageResult.sizeKb)
                                    .toAnalyticsProperties()
                            )
                        }
                        pendingSendQueryProperties = null
                        applyFollowUpQuestionsFromApi(data.message_id)
                    }
                    is ApiResult.Error -> {
                        pendingSendQueryProperties?.let { base ->
                            analytics.track(
                                AnalyticsEvents.SEND_QUERY,
                                base.copy(isValidQuery = false).toAnalyticsProperties()
                            )
                        }
                        pendingSendQueryProperties = null
                        onAnswerError(placeholderId, result.message ?: fallbackErrorMessage(result))
                    }
                }
            }
        }
    }

    private fun applyFollowUpQuestionsFromApi(messageId: String) {
        scope.launch {
            chatUseCase.getFollowUpQuestions(messageId).collect { followUpResult ->
                val questions = when (followUpResult) {
                    is ApiResult.Success -> followUpResult.data.questions ?: emptyList()
                    is ApiResult.Error -> emptyList()
                }
                val clarificationRequired = when (followUpResult) {
                    is ApiResult.Success -> followUpResult.data.clarification_required
                    is ApiResult.Error -> false
                }
                val followUpQuestions = questions.map { it.question }
                val followUpQuestionIds = questions.map { it.follow_up_question_id }
                val lastMessage = _state.value.messages.lastOrNull()
                val lastId = (lastMessage as? ChatMessage.AiResponse)?.id
                if (lastId != null) {
                    val updated = _state.value.messages.map { msg ->
                        if (msg is ChatMessage.AiResponse && msg.id == lastId) {
                            msg.copy(followUpQuestions = followUpQuestions)
                        } else msg
                    }
                    _state.update {
                        it.copy(
                            messages = updated,
                            suggestedQuestions = followUpQuestions,
                            suggestedQuestionIds = followUpQuestionIds,
                            clarificationRequired = clarificationRequired
                        )
                    }
                }
            }
        }
    }

    private fun onAnswerError(placeholderId: String?, message: String) {
        _state.update { current ->
            current.copy(
                messages = current.messages.filterNot { it.id == placeholderId },
                isLoading = false,
                errorMessage = message,
                failedMessageId = placeholderId,
                chatResponseState = UiState.Error(message)
            )
        }
    }

    private fun fallbackErrorMessage(error: ApiResult.Error): String =
        if (error.isTimeout) {
            labelManager.getLabel(Labels.REQUEST_TIMED_OUT_PLEASE_TRY_AGAIN, "Request timed out. Please try again.")
        } else {
            labelManager.getLabel(Labels.SOMETHING_WENT_WRONG_PLEASE_TRY_AGAIN, "Something went wrong. Please try again.")
        }

    private fun markFirstQueryAsked() {
        if (!prefs.getBoolean(SdkPreferences.Keys.FIRST_QUERY_ASKED, false)) {
            prefs.putBoolean(SdkPreferences.Keys.FIRST_QUERY_ASKED, true)
            analytics.track(AnalyticsEvents.FIRST_QUERY_ASKED)
        }
    }

    // ------------------------------------------------------------------ history

    private fun loadChatHistory(conversationId: String, page: Int) {
        currentConversationId = conversationId
        if (page == 1) {
            _state.update { it.copy(isLoading = true, chatResponseState = UiState.Loading) }
        }
        scope.launch {
            chatUseCase.getChatHistory(conversationId, page).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        val items = result.data.data
                        val mapped = mutableListOf<ChatMessage>()
                        var lastFollowUps: List<org.digitalgreen.farmerchat.sdk.core.model.ConversationChatHistoryQuestion>? = null
                        var clarification = false
                        // A query and its response SHARE one `message_id` (verified live
                        // 2026-09-01: a single turn returns type 1, 3 and 7 all carrying the same
                        // id). Using it as the list key produced duplicate LazyColumn keys and
                        // crashed with IllegalArgumentException on every non-empty conversation.
                        // App parity (fc-compose ChatViewModel.kt:1027): key on
                        // message_id + message_type_id + index; `page` is added because the index
                        // restarts per page. `messageId` keeps the raw API id for TTS/follow-ups.
                        items.forEachIndexed { index, item ->
                            val uiId = "${item.message_id}_${item.message_type_id}_${page}_$index"
                            when (item.message_type_id) {
                                1 -> mapped += ChatMessage.UserMessage(
                                    text = item.query_text.orEmpty(),
                                    imageUri = item.query_media_file_url?.let(Uri::parse),
                                    userBubbleImageWideBanner = item.query_media_file_url != null,
                                    id = uiId
                                )
                                2 -> mapped += ChatMessage.UserMessage(
                                    text = item.heard_query_text ?: item.query_text.orEmpty(),
                                    audioUri = item.query_media_file_url?.let(Uri::parse),
                                    id = uiId
                                )
                                3 -> mapped += ChatMessage.AiResponse(
                                    text = item.response_text.orEmpty(),
                                    id = uiId,
                                    messageId = item.message_id
                                )
                                7 -> {
                                    lastFollowUps = item.questions
                                    clarification = item.clarification_required == true
                                }
                                11 -> mapped += ChatMessage.UserMessage(
                                    text = item.query_text.orEmpty(),
                                    imageUri = item.query_media_file_url?.let(Uri::parse),
                                    userBubbleImageWideBanner = false,
                                    id = uiId
                                )
                            }
                        }

                        _state.update { current ->
                            // distinctBy is a hard guard: a duplicate id crashes LazyColumn and
                            // takes the HOST app down with it, so never trust the wire here.
                            val newMessages = (if (page == 1) mapped
                            else mapped + current.messages) // prepend older page
                                .distinctBy { it.id }
                            current.copy(
                                messages = newMessages,
                                isLoading = false,
                                chatResponseState = UiState.Success("history"),
                                historyNextPage = if (items.isNotEmpty()) page + 1 else null,
                                isInitialHistoryLoaded = if (page == 1) true else current.isInitialHistoryLoaded,
                                suggestedQuestions = if (page == 1) {
                                    lastFollowUps?.map { it.question }
                                } else current.suggestedQuestions,
                                suggestedQuestionIds = if (page == 1) {
                                    lastFollowUps?.map { it.follow_up_question_id }
                                } else current.suggestedQuestionIds,
                                clarificationRequired = if (page == 1) clarification else current.clarificationRequired
                            )
                        }
                    }
                    is ApiResult.Error -> {
                        // 404 on page>1 → no more pages (silent).
                        if (page > 1) {
                            _state.update { it.copy(historyNextPage = null) }
                        } else {
                            _state.update {
                                it.copy(
                                    isLoading = false,
                                    errorMessage = result.message ?: labelManager.getLabel(
                                        Labels.FAILED_TO_LOAD_CHAT_HISTORY,
                                        "Failed to load chat history"
                                    ),
                                    chatResponseState = UiState.Error(
                                        result.message ?: "Failed to load chat history"
                                    )
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------ TTS

    private fun synthesiseAudio() {
        if (_state.value.isLoadingSynthesiseAudio) return
        val lastAi = _state.value.messages.lastOrNull { it is ChatMessage.AiResponse }
            as? ChatMessage.AiResponse ?: return
        val messageId = lastAi.messageId ?: return
        val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")
        _state.update { it.copy(isLoadingSynthesiseAudio = true) }
        scope.launch {
            chatUseCase.synthesiseAudio(
                SynthesiseAudioRequest(message_id = messageId, text = lastAi.text, user_id = userId)
            ).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        val url = result.data.audio
                        if (!result.data.error && !url.isNullOrBlank()) {
                            audioPlaybackStartedAtMs = System.currentTimeMillis()
                            analytics.track(AnalyticsEvents.STARTED_PLAYING_RESPONSE_AUDIO)
                            _state.update {
                                it.copy(
                                    isLoadingSynthesiseAudio = false,
                                    audioPlaybackUrl = url,
                                    isAudioPlaying = true
                                )
                            }
                        } else {
                            _state.update {
                                it.copy(
                                    isLoadingSynthesiseAudio = false,
                                    errorMessage = labelManager.getLabel(
                                        Labels.AUDIO_NOT_AVAILABLE, "Audio not available"
                                    )
                                )
                            }
                        }
                    }
                    is ApiResult.Error -> {
                        _state.update {
                            it.copy(
                                isLoadingSynthesiseAudio = false,
                                errorMessage = result.message
                            )
                        }
                    }
                }
            }
        }
    }

    private fun clearAudioPlayback() {
        _state.update { it.copy(audioPlaybackUrl = null, isAudioPlaying = false) }
    }

    companion object {
        private const val TAG = "FcSdkChatViewModel"
    }
}
