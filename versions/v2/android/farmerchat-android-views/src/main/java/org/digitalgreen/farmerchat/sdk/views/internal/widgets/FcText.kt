package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.content.Context
import android.util.AttributeSet
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.AbstractComposeView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.sp
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTypography
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcViewTheme
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp

/**
 * A text view that renders through **Compose** instead of `TextView`.
 *
 * ## Why this exists
 *
 * A `TextView` cannot be made pixel-identical to the app's Compose text, and this was established
 * by measurement rather than assumption. Against the reference app on emulator-5554, the Settings
 * screen:
 *
 * | | diff vs the app |
 * |---|---|
 * | `farmerchat-android-compose` | **0.15%** |
 * | `farmerchat-android-views` (TextView) | **5.3%** |
 *
 * Two cheaper fixes were tried first and are already in the tree because they were genuinely
 * wrong:
 *
 *  1. **Font weight synthesis.** `android:textFontWeight` only interpolates against a *named*
 *     family; with the default typeface it snapped to normal/bold, so a nominal 600 rendered at
 *     400's width (180px against the app's 189px). Adding `android:fontFamily="sans-serif"` to
 *     the default TextView style fixed the metrics — the title went to 191px and the 400-weight
 *     hint line to **exactly** the app's 900px.
 *  2. **Paint flags.** Both Compose and `TextView` lay out through `StaticLayout`, so identical
 *     metrics ought to mean identical pixels. Forcing `SUBPIXEL_TEXT_FLAG` and
 *     `LINEAR_TEXT_FLAG` changed the diff by 0.06% — i.e. nothing. Reverted.
 *
 * With metrics matched, one aligned line of the SAME string at the SAME width (900px on both)
 * still differed by **12,784 pixels** — more than the 8,866 pixels of ink it occupies — while the
 * app-vs-compose diff for that same band was **0**. The remainder is the glyph rasteriser itself,
 * and the only way to match it is to use the same one.
 *
 * ## Why it is not a `TextView` subclass
 *
 * A `TextView` draws its own text; there is no hook to substitute the rasteriser. This extends
 * [AbstractComposeView] instead, and exposes a `text` property so that existing view-binding call
 * sites (`binding.someText.text = "..."`) keep compiling unchanged.
 *
 * ## NOT for recycled rows
 *
 * Each instance is a composition host. Measured on the views Home feed (emulator-5554, 700+
 * frames of flinging) with ONE converted title per row:
 *
 * | | TextView | FcText |
 * |---|---|---|
 * | janky frames | 0.00% | **3.25%** |
 * | janky (legacy) | 17.86% | **96.19%** |
 * | 90th percentile | 19ms | **34ms** |
 * | 99th percentile | 24ms | **73ms** |
 *
 * 73ms is four times the 16.7ms budget — visible stutter. **Use this on static screens only.**
 * `HomeFeedAdapter`, `LanguageListAdapter`, `ChatAdapter` and the drawer's recent-chat rows keep
 * `TextView`, and accept the text-rasterisation difference as the price of smooth scrolling.
 *
 * ## Why views does not depend on `:farmerchat-android-compose`
 *
 * Doing so would put that module's `FarmerChatActivity` on every views host's classpath, and
 * `FarmerChat.resolveActivityClass()` tries the compose activity FIRST — a views host would
 * silently launch the Compose UI. So this module takes the raw Compose libraries and mirrors the
 * few type values it needs; [assertMatchesComposeTypography] guards the mirror.
 */
/** Host [org.digitalgreen.farmerchat.sdk.FarmerChatTheme.fontFamily] as a Compose family, or null. */
internal val hostFontFamily: FontFamily? by lazy {
    FcViewTheme.hostTheme()?.fontFamily?.let { FontFamily(Font(it)) }
}

internal class FcText @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : AbstractComposeView(context, attrs) {

