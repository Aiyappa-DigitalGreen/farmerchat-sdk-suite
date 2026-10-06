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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
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
import org.digitalgreen.farmerchat.sdk.compose.theme.Green700
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.vm.rememberCoreViewModel
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.appearanceAnalyticsValue
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptState
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationTriggerSource
import androidx.compose.foundation.border
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.draw.clip
import org.digitalgreen.farmerchat.sdk.compose.theme.caption

/**
 * Settings (doc 01 §3.10). Appearance Day/Night/Auto selector, "My Farm" location row,
 * account details ("Your phone" / "Your name"), Logout / Sign up, "name updated" toast.
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
    // Written only by SessionManager.onOtpVerified, so a guest has no number and gets "—".
    val phoneNumber = remember {
        graph.prefs.getString(SdkPreferences.Keys.PHONE_NUMBER_LOGIN, "")
    }

    // ------------------------------------------------------------------ My Farm / location
    //
    // 2.0.0 "My Farm" location row. Driven by the shared LocationPromptManager singleton whose
    // overlay (LocationPromptHost) is mounted once at FarmerChatRoot, so triggering from here is
    // enough — this screen renders no permission UI of its own.
    //
    // SDK adaptation of the app-only manager helpers, all derived here without touching core
    // (identical to HomeLocationPill's adaptation on Home):
    //  • `isLocationEnabledOnce()`        → LocationPromptManager.hasStoredLocation(); core writes
    //    FARMER_APP_LATITUDE/LONGITUDE only in onLocationFetched, i.e. only after a real GPS fix.
    //  • `hasCurrentLocationPermission()` → a live ContextCompat check in this layer.
    //  • `getApproxLocationName()`        → APPROX_LOCATION_NAME, which core writes from the #16
    //    response's `display_address`. The app's separate never-overwritten
    //    IP_APPROX_LOCATION_NAME key does not exist in the SDK, so there is one name, not two.
    val locationManager = graph.locationPromptManager
    val locationState by locationManager.state.collectAsState()
    val context = LocalContext.current

    // Permission is changed in system Settings — where this screen is exactly the place the user
    // leaves from — so re-check on every resume. hasStoredLocation() alone stays true after the
    // permission is revoked, so it must be paired with a live check or the row keeps showing a
    // stale exact location.
    val lifecycleOwner = LocalLifecycleOwner.current
    var resumeTick by remember { mutableStateOf(0) }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) resumeTick++
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    val hasExactLocation = remember(resumeTick, locationState) {
        locationManager.hasStoredLocation() && locationManager.hasCurrentLocationPermission()
    }
    // Derived fresh every recomposition (cheap prefs read) rather than cached, so a permission
    // revocation is picked up immediately via resumeTick above.
    val locationPlaceName = graph.prefs.getString(SdkPreferences.Keys.APPROX_LOCATION_NAME, "")

    // Only reacts to states raised by THIS row (source == Settings) so Home's own location flow
    // does not make this row appear to be updating too.
    val isSettingsLocationFlowActive = when (val s = locationState) {
        is LocationPromptState.RequestPermission -> s.source == LocationTriggerSource.Settings
        is LocationPromptState.RequestEnableGps -> s.source == LocationTriggerSource.Settings
        is LocationPromptState.FetchingLocation -> s.source == LocationTriggerSource.Settings
        else -> false
    }
    var wasSettingsLocationFlowActive by remember { mutableStateOf(false) }
    LaunchedEffect(locationState) {
        if (wasSettingsLocationFlowActive &&
            locationState == LocationPromptState.Idle &&
            hasExactLocation
        ) {
            // Flow just completed successfully. hasExactLocation is safe to read here: core
            // persists FARMER_APP_LATITUDE/LONGITUDE in onLocationFetched *before* the coroutine
            // that flips state to Idle, and `remember(locationState)` recomputes during the
            // composition that precedes this relaunch — so it is never the pre-fetch value.
            toast.show(label(Labels.LOCATION_FOUND, "Location found"), ToastState.Success)
        }
        wasSettingsLocationFlowActive = isSettingsLocationFlowActive
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
            // App SettingsScreen.kt:150 — lowercase `option`/`value` keys, and the
            // value is the app's AppearanceMode label (Light / Dark / Default).
            mapOf(
                AnalyticsProps.OPTION_LOWER to "Appearance",
                AnalyticsProps.VALUE_LOWER to appearanceAnalyticsValue(mode)
            )
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
                // App parity: the app's bar on this screen passes showGlow = false (solid Green700).
                showGlow = false,
title = label(Labels.SETTINGS, "Settings"),
                leftIcon = Icons.Filled.Menu,
                leftRadius = Radius.Rounded,
                onLeftClick = openDrawer
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    // App parity (SettingsScreen.kt:128): 20dp sides / 32dp ends, 28dp between
                    // sections. A flat 16dp put every section title 16dp high and closed the
                    // section gaps by 12dp.
                    .padding(horizontal = 20.dp, vertical = 32.dp),
                verticalArrangement = Arrangement.spacedBy(28.dp)
            ) {
                // Appearance — app SettingsScreen.kt:132: each section groups its own title and
                // content at 10dp; the 28dp above separates SECTIONS, not a title from its card.
                Column(
                  modifier = Modifier.fillMaxWidth(),
                  verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                Text(
                    text = label(Labels.APPEARANCE, "Appearance"),
                    // App parity (SettingsScreen.kt:137): labelLarge, not titleSmall.
                    style = MaterialTheme.typography.labelLarge,
                    color = colors.foregroundPrimary
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    // App parity (SettingsScreen.kt:398): 6dp between the three tiles.
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
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
                            "FarmerChat adjusts with your phone settings"
                        )
                    },
                    // App parity (SettingsScreen.kt:184): the app's `caption` (13/18 @400).
                    // This was bodySmall (15/22), which wrapped the hint onto a second line.
                    style = caption,
                    color = colors.foregroundSecondary
                )
                }

                // My Farm (2.0.0)
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = label(Labels.MY_FARM, "My Farm"),
                        // App parity (SettingsScreen.kt:195): labelLarge, not titleSmall.
                        style = MaterialTheme.typography.labelLarge,
                        color = colors.foregroundPrimary
                    )

                    ListCard {
                        ListItem(
                            iconRes = R.drawable.fc_icon_location,
                            textLeft = label(Labels.LOCATION, "Location"),
                            textRight = when {
                                isSettingsLocationFlowActive ->
                                    label(Labels.GETTING_YOUR_LOCATION, "Getting your location")
                                locationPlaceName.isBlank() -> "—"
                                // Approximate (pre-permission) location is qualified inline with its
                                // own label, independent of the "Estimated" helper caption below —
                                // the two are worded differently by design in the app.
                                !hasExactLocation ->
                                    "$locationPlaceName (${label(Labels.APPROXIMATE, "approximate")})"
                                else -> locationPlaceName
                            },
                            showTrailingSpinner = isSettingsLocationFlowActive,
                            onClick = {
                                if (locationManager.state.value == LocationPromptState.Idle) {
                                    locationManager.triggerFromSettings()
                                }
                            }
                        )
                    }

                    // "Share your location…" / "Change anytime." are tinted Green700 as a visual
                    // accent (matching the app/Figma helper) but are not tappable themselves — the
                    // location action lives on the row above — so no underline or clickable here.
                    Text(
                        text = buildAnnotatedString {
                            if (hasExactLocation) {
                                append(
                                    label(
                                        Labels.LOCATION_HELPER_ADVICE_WEATHER,
                                        "Advice and weather for this area."
                                    )
                                )
                                append(" ")
                                withStyle(SpanStyle(color = Green700)) {
                                    append(
                                        label(
                                            Labels.LOCATION_HELPER_CHANGE_ANYTIME,
                                            "Change anytime."
                                        )
                                    )
                                }
                            } else {
                                append(label(Labels.ESTIMATED, "Estimated"))
                                append(". ")
                                withStyle(SpanStyle(color = Green700)) {
                                    append(
                                        label(
                                            Labels.LOCATION_HELPER_SHARE,
                                            "Share your location for better advice."
                                        )
                                    )
                                }
                            }
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.foregroundSecondary
                    )
                }

                // Account details
                Column(
                  modifier = Modifier.fillMaxWidth(),
                  verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                Text(
                    text = label(Labels.ACCOUNT_DETAILS, "Account details"),
                    // App parity (SettingsScreen.kt:302): labelLarge, not titleSmall.
                    style = MaterialTheme.typography.labelLarge,
                    color = colors.foregroundPrimary
                )

                ListCard {
                    // 2.0.0: read-only phone row. Non-tappable (no chevron, empty onClick) and
                    // only ever populated after OTP verification, so guests see "—" — same as
                    // the app, which reads its own persisted login number.
                    ListItem(
                        iconRes = R.drawable.fc_icon_phone,
                        textLeft = label(Labels.YOUR_PHONE, "Your phone"),
                        textRight = phoneNumber.trim().takeIf { it.isNotEmpty() } ?: "—",
                        showChevron = false,
                        showDivider = true,
                        onClick = {}
                    )
                    ListItem(
                        iconRes = R.drawable.fc_icon_name,
                        textLeft = label(Labels.YOUR_NAME, "Your name"),
                        // App parity (SettingsScreen.kt:321): an em dash when unset, never an
                        // absent value — otherwise the row shows only a chevron.
                        textRight = userName.trim().takeIf { it.isNotEmpty() } ?: "—",
                        textRightMaxLines = 4,
                        onClick = {
                            graph.analytics.track(AnalyticsEvents.EDIT_PROFILE_CLICK)
                            onNameClick()
                        }
                    )
                }
                }

                if (isAuthenticated) {
                    SecondaryButton(
                        label = label(Labels.LOGOUT, "Logout"),
                        onClick = {
                            graph.analytics.track(
                                AnalyticsEvents.LOGOUT_CLICK_EVENT,
                                // App AppNavGraph.kt:586.
                                mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.SETTINGS)
                            )
                            onLogOutClick()
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                } else {
                    SecondaryButton(
                        label = label(Labels.SIGN_UP, "Sign up"),
                        onClick = {
                            // App SettingsScreen.kt:353 — `option` only, no `value`.
                            graph.analytics.track(
                                AnalyticsEvents.SETTINGS_OPTION_SELECTED,
                                mapOf(AnalyticsProps.OPTION_LOWER to "Signup")
                            )
                            onSignUpClick()
                        },
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
    // App parity (SettingsScreen.kt:420-444): the tile surface NEVER changes — selection is a
    // 2dp borderActive ring on the same surfaceSecondary card, and the icon stays
    // foregroundPrimary. The SDK filled the selected tile with surfaceActive and tinted its icon
    // green instead, which read as a different component. Radius is LG, the icon 18dp, and the
    // height comes from the content (top 16 / bottom 14, 10dp gap), not a fixed 76dp.
    val borderColor = if (selected) colors.borderActive else Color.Transparent

    Column(
        modifier = modifier
            .clip(SmoothShapes.rounded(Radius.LG))
            .background(colors.surfaceSecondary)
            .border(
                width = 2.dp,
                color = borderColor,
                shape = SmoothShapes.rounded(Radius.LG)
            )
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
                onClick = onClick
            )
            .padding(top = 16.dp, bottom = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        androidx.compose.foundation.Image(
            painter = painterResource(id = iconRes),
            contentDescription = null,
            colorFilter = ColorFilter.tint(colors.foregroundPrimary),
            modifier = Modifier.size(18.dp)
        )
        Text(
            text = label,
            // App parity (SettingsScreen.kt:463): the Day/Night/Auto chip caption is labelSmall
            // (13sp). The SDK had labelMedium (15sp) — the one place on this screen where it
            // overshot rather than undershot.
            style = MaterialTheme.typography.labelSmall,
            color = colors.foregroundPrimary
        )
    }
}
