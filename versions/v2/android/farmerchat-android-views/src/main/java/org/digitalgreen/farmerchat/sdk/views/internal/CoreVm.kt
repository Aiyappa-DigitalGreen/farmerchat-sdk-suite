package org.digitalgreen.farmerchat.sdk.views.internal

import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel

/**
 * androidx ViewModel holder around a plain-Kotlin core state machine.
 * onCleared() → core.clear(), per the core contract.
 */
internal class CoreVmHolder(val core: CoreViewModel) : ViewModel() {
    override fun onCleared() {
        core.clear()
    }
}

private class CoreVmFactory(private val create: () -> CoreViewModel) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        @Suppress("UNCHECKED_CAST")
        return CoreVmHolder(create()) as T
    }
}

/**
 * Obtain (or create) a core state machine retained in the given owner's
 * ViewModelStore. [key] must be unique per state machine type.
 */
internal fun <T : CoreViewModel> viewModelOwnerCoreVm(
    owner: ViewModelStoreOwner,
    key: String,
    create: () -> T
): T {
    val holder = ViewModelProvider(owner, CoreVmFactory(create))
        .get("fc_sdk_$key", CoreVmHolder::class.java)
    @Suppress("UNCHECKED_CAST")
    return holder.core as T
}

/** Fragment-scoped core state machine (cleared when the fragment is destroyed). */
internal fun <T : CoreViewModel> Fragment.coreVm(key: String, create: () -> T): T =
    viewModelOwnerCoreVm(this, key, create)

/** Activity-scoped core state machine (shared drawer-wide, e.g. chat history). */
internal fun <T : CoreViewModel> Fragment.activityCoreVm(key: String, create: () -> T): T =
    viewModelOwnerCoreVm(requireActivity(), key, create)
