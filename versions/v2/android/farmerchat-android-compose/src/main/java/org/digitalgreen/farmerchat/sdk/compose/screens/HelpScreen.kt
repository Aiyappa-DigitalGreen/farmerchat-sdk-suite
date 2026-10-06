package org.digitalgreen.farmerchat.sdk.compose.screens

import androidx.compose.animation.Crossfade
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.collect
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.components.DefaultAppBar
import org.digitalgreen.farmerchat.sdk.compose.components.ListCard
import org.digitalgreen.farmerchat.sdk.compose.components.ListItem
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.HelpSupportResponse
import org.digitalgreen.farmerchat.sdk.core.navigation.handleError
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import androidx.compose.ui.text.font.FontWeight
import org.digitalgreen.farmerchat.sdk.compose.theme.caption
import org.digitalgreen.farmerchat.sdk.FarmerChatVersion

/**
 * Help & Support (doc 01 §3.12). FAQ list (skeleton while loading), More
 * section (Terms / Privacy from the API legal block), version footer.
 */
@Composable
fun HelpScreen(
    openDrawer: () -> Unit,
    onOpenUrl: (title: String, url: String) -> Unit
) {
    val graph = FarmerChat.requireGraph()
    val colors = LocalContentColors.current

    var response by remember { mutableStateOf<HelpSupportResponse?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var reloadToken by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        graph.analytics.trackScreenView(AnalyticsScreens.HELP)
        graph.errorNavigationManager.setActiveScreen("help")
    }

    LaunchedEffect(reloadToken) {
        isLoading = true
        val lang = graph.prefs.getString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, "en").ifBlank { "en" }
        val appearance = graph.prefs.getString(SdkPreferences.Keys.APPEARANCE_MODE, "auto")
        val country = graph.prefs.getString(SdkPreferences.Keys.USER_COUNTRY_CODE, "").ifBlank { null }
        graph.getHelpSupportUseCase.getHelpSupport(lang, 5, appearance, country).collect { result ->
            when (result) {
                is ApiResult.Success -> {
                    response = result.data
                    isLoading = false
                }
                is ApiResult.Error -> {
                    isLoading = false
                    result.handleError(graph.errorNavigationManager, fromScreen = "help") {
                        reloadToken++
                    }
                }
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose { graph.analytics.trackScreenExit(AnalyticsScreens.HELP) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.surfacePrimary)
    ) {
        DefaultAppBar(
            // App parity: the app's bar on this screen passes showGlow = false (solid Green700).
            showGlow = false,
title = label(Labels.HELP, "Help"),
            leftIcon = Icons.Filled.Menu,
            leftRadius = Radius.Rounded,
            onLeftClick = openDrawer
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                // App parity (HelpScreen.kt:152): 20dp sides / 32dp ends, and 24dp between the
                // three SECTIONS. Each section then groups its own title + card at 10dp. A flat
                // 16dp everywhere put the first title 16dp high and every title 6dp off its card.
                .padding(horizontal = 20.dp, vertical = 32.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
          Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
          ) {
            Text(
                text = label(Labels.HOW_TO_USE_FARMERCHAT, "How to use FarmerChat"),
                // App parity (HelpScreen.kt:165): labelLarge, not titleSmall.
                style = MaterialTheme.typography.labelLarge,
                color = colors.foregroundPrimary
            )

            Crossfade(targetState = isLoading, label = "faqCrossfade") { loading ->
                if (loading) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        repeat(5) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                                    .background(colors.shimmer, SmoothShapes.rounded(Radius.MD))
                            )
                        }
                    }
                } else {
                    val faqs = response?.data?.faqs.orEmpty()
                    if (faqs.isEmpty()) {
                        Text(
                            text = label(Labels.NO_FAQS_AVAILABLE, "No FAQs available"),
                            style = MaterialTheme.typography.bodyMedium,
                            color = colors.foregroundSecondary
                        )
                    } else {
                        ListCard {
                            faqs.forEachIndexed { index, faq ->
                                ListItem(
                                    textLeft = faq.title,
                                    onClick = {
                                        graph.analytics.track(
                                            AnalyticsEvents.FAQ_CLICKED,
                                            // App HelpScreen.kt:201.
                                            mapOf(
                                                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HELP_LITERAL,
                                                AnalyticsProps.QUESTION to faq.title,
                                                AnalyticsProps.ID to faq.id
                                            )
                                        )
                                        val url = faq.webviewUrl
                                        if (!url.isNullOrBlank()) {
                                            onOpenUrl("faq_terms", url)
                                        }
                                    },
                                    showDivider = index < faqs.lastIndex
                                )
                            }
                        }
                    }
                }
            }

          }

          Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
          ) {
            Text(
                text = label(Labels.MORE, "More"),
                // App parity (HelpScreen.kt:236): labelLarge, not titleSmall.
                style = MaterialTheme.typography.labelLarge,
                color = colors.foregroundPrimary
            )

            ListCard {
                val legal = response?.data?.legal
                // App parity (HelpScreen.kt:242/261): the row text is the SERVED LABEL, always.
                // Preferring the #legal payload's own `title` rendered these two rows in English
                // ("Terms of Use" / "Privacy Policy") on a Kannada device, because that endpoint
                // returns untranslated titles — the app never reads them for display.
                val termsTitle = label(Labels.TERMS_OF_USE, "Terms of use")
                val privacyTitle = label(Labels.PRIVACY_POLICY, "Privacy policy")

                ListItem(
                    textLeft = termsTitle,
                    onClick = {
                        // App HelpScreen.kt:245.
                        graph.analytics.track(
                            AnalyticsEvents.TERMS_OF_USE_OPENED,
                            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HELP_LITERAL)
                        )
                        val url = legal?.termsOfUse?.webviewUrl
                        if (!url.isNullOrBlank()) onOpenUrl(termsTitle, url)
                    },
                    showDivider = true
                )
                ListItem(
                    textLeft = privacyTitle,
                    onClick = {
                        // App HelpScreen.kt:263.
                        graph.analytics.track(
                            AnalyticsEvents.PRIVACY_POLICY_OPENED,
                            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HELP_LITERAL)
                        )
                        val url = legal?.privacyPolicy?.webviewUrl
                        if (!url.isNullOrBlank()) onOpenUrl(privacyTitle, url)
                    }
                )
            }

          }

            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                // App parity (HelpScreen.kt:285): 4dp, not 2dp.
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    // App parity (HelpScreen.kt:286): a plain LITERAL, never a served label —
                    // `label(FARMERCHAT_V200, …)` rendered this line in Kannada script on a
                    // Kannada device while the app always shows the Latin product name. The
                    // number differs legitimately: this is the SDK's version, not the app's.
                    text = "FarmerChat v.${FarmerChatVersion.VERSION}",
                    // App parity (HelpScreen.kt:288): the app's `caption`, ported in Type.kt.
                    style = caption,
                    color = colors.foregroundSecondary,
                    textAlign = TextAlign.Center
                )
                Text(
                    text = label(Labels.DIGITAL_GREEN, "© Digital Green"),
                    // App parity (HelpScreen.kt:288): the app's `caption`, ported in Type.kt.
                    style = caption,
                    color = colors.foregroundSecondary,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
