package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.layout
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes


private sealed class MarkdownBlock {
    data class Header(val text: String, val level: Int) : MarkdownBlock()
    data class Paragraph(val text: String) : MarkdownBlock()
    /** `> text` — answers use it for tips. Not in the app's parser, which showed the `>`. */
    data class Quote(val text: String) : MarkdownBlock()
    data class BulletItem(val text: String) : MarkdownBlock()
    data class NumberedItem(val number: String, val text: String) : MarkdownBlock()
    data class Table(
        val headers: List<String>,
        val alignments: List<TextAlign>,
        val rows: List<List<String>>,
    ) : MarkdownBlock()
    object Divider : MarkdownBlock()
}

/**
 * Simple markdown renderer for chat responses.
 * Supports: # / ## / ### headers (incl. **bold** within), **bold**, *italic*, - bullets, 1. numbered lists, --- dividers
 * Uses 24dp/12dp vertical rhythm
 */
@Composable
fun MarkdownText(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = LocalContentColors.current.foregroundPrimary,
    tableBleed: Dp = 0.dp,
    /**
     * Reserved. The table block used to carry a pair of "Save plan" / "Set reminders" buttons
     * that called this; the app removed them in 1b0553d2 and so has the SDK. Kept because it is
     * part of this composable's published signature — no caller in the tree passes it.
     */
    @Suppress("UNUSED_PARAMETER") onTableAction: (String) -> Unit = {},
    /** Optional content flowed inline right after the final word (e.g. a pause spinner). */
    trailing: (@Composable () -> Unit)? = null,
) {
    val type = MaterialTheme.typography
    val colors = LocalContentColors.current

    // Parse into blocks
    val blocks = parseMarkdownBlocks(text)

    val TRAILING_INLINE_ID = "trailingInline"
    val trailingMap = if (trailing != null) mapOf(
        TRAILING_INLINE_ID to InlineTextContent(
            Placeholder(
                width = 30.sp,
                height = 14.sp,
                placeholderVerticalAlign = PlaceholderVerticalAlign.TextCenter,
            )
        ) { trailing() }
    ) else emptyMap()

    // Append the inline trailing slot only to the last text block (paragraph/list item),
    // so it sits right after the final word and wraps with the text.
    fun withTrailing(base: AnnotatedString, isLast: Boolean): AnnotatedString =
        if (isLast && trailing != null) buildAnnotatedString {
            append(base)
            append(" ")
            appendInlineContent(TRAILING_INLINE_ID, "⟳")
        } else base

    Column(modifier = modifier) {
        blocks.forEachIndexed { index, block ->
            val isLastBlock = index == blocks.lastIndex
            val prevBlock = blocks.getOrNull(index - 1)
            val nextBlock = blocks.getOrNull(index + 1)

            // Determine top spacing
            val topSpacing = when {
                index == 0 -> 0.dp
                block is MarkdownBlock.Divider -> 24.dp
                prevBlock is MarkdownBlock.Divider -> 24.dp
                block is MarkdownBlock.Header -> 24.dp
                prevBlock is MarkdownBlock.Header -> 20.dp
                block is MarkdownBlock.Table -> 16.dp
                prevBlock is MarkdownBlock.Table -> 16.dp
                // Consecutive list items get tighter spacing
                block is MarkdownBlock.BulletItem && prevBlock is MarkdownBlock.BulletItem -> 5.dp
                block is MarkdownBlock.NumberedItem && prevBlock is MarkdownBlock.NumberedItem -> 5.dp
                block is MarkdownBlock.Quote && prevBlock is MarkdownBlock.Quote -> 5.dp
                // Consecutive paragraphs get more breathing room
                block is MarkdownBlock.Paragraph && prevBlock is MarkdownBlock.Paragraph -> 20.dp
                else -> 12.dp
            }

            if (topSpacing > 0.dp) {
                Spacer(modifier = Modifier.height(topSpacing))
            }

            when (block) {
                is MarkdownBlock.Divider -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp)
                            .clip(RoundedCornerShape(50))
                            .background(colors.borderDefault)
                    )
                }

                is MarkdownBlock.Header -> {
                    // Map header level onto the v2 type scale so #, ##, ### are visually
                    // distinct (H1 largest). Deeper levels are clamped to titleSmall.
                    val headerStyle = when (block.level) {
                        1 -> type.titleLarge
                        2 -> type.titleMedium
                        else -> type.titleSmall
                    }
                    Text(
                        text = parseBoldText(block.text),
                        style = headerStyle,
                        color = color
                    )
                }

                is MarkdownBlock.Paragraph -> {
                    Text(
                        text = withTrailing(parseBoldText(block.text), isLastBlock),
                        style = type.bodyMedium,
                        color = color,
                        inlineContent = trailingMap,
                    )
                }

                // A 3dp rounded bar in borderDefault (the divider's colour), text 12dp after it.
                is MarkdownBlock.Quote -> {
                    Row(modifier = Modifier.height(IntrinsicSize.Min)) {
                        Box(
                            modifier = Modifier
                                .width(3.dp)
                                .fillMaxHeight()
                                .clip(RoundedCornerShape(50))
                                .background(colors.borderDefault)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = withTrailing(parseBoldText(block.text), isLastBlock),
                            style = type.bodyMedium,
                            color = color,
                            inlineContent = trailingMap,
                        )
                    }
                }

                is MarkdownBlock.BulletItem -> {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Surface(
                            modifier = Modifier
                                .padding(top = 10.dp)
                                .size(5.dp),
                            shape = CircleShape,
                            color = color
                        ) {}
                        Text(
                            text = withTrailing(parseBoldText(block.text), isLastBlock),
                            style = type.bodyMedium,
                            color = color,
                            inlineContent = trailingMap,
                        )
                    }
                }

                is MarkdownBlock.NumberedItem -> {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Text(
                            text = "${block.number}.",
                            style = type.bodyMedium,
                            color = color
                        )
                        Text(
                            text = withTrailing(parseBoldText(block.text), isLastBlock),
                            style = type.bodyMedium,
                            color = color,
                            inlineContent = trailingMap,
                        )
                    }
                }

                is MarkdownBlock.Table -> {
                    MarkdownTable(
                        block = block,
                        textColor = color,
                        bleed = tableBleed,
                    )
                }
            }
        }
    }
}

