package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.SendQueryProperties

/**
 * `agentic_chip_status` for the four outcomes, ported from fc-compose-agentic
 * `ChatViewModel.kt:110-177` and `AnalyticsProps.kt:61-67`.
 *
 * - `selected`: a chip tap. The chip paths stamp this themselves; `isAlignmentChip` also derives it.
 * - `skipped` + `agentic_chip_skipped_type`: a MANUAL send (typed, voice or image) while the
 *   latest answer is a surface whose chips are still unpicked ([manualSendChipContext]).
 * - `available` + `agentic_chip_shown_type`: on Send_Query only, when this query's RESPONSE
 *   presents chips and the query itself was not a chip reaction ([withResponseChipStatus]).
 * - `none`: everything else.
 */
internal data class ManualChipContext(val status: String, val skippedType: String?)

/**
 * App `manualSendChipContext()` (ChatViewModel.kt:148-158). Call it on the thread as it was just
 * before the send. Only the latest AI response matters, so a user bubble appended first does not
 * change the result.
 */
internal fun manualSendChipContext(messages: List<ChatMessage>): ManualChipContext {
    val lastAi = messages.filterIsInstance<ChatMessage.AiResponse>().lastOrNull()
    val kind = lastAi?.alignmentKind
    val chipsShownUnselected = kind != null &&
        !lastAi.alignmentChips.isNullOrEmpty() &&
        lastAi.alignmentSelectedValues.isEmpty()
    return if (chipsShownUnselected) {
        ManualChipContext(AnalyticsProps.CHIP_STATUS_SKIPPED, kind!!.analyticsType)
    } else {
        ManualChipContext(AnalyticsProps.CHIP_STATUS_NONE, null)
    }
}

/** Stamps [context] onto manual-send props (app `buildMinimalSendQueryProps`, :115-133). */
internal fun SendQueryProperties.withManualChipContext(context: ManualChipContext): SendQueryProperties =
    copy(agenticChipStatus = context.status, agenticChipSkippedType = context.skippedType)

/**
 * App `withResponseChipStatus` (ChatViewModel.kt:171-177), for Send_Query only. Pass the
 * response surface's `analyticsType` when it really carries chips, else null. A `selected` or
 * `skipped` status is left untouched.
 */
internal fun SendQueryProperties.withResponseChipStatus(shownChipType: String?): SendQueryProperties =
    if (shownChipType != null &&
        (agenticChipStatus == null || agenticChipStatus == AnalyticsProps.CHIP_STATUS_NONE)
    ) {
        copy(agenticChipStatus = AnalyticsProps.CHIP_STATUS_AVAILABLE, agenticChipShownType = shownChipType)
    } else {
        this
    }

/**
 * Props for a follow-up chip tap ("You can also ask"), app `handleFollowUp` (ChatScreen.kt:958-972):
 * a follow-up prompt (click_type "follow-up", triggered_input_type "follow_up") with NO chip
 * context. The flavours pass it on [ChatAction.SendFollowUpQuestion]; without it the send is
 * treated as typed by hand.
 */
fun followUpChipSendProperties(question: String): SendQueryProperties = SendQueryProperties(
    screenName = org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens.CHAT,
    isFollowupPrompt = true,
    isImageQuery = false,
    isTextQuery = true,
    isVoiceQuery = false,
    lengthOfTextQuery = question.length,
    audioFormat = ""
)
