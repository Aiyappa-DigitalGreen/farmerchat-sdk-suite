package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.content.Context
import android.util.AttributeSet
import android.view.Gravity
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.StreamErrorKind
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcRecolor
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import org.digitalgreen.farmerchat.sdk.views.internal.util.dp

/**
 * Inline card shown when an agentic stream ends without a complete answer (SDK 2.0.0) — the Views
 * port of the Compose `components/StreamErrorCard.kt`.
 *
 * Renders below the AI response, below the preserved partial text if any, with a state-specific
 * message and a full-width "Try again" that dispatches `ChatAction.RetryLastRequest`.
 *
 * The copy is driven by BOTH the error kind and whether partial text survived, because "we lost
 * the connection but kept what you have" and "nothing arrived" are very different messages:
 * - partial text present → "Connection stopped. Your partial answer is saved."
 * - network, no partial  → "No internet connection"
 * - otherwise            → "Something went wrong"
 *
 * The tint is derived from the SDK's feedback/fail color, so a host that themes `error` gets its
 * own failure color rather than a hardcoded red.
 */
internal class StreamErrorCardView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    private val icon = ImageView(context)
    private val title = TextView(context).apply {
        textSize = 17f // bodyMedium
        setTextColor(FcTokens.color(context, R.color.fc_foreground_primary))
    }
    private val header = LinearLayout(context).apply {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
    }
    private val retry = PrimaryButtonView(context)

    init {
        orientation = VERTICAL
        setPadding(16.dp(context), 16.dp(context), 16.dp(context), 16.dp(context))

        header.addView(icon, LayoutParams(20.dp(context), 20.dp(context)))
        header.addView(
            title,
            LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = 10.dp(context)
            }
        )
        addView(header, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        addView(
            retry,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
                topMargin = 12.dp(context)
            }
        )
        // This card is built in code, so [FcThemeInflaterFactory] (which only sees INFLATED views)
        // never reaches the button. Recolor it explicitly, otherwise a host-themed SDK would show
        // a default-green "Try again" next to XML-inflated buttons in the host's brand color.
        FcRecolor.maybeRecolor(retry)
    }

    fun bind(
        errorKind: StreamErrorKind,
        hasPartial: Boolean,
        labelFor: (String, String) -> String,
        onRetry: () -> Unit
    ) {
        val fail = FcTokens.fail(context)
        background = FcTokens.roundedRect(
            context,
            RADIUS_MD,
            FcTokens.withAlpha(fail, 0.08f),
            1f,
            FcTokens.withAlpha(fail, 0.16f)
        )

        title.text = when {
            hasPartial -> labelFor(
                Labels.CONNECTION_STOPPED_PARTIAL_SAVED,
                "Connection stopped. Your partial answer is saved."
            )
            errorKind == StreamErrorKind.NETWORK ->
                labelFor(Labels.NO_INTERNET_CONNECTION, "No internet connection")
            else -> labelFor(Labels.SOMETHING_WENT_WRONG, "Something went wrong")
        }
        title.setTextColor(FcTokens.color(context, R.color.fc_foreground_primary))

        icon.setImageResource(
            if (errorKind == StreamErrorKind.NETWORK) R.drawable.fc_ic_wifi_off
            else R.drawable.fc_ic_warning
        )
        icon.setColorFilter(fail)

        retry.text = labelFor(Labels.TRY_AGAIN, "Try again")
        retry.state = PrimaryButtonView.State.DEFAULT
        retry.setOnClickListener { onRetry() }
    }

    private companion object {
        const val RADIUS_MD = 12f
    }
}
