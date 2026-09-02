package org.digitalgreen.farmerchat.sdk.compose.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.components.DefaultAppBar
import org.digitalgreen.farmerchat.sdk.compose.components.ListCard
import org.digitalgreen.farmerchat.sdk.compose.components.ListItem
import org.digitalgreen.farmerchat.sdk.compose.components.SecondaryButton
import org.digitalgreen.farmerchat.sdk.compose.components.Toast
import org.digitalgreen.farmerchat.sdk.compose.components.ToastState
import org.digitalgreen.farmerchat.sdk.compose.components.rememberToastState
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.vm.rememberCoreViewModel
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences

/**
 * Settings (doc 01 §3.10). Appearance Day/Night/Auto selector, account details
 * ("Your name"), Logout / Sign up, "name updated" toast.
 */
@Composable
fun SettingsScreen(
    openDrawer: () -> Unit,
    isAuthenticated: Boolean,
    showNameUpdatedToast: Boolean,
    onNameUpdatedToastShown: () -> Unit,
    onNameClick: () -> Unit,
    onSignUpClick: () -> Unit,
    onLogOutClick: () -> Unit,
    onAppearanceModeChange: (String) -> Unit
) {
    val graph = FarmerChat.requireGraph()
    val colors = LocalContentColors.current
    val toast = rememberToastState()
    val profileVm = rememberCoreViewModel("settingsProfile") { graph.userProfileViewModel() }

    var appearanceMode by remember {
        mutableStateOf(
            graph.prefs.getString(SdkPreferences.Keys.APPEARANCE_MODE, "auto").ifBlank { "auto" }
        )
    }
    var userName by remember {
        mutableStateOf(graph.prefs.getString(SdkPreferences.Keys.USER_NAME, ""))
    }

    LaunchedEffect(Unit) {
        graph.analytics.trackScreenView(AnalyticsScreens.SETTINGS)
        graph.errorNavigationManager.setActiveScreen("settings")
        if (isAuthenticated) {
            profileVm.fetchProfile(fromScreen = "settings")
        }
    }

    val profileState by profileVm.profileState.collectAsState()
    LaunchedEffect(profileState) {
        userName = graph.prefs.getString(SdkPreferences.Keys.USER_NAME, "")
    }

    LaunchedEffect(showNameUpdatedToast) {
        if (showNameUpdatedToast) {
            delay(500L)
            toast.show(
                label(Labels.YOUR_NAME_HAS_UPDATED, "Your name has been updated."),
                ToastState.Success
            )
            onNameUpdatedToastShown()
        }
    }

    DisposableEffect(Unit) {
        onDispose { graph.analytics.trackScreenExit(AnalyticsScreens.SETTINGS) }
    }

    fun selectAppearance(mode: String) {
        appearanceMode = mode
        graph.prefs.putString(SdkPreferences.Keys.APPEARANCE_MODE, mode)
        graph.analytics.track(
            AnalyticsEvents.SETTINGS_OPTION_SELECTED,
            mapOf(AnalyticsProps.OPTION to "appearance_$mode")
        )
        onAppearanceModeChange(mode)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.surfacePrimary)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            DefaultAppBar(
                title = label(Labels.SETTINGS, "Settings"),
                leftIcon = Icons.Filled.Menu,
                onLeftClick = openDrawer
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Appearance
                Text(
                    text = label(Labels.APPEARANCE, "Appearance"),
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.foregroundPrimary
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AppearanceModeButton(
                        label = label(Labels.DAY, "Day"),
                        iconRes = R.drawable.fc_icon_mode_day,
                        selected = appearanceMode == "day",
                        onClick = { selectAppearance("day") },
                        modifier = Modifier.weight(1f)
                    )
                    AppearanceModeButton(
                        label = label(Labels.NIGHT, "Night"),
                        iconRes = R.drawable.fc_icon_mode_night,
                        selected = appearanceMode == "night",
                        onClick = { selectAppearance("night") },
                        modifier = Modifier.weight(1f)
                    )
                    AppearanceModeButton(
                        label = label(Labels.AUTO, "Auto"),
                        iconRes = R.drawable.fc_icon_mode_auto,
                        selected = appearanceMode == "auto",
                        onClick = { selectAppearance("auto") },
                        modifier = Modifier.weight(1f)
                    )
                }

                Text(
                    text = when (appearanceMode) {
                        "day" -> label(Labels.FARMERCHAT_ALWAYS_LIGHT_MODE, "FarmerChat is always in light mode")
                        "night" -> label(Labels.FARMERCHAT_ALWAYS_DARK_MODE, "FarmerChat is always in dark mode")
                        else -> label(
                            Labels.FARMERCHAT_ADJUSTS_YOUR_PHONE_SETTINGS,
                            "FarmerChat adjusts to your phone settings"
                        )
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.foregroundSecondary
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Account details
                Text(
                    text = label(Labels.ACCOUNT_DETAILS, "Account details"),
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.foregroundPrimary
                )

                ListCard {
                    ListItem(
                        textLeft = label(Labels.YOUR_NAME, "Your name"),
                        textRight = userName.ifBlank { null },
                        onClick = {
                            graph.analytics.track(AnalyticsEvents.EDIT_PROFILE_CLICK)
                            onNameClick()
                        }
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                if (isAuthenticated) {
                    SecondaryButton(
                        label = label(Labels.LOGOUT, "Logout"),
                        onClick = {
                            graph.analytics.track(AnalyticsEvents.LOGOUT_CLICK_EVENT)
                            onLogOutClick()
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                } else {
                    SecondaryButton(
                        label = label(Labels.SIGN_UP, "Sign up"),
                        onClick = onSignUpClick,
                        modifier = Modifier.fillMaxWidth()
                    )
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

@Composable
private fun AppearanceModeButton(
    label: String,
    iconRes: Int,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = LocalContentColors.current
    val bg = if (selected) colors.surfaceActive else colors.surfaceSecondary

    Column(
        modifier = modifier
            .height(76.dp)
            .background(bg, SmoothShapes.rounded(Radius.MD))
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
                onClick = onClick
            )
            .padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        androidx.compose.foundation.Image(
            painter = painterResource(id = iconRes),
            contentDescription = null,
            colorFilter = ColorFilter.tint(
                if (selected) colors.borderActive else colors.foregroundPrimary
            ),
            modifier = Modifier.size(26.dp)
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = colors.foregroundPrimary
        )
    }
}
