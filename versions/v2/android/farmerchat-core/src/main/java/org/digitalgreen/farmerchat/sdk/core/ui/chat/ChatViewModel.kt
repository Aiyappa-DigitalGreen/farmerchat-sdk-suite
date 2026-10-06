package org.digitalgreen.farmerchat.sdk.core.ui.chat

import android.content.Context
import android.net.Uri
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
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
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentChip
import org.digitalgreen.farmerchat.sdk.core.model.AgenticEvent
import org.digitalgreen.farmerchat.sdk.core.model.StreamErrorKind
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
private val CONTROL_TOKEN_REGEX = Regex("<<[^>]*>>")
private val FOLLOWUPS_BLOCK_REGEX = Regex("```followups[\\s\\S]*?```")

/**
 * Minimum on-screen time per tool status, so back-to-back tool events (latency 0) are not
 * collapsed by StateFlow conflation into just the last one.
 */
private const val TOOL_STATUS_MIN_DWELL_MS = 700L

/**
 * [FarmerChatConfig.simulateAgenticStream] reveal pacing: ~40 words/s on a short answer, and a
 * long one takes no more than 80 frames (~2.4 s) so the farmer never waits on the animation.
 */
private const val REVEAL_FRAME_MS = 30L
private const val REVEAL_MAX_FRAMES = 80

/** `triggered_input_type` the app sends when an alignment chip selection drives the query. */
private const val ALIGN_CHIP_SEL = "align_chip_sel"

/**
 * Strips agentic control tokens that trail the streamed text but are absent from the clean
 * `metadata.response` — e.g. `<<commodities:chickpea>>` and a ```` ```followups ... ``` ```` block.
 * Without this the farmer watches raw control tokens type themselves into the answer.
 *
 * Also cuts a still-streaming, not-yet-terminated token: mid-stream the text may end in a partial
 * `<<comm` or an unclosed fence, which must not be shown either.
 *
 * Internal (not private) so it can be unit-tested, including against the checked-in live
 * captures (`AgenticCaptureReplayTest`), where the captured prose needs no stripping at all —
 * the sanitizer must be a pure trim on a clean answer.
 */
internal fun sanitizeAgenticStreamText(raw: String): String {
    var text = FOLLOWUPS_BLOCK_REGEX.replace(raw, "")
    text = CONTROL_TOKEN_REGEX.replace(text, "")
    val fenceStart = text.indexOf("```followups")
    if (fenceStart >= 0) text = text.substring(0, fenceStart)
    val tokenStart = text.indexOf("<<")
    if (tokenStart >= 0) text = text.substring(0, tokenStart)
    return text.trimEnd()
}

/**
 * Clean-up for a SETTLED agentic answer (terminal `metadata.response` or `done.answer`).
 *
 * The app renders `metadata.response` verbatim because its backend sends it clean. The stage
 * backend (mobile-app-stage, 2026-10-06) was observed leaking the control block into it: a weather
 * answer ended with a literal ```` ```followups ["Will it rain later today?", ...] ``` ````, which the
 * markdown renderer (no fence support, same as the app's) printed as raw text under the answer.
 * Strips that block (closed, or unclosed at the end) and complete `<<...>>` markers; unlike
 * [sanitizeAgenticStreamText] it does not cut at a lone `<<`, since a finished answer has no
 * half-arrived tokens. A pure trim on a clean answer.
 */
internal fun sanitizeAgenticFinalText(raw: String): String {
    var text = FOLLOWUPS_BLOCK_REGEX.replace(raw, "")
    text = CONTROL_TOKEN_REGEX.replace(text, "")
    val fenceStart = text.indexOf("```followups")
    if (fenceStart >= 0) text = text.substring(0, fenceStart)
    return text.trimEnd()
}

