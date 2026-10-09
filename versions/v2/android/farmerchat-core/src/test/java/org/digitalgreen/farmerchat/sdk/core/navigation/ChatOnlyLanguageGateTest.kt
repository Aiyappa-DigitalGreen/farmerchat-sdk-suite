package org.digitalgreen.farmerchat.sdk.core.navigation

import android.content.Context
import android.content.ContextWrapper
import android.content.SharedPreferences
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The CHAT_ONLY first-launch language gate (2026-10-09): CHAT_ONLY shows the language screen
 * only when LANGUAGE_DONE is false AND the host configured no language; the pending target must
 * survive the gate.
 */
class ChatOnlyLanguageGateTest {

    private fun decider(hostLanguage: Boolean): Pair<RouteDecider, SdkPreferences> {
        val prefs = SdkPreferences(FakeContext())
        return RouteDecider(prefs, hostLanguageConfigured = { hostLanguage }) to prefs
    }

    @Test
    fun `first launch without host language shows the language screen`() {
        val (d, _) = decider(hostLanguage = false)
        assertTrue(d.chatOnlyNeedsLanguage())
    }

    @Test
    fun `later launch goes straight to chat`() {
        val (d, prefs) = decider(hostLanguage = false)
        prefs.putBoolean(SdkPreferences.Keys.LANGUAGE_DONE, true)
        assertFalse(d.chatOnlyNeedsLanguage())
    }

    @Test
    fun `host configured language goes straight to chat`() {
        val (d, _) = decider(hostLanguage = true)
        assertFalse(d.chatOnlyNeedsLanguage())
    }

    @Test
    fun `pending target survives the gate`() {
        val (d, prefs) = decider(hostLanguage = false)
        val target = PendingTarget.ChatQuery(question = "q", source = "deeplink")
        d.savePendingTarget(target)
        assertTrue(d.chatOnlyNeedsLanguage())
        assertEquals(target, d.peekPendingTarget())
        // The language screen completes …
        prefs.putBoolean(SdkPreferences.Keys.LANGUAGE_DONE, true)
        assertFalse(d.chatOnlyNeedsLanguage())
        assertEquals(target, d.consumePendingTarget())
    }

    /** JVM-only Context whose prefs are an in-memory map (android.jar stubs return defaults). */
    private class FakeContext : ContextWrapper(null) {
        private val prefs = FakePrefs()
        override fun getApplicationContext(): Context = this
        override fun getSharedPreferences(name: String?, mode: Int): SharedPreferences = prefs
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