    private var textState by mutableStateOf<CharSequence>("")
    private var sizeSp by mutableStateOf(17f)
    private var weight by mutableStateOf(400)
    private var colorInt by mutableStateOf(0xFF1C2B26.toInt())
    private var maxLinesState by mutableStateOf(Int.MAX_VALUE)
    private var ellipsizeEnd by mutableStateOf(false)
    private var alignState by mutableStateOf(TextAlign.Start)
    private var iconRes by mutableStateOf(0)
    private var iconTint by mutableStateOf(0)
    private var iconSizeDp by mutableStateOf(24f)
    private var iconGapDp by mutableStateOf(12f)
    private var languageCode: String = "en"
    private var lineHeightOverrideSp by mutableStateOf(0f)
    private var italic by mutableStateOf(false)
    private var untrimmed by mutableStateOf(false)

    init {
        context.obtainStyledAttributes(attrs, R.styleable.FcText).use { a ->
            a.getString(R.styleable.FcText_fcText)?.let { textState = it }
            sizeSp = a.getFloat(R.styleable.FcText_fcTextSizeSp, 17f)
            weight = a.getInt(R.styleable.FcText_fcTextWeight, 400)
            // A token reference goes through the host theme (this is not a TextView, so the
            // inflation factory can't recolour it); a literal colour is used as given.
            colorInt = a.getResourceId(R.styleable.FcText_fcTextColor, 0).takeIf { it != 0 }
                ?.let { runCatching { FcTokens.color(context, it) }.getOrNull() }
                ?: a.getColor(R.styleable.FcText_fcTextColor, colorInt)
            maxLinesState = a.getInt(R.styleable.FcText_fcMaxLines, Int.MAX_VALUE)
            ellipsizeEnd = a.getBoolean(R.styleable.FcText_fcEllipsize, false)
            iconRes = a.getResourceId(R.styleable.FcText_fcDrawableStart, 0)
            iconTint = a.getResourceId(R.styleable.FcText_fcDrawableTint, 0).takeIf { it != 0 }
                ?.let { runCatching { FcTokens.color(context, it) }.getOrNull() }
                ?: a.getColor(R.styleable.FcText_fcDrawableTint, 0)
            iconSizeDp = a.getFloat(R.styleable.FcText_fcDrawableSizeDp, 24f)
            iconGapDp = a.getFloat(R.styleable.FcText_fcDrawablePaddingDp, 12f)
            lineHeightOverrideSp = a.getFloat(R.styleable.FcText_fcLineHeightSp, 0f)
            italic = a.getBoolean(R.styleable.FcText_fcTextItalic, false)
            untrimmed = a.getBoolean(R.styleable.FcText_fcLineHeightUntrimmed, false)
            alignState = when (a.getInt(R.styleable.FcText_fcTextAlign, 0)) {
                1 -> TextAlign.Center
                2 -> TextAlign.End
                else -> TextAlign.Start
            }
        }
    }

    /**
     * Mirrors `TextView.text` so existing view-binding call sites keep working — including its
     * NULLABLE setter, which several call sites rely on (`binding.x.text = someNullableString`).
     */
    var text: CharSequence?
        get() = textState
        set(value) { textState = value ?: "" }

    /**
     * Mirrors `TextView.setCompoundDrawablesRelativeWithIntrinsicBounds(start, …)` for the one
     * case the flavour needs: a leading icon. The drawer's nav rows use `android:drawableStart`,
     * which is why they could not convert until this existed.
     */
    fun setLeadingDrawable(resId: Int) { iconRes = resId }

    /** Mirrors `TextView.setTextColor(Int)`. */
    fun setTextColor(color: Int) { colorInt = color }

    /** Programmatic equivalents of the XML attributes, for views built in code. */
    fun setTextSizeSp(sp: Float) { sizeSp = sp }
    fun setTextWeight(w: Int) { weight = w }
    fun setMaxLines(n: Int) { maxLinesState = n }

    /** The script whose line-height table applies; see [FcTypography]. */
    fun setLanguageCode(code: String) { languageCode = code }

