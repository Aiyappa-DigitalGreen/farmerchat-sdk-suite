package org.digitalgreen.farmerchat.sdk.views.internal.util

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.text.Layout
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.LeadingMarginSpan
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan

/**
 * Minimal markdown renderer for AI responses (no third-party libs):
 * **bold**, *italic* / _italic_, `- ` / `* ` bullet lines, `#`..`###` headings.
 */
internal object Markdown {

    /**
     * @param density `resources.displayMetrics.density`, used to size the bullet to the app's
     *   dp spec. Defaults to 1f only so the parser stays unit-testable without a Context.
     */
    @JvmOverloads
    fun render(source: String, density: Float = 1f): CharSequence {
        val out = SpannableStringBuilder()
        val blocks = parseBlocks(source)

        blocks.forEachIndexed { index, block ->
            val prev = blocks.getOrNull(index - 1)

            // App parity (components/MarkdownText.kt:120): fixed inter-block spacing. The blank
            // lines in the source do NOT survive — the app parses to blocks and spaces them
            // itself, so a response with a blank line before its list, or trailing newlines after
            // it, rendered with dead bands in the views flavour that the app never shows.
            val topSpacingDp = when {
                index == 0 -> 0
                block is Block.Divider -> 24
                prev is Block.Divider -> 24
                block is Block.Header -> 24
                prev is Block.Header -> 20
                block is Block.Bullet && prev is Block.Bullet -> 5
                block is Block.Numbered && prev is Block.Numbered -> 5
                block is Block.Quote && prev is Block.Quote -> 5
                block is Block.Paragraph && prev is Block.Paragraph -> 20
                else -> 12
            }

            // The gap is added ABOVE the block's first line by a LineHeightSpan. It used to be
            // an AbsoluteSizeSpan on the separating "\n", which only ends the previous line and
            // never produces an empty one — so consecutive paragraphs rendered with no gap at
            // all where the app leaves 20dp (measured on rs_qa, same answer, 2026-09-28).
            if (index > 0) out.append("\n")

            val lineStart = out.length
            if (block is Block.Divider) {
                // One placeholder character; DividerSpan sizes the line to 3dp and draws the bar.
                out.append(" ")
                out.setSpan(
                    DividerSpan(density, (topSpacingDp * density).toInt()),
                    lineStart, out.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                )
                return@forEachIndexed
            }
            appendInline(out, block.text)
            val lineEnd = out.length
            if (lineEnd == lineStart) return@forEachIndexed
            if (topSpacingDp > 0) {
                out.setSpan(
                    BlockGapSpan((topSpacingDp * density).toInt()),
                    lineStart, lineEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                )
            }

            when (block) {
                is Block.Bullet -> out.setSpan(
                    FcBulletSpan(density), lineStart, lineEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                )
                is Block.Numbered -> Unit // the "1." prefix is part of the text
                is Block.Quote -> out.setSpan(
                    QuoteBarSpan(density), lineStart, lineEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                )
                is Block.Header -> {
                    out.setSpan(
                        StyleSpan(Typeface.BOLD), lineStart, lineEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                    // App: # titleLarge 22sp, ## titleMedium 18sp, ### and deeper titleSmall 16sp,
                    // relative to the 17sp bodyMedium this TextView renders at.
                    val size = when (block.level) {
                        1 -> 22f / 17f
                        2 -> 18f / 17f
                        else -> 16f / 17f
                    }
                    out.setSpan(
                        RelativeSizeSpan(size), lineStart, lineEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }
                is Block.Paragraph -> Unit
                is Block.Divider -> Unit
            }
        }
        return out
    }

    /** One rendered unit. Mirrors the app's `MarkdownBlock` (MarkdownText.kt:55). */
    private sealed class Block {
        abstract val text: String
        data class Paragraph(override val text: String) : Block()
        data class Bullet(override val text: String) : Block()
        data class Numbered(override val text: String) : Block()
        data class Header(val level: Int, override val text: String) : Block()
        /** `> text` — answers use it for tips. Not in the app's parser, which showed the `>`. */
        data class Quote(override val text: String) : Block()
        object Divider : Block() { override val text: String = "" }
    }

    /** Splits into blocks, dropping blank lines the way the app's parser does. */
    private fun parseBlocks(source: String): List<Block> {
        val blocks = mutableListOf<Block>()
        source.replace("\r\n", "\n").split("\n").forEach { rawLine ->
            val trimmed = rawLine.trim()
            if (trimmed.isEmpty()) return@forEach
            blocks += when {
                // App parser: `---` / `***` / `___` is a divider; one-to-six '#' + space is a
                // header whose level is clamped to 1..3.
                trimmed == "---" || trimmed == "***" || trimmed == "___" -> Block.Divider
                trimmed.startsWith("#") && trimmed.trimStart('#').startsWith(" ") ->
                    Block.Header(
                        trimmed.takeWhile { it == '#' }.length.coerceIn(1, 3),
                        trimmed.trimStart('#').trim()
                    )
                trimmed.startsWith("- ") -> Block.Bullet(trimmed.removePrefix("- "))
                trimmed.startsWith("* ") && !trimmed.startsWith("**") ->
                    Block.Bullet(trimmed.removePrefix("* "))
                NUMBERED.matches(trimmed) -> Block.Numbered(trimmed)
                trimmed.startsWith(">") -> Block.Quote(trimmed.trimStart('>').trim())
                else -> Block.Paragraph(trimmed)
            }
        }
        return blocks
    }

    private val NUMBERED = Regex("""^\d+\.\s+.*""")

    /** Adds [gapPx] above the first line of the block it spans (app `Spacer(topSpacing)`). */
    private class BlockGapSpan(private val gapPx: Int) : android.text.style.LineHeightSpan {
        // StaticLayout hands every line of the paragraph the SAME FontMetricsInt, so a value
        // shifted for the first line carries onto the wrapped lines unless it is put back.
        private var origAscent = 0
        private var origTop = 0

        override fun chooseHeight(
            text: CharSequence, start: Int, end: Int, spanstartv: Int, lineHeight: Int,
            fm: Paint.FontMetricsInt
        ) {
            val spanStart = (text as Spanned).getSpanStart(this)
            if (start == spanStart) {
                origAscent = fm.ascent
                origTop = fm.top
                fm.ascent -= gapPx
                fm.top -= gapPx
            } else if (fm.ascent == origAscent - gapPx) {
                fm.ascent = origAscent
                fm.top = origTop
            }
        }
    }

    /**
     * App `MarkdownBlock.Divider`: a full-width 3dp rounded bar in borderDefault, 24dp above and
     * below. The line is shrunk to the bar's height and the bar drawn as its background.
     */
    private class DividerSpan(density: Float, private val gapAbovePx: Int) :
        android.text.style.LineHeightSpan, android.text.style.LineBackgroundSpan {
        private val barPx = (3f * density).toInt().coerceAtLeast(1)
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFD4D4D8.toInt() }
        private val rect = android.graphics.RectF()

        override fun chooseHeight(
            text: CharSequence, start: Int, end: Int, spanstartv: Int, lineHeight: Int,
            fm: Paint.FontMetricsInt
        ) {
            fm.ascent = -(gapAbovePx + barPx); fm.top = fm.ascent
            fm.descent = 0; fm.bottom = 0
        }

        override fun drawBackground(
            canvas: Canvas, p: Paint, left: Int, right: Int, top: Int, baseline: Int,
            bottom: Int, text: CharSequence, start: Int, end: Int, lineNumber: Int
        ) {
            rect.set(left.toFloat(), (bottom - barPx).toFloat(), right.toFloat(), bottom.toFloat())
            canvas.drawRoundRect(rect, barPx / 2f, barPx / 2f, paint)
        }
    }

    /**
     * The list bullet.
     *
     * App parity (components/MarkdownText.kt:180): a 5dp-DIAMETER filled circle, 10dp from the
     * text, nudged 10dp down from the line top so it sits on the first line's x-height rather
     * than its ascent.
     *
     * Android's stock `BulletSpan` was used here with only a gap width, which draws its 4px
     * default radius — a dot roughly a third of the app's, reading as a "·" next to the app's
     * "•". The 3-arg `BulletSpan(gap, color, radius)` would fix the size but is API 28+, and the
     * SDK ships minSdk 26, so the circle is drawn directly instead. Drawing it also lets the
     * bullet inherit the paragraph's text colour on every API level.
     */
    private class FcBulletSpan(density: Float) : LeadingMarginSpan {

        private val radiusPx = (2.5f * density)
        private val gapPx = (10f * density).toInt()
        private val topOffsetPx = 10f * density
        private val marginPx = (5f * density).toInt() + gapPx

        override fun getLeadingMargin(first: Boolean): Int = marginPx

        override fun drawLeadingMargin(
            canvas: Canvas,
            paint: Paint,
            x: Int,
            dir: Int,
            top: Int,
            baseline: Int,
            bottom: Int,
            text: CharSequence?,
            start: Int,
            end: Int,
            first: Boolean,
            layout: Layout?
        ) {
            // Only the FIRST line of a wrapped bullet gets the dot; continuation lines keep the
            // indent, which is what puts wrapped text under the text and not under the bullet.
            if (!first || (text as? Spanned)?.getSpanStart(this) != start) return
            val oldStyle = paint.style
            paint.style = Paint.Style.FILL
            canvas.drawCircle(
                x + dir * radiusPx,
                top + topOffsetPx + radiusPx,
                radiusPx,
                paint
            )
            paint.style = oldStyle
        }
    }

    /**
     * A `> quote`: a 3dp rounded bar in borderDefault (the divider's colour) down the left, the
     * text 12dp after it. Drawn on every line so a wrapped quote keeps one continuous bar; the
     * first line starts at the text, not in the inter-block gap above it.
     */
    private class QuoteBarSpan(density: Float) : LeadingMarginSpan {
        private val barPx = 3f * density
        private val marginPx = (3f * density + 12f * density).toInt()
        private val barPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFD4D4D8.toInt() }

        override fun getLeadingMargin(first: Boolean): Int = marginPx

        override fun drawLeadingMargin(
            canvas: Canvas, paint: Paint, x: Int, dir: Int, top: Int, baseline: Int, bottom: Int,
            text: CharSequence?, start: Int, end: Int, first: Boolean, layout: Layout?
        ) {
            val spanned = text as? Spanned ?: return
            val isFirstLine = spanned.getSpanStart(this) == start
            val isLastLine = spanned.getSpanEnd(this) <= end
            val barTop = if (isFirstLine) baseline + paint.fontMetrics.ascent else top.toFloat()
            val barBottom = if (isLastLine) baseline + paint.fontMetrics.descent else bottom.toFloat()
            val left = if (dir > 0) x.toFloat() else x - barPx
            canvas.drawRoundRect(left, barTop, left + barPx, barBottom, barPx / 2, barPx / 2, barPaint)
        }
    }

    /** Handles **bold** and *italic* / _italic_ inline markers. */
    private fun appendInline(out: SpannableStringBuilder, text: String) {
        var i = 0
        while (i < text.length) {
            when {
                text.startsWith("**", i) -> {
                    val end = text.indexOf("**", i + 2)
                    if (end > i + 1) {
                        val start = out.length
                        appendInline(out, text.substring(i + 2, end))
                        out.setSpan(
                            StyleSpan(Typeface.BOLD), start, out.length,
                            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                        )
                        i = end + 2
                    } else {
                        out.append(text[i]); i++
                    }
                }
                text[i] == '*' || text[i] == '_' -> {
                    val marker = text[i]
                    val end = text.indexOf(marker, i + 1)
                    if (end > i + 1) {
                        val start = out.length
                        out.append(text.substring(i + 1, end))
                        out.setSpan(
                            StyleSpan(Typeface.ITALIC), start, out.length,
                            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                        )
                        i = end + 1
                    } else {
                        out.append(text[i]); i++
                    }
                }
                else -> {
                    out.append(text[i]); i++
                }
            }
        }
    }
}
