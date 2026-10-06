package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import android.content.Context
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.util.AttributeSet
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptManager
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptState
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationTriggerSource
import org.digitalgreen.farmerchat.sdk.views.R

/**
 * The Home header's location pill — the Views port of compose `HomeLocationPill` +
 * `LocationButton` (`HomeScreen.kt:1429`, `components/LocationButton.kt`).
 *
 * This was the last structurally missing piece of the views agentic Home. It is NOT markup: one
 * pill carries the whole location-acquisition lifecycle, and which of five states it shows decides
 * what a farmer is told about their own location. Getting that wrong is worse than showing
 * nothing, which is why it was left until it could be ported properly rather than approximated.
 *
 * ## The five states, and the rule that picks one
 *
 * Ported from `HomeScreen.kt:1510-1517`, in this precedence order:
 *
 *  1. **Blocked** — `denyCount >= 2 && !hasPermission`. Deliberately NOT keyed on
 *     `LocationPromptState.Recovery`: dismissing the "We need your location" sheet must not make
 *     the pill fall back to approximate text while the permission is still blocked.
 *  2. **Searching** — acquisition actually started (`RequestEnableGps`/`FetchingLocation` from
 *     `LocalContext`). Not while the OS permission dialog is still up, which would read as
 *     "started too early".
 *  3. **Success** — held 1500ms after the flow completes with a stored location.
 *  4. **Located** — an exact fix, or a profile-derived approximate place name.
 *  5. **Invite** — "Set your location".
 *
 * ## Two subtleties that are easy to lose
 *
 * **Permission must be re-checked on resume.** It is changed in system Settings, and
 * `hasStoredLocation()` alone only means "a fix was once saved" — it stays true after the
 * permission is revoked. Call [refresh] from the host's `onResume`; compose does the equivalent
 * with a `resumeTick`.
 *
 * **The tap re-runs the flow** rather than jumping to system Settings. With `denyCount >= 2` and
 * no permission the manager lands on `Recovery`, which is what shows the sheet — with its own
 * "Turn on in Settings" button — again.
 */
