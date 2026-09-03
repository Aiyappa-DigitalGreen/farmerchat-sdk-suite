package org.digitalgreen.farmerchat.sdk.core.ui.settings

import org.digitalgreen.farmerchat.sdk.core.model.SupportedLanguage

/**
 * Row ordering for the language lists — 1:1 port of the `displayedLanguages`
 * computation shared by the app's `LanguageSelectionScreen`
 * (`ui/onboarding/language/LanguageScreen.kt`) and `LanguageChooserScreen`
 * (`ui/settings/LanguageChooserScreen.kt`).
 *
 * The API returns a short *priority* list plus a longer *expanded* ("All languages")
 * list. When the user's current selection lives only in the expanded list and that
 * list is collapsed, the selected language is pinned to the top of the priority list
 * so the selection is never invisible.
 *
 * While the expanded list is showing, the priority list is rendered unmodified — the
 * selection is already visible further down.
 */
object LanguageDisplayOrder {

    /**
     * @param priority       priority languages (endpoint #4 payload).
     * @param expanded       "All languages" languages.
     * @param selectedId     currently selected `SupportedLanguage.id`, if any.
     * @param isExpanded     whether the "All languages" list is showing.
     */
    fun rowsToShow(
        priority: List<SupportedLanguage>,
        expanded: List<SupportedLanguage>,
        selectedId: Int?,
        isExpanded: Boolean
    ): List<SupportedLanguage> {
        if (isExpanded) return priority

        val all = (priority + expanded).distinctBy { it.id }
        val selected = selectedId?.let { id -> all.firstOrNull { it.id == id } }
        val selectedIsInPriority = selected != null && priority.any { it.id == selected.id }

        return if (selected == null || selectedIsInPriority) {
            priority
        } else {
            listOf(selected) + priority
        }
    }
}
