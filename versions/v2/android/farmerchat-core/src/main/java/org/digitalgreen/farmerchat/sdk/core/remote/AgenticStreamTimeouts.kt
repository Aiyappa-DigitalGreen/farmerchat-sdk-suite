package org.digitalgreen.farmerchat.sdk.core.remote

/** The agentic stream client's timeouts, app core/di/NetworkModule.kt "streamingOkHttp". */
internal object AgenticStreamTimeouts {
    const val CONNECT_SECONDS = 15L
    /** Max silence between two reads of the stream (app AGENTIC_STREAM_READ_TIMEOUT_SECONDS). */
    const val READ_SECONDS = 60L
    const val WRITE_SECONDS = 30L
}
