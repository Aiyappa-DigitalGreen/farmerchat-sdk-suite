package org.digitalgreen.farmerchat.sdk.core.audio

import android.content.Context
import android.media.MediaMetadataRetriever
import android.media.MediaPlayer
import android.net.Uri
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL

/**
 * Shared audio playback helper for voice-clip bubbles and Listen (TTS) audio.
 * Wraps a single [MediaPlayer]; both UI packages drive it from their screens.
 */
class AudioPlayback {

    private var mediaPlayer: MediaPlayer? = null
    var currentSourceKey: String? = null
        private set

    val isPlaying: Boolean
        get() = runCatching { mediaPlayer?.isPlaying == true }.getOrDefault(false)

    val currentPositionMs: Int
        get() = runCatching { mediaPlayer?.currentPosition ?: 0 }.getOrDefault(0)

    val durationMs: Int
        get() = runCatching { mediaPlayer?.duration ?: 0 }.getOrDefault(0)

    /**
     * Start playing [source] (file path, content URI or http(s) URL). Any previous
     * playback is stopped. [onCompletion] fires when playback finishes naturally.
     */
    fun play(
        context: Context,
        source: String,
        onPrepared: (() -> Unit)? = null,
        onCompletion: (() -> Unit)? = null,
        onError: ((Throwable) -> Unit)? = null
    ) {
        stop()
        try {
            val player = MediaPlayer()
            mediaPlayer = player
            currentSourceKey = source
            if (source.startsWith("http://") || source.startsWith("https://")) {
                player.setDataSource(source)
            } else {
                player.setDataSource(context, Uri.parse(source))
            }
            player.setOnPreparedListener {
                it.start()
                onPrepared?.invoke()
            }
            player.setOnCompletionListener {
                onCompletion?.invoke()
            }
            player.setOnErrorListener { _, what, extra ->
                onError?.invoke(IllegalStateException("MediaPlayer error what=$what extra=$extra"))
                true
            }
            player.prepareAsync()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play audio", e)
            onError?.invoke(e)
            stop()
        }
    }

    fun pause() {
        runCatching { mediaPlayer?.pause() }
    }

    fun resume() {
        runCatching { mediaPlayer?.start() }
    }

    fun stop() {
        runCatching {
            mediaPlayer?.stop()
            mediaPlayer?.release()
        }
        mediaPlayer = null
        currentSourceKey = null
    }

    fun release() = stop()

    companion object {
        private const val TAG = "FcSdkAudioPlayback"

        /**
         * Preload the duration of an audio source in ms. Http OGG streams are
         * downloaded to a temp file first because [MediaMetadataRetriever] cannot
         * always stream them (app behavior).
         */
        suspend fun getAudioDurationMs(context: Context, source: String): Long =
            withContext(Dispatchers.IO) {
                val retriever = MediaMetadataRetriever()
                var tempFile: File? = null
                try {
                    if (source.startsWith("http://") || source.startsWith("https://")) {
                        tempFile = File.createTempFile("fc_sdk_dur_", ".audio", context.cacheDir)
                        URL(source).openStream().use { input ->
                            tempFile.outputStream().use { output -> input.copyTo(output) }
                        }
                        retriever.setDataSource(tempFile.absolutePath)
                    } else {
                        retriever.setDataSource(context, Uri.parse(source))
                    }
                    retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                        ?.toLongOrNull() ?: 0L
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to read duration", e)
                    0L
                } finally {
                    runCatching { retriever.release() }
                    tempFile?.delete()
                }
            }
    }
}
