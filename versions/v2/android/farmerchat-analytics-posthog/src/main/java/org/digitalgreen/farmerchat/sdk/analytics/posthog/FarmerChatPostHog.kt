package org.digitalgreen.farmerchat.sdk.analytics.posthog

import android.content.Context
import android.util.Log
import com.posthog.PostHog
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig
import org.digitalgreen.farmerchat.sdk.FarmerChatConfig

/**
 * Optional PostHog sink for the FarmerChat SDK.
 *
 * **This module is not part of the SDK packages.** Root `CLAUDE.md` §6 bans vendor analytics SDKs
 * inside `farmerchat-core` / `-compose` / `-views`, and nothing here changes that: the SDK still
 * emits every event through its host-pluggable [org.digitalgreen.farmerchat.sdk.FarmerChatAnalyticsListener]
 * with the production app's exact names and property keys. This artifact is one such host sink,
 * shipped separately so a host that wants PostHog gets a drop-in instead of re-deriving the
 * naming rules — which are subtle, and which iOS already paid for.
 *
 * Mirrors iOS `PostHogAnalytics` (FarmerChat-iOS-Agentic-v2.3, `CompositeAnalytics.swift`).
 *
 * Wiring, in the host `Application`:
 * ```
 * FarmerChatPostHog.setup(this, apiKey = BuildConfig.POSTHOG_API_KEY, host = BuildConfig.POSTHOG_HOST,
 *                         appFlavor = "dev", isDebug = BuildConfig.DEBUG)
 * FarmerChat.initialize(this, FarmerChatPostHog.attachExclusive(configBuilder).build())
 * ```
 * [attachExclusive] wires events, identity and attributes — and REPLACES any of those callbacks
 * you already set. [setup] alone only starts PostHog.
 */
public object FarmerChatPostHog {

    private const val TAG = "FarmerChatPostHog"

    @Volatile
    private var started: Boolean = false

    /**
     * Starts PostHog. Safe to call more than once — the second call is ignored rather than
     * re-initialising the SDK underneath a live session.
     *
     * A blank [apiKey] is treated as "PostHog off" and logged, exactly as iOS does
     * (`RemoteConfigKeys` there leaves the key unset in local builds). That is deliberate: a
     * missing key must degrade to silence, never to a crash on launch.
     */
    @JvmStatic
    @JvmOverloads
    public fun setup(
        context: Context,
        apiKey: String,
        host: String = DEFAULT_HOST,
        appFlavor: String = "unknown",
        isDebug: Boolean = false
    ) {
        if (started) {
            Log.i(TAG, "setup() ignored — PostHog is already running")
            return
        }
        if (apiKey.isBlank()) {
            Log.w(TAG, "PostHog is OFF: no API key supplied. Events will be dropped.")
            return
        }

        val config = PostHogAndroidConfig(apiKey = apiKey, host = host).apply {
            // Parity guards, both deliberate and both learned on iOS:
            //
            //  • `captureScreenViews` would emit PostHog's own `$screen` events on top of the
            //    `Screen_Viewed` event the app already sends, double-counting every screen under
            //    two differently-named events.
            //
            //  • `captureApplicationLifecycleEvents` emits "Application Installed",
            //    "Application Opened", "Application Updated" and "Application Backgrounded" as
            //    PLAIN, un-prefixed names. The first three duplicate events this app already
            //    sends (`App_Installed`, `App_Opened`, `App_Updated`), so left on, every install,
            //    update and launch is counted twice under two names and two dashboards built on
            //    them disagree. Ours win: they match the app, and they are what the event
            //    constants document.
            captureScreenViews = false
            captureApplicationLifecycleEvents = false
            captureDeepLinks = false
            debug = isDebug
            if (isDebug) {
                // Makes a single event observable immediately instead of waiting for a batch.
                // DEBUG only — wasteful in a shipping build.
                flushAt = 1
            }
        }
        PostHogAndroid.setup(context, config)

        // Every flavour reports into the ONE project, so the environment has to travel WITH the
        // events or production numbers silently include test traffic. Registered as super
        // properties so every event carries them without a single call site knowing.
        //
        // Both keys are needed, not one: `app_flavor` alone cannot separate a stage debug build
        // from stage release — they stamp the same flavour.
        PostHog.register("app_flavor", appFlavor)
        PostHog.register("build_type", if (isDebug) "debug" else "release")

        started = true
        // NOTICE-level, not debug: this is the line that answers "is PostHog actually on?".
        // The key is truncated — never log a full credential.
        Log.i(TAG, "PostHog ON host=$host key=${apiKey.take(8)}… flavor=$appFlavor debug=$isDebug")
    }

