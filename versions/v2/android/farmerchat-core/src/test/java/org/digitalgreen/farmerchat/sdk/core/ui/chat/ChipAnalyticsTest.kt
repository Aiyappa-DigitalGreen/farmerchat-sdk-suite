package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.SendQueryProperties
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentChip
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Covers `agentic_chip_status` for the four outcomes (app fc-compose-agentic ChatViewModel.kt:110-177,
 * AnalyticsProps.kt:61-67, SendQueryAnalytics.kt:122-139). The constants for `available` and
 * `skipped` existed in the SDK before this port, but nothing ever set them.
 */
internal class ChipAnalyticsTest {

    private fun typed() = SendQueryProperties(
        screenName = AnalyticsScreens.CHAT,
        isFollowupPrompt = false,
        isImageQuery = false,
        isTextQuery = true,
        isVoiceQuery = false,
        lengthOfTextQuery = 5
    )

    private fun surface(kind: AlignmentKind, picked: List<String> = emptyList(), chips: Int = 2) =
        ChatMessage.AiResponse(
            text = "Which stage?",
            id = "ai-1",
            alignmentKind = kind,
            alignmentChips = List(chips) { AlignmentChip(label = "c$it", value = "v$it") },
            alignmentSelectedValues = picked
        )

    private fun props(p: SendQueryProperties) = p.toAnalyticsProperties()

    @Test
    fun `a manual send past unpicked chips is skipped, with the skipped kind`() {
        val ctx = manualSendChipContext(listOf(ChatMessage.UserMessage("q"), surface(AlignmentKind.CLARIFY)))
        val p = props(typed().withManualChipContext(ctx))
        assertEquals("skipped", p[AnalyticsProps.AGENTIC_CHIP_STATUS])
        assertEquals(AlignmentKind.CLARIFY.analyticsType, p[AnalyticsProps.AGENTIC_CHIP_SKIPPED_TYPE])
        assertEquals("", p[AnalyticsProps.AGENTIC_CHIP_SHOWN_TYPE])
        assertEquals("text", p[AnalyticsProps.CLICK_TYPE])
    }

    @Test
    fun `no surface, a picked surface, or a surface without chips is none`() {
        listOf(
            listOf(ChatMessage.AiResponse(text = "answer", id = "a")),
            listOf(surface(AlignmentKind.CLARIFY, picked = listOf("v0"))),
            listOf(surface(AlignmentKind.CLARIFY, chips = 0)),
            emptyList()
        ).forEach { thread ->
            val p = props(typed().withManualChipContext(manualSendChipContext(thread)))
            assertEquals("none", p[AnalyticsProps.AGENTIC_CHIP_STATUS])
            assertEquals("", p[AnalyticsProps.AGENTIC_CHIP_SKIPPED_TYPE])
        }
    }

    @Test
    fun `a response with chips makes a none query available, with the shown kind`() {
        val p = props(
            typed().withManualChipContext(manualSendChipContext(emptyList()))
                .withResponseChipStatus(AlignmentKind.UPLOAD_PHOTO.analyticsType)
        )
        assertEquals("available", p[AnalyticsProps.AGENTIC_CHIP_STATUS])
        assertEquals(AlignmentKind.UPLOAD_PHOTO.analyticsType, p[AnalyticsProps.AGENTIC_CHIP_SHOWN_TYPE])
    }

    @Test
    fun `a selected or skipped query stays as it was when the response shows chips`() {
        val skipped = typed().withManualChipContext(
            manualSendChipContext(listOf(surface(AlignmentKind.CONFIRM)))
        ).withResponseChipStatus(AlignmentKind.CLARIFY.analyticsType)
        assertEquals("skipped", props(skipped)[AnalyticsProps.AGENTIC_CHIP_STATUS])
        assertEquals("", props(skipped)[AnalyticsProps.AGENTIC_CHIP_SHOWN_TYPE])

        val chipTap = typed().copy(isAlignmentChip = true, agenticChipStatus = AnalyticsProps.CHIP_STATUS_SELECTED)
            .withResponseChipStatus(AlignmentKind.CLARIFY.analyticsType)
        assertEquals("selected", props(chipTap)[AnalyticsProps.AGENTIC_CHIP_STATUS])
    }

    @Test
    fun `a chip photo is a selected upload-photo pick`() {
        val p = props(
            photoChipSendProperties(10, AlignmentChip.VALUE_TAKE_PHOTO, "Take a photo")
                .withResponseChipStatus(null)
        )
        assertEquals("selected", p[AnalyticsProps.AGENTIC_CHIP_STATUS])
        assertEquals("align_chip_sel", p[AnalyticsProps.CLICK_TYPE])
        assertEquals(AlignmentKind.UPLOAD_PHOTO.analyticsType, p[AnalyticsProps.AGENTIC_CHIP_TYPE])
        assertEquals(AlignmentChip.VALUE_TAKE_PHOTO, p[AnalyticsProps.AGENTIC_CHIP_VALUE])
    }

    /**
     * App quirk, kept on purpose: the photo-chip props carry no explicit status (app
     * ChatScreen.kt:437-453), so `withResponseChipStatus` upgrades them to `available` when the
     * photo's own answer presents chips, exactly as the app does.
     */
    @Test
    fun `a chip photo whose answer presents chips becomes available, as in the app`() {
        val p = props(
            photoChipSendProperties(10, AlignmentChip.VALUE_TAKE_PHOTO, "Take a photo")
                .withResponseChipStatus(AlignmentKind.CLARIFY.analyticsType)
        )
        assertEquals("available", p[AnalyticsProps.AGENTIC_CHIP_STATUS])
        assertEquals("align_chip_sel", p[AnalyticsProps.CLICK_TYPE])
    }

    @Test
    fun `no chips in the response leaves none`() {
        val p = props(typed().withResponseChipStatus(null))
        assertEquals("none", p[AnalyticsProps.AGENTIC_CHIP_STATUS])
        assertEquals("", p[AnalyticsProps.AGENTIC_CHIP_SHOWN_TYPE])
    }

    @Test
    fun `a follow-up chip tap is a follow-up prompt with no chip context`() {
        val p = props(followUpChipSendProperties("How high should the ridges be?"))
        assertEquals("follow-up", p[AnalyticsProps.CLICK_TYPE])
        assertEquals(true, p[AnalyticsProps.FOLLOWUP_PROMPT])
        assertEquals("none", p[AnalyticsProps.AGENTIC_CHIP_STATUS])
    }
}
