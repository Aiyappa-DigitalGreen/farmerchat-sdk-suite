package org.digitalgreen.farmerchat.sdk.core.ui.settings

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * A language-row tap records the choice and nothing else (app SettingsViewModel.selectLanguage).
 * Scenario pass 2026-10-17 B7: the SDK fetched and saved the tapped language's labels on the tap,
 * so tap-then-Back left Hindi saved with English labels on screen.
 */
internal class LanguageSelectTest {

    @Test
    fun `a row tap records the choice without starting a label fetch`() {
        val before = LanguageSettingsState(selectedLanguageId = 2, languageCode = "hi", labelsRefreshToken = 7L)
        val after = before.selectingLanguage(1, "en")
        assertEquals(1, after.selectedLanguageId)
        assertEquals("en", after.languageCode)
        assertFalse(after.isFetchingLabels)
        assertNull(after.fetchingLabelsForId)
        assertEquals(7L, after.labelsRefreshToken)
    }
}
