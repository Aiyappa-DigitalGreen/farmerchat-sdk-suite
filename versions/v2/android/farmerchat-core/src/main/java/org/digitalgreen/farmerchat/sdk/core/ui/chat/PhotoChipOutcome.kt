package org.digitalgreen.farmerchat.sdk.core.ui.chat

import android.net.Uri
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.SendQueryProperties
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentChip
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind

/**
 * Outcomes of an `upload-photo` capability chip ("Take a photo" / "Choose from gallery"). This is a
 * port of fc-compose-agentic `ChatScreen.kt:416-483` and `:1621-1636`. Both Android flavours build
 * their actions here, so the two screens and `PhotoChipOutcomeTest` share one definition.
 *
 * The flow:
 * - A chip tap remembers the surface (`sourceMessageId`) and the chip, then opens the camera or
 *   gallery directly. It never goes through the composer.
 * - A photo taken or picked is sent STRAIGHT to the conversation ([photoChipSendAction]) as an
 *   image-only question. It is reported as a chip pick.
 * - No photo sends a default answer to the surface ([photoChipDeclineAction]) with
 *   `photo_declined = true` and the surface's `parent_message_id`, so the blocking question can
 *   continue. "No photo" means the picker or camera was cancelled, no camera app exists, or the
 *   camera permission was denied.
 *   - Cancel or no camera app: label `PHOTO_NOT_SHARED`.
 *   - Permission denied: label `PHOTO_PERMISSION_DECLINED`.
 */

/**
 * The decline answer sent when the farmer produced no photo. App `sendAlignmentPhotoDeclineQuery`
 * (ChatScreen.kt:468-483). The query doubles as the selection value. The analytics chip value is
 * `not_now`.
 */
fun photoChipDeclineAction(sourceMessageId: String, text: String): ChatAction.SendAlignmentChip =
    ChatAction.SendAlignmentChip(
        query = text,
        selectionValue = text,
        sourceMessageId = sourceMessageId,
        photoDeclined = true,
        chipType = AlignmentKind.UPLOAD_PHOTO.analyticsType,
        chipValue = AlignmentChip.VALUE_NOT_NOW,
        chipLabel = text
    )

/**
 * The photo from a chip, sent straight to the conversation. App `sendAlignmentPhotoDirect`
 * (ChatScreen.kt:431-462): a blank question gives an image-only bubble, and the ViewModel supplies
 * the default query for the API. The upload is reported as a chip pick, so it carries the same
 * funnel fields as every other chip tap.
 */
fun photoChipSendAction(
    imageUri: Uri,
    imageSizeKb: Int,
    chipValue: String?,
    chipLabel: String?
): ChatAction.SendQuestionWithImage = ChatAction.SendQuestionWithImage(
    question = "",
    imageUri = imageUri,
    sendQueryProperties = photoChipSendProperties(imageSizeKb, chipValue, chipLabel)
)

/** The send-query funnel fields of a chip photo (app ChatScreen.kt:437-453). */
fun photoChipSendProperties(
    imageSizeKb: Int,
    chipValue: String?,
    chipLabel: String?
): SendQueryProperties = SendQueryProperties(
    screenName = AnalyticsScreens.CHAT,
    isFollowupPrompt = false,
    isImageQuery = true,
    isTextQuery = false,
    isVoiceQuery = false,
    lengthOfTextQuery = 0,
    sizeOfImageKb = imageSizeKb,
    audioFormat = "",
    isAlignmentChip = true,
    agenticChipType = AlignmentKind.UPLOAD_PHOTO.analyticsType,
    agenticChipValue = chipValue,
    agenticChipLabel = chipLabel
)