@Composable
private fun MarkdownTable(
    block: MarkdownBlock.Table,
    textColor: Color,
    bleed: Dp,
) {
    val columnCount = block.headers.size
    if (columnCount == 0) return

    // App parity (MarkdownText.kt @ 10a87f9c..04b38e8f). The answer format now sends "cards": a
    // 3-column table whose header row carries the card title in the first cell and leaves the
    // other two empty (`| Saturday, 19 Sep | | |`). Each body row is a label / value / meaning
    // triple. This is detected strictly (see [isCard]) and rendered by [MarkdownAnswerCard].
    //
    // Anything else keeps the existing behaviour: a genuine multi-column grid still renders as
    // single-column stacked cards (one per data row) so it never pans horizontally, and a lone
    // single-column table falls back to the simple weighted list.
    when {
        block.isCard() -> MarkdownAnswerCard(block = block, textColor = textColor)
        columnCount >= 2 -> MarkdownRowCards(block = block, textColor = textColor)
        else -> MarkdownWeightedTable(block = block, textColor = textColor, bleed = bleed)
    }
}

/**
 * A card is a 3-column table whose header row holds the card title in the first cell and nothing
 * in the other two — e.g. `| Saturday, 19 Sep | | |`. This is the sole test that separates a card
 * from an ordinary grid (a grid has text in at least one of the trailing header cells). Cells are
 * already trimmed by the parser, so the header list can be tested directly.
 */
private fun MarkdownBlock.Table.isCard(): Boolean =
    headers.size == 3 && headers[0].isNotEmpty() && headers.drop(1).all { it.isEmpty() }

/**
 * Renders one answer card: the header's first cell as the card title, then one "reading" per body
 * row. A divider line sits under the title and between every reading. The card keeps its filled
 * surface (surfaceReadingSecondary) — only the in-between separator lines are added.
 *
 * Each reading is a label / value / meaning triple — the label (row[0]) sits small and muted above
 * the value (row[1], emphasised), and the meaning (row[2]) is a plain-language line beneath the
 * value. The meaning is the whole point of the format — the line a farmer who cannot read the
 * figure relies on — so it stays readable (foregroundSecondary, never the faint tertiary tone) and
 * is only dropped when the source cell is empty.
 */
