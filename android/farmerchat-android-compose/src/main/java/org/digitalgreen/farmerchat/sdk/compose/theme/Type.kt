package org.digitalgreen.farmerchat.sdk.compose.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

// Faithful port of the app's Type.kt — per-language typography over system SansSerif.

private fun langStyle(
    fontSize: TextUnit,
    lineHeight: TextUnit,
    fontWeight: FontWeight
): TextStyle = TextStyle(
    fontFamily = FontFamily.SansSerif,
    fontSize = fontSize,
    lineHeight = lineHeight,
    fontWeight = fontWeight
)

val caption = langStyle(13.sp, 18.sp, FontWeight(400))

val Typography = Typography(
    displayLarge = langStyle(35.sp, 42.sp, FontWeight(700)),
    displayMedium = langStyle(28.sp, 36.sp, FontWeight(700)),
    displaySmall = langStyle(24.sp, 32.sp, FontWeight(700)),

    titleLarge = langStyle(22.sp, 28.sp, FontWeight(700)),
    titleMedium = langStyle(18.sp, 24.sp, FontWeight(700)),
    titleSmall = langStyle(16.sp, 22.sp, FontWeight(700)),

    bodyLarge = langStyle(19.sp, 27.sp, FontWeight(400)),
    bodyMedium = langStyle(17.sp, 25.sp, FontWeight(400)),
    bodySmall = langStyle(15.sp, 22.sp, FontWeight(400)),

    labelLarge = langStyle(17.sp, 22.sp, FontWeight(600)),
    labelMedium = langStyle(15.sp, 20.sp, FontWeight(600)),
    labelSmall = langStyle(13.sp, 18.sp, FontWeight(600))
)

val devanagariTypography = Typography(
    displayLarge = langStyle(35.sp, 48.sp, FontWeight(700)),
    displayMedium = langStyle(28.sp, 36.sp, FontWeight(700)),
    displaySmall = langStyle(24.sp, 34.sp, FontWeight(700)),
    titleLarge = langStyle(22.sp, 28.sp, FontWeight(700)),
    titleMedium = langStyle(18.sp, 26.sp, FontWeight(700)),
    titleSmall = langStyle(16.sp, 24.sp, FontWeight(700)),
    bodyLarge = langStyle(19.sp, 27.sp, FontWeight(400)),
    bodyMedium = langStyle(17.sp, 25.sp, FontWeight(400)),
    bodySmall = langStyle(15.sp, 22.sp, FontWeight(400)),
    labelLarge = langStyle(17.sp, 22.sp, FontWeight(600)),
    labelMedium = langStyle(15.sp, 20.sp, FontWeight(600)),
    labelSmall = langStyle(13.sp, 18.sp, FontWeight(600))
)

val ethiopicTypography = Typography(
    displayLarge = langStyle(35.sp, 46.sp, FontWeight(700)),
    displayMedium = langStyle(28.sp, 34.sp, FontWeight(700)),
    displaySmall = langStyle(24.sp, 30.sp, FontWeight(700)),
    titleLarge = langStyle(22.sp, 30.sp, FontWeight(700)),
    titleMedium = langStyle(18.sp, 24.sp, FontWeight(700)),
    titleSmall = langStyle(16.sp, 20.sp, FontWeight(700)),
    bodyLarge = langStyle(19.sp, 28.sp, FontWeight(400)),
    bodyMedium = langStyle(17.sp, 25.sp, FontWeight(400)),
    bodySmall = langStyle(15.sp, 22.sp, FontWeight(400)),
    labelLarge = langStyle(17.sp, 22.sp, FontWeight(600)),
    labelMedium = langStyle(15.sp, 20.sp, FontWeight(600)),
    labelSmall = langStyle(13.sp, 18.sp, FontWeight(600))
)

val kannadaTypography = Typography(
    displayLarge = langStyle(35.sp, 48.sp, FontWeight(700)),
    displayMedium = langStyle(28.sp, 40.sp, FontWeight(700)),
    displaySmall = langStyle(24.sp, 34.sp, FontWeight(700)),
    titleLarge = langStyle(22.sp, 32.sp, FontWeight(700)),
    titleMedium = langStyle(18.sp, 26.sp, FontWeight(700)),
    titleSmall = langStyle(16.sp, 24.sp, FontWeight(700)),
    bodyLarge = langStyle(19.sp, 28.sp, FontWeight(400)),
    bodyMedium = langStyle(17.sp, 26.sp, FontWeight(400)),
    bodySmall = langStyle(15.sp, 23.sp, FontWeight(400)),
    labelLarge = langStyle(17.sp, 22.sp, FontWeight(600)),
    labelMedium = langStyle(15.sp, 20.sp, FontWeight(600)),
    labelSmall = langStyle(13.sp, 18.sp, FontWeight(600))
)

val oriyaTypography = Typography(
    displayLarge = langStyle(35.sp, 46.sp, FontWeight(700)),
    displayMedium = langStyle(28.sp, 34.sp, FontWeight(700)),
    displaySmall = langStyle(24.sp, 30.sp, FontWeight(700)),
    titleLarge = langStyle(22.sp, 30.sp, FontWeight(700)),
    titleMedium = langStyle(18.sp, 24.sp, FontWeight(700)),
    titleSmall = langStyle(16.sp, 20.sp, FontWeight(700)),
    bodyLarge = langStyle(19.sp, 28.sp, FontWeight(400)),
    bodyMedium = langStyle(17.sp, 25.sp, FontWeight(400)),
    bodySmall = langStyle(15.sp, 22.sp, FontWeight(400)),
    labelLarge = langStyle(17.sp, 22.sp, FontWeight(600)),
    labelMedium = langStyle(15.sp, 20.sp, FontWeight(600)),
    labelSmall = langStyle(13.sp, 18.sp, FontWeight(600))
)

val teluguTypography = Typography(
    displayLarge = langStyle(35.sp, 44.sp, FontWeight(700)),
    displayMedium = langStyle(28.sp, 36.sp, FontWeight(700)),
    displaySmall = langStyle(24.sp, 30.sp, FontWeight(700)),
    titleLarge = langStyle(22.sp, 28.sp, FontWeight(700)),
    titleMedium = langStyle(18.sp, 24.sp, FontWeight(700)),
    titleSmall = langStyle(16.sp, 22.sp, FontWeight(700)),
    bodyLarge = langStyle(19.sp, 27.sp, FontWeight(400)),
    bodyMedium = langStyle(17.sp, 25.sp, FontWeight(400)),
    bodySmall = langStyle(15.sp, 22.sp, FontWeight(400)),
    labelLarge = langStyle(17.sp, 22.sp, FontWeight(600)),
    labelMedium = langStyle(15.sp, 20.sp, FontWeight(600)),
    labelSmall = langStyle(13.sp, 18.sp, FontWeight(600))
)

/** Returns the correct [Typography] for a given language code (script groups per app). */
fun typographyForLanguage(code: String): Typography = when (code.lowercase().trim()) {
    "hi", "mr", "ne", "bho", "mai", "doi", "kok", "sa", "brx", "raj" -> devanagariTypography
    "am", "ti", "om", "so", "aa" -> ethiopicTypography
    "kn" -> kannadaTypography
    "or", "od" -> oriyaTypography
    "te" -> teluguTypography
    else -> Typography
}