internal class LocationPillView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    enum class State { Invite, Searching, Success, Located, Blocked }

    private val icon = ImageView(context)
    private val spinner = ProgressBar(context).apply { isIndeterminate = true }
    private val text = FcText(context).apply {
        setTextSizeSp(15f)          // labelMedium
        setTextWeight(600)
        setMaxLines(1)
    }

    private var manager: LocationPromptManager? = null
    private var prefs: SdkPreferences? = null
    private var labelFor: (String, String) -> String = { _, fallback -> fallback }

    private var successUntil = 0L
    private var wasFlowActive = false

    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        background = ContextCompat.getDrawable(context, R.drawable.fc_bg_location_pill)
        isClickable = true
        isFocusable = true
        // Compose parity (LocationButton.kt:82): 14dp icon side / 22dp text side — asymmetric.
        setPadding(dp(14), 0, dp(22), 0)
        addView(icon, LayoutParams(dp(22), dp(22)))
        addView(spinner, LayoutParams(dp(18), dp(18)))
        addView(text, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))
        text.setTextColor(FcTokens.color(context, R.color.fc_brand_foreground_primary))
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    /**
     * @param labelFor the host's label resolver, injected rather than reached for statically so
     *   this view stays testable and does not depend on a graph being initialised.
     */
    fun bind(
        manager: LocationPromptManager,
        prefs: SdkPreferences,
        labelFor: (String, String) -> String,
        onTap: () -> Unit
    ) {
        this.manager = manager
        this.prefs = prefs
        this.labelFor = labelFor
        setOnClickListener { onTap() }
        refresh()
    }

    /** Re-derive the state. Call from the host's `onResume` and on every location-state change. */
    fun refresh(locationState: LocationPromptState = LocationPromptState.Idle) {
        val mgr = manager ?: return
        val p = prefs ?: return

        // FINE only — the same check the manager's decision tree uses (app parity).
        val hasPermission = mgr.hasCurrentLocationPermission()

        val hasExact = mgr.hasStoredLocation() && hasPermission
        val blocked = mgr.isBlockedByPermission()

        fun fromLocalContext(s: LocationPromptState): Boolean = when (s) {
            is LocationPromptState.Interstitial -> s.source == LocationTriggerSource.LocalContext
            is LocationPromptState.RequestPermission -> s.source == LocationTriggerSource.LocalContext
            is LocationPromptState.RequestEnableGps -> s.source == LocationTriggerSource.LocalContext
            is LocationPromptState.FetchingLocation -> s.source == LocationTriggerSource.LocalContext
            is LocationPromptState.Recovery -> s.source == LocationTriggerSource.LocalContext
            else -> false
        }
        val flowActive = fromLocalContext(locationState)
        val searching = when (locationState) {
            is LocationPromptState.RequestEnableGps ->
                locationState.source == LocationTriggerSource.LocalContext
            is LocationPromptState.FetchingLocation ->
                locationState.source == LocationTriggerSource.LocalContext
            else -> false
        }

        // Flow just completed successfully — hold the checkmark briefly (compose: delay(1500)).
        if (wasFlowActive && locationState == LocationPromptState.Idle && mgr.hasStoredLocation()) {
            successUntil = System.currentTimeMillis() + 1500
            postDelayed({ refresh(LocationPromptState.Idle) }, 1600)
        }
        wasFlowActive = flowActive

        val place = p.getString(SdkPreferences.Keys.APPROX_LOCATION_NAME, "")

        val state = when {
            blocked -> State.Blocked
            searching -> State.Searching
            System.currentTimeMillis() < successUntil -> State.Success
            hasExact || place.isNotBlank() -> State.Located
            else -> State.Invite
        }
        render(state, place)
    }

    private fun render(state: State, place: String) {
        // Compose parity (LocationButton.kt:69): the located/success pill is 40dp, the others 44.
        val h = if (state == State.Success || state == State.Located) dp(40) else dp(44)
        if (layoutParams != null && layoutParams.height != h) {
            layoutParams = layoutParams.also { it.height = h }
        }
        // Invite renders the fill at 72% (LocationButton.kt:16).
        background?.alpha = if (state == State.Invite) (0.72f * 255).toInt() else 255

        val gap = when (state) {
            State.Searching -> dp(8)
            State.Success, State.Located -> dp(4)
            else -> dp(6)
        }
        (text.layoutParams as LayoutParams).let { it.marginStart = gap; text.layoutParams = it }

        spinner.isVisible = state == State.Searching
        icon.isVisible = state != State.Searching

        val secondary = FcTokens.color(context, R.color.fc_brand_foreground_secondary)
        when (state) {
            State.Invite -> {
                icon.setImageResource(R.drawable.fc_ic_my_location)
                icon.setColorFilter(secondary)
                text.text = labelFor(Labels.SET_YOUR_LOCATION, "Set your location")
            }
            State.Searching ->
                text.text = labelFor(Labels.GETTING_YOUR_LOCATION, "Getting your location")
            State.Success -> {
                icon.setImageResource(R.drawable.fc_ic_check)
                icon.setColorFilter(secondary)
                text.text = labelFor(Labels.LOCATION_FOUND, "Location found")
            }
            State.Located -> {
                icon.setImageResource(R.drawable.fc_ic_place)
                icon.setColorFilter(secondary)
                // "<Place> - Change", with only "Change" in the secondary colour
                // (LocationButton.kt:141-149).
                val change = labelFor(Labels.CHANGE, "Change")
                text.text = SpannableStringBuilder("$place - $change").apply {
                    setSpan(
                        ForegroundColorSpan(secondary),
                        length - change.length, length,
                        Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }
            }
            State.Blocked -> {
                icon.setImageResource(R.drawable.fc_ic_gps_off)
                icon.setColorFilter(secondary)
                text.text =
                    labelFor(Labels.ALLOW_LOCATION_IN_SETTINGS, "Allow location in Settings")
            }
        }
        visibility = View.VISIBLE
    }
}
