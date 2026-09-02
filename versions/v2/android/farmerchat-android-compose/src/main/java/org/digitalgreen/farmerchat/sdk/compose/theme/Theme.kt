package org.digitalgreen.farmerchat.sdk.compose.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.FarmerChatTheme as HostFarmerChatTheme

private val DarkColorScheme = darkColorScheme()
private val LightColorScheme = lightColorScheme()

/**
 * Port of the app's FarmerChatTheme, extended so an optional host
 * [HostFarmerChatTheme] (from FarmerChatConfig.theme) overlays the built-in green
 * brand. The overlay feeds the SAME tokens (BrandColors / ContentColors /
 * Typography / FcShapes) every screen already reads, so recoloring is zero-edit.
 * The SDK never uses dynamic color.
 */
@Composable
fun FarmerChatTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    languageCode: String = "en",
    hostTheme: HostFarmerChatTheme? = runCatching { FarmerChat.requireGraph().config.theme }.getOrNull(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val contentColors = resolveContentColors(hostTheme, darkTheme)
    val brandColors = resolveBrandColors(hostTheme, darkTheme)
    val shapes = resolveShapes(hostTheme)
    val typography = resolveTypography(typographyForLanguage(languageCode), hostTheme)

    CompositionLocalProvider(
        LocalContentColors provides contentColors,
        LocalBrandColors provides brandColors,
        LocalFcShapes provides shapes
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = typography,
            content = content
        )
    }
}
