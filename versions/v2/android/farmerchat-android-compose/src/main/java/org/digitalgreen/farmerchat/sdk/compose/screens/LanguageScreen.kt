package org.digitalgreen.farmerchat.sdk.compose.screens

import org.digitalgreen.farmerchat.sdk.compose.util.fcNavigationBarsBottom
import org.digitalgreen.farmerchat.sdk.compose.util.fcStatusBarsTop
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.first
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.components.LogoSpinner
import org.digitalgreen.farmerchat.sdk.compose.components.LogoSpinnerType
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButton
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButtonState
import org.digitalgreen.farmerchat.sdk.compose.components.RadioButton
import org.digitalgreen.farmerchat.sdk.compose.theme.Containers
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.util.rememberDebouncedAction
import org.digitalgreen.farmerchat.sdk.compose.vm.rememberCoreViewModel
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.GeoRequestBody
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.settings.LanguageDisplayOrder
import org.digitalgreen.farmerchat.sdk.core.ui.onboarding.OnboardingAction
import org.digitalgreen.farmerchat.sdk.core.ui.onboarding.OnboardingSharedViewModel
import org.digitalgreen.farmerchat.sdk.compose.theme.caption

/**
 * Language selection onboarding (doc 01 §3.2). Drives OnboardingSharedViewModel:
 * geo fetch + guest init + languages on entry; per-row label fetch; submit →
 * routeFromSplash.
 */
