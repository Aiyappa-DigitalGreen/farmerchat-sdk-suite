package org.digitalgreen.farmerchat.sdk.core.ui.home

import android.content.Context
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.model.AcceptPPandTCResponse
import org.digitalgreen.farmerchat.sdk.core.model.CropResponse
import org.digitalgreen.farmerchat.sdk.core.model.GetVoiceResponse
import org.digitalgreen.farmerchat.sdk.core.model.HomeUdfResponse
import org.digitalgreen.farmerchat.sdk.core.model.ImageStatementResponse
import org.digitalgreen.farmerchat.sdk.core.model.ImageViewedResponse
import org.digitalgreen.farmerchat.sdk.core.model.NewConversationResponse
import org.digitalgreen.farmerchat.sdk.core.model.PolicyAcceptanceStatusResponse
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

    /**
     * 2.0.0: accept the terms of use from `TermsOfUseDialog`. Calls endpoint #7
     * (`accept_terms`) — best-effort, matching the app: acceptance is recorded but never blocks.
     */
    data class AcceptTerms(val userId: String) : HomeAction()

    /**
     * 2.0.0: checks whether the user must (re-)accept the Terms of Use (#7a); drives the
     * blocking `TermsOfUseUpdatedBottomSheet` on Home. Dispatched on every Home entry.
     * 1:1 port of the app's `HomeAction.FetchPolicyAcceptanceStatus` (`HomeAction.kt:66`).
     */
    data class FetchPolicyAcceptanceStatus(
        val userId: String
    ) : HomeAction()

    /** 2.0.0: fetch the legal links (#4) so `TermsOfUseDialog` can link out. */
    object FetchPrivacyPolicy : HomeAction()

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
    val dismissedCardIds: Set<String> = emptySet(),
    /** 2.0.0: terms-of-use URL from #4, for `TermsOfUseDialog`. */
    val farmerchatTermsOfUse: String? = null,

    /**
     * 2.0.0: mandatory Terms-of-Use acceptance gate (#7a); drives
     * `TermsOfUseUpdatedBottomSheet` on Home while `requires_acceptance == true`.
     */
    val policyAcceptanceState: UiState<PolicyAcceptanceStatusResponse> = UiState.Idle,
    /** 2.0.0: in-flight/terminal state of the paired #7 `accept_terms` call. */
    val acceptTermsState: UiState<AcceptPPandTCResponse> = UiState.Idle
)

/**
 * Whether the mandatory Terms-of-Use gate must be on screen (SDK 2.0.0, endpoint #7a).
 *
 * Verbatim port of the app's inline condition (`HomeScreen.kt:1821-1823`):
 * `requires_acceptance == true && acceptTermsState !is UiState.Success`. Extracted to core so
 * the two Android UI flavours cannot drift on it — the app only has one UI, the SDK has two.
 *
 * Note what makes this dangerous to get wrong: the sheet it raises is non-cancellable, so if
 * [HomeViewModel] ever stopped writing [HomeState.acceptTermsState] this would never go false
 * and Home would be permanently blocked.
 */
fun HomeState.requiresTermsAcceptance(): Boolean {
    val policy = (policyAcceptanceState as? UiState.Success)?.data ?: return false
    return policy.requires_acceptance && acceptTermsState !is UiState.Success
}

/**
 * The URL the gate's "Read terms" content screen loads: `latest_policy_version
 * .terms_of_service_url` from **#7a**.
 *
 * Deliberately NOT [HomeState.farmerchatTermsOfUse], which comes from #4 and feeds the *other*,
 * dismissible terms dialog. Doc 02 §Endpoint #7a records that the two are independent.
 */
fun HomeState.latestTermsOfServiceUrl(): String? =
    (policyAcceptanceState as? UiState.Success)?.data?.latest_policy_version?.terms_of_service_url
