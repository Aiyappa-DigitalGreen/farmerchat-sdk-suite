package org.digitalgreen.farmerchat.sdk.compose.screens

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
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
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.GeoRequestBody
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.onboarding.OnboardingAction
import org.digitalgreen.farmerchat.sdk.core.ui.onboarding.OnboardingSharedViewModel

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
                val topInset = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
                val bottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()

                Column(modifier = Modifier.fillMaxSize()) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 20.dp)
                            .padding(top = topInset + 24.dp, bottom = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.fc_logo_mark),
                            contentDescription = "FarmerChat",
                            colorFilter = ColorFilter.tint(colors.foregroundPrimary),
                            modifier = Modifier.size(44.dp)
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        Text(
                            text = label(Labels.CHOOSE_YOUR_LANGUAGE, "Choose your language"),
                            style = MaterialTheme.typography.displaySmall,
                            color = colors.foregroundPrimary,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(6.dp))

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
                            languageState.data.forEach { language ->
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

                            if (!showAllLanguages && state.expandedLanguages.isNotEmpty()) {
                                Box(
                                    modifier = Modifier
                                        .padding(top = 10.dp)
                                        .background(
                                            colors.surfaceSecondary,
                                            SmoothShapes.rounded(Radius.Rounded)
                                        )
                                        .clickable(
                                            indication = null,
                                            interactionSource = remember { MutableInteractionSource() }
                                        ) { showAllLanguages = true }
                                        .padding(horizontal = 18.dp, vertical = 10.dp)
                                        .align(Alignment.CenterHorizontally)
                                ) {
                                    Text(
                                        text = label(Labels.ALL_LANGUAGES, "All languages"),
                                        style = MaterialTheme.typography.labelMedium,
                                        color = colors.foregroundPrimary
                                    )
                                }
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
                    }

                    // Bottom bar: tagline + Start button + legal links
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .then(
                                Containers.roundedTop(
                                    radius = Radius.XL,
                                    background = colors.surfaceSecondary
                                )
                            )
                            .padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 12.dp + bottomInset),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = label(
                                Labels.FARMERCHAT_TAGLINE,
                                "Practical advice for your crops and animals"
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.foregroundSecondary,
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
                                        graph.analytics.track(AnalyticsEvents.TERMS_OF_USE_OPENED)
                                    else ->
                                        graph.analytics.track(AnalyticsEvents.PRIVACY_POLICY_OPENED)
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
                        label(Labels.FARMERCHAT_STARTING, "FarmerChat is Starting…"),
                        label(Labels.LOADING_LANGUAGES, "Loading languages…")
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

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Text(
            text = label(Labels.BY_CONTINUING_YOU_AGREE_TO_OUR, "By continuing you agree to our"),
            style = MaterialTheme.typography.labelSmall,
            color = colors.foregroundSecondary,
            textAlign = TextAlign.Center
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = termsTitle,
                style = MaterialTheme.typography.labelSmall.copy(
                    textDecoration = TextDecoration.Underline
                ),
                color = colors.foregroundPrimary,
                modifier = Modifier.clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() }
                ) {
                    termsOfUseUrl?.let { onOpenLegal(it, termsTitle) }
                }
            )
            Text(
                text = "·",
                style = MaterialTheme.typography.labelSmall,
                color = colors.foregroundSecondary
            )
            Text(
                text = privacyTitle,
                style = MaterialTheme.typography.labelSmall.copy(
                    textDecoration = TextDecoration.Underline
                ),
                color = colors.foregroundPrimary,
                modifier = Modifier.clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() }
                ) {
                    privacyPolicyUrl?.let { onOpenLegal(it, privacyTitle) }
                }
            )
        }
    }
}
