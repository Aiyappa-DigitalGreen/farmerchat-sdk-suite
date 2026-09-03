import Foundation

/// Label keys for the 2.0.0 agentic streaming surfaces, with their English fallbacks.
///
/// **Why these look different from the short keys used elsewhere in the iOS SDK.** The server's
/// label keys are namespaced `fc_v2_app_label_*` (see `Labels.kt` in the Android SDK, which is
/// generated from the app). The iOS v1 call sites pass short keys ("try_again",
/// "getting_your_answer", …) which therefore never match a server label and always fall back to
/// English — a pre-existing defect tracked outside this change. New 2.0.0 strings use the real
/// server keys, verified character-for-character against `Labels.kt`, so at least these localize.
/// Existing v1 keys are deliberately left untouched.
public enum AgenticLabels {
    // Streaming progress
    public static let gettingYourAnswer = "fc_v2_app_label_getting_your_answer"
    public static let gettingYourAnswerFallback = "Getting your answer…"
    public static let responsePausedResuming = "fc_v2_app_label_response_paused_resuming"
    public static let responsePausedResumingFallback = "Paused, resuming…"

    // Stream failure
    public static let connectionStoppedPartialSaved = "fc_v2_app_label_connection_stopped_partial_saved"
    public static let connectionStoppedPartialSavedFallback = "Connection stopped. Your partial answer is saved."
    public static let noInternetConnection = "fc_v2_app_label_no_internet_connection"
    public static let noInternetConnectionFallback = "No internet connection"
    public static let somethingWentWrong = "fc_v2_app_label_something_went_wrong"
    public static let somethingWentWrongFallback = "Something went wrong"
    public static let tryAgain = "fc_v2_app_label_try_again"
    public static let tryAgainFallback = "Try again"
    public static let failedToGetResponse = "fc_v2_app_label_failed_to_get_response"
    public static let failedToGetResponseFallback = "Failed to get response"

    // Alignment surfaces
    public static let shareLocationTitle = "fc_v2_app_label_share_location_title"
    public static let shareLocationTitleFallback = "Share location"
    public static let addOneClearPhoto = "fc_v2_app_label_add_one_clear_photo"
    public static let addOneClearPhotoFallback = "Add one clear photo"
    public static let pleaseConfirm = "fc_v2_app_label_please_confirm"
    public static let pleaseConfirmFallback = "Please Confirm"
    public static let chooseOne = "fc_v2_app_label_choose_one"
    public static let chooseOneFallback = "Choose one"
    public static let dontSeeYourOption = "fc_v2_app_label_dont_see_your_option"
    public static let dontSeeYourOptionFallback = "Don't see your option?"
    public static let typeOrSayIt = "fc_v2_app_label_type_or_say_it"
    public static let typeOrSayItFallback = "Type or say it."

    // Capability chips (2.0.0)

    /// Sent as the query when the farmer declines / cancels the GPS_PROMPT surface, so the
    /// blocking question still resolves. Verified present on endpoint #3 (live stage probe,
    /// 2026-09-02); the English fallback below is kept as the usual safety net.
    public static let locationPermissionDeclined = "fc_v2_app_label_location_permission_declined"
    public static let locationPermissionDeclinedFallback = "Continue without sharing my location"

    /// "Your location:" — the caption above the address on the location chat bubble.
    public static let yourLocation = "fc_v2_app_label_your_location"
    public static let yourLocationFallback = "Your location:"
}
