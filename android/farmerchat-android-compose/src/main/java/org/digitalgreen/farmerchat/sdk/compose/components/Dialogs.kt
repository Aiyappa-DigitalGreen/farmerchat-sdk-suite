package org.digitalgreen.farmerchat.sdk.compose.components

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.theme.Containers
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.labels.Labels

/**
 * Dialog shown when a permission has been denied more than twice. Guides the
 * user to app settings (port of the app's PermissionSettingsDialog).
 */
@Composable
fun PermissionSettingsDialog(
    permissionType: String,
    screenName: String? = null,
    onDismiss: () -> Unit,
    onGoToSettings: () -> Unit
) {
    val colors = LocalContentColors.current
    val brandColors = LocalBrandColors.current
    val analytics = FarmerChat.requireGraph().analytics

    val title = when (permissionType.lowercase()) {
        "camera" -> label(Labels.CAMERA_PERMISSION_REQUIRED, "Camera Permission Required")
        "microphone" -> label(Labels.MICROPHONE_PERMISSION_REQUIRED, "Microphone Permission Required")
        else -> "Permission Required"
    }

    val message = when (permissionType.lowercase()) {
        "camera" -> label(
            Labels.PLEASE_ENABLE_CAMERA_SETTINGS,
            "Camera permission is needed to take photos of your crops and get instant advice. Please enable it in your device settings."
        )
        "microphone" -> label(
            Labels.PLEASE_ENABLE_MICROPHONE_SETTINGS,
            "Microphone permission is needed to record your voice questions. Please enable it in your device settings."
        )
        else -> label(
            Labels.THIS_FUNCTION_REQUIRED_ENABLE_IN_DEVICE_SETTINGS,
            "This permission is needed for the app to function properly. Please enable it in your device settings."
        )
    }

    fun trackCanceled() {
        analytics.track(
            AnalyticsEvents.PERMISSION_FALLBACK_SETTING_CANCELED,
            mapOf(AnalyticsProps.SCREEN_NAME to screenName)
        )
    }

    LaunchedEffect(Unit) {
        analytics.track(
            AnalyticsEvents.PERMISSION_FALLBACK_SETTING_SHOWN,
            buildMap {
                put(AnalyticsProps.PERMISSION_TYPE, permissionType)
                screenName?.let { put(AnalyticsProps.SCREEN_NAME, it) }
            }
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.scrim)
            .clickable(onClick = onDismiss),
        contentAlignment = Alignment.Center
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .then(
                    Containers.elevated(radius = Radius.XXL, background = colors.surfaceSecondary)
                )
                .clip(SmoothShapes.rounded(Radius.XXL)),
            color = Color.Transparent
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(colors.surfaceTertiary)
                            .clickable {
                                onDismiss()
                                trackCanceled()
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Close,
                            contentDescription = "Close",
                            modifier = Modifier.size(18.dp),
                            tint = colors.foregroundSecondary
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(brandColors.surfaceSecondary),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.Settings,
                        contentDescription = null,
                        modifier = Modifier.size(32.dp),
                        tint = brandColors.foregroundPrimary
                    )
                }

                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.foregroundPrimary,
                    textAlign = TextAlign.Center
                )

                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.foregroundSecondary,
                    textAlign = TextAlign.Center,
                    lineHeight = MaterialTheme.typography.bodyMedium.lineHeight
                )

                Spacer(modifier = Modifier.height(8.dp))

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    PrimaryButton(
                        label = label(Labels.GO_TO_SETTINGS, "Go to Settings"),
                        modifier = Modifier.fillMaxWidth(),
                        height = 48,
                        onClick = {
                            analytics.track(
                                AnalyticsEvents.PERMISSION_FALLBACK_SETTING_CLICKED,
                                mapOf(AnalyticsProps.SCREEN_NAME to screenName)
                            )
                            onGoToSettings()
                            onDismiss()
                        }
                    )

                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .clip(SmoothShapes.rounded(Radius.MD))
                            .clickable {
                                onDismiss()
                                trackCanceled()
                            },
                        color = colors.surfaceTertiary
                    ) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label(Labels.CLOSE, "Close"),
                                style = MaterialTheme.typography.labelLarge,
                                color = colors.foregroundPrimary
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Opens this app's system settings page. */
fun openAppSettings(context: Context) {
    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.fromParts("package", context.packageName, null)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    runCatching { context.startActivity(intent) }
}
