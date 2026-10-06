package org.digitalgreen.farmerchat.sdk.compose.components

import org.digitalgreen.farmerchat.sdk.compose.util.fcImeBottomPx
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import org.digitalgreen.farmerchat.sdk.compose.theme.Green500
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.Red500
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.theme.White

enum class ToastState { Success, Error, Loading }

/** Lightweight bottom toast (port of the app's Toast component). */
@Composable
fun Toast(
    message: String,
    state: ToastState,
    visible: Boolean,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    autoDismissMs: Long = 3000L
) {
    val contentColors = LocalContentColors.current
    val density = LocalDensity.current

    // Trimmed to the SDK root (util/FcInsets.kt): padding only, not a visibility check.
    val imeBottom = fcImeBottomPx()
    val keyboardPadding = with(density) { imeBottom.toDp() }

    LaunchedEffect(visible, state) {
        if (visible && state != ToastState.Loading && autoDismissMs > 0) {
            delay(autoDismissMs)
            onDismiss()
        }
    }

    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.BottomCenter
    ) {
        AnimatedVisibility(
            visible = visible,
            enter = slideInVertically(initialOffsetY = { it }, animationSpec = tween(300)),
            exit = slideOutVertically(targetOffsetY = { it }, animationSpec = tween(300))
        ) {
            Row(
                modifier = Modifier
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 24.dp + keyboardPadding)
                    .fillMaxWidth()
                    .shadow(
                        elevation = 8.dp,
                        shape = SmoothShapes.rounded(Radius.LG),
                        ambientColor = contentColors.foregroundPrimary.copy(alpha = 0.05f),
                        spotColor = contentColors.foregroundPrimary.copy(alpha = 0.08f)
                    )
                    .clip(SmoothShapes.rounded(Radius.LG))
                    .background(contentColors.surfaceSecondary)
                    .padding(horizontal = 16.dp, vertical = 13.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(
                            when (state) {
                                ToastState.Success -> Green500
                                ToastState.Error -> Red500
                                ToastState.Loading -> Green500
                            }
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    when (state) {
                        ToastState.Success -> Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Success",
                            tint = White,
                            modifier = Modifier.size(18.dp)
                        )
                        ToastState.Error -> Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Error",
                            tint = White,
                            modifier = Modifier.size(18.dp)
                        )
                        ToastState.Loading -> CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            color = White,
                            strokeWidth = 2.dp
                        )
                    }
                }

                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = contentColors.foregroundPrimary,
                    modifier = Modifier
                        .padding(start = 12.dp)
                        .weight(1f)
                )
            }
        }
    }
}

@Composable
fun rememberToastState(): ToastController {
    return remember { ToastController() }
}

class ToastController {
    var isVisible by mutableStateOf(false)
        private set
    var message by mutableStateOf("")
        private set
    var state by mutableStateOf(ToastState.Success)
        private set

    fun show(message: String, state: ToastState = ToastState.Success) {
        this.message = message
        this.state = state
        this.isVisible = true
    }

    fun dismiss() {
        isVisible = false
    }
}