@Composable
private fun MarkdownAnswerCard(
    block: MarkdownBlock.Table,
    textColor: Color,
) {
    val colors = LocalContentColors.current
    val type = MaterialTheme.typography
    val shape = SmoothShapes.rounded(Radius.LG)
    val title = stripCellMarkup(block.headers.getOrNull(0).orEmpty())

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(colors.surfaceReadingSecondary)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (title.isNotEmpty()) {
            Text(
                text = parseBoldText(title),
                style = type.labelLarge.copy(fontWeight = FontWeight.Bold),
                color = textColor,
            )
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(colors.borderDefault)
            )
        }

        block.rows.forEachIndexed { rowIdx, row ->
            val cellLabel = stripCellMarkup(row.getOrNull(0).orEmpty())
            val value = stripCellMarkup(row.getOrNull(1).orEmpty())
            val meaning = stripCellMarkup(row.getOrNull(2).orEmpty())
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                if (cellLabel.isNotEmpty()) {
                    Text(
                        text = parseBoldText(cellLabel),
                        style = type.bodySmall,
                        color = colors.foregroundSecondary,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                Text(
                    text = parseBoldText(value),
                    style = type.bodyMedium.copy(fontWeight = FontWeight.Bold),
                    color = textColor,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (meaning.isNotEmpty()) {
                    Text(
                        text = parseBoldText(meaning),
                        style = type.bodyMedium,
                        color = colors.foregroundSecondary,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 2.dp),
                    )
                }
            }
            // Separator line between readings — the card edge closes the last one.
            if (rowIdx != block.rows.lastIndex) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(colors.borderDefault)
                )
            }
        }
    }
}

/**
 * Stacked-card treatment for any multi-column (2+) table. One card per data row: the first cell
 * becomes the card's title header and each remaining column is a label (its column header) /
 * value pair. Label is muted above a bold value — regardless of the source GFM alignment, which
 * is why this branch ignores `block.alignments`.
 */
@Composable
private fun MarkdownRowCards(
    block: MarkdownBlock.Table,
    textColor: Color,
) {
    val colors = LocalContentColors.current
    val type = MaterialTheme.typography
    val columnCount = block.headers.size
    val shape = SmoothShapes.rounded(Radius.LG)

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        block.rows.forEach { row ->
            val title = stripCellMarkup(row.getOrNull(0).orEmpty())
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(shape)
                    .background(colors.surfaceReadingSecondary)
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                if (title.isNotEmpty()) {
                    Text(
                        text = parseBoldText(title),
                        style = type.labelLarge.copy(fontWeight = FontWeight.Bold),
                        color = textColor,
                    )
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(colors.borderDefault)
                    )
                }

                for (colIdx in 1 until columnCount) {
                    val cellLabel = stripCellMarkup(block.headers.getOrNull(colIdx).orEmpty())
                    val value = stripCellMarkup(row.getOrNull(colIdx).orEmpty())
                    // Single-column stacked layout: the label is its own full-width row and the
                    // value sits directly below it, also full width. This replaces the earlier
                    // side-by-side (weighted) pair so long labels and values each get the whole
                    // card width instead of wrapping inside a narrow half-column.
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(
                            text = parseBoldText(cellLabel),
                            style = type.bodySmall,
                            color = colors.foregroundSecondary,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Text(
                            text = parseBoldText(value),
                            style = type.bodySmall.copy(fontWeight = FontWeight.Bold),
                            color = textColor,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }
        }
    }
}

/**
 * Compact weighted grid, used only for a lone single-column table. Columns share the width so
 * nothing overflows; the block may bleed toward the screen edges via [bleed] to line up with the
 * rest of the answer.
 */
