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
