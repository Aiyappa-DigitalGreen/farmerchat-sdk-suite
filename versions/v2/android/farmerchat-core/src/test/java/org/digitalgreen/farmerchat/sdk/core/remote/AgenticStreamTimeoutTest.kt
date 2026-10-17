package org.digitalgreen.farmerchat.sdk.core.remote

import com.google.gson.Gson
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import org.digitalgreen.farmerchat.sdk.core.model.AgenticEvent
import org.digitalgreen.farmerchat.sdk.core.model.StreamErrorKind
import org.digitalgreen.farmerchat.sdk.core.model.TextPromptRequest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.ServerSocket
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * A silent agentic stream must not hang forever (app NetworkModule "streamingOkHttp": bounded
 * 60 s read timeout). The SDK used readTimeout(0): a server that sent headers and then nothing
 * left the bubble spinning indefinitely. Found via RN, 2026-10-17.
 */
class AgenticStreamTimeoutTest {

    @Test
    fun `the stream client uses the app's timeouts`() {
        assertEquals(60L, AgenticStreamTimeouts.READ_SECONDS)
        assertEquals(15L, AgenticStreamTimeouts.CONNECT_SECONDS)
        assertEquals(30L, AgenticStreamTimeouts.WRITE_SECONDS)
    }

    @Test
    fun `a server that goes silent ends the stream with a NETWORK failure`() = runBlocking {
        val server = ServerSocket(0)
        thread(isDaemon = true) {
            val socket = server.accept()
            // Read the request, send stream headers, then go silent (keep the socket open).
            val input = socket.getInputStream().bufferedReader()
            while (input.readLine()?.isNotEmpty() == true) { /* headers */ }
            socket.getOutputStream().write(
                "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\n\r\n".toByteArray()
            )
            socket.getOutputStream().flush()
            Thread.sleep(10_000)
            socket.close()
        }
        // Same mechanism as the real client, with a 1 s window so the test is fast.
        val client = OkHttpClient.Builder().readTimeout(1, TimeUnit.SECONDS).build()
        val source = AgenticChatDataSource(client, Gson(), "http://127.0.0.1:${server.localPort}/")
        val request = TextPromptRequest(query = "q", conversation_id = "c", message_id = "", triggered_input_type = "text")
        // The flow emits the Failure, then closes with the cause (the ViewModel catches it).
        val events = withTimeout(8_000) { source.stream(request).catch { }.toList() }
        server.close()
        val failure = events.last() as AgenticEvent.Failure
        assertEquals(StreamErrorKind.NETWORK, failure.kind)
        assertTrue(events.none { it is AgenticEvent.Done })
    }
}