@Composable
private fun MarkdownWeightedTable(
    block: MarkdownBlock.Table,
    textColor: Color,
    bleed: Dp,
) {
    val colors = LocalContentColors.current
    val type = MaterialTheme.typography
    val columnCount = block.headers.size

    val cellHorizontalPadding: Dp = 12.dp
    val cellVerticalPadding: Dp = 10.dp
    val shape = SmoothShapes.rounded(Radius.SM)

    // The table bleeds toward the screen edges by expanding past its parent's horizontal
    // padding, but keeps a balanced 16dp inset from each screen edge.
    val screenEdgeInset = 16.dp
    val sideBleed = (bleed - screenEdgeInset).coerceAtLeast(0.dp)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .bleedHorizontally(start = sideBleed, end = sideBleed)
            .clip(shape)
            .border(1.dp, colors.borderDefault, shape)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.surfaceTertiary)
        ) {
            block.headers.forEachIndexed { colIdx, headerCell ->
                Text(
                    text = parseBoldText(stripCellMarkup(headerCell)),
                    style = type.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        textAlign = block.alignments.getOrNull(colIdx) ?: TextAlign.Start,
                    ),
                    color = textColor,
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = cellHorizontalPadding, vertical = cellVerticalPadding)
                )
            }
        }

        // Body rows alternate between pure white (surfaceSecondary) and the same neutral tone as
        // the user chat bubble (surfaceReadingSecondary) — softer than a tertiary tint.
        block.rows.forEachIndexed { rowIdx, row ->
            val rowBg = if (rowIdx % 2 == 0) colors.surfaceSecondary else colors.surfaceReadingSecondary
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(rowBg)
            ) {
                for (colIdx in 0 until columnCount) {
                    val cellText = row.getOrNull(colIdx).orEmpty()
                    Text(
                        text = parseBoldText(stripCellMarkup(cellText)),
                        style = type.bodySmall.copy(
                            textAlign = block.alignments.getOrNull(colIdx) ?: TextAlign.Start,
                        ),
                        color = textColor,
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = cellHorizontalPadding, vertical = cellVerticalPadding)
                    )
                }
            }
        }
    }
}

/**
 * Expands the composable horizontally past its parent's measure constraints —
 * used to make the chat-answer table bleed past the chat column's gutter
 * padding. `start` and `end` may be asymmetric (e.g. small left inset, full
 * right bleed for a scroll-hint gradient).
 */
private fun Modifier.bleedHorizontally(start: Dp, end: Dp): Modifier =
    if (start <= 0.dp && end <= 0.dp) this
    else this.layout { measurable, constraints ->
        val startPx = start.roundToPx()
        val endPx = end.roundToPx()
        val expanded = Constraints(
            minWidth = constraints.maxWidth + startPx + endPx,
            maxWidth = constraints.maxWidth + startPx + endPx,
            minHeight = constraints.minHeight,
            maxHeight = constraints.maxHeight,
        )
        val placeable = measurable.measure(expanded)
        layout(constraints.maxWidth, placeable.height) {
            placeable.place(-startPx, 0)
        }
    }

private fun stripCellMarkup(cell: String): String = cell.trim()

private fun parseMarkdownBlocks(text: String): List<MarkdownBlock> {
    val blocks = mutableListOf<MarkdownBlock>()
    val lines = text.split("\n")

    var i = 0
    while (i < lines.size) {
        val line = lines[i]
        val trimmed = line.trim()

        // Tables are detected via 2-line look-ahead: header row followed by a
        // GFM separator row (e.g. `| :--- | ---: |`). Body rows continue while
        // subsequent lines contain a pipe.
        if (looksLikeTableRow(trimmed) && i + 1 < lines.size && isTableSeparator(lines[i + 1].trim())) {
            val headers = splitTableRow(trimmed)
            val alignments = parseAlignments(lines[i + 1].trim(), headers.size)
            val rows = mutableListOf<List<String>>()
            var j = i + 2
            while (j < lines.size) {
                val next = lines[j].trim()
                if (!looksLikeTableRow(next)) break
                val cells = splitTableRow(next)
                // Pad short rows / trim overly long rows to match header count.
                val normalized = (0 until headers.size).map { idx -> cells.getOrNull(idx).orEmpty() }
                rows.add(normalized)
                j++
            }
            blocks.add(MarkdownBlock.Table(headers, alignments, rows))
            i = j
            continue
        }

        when {
            trimmed.isEmpty() -> { /* skip */ }
            trimmed == "---" || trimmed == "***" || trimmed == "___" -> {
                blocks.add(MarkdownBlock.Divider)
            }
            // ATX headers: one-to-six leading '#' followed by a space (# … ######).
            // The '#' count maps to a header level (clamped 1..3) which drives the
            // render-time text style; the leading '#'s are stripped and any inline
            // **bold** is handled at render time via parseBoldText.
            trimmed.startsWith("#") && trimmed.trimStart('#').startsWith(" ") -> {
                val level = trimmed.takeWhile { it == '#' }.length.coerceIn(1, 3)
                val headerText = trimmed.trimStart('#').trim()
                blocks.add(MarkdownBlock.Header(headerText, level))
            }
            trimmed.startsWith("- ") || trimmed.startsWith("* ") -> {
                blocks.add(MarkdownBlock.BulletItem(trimmed.substring(2)))
            }
            trimmed.startsWith(">") -> {
                blocks.add(MarkdownBlock.Quote(trimmed.trimStart('>').trim()))
            }
            trimmed.matches(Regex("^\\d+\\.\\s.*")) -> {
                val number = trimmed.substringBefore(".").trim()
                val content = trimmed.substringAfter(".").trim()
                blocks.add(MarkdownBlock.NumberedItem(number, content))
            }
            else -> {
                blocks.add(MarkdownBlock.Paragraph(trimmed))
            }
        }
        i++
    }

    return blocks
}

