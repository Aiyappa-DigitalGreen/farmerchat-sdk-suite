package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import androidx.core.view.updateLayoutParams
import androidx.core.view.updatePadding
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.ViewCompat
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
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
        setBackgroundColor(FcTokens.color(context, R.color.fc_green700))
        binding = FcFullScreenMessageBinding.inflate(LayoutInflater.from(context), this)
        // App parity: the glow app bar draws behind the status bar (compose `FullScreenMessage`
        // is edge-to-edge); only its content is pushed below it, and the CTA clears the nav bar.
        // `fitsSystemWindows` padded the whole screen instead, leaving a flat strip up top.
        val barHeight = 64.dp(context)
        ViewCompat.setOnApplyWindowInsetsListener(this) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            // The bar's padding pushes the chips/title below the status bar; the glow image is
            // pulled back up into that padding (FrameLayout lays children out inside padding).
            binding.fcFsmAppBar.clipToPadding = false
            binding.fcFsmAppBar.updatePadding(top = bars.top)
            binding.fcFsmAppBar.updateLayoutParams { height = barHeight + bars.top }
            binding.fcFsmGlow.updateLayoutParams<FrameLayout.LayoutParams> {
                topMargin = -bars.top
                height = barHeight + bars.top
            }
            binding.fcFsmRoot.updatePadding(left = bars.left, right = bars.right, bottom = bars.bottom)
            insets
        }
        binding.fcFsmIllustrationClip.clipToOutline = true
        // Maintain the 300:450 capsule aspect within the available slot.
        binding.fcFsmIllustrationClip.addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
            val parent = v.parent as? FrameLayout ?: return@addOnLayoutChangeListener
            val availableHeight = parent.height - parent.paddingTop - parent.paddingBottom
            if (availableHeight <= 0) return@addOnLayoutChangeListener
            // App parity: every screen that uses this view (Error / NoInternet, location prompt,
            // account benefits/success) passes its own illustration at `widthIn(max = 322.dp)`
            // (NoInternetScreen.kt:302, LocationPromptHost.kt). 300dp is only the app's fallback
            // box, which none of these hit, so views drew the farmer ~7% smaller.
            val maxWidth = 322.dp(context)
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
        onSecondaryCta: (() -> Unit)? = null,
        /**
         * Subtitle size in sp — the Views stand-in for the app's `subtitleTextStyle` parameter.
         * Defaults to bodyMedium (17sp), which is what every screen but account-success uses.
         */
        subtitleSizeSp: Float = 17f
    ) {
        binding.fcFsmTitle.text = title
        binding.fcFsmMainMessage.text = mainMessage
        binding.fcFsmSubtitle.text = subtitle
        binding.fcFsmSubtitle.isVisible = subtitle.isNotBlank()
        // App parity: the app's `FullScreenMessage` takes a `subtitleTextStyle`, defaulting to
        // bodyMedium (17sp) and overridden to bodyLarge (19sp) by the account-success screen.
        // Views had no equivalent, so that screen rendered its subtitle a step small.
        binding.fcFsmSubtitle.setTextSize(
            android.util.TypedValue.COMPLEX_UNIT_SP,
            subtitleSizeSp
        )

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
