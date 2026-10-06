package org.digitalgreen.farmerchat.sdk.views.internal.theme

/**
 * Per-script line heights — the Views port of the app's `theme/Type.kt`.
 *
 * The app does NOT use one type scale. It declares six `Typography` sets and picks one with
 * `typographyForLanguage(code)`; the font sizes are identical across all six but the **line
 * heights differ**, because Devanagari, Ethiopic, Kannada, Oriya and Telugu glyphs need more
 * vertical room than Roman ones. Kannada `titleLarge` is 32sp of line height where Roman is 28.
 *
 * The compose flavour ports this properly (`theme/Type.kt` + `typographyForLanguage`). The views
 * flavour set text sizes in XML and **no line spacing at all**, so every Indic script rendered
 * with the platform default — cramped, and clipping tall glyph stacks.
 *
 * Views has no `Typography` object to swap, so the mapping is keyed on the one thing an inflated
 * `TextView` reliably knows: its own text size. Every size in the app's scale maps to exactly one
 * line height per script, so `sizeSp -> lineHeightSp` is unambiguous.
 *
 * Applied centrally by [FcThemeInflaterFactory], so it covers fragment layouts and RecyclerView
 * item views without touching individual XML.
 */
internal object FcTypography {

    /** Roman / default — the app's `Typography`. */
    private val roman = mapOf(
        35 to 42, 28 to 36, 24 to 32, 22 to 28, 18 to 24, 16 to 22,
        19 to 27, 17 to 25, 15 to 22, 13 to 18
    )

    private val devanagari = mapOf(
        35 to 48, 28 to 36, 24 to 34, 22 to 28, 18 to 26, 16 to 24,
        19 to 27, 17 to 25, 15 to 22, 13 to 18
    )

    private val ethiopic = mapOf(
        35 to 46, 28 to 34, 24 to 30, 22 to 30, 18 to 24, 16 to 20,
        19 to 28, 17 to 25, 15 to 22, 13 to 18
    )

    private val kannada = mapOf(
        35 to 48, 28 to 40, 24 to 34, 22 to 32, 18 to 26, 16 to 24,
        19 to 28, 17 to 26, 15 to 23, 13 to 18
    )

    private val oriya = mapOf(
        35 to 46, 28 to 34, 24 to 30, 22 to 30, 18 to 24, 16 to 20,
        19 to 28, 17 to 25, 15 to 22, 13 to 18
    )

    private val telugu = mapOf(
        35 to 44, 28 to 36, 24 to 30, 22 to 28, 18 to 24, 16 to 22,
        19 to 27, 17 to 25, 15 to 22, 13 to 18
    )

    /**
     * Script groups copied verbatim from the app's `typographyForLanguage`. Keeping the exact
     * language lists matters: `mr`/`ne`/`bho` are Devanagari and must not fall through to Roman.
     */
    private fun tableFor(languageCode: String): Map<Int, Int> =
        when (languageCode.lowercase().trim()) {
            "hi", "mr", "ne", "bho", "mai", "doi", "kok", "sa", "brx", "raj" -> devanagari
            "am", "ti", "om", "so", "aa" -> ethiopic
            "kn" -> kannada
            "or", "od" -> oriya
            "te" -> telugu
            else -> roman
        }

    /**
     * The line height in sp for [sizeSp] under [languageCode], or null when the size is not part
     * of the app's scale — in which case the platform default is left alone rather than guessed
     * at. (The views layouts do carry a few off-scale sizes: 12, 14 and 20sp.)
     */
    fun lineHeightSp(sizeSp: Int, languageCode: String): Int? = tableFor(languageCode)[sizeSp]
}
