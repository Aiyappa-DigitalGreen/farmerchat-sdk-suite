package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.annotation.DrawableRes
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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.theme.DarkContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.util.rememberDebouncedAction
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.ui.history.DrawerQuestion
import org.digitalgreen.farmerchat.sdk.core.ui.history.DrawerQuestionType

/** Route ids used for drawer selection (mirror the app's route strings). */
object DrawerRoutes {
    const val HOME = "home"
    const val CHAT = "chat"
    const val CHAT_HISTORY = "chatHistory"
    const val SETTINGS = "settings"
    const val SETTINGS_LANGUAGE = "settings/language"
    const val HELP = "help"
}

@Composable
fun AppDrawer(
    currentRoute: String,
    onNavigate: (route: String) -> Unit,
    isAuthenticated: Boolean = false,
    gesturesEnabled: Boolean = true,
    onSeeAllClick: () -> Unit = {},
    onSignUpClick: () -> Unit = {},
    currentLanguage: String = "English",
    currentQuestion: String? = null,
    previousQuestions: List<DrawerQuestion> = emptyList(),
    historyErrorMessage: String? = null,
    onRetryHistory: () -> Unit = {},
    onDrawerOpened: () -> Unit = {},
    isLoadingHistory: Boolean = false,
    onQuestionClick: (conversationId: String) -> Unit = {},
    showSettings: Boolean = true,
    showHistory: Boolean = true,
    content: @Composable (openDrawer: () -> Unit) -> Unit
) {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val debounce = rememberDebouncedAction()

    val debouncedOnNavigate: (String) -> Unit = { route ->
        debounce {
            scope.launch { drawerState.close() }
            if (route != currentRoute) {
                onNavigate(route)
            }
        }
    }

    val debouncedOnQuestionClick: (String) -> Unit = { conversationId ->
        debounce {
            scope.launch { drawerState.close() }
            onQuestionClick(conversationId)
        }
    }

    val debouncedOnSeeAllClick: () -> Unit = {
        debounce {
            scope.launch { drawerState.close() }
            onSeeAllClick()
        }
    }

    val debouncedOnSignUpClick: () -> Unit = {
        debounce {
            scope.launch { drawerState.close() }
            onSignUpClick()
        }
    }

    val debouncedOnLanguageClick: () -> Unit = {
        debounce {
            scope.launch { drawerState.close() }
            if (DrawerRoutes.SETTINGS_LANGUAGE != currentRoute) {
                onNavigate(DrawerRoutes.SETTINGS_LANGUAGE)
            }
        }
    }

    LaunchedEffect(drawerState, isAuthenticated) {
        snapshotFlow { drawerState.targetValue }
            .distinctUntilChanged()
            .collect { targetValue ->
                if (targetValue == DrawerValue.Open && isAuthenticated) {
                    onDrawerOpened()
                }
            }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        gesturesEnabled = gesturesEnabled,
        drawerContent = {
            ModalDrawerSheet(
                modifier = Modifier.widthIn(max = 300.dp),
                drawerContainerColor = Color.Transparent,
                drawerShape = RectangleShape,
                windowInsets = WindowInsets(0)
            ) {
                DrawerContent(
                    currentRoute = currentRoute,
                    onNavigate = debouncedOnNavigate,
                    isAuthenticated = isAuthenticated,
                    previousQuestions = previousQuestions,
                    currentQuestion = currentQuestion,
                    historyErrorMessage = historyErrorMessage,
                    onRetryHistory = onRetryHistory,
                    onQuestionClick = { _, id -> debouncedOnQuestionClick(id) },
                    onSeeAllClick = debouncedOnSeeAllClick,
                    onSignUpClick = debouncedOnSignUpClick,
                    currentLanguage = currentLanguage,
                    onLanguageClick = debouncedOnLanguageClick,
                    isLoadingHistory = isLoadingHistory,
                    showSettings = showSettings,
                    showHistory = showHistory
                )
            }
        }
    ) {
        content {
            scope.launch { drawerState.open() }
        }
    }
}

