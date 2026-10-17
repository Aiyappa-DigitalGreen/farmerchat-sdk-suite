package org.digitalgreen.farmerchat.sdk.core.analytics

import org.digitalgreen.farmerchat.sdk.FarmerChatHooks
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * `onMessageSent(text)` / `onAnswerReceived(messageId)` carry the real values (docs/07 C4).
 * Found in the 2026-10-17 scenario pass: both were derived from Send_Query_Initiated / Send_Query,
 * whose payloads hold neither the question text nor a message id, so every host got "". Send_Query
 * also fires for failed answers, so `onAnswerReceived` fired on errors too.
 */
internal class SemanticHooksTest {

    private val sent = mutableListOf<String>()
    private val answered = mutableListOf<String>()
    private val hooks = FarmerChatHooks(
        onChatOpened = null,
        onMessageSent = { sent += it },
        onAnswerReceived = { answered += it },
        onScreenView = null,
        onError = null,
        onSessionStart = null
    )

    @Test
    fun `the chat's direct calls carry the question and the message id`() {
        val analytics = FarmerChatAnalytics(hooks = hooks)
        analytics.messageSent("How do I control aphids?")
        analytics.answerReceived("2ab8c324-3651-4e79-8c12-a58b308cdeb0")
        assertEquals(listOf("How do I control aphids?"), sent)
        assertEquals(listOf("2ab8c324-3651-4e79-8c12-a58b308cdeb0"), answered)
    }

    @Test
    fun `the Send_Query events no longer fire the hooks with blank values`() {
        val analytics = FarmerChatAnalytics(hooks = hooks)
        analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED, mapOf(AnalyticsProps.TEXT_QUERY to true))
        analytics.track(AnalyticsEvents.SEND_QUERY, mapOf(AnalyticsProps.VALID_QUERY to false))
        assertEquals(emptyList<String>(), sent)
        assertEquals(emptyList<String>(), answered)
    }

    @Test
    fun `the hooks fire with analytics disabled, as product callbacks`() {
        val analytics = FarmerChatAnalytics(hooks = hooks) // enabled defaults to false
        analytics.messageSent("q")
        assertEquals(listOf("q"), sent)
    }
}
