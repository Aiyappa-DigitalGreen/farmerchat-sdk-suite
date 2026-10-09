package org.digitalgreen.farmerchat.sdk.views

import org.digitalgreen.farmerchat.sdk.views.internal.util.FcInsets
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.NavHostFragment
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.FarmerChatLaunch
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
        // Launch options become the pending target the SDK splash consumes. Only on first
        // creation: a restored fragment already navigated there.
        if (savedInstanceState == null) {
            val graph = FarmerChat.requireGraph()
            val a = arguments ?: Bundle.EMPTY
            fun str(key: String) = a.getString(key)?.takeIf { it.isNotBlank() }
            // Dropping the stored id makes the CHAT_ONLY bootstrap create a fresh conversation.
            if (a.getBoolean(ARG_NEW_CONVERSATION)) {
                graph.prefs.putString(SdkPreferences.Keys.NEW_CONVERSATION_ID, "")
            }
            val question = str(ARG_QUESTION)
            val imageUri = str(ARG_IMAGE_URI)
            val audioUri = str(ARG_AUDIO_URI)
            val answer = str(ARG_ANSWER)
            val conversationId = str(ARG_CONVERSATION_ID)
            when {
                conversationId != null ->
                    graph.routeDecider.savePendingTarget(PendingTarget.Chat(conversationId))
                question != null || imageUri != null || audioUri != null || answer != null ->
                    graph.routeDecider.savePendingTarget(
                        PendingTarget.ChatQuery(
                            question = question.orEmpty(),
                            source = "deeplink",
                            preGeneratedAnswer = answer,
                            followUpQuestions = a.getStringArrayList(ARG_FOLLOW_UPS),
                            imageUri = imageUri,
                            audioUri = audioUri,
                        )
                    )
                str(ARG_SCREEN) != null ->
                    graph.routeDecider.savePendingTarget(PendingTarget.Screen(str(ARG_SCREEN)!!))
            }
        }
    }

    override fun onGetLayoutInflater(savedInstanceState: Bundle?): LayoutInflater =
        FcEmbeddedTheme.themedInflater(this, super.onGetLayoutInflater(savedInstanceState))

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val binding = FcJourneyHostBinding.bind(view)
        val graph = FarmerChat.requireGraph()
        // Embedded: pad for the system bars only where they actually overlap this fragment.
        FcInsets.trimForDescendants(view)

        applyAppearance(graph.prefs.getString(SdkPreferences.Keys.APPEARANCE_MODE, ""))

        val navHost = childFragmentManager.findFragmentById(R.id.fcNavHost) as NavHostFragment
        // System Back walks the SDK's own back stack (chat → history → back to that chat) even when
        // the host never made this fragment its primary navigation fragment; only with nothing
        // left to pop does Back fall through to the host (which then leaves the journey).
        val sdkBack = object : androidx.activity.OnBackPressedCallback(false) {
            override fun handleOnBackPressed() {
                navHost.navController.popBackStack()
            }
        }
        requireActivity().onBackPressedDispatcher.addCallback(viewLifecycleOwner, sdkBack)
        navHost.navController.addOnDestinationChangedListener { controller, _, _ ->
            sdkBack.isEnabled = controller.previousBackStackEntry != null
        }
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

    /** The nearest [ExitListener] on the parent chain, then the activity. */
    private fun exitListener(): ExitListener? {
        var parent: Fragment? = parentFragment
        while (parent != null) {
            if (parent is ExitListener) return parent
            parent = parent.parentFragment
        }
        return activity as? ExitListener
    }

    private fun onExitHook(): (() -> Unit)? =
        runCatching { FarmerChat.requireGraph().config.hooks.onExit }.getOrNull()

    override fun exitJourney() {
        val hook = onExitHook()
        runCatching { hook?.invoke() }
        val listener = exitListener()
        when {
            listener != null -> listener.onFarmerChatExit()
            // `onExit` is wired: the host removes this fragment; never finish ITS activity.
            hook != null -> Unit
            else -> activity?.finish()
        }
    }

    override val exitRemovesSdk: Boolean get() = exitListener() != null || onExitHook() != null

    companion object {
        private const val ARG_QUESTION = "fc_arg_question"
        private const val ARG_CONVERSATION_ID = "fc_arg_conversation_id"
        private const val ARG_IMAGE_URI = "fc_arg_image_uri"
        private const val ARG_AUDIO_URI = "fc_arg_audio_uri"
        private const val ARG_ANSWER = "fc_arg_pre_generated_answer"
        private const val ARG_FOLLOW_UPS = "fc_arg_follow_ups"
        private const val ARG_NEW_CONVERSATION = "fc_arg_new_conversation"
        private const val ARG_SCREEN = "fc_arg_screen"

        /** Embedded counterpart of [FarmerChat.openChat]; see [FarmerChatLaunch] for what each option does. */
        @JvmStatic
        fun newInstance(launch: FarmerChatLaunch): FarmerChatFragment =
            FarmerChatFragment().apply {
                arguments = bundleOf(
                    ARG_QUESTION to launch.question,
                    ARG_CONVERSATION_ID to launch.conversationId,
                    ARG_IMAGE_URI to launch.imageUri,
                    ARG_AUDIO_URI to launch.audioUri,
                    ARG_ANSWER to launch.preGeneratedAnswer,
                    ARG_FOLLOW_UPS to launch.followUpQuestions?.let { ArrayList(it) },
                    ARG_NEW_CONVERSATION to launch.startNewConversation,
                    ARG_SCREEN to launch.screen,
                )
            }

        /** Shorthand for [newInstance] with just a question and/or a conversation. */
        @JvmStatic
        @JvmOverloads
        fun newInstance(question: String? = null, conversationId: String? = null): FarmerChatFragment =
            newInstance(FarmerChatLaunch(question = question, conversationId = conversationId))
    }
}
