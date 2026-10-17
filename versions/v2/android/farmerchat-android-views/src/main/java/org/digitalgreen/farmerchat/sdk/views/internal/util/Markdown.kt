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
    fun render(
        source: String,
        density: Float = 1f,
        /** Card surface (app surfaceReadingSecondary). */
        cardColor: Int = 0xFFECECEE.toInt(),
        /** Muted card text: labels and meanings (app foregroundSecondary). */
        mutedColor: Int = 0xFF52525C.toInt(),
        /** The 1dp rules inside a card (app borderDefault). */
        ruleColor: Int = 0xFFD4D4D8.toInt(),
    ): CharSequence {
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
                block is Block.Table || prev is Block.Table -> 16
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
            if (block is Block.Table) {
                appendTableCards(out, block, density, cardColor, mutedColor, topSpacingDp, ruleColor)
                return@forEachIndexed
            }
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
                is Block.Table -> Unit
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
        /** A GFM table: header cells and body rows, cells trimmed (app `MarkdownBlock.Table`). */
        data class Table(val headers: List<String>, val rows: List<List<String>>) : Block() {
            override val text: String = ""
        }
    }

    /** Splits into blocks, dropping blank lines the way the app's parser does. */
    private fun parseBlocks(source: String): List<Block> {
        val blocks = mutableListOf<Block>()
        val pendingTable = mutableListOf<String>()
        fun flushTable() {
            if (pendingTable.isEmpty()) return
            blocks += parseTable(pendingTable)?.let { Block.Table(it.headers, it.rows) }
                ?: Block.Paragraph(pendingTable.joinToString(" "))
            pendingTable.clear()
        }
        source.replace("\r\n", "\n").split("\n").forEach { rawLine ->
            val trimmed = rawLine.trim()
            if (trimmed.startsWith("|")) { pendingTable += trimmed; return@forEach }
            flushTable()
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
        flushTable()
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

    /**
     * Renders a table the way the app does (components/MarkdownText.kt MarkdownTable): never as a
     * grid. A "card" table (3 columns, title only in the first header cell) becomes one card of
     * label / value / meaning readings; any other 2+ column table becomes one card per row with
     * column-header labels over values. Before 2026-10-17 the views flavour showed the raw pipes.
     */
    private fun appendTableCards(
        out: SpannableStringBuilder, table: Block.Table, density: Float,
        cardColor: Int, mutedColor: Int, firstGapDp: Int, ruleColor: Int
    ) {
        tableCards(TableModel(table.headers, table.rows)).forEachIndexed { cardIdx, card ->
            if (cardIdx > 0) out.append("\n")
            val cardStart = out.length
            card.lines.forEachIndexed { i, line ->
                if (i > 0) out.append("\n")
                val s = out.length
                appendInline(out, line.text)
                if (out.length == s) out.append(" ")
                val e = out.length
                when (line.kind) {
                    CardLine.Kind.TITLE -> out.setSpan(StyleSpan(Typeface.BOLD), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    CardLine.Kind.VALUE -> {
                        out.setSpan(StyleSpan(Typeface.BOLD), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                        // Row cards set the value in bodySmall (15sp), answer cards in bodyMedium.
                        if (line.small) out.setSpan(RelativeSizeSpan(15f / 17f), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    }
                    CardLine.Kind.LABEL -> {
                        out.setSpan(android.text.style.ForegroundColorSpan(mutedColor), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                        out.setSpan(RelativeSizeSpan(15f / 17f), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                    }
                    CardLine.Kind.MEANING -> out.setSpan(android.text.style.ForegroundColorSpan(mutedColor), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                }
                // The Compose card's spacing, and its 1dp borderDefault rule after the title and
                // between readings (MarkdownAnswerCard / MarkdownRowCards).
                if (i > 0 && line.gapAboveDp > 0) {
                    out.setSpan(BlockGapSpan((line.gapAboveDp * density).toInt()), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                }
                if (i > 0 && line.ruleAboveAtDp != null) {
                    out.setSpan(CardRuleSpan(density, ruleColor, line.ruleAboveAtDp), s, e, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                }
            }
            val gapAbove = if (cardIdx == 0) firstGapDp else 12
            out.setSpan(
                CardSpan(density, cardColor, (gapAbove * density).toInt()),
                cardStart, out.length,
                // Highest priority = first in getSpans, so the card surface is painted BEFORE the
                // rules on its lines; set last without it, the surface covered the rules.
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE or Spanned.SPAN_PRIORITY
            )
        }
    }

    /**
     * A 1dp rule [atDp] below the top of the line it spans, inset by the card padding. That line's
     * [BlockGapSpan] supplies the space: 12dp, the rule, 12dp (Compose spacedBy(12.dp)).
     */
    private class CardRuleSpan(density: Float, color: Int, private val atDp: Int) :
        android.text.style.LineBackgroundSpan {
        private val d = density
        private val padH = 16f * density
        private val paint = Paint().apply { this.color = color }
        override fun drawBackground(
            canvas: Canvas, p: Paint, left: Int, right: Int, top: Int, baseline: Int,
            bottom: Int, text: CharSequence, start: Int, end: Int, lineNumber: Int
        ) {
            if (start != (text as Spanned).getSpanStart(this)) return
            val y = top + atDp * d
            canvas.drawRect(left + padH, y, right - padH, y + 1f * d, paint)
        }
    }

    /** One card: a filled rounded surface (app Radius.LG, 16/14dp padding) behind its lines. */
    private class CardSpan(density: Float, color: Int, private val gapAbovePx: Int) :
        android.text.style.LineBackgroundSpan, LeadingMarginSpan, android.text.style.LineHeightSpan {
        private val padH = (16f * density).toInt()
        private val padV = (14f * density).toInt()
        private val radius = 12f * density
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
        private var firstAscent = Int.MIN_VALUE

        override fun getLeadingMargin(first: Boolean): Int = padH

        override fun drawLeadingMargin(
            c: Canvas, p: Paint, x: Int, dir: Int, top: Int, baseline: Int, bottom: Int,
            text: CharSequence?, start: Int, end: Int, first: Boolean, layout: Layout?
        ) = Unit

        override fun chooseHeight(
            text: CharSequence, start: Int, end: Int, spanstartv: Int, lineHeight: Int,
            fm: Paint.FontMetricsInt
        ) {
            val sp = text as Spanned
            if (start == sp.getSpanStart(this)) { fm.ascent -= gapAbovePx + padV; fm.top = fm.ascent }
            if (end >= sp.getSpanEnd(this)) { fm.descent += padV; fm.bottom = fm.descent }
        }

        override fun drawBackground(
            canvas: Canvas, p: Paint, left: Int, right: Int, top: Int, baseline: Int,
            bottom: Int, text: CharSequence, start: Int, end: Int, lineNumber: Int
        ) {
            val sp = text as Spanned
            val isFirst = start == sp.getSpanStart(this)
            val isLast = end >= sp.getSpanEnd(this)
            val t = if (isFirst) top + gapAbovePx else top
            val r = android.graphics.RectF(left.toFloat(), t.toFloat(), right.toFloat(), bottom.toFloat())
            when {
                isFirst && isLast -> canvas.drawRoundRect(r, radius, radius, paint)
                isFirst -> { canvas.drawRoundRect(r, radius, radius, paint); canvas.drawRect(r.left, r.bottom - radius, r.right, r.bottom, paint) }
                isLast -> { canvas.drawRoundRect(r, radius, radius, paint); canvas.drawRect(r.left, r.top, r.right, r.top + radius, paint) }
                else -> canvas.drawRect(r, paint)
            }
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

// ---------------------------------------------------------------- tables (pure, unit-tested)

internal data class TableModel(val headers: List<String>, val rows: List<List<String>>)

/**
 * One line of a table card.
 * @param gapAboveDp space above the line (Compose arrangement spacing).
 * @param ruleAboveAtDp when set, a 1dp borderDefault rule this far down inside that space.
 * @param small value set in bodySmall (row cards) rather than bodyMedium (answer cards).
 */
internal data class CardLine(
    val kind: Kind,
    val text: String,
    val gapAboveDp: Int = 0,
    val ruleAboveAtDp: Int? = null,
    val small: Boolean = false,
) {
    enum class Kind { TITLE, LABEL, VALUE, MEANING }
}

internal data class TableCard(val lines: List<CardLine>)

/** Splits `| a | b |` into trimmed cells (outer pipes optional, as GFM allows). */
internal fun splitTableRow(line: String): List<String> {
    var t = line.trim()
    if (t.startsWith("|")) t = t.substring(1)
    if (t.endsWith("|")) t = t.dropLast(1)
    return t.split("|").map { it.trim() }
}

private val TABLE_SEPARATOR = Regex("^\\|?\\s*:?-{1,}:?\\s*(\\|\\s*:?-{1,}:?\\s*)*\\|?$")

/** A GFM table needs a header row and a `---` separator row; anything else stays text. */
internal fun parseTable(lines: List<String>): TableModel? {
    if (lines.size < 2 || !TABLE_SEPARATOR.matches(lines[1].replace(" ", ""))) return null
    val headers = splitTableRow(lines[0])
    val rows = lines.drop(2).map { splitTableRow(it) }
    return TableModel(headers, rows)
}

/** App MarkdownBlock.Table.isCard: 3 columns, title in the first header cell only. */
internal fun TableModel.isCard(): Boolean =
    headers.size == 3 && headers[0].isNotEmpty() && headers.drop(1).all { it.isEmpty() }

/**
 * The app's card layout for a table (MarkdownAnswerCard / MarkdownRowCards), with Compose's
 * spacing: answer card = title, rule, then readings separated by rules (spacedBy 12dp; inside a
 * reading spacedBy 2dp, meaning +2dp); row card = title, rule, then label/value pairs (spacedBy
 * 10dp, pair spacedBy 2dp).
 */
internal fun tableCards(t: TableModel): List<TableCard> = when {
    t.isCard() -> listOf(TableCard(buildList {
        add(CardLine(CardLine.Kind.TITLE, t.headers[0]))
        t.rows.forEach { row ->
            // Title → rule → reading, and reading → rule → reading: 12dp, 1dp rule, 12dp.
            var first = true
            fun lead(kind: CardLine.Kind, text: String) =
                if (first) { first = false; CardLine(kind, text, gapAboveDp = 25, ruleAboveAtDp = 12) }
                else CardLine(kind, text, gapAboveDp = 2)
            row.getOrNull(0)?.takeIf { it.isNotEmpty() }?.let { add(lead(CardLine.Kind.LABEL, it)) }
            add(lead(CardLine.Kind.VALUE, row.getOrNull(1).orEmpty()))
            row.getOrNull(2)?.takeIf { it.isNotEmpty() }?.let { add(CardLine(CardLine.Kind.MEANING, it, gapAboveDp = 4)) }
        }
    }))
    t.headers.size >= 2 -> t.rows.map { row ->
        TableCard(buildList {
            val title = row.getOrNull(0)?.takeIf { it.isNotEmpty() }
            title?.let { add(CardLine(CardLine.Kind.TITLE, it)) }
            for (c in 1 until t.headers.size) {
                val firstPair = c == 1 && title != null
                add(
                    if (firstPair) CardLine(CardLine.Kind.LABEL, t.headers[c], gapAboveDp = 21, ruleAboveAtDp = 10)
                    else CardLine(CardLine.Kind.LABEL, t.headers[c], gapAboveDp = 10)
                )
                add(CardLine(CardLine.Kind.VALUE, row.getOrNull(c).orEmpty(), gapAboveDp = 2, small = true))
            }
        })
    }
    else -> t.rows.map { row -> TableCard(listOf(CardLine(CardLine.Kind.VALUE, row.getOrNull(0).orEmpty()))) }
}
