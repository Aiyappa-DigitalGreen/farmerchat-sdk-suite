package org.digitalgreen.farmerchat.sdk.views.internal

import androidx.fragment.app.Fragment

/**
 * Implemented by FarmerChatActivity and FarmerChatFragment so destination
 * fragments can reach the shared drawer/appearance host regardless of embedding.
 */
internal interface JourneyHost {
    fun openDrawer()
    fun closeDrawer()
    fun applyAppearance(mode: String)

    /**
     * Leave the SDK: fires the host's `onExit` hook, then the activity finishes; an embedded
     * fragment hands control back to its host (`FarmerChatFragment.ExitListener` / `onExit`).
     */
    fun exitJourney()

    /**
     * Whether [exitJourney] makes the SDK UI go away without finishing a HOST activity: always for
     * the SDK's own activity; embedded only when an ExitListener or `onExit` is wired. Gates the
     * CHAT_ONLY system-Back-exits handler so an unwired embed keeps Back falling through to the host.
     */
    val exitRemovesSdk: Boolean
}

/** Finds the nearest JourneyHost (parent fragment chain, then the activity). */
internal fun Fragment.journeyHost(): JourneyHost? {
    var parent: Fragment? = parentFragment
    while (parent != null) {
        if (parent is JourneyHost) return parent
        parent = parent.parentFragment
    }
    return activity as? JourneyHost
}
