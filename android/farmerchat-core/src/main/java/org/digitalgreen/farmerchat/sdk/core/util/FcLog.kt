package org.digitalgreen.farmerchat.sdk.core.util

import android.util.Log

/**
 * The SDK's one log gate. Silent unless the host set `FarmerChatConfig.debugLogging`, so a release
 * host app ships no SDK log lines (MoEngage-style: logs are opt-in, never on by default).
 * Integration-misuse errors that a developer must see (e.g. launching before initialize) do not go
 * through here and stay always-on.
 */
internal object FcLog {
    @Volatile
    var enabled: Boolean = false

    fun d(tag: String, msg: String) { if (enabled) Log.d(tag, msg) }
    fun w(tag: String, msg: String, tr: Throwable? = null) { if (enabled) Log.w(tag, msg, tr) }
    fun e(tag: String, msg: String, tr: Throwable? = null) { if (enabled) Log.e(tag, msg, tr) }
}
