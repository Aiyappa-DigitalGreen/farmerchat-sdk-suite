package org.digitalgreen.farmerchat.sdk.views

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import androidx.fragment.app.Fragment
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.FarmerChatLaunch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentHostComposerBinding
import org.digitalgreen.farmerchat.sdk.views.internal.input.InputOverlaysController
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcEmbeddedTheme
import org.digitalgreen.farmerchat.sdk.views.internal.util.FcInsets
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ToastView

/**
 * The SDK's input composer on a HOST screen (e.g. the host's own home / dashboard), with the
 * same UI and operations as the SDK Home composer: type and send, attach a photo (camera or
 * gallery sheet) and send it with the text, or record a question in the voice sheet.
 *
 * It does not open chat itself. Each submission reaches the host as a [FarmerChatLaunch] —
 * `question`, `question` + `imageUri`, or `audioUri` — to hand to a [FarmerChatFragment]
 * (`FarmerChatFragment.newInstance(launch)`) or `FarmerChat.openChat`.
 *
 * Put it in a container that fills the host screen, ABOVE the host content: the composer sits
 * at the bottom and the rest of the fragment lets touches through, so the voice / photo sheets
 * can use the whole screen. Reserve [Listener.onFarmerChatComposerHeightChanged] px at the
 * bottom of the host content so its last item is not hidden behind the bar.
 *
 * The listener is the nearest parent fragment implementing [Listener], else the activity.
 */
class FarmerChatComposerFragment : Fragment(R.layout.fc_fragment_host_composer) {

    interface Listener {
        /** The farmer submitted a question: open chat with [launch]. */
        fun onFarmerChatComposerSubmit(launch: FarmerChatLaunch)

        /** The composer bar's height changed (px, including its bottom inset). */
        fun onFarmerChatComposerHeightChanged(heightPx: Int) {}
    }

    private var binding: FcFragmentHostComposerBinding? = null
    private var overlays: InputOverlaysController? = null
    private var attachedPhoto: Uri? = null

    private val graph get() = FarmerChat.requireGraph()

    override fun onGetLayoutInflater(savedInstanceState: Bundle?): LayoutInflater =
        FcEmbeddedTheme.themedInflater(this, super.onGetLayoutInflater(savedInstanceState))

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val b = FcFragmentHostComposerBinding.bind(view).also { binding = it }
        FcInsets.trimForDescendants(view)

        overlays = InputOverlaysController(
            fragment = this,
            binding = b.fcHostComposerOverlays,
            screenName = AnalyticsScreens.HOME,
            onTextSubmitted = { text -> submit(FarmerChatLaunch(question = text)) },
            // Attach, don't send: the composer owns the query until the farmer taps send.
            onImagePicked = { uri ->
                attachedPhoto = uri
                b.fcHostComposer.setPhotoUris(listOf(uri))
            },
            onVoiceFinished = { file ->
                overlays?.hide()
                submit(FarmerChatLaunch(audioUri = Uri.fromFile(file).toString()))
            },
            onRecordingFailed = {
                b.fcHostComposerToast.show(
                    label(Labels.FAILED_TO_START_RECORDING, "Failed to start recording"),
                    ToastView.Type.ERROR
                )
            }
        )

        val composer = b.fcHostComposer
        composer.compact = false
        composer.setSurfaceColorRes(R.color.fc_green700)
        composer.setFadeColorRes(R.color.fc_surface_primary)
        composer.showAura = true
        composer.setPlaceholder(label(Labels.ASK_ABOUT_YOUR_FARM, "Ask about your farm..."))
        composer.onPhotoClick = {
            // Camera is only offered while nothing is attached (app: `if (photoUris.isEmpty())`).
            if (attachedPhoto == null) {
                trackIconClick("Image")
                overlays?.showPhotoInput()
            }
        }
        composer.onVoiceClick = { onSpeakClick() }
        composer.onRemovePhoto = {
            attachedPhoto = null
            composer.setPhotoUris(emptyList())
        }
        composer.onFocusChange = { focused -> if (focused) trackIconClick("Text") }
        composer.onSend = { text -> sendFromComposer(text) }
        attachedPhoto?.let { composer.setPhotoUris(listOf(it)) }

        composer.onBarHeightChanged = { height -> listener()?.onFarmerChatComposerHeightChanged(height) }
        view.post {
            if (binding != null) listener()?.onFarmerChatComposerHeightChanged(composer.barHeightPx())
        }
    }

    override fun onDestroyView() {
        overlays?.release()
        overlays = null
        binding = null
        super.onDestroyView()
    }

    /** SDK Home parity: an attached photo travels with the typed text; else the text alone. */
    private fun sendFromComposer(text: String) {
        val uri = attachedPhoto
        attachedPhoto = null
        binding?.fcHostComposer?.setPhotoUris(emptyList())
        when {
            uri != null -> submit(FarmerChatLaunch(question = text, imageUri = uri.toString()))
            text.isNotBlank() -> submit(FarmerChatLaunch(question = text))
        }
    }

    private fun onSpeakClick() {
        if (!graph.prefs.getBoolean(SdkPreferences.Keys.ASR_ENABLED, true)) {
            binding?.fcHostComposerToast?.show(
                label(
                    Labels.ASR_IS_DISABLED_FOR_YOUR_SELECTED_LANGUAGE,
                    "ASR is disabled for your selected language"
                ),
                ToastView.Type.ERROR
            )
            return
        }
        trackIconClick("Voice")
        overlays?.showVoiceInput()
    }

    private fun trackIconClick(iconType: String) {
        graph.analytics.track(
            AnalyticsEvents.CHAT_ICON_CLICKED,
            mapOf(
                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
                AnalyticsProps.ICON_TYPE to iconType
            )
        )
    }

    private fun submit(launch: FarmerChatLaunch) {
        listener()?.onFarmerChatComposerSubmit(launch)
    }

    private fun listener(): Listener? {
        var parent: Fragment? = parentFragment
        while (parent != null) {
            if (parent is Listener) return parent
            parent = parent.parentFragment
        }
        return activity as? Listener
    }

    private fun label(key: String, fallback: String) = graph.labelManager.getLabel(key, fallback)
}
