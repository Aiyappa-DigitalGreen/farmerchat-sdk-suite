package org.digitalgreen.farmerchat.sdk.core.analytics

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.digitalgreen.farmerchat.sdk.core.device.CarrierInfoProvider
import org.digitalgreen.farmerchat.sdk.core.device.DeviceTypeProvider

/**
 * Raises the app's 7 device/carrier USER ATTRIBUTES through
 * [org.digitalgreen.farmerchat.sdk.FarmerChatConfig.onUserAttribute].
 *
 * Port of the app's block in `ui/onboarding/language/OnboardingSharedViewModel.kt` (+25 lines at
 * fc-compose-agentic @ 0c8c740f) — same keys, same values, same order, same
 * "only if not blank" guard on the two carrier attributes. The app raises them onto MoEngage /
 * Firebase / Plotline / Adjust; the SDK bundles no vendor SDK (root CLAUDE.md §6) and hands the
 * pairs to the host instead.
 *
 * Called at the two points where the SDK resolves a session: onboarding's guest-init success
 * (the app's own site) and the CHAT_ONLY bootstrap (an SDK-only path that skips onboarding
 * entirely, so it would otherwise report nothing).
 *
 * Deviation from the app, deliberate: [FarmerChatAnalytics.setUserAttribute] drops a blank value,
 * so a device that reports no brand/model raises no attribute rather than an empty one. The app
 * would send `""`. Recorded in docs/04-parity-matrix.md.
 *
 * Telephony reads are Binder IPC and this sits on the splash path, so the carrier lookup runs on
 * [Dispatchers.IO]. Best-effort throughout: [CarrierInfoProvider] never throws, and the
 * dispatcher swallows host-callback exceptions.
 */
internal object DeviceUserAttributes {

    suspend fun report(context: Context, analytics: FarmerChatAnalytics) {
        // ---- SIM carrier (for free-data-plan usage comparison) ----
        val carrier = withContext(Dispatchers.IO) {
            CarrierInfoProvider.getCarrierInfo(context.applicationContext)
        }
        carrier?.let {
            if (it.name.isNotBlank()) {
                analytics.setUserAttribute(UserAttributeKeys.CARRIER_NAME, it.name)
            }
            if (it.code.isNotBlank()) {
                analytics.setUserAttribute(UserAttributeKeys.CARRIER_CODE, it.code)
            }
        }

        // ---- Device type (emulator vs. actual device, to exclude test traffic) ----
        analytics.setUserAttribute(
            UserAttributeKeys.DEVICE_TYPE,
            DeviceTypeProvider.getDeviceType()
        )

        // ---- Device info (brand / model / manufacturer / os) ----
        analytics.setUserAttribute(UserAttributeKeys.BRAND, DeviceTypeProvider.getBrand())
        analytics.setUserAttribute(UserAttributeKeys.MODEL, DeviceTypeProvider.getModel())
        analytics.setUserAttribute(
            UserAttributeKeys.MANUFACTURER,
            DeviceTypeProvider.getManufacturer()
        )
        analytics.setUserAttribute(UserAttributeKeys.OS, DeviceTypeProvider.OS)
    }
}
