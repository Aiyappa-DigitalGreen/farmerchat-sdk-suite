package org.digitalgreen.farmerchat.sdk.compose.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.imePadding
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButton
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButtonState
import org.digitalgreen.farmerchat.sdk.compose.components.SecondaryButton
import org.digitalgreen.farmerchat.sdk.compose.components.TextInput
import org.digitalgreen.farmerchat.sdk.compose.components.Toast
import org.digitalgreen.farmerchat.sdk.compose.components.ToastState
import org.digitalgreen.farmerchat.sdk.compose.components.rememberToastState
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.vm.rememberCoreViewModel
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.UserNameRequest
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.name.EnterNameViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.name.UserNameAction

/**
 * Enter Name onboarding (doc 01 §3.3). TextInput with normalizeNameInput, Save
 * (min 3 / max 100), animated Skip; on success KEY_NAME_DONE + routeFromSplash.
 */
@Composable
fun EnterNameScreen(
    onDone: () -> Unit
) {
    val graph = FarmerChat.requireGraph()
    val colors = LocalContentColors.current
    val vm = rememberCoreViewModel("enterName") { graph.enterNameViewModel() }
    val profileVm = rememberCoreViewModel("enterNameProfile") { graph.userProfileViewModel() }
    val state by vm.state.collectAsState()
    val profileState by profileVm.profileState.collectAsState()
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
        graph.analytics.trackScreenView(AnalyticsScreens.NAME)
        graph.errorNavigationManager.setActiveScreen("name")
        graph.routeDecider.markNameScreenSeen()
        // Prefer server name when logged in.
        if (graph.prefs.getBoolean(SdkPreferences.Keys.OTP_VERIFIED, false)) {
            profileVm.fetchProfile(fromScreen = "name")
        }
    }

    LaunchedEffect(profileState) {
        val p = profileState
        if (p is UiState.Success) {
            val serverName = EnterNameViewModel.sanitizeName(p.data.userProfile.displayName())
            if (serverName.isNotBlank()) name = serverName
        }
    }

    LaunchedEffect(state.updateUserNameState) {
        when (val s = state.updateUserNameState) {
            is UiState.Success -> {
                if (!isNavigating) {
                    isNavigating = true
                    graph.prefs.putBoolean(SdkPreferences.Keys.KEY_NAME_DONE, true)
                    vm.onAction(UserNameAction.ConsumeUpdateResult, AnalyticsScreens.NAME)
                    onDone()
                }
            }
            is UiState.Error -> {
                toast.show(s.message, ToastState.Error)
                vm.onAction(UserNameAction.ConsumeUpdateResult, AnalyticsScreens.NAME)
            }
            else -> Unit
        }
    }

    DisposableEffect(Unit) {
        onDispose { graph.analytics.trackScreenExit(AnalyticsScreens.NAME) }
    }

    val isSaving = state.updateUserNameState is UiState.Loading
    val topInset = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val bottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()

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
            AnalyticsScreens.NAME
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.surfacePrimary)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .imePadding()
                .padding(horizontal = 20.dp)
                .padding(top = topInset + 48.dp, bottom = bottomInset + 24.dp),
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
                text = label(Labels.WHAT_SHOULD_WE_CALL_YOU, "What should we call you?"),
                style = MaterialTheme.typography.displaySmall,
                color = colors.foregroundPrimary,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = label(Labels.WE_GREET_YOU_NAME, "So we can greet you by name"),
                style = MaterialTheme.typography.bodyMedium,
                color = colors.foregroundSecondary,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(28.dp))

            TextInput(
                value = name,
                onValueChange = { name = it },
                placeholder = label(Labels.YOUR_NAME_OR_NICKNAME, "Your name or nickname"),
                autofocus = true,
                placeCursorAtEnd = true,
                inputFilter = { EnterNameViewModel.normalizeNameInput(it) },
                showLabel = false,
                showHint = false
            )

            Spacer(modifier = Modifier.height(16.dp))

            PrimaryButton(
                label = if (isSaving) label(Labels.SAVING, "Saving")
                else label(Labels.SAVE_NAME, "Save name"),
                state = when {
                    isSaving -> PrimaryButtonState.Loading
                    name.isNotBlank() -> PrimaryButtonState.Chevron
                    else -> PrimaryButtonState.Default
                },
                enabled = name.trim().isNotEmpty() &&
                    name.trim().length <= EnterNameViewModel.MAX_NAME_LENGTH,
                onClick = { saveName() },
                modifier = Modifier.fillMaxWidth(),
                height = 56
            )

            Spacer(modifier = Modifier.height(12.dp))

            AnimatedVisibility(
                visible = name.isBlank(),
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                SecondaryButton(
                    label = label(Labels.SKIP_FOR_NOW, "Skip for now"),
                    onClick = {
                        graph.analytics.track(
                        AnalyticsEvents.NAME_SKIP_CLICK,
                        mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.NAME)
                    ) // app EnterNameRoute.kt:148
                        graph.routeDecider.markProfileDone()
                        onDone()
                    },
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
