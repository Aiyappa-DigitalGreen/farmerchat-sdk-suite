package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.content.Context
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.isVisible
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import org.digitalgreen.farmerchat.sdk.views.internal.util.dp

/**
 * Full-width quick-reply chip — the Views port of the Compose `components/Chip.kt` (SDK 2.0.0).
 *
 * Used for the chips on an alignment surface. Visual treatment follows [Type]:
 * - [Type.SUGGESTED] the quiet treatment, also used for the unpicked chips once a pick exists.
 * - [Type.AGENTIC]   a live quick reply on a clarify / confirm / capability surface.
 * - [Type.ESCALATE]  the urgent treatment, derived from the SDK's feedback/fail color.
 *
 * A [selected] chip records a pick: it shows a check badge instead of its number, drops the
 * chevron and stops taking taps — selection wins over [enabled], because a recorded choice should
 * read as a record rather than a disabled control.
 */
internal class AgenticChipView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    enum class Type { SUGGESTED, AGENTIC, ESCALATE }

    private val badgeBox = FrameLayout(context)
    private val badgeNumber = TextView(context).apply {
        textSize = 15f // App ChipNumberBadge: labelMedium (was 13sp labelSmall)
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        gravity = Gravity.CENTER
    }
    private val badgeCheck = ImageView(context).apply {
        setImageResource(R.drawable.fc_ic_check)
        visibility = GONE
    }
    private val labelView = TextView(context).apply {
        textSize = 15f // labelMedium
    }
    private val chevron = ImageView(context).apply {
        setImageResource(R.drawable.fc_ic_chevron_right)
    }

    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(14.dp(context), 14.dp(context), 10.dp(context), 14.dp(context))

        val badge = 24.dp(context)
        badgeBox.addView(badgeNumber, FrameLayout.LayoutParams(badge, badge, Gravity.CENTER))
        badgeBox.addView(
            badgeCheck,
            FrameLayout.LayoutParams(16.dp(context), 16.dp(context), Gravity.CENTER)
        )
        addView(badgeBox, LayoutParams(badge, badge))
        addView(
            labelView,
            LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = 8.dp(context)
            }
        )
        addView(
            chevron,
            LayoutParams(badge, badge).apply { marginStart = 8.dp(context) }
        )
    }

    /**
     * Applies the chip's whole visual state. Every branch sets every slot, so a recycled chip
     * never inherits the previous row's colors, badge or click listener.
     */
    fun bind(
        text: CharSequence,
        number: Int?,
        type: Type,
        enabled: Boolean,
        selected: Boolean,
        onClick: () -> Unit
    ) {
        val isEscalate = type == Type.ESCALATE
        val fail = FcTokens.fail(context)
        val accent = FcTokens.accent(context)
        val onBrand = FcTokens.onBrand(context)
        val foregroundPrimary = FcTokens.color(context, R.color.fc_foreground_primary)
        val foregroundSecondary = FcTokens.color(context, R.color.fc_foreground_secondary)
        val foregroundTertiary = FcTokens.color(context, R.color.fc_foreground_tertiary)
        val surfaceTertiary = FcTokens.color(context, R.color.fc_surface_tertiary)

        // A selected chip records a pick: no taps, no chevron.
        val clickable = enabled && !selected
        // The accent marking a pick — fail on the urgent surface, brand accent elsewhere, so the
        // ring and check badge stay coherent instead of dropping green onto a red card.
        val selectedAccent = if (isEscalate) fail else accent

        val surfaceColor = when {
            // App escalateSurface: fail @ 8%.
            selected -> if (isEscalate) FcTokens.withAlpha(fail, 0.08f) else FcTokens.surfaceActive(context)
            !enabled -> surfaceTertiary
            isEscalate -> fail
            type == Type.AGENTIC -> FcTokens.surfaceActive(context)
            else -> FcTokens.color(context, R.color.fc_surface_reading_secondary)
        }
        val labelColor = when {
            selected -> foregroundPrimary
            // Muted but readable: fc_foreground_tertiary collides with fc_surface_tertiary in
            // values-night (both #3F3F46), which made disabled chip text invisible. App
            // components/chips/Chip.kt @ 0c8c740f (e335413b).
            !enabled -> foregroundSecondary
            isEscalate -> onBrand
            else -> foregroundPrimary
        }
        val chevronColor = when {
            !enabled -> foregroundTertiary
            isEscalate -> onBrand
            type == Type.AGENTIC -> accent
            else -> foregroundSecondary
        }

        background = when {
            selected -> FcTokens.roundedRect(context, RADIUS_MD, surfaceColor, 1.5f, selectedAccent)
            !enabled -> FcTokens.roundedRect(
                context,
                RADIUS_MD,
                surfaceColor,
                0.5f,
                FcTokens.color(context, R.color.fc_border_default)
            )
            else -> FcTokens.roundedRect(context, RADIUS_MD, surfaceColor)
        }

        labelView.text = text
        labelView.setTextColor(labelColor)
        // App Chip.kt: labelMedium (w600), Bold once picked. Unselected rendered at 400 here.
        labelView.typeface = if (selected) {
            Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        } else if (android.os.Build.VERSION.SDK_INT >= 28) {
            Typeface.create(Typeface.SANS_SERIF, 600, false)
        } else {
            Typeface.create("sans-serif-medium", Typeface.NORMAL)
        }

        chevron.isVisible = clickable
        chevron.setColorFilter(chevronColor)

        // Leading badge: the check replaces the number once a pick is recorded.
        badgeCheck.isVisible = selected
        badgeNumber.isVisible = !selected && number != null
        badgeBox.isVisible = selected || number != null
        if (selected) {
            badgeBox.background = FcTokens.roundedRect(context, BADGE_RADIUS, selectedAccent)
            badgeCheck.setColorFilter(onBrand)
        } else if (number != null) {
            val badgeFill = when {
                // The disabled badge circle used to be fc_surface_tertiary — exactly the
                // disabled chip surface — so it vanished into the chip in BOTH themes. Muted
                // secondary foreground instead, as the app does (97832e9a).
                !enabled -> foregroundSecondary
                // App Chip.kt:177,184: a solid onBrand circle with the numeral in fail.
                isEscalate -> onBrand
                else -> accent
            }
            // Echo the chip surface on the muted disabled badge so the numeral stays legible in
            // both themes; fc_foreground_tertiary here was the same #3F3F46 as the circle.
            val badgeFg = when {
                !enabled -> surfaceTertiary
                isEscalate -> fail
                else -> onBrand
            }
            badgeBox.background = FcTokens.roundedRect(context, BADGE_RADIUS, badgeFill)
            badgeNumber.text = number.toString()
            badgeNumber.setTextColor(badgeFg)
        } else {
            badgeBox.background = null
        }

        isEnabled = clickable
        isClickable = clickable
        isFocusable = clickable
        if (clickable) setOnClickListener { onClick() } else setOnClickListener(null)
    }

    private companion object {
        const val RADIUS_MD = 12f
        const val BADGE_RADIUS = 999f
    }
}
