package org.digitalgreen.farmerchat.sample.jetpack

import android.util.Log
import org.digitalgreen.farmerchat.sdk.FarmerChatConfig
import org.digitalgreen.farmerchat.sdk.FarmerChatEnvironment
import org.digitalgreen.farmerchat.sdk.FarmerChatMode
import org.digitalgreen.farmerchat.sdk.FarmerChatTheme

/**
 * ★ CUSTOMIZE HERE ★
 *
 * This is the ONE place you edit to make FarmerChat match your app. Change the
 * colors / radii / FAB / copy below, rebuild, and every FarmerChat screen
 * (including the chat opened by the FAB) re-themes to match.
 *
 * Colors are ARGB ints (0xAARRGGBB). Radii are dp, font size is sp.
 */
object FarmerChatSetup {

    fun config(): FarmerChatConfig =
        FarmerChatConfig.builder(FarmerChatEnvironment.DEV)

            // ── Chat-only: the FAB opens straight into the chat screen (no
            //    onboarding/home). The SDK bootstraps the guest session +
            //    conversation for this mode. Remove for the full journey. ──
            .mode(FarmerChatMode.CHAT_ONLY)

            // ── Your brand theme ─────────────────────────────────────────────
            .theme(
                FarmerChatTheme.builder()
                    .brandPrimary(0xFF2E7D32.toInt())      // app bars, primary buttons
                    .brandPrimaryDark(0xFF1B5E20.toInt())  // dark-green surfaces
                    .brandAccent(0xFF66BB6A.toInt())       // icons, highlights
                    .onBrand(0xFFFFFFFF.toInt())           // text/icons on brand
                    .cardCornerRadius(20)
                    .buttonCornerRadius(14)
                    .inputCornerRadius(14)
                    // .fontFamily(R.font.your_font)       // optional: your @font res
                    // .logo(R.drawable.your_logo)         // optional: your logo mark
                    .build()
            )

            // ── Floating button (FarmerChatFab) look ─────────────────────────
            .fabLabel("Ask FarmerChat")                    // null → round icon-only FAB
            .fabBackgroundColor(0xFF2E7D32.toInt())
            .fabContentColor(0xFFFFFFFF.toInt())

            // ── Chat bubble tweaks (optional) ────────────────────────────────
            .userBubbleColor(0xFFE8F5E9.toInt())
            .bubbleCornerRadius(18)
            .messageFontSizeSp(15f)

            // ── Analytics: every SDK event reaches you here ──────────────────
            .onEvent { name, props -> Log.d(TAG, "event: $name $props") }
            .onChatOpened { Log.i(TAG, "chat opened") }
            .onError { code, msg -> Log.e(TAG, "onError code=$code msg=$msg") }
            .debugLogging(true)

            .build()

    private const val TAG = "GreenAcres"
}
