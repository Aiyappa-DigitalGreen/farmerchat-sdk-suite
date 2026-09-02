package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.layout
import androidx.compose.ui.res.vectorResource
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
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes


private sealed class MarkdownBlock {
    data class Header(val text: String, val level: Int) : MarkdownBlock()
    data class Paragraph(val text: String) : MarkdownBlock()
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
    onTableAction: (String) -> Unit = {},
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
                        onAction = onTableAction,
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
    onAction: (String) -> Unit,
) {
    val colors = LocalContentColors.current
    val type = MaterialTheme.typography
    val columnCount = block.headers.size
    if (columnCount == 0) return

    val cellHorizontalPadding: Dp = 12.dp
    val cellVerticalPadding: Dp = 10.dp
    val minColumnWidth: Dp = 160.dp
    val shape = SmoothShapes.rounded(Radius.SM)
    val scrollState = rememberScrollState()

    Column(modifier = Modifier.fillMaxWidth()) {
        // Fake action buttons sit above the table so they don't collide with the
        // bottom-anchored answer actions (Listen / Share / Save). Treatment matches
        // those primary action buttons.
        /*Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            ActionButton(
                icon = ImageVector.vectorResource(R.drawable.fc_icon_save),
                label = "Save plan",
                onClick = { onAction("Plan saved") },
                modifier = Modifier.weight(1f),
            )
            ActionButton(
                icon = ImageVector.vectorResource(R.drawable.fc_icon_timer),
                label = "Set reminders",
                onClick = { onAction("Reminders set") },
                modifier = Modifier.weight(1f),
            )
        }*/

        Spacer(modifier = Modifier.height(12.dp))

        // Table bleeds toward the screen edges by expanding past its parent's
        // horizontal padding, but keeps a balanced 16dp inset from each screen
        // edge. Only the table + gradient wrapper bleeds — buttons above stay
        // aligned with the rest of the answer column.
        val screenEdgeInset = 16.dp
        val sideBleed = (bleed - screenEdgeInset).coerceAtLeast(0.dp)

        // 1–2 column tables fill the available width with weighted cells (no
        // scroll). 3+ column tables keep a fixed per-column min width and
        // overflow horizontally so the user can pan to see more — the right
        // edge gets a fade hint when that's the case.
        val isScrollable = columnCount >= 3

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .bleedHorizontally(start = sideBleed, end = sideBleed)
                .height(IntrinsicSize.Min)
        ) {
            Column(
                modifier = Modifier
                    .then(if (isScrollable) Modifier.horizontalScroll(scrollState) else Modifier.fillMaxWidth())
                    .clip(shape)
                    .border(1.dp, colors.borderDefault, shape)
            ) {
                // Header
                Row(
                    modifier = Modifier
                        .then(if (isScrollable) Modifier else Modifier.fillMaxWidth())
                        .background(colors.surfaceTertiary)
                ) {
                    block.headers.forEachIndexed { colIdx, headerCell ->
                        val cellModifier =
                            if (isScrollable) Modifier.width(minColumnWidth)
                            else Modifier.weight(1f)
                        Text(
                            text = parseBoldText(stripCellMarkup(headerCell)),
                            style = type.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                textAlign = block.alignments.getOrNull(colIdx) ?: TextAlign.Start,
                            ),
                            color = textColor,
                            modifier = cellModifier
                                .padding(horizontal = cellHorizontalPadding, vertical = cellVerticalPadding)
                        )
                    }
                }

                // Body rows alternate between pure white (surfaceSecondary) and the
                // same neutral tone as the user chat bubble (surfaceReadingSecondary)
                // — softer than the previous tertiary tint.
                block.rows.forEachIndexed { rowIdx, row ->
                    val rowBg = if (rowIdx % 2 == 0) colors.surfaceSecondary else colors.surfaceReadingSecondary
                    Row(
                        modifier = Modifier
                            .then(if (isScrollable) Modifier else Modifier.fillMaxWidth())
                            .background(rowBg)
                    ) {
                        for (colIdx in 0 until columnCount) {
                            val cellText = row.getOrNull(colIdx).orEmpty()
                            val cellModifier =
                                if (isScrollable) Modifier.width(minColumnWidth)
                                else Modifier.weight(1f)
                            Text(
                                text = parseBoldText(stripCellMarkup(cellText)),
                                style = type.bodySmall.copy(
                                    textAlign = block.alignments.getOrNull(colIdx) ?: TextAlign.Start,
                                ),
                                color = textColor,
                                modifier = cellModifier
                                    .padding(horizontal = cellHorizontalPadding, vertical = cellVerticalPadding)
                            )
                        }
                    }
                }
            }

            // Right-edge scroll-hint gradient — only when the table actually
            // overflows. Fades out as the user reaches the right edge so the
            // last column isn't obscured at end-of-scroll.
            if (isScrollable) {
                val hintAlpha by remember(scrollState) {
                    derivedStateOf {
                        val remaining = (scrollState.maxValue - scrollState.value).toFloat()
                        (remaining / 120f).coerceIn(0f, 1f)
                    }
                }
                Box(
                    modifier = Modifier
                        .align(Alignment.CenterEnd)
                        .fillMaxHeight()
                        .width(48.dp)
                        .alpha(hintAlpha)
                        .background(
                            Brush.horizontalGradient(
                                colors = listOf(
                                    colors.surfaceReadingPrimary.copy(alpha = 0f),
                                    colors.surfaceReadingPrimary,
                                )
                            )
                        )
                )
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
