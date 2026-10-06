package org.digitalgreen.farmerchat.sdk.compose.screens

import org.digitalgreen.farmerchat.sdk.compose.util.fcNavigationBarsBottom
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import org.digitalgreen.farmerchat.sdk.core.ui.settings.LanguageDisplayOrder
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import kotlinx.coroutines.delay
import androidx.compose.material3.Surface

/**
 * Settings → Language chooser (doc 01 §3.13). RadioButton list + "All
 * languages" expand, per-row label fetch, Save language; success → toast +
 * onLanguageSaved; label-fetch failure → onFetchLabelsFailure.
 */
@Composable
fun LanguageChooserScreen(
    openDrawer: () -> Unit,
    /**
     * Plain back navigation, used INSTEAD of [openDrawer] when the drawer is off. With
     * `showDrawer(false)` (CHAT_ONLY) `openDrawer` is a no-op, so this screen's only control was
     * a dead button. Parity with the views `LanguageChooserFragment`.
     */
    onBack: () -> Unit = {},
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
            toast.show(label(Labels.LANGUAGE_UPDATED, "Language updated"), ToastState.Success)
            delay(500L)
            onLanguageSaved()
            // consume LAST. `consumeLanguageResult()` clears `languageSubmitSuccess`, which is
            // this effect's KEY — calling it first cancelled this very coroutine during the
            // delay, so `onLanguageSaved()` never ran. The save itself worked (API 200, prefs
            // written, `languageSubmitSuccess = true`), but the farmer was left sitting on the
            // language screen with no toast and no way to tell anything had happened.
            vm.consumeLanguageResult()
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

    val bottomInset = fcNavigationBarsBottom()
    val languageState = state.languageState

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.surfacePrimary)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            val drawerOn = graph.config.showDrawer
            DefaultAppBar(
                // App parity: the app's bar on this screen passes showGlow = false (solid Green700).
                showGlow = false,
title = label(Labels.CHOOSE_YOUR_LANGUAGE, "Choose your language"),
                leftIcon = if (drawerOn) Icons.Filled.Menu else Icons.AutoMirrored.Filled.ArrowBack,
                leftRadius = Radius.Rounded,
                onLeftClick = if (drawerOn) openDrawer else onBack
            )

            when (languageState) {
                is UiState.Success -> {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            // App parity (LanguageChooserScreen.kt:172): 20dp sides, 32dp top,
                            // 20dp bottom — not a flat 16dp, which put the list 16dp high and
                            // 4dp wide of the app's rows.
                            .padding(horizontal = 20.dp)
                            .padding(top = 32.dp, bottom = 20.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        // App parity (ui/settings/LanguageChooserScreen.kt `displayedLanguages`):
                        // pin the selection to the top when it lives only in the collapsed
                        // "All languages" list.
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
                                    debounce { vm.selectLanguage(language.id, language.code) }
                                },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        if (!showAllLanguages && state.expandedLanguages.isNotEmpty()) {
                            // App parity (LanguageChooserScreen.kt:202): a 10dp spacer, then a
                            // FILLED primary Surface — buttonPrimarySurface with
                            // buttonPrimaryForeground text, not a secondary-surface Box with dark
                            // text, which rendered the chip inverted. Surface(onClick=) also
                            // applies minimumInteractiveComponentSize(), which is what gives the
                            // chip its real height; a bare Box sits a few px short.
                            Spacer(modifier = Modifier.height(10.dp))
                            Surface(
                                onClick = { showAllLanguages = true },
                                shape = SmoothShapes.rounded(Radius.Rounded),
                                color = colors.buttonPrimarySurface,
                                contentColor = colors.buttonPrimaryForeground,
                                modifier = Modifier.align(Alignment.CenterHorizontally)
                            ) {
                                Text(
                                    text = label(Labels.ALL_LANGUAGES, "All languages"),
                                    // App parity (LanguageChooserScreen.kt:211): labelLarge, the
                                    // same value the onboarding Language screen's chip uses.
                                    style = MaterialTheme.typography.labelLarge,
                                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp)
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

                    // App parity (LanguageChooserScreen.kt:273): the bar has its own
                    // surfaceSecondary background and insets the button by 24dp / 16dp top /
                    // 8dp + nav bar, so it reads as a footer rather than a floating button.
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(colors.surfaceSecondary)
                            .padding(horizontal = 24.dp)
                            .padding(top = 16.dp, bottom = 8.dp + bottomInset)
                    ) {
                        PrimaryButton(
                            label = if (state.isSubmittingLanguage)
                                label(Labels.SETTING_LANGUAGE, "Setting language")
                            else
                                label(Labels.SAVE_LANGUAGE, "Save language"),
                            // App parity (LanguageChooserScreen.kt:285): Chevron, not Default —
                            // the app's save button carries a trailing chevron.
                            state = if (state.isSubmittingLanguage) PrimaryButtonState.Loading
                            else PrimaryButtonState.Chevron,
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
                            label = label(Labels.LOADING_LANGUAGES, "Loading languages...")
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