@Composable
fun LanguageScreen(
    onLanguageSubmitted: () -> Unit,
    onNavigateToError: (isNetworkError: Boolean, fromScreen: String) -> Unit,
    onOpenLegal: (url: String, title: String) -> Unit,
    onLabelsChanged: () -> Unit = {}
) {
    val graph = FarmerChat.requireGraph()
    val colors = LocalContentColors.current
    val vm = rememberCoreViewModel("onboarding") { graph.onboardingViewModel() }
    val state by vm.state.collectAsState()
    val debounce = rememberDebouncedAction()

    var showAllLanguages by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        graph.analytics.trackScreenView(AnalyticsScreens.LANGUAGE)
        graph.errorNavigationManager.setActiveScreen("language")
        if (!graph.prefs.getBoolean(SdkPreferences.Keys.LANGUAGE_DONE, false)) {
            vm.onAction(OnboardingAction.ResetState)
        }
        vm.onAction(OnboardingAction.FetchGeoLocation(GeoRequestBody(), fromScreen = "language"))
        vm.onAction(OnboardingAction.FetchLegalLinks)
    }

    // Best-effort build version update once a user id exists.
    LaunchedEffect(state.guestInitState) {
        if (state.guestInitState is UiState.Success) {
            val userId = graph.prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")
            if (userId.isNotBlank() &&
                !graph.prefs.getBoolean(SdkPreferences.Keys.BUILD_VERSION_API_CALLED, false)
            ) {
                val result = runCatching {
                    graph.updateBuildVersionUseCase.updateBuildVersion(userId).first()
                }.getOrNull()
                if (result is ApiResult.Success) {
                    graph.prefs.putBoolean(SdkPreferences.Keys.BUILD_VERSION_API_CALLED, true)
                }
            }
        }
    }

    LaunchedEffect(state.languageSubmitSuccess) {
        if (state.languageSubmitSuccess) {
            vm.onAction(OnboardingAction.ConsumeLanguageResult)
            onLanguageSubmitted()
        }
    }

    LaunchedEffect(state.shouldNavigateToError) {
        if (state.shouldNavigateToError) {
            val isNetwork = state.errorIsNetworkError
            val fromScreen = state.errorFromScreen.ifBlank { "language" }
            vm.onAction(OnboardingAction.ConsumeErrorNavigation)
            onNavigateToError(isNetwork, fromScreen)
        }
    }

    // Re-compose labels after a row label fetch completes.
    LaunchedEffect(state.labelsRefreshToken) {
        if (state.labelsRefreshToken > 0) onLabelsChanged()
    }

    DisposableEffect(Unit) {
        onDispose { graph.analytics.trackScreenExit(AnalyticsScreens.LANGUAGE) }
    }

    val languageState = state.languageState

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.surfacePrimary)
    ) {
        when (languageState) {
            is UiState.Success -> {
                val topInset = fcStatusBarsTop()
                val bottomInset = fcNavigationBarsBottom()

                Column(modifier = Modifier.fillMaxSize()) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            // App parity (LanguageScreen.kt:365-367): 24 dp horizontal, 32 dp top,
                            // 24 dp bottom. The app gets its top inset from a Scaffold; this
                            // screen draws edge-to-edge, so `topInset` is added rather than
                            // replacing the app's 32 dp.
                            .padding(horizontal = 24.dp)
                            .padding(top = topInset + 32.dp, bottom = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.fc_logo_mark),
                            contentDescription = "FarmerChat",
                            // App parity (LanguageScreen.kt:373): the mark is tinted with
                            // borderActive — the brand GREEN — not foregroundPrimary. The
                            // drawable itself is solid #000000 in both trees, so the tint is the
                            // only thing that colours it: with foregroundPrimary the SDK drew a
                            // BLACK flower where the app draws a green one. Verified side by side
                            // on a dev build, 2026-09-08.
                            colorFilter = ColorFilter.tint(colors.borderActive),
                            // App parity: 32 dp, not 44 dp.
                            modifier = Modifier.size(32.dp)
                        )

                        // App parity (LanguageScreen.kt:378): 14 dp, not 20 dp.
                        Spacer(modifier = Modifier.height(14.dp))

                        Text(
                            text = label(Labels.CHOOSE_YOUR_LANGUAGE, "Choose your language"),
                            // App parity (LanguageScreen.kt:382): titleLarge, not displaySmall —
                            // displaySmall is a whole type step larger, which is why the SDK's
                            // heading crowded the rows beneath it.
                            style = MaterialTheme.typography.titleLarge,
                            color = colors.foregroundPrimary,
                            textAlign = TextAlign.Center
                        )

                        // App parity (LanguageScreen.kt:388): 8dp, not 6. Measured on-device —
                        // the 2dp shortfall carried down the whole column, putting the subtitle
                        // and all three language rows 5px above the app's.
                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = label(Labels.YOU_CHANGE_LATER, "You can change this later"),
                            style = MaterialTheme.typography.bodyMedium,
                            color = colors.foregroundSecondary,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(24.dp))

                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            // App parity: when the "All languages" list is collapsed and the
                            // selection lives only in it, the selected language is pinned to
                            // the top of the priority list so it is never invisible
                            // (LanguageScreen.kt `displayedLanguages`).
                            val rows = LanguageDisplayOrder.rowsToShow(
                                priority = languageState.data,
                                expanded = state.expandedLanguages,
                                selectedId = state.selectedLanguageId,
                                isExpanded = showAllLanguages
                            )
                            rows.forEach { language ->
                                RadioButton(
                                    label = language.displayName.ifBlank { language.name },
                                    selected = state.selectedLanguageId == language.id,
                                    isLoading = state.fetchingLabelsForId == language.id,
                                    onClick = {
                                        debounce {
                                            vm.onAction(OnboardingAction.SelectLanguage(language.id))
                                        }
                                    },
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }

                            if (showAllLanguages) {
                                state.expandedLanguages.forEach { language ->
                                    RadioButton(
                                        label = language.displayName.ifBlank { language.name },
                                        selected = state.selectedLanguageId == language.id,
                                        isLoading = state.fetchingLabelsForId == language.id,
                                        onClick = {
                                            debounce {
                                                vm.onAction(OnboardingAction.SelectLanguage(language.id))
                                            }
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                }
                            }
                        }

                        // App parity (LanguageScreen.kt:460-476): a FILLED PRIMARY chip —
                        // `buttonPrimarySurface` on `buttonPrimaryForeground`, i.e. white text on
                        // dark green, with 20dp horizontal / 10dp vertical padding and labelLarge.
                        //
                        // It is a SIBLING of the language list, not a child of it. Nested inside
                        // that Column it also collected the list's `spacedBy(6.dp)` on top of its
                        // own 16dp and rendered 11px below the app's.
                        //
                        // And it is a Material3 `Surface(onClick = …)`, not a `Box` + `clickable`:
                        // Surface applies `minimumInteractiveComponentSize()`, which pads the 44.6dp
                        // chip out to a 48dp touch target and so adds ~1.7dp above and below the
                        // visible pill. With a bare Box the chip measured 5px high of the app's even
                        // with the Spacer correct. Matching the construction also gives the chip the
                        // app's ripple and a real 48dp target.
                        if (!showAllLanguages && state.expandedLanguages.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(16.dp))

                            Surface(
                                onClick = { showAllLanguages = true },
                                shape = SmoothShapes.rounded(Radius.Rounded),
                                color = colors.buttonPrimarySurface,
                                contentColor = colors.buttonPrimaryForeground
                            ) {
                                Text(
                                    text = label(Labels.ALL_LANGUAGES, "All languages"),
                                    style = MaterialTheme.typography.labelLarge,
                                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp)
                                )
                            }
                        }
                    }

                    // Bottom bar: tagline + Start button + legal links
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .then(
                                // App parity, measured on-device against fc-compose-agentic
                                // (LanguageScreen.kt:225-248) — every number here was wrong:
                                //   radius   XL(20dp)            -> XXL(24dp)
                                //   padding  20/20/16/12         -> 24/24/28/16
                                //   spacing  spacedBy(12.dp)     -> spacedBy(20.dp)
                                // Rendered side by side the SDK's bottom panel was 34dp shorter
                                // than the app's and its content 4dp wider, so the tagline broke
                                // on a different word.
                                Containers.roundedTop(
                                    radius = Radius.XXL,
                                    background = colors.surfaceSecondary
                                )
                            )
                            .padding(start = 24.dp, end = 24.dp, top = 28.dp, bottom = 16.dp + bottomInset),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(20.dp)
                    ) {
                        Text(
                            text = label(
                                Labels.FARMERCHAT_TAGLINE,
                                "FarmerChat: Practical advice for your crops & livestock"
                            ),
                            // App parity (LanguageScreen.kt:250-252): the tagline is titleLarge on
                            // foregroundPrimary — a bold dark headline above the CTA. The SDK had
                            // it as bodySmall on foregroundSecondary, i.e. small grey caption
                            // text, which read as a footnote instead of the panel's heading.
                            style = MaterialTheme.typography.titleLarge,
                            color = colors.foregroundPrimary,
                            textAlign = TextAlign.Center
                        )

                        PrimaryButton(
                            label = if (state.isSubmittingLanguage)
                                label(Labels.SETTING_LANGUAGE, "Setting language")
                            else
                                label(Labels.START_USING_FARMERCHAT, "Start using FarmerChat"),
                            state = if (state.isSubmittingLanguage) PrimaryButtonState.Loading
                            else PrimaryButtonState.Chevron,
                            enabled = state.selectedLanguageId != null && !state.isFetchingLabels,
                            onClick = {
                                vm.onAction(OnboardingAction.AcceptTerms)
                                vm.onAction(OnboardingAction.GetStartedClicked)
                            },
                            modifier = Modifier.fillMaxWidth(),
                            height = 56
                        )

                        LegalLinksRow(
                            privacyPolicyUrl = state.privacyPolicyUrl,
                            termsOfUseUrl = state.termsOfUseUrl,
                            onOpenLegal = { url, title ->
                                when (title) {
                                    label(Labels.TERMS_OF_USE, "Terms of use") ->
                                        graph.analytics.track(
                        AnalyticsEvents.TERMS_OF_USE_OPENED,
                        mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.LANGUAGE)
                    ) // app LanguageScreen.kt:315
                                    else ->
                                        graph.analytics.track(
                        AnalyticsEvents.PRIVACY_POLICY_OPENED,
                        mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.LANGUAGE)
                    ) // app LanguageScreen.kt:339
                                }
                                onOpenLegal(url, title)
                            }
                        )
                    }
                }
            }

            else -> {
                // Idle / Loading / Error → LogoSpinner (Error silently retries per app)
                LogoSpinner(
                    type = LogoSpinnerType.Vertical,
                    labels = listOf(
                        label(Labels.FARMERCHAT_STARTING, "FarmerChat is Starting..."),
                        label(Labels.LOADING_LANGUAGES, "Loading languages...")
                    ),
                    modifier = Modifier.align(Alignment.Center)
                )
            }
        }
    }
}

