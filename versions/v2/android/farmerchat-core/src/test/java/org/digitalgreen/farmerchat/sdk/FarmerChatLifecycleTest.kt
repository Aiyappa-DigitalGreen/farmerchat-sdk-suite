package org.digitalgreen.farmerchat.sdk

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Public lifecycle API (2026-10-13): re-initialize no-op vs rebuild, [FarmerChat.shutdown] and
 * [FarmerChat.clearAllData]. Static auth listeners must survive a rebuild and a shutdown.
 */
@OptIn(ExperimentalCoroutinesApi::class, InternalFarmerChatApi::class)
class FarmerChatLifecycleTest {

    private lateinit var context: FakeContext
    private val unsubscribes = mutableListOf<() -> Unit>()

    @Before
    fun setUp() {
        // sdkScope runs on Main.immediate, which the JVM does not have.
        Dispatchers.setMain(UnconfinedTestDispatcher())
        context = FakeContext()
    }

    @After
    fun tearDown() {
        unsubscribes.forEach { it() }
        FarmerChat.shutdown()
        Dispatchers.resetMain()
    }

    private fun config(mode: FarmerChatMode = FarmerChatMode.FULL_JOURNEY, locale: String? = null) =
        FarmerChatConfig.builder(FarmerChatEnvironment.PROD).mode(mode).apply {
            if (locale != null) locale(locale)
        }.build()

    private fun listen(into: MutableList<Boolean>) {
        unsubscribes += FarmerChat.onAuthStateChanged { into += it }
    }

    private fun sdkPrefs() = context.prefsFor("fc_sdk_preferences")

    @Test
    fun `re-initialize with an equivalent config keeps the graph`() {
        FarmerChat.initialize(context, config())
        val first = FarmerChat.requireGraph()
        // Only non-identity fields differ: first config wins.
        FarmerChat.initialize(context, config(locale = "hi"))
        assertSame(first, FarmerChat.requireGraph())
    }

    @Test
    fun `equivalent re-initialize pushes a new access token without rebuilding`() {
        FarmerChat.initialize(context, config())
        val graph = FarmerChat.requireGraph()
        graph.tokenStore.saveTokens("old", "refresh")

        val withToken = config().newBuilder().accessToken("new").refreshToken("r-config").build()
        FarmerChat.initialize(context, withToken)
        assertSame(graph, FarmerChat.requireGraph())
        assertEquals("new", graph.tokenStore.getAccessToken())
        assertEquals("r-config", graph.tokenStore.getRefreshToken())

        // Same token again: no write (a token the SDK refreshed in between must not be clobbered).
        graph.tokenStore.saveTokens("new", "refresh2")
        FarmerChat.initialize(context, withToken)
        assertEquals("new", graph.tokenStore.getAccessToken())
        assertEquals("refresh2", graph.tokenStore.getRefreshToken())
    }

    @Test
    fun `re-initialize with a different mode rebuilds and static listeners re-bind`() {
        FarmerChat.initialize(context, config())
        val first = FarmerChat.requireGraph()
        val seen = mutableListOf<Boolean>()
        listen(seen)
        // The rebuilt graph's session starts authenticated, so its collector must emit true.
        first.prefs.putBoolean(SdkPreferences.Keys.OTP_VERIFIED, true)
        FarmerChat.initialize(context, config(mode = FarmerChatMode.CHAT_ONLY))
        assertNotSame(first, FarmerChat.requireGraph())
        assertTrue(FarmerChat.isAuthenticated)
        assertEquals(true, seen.last())
    }

    @Test
    fun `shutdown un-initializes, keeps data and listeners, and is idempotent`() {
        FarmerChat.shutdown() // safe before initialize
        FarmerChat.initialize(context, config())
        val seen = mutableListOf<Boolean>()
        listen(seen)
        FarmerChat.requireGraph().prefs.putBoolean(SdkPreferences.Keys.OTP_VERIFIED, true)

        FarmerChat.shutdown()
        FarmerChat.shutdown()
        assertFalse(FarmerChat.isInitialized)
        assertFalse(FarmerChat.isAuthenticated)
        assertEquals(null, FarmerChat.authState)
        assertTrue(sdkPrefs().contains("fc_sdk_" + SdkPreferences.Keys.OTP_VERIFIED))

        val before = seen.size
        FarmerChat.initialize(context, config())
        assertTrue(FarmerChat.isInitialized)
        assertTrue(seen.size > before)
        assertEquals(true, seen.last())
    }

