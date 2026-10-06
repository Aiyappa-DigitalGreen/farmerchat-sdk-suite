package org.digitalgreen.farmerchat.sdk.compose.components

import android.view.HapticFeedbackConstants
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.theme.White
import org.digitalgreen.farmerchat.sdk.compose.util.labelManager
import org.digitalgreen.farmerchat.sdk.core.labels.AnswerGenerationTips
import org.digitalgreen.farmerchat.sdk.core.labels.TipData

private const val TIP_DURATION_MS = 8000
private const val TIP_SLIDE_DURATION_MS = 400

/**
 * The pager is given a large virtual page count and started in the middle so the carousel can
 * advance forever in one direction without ever reaching an edge — the app's trick for an
 * "infinite" loop over a handful of tips.
 */
private const val VIRTUAL_PAGE_COUNT = 10_000

/**
 * Bottom-anchored tip carousel shown for the whole answer-generation wait — port of the app's
 * `components/Tips.kt`.
 *
 * Renders as a full-size overlay that positions itself at [Alignment.BottomCenter], so it is
 * dropped into a [Box] alongside the content it covers rather than placed in a column.
 */
@Composable
internal fun Tips(
    tips: List<TipData>,
    modifier: Modifier = Modifier,
    showIcon: Boolean = true
) {
    // App parity: `require(tips.isNotEmpty())`. The SDK renders nothing instead of crashing —
    // AnswerGenerationTips.discover never returns empty, so an empty list can only come from a
    // host/caller mistake, and taking the chat screen down over a decoration is not a trade the
    // SDK gets to make on a host's behalf.
    if (tips.isEmpty()) return

    val shuffledTips = remember(tips) { tips.shuffled() }
    val tipCount = shuffledTips.size

    val startPage = (VIRTUAL_PAGE_COUNT / 2).let { mid -> mid - (mid % tipCount) }

    val pagerState = rememberPagerState(
        initialPage = startPage,
        pageCount = { VIRTUAL_PAGE_COUNT }
    )

    val timerProgress = remember { Animatable(0f) }
    val currentActualIndex = remember { mutableIntStateOf(0) }
    val jiggleCounter = remember { mutableIntStateOf(1) }
    val view = LocalView.current

    LaunchedEffect(tipCount) {
        while (true) {
            timerProgress.snapTo(0f)
            timerProgress.animateTo(
                targetValue = 1f,
                animationSpec = tween(durationMillis = TIP_DURATION_MS, easing = LinearEasing)
            )
            val nextPage = pagerState.currentPage + 1
            pagerState.animateScrollToPage(
                page = nextPage,
                animationSpec = tween(durationMillis = TIP_SLIDE_DURATION_MS)
            )
            currentActualIndex.intValue = nextPage % tipCount
            // Haptic + jiggle only after the tip has landed.
            view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
            jiggleCounter.intValue++
        }
    }

    val contentColors = LocalContentColors.current
    val pageBg = contentColors.surfaceReadingPrimary

    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.BottomCenter
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Fade from transparent into the page background, so an answer scrolling underneath
            // dissolves into the carousel instead of being cut off by a hard edge.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(24.dp)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(pageBg.copy(alpha = 0f), pageBg)
                        )
                    )
            )
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(pageBg)
                    .padding(bottom = 44.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                HorizontalPager(
                    state = pagerState,
                    contentPadding = PaddingValues(horizontal = 24.dp),
                    pageSpacing = 8.dp,
                    userScrollEnabled = false,
                    verticalAlignment = Alignment.Bottom,
                    modifier = Modifier.fillMaxWidth()
                ) { page ->
                    val isCurrentPage = page == pagerState.currentPage
                    val tip = shuffledTips[page % tipCount]
                    Tip(
                        title = tip.title,
                        body = tip.body,
                        showIcon = showIcon,
                        jiggleKey = if (isCurrentPage) jiggleCounter.intValue else 0,
                        // Keep every card fully opaque so the peeking side cards are the same
                        // color as the active one (no dimmed/inactive look).
                        modifier = Modifier
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                TipPaginationIndicator(
                    pageCount = tipCount,
                    currentPage = currentActualIndex.intValue,
                    timerProgress = timerProgress.value
                )
            }
        }
    }
}

/**
 * Dots for the inactive tips; the active one is a 24dp track that fills with the countdown to the
 * next tip, so the carousel tells the farmer it is still working.
 */
@Composable
private fun TipPaginationIndicator(
    pageCount: Int,
    currentPage: Int,
    timerProgress: Float
) {
    val contentColors = LocalContentColors.current
    val brandColors = LocalBrandColors.current

    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        repeat(pageCount) { index ->
            if (index == currentPage) {
                Box(
                    modifier = Modifier
                        .width(24.dp)
                        .height(8.dp)
                        .clip(RoundedCornerShape(Radius.Rounded))
                        .background(contentColors.surfaceActive)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(timerProgress)
                            .height(8.dp)
                            .background(brandColors.feedbackSuccess)
                    )
                }
            } else {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(contentColors.surfaceActive)
                )
            }
        }
    }
}

/** A single tip card — port of the app's `components/Tip.kt`. */
@Composable
private fun Tip(
    title: String,
    body: String,
    showIcon: Boolean,
    modifier: Modifier = Modifier,
    jiggleKey: Int = 0
) {
    val brandColors = LocalBrandColors.current
    val type = MaterialTheme.typography

    // App parity (Tip.kt 33837fc3): a fixed minimum height keeps every card uniform, so a
    // single-line body no longer renders a shorter card than a two-line one and the
    // auto-advancing carousel doesn't jump. Longer (e.g. localized) bodies still grow past
    // 104dp rather than clip. Content stays top-aligned so the icon + title anchor to the top.
    // Load-bearing here specifically because the HorizontalPager above sets no page height and
    // uses verticalAlignment = Bottom, so it takes the tallest page and shorter ones shift.
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 104.dp)
            .clip(SmoothShapes.rounded(Radius.LG))
            .background(brandColors.surfaceSecondary)
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalAlignment = Alignment.Top
    ) {
        if (showIcon) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .attentionWobble(
                        trigger = jiggleKey,
                        delayMs = 0L,
                        angle = 3f,
                        shrinkScale = 0.85f
                    )
                    .clip(CircleShape)
                    .background(brandColors.feedbackSuccess),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Outlined.Lightbulb,
                    contentDescription = null,
                    tint = White,
                    modifier = Modifier.size(18.dp)
                )
            }

            Box(modifier = Modifier.size(12.dp))
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = type.labelLarge,
                color = White
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = body,
                style = type.bodySmall,
                color = White
            )
        }
    }
}

/**
 * The tips for the answer-generation wait, resolved from the current label payload.
 *
 * Discovery and the built-in fallbacks live in core ([AnswerGenerationTips]) so the views
 * flavour shows the same set.
 */
@Composable
internal fun answerGenerationTips(): List<TipData> {
    val manager = labelManager
    val languageCode = manager.languageCode()
    val labels = manager.labelMap()

    // Keyed on the label COUNT, not the map: this composable is in the tree for the whole
    // streaming wait, and `remember(map)` would run full Map equality over ~1000 entries on
    // every recomposition the stream causes. The payload is replaced wholesale by endpoint #3,
    // so its size changing is the signal that matters; the language is the other input.
    return remember(languageCode, labels.size) {
        AnswerGenerationTips.discover(
            labels = labels,
            languageCode = languageCode,
            resolve = { key, fallback -> manager.getLabel(key, fallback) }
        )
    }
}
