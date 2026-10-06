package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import android.content.Context
import android.util.AttributeSet
import android.view.Gravity
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.content.ContextCompat
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.util.dp

/** Voice clip row: play/pause + progress + duration (port of the app's VoiceClip). */
internal class VoiceClipView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    private val playButton = ImageButton(context).apply {
        background = ContextCompat.getDrawable(context, R.drawable.fc_bg_circle_surface)
        setImageResource(R.drawable.fc_ic_play)
        setColorFilter(FcTokens.color(context, R.color.fc_green700))
        contentDescription = null
    }
    private val progressBar = ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
        max = 1000
        progressTintList = FcTokens.colorStateList(context, R.color.fc_white)
    }
    private val durationLabel = TextView(context).apply {
        setTextColor(FcTokens.color(context, R.color.fc_white))
        textSize = 12f
    }

    var onPlayPauseClick: (() -> Unit)? = null

    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        addView(playButton, LayoutParams(36.dp(context), 36.dp(context)))
        addView(progressBar, LayoutParams(0, 4.dp(context), 1f).apply {
            marginStart = 10.dp(context)
            marginEnd = 10.dp(context)
        })
        addView(durationLabel, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))
        playButton.setOnClickListener { onPlayPauseClick?.invoke() }
    }

    fun setPlaying(playing: Boolean) {
        playButton.setImageResource(if (playing) R.drawable.fc_ic_pause else R.drawable.fc_ic_play)
    }

    /** progress 0..1 */
    fun setProgress(progress: Float) {
        progressBar.progress = (progress.coerceIn(0f, 1f) * 1000).toInt()
    }

    fun setDurationMs(durationMs: Long) {
        val totalSeconds = durationMs / 1000
        durationLabel.text = String.format("%d:%02d", totalSeconds / 60, totalSeconds % 60)
    }
}
