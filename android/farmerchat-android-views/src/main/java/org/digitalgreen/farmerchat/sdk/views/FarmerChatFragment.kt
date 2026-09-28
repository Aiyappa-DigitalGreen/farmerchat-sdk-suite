package org.digitalgreen.farmerchat.sdk.views

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.NavHostFragment
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.core.navigation.PendingTarget
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.views.databinding.FcJourneyHostBinding
import org.digitalgreen.farmerchat.sdk.views.internal.JourneyController
import org.digitalgreen.farmerchat.sdk.views.internal.JourneyHost
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcEmbeddedTheme
import org.digitalgreen.farmerchat.sdk.views.internal.viewModelOwnerCoreVm

/**
 * Embeddable variant of the FarmerChat journey: hosts the same NavHost + drawer
 * inside the host app's own activity (childFragmentManager owns the graph).
 *
 * The host theme ([org.digitalgreen.farmerchat.sdk.FarmerChatTheme]) applies here exactly as in
 * [FarmerChatActivity]. To leave the SDK (the chat close button in CHAT_ONLY), implement
 * [ExitListener] on the parent fragment or the activity; without one the activity finishes,
 * which is the pre-existing behaviour.
 */
class FarmerChatFragment : Fragment(R.layout.fc_journey_host), JourneyHost {

    /** Receives "leave FarmerChat" from an embedded journey. Looked up on the parent chain, then the activity. */
    fun interface ExitListener {
        fun onFarmerChatExit()
    }

    private var controller: JourneyController? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Deep-link args become the pending target the SDK splash consumes. Only on first
        // creation: a restored fragment already navigated there.
        if (savedInstanceState == null) {
            val graph = FarmerChat.requireGraph()
            val conversationId = arguments?.getString(ARG_CONVERSATION_ID)?.takeIf { it.isNotBlank() }
            val question = arguments?.getString(ARG_QUESTION)?.takeIf { it.isNotBlank() }
            when {
                conversationId != null ->
                    graph.routeDecider.savePendingTarget(PendingTarget.Chat(conversationId))
                question != null ->
                    graph.routeDecider.savePendingTarget(
                        PendingTarget.ChatQuery(question = question, source = "deeplink")
                    )
            }
        }
    }

    override fun onGetLayoutInflater(savedInstanceState: Bundle?): LayoutInflater =
        FcEmbeddedTheme.themedInflater(this, super.onGetLayoutInflater(savedInstanceState))

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

    override fun exitJourney() {
        var parent: Fragment? = parentFragment
        while (parent != null) {
            if (parent is ExitListener) return parent.onFarmerChatExit()
            parent = parent.parentFragment
        }
        (activity as? ExitListener)?.onFarmerChatExit() ?: activity?.finish()
    }

    companion object {
        private const val ARG_QUESTION = "fc_arg_question"
        private const val ARG_CONVERSATION_ID = "fc_arg_conversation_id"

        /**
         * Embedded counterpart of [FarmerChat.openChat]: [conversationId] opens that thread,
         * else [question] is asked immediately, else a fresh chat opens.
         */
        @JvmStatic
        @JvmOverloads
        fun newInstance(question: String? = null, conversationId: String? = null): FarmerChatFragment =
            FarmerChatFragment().apply {
                arguments = bundleOf(ARG_QUESTION to question, ARG_CONVERSATION_ID to conversationId)
            }
    }
}