    @Test
    fun `clearAllData removes only fc_sdk_ keys and flips auth to false`() {
        FarmerChat.initialize(context, config())
        val graph = FarmerChat.requireGraph()
        graph.prefs.putBoolean(SdkPreferences.Keys.OTP_VERIFIED, true)
        graph.tokenStore.saveTokens("access", "refresh")
        graph.prefs.putString(SdkPreferences.Keys.ANDROID_DEVICE_ID, "device")
        graph.sessionManager.refreshAuthState()
        assertTrue(FarmerChat.isAuthenticated)
        sdkPrefs().edit().putString("host_key", "keep").apply()
        context.prefsFor("host_prefs").edit().putString("fc_sdk_elsewhere", "keep").apply()
        val seen = mutableListOf<Boolean>()
        listen(seen)
        assertTrue(sdkPrefs().all.keys.any { it.startsWith("fc_sdk_") })

        FarmerChat.clearAllData()

        assertEquals(setOf("host_key"), sdkPrefs().all.keys)
        assertEquals("keep", context.prefsFor("host_prefs").getString("fc_sdk_elsewhere", null))
        assertFalse(FarmerChat.isAuthenticated)
        assertEquals(false, seen.last())
        assertTrue(FarmerChat.isInitialized)
        assertEquals("", graph.tokenStore.getAccessToken())
    }

    @Test
    fun `clearAllData before initialize is a no-op`() {
        FarmerChat.clearAllData()
        assertFalse(FarmerChat.isInitialized)
    }

    /** JVM-only Context whose prefs files are in-memory maps (android.jar stubs return defaults). */
    private class FakeContext : ContextWrapper(null) {
        private val files = mutableMapOf<String, FakePrefs>()
        fun prefsFor(name: String): FakePrefs = files.getOrPut(name) { FakePrefs() }
        override fun getApplicationContext(): Context = this
        override fun getSharedPreferences(name: String?, mode: Int): SharedPreferences =
            prefsFor(name.orEmpty())
    }

    private class FakePrefs : SharedPreferences {
        private val map = mutableMapOf<String, Any?>()
        override fun getAll(): MutableMap<String, *> = map
        override fun getString(key: String?, defValue: String?) = map[key] as? String ?: defValue
        @Suppress("UNCHECKED_CAST")
        override fun getStringSet(key: String?, defValues: MutableSet<String>?) =
            map[key] as? MutableSet<String> ?: defValues
        override fun getInt(key: String?, defValue: Int) = map[key] as? Int ?: defValue
        override fun getLong(key: String?, defValue: Long) = map[key] as? Long ?: defValue
        override fun getFloat(key: String?, defValue: Float) = map[key] as? Float ?: defValue
        override fun getBoolean(key: String?, defValue: Boolean) = map[key] as? Boolean ?: defValue
        override fun contains(key: String?) = map.containsKey(key)
        override fun edit(): SharedPreferences.Editor = Editor()
        override fun registerOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener?) {}
        override fun unregisterOnSharedPreferenceChangeListener(l: SharedPreferences.OnSharedPreferenceChangeListener?) {}

        inner class Editor : SharedPreferences.Editor {
            override fun putString(key: String?, value: String?): SharedPreferences.Editor { map[key!!] = value; return this }
            override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor { map[key!!] = values; return this }
            override fun putInt(key: String?, value: Int): SharedPreferences.Editor { map[key!!] = value; return this }
            override fun putLong(key: String?, value: Long): SharedPreferences.Editor { map[key!!] = value; return this }
            override fun putFloat(key: String?, value: Float): SharedPreferences.Editor { map[key!!] = value; return this }
            override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor { map[key!!] = value; return this }
            override fun remove(key: String?): SharedPreferences.Editor { map.remove(key); return this }
            override fun clear(): SharedPreferences.Editor { map.clear(); return this }
            override fun commit() = true
            override fun apply() {}
        }
    }
}
