package org.digitalgreen.farmerchat.sdk.views.internal.input

import android.view.View
import android.view.HapticFeedbackConstants
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.VoiceRecorderView
import org.digitalgreen.farmerchat.sdk.views.internal.util.FcInsets
import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.isVisible
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.fragment.app.Fragment
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.audio.AudioRecorder
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcViewInputOverlaysBinding
import java.io.File

/**
 * Shared text/voice/photo input overlays used by Home and Chat (doc 01 §3.7/§3.8).
 * Owns the AudioRecorder, camera/gallery launchers and camera/mic permission
 * attempt/deny counters (settings dialog after 2 denials).
 */
internal class InputOverlaysController(
    private val fragment: Fragment,
    private val binding: FcViewInputOverlaysBinding,
    /**
     * `screen_name` stamped on every event this controller emits. The app tracks the
     * same overlay events from Home (`AnalyticsScreens.HOME`, HomeScreen.kt:1670-1773)
     * and from Chat (`AnalyticsScreens.CHAT`, ChatInputOverlays.kt:114-182), so the
     * hosting fragment must supply its own screen.
     */
    private val screenName: String,
    private val onTextSubmitted: (String) -> Unit,
    private val onImagePicked: (Uri) -> Unit,
    private val onVoiceFinished: (File) -> Unit,
    private val onRecordingFailed: () -> Unit
) {

    private val context: Context get() = fragment.requireContext()
    private val graph get() = FarmerChat.requireGraph()
    private val prefs get() = graph.prefs

    private val recorder = AudioRecorder(context)
    private var isRecording = false

    private var cameraOutputUri: Uri? = null

    /** XML bottom paddings of the three panels, captured before init's applyImeInsets() so the inset is added, not stacked. */
    private val voicePanelBasePadding = binding.fcVoicePanel.paddingBottom
    private val photoPanelBasePadding = binding.fcPhotoPanel.paddingBottom
    private val textPanelBasePadding = binding.fcTextInputPanel.paddingBottom


    private val cameraLauncher: ActivityResultLauncher<Uri>
    private val galleryLauncher: ActivityResultLauncher<String>
    private val cameraPermissionLauncher: ActivityResultLauncher<String>
    private val micPermissionLauncher: ActivityResultLauncher<String>

    init {
        applyImeInsets()
        val registry = fragment.requireActivity().activityResultRegistry
        val owner = fragment.viewLifecycleOwner
        val keyPrefix = "fc_sdk_input_${fragment.id}_${fragment.javaClass.simpleName}"

        cameraLauncher = registry.register(
            "${keyPrefix}_camera", owner, ActivityResultContracts.TakePicture()
        ) { success ->
            val uri = cameraOutputUri
            if (success && uri != null) {
                hide()
                onImagePicked(uri)
            }
        }
        galleryLauncher = registry.register(
            "${keyPrefix}_gallery", owner, ActivityResultContracts.GetContent()
        ) { uri ->
            if (uri != null) {
                hide()
                onImagePicked(uri)
            }
        }
        cameraPermissionLauncher = registry.register(
            "${keyPrefix}_camera_perm", owner, ActivityResultContracts.RequestPermission()
        ) { granted ->
            onPermissionResult(
                granted,
                SdkPreferences.Keys.CAMERA_PERMISSION_DENY_COUNT,
                isCamera = true
            ) { launchCamera() }
        }
        micPermissionLauncher = registry.register(
            "${keyPrefix}_mic_perm", owner, ActivityResultContracts.RequestPermission()
        ) { granted ->
            onPermissionResult(
                granted,
                SdkPreferences.Keys.MICROPHONE_PERMISSION_DENY_COUNT,
                isCamera = false
            ) { startVoiceRecording() }
        }

        binding.fcOverlayScrim.setOnClickListener { cancelAndHide() }
        binding.fcTextInputSend.setOnClickListener {
            val text = binding.fcTextInputField.text?.toString().orEmpty().trim()
            if (text.isNotBlank()) {
                hide()
                onTextSubmitted(text)
            }
        }
        binding.fcVoiceRecorder.onDelete = {
            graph.analytics.track(
                AnalyticsEvents.CANCEL_RECORD_AUDIO_CLICK_EVENT,
                audioProps() // app ChatInputOverlays.kt:182
            )
            cancelAndHide()
        }
        // Send, or the 30 s countdown running out (app VoiceClip `onRecordingComplete`).
        binding.fcVoiceRecorder.onSend = { if (isRecording) stopRecordingAndSubmit() }
        binding.fcVoiceRecorder.onAutoSend = { if (isRecording) stopRecordingAndSubmit() }
        binding.fcPhotoCamera.setOnClickListener {
            graph.analytics.track(
                AnalyticsEvents.IMAGE_OPTION_DIALOG_CLICK_EVENT,
                // App ChatScreen.kt:1921 / HomeScreen.kt:1759.
                mapOf(
                    AnalyticsProps.SCREEN_NAME to screenName,
                    AnalyticsProps.OPTION to "Camera"
                )
            )
            requestCamera()
        }
        binding.fcPhotoGallery.setOnClickListener {
            graph.analytics.track(
                AnalyticsEvents.IMAGE_OPTION_DIALOG_CLICK_EVENT,
                // App ChatScreen.kt:1935 / HomeScreen.kt:1773.
                mapOf(
                    AnalyticsProps.SCREEN_NAME to screenName,
                    AnalyticsProps.OPTION to "Gallery"
                )
            )
            galleryLauncher.launch("image/*")
        }

        renderLabels()
    }

    private fun label(key: String, fallback: String) = graph.labelManager.getLabel(key, fallback)

    private fun renderLabels() {
        binding.fcTextInputField.hint = label(Labels.ASK_ABOUT_YOUR_FARM, "Ask about your farm...")
        renderVoiceLabels()
        binding.fcPhotoCameraLabel.text = label(Labels.CAMERA, "Camera")
        // App PhotoInput.kt labels the second tile "Photos", not "Gallery".
        binding.fcPhotoGalleryLabel.text = label(Labels.PHOTOS, "Photos")
    }

    /**
     * Lifts the text/voice panels above the on-screen keyboard.
     *
     * The panels are `layout_gravity="bottom"` inside a `match_parent` FrameLayout, and the SDK
     * theme draws edge-to-edge (transparent status/navigation bars). Under that setup
     * `windowSoftInputMode="adjustResize"` does NOT shrink the overlay, so the composer stayed
     * pinned to the RAW screen bottom — behind the IME, which is why the typed text was not
     * visible. This is the Views counterpart of `Modifier.imePadding()` in the Compose flavour.
     *
     * Padding (not margin) so the panel background still extends behind the keyboard, and
     * `navigationBars` is used when the IME is closed so the panel clears the gesture bar.
     */
    private fun applyImeInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(binding.fcOverlayRoot) { view, insets ->
            // Read from the ROOT window insets, not the dispatched ones: the overlay is a
            // sibling of a `fitsSystemWindows="true"` LinearLayout in fc_fragment_chat.xml, and
            // a sibling that consumes insets first would leave this callback seeing 0.
            // Trimmed to this view's bounds: an embedding host may already keep it clear of them.
            val ime = FcInsets.overlapping(view, WindowInsetsCompat.Type.ime()).bottom
            val navBar = FcInsets.overlapping(view, WindowInsetsCompat.Type.navigationBars()).bottom
            // App parity (PhotoInput.kt / VoiceInput.kt ModalBottomSheet): the sheet's own
            // background runs BEHIND the nav bar, with only its content lifted clear of it.
            // Padding the ROOT instead floated each panel above a strip of scrim, so the
            // nav-bar area read grey under a white sheet. The IME keeps lifting the root, so
            // the text bar still sits above the keyboard.
            view.updatePadding(bottom = ime)
            val sheetInset = if (ime > 0) 0 else navBar
            binding.fcVoicePanel.updatePadding(bottom = voicePanelBasePadding + sheetInset)
            binding.fcPhotoPanel.updatePadding(bottom = photoPanelBasePadding + sheetInset)
            binding.fcTextInputPanel.updatePadding(bottom = textPanelBasePadding + sheetInset)
            insets
        }
        ViewCompat.requestApplyInsets(binding.fcOverlayRoot)
    }

    val isVisible: Boolean get() = binding.fcOverlayRoot.isVisible

    /**
     * Fired whenever a panel opens or the overlay hides (including the internal scrim-tap /
     * cancel paths), so a screen can hide content the sheet would cover — Chat's empty-state
     * placeholder.
     */
    var onVisibilityChanged: ((Boolean) -> Unit)? = null

    // ------------------------------------------------------------------ show / hide

    fun showTextInput() {
        showPanel(text = true)
        binding.fcTextInputField.requestFocus()
        val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.showSoftInput(binding.fcTextInputField, InputMethodManager.SHOW_IMPLICIT)
    }

    fun showPhotoInput() {
        showPanel(photo = true)
    }

    fun showVoiceInput() {
        graph.analytics.track(
            AnalyticsEvents.MICROPHONE_CLICK_EVENT,
            // App ChatScreen.kt:857 / HomeScreen.kt:687.
            mapOf(
                AnalyticsProps.SCREEN_NAME to screenName,
                AnalyticsProps.ICON_TYPE to "Voice"
            )
        )
        requestMicThenRecord()
    }

    fun hide() {
        if (isRecording) {
            recorder.cancelRecording()
            isRecording = false
        }
        binding.fcOverlayRoot.isVisible = false
        binding.fcTextInputPanel.isVisible = false
        binding.fcVoicePanel.isVisible = false
        binding.fcPhotoPanel.isVisible = false
        binding.fcTextInputField.setText("")
        val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.hideSoftInputFromWindow(binding.fcTextInputField.windowToken, 0)
        onVisibilityChanged?.invoke(false)
    }

    fun setVoiceProcessing(processing: Boolean) {
        binding.fcVoiceRecorder.mode =
            if (processing) VoiceRecorderView.Mode.Processing else VoiceRecorderView.Mode.Listening
        renderVoiceLabels()
    }

    /** App VoiceInput.kt copy: Speak now / Ask about your farm… → Processing… / One second… */
    private fun renderVoiceLabels() {
        val recorder = binding.fcVoiceRecorder
        val listening = recorder.mode == VoiceRecorderView.Mode.Listening
        recorder.title = if (listening) label(Labels.LISTENING, "Speak now")
        else label(Labels.PROCESSING, "Processing...")
        recorder.subtitle = if (listening) {
            label(Labels.ASK_YOUR_FARMING_QUESTION, "Ask about your farm or livestock")
        } else {
            label(Labels.ONE_SECOND_PLEASE, "One second, please...")
        }
        recorder.footer = label(Labels.VOICE_INPUT_IS_STILL_IMPROVING, "Keep background noise low")
    }

    fun release() {
        recorder.release()
    }

    private fun cancelAndHide() {
        hide()
    }

    private fun showPanel(text: Boolean = false, voice: Boolean = false, photo: Boolean = false) {
        renderLabels()
        val wasShowingVoice = binding.fcOverlayRoot.isVisible && binding.fcVoicePanel.isVisible
        val wasShowingPhoto = binding.fcOverlayRoot.isVisible && binding.fcPhotoPanel.isVisible
        binding.fcOverlayRoot.isVisible = true
        binding.fcTextInputPanel.isVisible = text
        binding.fcVoicePanel.isVisible = voice
        binding.fcPhotoPanel.isVisible = photo
        onVisibilityChanged?.invoke(true)
        if (text) binding.fcOverlayScrim.alpha = 1f
        // App VoiceInput.kt slides from 400dp, PhotoInput.kt from 300dp; both over 300 ms.
        if (voice && !wasShowingVoice) animateSheetIn(binding.fcVoicePanel, fromDp = 400f)
        if (photo && !wasShowingPhoto) animateSheetIn(binding.fcPhotoPanel, fromDp = 300f)
    }

    /**
     * App sheet entrance: the sheet slides up and the scrim fades to Black @ 25% over 300 ms.
     * [fc_scrim] is Black @ 50%, so the scrim view fades to half opacity.
     */
    private fun animateSheetIn(sheet: View, fromDp: Float) {
        sheet.translationY = fromDp * context.resources.displayMetrics.density
        sheet.animate().translationY(0f).setDuration(300L).start()
        binding.fcOverlayScrim.alpha = 0f
        binding.fcOverlayScrim.animate().alpha(SHEET_SCRIM_ALPHA).setDuration(300L).start()
    }

    // ------------------------------------------------------------------ voice

    private fun requestMicThenRecord() {
        if (hasPermission(Manifest.permission.RECORD_AUDIO)) {
            startVoiceRecording()
        } else {
            bumpAttempt(SdkPreferences.Keys.MICROPHONE_PERMISSION_ATTEMPT_COUNT)
            if (denyCount(SdkPreferences.Keys.MICROPHONE_PERMISSION_DENY_COUNT) >= 2) {
                showSettingsDialog(isCamera = false)
            } else {
                runCatching { micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO) }
            }
        }
    }

    private fun startVoiceRecording() {
        showPanel(voice = true)
        setVoiceProcessing(false)
        binding.fcVoiceRecorder.session++
        if (recorder.startRecording()) {
            isRecording = true
            binding.fcVoiceRecorder.hasStarted = true
        } else {
            binding.fcVoiceRecorder.hasStarted = false
            hide()
            onRecordingFailed()
        }
    }

    private fun stopRecordingAndSubmit() {
        graph.analytics.track(
            AnalyticsEvents.SEND_RECORD_AUDIO_CLICK_EVENT,
            audioProps() // app ChatInputOverlays.kt:114
        )
        isRecording = false
        binding.fcVoiceRecorder.hasStarted = false
        // App VoiceInput.kt `handleSave`: a confirming haptic tick on send.
        binding.fcVoicePanel.performHapticFeedback(
            if (android.os.Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM
            else HapticFeedbackConstants.VIRTUAL_KEY
        )
        val file = recorder.stopRecording()
        if (file != null) {
            onVoiceFinished(file)
        } else {
            hide()
            onRecordingFailed()
        }
    }


    // ------------------------------------------------------------------ photo

    /**
     * Open the camera directly, with no photo panel — the UPLOAD_PHOTO alignment chip's
     * `take_photo` capability (app: the chip launches the device camera, not the composer).
     * Permission handling and the settings-dialog fallback are shared with the panel path.
     */
    fun launchCameraForCapability() = requestCamera()

    /** Open the gallery directly — the UPLOAD_PHOTO chip's `choose_from_gallery` capability. */
    fun launchGalleryForCapability() {
        runCatching { galleryLauncher.launch("image/*") }
    }

    private fun requestCamera() {
        if (hasPermission(Manifest.permission.CAMERA)) {
            launchCamera()
        } else {
            bumpAttempt(SdkPreferences.Keys.CAMERA_PERMISSION_ATTEMPT_COUNT)
            if (denyCount(SdkPreferences.Keys.CAMERA_PERMISSION_DENY_COUNT) >= 2) {
                showSettingsDialog(isCamera = true)
            } else {
                runCatching { cameraPermissionLauncher.launch(Manifest.permission.CAMERA) }
            }
        }
    }

    private fun launchCamera() {
        runCatching {
            val photoFile = File.createTempFile("fc_sdk_photo_", ".jpg", context.cacheDir)
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fc_sdk_views_fileprovider",
                photoFile
            )
            cameraOutputUri = uri
            cameraLauncher.launch(uri)
        }.onFailure {
            graph.analytics.track(
                AnalyticsEvents.INPUT_CAPTURE_FAILED,
                // App HomeScreen.kt:437 / ChatScreen.kt:616.
                mapOf(
                    AnalyticsProps.SCREEN_NAME to screenName,
                    AnalyticsProps.INPUT_TYPE to "Image",
                    AnalyticsProps.SOURCE to "Camera",
                    AnalyticsProps.FAILURE_REASON to "No camera app"
                )
            )
        }
    }

    // ------------------------------------------------------------------ permissions

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    /** `{screen_name, Input_type, Source}` — the app's audio-overlay payload. */
    private fun audioProps(extra: Map<String, Any?> = emptyMap()): Map<String, Any?> =
        mapOf(
            AnalyticsProps.SCREEN_NAME to screenName,
            AnalyticsProps.INPUT_TYPE to "Audio",
            AnalyticsProps.SOURCE to "Mic"
        ) + extra

    private fun bumpAttempt(key: String) {
        val attempt = prefs.getInt(key, 0) + 1
        prefs.putInt(key, attempt)
        val isCamera = key == SdkPreferences.Keys.CAMERA_PERMISSION_DENY_COUNT
        // App HomeScreen.kt:527/1756, ChatScreen.kt:696 — the Camera popup also carries
        // `Option`, the Microphone popup does not.
        graph.analytics.track(
            AnalyticsEvents.PERMISSION_POPUP_SHOWN,
            buildMap {
                put(AnalyticsProps.SCREEN_NAME, screenName)
                put(AnalyticsProps.PERMISSION_TYPE, if (isCamera) "Camera" else "Microphone")
                if (isCamera) put(AnalyticsProps.OPTION, "Camera")
                put(AnalyticsProps.ATTEMPT, attempt.toString())
            }
        )
    }

    private fun denyCount(key: String): Int = prefs.getInt(key, 0)

    private fun onPermissionResult(
        granted: Boolean,
        denyKey: String,
        isCamera: Boolean,
        onGranted: () -> Unit
    ) {
        val permissionType = if (isCamera) "Camera" else "Microphone"
        if (granted) {
            // App HomeScreen.kt:423/485, ChatScreen.kt:599 — Attempt is always 1 on success.
            graph.analytics.track(
                AnalyticsEvents.PERMISSION_GRANTED,
                mapOf(
                    AnalyticsProps.SCREEN_NAME to screenName,
                    AnalyticsProps.PERMISSION_TYPE to permissionType,
                    AnalyticsProps.ATTEMPT to "1"
                )
            )
            prefs.putInt(denyKey, 0)
            onGranted()
        } else {
            val denies = prefs.getInt(denyKey, 0) + 1
            // App HomeScreen.kt:463/500, ChatScreen.kt:652 — Attempt is the NEXT deny count.
            graph.analytics.track(
                AnalyticsEvents.PERMISSION_DENIED,
                mapOf(
                    AnalyticsProps.SCREEN_NAME to screenName,
                    AnalyticsProps.PERMISSION_TYPE to permissionType,
                    AnalyticsProps.ATTEMPT to denies.toString()
                )
            )
            prefs.putInt(denyKey, denies)
            if (denies >= 2) showSettingsDialog(isCamera)
        }
    }

    private fun showSettingsDialog(isCamera: Boolean) {
        // App PermissionSettingsDialog.kt:98 — `{Permission_type, screen_name}`.
        graph.analytics.track(
            AnalyticsEvents.PERMISSION_FALLBACK_SETTING_SHOWN,
            mapOf(
                AnalyticsProps.PERMISSION_TYPE to if (isCamera) "Camera" else "Microphone",
                AnalyticsProps.SCREEN_NAME to screenName
            )
        )
        val title = if (isCamera) {
            label(Labels.CAMERA_PERMISSION_REQUIRED, "Camera Permission Required")
        } else {
            label(Labels.MICROPHONE_PERMISSION_REQUIRED, "Microphone Permission Required")
        }
        val message = if (isCamera) {
            label(
                Labels.PLEASE_ENABLE_CAMERA_SETTINGS,
                "Camera permission is needed to take photos of your crops and get instant advice. Please enable it in your device settings."
            )
        } else {
            label(
                Labels.PLEASE_ENABLE_MICROPHONE_SETTINGS,
                "Microphone permission is needed to record your voice questions. Please enable it in your device settings."
            )
        }
        // The view's context, not the fragment's: embedded, that one carries the SDK theme.
        AlertDialog.Builder(binding.root.context)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton(label(Labels.GO_TO_SETTINGS, "Go to Settings")) { _, _ ->
                // App PermissionSettingsDialog.kt:218 — `screen_name` only.
                graph.analytics.track(
                    AnalyticsEvents.PERMISSION_FALLBACK_SETTING_CLICKED,
                    mapOf(AnalyticsProps.SCREEN_NAME to screenName)
                )
                runCatching {
                    context.startActivity(
                        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.fromParts("package", context.packageName, null)
                        }
                    )
                }
            }
            .setNegativeButton(label(Labels.CANCEL, "Cancel")) { dialog, _ ->
                // App PermissionSettingsDialog.kt:242 — `screen_name` only.
                graph.analytics.track(
                    AnalyticsEvents.PERMISSION_FALLBACK_SETTING_CANCELED,
                    mapOf(AnalyticsProps.SCREEN_NAME to screenName)
                )
                dialog.dismiss()
            }
            .show()
    }

    private companion object {
        /** Scrim view alpha for the voice / photo sheets: fc_scrim (50%) x 0.5 = the app's 25%. */
        const val SHEET_SCRIM_ALPHA = 0.5f
    }
}
