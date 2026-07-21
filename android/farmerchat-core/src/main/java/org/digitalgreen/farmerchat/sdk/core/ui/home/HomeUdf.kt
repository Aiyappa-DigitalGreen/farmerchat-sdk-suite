package org.digitalgreen.farmerchat.sdk.core.ui.home

import android.content.Context
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.model.CropResponse
import org.digitalgreen.farmerchat.sdk.core.model.GetVoiceResponse
import org.digitalgreen.farmerchat.sdk.core.model.HomeUdfResponse
import org.digitalgreen.farmerchat.sdk.core.model.ImageStatementResponse
import org.digitalgreen.farmerchat.sdk.core.model.ImageViewedResponse
import org.digitalgreen.farmerchat.sdk.core.model.NewConversationResponse
import org.digitalgreen.farmerchat.sdk.core.model.WeatherResponse

/** 1:1 port of the app's HomeAction. */
sealed class HomeAction {
    data class LoadHome(
        val context: Context,
        val userDeviceTime: String,
        val userId: String? = null,
        val skipLoadingCheck: Boolean = false
    ) : HomeAction()

    data class LoadWeather(
        val context: Context,
        val userId: String,
        val skipLoadingCheck: Boolean = false
    ) : HomeAction()

    data class FetchUserProfile(
        val context: Context,
        val userId: String
    ) : HomeAction()

    data class UpdateCultivatedCrops(
        val context: Context,
        val userId: String,
        val cropIds: List<String>
    ) : HomeAction()

    data class NewConversation(
        val context: Context,
        val userId: String,
        val contentProviderId: String?
    ) : HomeAction()

    data class TranscribeAudio(
        val context: Context,
        val conversationId: String,
        val query: String,
        val messageReferenceId: String,
        val audioFormat: String,
        val triggeredType: String
    ) : HomeAction()

    data class MarkImageViewed(
        val statementId: String,
        val userId: String
    ) : HomeAction()

    data class FetchImageStatement(
        val statementId: String,
        val triggered_input_type: String
    ) : HomeAction()

    object ClearTranscriptionState : HomeAction()

    object ConsumeResult : HomeAction()

    object SetLoadingState : HomeAction()
}

/** 1:1 port of the app's HomeState. */
data class HomeState(
    val homeFeedState: UiState<HomeUdfResponse> = UiState.Idle,
    val weatherState: UiState<WeatherResponse> = UiState.Idle,
    val cropUpdateState: UiState<CropResponse> = UiState.Idle,
    val newConversationState: UiState<NewConversationResponse> = UiState.Idle,
    val voiceTranscribeState: UiState<GetVoiceResponse> = UiState.Idle,
    val imageViewedState: UiState<ImageViewedResponse> = UiState.Idle,
    val imageStatementState: UiState<ImageStatementResponse> = UiState.Idle,
    val dismissedCardIds: Set<String> = emptySet()
)
