package org.digitalgreen.farmerchat.sdk.views.internal.input

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
    private var recordSeconds = 0
    private val timerTick = object : Runnable {
        override fun run() {
            if (!isRecording) return
            recordSeconds++
            binding.fcVoiceTimer.text =
                String.format("%d:%02d", recordSeconds / 60, recordSeconds % 60)
            binding.fcVoiceTimer.postDelayed(this, 1000L)
        }
    }

    private var cameraOutputUri: Uri? = null

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
        binding.fcVoiceCancel.setOnClickListener {
            graph.analytics.track(AnalyticsEvents.CANCEL_RECORD_AUDIO_CLICK_EVENT)
            cancelAndHide()
        }
        binding.fcVoiceMain.setOnClickListener {
            if (isRecording) stopRecordingAndSubmit()
        }
        binding.fcPhotoCamera.setOnClickListener {
            graph.analytics.track(AnalyticsEvents.IMAGE_OPTION_DIALOG_CLICK_EVENT)
            requestCamera()
        }
        binding.fcPhotoGallery.setOnClickListener {
            graph.analytics.track(AnalyticsEvents.IMAGE_OPTION_DIALOG_CLICK_EVENT)
            galleryLauncher.launch("image/*")
        }

        renderLabels()
    }

    private fun label(key: String, fallback: String) = graph.labelManager.getLabel(key, fallback)

    private fun renderLabels() {
        binding.fcTextInputField.hint = label(Labels.ASK_ABOUT_YOUR_FARM, "Ask about your farm...")
        binding.fcVoiceStatus.text = label(Labels.LISTENING, "Speak now")
        binding.fcVoiceHint.text =
            label(Labels.VOICE_INPUT_IS_STILL_IMPROVING, "Keep background noise low")
        binding.fcPhotoTitle.text = label(Labels.PHOTOS, "Photos")
        binding.fcPhotoCameraLabel.text = label(Labels.CAMERA, "Camera")
        binding.fcPhotoGalleryLabel.text = label(Labels.GALLERY, "Gallery")
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
            val source = ViewCompat.getRootWindowInsets(view) ?: insets
            val ime = source.getInsets(WindowInsetsCompat.Type.ime()).bottom
            val navBar = source.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom
            view.updatePadding(bottom = maxOf(ime, navBar))
            insets
        }
        ViewCompat.requestApplyInsets(binding.fcOverlayRoot)
    }

    val isVisible: Boolean get() = binding.fcOverlayRoot.isVisible

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
        graph.analytics.track(AnalyticsEvents.MICROPHONE_CLICK_EVENT)
        requestMicThenRecord()
    }

    fun hide() {
        stopTimer()
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
    }

    fun setVoiceProcessing(processing: Boolean) {
        binding.fcVoiceProcessing.isVisible = processing
        binding.fcVoiceMain.isEnabled = !processing
        if (processing) {
            binding.fcVoiceStatus.text = label(Labels.PROCESSING, "Processing...")
        }
    }

    fun release() {
        stopTimer()
        recorder.release()
    }

    private fun cancelAndHide() {
        hide()
    }

    private fun showPanel(text: Boolean = false, voice: Boolean = false, photo: Boolean = false) {
        renderLabels()
        binding.fcOverlayRoot.isVisible = true
        binding.fcTextInputPanel.isVisible = text
        binding.fcVoicePanel.isVisible = voice
        binding.fcPhotoPanel.isVisible = photo
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
        binding.fcVoiceStatus.text = label(Labels.LISTENING, "Speak now")
        recordSeconds = 0
        binding.fcVoiceTimer.text = "0:00"
        if (recorder.startRecording()) {
            isRecording = true
            binding.fcVoiceTimer.postDelayed(timerTick, 1000L)
        } else {
            hide()
            onRecordingFailed()
        }
    }

    private fun stopRecordingAndSubmit() {
        graph.analytics.track(AnalyticsEvents.SEND_RECORD_AUDIO_CLICK_EVENT)
        stopTimer()
        isRecording = false
        val file = recorder.stopRecording()
        if (file != null) {
            onVoiceFinished(file)
        } else {
            hide()
            onRecordingFailed()
        }
    }

    private fun stopTimer() {
        binding.fcVoiceTimer.removeCallbacks(timerTick)
    }

    // ------------------------------------------------------------------ photo

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
            graph.analytics.track(AnalyticsEvents.INPUT_CAPTURE_FAILED)
        }
    }

    // ------------------------------------------------------------------ permissions

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    private fun bumpAttempt(key: String) {
        prefs.putInt(key, prefs.getInt(key, 0) + 1)
        graph.analytics.track(AnalyticsEvents.PERMISSION_POPUP_SHOWN)
    }

    private fun denyCount(key: String): Int = prefs.getInt(key, 0)

    private fun onPermissionResult(
        granted: Boolean,
        denyKey: String,
        isCamera: Boolean,
        onGranted: () -> Unit
    ) {
        if (granted) {
            graph.analytics.track(AnalyticsEvents.PERMISSION_GRANTED)
            prefs.putInt(denyKey, 0)
            onGranted()
        } else {
            graph.analytics.track(AnalyticsEvents.PERMISSION_DENIED)
            val denies = prefs.getInt(denyKey, 0) + 1
            prefs.putInt(denyKey, denies)
            if (denies >= 2) showSettingsDialog(isCamera)
        }
    }

    private fun showSettingsDialog(isCamera: Boolean) {
        graph.analytics.track(AnalyticsEvents.PERMISSION_FALLBACK_SETTING_SHOWN)
        val title = if (isCamera) {
            label(Labels.CAMERA_PERMISSION_REQUIRED, "Camera Permission Required")
        } else {
            label(Labels.MICROPHONE_PERMISSION_REQUIRED, "Microphone Permission Required")
        }
        val message = if (isCamera) {
            label(
                Labels.PLEASE_ENABLE_CAMERA_SETTINGS,
                "Camera permission is needed to take photos of your crops and get instant " +
                    "advice. Please enable it in your device settings."
            )
        } else {
            label(
                Labels.PLEASE_ENABLE_MICROPHONE_SETTINGS,
                "Microphone permission is needed to record your voice questions. Please " +
                    "enable it in your device settings."
            )
        }
        AlertDialog.Builder(context)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton(label(Labels.GO_TO_SETTINGS, "Go to Settings")) { _, _ ->
                graph.analytics.track(AnalyticsEvents.PERMISSION_FALLBACK_SETTING_CLICKED)
                runCatching {
                    context.startActivity(
                        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.fromParts("package", context.packageName, null)
                        }
                    )
                }
            }
            .setNegativeButton(label(Labels.CANCEL, "Cancel")) { dialog, _ ->
                graph.analytics.track(AnalyticsEvents.PERMISSION_FALLBACK_SETTING_CANCELED)
                dialog.dismiss()
            }
            .show()
    }
}