class ChatViewModel(
    private val appContext: Context,
    private val chatUseCase: ChatUseCase,
    private val prefs: SdkPreferences,
    private val labelManager: LabelManager,
    private val analytics: FarmerChatAnalytics,
    private val config: org.digitalgreen.farmerchat.sdk.FarmerChatConfig,
    /** #27a streaming source. Only touched when [config].enableAgenticChat is true. */
    private val agenticChatDataSource: org.digitalgreen.farmerchat.sdk.core.remote.AgenticChatDataSource
) : CoreViewModel() {

    private val _state = MutableStateFlow(
        ChatState(isTtsEnabled = prefs.getBoolean(SdkPreferences.Keys.TTS_ENABLED, true))
    )
    val state: StateFlow<ChatState> = _state

    private var currentConversationId: String? = null

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
                // If this question came from an alignment surface's chip, record it on that
                // message. Without this `alignmentSelectedValues` stays empty forever and the
                // whole selected/locked chip treatment is dead code on every flavour — the
                // tapped chip never shows a check, never locks, and the unpicked chips never
                // fade back. Matched on value OR label because a chip may carry only a label.
                recordAlignmentPick(action.question)
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
            is ChatAction.SendAlignmentChip -> sendAlignmentChip(action)
            is ChatAction.SendLocationSharedQuery ->
                sendLocationSharedQuery(action.sourceMessageId, action.address)
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
                    analytics.track(
                        AnalyticsEvents.STARTED_PLAYING_RESPONSE_AUDIO,
                        // App ChatScreen.kt:1306.
                        mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.CHAT)
                    )
                } else {
                    trackStoppedPlaying()
                }
                _state.update { it.copy(isAudioPlaying = action.isPlaying) }
            }
        }
    }

    /**
     * `Transcription_Success` / `Transcription_Failed` payload, ported from the app's
     * `ChatViewModel.trackTranscriptionResult` (app ChatViewModel.kt:181): always
     * `{screen_name, Input_type, Source, Confidence_Score}`, and `Confidence_Score` is
     * a **String** — the score itself, or "N/A" when the API failed.
     */
    private fun transcriptionProps(confidenceScore: Double?): Map<String, Any?> = mapOf(
        AnalyticsProps.SCREEN_NAME to AnalyticsScreens.CHAT,
        AnalyticsProps.INPUT_TYPE to "Audio",
        AnalyticsProps.SOURCE to "Mic",
        AnalyticsProps.CONFIDENCE_SCORE to (confidenceScore?.toString() ?: "N/A")
    )

    private fun trackStoppedPlaying() {
        if (audioPlaybackStartedAtMs > 0 && _state.value.isAudioPlaying) {
            val seconds = (System.currentTimeMillis() - audioPlaybackStartedAtMs) / 1000
            analytics.track(
                AnalyticsEvents.STOPPED_PLAYING_RESPONSE_AUDIO,
                // App ChatScreen.kt:1083.
                mapOf(
                    AnalyticsProps.SCREEN_NAME to AnalyticsScreens.CHAT,
                    AnalyticsProps.NO_OF_SECONDS_PLAYED to seconds
                )
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
        //
        // Routed through the ACTION, not straight into `initializeWithQuestion`: the action handler
        // is what builds `SendQueryProperties`, sets `pendingSendQueryProperties` and fires
        // Send_Query_Initiated. Calling the private helper directly sent the query but emitted
        // NEITHER Send_Query_Initiated NOR Send_Query (the latter is gated on the pending props
        // being non-null), so a content-card query whose pre-generated answer came back blank was
        // invisible in analytics. The card tap originates on Home, so screen_name follows.
        if (answer.isNullOrBlank()) {
            initializeWithQuestionAction(
                ChatAction.InitializeWithQuestion(
                    question = question,
                    originScreenName = AnalyticsScreens.HOME,
                    userMessageImageUri = action.userMessageImageUri
                )
            )
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
            channel = action.channel,
            // App parity (ChatViewModel.kt:229): the agentic content-card tap stamps click_type
            // Image_Card / Text_Card. The fields already existed in SendQueryProperties
            // (Analytics.kt:580) but nothing ever set them, so agentic card taps were
            // indistinguishable from a typed question in analytics.
            isImageCard = action.contentCardTriggerType == "image_card",
            isTextCard = action.contentCardTriggerType == "text_card"
        )
        pendingSendQueryProperties = props
        analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED, props.toAnalyticsProperties())

        val triggeredInputTypeOverride = resolveTriggeredInputType(action)

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
                    action.isWeatherAdviceCTA, triggeredInputTypeOverride, action.ssfrCrop,
                    action.userMessageImageUri
                )
            }
        } else {
            initializeWithQuestion(
                action.question, action.transcriptionId, action.audioUri,
                action.isWeatherAdviceCTA, triggeredInputTypeOverride, action.ssfrCrop,
                action.userMessageImageUri
            )
        }
    }

    private fun initializeWithQuestion(
        question: String,
        transcriptionId: String? = null,
        audioUri: Uri? = null,
        isWeatherAdviceCTA: Boolean = false,
        triggeredInputTypeOverride: String? = null,
        ssfrCrop: String? = null,
        /**
         * Display-only artwork for the user's bubble (Home content card). The query is still sent
         * as TEXT — app parity, `ChatViewModel.kt:868`.
         */
        userMessageImageUri: Uri? = null
    ) {
        if (question.isBlank()) return
        clearAudioPlayback()
        val messagesWithPreGenerated = ensurePreGeneratedContentAdded(_state.value.messages)
        val placeholderId = UUID.randomUUID().toString()
        val inputType = if (transcriptionId != null) InputType.AUDIO else InputType.TEXT

        _state.update { current ->
            current.copy(
                messages = messagesWithPreGenerated +
                    ChatMessage.UserMessage(
                        question,
                        imageUri = userMessageImageUri,
                        audioUri = audioUri,
                        userBubbleImageWideBanner = userMessageImageUri != null
                    ) +
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
                    ChatMessage.UserMessage(
                        questionForDisplayAndApi,
                        imageUri = imageUri,
                        // App parity (ChatViewModel.kt:1138): a sent photo is the wide banner.
                        userBubbleImageWideBanner = true
                    ) +
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
                            // App ChatViewModel.kt:181 (trackTranscriptionResult).
                            transcriptionProps(data.confidence_score)
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
                            // App ChatViewModel.kt:181 (trackTranscriptionResult).
                            transcriptionProps(data.confidence_score)
                        )
                        failVoiceBubble(
                            userMessageId, placeholderId,
                            labelManager.getLabel(
                                Labels.TRANSCRIPTION_UNCLEAR,
                                "Transcription unclear"
                            )
                        )
                    }
                }
                is ApiResult.Error -> {
                    analytics.track(
                        AnalyticsEvents.TRANSCRIPTION_FAILED,
                        // App ChatViewModel.kt:181 — "N/A" when the API itself failed.
                        transcriptionProps(null)
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
        ssfrCrop: String? = null,
        /** Server `message_id` of the alignment surface this query answers (2.0.0). */
        parentMessageId: String? = null,
        /** True on a GPS_PROMPT decline: the backend answers from an approximate location. */
        locationDeclined: Boolean = false,
        /** True on an UPLOAD_PHOTO decline: the backend proceeds without an image. */
        photoDeclined: Boolean = false
    ) {
        val triggeredInputType = triggeredInputTypeOverride ?: when (inputType) {
            InputType.TEXT -> "text"
            InputType.AUDIO -> "voice"
            InputType.IMAGE -> "image"
        }

        // Per-LANGUAGE, from the language API's `streaming_required` (persisted on language
        // selection); defaults true when unset so an existing install keeps current behaviour.
        // It does NOT gate the stream — docs/02 §#27a — the app sends it, so the SDK does too.
        val streamingRequired = prefs.getBoolean(SdkPreferences.Keys.STREAMING_REQUIRED, true)

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
            retry = retry,
            streaming_required = streamingRequired,
            parent_message_id = parentMessageId,
            // Only ever sent as true (else null → Gson omits it), exactly as the app does.
            location_declined = if (locationDeclined) true else null,
            photo_declined = if (photoDeclined) true else null
        )

        if (config.enableAgenticChat) {
            // 2.0.0 opt-in: streams #27a. Launches its own coroutine.
            streamAgenticAnswer(request, placeholderId)
        } else if (config.simulateAgenticStream) {
            // One synchronous #27 reply, presented through the agentic UI.
            revealSynchronousAnswer(request, placeholderId)
        } else {
            // 1.0.0 default: one synchronous #27 reply.
            scope.launch {
                chatUseCase.getTextPrompt(request).collect { result ->
                    handleTextPromptResult(result, placeholderId)
                }
            }
        }
    }

    /**
     * [FarmerChatConfig.simulateAgenticStream]: a synchronous #27 answer shown the way a streamed
     * one is. The wire is untouched (one request, one JSON reply); only the bubble's lifecycle
     * follows [streamAgenticAnswer] — status while waiting, text revealed word by word, then the
     * shared settle through [handleTextPromptResult] with `isAgentic = true`, or the stream error
     * card on failure.
     */
    private fun revealSynchronousAnswer(request: TextPromptRequest, placeholderId: String?) {
        val streamId = placeholderId ?: UUID.randomUUID().toString()
        scope.launch {
            updateStreamingResponse(streamId, "", streamingStatusLabel())
            chatUseCase.getTextPrompt(request).collect { result ->
                val data = (result as? ApiResult.Success)?.data
                val alignmentKind = org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
                    .fromType(data?.alignments?.type)
                val answer = (data?.response ?: data?.translated_response ?: data?.message)
                    ?.takeIf { it.isNotBlank() }
                // Same "is this an answer" test handleTextPromptResult applies; an exclusive
                // surface's prompt is its message, so it settles without a reveal.
                val settles = data != null && !data.error &&
                    (answer != null || (alignmentKind != null && !alignmentKind.isAdditive))
                if (!settles && data != null && data.error && !data.message.isNullOrBlank()) {
                    // The server explained the failure: show its words, as the #27 path does.
                    // The stream bubble has the placeholder's id, so it is what gets removed.
                    handleTextPromptResult(result, streamId)
                    return@collect
                }
                if (!settles) {
                    pendingSendQueryProperties?.let { base ->
                        analytics.track(
                            AnalyticsEvents.SEND_QUERY,
                            base.copy(isValidQuery = false).toAnalyticsProperties()
                        )
                    }
                    pendingSendQueryProperties = null
                    // Same classification as the real stream (AgenticChatDataSource): only a
                    // transport failure (IOException — no connection, timeout, DNS) is NETWORK. A
                    // response that could not be read was mislabelled "No internet connection".
                    val error = result as? ApiResult.Error
                    val kind = when {
                        error == null -> StreamErrorKind.SERVER // 200 with error / empty answer
                        error.code != null -> StreamErrorKind.SERVER
                        error.isTimeout || error.throwable is java.io.IOException -> StreamErrorKind.NETWORK
                        else -> StreamErrorKind.UNKNOWN
                    }
                    Log.w(
                        TAG,
                        "chat answer failed: kind=$kind code=${error?.code} timeout=${error?.isTimeout} " +
                            "message=${error?.message ?: data?.message}",
                        error?.throwable
                    )
                    interruptAgentic(streamId, "", kind)
                    return@collect
                }
                if (answer != null && (alignmentKind == null || alignmentKind.isAdditive)) {
                    revealAnswer(streamId, answer)
                }
                handleTextPromptResult(result, placeholderId, reuseId = streamId, isAgentic = true)
            }
        }
    }

    /** Answers render with the agentic UI: a real stream or the simulated one over #27. */
    private val agenticUi: Boolean
        get() = config.enableAgenticChat || config.simulateAgenticStream

    /** Word-boundary prefixes of [text] into the streaming bubble, at most [REVEAL_MAX_FRAMES]. */
    private suspend fun revealAnswer(streamId: String, text: String) {
        val cuts = Regex("\\s+").findAll(text).map { it.range.last + 1 }.toList() + text.length
        val step = (cuts.size + REVEAL_MAX_FRAMES - 1) / REVEAL_MAX_FRAMES
        var i = step - 1
        while (i < cuts.size) {
            var prefix = text.substring(0, cuts[i])
            // Hold back an unclosed `**` so a half-revealed bold span never shows raw asterisks.
            if (Regex("\\*\\*").findAll(prefix).count() % 2 == 1) {
                prefix = prefix.substring(0, prefix.lastIndexOf("**"))
            }
            updateStreamingResponse(streamId, sanitizeStreamingText(prefix), null)
            delay(REVEAL_FRAME_MS)
            i += step
        }
    }

    /**
     * Consumes the agentic SSE stream (#27a, SDK 2.0.0 — gated on
     * [FarmerChatConfig.enableAgenticChat]). Faithful port of the app's
     * `consumeAgenticStream` (fc-compose-agentic @ c0524dd6, ChatViewModel.kt:1444).
     *
     * Accumulates [AgenticEvent.TextDelta]s into the answer bubble for live typing, surfaces
     * [AgenticEvent.Status] and tool status labels while the agent works, renders an
     * [AgenticEvent.Surface] the moment it arrives, and finalizes on [AgenticEvent.Metadata]. If
     * the stream ends without one, falls back to [AgenticEvent.Done], then to a rendered surface,
     * then to the accumulated text.
     *
     * Live event order (docs/02 §#27a): `status` → tools → deltas → `done` → `surface` →
     * `metadata`, or `status` → `surface` → `done` → `metadata` for a blocking surface.
     */
    private fun streamAgenticAnswer(
        request: org.digitalgreen.farmerchat.sdk.core.model.TextPromptRequest,
        placeholderId: String?
    ) {
        // Reuse the placeholder's id as the stream id so the loading bubble becomes the answer
        // bubble in place, with no remove/insert flicker.
        val streamId = placeholderId ?: UUID.randomUUID().toString()
        scope.launch {
            val builder = StringBuilder()
            var finalized = false
            // Captured but NOT finalized on arrival: a `metadata` normally follows `done` and is
            // richer (message_id, follow-up ids), so it wins. `done` is only a fallback.
            var pendingDone: AgenticEvent.Done? = null
            // A surface already RENDERED from an `event: surface`. Threaded through every finalize
            // path: without it a mid-stream surface is silently destroyed by the first exit that
            // rebuilds the bubble — and for a blocking `gps-prompt` (no deltas, `done.answer` null)
            // every branch fell through to `interruptAgentic`, replacing the farmer's question with
            // an error card. The dedupe against the later `metadata.alignments` needs nothing extra:
            // both write the SAME message id, and `handleTextPromptResult` replaces in place.
            var renderedSurface: org.digitalgreen.farmerchat.sdk.core.model.Alignment? = null

            // Single exit for every "no terminal metadata" outcome — clean EOF, a Failure event, or
            // a thrown exception. Runs at most once (guarded + latches [finalized]).
            fun finalizeStreamOrFail(errorKind: StreamErrorKind? = null) {
                if (finalized) return
                finalized = true
                val fallbackText = sanitizeStreamingText(builder.toString())
                val done = pendingDone
                val surface = renderedSurface
                when {
                    // A `done` means the model actually finished → a complete answer, not an
                    // interruption, even if the transport dropped right after.
                    done != null && (!done.answer.isNullOrBlank() || fallbackText.isNotEmpty()) ->
                        finalizeAgenticAnswer(
                            text = done.answer?.let(::sanitizeAgenticFinalText)
                                ?.takeIf { it.isNotBlank() } ?: fallbackText,
                            followUps = done.followUps.takeIf { it.isNotEmpty() },
                            messageId = null,
                            streamId = streamId,
                            surface = surface
                        )
                    // A surface was rendered and no metadata came: settle it as it stands. It is a
                    // real, answerable question — never an error — and the chips are the only way
                    // the conversation continues.
                    surface != null -> settleStreamSurface(streamId, surface)
                    // Genuine error after some text arrived: keep the partial and mark it
                    // interrupted so the UI can offer retry.
                    errorKind != null && fallbackText.isNotEmpty() ->
                        interruptAgentic(streamId, fallbackText, errorKind)
                    // Clean EOF with partial text and no terminal event: some backends stream
                    // deltas without a done/metadata. Treat it as the complete answer — flagging it
                    // interrupted would make every normal answer on such a backend look broken.
                    fallbackText.isNotEmpty() ->
                        finalizeAgenticAnswer(fallbackText, null, null, streamId)
                    // Nothing usable arrived.
                    else -> interruptAgentic(streamId, "", errorKind ?: StreamErrorKind.UNKNOWN)
                }
            }

            try {
                agenticChatDataSource.stream(request).collect { event: AgenticEvent ->
                    // Debug builds: what the stream actually sent (progress text included), so a
                    // missing status line can be told apart from one the server never sent.
                    if (config.debugLogging) Log.d(TAG, "stream event: " + when (event) {
                        is AgenticEvent.Status -> "status stage=${event.stage}"
                        is AgenticEvent.ToolCall -> "tool_call ${event.name} status_text=${event.statusText}"
                        is AgenticEvent.ToolResult -> "tool_result ${event.name} status_text=${event.statusText}"
                        is AgenticEvent.TextDelta -> "text_delta (${event.delta.length} chars)"
                        else -> event::class.simpleName
                    })
                    when (event) {
                        // Progress ping, the FIRST event on both live captures and the only sign
                        // of life during time-to-first-delta (6.7 s on the captured answer). Shown
                        // the same way as a tool status; `stage` is a machine token, so it is
                        // mapped to a LabelManager string and never rendered raw.
                        // Deliberately NO dwell here, unlike the tool branches. The dwell exists
                        // to stop StateFlow conflating back-to-back tool statuses; this ping
                        // resolves to the same copy the UI already shows by default, so it has
                        // nothing to lose to conflation — and on the gps capture `status` and
                        // `surface` arrive in ONE flush, so a dwell would delay the blocking
                        // question by 700 ms, the exact opposite of the point.
                        is AgenticEvent.Status -> updateStreamingResponse(
                            streamId,
                            sanitizeStreamingText(builder.toString()),
                            streamingStatusLabel()
                        )

                        // Alignment surface delivered MID-STREAM: render it now instead of waiting
                        // for the terminal `metadata` to carry the same surface. For a BLOCKING
                        // surface the backend is waiting on the farmer, so it settles immediately
                        // and its chips become tappable; an additive nudge attaches to the still
                        // streaming answer and unlocks when the stream finalizes.
                        is AgenticEvent.Surface -> {
                            renderedSurface = event.alignment
                            applyStreamSurface(
                                streamId, event.alignment, sanitizeStreamingText(builder.toString())
                            )
                        }

                        is AgenticEvent.ToolCall ->
                            if (!event.statusText.isNullOrBlank()) {
                                updateStreamingResponse(
                                    streamId, sanitizeStreamingText(builder.toString()), event.statusText
                                )
                                delay(TOOL_STATUS_MIN_DWELL_MS)
                            }

                        is AgenticEvent.ToolResult ->
                            if (!event.statusText.isNullOrBlank()) {
                                updateStreamingResponse(
                                    streamId, sanitizeStreamingText(builder.toString()), event.statusText
                                )
                                delay(TOOL_STATUS_MIN_DWELL_MS)
                            }

                        is AgenticEvent.TextDelta -> {
                            builder.append(event.delta)
                            // Text is flowing; clear any transient tool status.
                            updateStreamingResponse(
                                streamId, sanitizeStreamingText(builder.toString()), null
                            )
                        }

                        is AgenticEvent.Metadata -> {
                            finalized = true
                            // metadata carries a TextPromptResponse — the same shape #27 returns —
                            // so finalize through the shared synchronous path and inherit its
                            // analytics, TTS gating and follow-up handling for free. It replaces
                            // the streaming bubble IN PLACE (see handleTextPromptResult), which is
                            // what makes a mid-stream `surface` and the terminal
                            // `metadata.alignments` one message rather than two.
                            handleTextPromptResult(
                                ApiResult.Success(event.response),
                                placeholderId,
                                reuseId = streamId,
                                // Without this the rebuilt message loses `isAgentic` and the
                                // answer renders the legacy (non-agentic) action row.
                                isAgentic = true
                            )
                        }

                        // Fallback terminal: remember it, let a following `metadata` win.
                        is AgenticEvent.Done -> pendingDone = event

                        // Don't discard a completed `done`: if it arrived before the failure the
                        // answer is still finalized from it.
                        is AgenticEvent.Failure -> finalizeStreamOrFail(event.kind)
                    }
                }
                // Clean EOF with no terminal metadata: no transport error was observed.
                finalizeStreamOrFail()
            } catch (e: kotlinx.coroutines.CancellationException) {
                // Screen left / scope cancelled: propagate, don't write a stale error card.
                throw e
            } catch (e: Exception) {
                finalizeStreamOrFail(StreamErrorKind.NETWORK)
            }
        }
    }

    /**
     * The farmer tapped an alignment chip. 1:1 port of the app's `sendAlignmentChip`
     * (`ui/chat/ChatViewModel.kt:1015`), the last of the app's 18 `ChatAction`s to be ported.
     *
     * It does four things the plain follow-up path cannot:
     *  1. resolves `parent_message_id` from the SOURCE message's SERVER
     *     [ChatMessage.AiResponse.messageId] — `sourceMessageId` is the local list id, and sending
     *     that would correlate the answer to nothing;
     *  2. appends the pick (by VALUE) to that surface's `alignmentSelectedValues`, so the tapped
     *     chip highlights and locks while the others fade back;
     *  3. echoes a user bubble with `displayLabel ?: query`, so the tap reads like a typed turn;
     *  4. sends with `triggered_input_type = "align_chip_sel"` plus `location_declined` /
     *     `photo_declined` when the chip was a capability decline.
     *
     * Analytics: `isAlignmentChip = true` plus `agenticChipType/Value/Label` from the action and
     * `agenticChipStatus = "selected"`, matching the app's
     * `buildMinimalSendQueryProps(...).copy(...)` at `ChatViewModel.kt:1105`. `click_type` becomes
     * `align_chip_sel`, mirroring the request's `triggered_input_type` on the same tap.
     */
    private fun sendAlignmentChip(action: ChatAction.SendAlignmentChip) {
        if (action.query.isBlank()) return
        if (_state.value.isLoading) return
        clearAudioPlayback()
        // The response that showed the chips: its SERVER message_id is the parent_message_id.
        val parentMessageId = (_state.value.messages
            .firstOrNull { it.id == action.sourceMessageId } as? ChatMessage.AiResponse)
            ?.messageId
        val placeholderId = UUID.randomUUID().toString()
        _state.update { current ->
            val marked = current.messages.map { m ->
                if (m.id == action.sourceMessageId && m is ChatMessage.AiResponse &&
                    !m.alignmentSelectedValues.contains(action.selectionValue)
                ) {
                    m.copy(
                        alignmentSelectedValues =
                            m.alignmentSelectedValues + action.selectionValue
                    )
                } else {
                    m
                }
            }
            current.copy(
                messages = marked +
                    ChatMessage.UserMessage(action.displayLabel ?: action.query) +
                    ChatMessage.LoadingPlaceholder(id = placeholderId),
                isLoading = true,
                errorMessage = null,
                failedMessageId = null,
                chatResponseState = UiState.Loading,
                suggestedQuestions = null
            )
        }
        rememberForRetry(
            action.query, InputType.TEXT, null, null, ALIGN_CHIP_SEL, false, null, null
        )
        pendingSendQueryProperties = SendQueryProperties(
            screenName = AnalyticsScreens.CHAT,
            isFollowupPrompt = true,
            isImageQuery = false,
            isTextQuery = true,
            isVoiceQuery = false,
            lengthOfTextQuery = action.query.length,
            isAlignmentChip = true,
            agenticChipType = action.chipType,
            agenticChipValue = action.chipValue,
            agenticChipLabel = action.chipLabel,
            agenticChipStatus = AnalyticsProps.CHIP_STATUS_SELECTED
        )
        pendingSendQueryProperties?.let {
            analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED, it.toAnalyticsProperties())
        }
        fetchTextPromptResponse(
            action.query,
            InputType.TEXT,
            placeholderId,
            triggeredInputTypeOverride = ALIGN_CHIP_SEL,
            parentMessageId = parentMessageId,
            locationDeclined = action.locationDeclined,
            photoDeclined = action.photoDeclined
        )
    }

    /**
     * The GPS_PROMPT "Share my location" chip succeeded: show the resolved address as a
     * `LocationMessage` bubble and re-send the surface's original query.
     *
     * Port of the app's `sendLocationSharedQuery`. The location bubble takes the place of the user
     * text bubble a normal send would add — the farmer never typed anything, they shared a
     * location — and a blank address yields no bubble at all, matching the app.
     *
     * `parent_message_id` and the `agentic_chip_*` analytics are both sent as of 2026-09-03, so
     * this path is now full app parity: the app reports a SUCCESSFUL "share my location" as a chip
     * pick (`ChatViewModel.kt:1105`) so it carries the same funnel fields as every other chip tap,
     * which the location path would otherwise bypass entirely.
     */
    private fun sendLocationSharedQuery(sourceMessageId: String, address: String) {
        if (_state.value.isLoading) return
        val source = _state.value.messages
            .firstOrNull { it.id == sourceMessageId } as? ChatMessage.AiResponse
        // No original query means nothing to ask — bail before mutating state (defensive; the
        // gps-prompt contract always carries original_query).
        val query = source?.alignmentOriginalQuery?.takeIf { it.isNotBlank() } ?: return
        clearAudioPlayback()
        val placeholderId = UUID.randomUUID().toString()
        _state.update { current ->
            // Mark share_precise_location as picked so the source chip locks/highlights exactly as
            // a plain chip tap would (recordAlignmentPick cannot do it — the chip's text is never
            // sent as the question, so there is nothing for it to match on).
            val marked = current.messages.map { m ->
                if (m.id == sourceMessageId && m is ChatMessage.AiResponse &&
                    !m.alignmentSelectedValues.contains(AlignmentChip.VALUE_SHARE_LOCATION)
                ) {
                    m.copy(
                        alignmentSelectedValues =
                            m.alignmentSelectedValues + AlignmentChip.VALUE_SHARE_LOCATION
                    )
                } else {
                    m
                }
            }
            val additions = buildList<ChatMessage> {
                if (address.isNotBlank()) add(ChatMessage.LocationMessage(address = address))
                add(ChatMessage.LoadingPlaceholder(id = placeholderId))
            }
            current.copy(
                messages = marked + additions,
                isLoading = true,
                errorMessage = null,
                failedMessageId = null,
                chatResponseState = UiState.Loading,
                suggestedQuestions = null
            )
        }
        rememberForRetry(query, InputType.TEXT, null, null, ALIGN_CHIP_SEL, false, null, null)
        pendingSendQueryProperties = SendQueryProperties(
            screenName = AnalyticsScreens.CHAT,
            isFollowupPrompt = true,
            isImageQuery = false,
            isTextQuery = true,
            isVoiceQuery = false,
            lengthOfTextQuery = query.length,
            isAlignmentChip = true,
            agenticChipType = org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
                .GPS_PROMPT.analyticsType,
            agenticChipValue = AlignmentChip.VALUE_SHARE_LOCATION,
            agenticChipLabel = labelManager.getLabel(Labels.SHARE_LOCATION, "Share my location"),
            agenticChipStatus = AnalyticsProps.CHIP_STATUS_SELECTED
        )
        pendingSendQueryProperties?.let {
            analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED, it.toAnalyticsProperties())
        }
        fetchTextPromptResponse(
            query,
            InputType.TEXT,
            placeholderId,
            triggeredInputTypeOverride = ALIGN_CHIP_SEL,
            // Correlate the answer to the gps-prompt that asked (mirrors sendAlignmentChip).
            parentMessageId = source.messageId
        )
    }

    /**
     * Records a tapped alignment chip on its own message so the surface can render it as picked.
     *
     * Kept in core rather than duplicated per flavour: both Compose and Views dispatch a plain
     * [ChatAction.SendFollowUpQuestion] for a chip tap, so neither needs to know about selection
     * state and both light up from this one place.
     */
    private fun recordAlignmentPick(question: String) {
        if (question.isBlank()) return
        _state.update { st ->
            val idx = st.messages.indexOfLast {
                it is ChatMessage.AiResponse && it.alignmentKind != null
            }
            if (idx < 0) return@update st
            val surface = st.messages[idx] as ChatMessage.AiResponse
            // Only record a match against this surface's own chips — a follow-up the user typed
            // themselves must never mark a chip as chosen.
            val matches = surface.alignmentChips.orEmpty().any { chip ->
                chip.value == question || chip.label == question
            }
            if (!matches || question in surface.alignmentSelectedValues) return@update st
            st.copy(
                messages = st.messages.toMutableList().also {
                    it[idx] = surface.copy(
                        alignmentSelectedValues = surface.alignmentSelectedValues + question
                    )
                }
            )
        }
    }

    /**
     * Strips agentic control tokens that trail the streamed text but are absent from the clean
     * `metadata.response` — e.g. `<<commodities:chickpea>>` and a ```` ```followups ... ``` ````
     * block. Without this the farmer sees raw control tokens appear in the answer as it types.
     * Also cuts a still-streaming, not-yet-terminated token.
     */
    private fun sanitizeStreamingText(raw: String): String = sanitizeAgenticStreamText(raw)

    /** Replaces the loading placeholder / prior streaming bubble with the in-progress answer. */
    private fun updateStreamingResponse(streamId: String, text: String, status: String?) {
        _state.update { st ->
            val streaming = ChatMessage.AiResponse(
                text = text,
                followUpQuestions = emptyList(),
                id = streamId,
                isStreaming = true,
                streamingStatus = status,
                isAgentic = true
            )
            val idx = st.messages.indexOfFirst { it.id == streamId }
            val updated = if (idx >= 0) {
                st.messages.toMutableList().also { it[idx] = streaming }
            } else {
                val base = if (st.messages.lastOrNull() is ChatMessage.LoadingPlaceholder) {
                    st.messages.dropLast(1)
                } else st.messages
                base + streaming
            }
            st.copy(messages = updated, isLoading = true, errorMessage = null, failedMessageId = null)
        }
    }

    /**
     * Settles a streamed answer that finished without a `metadata` event.
     *
     * [surface] is a surface already rendered from an `event: surface`. It MUST be carried onto the
     * settled message: this path builds a fresh [ChatMessage.AiResponse], so anything not passed
     * here is destroyed — and on the live prose capture `done` carries a full answer, so this is
     * the branch a dropped `metadata` lands in with a `commodity-confirm` on screen.
     */
    private fun finalizeAgenticAnswer(
        text: String,
        followUps: List<String>?,
        messageId: String?,
        streamId: String,
        surface: org.digitalgreen.farmerchat.sdk.core.model.Alignment? = null
    ) {
        markFirstQueryAsked()
        val kind = org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
            .fromType(surface?.type)
        _state.update { st ->
            val settled = ChatMessage.AiResponse(
                text = if (kind != null && !kind.isAdditive && text.isBlank()) {
                    surface?.message.orEmpty()
                } else text,
                followUpQuestions = followUps,
                id = streamId,
                messageId = messageId,
                isAgentic = true,
                alignmentKind = kind,
                alignmentChips = surface?.chips,
                alignmentMessage = if (kind?.isAdditive == true) surface?.message else null,
                alignmentOriginalQuery = surface?.effectiveOriginalQuery,
                alignmentBlocking = surface?.blocking == true
            )
            val idx = st.messages.indexOfFirst { it.id == streamId }
            val updated = if (idx >= 0) {
                st.messages.toMutableList().also { it[idx] = settled }
            } else {
                st.messages.filterNot { it is ChatMessage.LoadingPlaceholder } + settled
            }
            st.copy(
                messages = updated,
                isLoading = false,
                errorMessage = null,
                failedMessageId = null,
                chatResponseState = UiState.Success(text),
                suggestedQuestions = followUps,
                suggestedQuestionIds = null
            )
        }
    }

    /**
     * Farmer-facing copy for an `event: status` ping.
     *
     * [AgenticEvent.Status.stage] is deliberately NOT mapped: it is a backend machine token
     * (`"thinking"` is the only value observed live) and endpoint #3 serves no per-stage label
     * keys, so mapping it would mean inventing copy or showing the raw token — both barred by
     * CLAUDE.md §2. The ping's value is that it exists at all: it turns the loading placeholder
     * into a live bubble before the first delta. The stage is carried on the event, ready to map
     * the moment real label keys exist.
     */
    private fun streamingStatusLabel(): String =
        labelManager.getLabel(Labels.GETTING_YOUR_ANSWER, "Getting your answer…")

    /**
     * Renders an alignment surface that arrived MID-STREAM onto the stream's own bubble, so it is
     * one message that `metadata` later replaces in place rather than a second copy.
     *
     * A BLOCKING surface settles at once — the backend is waiting on the farmer, and while
     * `state.isLoading` stays true the flavours keep every chip disabled, so leaving it loading
     * would render the question and refuse the taps. An ADDITIVE nudge attaches to the still
     * streaming answer and unlocks when the stream finalizes.
     */
    private fun applyStreamSurface(
        streamId: String,
        surface: org.digitalgreen.farmerchat.sdk.core.model.Alignment,
        streamedText: String,
        /**
         * Force the settled state regardless of [Alignment.blocking]. Passed by
         * [settleStreamSurface]: the stream is over, so a NON-blocking additive surface must lose
         * `isStreaming` too — left true it is a bubble stuck in the streaming state forever, with
         * no action row and a stall hint that fires on a timer and never clears.
         */
        settle: Boolean = false
    ) {
        val kind = org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
            .fromType(surface.type) ?: return
        val settleNow = settle || surface.blocking == true || !kind.isAdditive
        _state.update { st ->
            val existing = st.messages.firstOrNull { it.id == streamId } as? ChatMessage.AiResponse
            val text = when {
                // Exclusive surface: its prompt IS the message (the answer is empty on purpose).
                !kind.isAdditive -> streamedText.ifBlank { surface.message.orEmpty() }
                // Additive: keep the real answer, the nudge goes in alignmentMessage.
                else -> streamedText
            }
            val updated = ChatMessage.AiResponse(
                text = text,
                followUpQuestions = existing?.followUpQuestions ?: emptyList(),
                id = streamId,
                messageId = existing?.messageId,
                isStreaming = !settleNow,
                streamingStatus = null,
                isAgentic = true,
                alignmentKind = kind,
                alignmentChips = surface.chips,
                alignmentMessage = if (kind.isAdditive) surface.message else null,
                alignmentSelectedValues = existing?.alignmentSelectedValues.orEmpty(),
                alignmentOriginalQuery = surface.effectiveOriginalQuery,
                alignmentBlocking = surface.blocking == true
            )
            val idx = st.messages.indexOfFirst { it.id == streamId }
            val messages = if (idx >= 0) {
                st.messages.toMutableList().also { it[idx] = updated }
            } else {
                st.messages.filterNot { it is ChatMessage.LoadingPlaceholder } + updated
            }
            st.copy(
                messages = messages,
                isLoading = !settleNow,
                errorMessage = null,
                failedMessageId = null
            )
        }
    }

    /**
     * Settles a surface rendered from `event: surface` when no `metadata` ever arrived. The surface
     * is a real question, so it must NOT become an error card — it is the only thing that lets the
     * conversation continue.
     */
    private fun settleStreamSurface(
        streamId: String,
        surface: org.digitalgreen.farmerchat.sdk.core.model.Alignment
    ) {
        markFirstQueryAsked()
        val existing = _state.value.messages
            .firstOrNull { it.id == streamId } as? ChatMessage.AiResponse
        applyStreamSurface(streamId, surface, existing?.text.orEmpty(), settle = true)
        _state.update {
            it.copy(
                isLoading = false,
                chatResponseState = UiState.Success(surface.message.orEmpty())
            )
        }
    }

    /** Settles a stream that ended early; [text] may hold a preserved partial answer. */
    private fun interruptAgentic(streamId: String, text: String, kind: StreamErrorKind) {
        _state.update { st ->
            val settled = ChatMessage.AiResponse(
                text = text,
                id = streamId,
                isAgentic = true,
                isInterrupted = true,
                streamErrorKind = kind
            )
            val idx = st.messages.indexOfFirst { it.id == streamId }
            val updated = if (idx >= 0) {
                st.messages.toMutableList().also { it[idx] = settled }
            } else {
                st.messages.filterNot { it is ChatMessage.LoadingPlaceholder } + settled
            }
            st.copy(
                messages = updated,
                isLoading = false,
                // Deliberately NOT setting errorMessage: the interrupted message carries its own
                // StreamErrorCard with kind-specific copy and the retry action. Setting both made
                // the UI show two error messages and two "Try again" buttons.
                errorMessage = null
            )
        }
    }

    private fun handleTextPromptResult(
        result: ApiResult<org.digitalgreen.farmerchat.sdk.core.model.TextPromptResponse>,
        placeholderId: String?,
        /**
         * Id to give the settled answer. The synchronous path passes null and gets a fresh UUID.
         * The agentic path passes its stream id, because the UI's reveal-once set is keyed on the
         * message id: a fresh id is absent from that set, so the typewriter would replay over
         * text the farmer just watched stream in.
         */
        reuseId: String? = null,
        /**
         * True when the agentic stream (#27a) is finalizing through this shared path.
         *
         * This function REBUILDS the settled [ChatMessage.AiResponse] from the response, so every
         * flag not passed here is destroyed. `isAgentic` was one of them: a streamed answer that
         * ended with a `metadata` event — the normal prose case — reached the UI with the flag
         * cleared, and the answer then rendered the LEGACY action row (Share + Save + Listen, no
         * accuracy note) instead of the app's agentic row (note above Share + Listen, no Save).
         * See ChatResponseActions.kt:85 in fc-compose-agentic.
         */
        isAgentic: Boolean = false
    ) {
        when (result) {
            is ApiResult.Success -> {
                val data = result.data
                val alignmentKind = org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
                    .fromType(data.alignments?.type)
                // An EXCLUSIVE alignment surface arrives with an empty `response` on purpose: its
                // prompt IS the message. Fall back to alignments.message so it is not mistaken for
                // an empty answer and turned into an error.
                val answerText = (data.response ?: data.translated_response ?: data.message)
                    ?.let { if (isAgentic) sanitizeAgenticFinalText(it) else it }
                    ?.takeIf { it.isNotBlank() }
                    ?: (if (alignmentKind != null && !alignmentKind.isAdditive) {
                        data.alignments?.message.orEmpty()
                    } else "")
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
                val aiId = reuseId ?: UUID.randomUUID().toString()
                _state.update { current ->
                    val settled = buildSettledAiResponse(
                        data = data,
                        answerText = answerText,
                        aiId = aiId,
                        alignmentKind = alignmentKind,
                        isAgentic = isAgentic
                    )
                    // Replace in place when the id already exists — the agentic path passes its
                    // stream id, so a bubble that streamed (or already rendered a mid-stream
                    // `surface`) becomes the settled answer where it sits. Removing and appending
                    // instead re-ordered it behind anything added meanwhile and duplicated a
                    // surface the farmer had already answered.
                    val idx = current.messages.indexOfFirst { it.id == aiId }
                    val messages = if (idx >= 0) {
                        current.messages.toMutableList().also { it[idx] = settled }
                    } else {
                        current.messages.filterNot { it.id == placeholderId } + settled
                    }
                    current.copy(
                        messages = messages,
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
                                        messageId = data.message_id,
                                        // Photo answers come from the synchronous image endpoint,
                                        // but wear the same agentic action row as every other
                                        // answer when the agentic UI is on (product request;
                                        // the app keeps its legacy row here).
                                        isAgentic = agenticUi
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
                                    messageId = item.message_id,
                                    // History has no per-message agentic flag: mirror the current
                                    // UI, as the app does (ChatViewModel.kt:1343-1357).
                                    isAgentic = agenticUi
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
                            analytics.track(
                        AnalyticsEvents.STARTED_PLAYING_RESPONSE_AUDIO,
                        // App ChatScreen.kt:1306.
                        mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.CHAT)
                    )
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

/**
 * Builds the settled answer for a #27 reply, or for the `metadata` event that terminates a #27a
 * stream.
 *
 * Extracted from [handleTextPromptResult] and `internal` so the flags it must carry are pinned by
 * [org.digitalgreen.farmerchat.sdk.core.ui.chat.SettledAiResponseTest] rather than by review. This
 * builder REPLACES the streaming message wholesale, so any field it forgets is destroyed — which
 * is exactly how `isAgentic` was lost, silently downgrading every streamed answer's footer to the
 * legacy Share/Save/Listen row. Add a field to `AiResponse` that the agentic path depends on, and
 * it must be threaded through here too.
 */
internal fun buildSettledAiResponse(
    data: org.digitalgreen.farmerchat.sdk.core.model.TextPromptResponse,
    answerText: String,
    aiId: String,
    alignmentKind: org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind?,
    isAgentic: Boolean
): ChatMessage.AiResponse = ChatMessage.AiResponse(
    text = answerText,
    id = aiId,
    messageId = data.message_id,
    isAgentic = isAgentic,
    // 2.0.0: an alignment surface asks the user to clarify/confirm instead of (or alongside)
    // answering. Exclusive surfaces replace the answer, additive ones sit below it — see
    // AlignmentKind.
    alignmentKind = alignmentKind,
    alignmentChips = data.alignments?.chips,
    alignmentMessage = if (alignmentKind?.isAdditive == true) data.alignments?.message else null,
    // The live payload carries the triggering query at BOTH the top level and inside `context`;
    // taking only the former loses it on a surface that fills in just `context`, and with it the
    // capability re-send.
    alignmentOriginalQuery = data.alignments?.effectiveOriginalQuery,
    alignmentBlocking = data.alignments?.blocking == true
)

/**
 * `triggered_input_type` for a query entering chat from somewhere other than the composer.
 *
 * The ORDER is the contract, not just the values — a query can satisfy several of these at once
 * (a push that is also a weather CTA), and the app resolves ties by this exact precedence
 * (fc-compose-agentic `ChatViewModel.kt:235`). Extracted so the ordering is pinned by
 * [org.digitalgreen.farmerchat.sdk.core.ui.chat.TriggeredInputTypeTest] rather than by review.
 *
 * `contentCardTriggerType` sits LAST before the fallthrough: every other entry point outranks a
 * Home content-card tap.
 */
internal fun resolveTriggeredInputType(action: ChatAction.InitializeWithQuestion): String? = when {
    action.isPush -> "push"
    action.isInApp -> "in-app"
    action.isWeatherAdviceCTA -> "weather"
    action.isSSFR -> "ssfr"
    !action.channel.isNullOrBlank() -> action.channel
    !action.contentCardTriggerType.isNullOrBlank() -> action.contentCardTriggerType
    else -> null
}