private fun looksLikeTableRow(trimmed: String): Boolean {
    if (!trimmed.contains('|')) return false
    val core = trimmed.trim('|').trim()
    return core.isNotEmpty()
}

private fun isTableSeparator(trimmed: String): Boolean {
    if (!trimmed.contains('|') || !trimmed.contains('-')) return false
    val cells = splitTableRow(trimmed)
    if (cells.isEmpty()) return false
    val cellRegex = Regex("^:?-{3,}:?$")
    return cells.all { cellRegex.matches(it.trim()) }
}

private fun splitTableRow(trimmed: String): List<String> {
    val core = trimmed.trim().removePrefix("|").removeSuffix("|")
    return core.split('|').map { it.trim() }
}

private fun parseAlignments(separatorRow: String, columnCount: Int): List<TextAlign> {
    val cells = splitTableRow(separatorRow)
    return (0 until columnCount).map { idx ->
        val cell = cells.getOrNull(idx)?.trim().orEmpty()
        val left = cell.startsWith(':')
        val right = cell.endsWith(':')
        when {
            left && right -> TextAlign.Center
            right -> TextAlign.End
            else -> TextAlign.Start
        }
    }
}

/**
 * Parses inline emphasis within a string: **bold**, *italic*, and either nested inside the other
 * (e.g. *italic **bold** italic*). Unmatched or empty markers are rendered literally. Kept under the
 * name `parseBoldText` so all existing call sites (paragraphs, list items, headers, table cells) gain
 * italics with no further changes.
 */
private fun parseBoldText(text: String): AnnotatedString = buildAnnotatedString {
    appendEmphasis(text)
}

/**
 * Appends [text], applying **bold** / *italic* spans, recursing into span content so bold-inside-
 * italic (and the reverse) both style correctly. A marker with no valid, non-empty closing partner
 * is emitted literally so stray asterisks never eat the rest of the line.
 */
private fun AnnotatedString.Builder.appendEmphasis(text: String) {
    var i = 0
    while (i < text.length) {
        if (text[i] == '*') {
            val isBold = i + 1 < text.length && text[i + 1] == '*'
            val markerLen = if (isBold) 2 else 1
            val contentStart = i + markerLen
            // Bold closes on the next "**"; italic closes on the next LONE "*" (skipping "**" so an
            // italic span can wrap a nested **bold** run).
            val close = if (isBold) text.indexOf("**", contentStart) else findItalicClose(text, contentStart)
            if (close != -1 && close > contentStart) {
                val style = if (isBold) SpanStyle(fontWeight = FontWeight.Bold)
                            else SpanStyle(fontStyle = FontStyle.Italic)
                withStyle(style) { appendEmphasis(text.substring(contentStart, close)) }
                i = close + markerLen
                continue
            }
        }
        append(text[i])
        i++
    }
}

/**
 * Finds the next lone `*` (an italic close) at or after [from], skipping `**` bold markers so an
 * italic span can contain a nested **bold** run. Returns -1 when there is none.
 */
private fun findItalicClose(text: String, from: Int): Int {
    var k = from
    while (k < text.length) {
        if (text[k] == '*' &&
            (k + 1 >= text.length || text[k + 1] != '*') &&
            (k == 0 || text[k - 1] != '*')
        ) return k
        k++
    }
    return -1
}
