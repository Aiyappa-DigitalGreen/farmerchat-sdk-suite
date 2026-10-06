package org.digitalgreen.farmerchat.sdk.compose.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.distinctUntilChanged
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.components.DefaultAppBar
import org.digitalgreen.farmerchat.sdk.compose.components.ListCard
import org.digitalgreen.farmerchat.sdk.compose.components.ListItem
import org.digitalgreen.farmerchat.sdk.compose.components.LogoSpinner
import org.digitalgreen.farmerchat.sdk.compose.components.LogoSpinnerType
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButton
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.ui.history.ChatHistoryViewModel
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius

/**
 * ChatHistory (doc 01 §3.9). Grouped conversation list with pagination near
 * the bottom; initial-load failure → error screen; row icon per message_type.
 */
@Composable
fun ChatHistoryScreen(
    vm: ChatHistoryViewModel,
    openDrawer: () -> Unit,
    /**
     * Plain back navigation, used INSTEAD of [openDrawer] when the drawer is off. With
     * `showDrawer(false)` (CHAT_ONLY) `openDrawer` is a no-op, so the app bar's only control was
     * a dead button and the farmer was stranded here. Parity with the views flavour's
     * `ChatHistoryFragment`, which swaps the same icon for a back arrow.
     */
    onBack: () -> Unit = {},
    onOpenChatFromHistory: (conversationId: String) -> Unit,
    onNavigateToError: (isNetworkError: Boolean) -> Unit
) {
    val graph = FarmerChat.requireGraph()
    val colors = LocalContentColors.current
    val state by vm.state.collectAsState()
    val listState = rememberLazyListState()

    LaunchedEffect(Unit) {
        graph.analytics.trackScreenView(AnalyticsScreens.CHAT_HISTORY)
        graph.errorNavigationManager.setActiveScreen("chathistory")
        vm.refresh()
    }

    // Initial-load failure routes to the full error screen.
    LaunchedEffect(state.errorMessage) {
        if (state.errorMessage != null && state.items.isEmpty() && !state.isLoading) {
            onNavigateToError(state.isNetworkError)
        }
    }

    // Pagination when scrolled near the bottom.
    LaunchedEffect(listState) {
        snapshotFlow {
            val layoutInfo = listState.layoutInfo
            val lastVisible = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            lastVisible >= layoutInfo.totalItemsCount - 3
        }
            .distinctUntilChanged()
            .collect { nearBottom ->
                if (nearBottom && state.canLoadMore && !state.isLoading) {
                    vm.loadNextPage()
                }
            }
    }

    DisposableEffect(Unit) {
        onDispose { graph.analytics.trackScreenExit(AnalyticsScreens.CHAT_HISTORY) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.surfacePrimary)
    ) {
        val drawerOn = graph.config.showDrawer
        DefaultAppBar(
            // App parity: the app's bar on this screen passes showGlow = false (solid Green700).
            showGlow = false,
title = label(Labels.RECENT_CHATS, "Recent Chats"),
            leftIcon = if (drawerOn) Icons.Filled.Menu else Icons.AutoMirrored.Filled.ArrowBack,
            leftRadius = Radius.Rounded,
            onLeftClick = if (drawerOn) openDrawer else onBack
        )

        val items = state.items

        if (state.isLoading && items.isEmpty()) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                LogoSpinner(
                    type = LogoSpinnerType.Vertical,
                    label = label(Labels.LOADING_CHATS, "Loading chats...")
                )
            }
        } else if (items.isEmpty()) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = label(Labels.NO_CHATS_YET, "No chats yet."),
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.foregroundSecondary
                )
            }
        } else {
            // Group by API `grouping` header, preserving order.
            val grouped = remember(items) {
                val map = LinkedHashMap<String, MutableList<org.digitalgreen.farmerchat.sdk.core.model.ConversationListItem>>()
                items.forEach { item ->
                    val key = item.grouping ?: ""
                    map.getOrPut(key) { mutableListOf() }.add(item)
                }
                map
            }

            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f),
                // App parity (ChatHistoryScreen.kt:160): the list is 20dp horizontal / 8dp
                // vertical, not a flat 16dp. Same flat-padding mistake already corrected on
                // Help, Settings and LanguageChooser.
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                grouped.forEach { (grouping, groupItems) ->
                    if (grouping.isNotBlank()) {
                        item(key = "header_$grouping") {
                            Text(
                                text = grouping,
                                // App parity (ChatHistoryScreen.kt:166): the date-group heading
                                // is labelLarge, not titleSmall.
                                style = MaterialTheme.typography.labelLarge,
                                color = colors.foregroundSecondary,
                                // App parity (ChatHistoryScreen.kt:170): 12dp above, 8dp below.
                                modifier = Modifier.padding(top = 12.dp, bottom = 8.dp)
                            )
                        }
                    }
                    item(key = "card_$grouping") {
                        ListCard {
                            groupItems.forEachIndexed { index, item ->
                                val iconRes = when (item.message_type?.lowercase()) {
                                    "image", "input_image", "camera" -> R.drawable.fc_icon_camera
                                    "voice", "audio", "query_audio", "mic" -> R.drawable.fc_icon_mic
                                    "card", "statement", "pre_generated" -> R.drawable.fc_icon_card
                                    else -> R.drawable.fc_icon_keyboard
                                }
                                ListItem(
                                    textLeft = item.conversation_title.orEmpty(),
                                    iconRes = iconRes,
                                    onClick = {
                                        graph.analytics.track(
                                            AnalyticsEvents.NEW_CHAT_CLICK_EVENT,
                                            mapOf(
                                                // App ChatHistoryScreen.kt:187 — raw literal
                                                // screen name and the "Conversation ID" key
                                                // (capitalised, with a space).
                                                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.CHAT_HISTORY_LITERAL,
                                                AnalyticsProps.CONVERSATION_ID_SPACED to item.conversation_id
                                            )
                                        )
                                        onOpenChatFromHistory(item.conversation_id)
                                    },
                                    showDivider = index < groupItems.lastIndex
                                )
                            }
                        }
                    }
                }

                // Pagination footer
                if (state.canLoadMore || (state.isLoading && items.isNotEmpty())) {
                    item(key = "footer_loading") {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                // App parity (ChatHistoryScreen.kt:213): the paginating spinner
                                // sits in 24dp of vertical space, not 12.
                                .padding(vertical = 24.dp),
                            horizontalArrangement = Arrangement.Center
                        ) {
                            LogoSpinner(
                                type = LogoSpinnerType.Horizontal,
                                label = label(Labels.LOADING_MORE, "Loading more...")
                            )
                        }
                    }
                }

                // Pagination error → inline retry
                if (state.errorMessage != null && items.isNotEmpty()) {
                    item(key = "footer_error") {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = label(Labels.COULDNT_LOAD_MORE_CHATS, "Couldn't load more chats"),
                                // App parity (ChatHistoryScreen.kt:127): bodyMedium, not bodySmall.
                                style = MaterialTheme.typography.bodyMedium,
                                color = colors.foregroundSecondary
                            )
                            PrimaryButton(
                                label = label(Labels.TRY_AGAIN, "Try again"),
                                onClick = { vm.loadNextPage() }
                            )
                        }
                    }
                }
            }
        }
    }
}
