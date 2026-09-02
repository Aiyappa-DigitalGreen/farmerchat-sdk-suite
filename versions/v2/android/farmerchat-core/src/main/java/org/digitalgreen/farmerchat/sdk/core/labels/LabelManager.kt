package org.digitalgreen.farmerchat.sdk.core.labels

import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences

/**
 * Server-driven UI labels (endpoint api/language/v2/get_labels/).
 *
 * Resolution order: `${baseKey}_${languageCode}` → `${baseKey}_en` → [englishFallback]
 * → the raw key (debugging aid). Supports `{name}` and `{{name}}` template
 * substitution. All SDK UI strings must resolve through this manager.
 */
class LabelManager(
    private val prefs: SdkPreferences,
    /** C5: host string overrides (labelKey → string) — highest precedence. */
    private val stringOverrides: Map<String, String> = emptyMap(),
    /** C5: forced locale; overrides the selected language for label resolution. */
    private val localeOverride: String? = null
) {

    private fun currentLanguageCode(): String =
        (localeOverride ?: prefs.getString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, "en"))
            .trim()
            .lowercase()
            .ifBlank { "en" }

    /**
     * Resolution order (C5): host override → server `${key}_${lang}` →
     * server `${key}_en` → built-in English fallback → raw key.
     */
    fun getLabel(baseKey: String, englishFallback: String = ""): String {
        stringOverrides[baseKey]?.let { if (it.isNotBlank()) return it }

        val labels = prefs.getLanguageLabels() ?: emptyMap()
        val languageCode = currentLanguageCode()

        val localized = labels["${baseKey}_${languageCode}"]
        if (!localized.isNullOrBlank()) return localized

        val english = labels["${baseKey}_en"]
        if (!english.isNullOrBlank()) return english

        return englishFallback.ifBlank { baseKey }
    }

    fun getLabel(baseKey: String, englishFallback: String = "", params: Map<String, String>): String {
        var label = getLabel(baseKey, englishFallback)
        params.forEach { (key, value) ->
            label = label.replace("{{$key}}", value)
            label = label.replace("{$key}", value)
        }
        return label
    }

    fun areLabelsLoaded(): Boolean {
        val labels = prefs.getLanguageLabels()
        return labels != null && labels.isNotEmpty()
    }

    fun getLabelCount(): Int = prefs.getLanguageLabels()?.size ?: 0

    fun saveLabels(labels: Map<String, String>) {
        prefs.saveLanguageLabels(labels)
    }
}
