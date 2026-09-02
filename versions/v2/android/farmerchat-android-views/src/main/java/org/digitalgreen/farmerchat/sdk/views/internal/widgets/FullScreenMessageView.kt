package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.content.Context
import android.util.AttributeSet
import android.view.LayoutInflater
import android.widget.FrameLayout
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFullScreenMessageBinding
import org.digitalgreen.farmerchat.sdk.views.internal.util.dp
import org.digitalgreen.farmerchat.sdk.views.internal.util.loadFarmerIllustration
import kotlin.math.min

/**
 * The shared green full-screen message layout (Compose FullScreenMessage parity):
 * yellow-glow app bar with 42dp green800 chips, capsule-clipped farmer
 * illustration (300:450), centered display text, 64dp forced-light primary button.
 */
internal class FullScreenMessageView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : FrameLayout(context, attrs) {

    private val binding: FcFullScreenMessageBinding

    init {
        setBackgroundColor(ContextCompat.getColor(context, R.color.fc_green700))
        binding = FcFullScreenMessageBinding.inflate(LayoutInflater.from(context), this)
        fitsSystemWindows = true
        binding.fcFsmIllustrationClip.clipToOutline = true
        // Maintain the 300:450 capsule aspect within the available slot.
        binding.fcFsmIllustrationClip.addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
            val parent = v.parent as? FrameLayout ?: return@addOnLayoutChangeListener
            val availableHeight = parent.height - parent.paddingTop - parent.paddingBottom
            if (availableHeight <= 0) return@addOnLayoutChangeListener
            val maxWidth = 300.dp(context)
            val targetWidth = min(maxWidth, availableHeight * 300 / 450)
            val targetHeight = targetWidth * 450 / 300
            val lp = v.layoutParams
            if (lp.width != targetWidth || lp.height != targetHeight) {
                lp.width = targetWidth
                lp.height = targetHeight
                v.post { v.layoutParams = lp }
            }
        }
    }

    fun bind(
        title: String,
        mainMessage: String,
        subtitle: String,
        primaryCtaLabel: String,
        primaryButtonState: PrimaryButtonView.State = PrimaryButtonView.State.DEFAULT,
        onPrimaryCta: (() -> Unit)?,
        illustrationAsset: String? = null,
        leftIconRes: Int? = R.drawable.fc_ic_back,
        onLeftClick: (() -> Unit)? = null,
        rightLabel: String? = null,
        onRightClick: (() -> Unit)? = null,
        secondaryCtaLabel: String? = null,
        onSecondaryCta: (() -> Unit)? = null
    ) {
        binding.fcFsmTitle.text = title
        binding.fcFsmMainMessage.text = mainMessage
        binding.fcFsmSubtitle.text = subtitle
        binding.fcFsmSubtitle.isVisible = subtitle.isNotBlank()

        binding.fcFsmPrimaryButton.text = primaryCtaLabel
        binding.fcFsmPrimaryButton.state = primaryButtonState
        binding.fcFsmPrimaryButton.isVisible = onPrimaryCta != null
        binding.fcFsmPrimaryButton.setOnClickListener { onPrimaryCta?.invoke() }

        binding.fcFsmLeftButton.isVisible = leftIconRes != null && onLeftClick != null
        leftIconRes?.let { binding.fcFsmLeftButton.setImageResource(it) }
        binding.fcFsmLeftButton.setOnClickListener { onLeftClick?.invoke() }

        binding.fcFsmRightLabel.isVisible = !rightLabel.isNullOrBlank()
        binding.fcFsmRightLabel.text = rightLabel
        binding.fcFsmRightLabel.setOnClickListener { onRightClick?.invoke() }

        binding.fcFsmSecondaryCta.isVisible = !secondaryCtaLabel.isNullOrBlank()
        binding.fcFsmSecondaryCta.text = secondaryCtaLabel
        binding.fcFsmSecondaryCta.setOnClickListener { onSecondaryCta?.invoke() }

        binding.fcFsmIllustrationClip.isVisible = illustrationAsset != null
        if (illustrationAsset != null) {
            binding.fcFsmIllustration.loadFarmerIllustration(illustrationAsset)
        }
    }

    fun setPrimaryState(state: PrimaryButtonView.State, label: String? = null) {
        binding.fcFsmPrimaryButton.state = state
        label?.let { binding.fcFsmPrimaryButton.text = it }
    }
}
