package org.digitalgreen.farmerchat.sdk.views

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.NavHostFragment
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.views.databinding.FcJourneyHostBinding
import org.digitalgreen.farmerchat.sdk.views.internal.JourneyController
import org.digitalgreen.farmerchat.sdk.views.internal.JourneyHost
import org.digitalgreen.farmerchat.sdk.views.internal.viewModelOwnerCoreVm

/**
 * Embeddable variant of the FarmerChat journey: hosts the same NavHost + drawer
 * inside the host app's own activity (childFragmentManager owns the graph).
 */
class FarmerChatFragment : Fragment(R.layout.fc_journey_host), JourneyHost {

    private var controller: JourneyController? = null

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val binding = FcJourneyHostBinding.bind(view)
        val graph = FarmerChat.requireGraph()

        applyAppearance(graph.prefs.getString(SdkPreferences.Keys.APPEARANCE_MODE, ""))

        val navHost = childFragmentManager.findFragmentById(R.id.fcNavHost) as NavHostFragment
        controller = JourneyController(
            activity = requireActivity(),
            binding = binding,
            navController = navHost.navController,
            lifecycleOwner = viewLifecycleOwner,
            graph = graph,
            chatHistoryVm = viewModelOwnerCoreVm(requireActivity(), "chat_history") {
                graph.chatHistoryViewModel()
            }
        )
    }

    override fun onDestroyView() {
        controller = null
        super.onDestroyView()
    }

    override fun openDrawer() {
        controller?.openDrawer()
    }

    override fun closeDrawer() {
        controller?.closeDrawer()
    }

    override fun applyAppearance(mode: String) {
        (activity as? AppCompatActivity)?.applyLocalNightMode(mode)
    }
}
