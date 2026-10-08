package org.digitalgreen.farmerchat.sdk.core.auth

import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import org.digitalgreen.farmerchat.sdk.core.model.InitializeGuestUserResponse
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import java.util.concurrent.atomic.AtomicInteger

/**
 * docs/02 "TokenAuthenticator (401 refresh)" Step 3 — the **guest-replaced** signal.
 *
 * Fired by the 401 authenticator (on an OkHttp thread, inside its refresh lock) after a rejected
 * guest was replaced by a new one via `initialize_user`. Requests already built — the retried one
 * and any concurrent ones — still carry the OLD `user_id` in their body/query, so screens that
 * loaded data for it re-run their entry loads on this (Home: new conversation, feed, weather,
 * profile/place name; Chat: drops its cached conversation id).
 *
 * [notifyGuestReplaced] never suspends ([MutableSharedFlow.tryEmit] with a one-slot buffer), so it
 * is safe to call from the authenticator. No replay: a screen that is not alive when the signal
 * fires runs its normal entry loads with the new identity when it is next created.
 */
class GuestReplacedSignal {
    private val _events = MutableSharedFlow<Unit>(
        extraBufferCapacity = 1,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )

    val events: SharedFlow<Unit> = _events.asSharedFlow()

    private val _generation = AtomicInteger(0)

    /**
     * Guest generation: bumped on every replacement BEFORE listeners run. A load captures it at
     * start and drops its result if it changed — a stale request built with the old user_id (the
     * retried 401, or a concurrent one; 404 is retryable so it repeats) can otherwise finish
     * AFTER the reload and overwrite it.
     */
    val generation: Int get() = _generation.get()

    fun notifyGuestReplaced() {
        _generation.incrementAndGet()
        _events.tryEmit(Unit)
    }
}

/**
 * The preference rewrite Step 3 performs on success (docs/02): the conversation and the place
 * names belonged to the rejected guest, and the new guest's location is whatever the
 * `initialize_user` response says. Pure over [remove]/[put] so it is unit-testable without a
 * `Context`; the graph wires it to [SdkPreferences].
 *
 * docs/02 lists the web key names `USER_DISTRICT` / `USER_STATE`; Android has no district key and
 * stores the state under [SdkPreferences.Keys.USER_SELECTED_STATE_CODE] (the key the first guest
 * init in [SessionManager.initializeGuestUser] writes), so that is the one cleared here.
 */
object GuestReplacement {

    /** Removed before the response's values are written. */
    val STALE_KEYS: List<String> = listOf(
        SdkPreferences.Keys.NEW_CONVERSATION_ID,
        SdkPreferences.Keys.APPROX_LOCATION_NAME,
        SdkPreferences.Keys.USER_SELECTED_STATE_CODE,
        SdkPreferences.Keys.USER_COUNTRY_NAME
    )

    fun rewritePrefs(
        response: InitializeGuestUserResponse,
        remove: (String) -> Unit,
        put: (String, String) -> Unit
    ) {
        STALE_KEYS.forEach(remove)
        // Same writes as the first guest init (SessionManager.initializeGuestUser).
        response.country_code?.let { put(SdkPreferences.Keys.USER_COUNTRY_CODE, it) }
        response.country?.let { put(SdkPreferences.Keys.USER_COUNTRY_NAME, it) }
        response.state?.let { put(SdkPreferences.Keys.USER_SELECTED_STATE_CODE, it) }
    }
}