    @Composable
    override fun Content() {
        // Line height comes from the same per-script table the inflater factory applies to
        // TextViews, so a converted view keeps the Indic line spacing it already had.
        val lineHeight = lineHeightOverrideSp.takeIf { it > 0f }
            ?: FcTypography.lineHeightSp(sizeSp.toInt(), languageCode)?.toFloat()
            ?: (sizeSp * 1.3f)
        // BasicText, not material3's Text: this module deliberately does not depend on
        // material3 — the only thing needed from Compose here is the glyph rasteriser, and
        // BasicText is the primitive that provides it with no theming attached.
        val body: @Composable () -> Unit = {
        BasicText(
            text = textState.toAnnotated(),
            style = TextStyle(
                // The app's Type.kt builds every style over the system SansSerif family; a host
                // FarmerChatTheme.fontFamily replaces it (weights are synthesised from one file).
                fontFamily = hostFontFamily ?: FontFamily.SansSerif,
                fontSize = sizeSp.sp,
                lineHeight = lineHeight.sp,
                fontWeight = FontWeight(weight),
                fontStyle = if (italic) FontStyle.Italic else FontStyle.Normal,
                lineHeightStyle = if (untrimmed) {
                    androidx.compose.ui.text.style.LineHeightStyle(
                        alignment = androidx.compose.ui.text.style.LineHeightStyle.Alignment.Center,
                        trim = androidx.compose.ui.text.style.LineHeightStyle.Trim.None
                    )
                } else null,
                textAlign = alignState,
                color = Color(colorInt)
            ),
            maxLines = maxLinesState,
            overflow = if (ellipsizeEnd) TextOverflow.Ellipsis else TextOverflow.Clip
        )
        }

        if (iconRes == 0) {
            body()
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painter = painterResource(id = iconRes),
                    contentDescription = null,
                    // A zero tint means "leave the drawable's own colours", which matters:
                    // `fc_icon_*` carry their own brand green, and tinting them flat was a real
                    // defect on the drawer rows.
                    colorFilter = if (iconTint != 0) ColorFilter.tint(Color(iconTint)) else null,
                    modifier = Modifier.size(iconSizeDp.dp)
                )
                Spacer(modifier = Modifier.width(iconGapDp.dp))
                body()
            }
        }
    }
}

private inline fun <R> android.content.res.TypedArray.use(block: (android.content.res.TypedArray) -> R): R {
    try {
        return block(this)
    } finally {
        recycle()
    }
}

/**
 * Carries the span styling call sites actually use across to Compose text — colour, underline,
 * bold/italic. Without this a `SpannableStringBuilder` lost its styling at `toString()`, e.g.
 * Settings' "Share your location for better advice." rendered grey where the app draws Green700.
 */
private fun CharSequence.toAnnotated(): androidx.compose.ui.text.AnnotatedString {
    if (this !is android.text.Spanned) return androidx.compose.ui.text.AnnotatedString(toString())
    val spanned = this
    return androidx.compose.ui.text.buildAnnotatedString {
        append(spanned.toString())
        spanned.getSpans(0, spanned.length, Any::class.java).forEach { span ->
            val start = spanned.getSpanStart(span)
            val end = spanned.getSpanEnd(span)
            val style = when (span) {
                is android.text.style.ForegroundColorSpan ->
                    androidx.compose.ui.text.SpanStyle(color = Color(span.foregroundColor))
                is android.text.style.UnderlineSpan ->
                    androidx.compose.ui.text.SpanStyle(
                        textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline
                    )
                is android.text.style.StyleSpan -> androidx.compose.ui.text.SpanStyle(
                    fontWeight = if (span.style and android.graphics.Typeface.BOLD != 0) FontWeight.Bold else null,
                    fontStyle = if (span.style and android.graphics.Typeface.ITALIC != 0) FontStyle.Italic else null
                )
                else -> null
            }
            if (style != null && start < end) addStyle(style, start, end)
        }
    }
}