    /**
     * Wires this sink into a [FarmerChatConfig.Builder]: events, identity and user attributes.
     *
     * **EXCLUSIVE — this REPLACES `onEvent`, `onUserIdentified` and `onUserAttribute`.** The
     * builder's setters overwrite rather than accumulate, so a host that already set any of the
     * three and then calls this silently loses its own callback, with nothing failing to say so.
     * The name is deliberately blunt for that reason. If you have your own analytics, do not call
     * this — call [track], [identify] and [setUserProperty] from inside your own callbacks, which
     * is what both samples do, and remember `enableAnalytics(true)`.
     *
     * Forces `enableAnalytics(true)`: it defaults to **false** in 2.0.0, so without it the SDK
     * builds every event correctly and then drops it at the dispatch point — PostHog receives
     * nothing, with no error anywhere to explain why.
     */
    @JvmStatic
    public fun attachExclusive(builder: FarmerChatConfig.Builder): FarmerChatConfig.Builder =
        builder
            .enableAnalytics(true)
            .onEvent { name, properties -> track(name, properties) }
            .onUserIdentified { userId -> identify(userId) }
            .onUserAttribute { key, value -> setUserProperty(key, value) }

    /**
     * One analytics event, translated to PostHog's naming and dispatched.
     *
     * Suppression and merging happen HERE rather than at the SDK call sites, because those sites
     * are shared with every other sink a host may have wired.
     */
    @JvmStatic
    public fun track(name: String, properties: Map<String, Any?>) {
        if (!started) return
        if (name in PostHogNaming.suppressed) return

        var eventName = name
        val props = properties.toMutableMap()
        PostHogNaming.merged[name]?.let { merge ->
            eventName = merge.event
            props.putAll(merge.extra)
        }

        val posthogName = PostHogNaming.event(eventName)
        val posthogProps = PostHogNaming.properties(props)

        // `userProperties` writes to the person record on an event that was being sent anyway.
        // Null when nothing is pending, so the parameter simply does not appear.
        PostHog.capture(
            event = posthogName,
            // Null-valued properties are dropped rather than sent as a literal null: PostHog's
            // Kotlin surface is `Map<String, Any>`, and iOS's `[String: Any]` cannot carry nil
            // either, so dropping them is what keeps the two platforms' property sets identical.
            properties = posthogProps.filterValues { it != null }.mapValues { it.value as Any },
            userProperties = PersonPropertyBuffer.drain()
        )
    }

    /**
     * A user attribute.
     *
     * PostHog has no standalone "set attribute" call. [PostHog.register] is the zero-cost
     * equivalent — the attribute becomes a super property and rides on every SUBSEQUENT event, so
     * it is filterable in every insight. The buffer additionally carries it to the PERSON record
     * on the next event that fires, which is what makes cohorts and person-property breakdowns
     * work.
     *
     * A `$set` capture per attribute was the obvious implementation and it is WRONG: PostHog
     * bills per event, and the SDK sets several attributes on every cold launch. See
     * [PersonPropertyBuffer].
     */
    @JvmStatic
    public fun setUserProperty(key: String, value: String?) {
        if (!started) return
        val name = PostHogNaming.property(key)
        PostHog.register(name, value ?: "")
        PersonPropertyBuffer.add(name, value ?: "")
    }

    /**
     * Identity. `identify` merges the anonymous pre-login events into this person, so the funnel
     * from first launch through login stays one continuous user.
     *
     * THIS CALL IS WHAT CREATES THE PERSON PROFILE — PostHog's `personProfiles` defaults to
     * "identified only", so anonymous events deliberately create no profile. The pending person
     * properties go IN WITH this call, and that is required, not tidy: person properties attached
     * to any event before identify are discarded while the device is still anonymous, and SDK
     * attributes are set during onboarding, which runs before guest initialisation returns the
     * id. See [PersonPropertyBuffer].
     */
    @JvmStatic
    public fun identify(userId: String) {
        if (!started || userId.isBlank()) return
        // Mark first, then drain: the buffer refuses to hand anything over until this point, so
        // this order is what releases everything collected during onboarding.
        PersonPropertyBuffer.markIdentified()
        val pending = PersonPropertyBuffer.drain()
        PostHog.identify(distinctId = userId, userProperties = pending)
        Log.i(TAG, "identify ${userId.take(8)}… with ${pending?.size ?: 0} person properties")
    }

    /** PostHog's US ingest endpoint — the default the iOS build also uses. */
    public const val DEFAULT_HOST: String = "https://us.i.posthog.com"

    /** Visible for tests: forget that setup ran. */
    internal fun resetForTest() {
        started = false
        PersonPropertyBuffer.resetForTest()
    }
}

/**
 * Holds user attributes until [markIdentified], then releases them on the next event.
 *
 * WILL NOT DRAIN BEFORE `identify`, and that guard is the whole point. PostHog discards person
 * properties on any event sent while the device is still anonymous. Draining into such an event
 * does not merely fail to help — it THROWS THE ATTRIBUTES AWAY, because the buffer is then empty
 * when identify finally arrives. iOS observed exactly that: identify logged "with 0 person
 * properties" while 24 attributes had been collected.
 */
internal object PersonPropertyBuffer {

    private val lock = Any()
    private val pending = LinkedHashMap<String, Any>()
    private var identified = false

    fun add(key: String, value: String) {
        synchronized(lock) { pending[key] = value }
    }

    fun markIdentified() {
        synchronized(lock) { identified = true }
    }

    fun drain(): Map<String, Any>? = synchronized(lock) {
        if (!identified || pending.isEmpty()) return null
        val out = LinkedHashMap(pending)
        pending.clear()
        out
    }

    fun resetForTest() {
        synchronized(lock) { pending.clear(); identified = false }
    }
}
