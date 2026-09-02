package org.digitalgreen.farmerchat.sdk.compose.vm

import androidx.compose.runtime.Composable
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel

/**
 * androidx.lifecycle.ViewModel holder around a core state machine. Core VMs are
 * plain classes with a .clear(); wrapping them ties their lifetime to the nav
 * back-stack entry (or activity) that owns them.
 */
class CoreVmHolder(val core: CoreViewModel) : ViewModel() {
    override fun onCleared() {
        core.clear()
    }
}

/**
 * Obtains (or creates) a core state machine scoped to the current
 * ViewModelStoreOwner. [key] must be unique per core VM type within an owner.
 */
@Composable
fun <T : CoreViewModel> rememberCoreViewModel(
    key: String,
    viewModelStoreOwner: ViewModelStoreOwner? = null,
    create: () -> T
): T {
    val owner = viewModelStoreOwner
        ?: checkNotNull(LocalViewModelStoreOwner.current) {
            "No ViewModelStoreOwner available"
        }
    val holder = viewModel(
        modelClass = CoreVmHolder::class.java,
        viewModelStoreOwner = owner,
        key = "fc_sdk_$key",
        factory = object : ViewModelProvider.Factory {
            override fun <VM : ViewModel> create(modelClass: Class<VM>): VM {
                @Suppress("UNCHECKED_CAST")
                return CoreVmHolder(create()) as VM
            }
        }
    )
    @Suppress("UNCHECKED_CAST")
    return holder.core as T
}
