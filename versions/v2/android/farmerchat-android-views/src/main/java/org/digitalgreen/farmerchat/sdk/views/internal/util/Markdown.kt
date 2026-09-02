package org.digitalgreen.farmerchat.sdk.views.internal.util

import android.graphics.Typeface
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.BulletSpan
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan

/**
 * Minimal markdown renderer for AI responses (no third-party libs):
 * **bold**, *italic* / _italic_, `- ` / `* ` bullet lines, `#`..`###` headings.
 */
internal object Markdown {

    fun render(source: String): CharSequence {
        val out = SpannableStringBuilder()
        val lines = source.replace("\r\n", "\n").split("\n")
        lines.forEachIndexed { index, rawLine ->
            var line = rawLine
            var bullet = false
            var heading = 0

            val trimmed = line.trimStart()
            when {
                trimmed.startsWith("### ") -> { heading = 3; line = trimmed.removePrefix("### ") }
                trimmed.startsWith("## ") -> { heading = 2; line = trimmed.removePrefix("## ") }
                trimmed.startsWith("# ") -> { heading = 1; line = trimmed.removePrefix("# ") }
                trimmed.startsWith("- ") -> { bullet = true; line = trimmed.removePrefix("- ") }
                trimmed.startsWith("* ") && !trimmed.startsWith("**") -> {
                    bullet = true; line = trimmed.removePrefix("* ")
                }
                else -> line = rawLine
            }

            val lineStart = out.length
            appendInline(out, line)
            val lineEnd = out.length

            if (bullet && lineEnd > lineStart) {
                out.setSpan(BulletSpan(16), lineStart, lineEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
            if (heading > 0 && lineEnd > lineStart) {
                out.setSpan(StyleSpan(Typeface.BOLD), lineStart, lineEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                val size = when (heading) {
                    1 -> 1.35f
                    2 -> 1.2f
                    else -> 1.1f
                }
                out.setSpan(RelativeSizeSpan(size), lineStart, lineEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
            if (index < lines.lastIndex) out.append("\n")
        }
        return out
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