@Composable
fun DrawerContent(
    currentRoute: String,
    onNavigate: (route: String) -> Unit,
    isAuthenticated: Boolean = false,
    previousQuestions: List<DrawerQuestion> = emptyList(),
    currentQuestion: String? = null,
    historyErrorMessage: String? = null,
    onRetryHistory: () -> Unit = {},
    onQuestionClick: (index: Int, conversationId: String) -> Unit = { _, _ -> },
    onSeeAllClick: () -> Unit = {},
    onSignUpClick: () -> Unit = {},
    currentLanguage: String = "English",
    onLanguageClick: () -> Unit = {},
    isLoadingHistory: Boolean = false,
    showSettings: Boolean = true,
    showHistory: Boolean = true
) {
    val brandColors = LocalBrandColors.current
    val navBarPadding = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val analytics = FarmerChat.requireGraph().analytics

    fun trackMenuOptionClick(option: String) {
        analytics.track(
            AnalyticsEvents.MENU_OPTION_CLICK_EVENT,
            mapOf(AnalyticsProps.OPTION_LOWER to option) // app DrawerContent.kt:120 — lowercase key
        )
    }

    fun trackChatHistoryClickFromMenu() {
        analytics.track(
            AnalyticsEvents.CHAT_HISTORY_CLICK_EVENT,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.MENU_LITERAL) // app DrawerContent.kt:133
        )
    }

    val selectedQuestionIndex = currentQuestion?.let { question ->
        previousQuestions.indexOfFirst { it.title == question }.takeIf { it >= 0 }
    }

    Column(
        modifier = Modifier
            .fillMaxHeight()
            .width(320.dp)
            .background(brandColors.surfaceSecondary)
    ) {
        // TOP: Logo section
        Image(
            painter = painterResource(id = R.drawable.fc_logo_wordmark),
            contentDescription = "FarmerChat",
            contentScale = ContentScale.Fit,
            colorFilter = ColorFilter.tint(Color.White),
            modifier = Modifier
                .padding(start = 24.dp, top = 56.dp, bottom = 20.dp)
                .height(16.dp)
        )

        // NAV: Main navigation items
        Column(modifier = Modifier.padding(horizontal = 12.dp)) {
            DrawerButton(
                iconRes = R.drawable.fc_icon_home,
                label = label(Labels.HOME, "Home"),
                selected = currentRoute == DrawerRoutes.HOME,
                onClick = {
                    trackMenuOptionClick("Home")
                    onNavigate(DrawerRoutes.HOME)
                }
            )
            DrawerButton(
                iconRes = R.drawable.fc_icon_language,
                label = "${label(Labels.LANGUAGE, "Language")}: $currentLanguage",
                selected = currentRoute == DrawerRoutes.SETTINGS_LANGUAGE,
                onClick = {
                    trackMenuOptionClick("Language")
                    onLanguageClick()
                }
            )
            if (showSettings) {
                DrawerButton(
                    iconRes = R.drawable.fc_icon_settings,
                    label = label(Labels.SETTINGS, "Settings"),
                    selected = currentRoute == DrawerRoutes.SETTINGS,
                    onClick = {
                        trackMenuOptionClick("Settings")
                        onNavigate(DrawerRoutes.SETTINGS)
                    }
                )
            }
            DrawerButton(
                iconRes = R.drawable.fc_icon_help,
                label = label(Labels.HELP_SUPPORT, "Help & Support"),
                selected = currentRoute == DrawerRoutes.HELP,
                onClick = {
                    trackMenuOptionClick("Help_Support")
                    onNavigate(DrawerRoutes.HELP)
                }
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        HorizontalDivider(
            color = brandColors.surfacePrimary.copy(alpha = 0.2f),
            thickness = 1.dp
        )

        if (isAuthenticated && showHistory) {
            Box(modifier = Modifier.weight(1f)) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(bottom = if (previousQuestions.isNotEmpty()) 62.dp else 0.dp)
                ) {
                    Text(
                        text = label(Labels.RECENT_CHATS, "Recent chats"),
                        style = MaterialTheme.typography.titleMedium,
                        color = brandColors.foregroundPrimary,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(
                                indication = null,
                                interactionSource = remember { MutableInteractionSource() },
                                onClick = {
                                    trackChatHistoryClickFromMenu()
                                    onSeeAllClick()
                                }
                            )
                            .padding(start = 22.dp, end = 22.dp, top = 26.dp, bottom = 10.dp)
                    )

                    if (isLoadingHistory) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 40.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            LogoSpinner(
                                type = LogoSpinnerType.Vertical,
                                label = label(Labels.LOADING_CHATS, "Loading chats..."),
                                color = Color.White
                            )
                        }
                    } else if (historyErrorMessage != null) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text(
                                text = if (historyErrorMessage.contains("network", ignoreCase = true) ||
                                    historyErrorMessage.contains("internet", ignoreCase = true)
                                ) {
                                    label(Labels.NO_INTERNET_CONNECTION, "No internet connection")
                                } else {
                                    label(Labels.FAILED_TO_LOAD_CHATS, "Failed to load chats")
                                },
                                style = MaterialTheme.typography.titleSmall,
                                color = brandColors.foregroundSecondary,
                                textAlign = TextAlign.Center
                            )
                            Text(
                                text = label(
                                    Labels.PLEASE_CONNECT_INTERNET_TRY_AGAIN,
                                    "Check your connection and try again"
                                ),
                                style = MaterialTheme.typography.bodySmall,
                                color = brandColors.foregroundPrimary.copy(alpha = 0.7f),
                                textAlign = TextAlign.Center
                            )
                            CompositionLocalProvider(LocalContentColors provides DarkContentColors) {
                                PrimaryButton(
                                    label = label(Labels.TRY_AGAIN, "Try again"),
                                    state = PrimaryButtonState.Default,
                                    onClick = onRetryHistory,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    } else if (previousQuestions.isNotEmpty()) {
                        Column(modifier = Modifier.padding(horizontal = 12.dp)) {
                            previousQuestions.take(8).forEachIndexed { index, question ->
                                val iconRes = when (question.type) {
                                    DrawerQuestionType.Camera -> R.drawable.fc_icon_camera
                                    DrawerQuestionType.Mic -> R.drawable.fc_icon_mic
                                    DrawerQuestionType.Keyboard -> R.drawable.fc_icon_keyboard
                                    DrawerQuestionType.Card -> R.drawable.fc_icon_card
                                }
                                DrawerButton(
                                    iconRes = iconRes,
                                    label = question.title,
                                    selected = selectedQuestionIndex == index,
                                    iconSize = 18,
                                    onClick = {
                                        analytics.track(
                                            AnalyticsEvents.CHAT_HISTORY_CLICK,
                                            mapOf(
                                                // App DrawerContent.kt:368.
                                                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.SIDE_MENU_LITERAL,
                                                AnalyticsProps.CONVERSATION_ID to question.conversationId,
                                                AnalyticsProps.QUESTION_INDEX to index.toString()
                                            )
                                        )
                                        onQuestionClick(index, question.conversationId)
                                    }
                                )
                            }
                        }
                    } else {
                        Text(
                            text = label(Labels.NO_CHATS_YET, "No chats yet."),
                            style = MaterialTheme.typography.bodyMedium,
                            color = brandColors.foregroundPrimary,
                            modifier = Modifier.padding(horizontal = 22.dp, vertical = 10.dp)
                        )
                    }
                }

                if (previousQuestions.isNotEmpty()) {
                    Column(modifier = Modifier.align(Alignment.BottomCenter)) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(14.dp)
                                .background(
                                    Brush.verticalGradient(
                                        colors = listOf(
                                            Color.Transparent,
                                            brandColors.surfaceSecondary
                                        )
                                    )
                                )
                        )

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(brandColors.surfaceSecondary)
                                .padding(horizontal = 16.dp)
                        ) {
                            CompositionLocalProvider(LocalContentColors provides DarkContentColors) {
                                PrimaryButton(
                                    label = label(Labels.SEE_ALL, "See all"),
                                    onClick = {
                                        trackChatHistoryClickFromMenu()
                                        onSeeAllClick()
                                    },
                                    icon = Icons.Filled.ChevronRight,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp + navBarPadding))
        } else {
            // ANONYMOUS: sign-up card pushed to bottom
            Spacer(modifier = Modifier.weight(1f))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp)
                    .clip(SmoothShapes.rounded(Radius.LG))
                    .background(brandColors.surfaceTertiary)
                    .padding(start = 10.dp, top = 18.dp, end = 10.dp, bottom = 10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = label(Labels.SAVE_YOUR_QUESTIONS_ANSWERS, "Save your past questions"),
                        style = MaterialTheme.typography.titleMedium,
                        color = brandColors.foregroundSecondary,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = label(
                            Labels.WELL_SAVE_YOUR_CHATS_YOU_CONTINUE,
                            "Keep your answers and come back anytime"
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        color = brandColors.foregroundPrimary,
                        textAlign = TextAlign.Center
                    )
                }

                CompositionLocalProvider(LocalContentColors provides DarkContentColors) {
                    PrimaryButton(
                        label = label(Labels.SIGN_UP, "Sign up"),
                        state = PrimaryButtonState.Chevron,
                        onClick = {
                            trackMenuOptionClick("Signup")
                            onSignUpClick()
                        },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp + navBarPadding))
        }
    }
}

@Composable
private fun DrawerButton(
    @DrawableRes iconRes: Int,
    label: String,
    selected: Boolean,
    iconSize: Int = 24,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val brandColors = LocalBrandColors.current
    val backgroundColor =
        if (selected) brandColors.surfaceTertiary else brandColors.surfaceSecondary

    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp)
            .clip(SmoothShapes.rounded(Radius.MD))
            .background(backgroundColor)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Image(
            painter = painterResource(id = iconRes),
            contentDescription = null,
            modifier = Modifier.size(iconSize.dp)
        )

        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = brandColors.foregroundPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
    }
}
