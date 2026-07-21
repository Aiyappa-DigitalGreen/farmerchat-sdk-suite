package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors

private sealed class MarkdownBlock {
    data class Header(val level: Int, val text: String) : MarkdownBlock()
    data class Paragraph(val text: String) : MarkdownBlock()
    data class BulletItem(val text: String, val nested: Boolean = false) : MarkdownBlock()
    data class NumberedItem(val number: String, val text: String) : MarkdownBlock()
    object Divider : MarkdownBlock()
}

/**
 * Simple markdown renderer for chat responses (port of the app's MarkdownText).
 * Supports: #/##/### headers, **bold**, *italic*, - bullets, 1. numbered lists,
 * --- dividers. 24dp/12dp vertical rhythm.
 */
@Composable
fun MarkdownText(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = LocalContentColors.current.foregroundPrimary
) {
    val type = MaterialTheme.typography
    val colors = LocalContentColors.current

    val blocks = parseMarkdownBlocks(text)

    Column(modifier = modifier) {
        blocks.forEachIndexed { index, block ->
            val prevBlock = blocks.getOrNull(index - 1)

            val topSpacing = when {
                index == 0 -> 0.dp
                block is MarkdownBlock.Divider -> 24.dp
                prevBlock is MarkdownBlock.Divider -> 24.dp
                block is MarkdownBlock.Header -> 24.dp
                prevBlock is MarkdownBlock.Header -> 20.dp
                block is MarkdownBlock.BulletItem && prevBlock is MarkdownBlock.BulletItem -> 5.dp
                block is MarkdownBlock.NumberedItem && prevBlock is MarkdownBlock.NumberedItem -> 5.dp
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
                    val headerStyle = when (block.level) {
                        1 -> type.titleLarge
                        2 -> type.titleMedium
                        else -> type.titleSmall
                    }
                    Text(
                        text = parseBoldAndItalic(block.text, color),
                        style = headerStyle,
                        color = color
                    )
                }

                is MarkdownBlock.Paragraph -> {
                    Text(
                        text = parseBoldAndItalic(block.text, color),
                        style = type.bodyMedium,
                        color = color
                    )
                }

                is MarkdownBlock.BulletItem -> {
                    val bulletIndent = if (block.nested) 36.dp else 20.dp
                    Row(
                        modifier = Modifier.padding(start = bulletIndent),
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
                            text = parseBoldAndItalic(block.text, color),
                            style = type.bodyMedium,
                            color = color
                        )
                    }
                }

                is MarkdownBlock.NumberedItem -> {
                    Row(
                        modifier = Modifier.padding(start = 20.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Text(
                            text = "${block.number}.",
                            style = type.bodyMedium,
                            color = color
                        )
                        Text(
                            text = parseBoldAndItalic(block.text, color),
                            style = type.bodyMedium,
                            color = color
                        )
                    }
                }
            }
        }
    }
}

private fun parseMarkdownBlocks(text: String): List<MarkdownBlock> {
    val blocks = mutableListOf<MarkdownBlock>()
    val lines = text.split("\n")

    for (line in lines) {
        val trimmed = line.trim()
        val leadingSpaces = line.takeWhile { it == ' ' }.length
        val isNestedBullet = leadingSpaces >= 2 && (trimmed.startsWith("- ") || trimmed.startsWith("* "))
        when {
            trimmed.isEmpty() -> { /* skip */ }
            trimmed == "---" || trimmed == "***" || trimmed == "___" -> {
                blocks.add(MarkdownBlock.Divider)
            }
            trimmed.startsWith("### ") -> {
                blocks.add(MarkdownBlock.Header(3, trimmed.removePrefix("### ").trim()))
            }
            trimmed.startsWith("## ") -> {
                blocks.add(MarkdownBlock.Header(2, trimmed.removePrefix("## ").trim()))
            }
            trimmed.startsWith("# ") -> {
                blocks.add(MarkdownBlock.Header(1, trimmed.removePrefix("# ").trim()))
            }
            trimmed.startsWith("- ") || trimmed.startsWith("* ") -> {
                blocks.add(MarkdownBlock.BulletItem(trimmed.substring(2), nested = isNestedBullet))
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
    }

    return blocks
}

private fun parseBoldAndItalic(text: String, color: Color): AnnotatedString {
    val s = text.trim()
    return buildAnnotatedString {
        var i = 0
        while (i < s.length) {
            when {
                i + 2 <= s.length && s.startsWith("**", i) -> {
                    val end = s.indexOf("**", i + 2)
                    if (end != -1) {
                        withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = color)) {
                            append(s.substring(i + 2, end))
                        }
                        i = end + 2
                    } else {
                        withStyle(SpanStyle(color = color)) { append(s.substring(i)) }
                        break
                    }
                }
                s[i] == '*' && (i + 1 >= s.length || s[i + 1] != '*') -> {
                    val end = s.indexOf('*', i + 1)
                    if (end != -1 && (end + 1 >= s.length || s[end + 1] != '*')) {
                        withStyle(SpanStyle(fontStyle = FontStyle.Italic, color = color)) {
                            append(s.substring(i + 1, end))
                        }
                        i = end + 1
                    } else {
                        withStyle(SpanStyle(color = color)) { append(s[i].toString()) }
                        i++
                    }
                }
                else -> {
                    val nextBold = s.indexOf("**", i).takeIf { it >= 0 } ?: s.length
                    var nextItalic = s.length
                    var j = i
                    while (j < s.length) {
                        val idx = s.indexOf('*', j)
                        if (idx == -1) break
                        if (idx + 1 < s.length && s[idx + 1] == '*') {
                            j = idx + 2
                            continue
                        }
                        nextItalic = idx
                        break
                    }
                    val next = minOf(nextBold, nextItalic)
                    withStyle(SpanStyle(color = color)) {
                        append(s.substring(i, next))
                    }
                    i = next
                }
            }
        }
    }
}
