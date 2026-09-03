package org.digitalgreen.farmerchat.sdk.core.ui.settings

import org.digitalgreen.farmerchat.sdk.core.model.SupportedLanguage
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Guards the app's `displayedLanguages` rule (LanguageScreen.kt / LanguageChooserScreen.kt):
 * a selection that lives only in the collapsed "All languages" list must be pinned to the
 * top of the priority rows.
 */
public class LanguageDisplayOrderTest {

    private fun lang(id: Int, code: String) =
        SupportedLanguage(id = id, name = code, code = code)

    private val priority = listOf(lang(1, "en"), lang(2, "hi"), lang(3, "sw"))
    private val expanded = listOf(lang(10, "bn"), lang(11, "ta"))

    @Test
    public fun `no selection returns the priority list unchanged`() {
        assertEquals(
            priority,
            LanguageDisplayOrder.rowsToShow(priority, expanded, selectedId = null, isExpanded = false)
        )
    }

    @Test
    public fun `selection inside the priority list leaves the order unchanged`() {
        assertEquals(
            priority,
            LanguageDisplayOrder.rowsToShow(priority, expanded, selectedId = 2, isExpanded = false)
        )
    }

    @Test
    public fun `selection only in the expanded list is pinned to the top while collapsed`() {
        val rows =
            LanguageDisplayOrder.rowsToShow(priority, expanded, selectedId = 11, isExpanded = false)
        assertEquals(4, rows.size)
        assertEquals(11, rows.first().id)
        assertEquals(priority, rows.drop(1))
    }

    @Test
    public fun `expanded list showing renders the priority list unmodified`() {
        assertEquals(
            priority,
            LanguageDisplayOrder.rowsToShow(priority, expanded, selectedId = 11, isExpanded = true)
        )
    }

    @Test
    public fun `unknown selected id does not pin anything`() {
        assertEquals(
            priority,
            LanguageDisplayOrder.rowsToShow(priority, expanded, selectedId = 999, isExpanded = false)
        )
    }
}
