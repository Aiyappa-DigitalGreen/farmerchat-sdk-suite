package org.digitalgreen.farmerchat.sdk.compose.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.components.DefaultAppBar
import org.digitalgreen.farmerchat.sdk.compose.components.LogoSpinner
import org.digitalgreen.farmerchat.sdk.compose.components.LogoSpinnerType
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButton
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButtonState
import org.digitalgreen.farmerchat.sdk.compose.components.RadioButton
import org.digitalgreen.farmerchat.sdk.compose.components.Toast
import org.digitalgreen.farmerchat.sdk.compose.components.ToastState
import org.digitalgreen.farmerchat.sdk.compose.components.rememberToastState
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.util.rememberDebouncedAction
import org.digitalgreen.farmerchat.sdk.compose.vm.rememberCoreViewModel
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import kotlinx.coroutines.delay

/**
 * Settings → Language chooser (doc 01 §3.13). RadioButton list + "All
 * languages" expand, per-row label fetch, Save language; success → toast +
 * onLanguageSaved; label-fetch failure → onFetchLabelsFailure.
 */
@Composable
fun LanguageChooserScreen(
    openDrawer: () -> Unit,
    onLanguageSaved: () -> Unit,
    onFetchLabelsFailure: () -> Unit,
    onLabelsChanged: () -> Unit = {}
) {
    val graph = FarmerChat.requireGraph()
    val colors = LocalContentColors.current
    val vm = rememberCoreViewModel("settingsLanguage") { graph.settingsViewModel() }
    val state by vm.state.collectAsState()
    val toast = rememberToastState()
    val debounce = rememberDebouncedAction()

    var showAllLanguages by remember { mutableStateOf(false) }
    var navigating by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        graph.analytics.trackScreenView(AnalyticsScreens.LANGUAGE_SETTINGS)
        graph.errorNavigationManager.setActiveScreen("settings")
        vm.loadLanguages()
    }

    LaunchedEffect(state.labelsRefreshToken) {
        if (state.labelsRefreshToken > 0) onLabelsChanged()
    }

    LaunchedEffect(state.languageSubmitSuccess) {
        if (state.languageSubmitSuccess && !navigating) {
            navigating = true
            vm.consumeLanguageResult()
            toast.show(label(Labels.LANGUAGE_UPDATED, "Language updated"), ToastState.Success)
            delay(500L)
            onLanguageSaved()
        }
    }

    LaunchedEffect(state.submitErrorMessage) {
        state.submitErrorMessage?.let {
            toast.show(it, ToastState.Error)
            vm.consumeLanguageResult()
        }
    }

    // Label fetch failure after user picked a language → route home (app parity).
    LaunchedEffect(state.languageState) {
        if (state.languageState is UiState.Error && state.selectedLanguageId != null) {
            onFetchLabelsFailure()
        }
    }

    DisposableEffect(Unit) {
        onDispose { graph.analytics.trackScreenExit(AnalyticsScreens.LANGUAGE_SETTINGS) }
    }

    val bottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val languageState = state.languageState

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.surfacePrimary)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            DefaultAppBar(
                title = label(Labels.CHOOSE_YOUR_LANGUAGE, "Choose your language"),
                leftIcon = Icons.Filled.Menu,
                onLeftClick = openDrawer
            )

            when (languageState) {
                is UiState.Success -> {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        languageState.data.forEach { language ->
                            RadioButton(
                                label = language.displayName.ifBlank { language.name },
                                selected = state.selectedLanguageId == language.id,
                                isLoading = state.fetchingLabelsForId == language.id,
                                onClick = {
                                    debounce { vm.selectLanguage(language.id, language.code) }
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
                                        debounce { vm.selectLanguage(language.id, language.code) }
                                    },
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 12.dp + bottomInset)
                    ) {
                        PrimaryButton(
                            label = if (state.isSubmittingLanguage)
                                label(Labels.SETTING_LANGUAGE, "Setting language")
                            else
                                label(Labels.SAVE_LANGUAGE, "Save language"),
                            state = if (state.isSubmittingLanguage) PrimaryButtonState.Loading
                            else PrimaryButtonState.Default,
                            enabled = state.selectedLanguageId != null && !state.isFetchingLabels,
                            onClick = { vm.submitLanguage() },
                            modifier = Modifier.fillMaxWidth(),
                            height = 56
                        )
                    }
                }

                else -> {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        LogoSpinner(
                            type = LogoSpinnerType.Vertical,
                            label = label(Labels.LOADING_LANGUAGES, "Loading languages…")
                        )
                    }
                }
            }
        }

        Toast(
            message = toast.message,
            state = toast.state,
            visible = toast.isVisible,
            onDismiss = { toast.dismiss() }
        )
    }
}
