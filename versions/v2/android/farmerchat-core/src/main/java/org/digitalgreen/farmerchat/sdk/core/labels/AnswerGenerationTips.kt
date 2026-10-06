package org.digitalgreen.farmerchat.sdk.core.labels

/**
 * One tip card in the answer-generation carousel.
 *
 * Port of the app's `components/Tips.kt` `TipData`.
 */
data class TipData(
    val title: String,
    val body: String
)

/**
 * The tips shown while an answer is being generated.
 *
 * Faithful port of the app's `ChatLoadingContent.kt` `answerGenerationTips()`. The tip set is
 * **server-driven and discovered by convention**, not enumerated: any label pair
 *
 * ```
 * fc_v2_app_label_tips_<name>_title_<lang>
 * fc_v2_app_label_tips_<name>_statement_<lang>
 * ```
 *
 * in the `get_labels` payload becomes a tip, so the backend can add tips without an SDK release.
 * Discovery scans for `_title_<lang>` keys in ANY language and then resolves each name in the
 * farmer's language with an English fallback — a tip that exists only in Hindi is still
 * discovered for an English user, and dropped only if neither language has both halves.
 *
 * Kept in core rather than in a UI flavour because the compose and views carousels must show the
 * same tips, and because the discovery is the part worth testing.
 *
 * One hardening over the app: a label present but **blank** is treated as missing, matching
 * [LabelManager]'s own `isNullOrBlank` resolution rather than the app's null-only check. A blank
 * server label would otherwise render an empty tip card.
 */
object AnswerGenerationTips {

    private const val PREFIX = "fc_v2_app_label_tips_"
    private const val TITLE_SUFFIX = "_title"
    private const val STATEMENT_SUFFIX = "_statement"

    /**
     * App parity: `^fc_v2_app_label_tips_(.+)_title_([a-z]{2,3})$`. The 2–3 letter tail is what
     * separates a language suffix from a tip name that merely ends in `_title`.
     */
    private val titleKeyRegex = Regex(
        "^${Regex.escape(PREFIX)}(.+)${Regex.escape(TITLE_SUFFIX)}_([a-z]{2,3})$"
    )

    /** Port of the app's `TipFallback` — a built-in tip as a key + English default per half. */
    private data class TipFallback(
        val titleKey: String,
        val titleDefault: String,
        val statementKey: String,
        val statementDefault: String
    )

    /**
     * The three built-in tips, used only when the label payload carries no discoverable tip.
     *
     * Keys and English defaults are copied verbatim from the app's `fallbackTips`; they resolve
     * through the caller's resolver so a host string override still wins.
     */
    private val fallbackTips = listOf(
        TipFallback(
            Labels.DID_YOU_KNOW, "Did you know?",
            Labels.YOU_CAN_ASK_FOLLOWUP_QUESTIONS_TO_GET_MORE_DETAILS,
            "You can ask follow-up questions to get more details"
        ),
        TipFallback(
            Labels.QUICK_TIP, "Quick tip",
            Labels.TIPS_ASK_SPECIFIC_CROPS,
            "Try asking about specific crops or problems"
        ),
        TipFallback(
            Labels.TRY_THIS, "Try this",
            Labels.UPLOAD_PHOTOS_FOR_PLANT_DISEASE_IDENTIFICATION,
            "Upload photos for plant disease identification"
        )
    )

    /**
     * @param labels the full `get_labels` map (`${key}_${lang}` → text).
     * @param languageCode the farmer's selected language, lowercase.
     * @param resolve label resolution for the fallback tips — pass `LabelManager::getLabel` so
     *   host overrides and the normal fallback chain apply.
     * @return the discovered tips, name-sorted for a stable order; never empty.
     */
    fun discover(
        labels: Map<String, String>,
        languageCode: String,
        resolve: (String, String) -> String
    ): List<TipData> {
        val lang = languageCode.trim().lowercase().ifBlank { "en" }

        val tipNames = labels.keys
            .mapNotNull { key -> titleKeyRegex.matchEntire(key)?.groupValues?.get(1) }
            .distinct()
            .sorted()

        val dynamicTips = tipNames.mapNotNull { name ->
            val titleBase = "$PREFIX$name$TITLE_SUFFIX"
            val statementBase = "$PREFIX$name$STATEMENT_SUFFIX"

            val title = labels["${titleBase}_$lang"]?.takeIf { it.isNotBlank() }
                ?: labels["${titleBase}_en"]?.takeIf { it.isNotBlank() }
                ?: return@mapNotNull null

            val body = labels["${statementBase}_$lang"]?.takeIf { it.isNotBlank() }
                ?: labels["${statementBase}_en"]?.takeIf { it.isNotBlank() }
                ?: return@mapNotNull null

            TipData(title = title, body = body)
        }

        if (dynamicTips.isNotEmpty()) return dynamicTips

        return fallbackTips.map { entry ->
            TipData(
                title = resolve(entry.titleKey, entry.titleDefault),
                body = resolve(entry.statementKey, entry.statementDefault)
            )
        }
    }
}
