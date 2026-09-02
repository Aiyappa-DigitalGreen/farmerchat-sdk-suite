package org.digitalgreen.farmerchat.sdk.core.audio

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.util.Base64
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

/**
 * Voice-query recorder. OGG/OPUS 48 kHz on API 29+, MPEG-4/AAC fallback below.
 * Output is base64-encoded for the transcribe_audio endpoint. Direct port of the
 * app's AudioRecorder.
 */
class AudioRecorder(private val context: Context) {
    private var mediaRecorder: MediaRecorder? = null
    private var audioFile: File? = null
    private var fileOutputStream: FileOutputStream? = null
    private var isRecording = false

    fun startRecording(): Boolean {
        return try {
            val fileExtension = if (Build.VERSION.SDK_INT > Build.VERSION_CODES.P) "ogg" else "m4a"
            audioFile = File(context.cacheDir, "fc_sdk_audio_${System.currentTimeMillis()}.$fileExtension")
            audioFile?.createNewFile()
            val fos = FileOutputStream(audioFile)
            fileOutputStream = fos

            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                if (Build.VERSION.SDK_INT > Build.VERSION_CODES.P) {
                    setOutputFormat(MediaRecorder.OutputFormat.OGG)
                    setAudioEncoder(MediaRecorder.AudioEncoder.OPUS)
                } else {
                    setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                    setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                }
                setOutputFile(fos.fd)
                setAudioSamplingRate(48000)
                prepare()
                start()
            }
            isRecording = true
            true
        } catch (e: IOException) {
            Log.e(TAG, "Failed to start recording", e)
            resetAfterFailure()
            false
        } catch (e: Exception) {
            Log.e(TAG, "Error starting recording", e)
            resetAfterFailure()
            false
        }
    }

    private fun resetAfterFailure() {
        closeOutputStream()
        mediaRecorder?.release()
        mediaRecorder = null
        audioFile?.delete()
        audioFile = null
    }

    private fun closeOutputStream() {
        try {
            fileOutputStream?.close()
        } catch (e: Exception) {
            Log.e(TAG, "Error closing output stream", e)
        }
        fileOutputStream = null
    }

    fun stopRecording(): File? {
        return try {
            if (isRecording && mediaRecorder != null) {
                mediaRecorder?.apply {
                    stop()
                    release()
                }
                mediaRecorder = null
                isRecording = false
                closeOutputStream()
                val file = audioFile
                audioFile = null
                if (file != null && file.exists() && file.length() > 0) {
                    file
                } else {
                    file?.delete()
                    null
                }
            } else {
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping recording", e)
            closeOutputStream()
            mediaRecorder?.release()
            mediaRecorder = null
            isRecording = false
            audioFile?.delete()
            audioFile = null
            null
        }
    }

    fun cancelRecording() {
        try {
            if (isRecording && mediaRecorder != null) {
                mediaRecorder?.apply {
                    stop()
                    release()
                }
                mediaRecorder = null
                isRecording = false
            }
            closeOutputStream()
            audioFile?.delete()
            audioFile = null
        } catch (e: Exception) {
            Log.e(TAG, "Error cancelling recording", e)
            closeOutputStream()
            mediaRecorder?.release()
            mediaRecorder = null
            isRecording = false
        }
    }

    fun release() {
        try {
            closeOutputStream()
            mediaRecorder?.release()
            mediaRecorder = null
            isRecording = false
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing recorder", e)
        }
    }

    companion object {
        private const val TAG = "FcSdkAudioRecorder"

        /** Convert an audio file to a base64 string (NO_WRAP, as the backend expects). */
        fun convertAudioToBase64(file: File): String? {
            return try {
                Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
            } catch (e: Exception) {
                Log.e(TAG, "Error converting to base64", e)
                null
            }
        }

        /** `input_audio_encoding_format` value per platform capability. */
        fun getAudioFormat(): String {
            return if (Build.VERSION.SDK_INT > Build.VERSION_CODES.P) "ogg" else "aac"
        }
    }
}
