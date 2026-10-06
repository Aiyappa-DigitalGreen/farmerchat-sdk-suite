package org.digitalgreen.farmerchat.sdk.core.model

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import org.junit.Assert.assertEquals
import org.junit.Test

class SupportedLanguageGroupTest {

    private fun parse(json: String): List<SupportedLanguageGroup> =
        Gson().fromJson(json, object : TypeToken<List<SupportedLanguageGroup>>() {}.type)

    /** Live pre-v2 response (captured 2026-09-28 from a host backend still on the v1 shape). */
    @Test fun `pre-v2 flat languages become the priority view`() {
        val groups = parse(
            """[{"display_name": "Others", "flag": "", "languages": [{"id": 1, "name": "English", "code": "en", "display_name": "English", "country_phone_code": "+91", "asr_enabled": true, "tts_enabled": true}]}]"""
        ).map { it.normalized() }
        assertEquals(listOf("en"), groups.single().priorityView.map { it.code })
        assertEquals(1, groups.single().priorityView.single().id)
    }

    @Test fun `v2 groups are unchanged`() {
        val group = parse(
            """[{"display_name": "India", "flag": "", "priority_view": [{"id": 2, "name": "Hindi", "code": "hi"}], "expanded_view": [{"id": 1, "name": "English", "code": "en"}]}]"""
        ).single()
        assertEquals(group, group.normalized())
    }
}
