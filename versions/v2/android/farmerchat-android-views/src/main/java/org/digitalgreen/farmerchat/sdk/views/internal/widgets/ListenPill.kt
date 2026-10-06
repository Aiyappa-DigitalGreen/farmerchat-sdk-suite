package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.view.View
import android.widget.TextView
import androidx.annotation.DrawableRes
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens

/**
 * The Listen pill — app `components/buttons/ListenButton.kt` (`light = true`), shared by the
 * answer's action row and the alignment surface. One pill TextView ([R.style.FcChatAction]) plus
 * a 20dp spinner laid over its start:
 *
 * - idle    — VolumeUp 23dp + "Listen" (6dp gap)
 * - loading — the spinner where the icon sits + "Loading..." (8dp gap)
 * - playing — Pause 23dp + a 54x26dp animated sound wave (6dp gap), no label
 * - paused  — (audio fetched, not playing) PlayArrow 23dp + the same wave, still
 * - disabled (TTS off) — 40% alpha, no taps
 */
internal object ListenPill {

    fun bind(
        pill: TextView,
        spinner: View,
        loading: Boolean,
        playing: Boolean,
        hasAudioUrl: Boolean,
        enabled: Boolean,
        labelFor: (String, String) -> String,
        onClick: () -> Unit
    ) {
        val density = pill.resources.displayMetrics.density
        fun dp(v: Int) = (v * density).toInt()
        (pill.getTag(R.id.fcListenWaveTag) as? SoundWaveDrawable)?.stop()
        pill.setTag(R.id.fcListenWaveTag, null)
        spinner.isVisible = loading
        when {
            loading -> {
                pill.text = labelFor(Labels.LOADING, "Loading...")
                pill.setCompoundDrawablesRelative(null, null, null, null)
                // The spinner occupies the icon slot: 12dp start, 20dp wide, 8dp gap.
                pill.setPaddingRelative(dp(12 + 20 + 8), pill.paddingTop, dp(12), pill.paddingBottom)
            }
            playing || hasAudioUrl -> {
                pill.text = ""
                val wave = SoundWaveDrawable(density, FcTokens.accent(pill.context)).apply {
                    setBounds(0, 0, intrinsicWidth, intrinsicHeight)
                    if (playing) start()
                }
                pill.setTag(R.id.fcListenWaveTag, wave)
                pill.setCompoundDrawablesRelative(
                    icon(pill, if (playing) R.drawable.fc_ic_pause else R.drawable.fc_ic_play),
                    null, wave, null
                )
                pill.compoundDrawablePadding = dp(6)
                pill.setPaddingRelative(dp(12), pill.paddingTop, dp(12), pill.paddingBottom)
            }
            else -> {
                pill.text = labelFor(Labels.LISTEN, "Listen")
                pill.setCompoundDrawablesRelative(icon(pill, R.drawable.fc_ic_volume_up), null, null, null)
                pill.compoundDrawablePadding = dp(6)
                pill.setPaddingRelative(dp(12), pill.paddingTop, dp(12), pill.paddingBottom)
            }
        }
        pill.alpha = if (enabled) 1f else 0.4f
        pill.isEnabled = enabled && !loading
        pill.setOnClickListener(if (enabled) View.OnClickListener { onClick() } else null)
    }

    /** A pill icon at the app's 23dp (the vector drawables are 24dp intrinsically). */
    fun icon(pill: TextView, @DrawableRes res: Int) =
        ContextCompat.getDrawable(pill.context, res)?.mutate()?.apply {
            val size = (23 * pill.resources.displayMetrics.density).toInt()
            setBounds(0, 0, size, size)
        }
}
