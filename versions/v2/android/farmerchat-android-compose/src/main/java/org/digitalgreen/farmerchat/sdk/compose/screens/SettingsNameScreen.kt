package org.digitalgreen.farmerchat.sdk.compose.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.components.DefaultAppBar
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButton
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButtonState
import org.digitalgreen.farmerchat.sdk.compose.components.TextInput
import org.digitalgreen.farmerchat.sdk.compose.components.Toast
import org.digitalgreen.farmerchat.sdk.compose.components.ToastState
import org.digitalgreen.farmerchat.sdk.compose.components.rememberToastState
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.vm.rememberCoreViewModel
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.UserNameRequest
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.name.EnterNameViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.name.UserNameAction

/**
 * Settings → Name (doc 01 §3.11). Back appbar, normalized TextInput + Save,
 * min-3/max-100 validation; on success popBack + toast flag.
 */
@Composable
fun SettingsNameScreen(
    onBack: () -> Unit,
    onSaveComplete: () -> Unit
) {
    val graph = FarmerChat.requireGraph()
    val colors = LocalContentColors.current
    val vm = rememberCoreViewModel("settingsName") { graph.enterNameViewModel() }
    val state by vm.state.collectAsState()
    val toast = rememberToastState()

    var name by rememberSaveable {
        mutableStateOf(
            EnterNameViewModel.sanitizeName(
                graph.prefs.getString(SdkPreferences.Keys.USER_NAME, "")
            )
        )
    }
    var isNavigating by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        graph.analytics.trackScreenView(AnalyticsScreens.SETTINGS_NAME)
        graph.errorNavigationManager.setActiveScreen("settings")
    }

    LaunchedEffect(state.updateUserNameState) {
        when (val s = state.updateUserNameState) {
            is UiState.Success -> {
                if (!isNavigating) {
                    isNavigating = true
                    vm.onAction(UserNameAction.ConsumeUpdateResult, AnalyticsScreens.SETTINGS)
                    onSaveComplete()
                }
            }
            is UiState.Error -> {
                toast.show(s.message, ToastState.Error)
                vm.onAction(UserNameAction.ConsumeUpdateResult, AnalyticsScreens.SETTINGS)
            }
            else -> Unit
        }
    }

    DisposableEffect(Unit) {
        onDispose { graph.analytics.trackScreenExit(AnalyticsScreens.SETTINGS_NAME) }
    }

    val isSaving = state.updateUserNameState is UiState.Loading

    fun saveName() {
        val trimmed = name.trim()
        if (trimmed.length < EnterNameViewModel.MIN_NAME_LENGTH) {
            toast.show(
                "${label(Labels.NAME_MUST_BE_AT_LEAST, "Name must be at least")} " +
                    "${EnterNameViewModel.MIN_NAME_LENGTH} ${label(Labels.CHARACTERS, "characters")}",
                ToastState.Error
            )
            return
        }
        if (trimmed.length > EnterNameViewModel.MAX_NAME_LENGTH) {
            toast.show(
                "${label(Labels.NAME_MUST_BE_AT_MOST, "Name must be at most")} " +
                    "${EnterNameViewModel.MAX_NAME_LENGTH} ${label(Labels.CHARACTERS, "characters")}",
                ToastState.Error
            )
            return
        }
        val userId = graph.prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")
        vm.onAction(
            UserNameAction.UpdateUserName(UserNameRequest(user_id = userId, name = trimmed)),
            AnalyticsScreens.SETTINGS
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.surfacePrimary)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            DefaultAppBar(
                // App parity: the app's bar on this screen passes showGlow = false (solid Green700).
                showGlow = false,
title = label(Labels.NAME, "Name"),
                leftIcon = Icons.AutoMirrored.Filled.ArrowBack,
                onLeftClick = onBack
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .imePadding()
                    // App parity (SettingsNameScreen.kt:131): 20dp sides / 32dp ends.
                    .padding(horizontal = 20.dp, vertical = 32.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                TextInput(
                    value = name,
                    onValueChange = { name = it },
                    label = label(Labels.YOUR_NAME, "Your name"),
                    placeholder = label(Labels.ENTER_YOUR_NAME, "Enter your name"),
                    autofocus = true,
                    placeCursorAtEnd = true,
                    inputFilter = { EnterNameViewModel.normalizeNameInput(it) },
                    showHint = false
                )

                PrimaryButton(
                    label = if (isSaving) label(Labels.SAVING, "Saving")
                    else label(Labels.SAVE_NAME, "Save name"),
                    state = if (isSaving) PrimaryButtonState.Loading else PrimaryButtonState.Default,
                    enabled = name.trim().isNotEmpty(),
                    onClick = { saveName() },
                    // App parity (SettingsNameScreen.kt:156): no height override — the button
                    // takes PrimaryButton's 48dp default. 56 made it 8dp taller than the app's.
                    modifier = Modifier.fillMaxWidth()
                )
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
