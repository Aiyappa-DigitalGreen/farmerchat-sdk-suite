package org.digitalgreen.farmerchat.sdk.core.ui

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

/**
 * Base for all SDK state machines. Plain class over kotlinx coroutines (NOT an
 * androidx ViewModel) so the same instance is reusable from Compose, Views and
 * any other host. UI packages own the lifecycle: call [clear] when the screen's
 * retention scope ends.
 */
abstract class CoreViewModel {

    protected val scope: CoroutineScope =
        CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** Cancels all in-flight work. The instance must not be reused after this. */
    open fun clear() {
        scope.cancel()
    }
}