@Composable
private fun LegalLinksRow(
    privacyPolicyUrl: String?,
    termsOfUseUrl: String?,
    onOpenLegal: (url: String, title: String) -> Unit
) {
    val colors = LocalContentColors.current
    val termsTitle = label(Labels.TERMS_OF_USE, "Terms of use")
    val privacyTitle = label(Labels.PRIVACY_POLICY, "Privacy policy")
    val alsoSee = label(Labels.ALSO_SEE, "also see").trim()
    val legalIntro = label(
        Labels.BY_CONTINUING_YOU_AGREE_TO_OUR,
        // App b72ea4da widened this fallback to name the AI up front.
        "FarmerChat uses AI. By continuing, you agree to our"
    )

    // App parity (LanguageScreen.kt 47bc8524): ONE flowing paragraph, justified end-to-end.
    // The intro and the two links used to be separate composables (a Text plus a Row), which
    // hard-broke the paragraph and left a short centred stub line between them. The links are
    // inline spans now, joined by the served `also_see` connector instead of a bare "·", and
    // the trailing "." sits outside the link span so it is neither underlined nor clickable.
    // App parity (LanguageScreen.kt:339-344): the links take foregroundSECONDARY, i.e. the same
    // grey as the sentence around them — they read as underlined words in a paragraph, not as a
    // darker call to action. The SDK had them on foregroundPrimary, which the rendered pair made
    // obvious.
    val linkStyles = TextLinkStyles(
        style = SpanStyle(
            textDecoration = TextDecoration.Underline,
            color = colors.foregroundSecondary
        )
    )
    val legalText = buildAnnotatedString {
        append(legalIntro)
        append(" ")
        withLink(
            LinkAnnotation.Clickable(
                tag = "terms",
                styles = linkStyles,
                linkInteractionListener = {
                    termsOfUseUrl?.let { onOpenLegal(it, termsTitle) }
                }
            )
        ) { append(termsTitle) }
        append(" ")
        // The connector is served (`fc_v2_app_label_also_see` = "also see" on DEV). If a tenant
        // serves it empty the two links simply run together with a single space, exactly as the
        // app degrades — no separator is re-introduced.
        if (alsoSee.isNotEmpty()) {
            append(alsoSee)
            append(" ")
        }
        withLink(
            LinkAnnotation.Clickable(
                tag = "privacy",
                styles = linkStyles,
                linkInteractionListener = {
                    privacyPolicyUrl?.let { onOpenLegal(it, privacyTitle) }
                }
            )
        ) { append(privacyTitle) }
        append(".")
    }

    Text(
        text = legalText,
        // App parity: the app's `caption` is 13/18 at weight 400; the SDK's `labelSmall` is
        // 13/18 at weight 600, so this paragraph rendered semibold where the app's is regular.
        style = caption.copy(textAlign = TextAlign.Justify),
        color = colors.foregroundSecondary,
        modifier = Modifier.widthIn(max = 260.dp)
    )
}
