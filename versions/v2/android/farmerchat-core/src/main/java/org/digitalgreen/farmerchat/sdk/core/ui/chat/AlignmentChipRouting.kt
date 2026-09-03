package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.digitalgreen.farmerchat.sdk.core.model.AlignmentChip
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind

/**
 * What tapping an alignment chip should do. Returned by [routeAlignmentChip].
 *
 * Five of the seven [AlignmentKind]s just send text; the two CAPABILITY surfaces must invoke a
 * device capability and send only its OUTCOME. Getting that wrong is silent: the chip's machine
 * value goes to the backend as if the farmer had typed `take_photo`.
 */
sealed class AlignmentChipRoute {

    /** Run the location flow; on success re-send the surface's original query. */
    data object ShareLocation : AlignmentChipRoute()

    /** Open the camera; the photo goes straight into the conversation. */
    data object TakePhoto : AlignmentChipRoute()

    /** Open the gallery; the picked image goes straight into the conversation. */
    data object ChooseFromGallery : AlignmentChipRoute()

    /** The chip carries neither a label nor a value — nothing to send. */
    data object Ignore : AlignmentChipRoute()

    /**
     * Send [query] as the next query on the conversation, via
     * [ChatAction.SendAlignmentChip].
     *
     * @param query what goes on the wire. The chip LABEL for most kinds; the chip VALUE for
     *   `gender-select`, where the backend expects the raw value.
     * @param selectionValue the chip VALUE — marks/locks the chosen chip; never sent as the query.
     * @param displayLabel bubble override. Non-null only when it differs from [query]
     *   (`gender-select`), so the bubble reads naturally while the value is what is sent.
     * @param locationDeclined sets `location_declined = true` on the request.
     * @param photoDeclined sets `photo_declined = true` on the request.
     */
    data class SendText(
        val query: String,
        val selectionValue: String,
        val displayLabel: String? = null,
        val locationDeclined: Boolean = false,
        val photoDeclined: Boolean = false
    ) : AlignmentChipRoute()
}

/**
 * THE routing table for an alignment chip tap — one function, shared by both android flavours and
 * by `AlignmentChipRoutingTest`, so the screens and the test can never drift apart. (v1 kept a
 * per-flavour copy and tested a local mirror; docs/04 records that as the worse pattern.)
 *
 * Precedence, and why:
 *
 * 1. **`behavior` beats `action` + `value`.** `behavior` (`invoke_capability` / `continue`) is the
 *    backend's EXPLICIT statement of intent, captured live 2026-09-03 (docs/02 §#27a); `action` +
 *    `value` is what the app matched on before the wire was visible. When `behavior` is present it
 *    decides; when it is absent the old `action == "invoke"` match still applies unchanged, so a
 *    payload without the new fields routes exactly as it did before.
 * 2. **`capability` says WHICH capability, not WHETHER.** Both live `gps-prompt` chips carry
 *    `capability: "location"` — the share one AND the decline one — so `capability` alone can
 *    never select the invoke path. It only widens the value match, so a future share chip with a
 *    new `value` still reaches the location flow.
 * 3. **A decline is recognised by `behavior == "continue"` as well as by value.** The live
 *    `gps-prompt` decline is `value: "use_approximate_location"`, `action: "continue"` — NOT the
 *    `not_now` / `decline` the app declares. Both are accepted (docs/05).
 */
fun routeAlignmentChip(kind: AlignmentKind?, chip: AlignmentChip): AlignmentChipRoute {
    val label = chip.label?.takeIf { it.isNotBlank() }
    val value = chip.value?.takeIf { it.isNotBlank() }
    if (label == null && value == null) return AlignmentChipRoute.Ignore

    if (chip.invokesCapability) {
        // Location: the explicit `capability` tag OR the app's value match.
        if (kind == AlignmentKind.GPS_PROMPT &&
            (chip.capability == AlignmentChip.CAPABILITY_LOCATION ||
                value == AlignmentChip.VALUE_SHARE_LOCATION)
        ) {
            return AlignmentChipRoute.ShareLocation
        }
        // Photo: value match only. No `capability` string for the photo capability has ever been
        // observed on the wire, and inventing one is exactly what CLAUDE.md §2 forbids.
        if (kind == AlignmentKind.UPLOAD_PHOTO) {
            when (value) {
                AlignmentChip.VALUE_TAKE_PHOTO -> return AlignmentChipRoute.TakePhoto
                AlignmentChip.VALUE_CHOOSE_FROM_GALLERY ->
                    return AlignmentChipRoute.ChooseFromGallery
            }
        }
    }

    // gender-select is the one kind whose sent query differs from its bubble.
    if (kind == AlignmentKind.GENDER_SELECT) {
        val genderValue = value ?: label!!
        return AlignmentChipRoute.SendText(
            query = genderValue,
            selectionValue = genderValue,
            displayLabel = label ?: genderValue
        )
    }

    // Everything else: label shown + sent, value used only to mark the chip.
    // Reaching here on a capability surface means the DECLINE chip (the invoke chips returned
    // above), so flag the matching `*_declined` on the request. A location decline that arrives on
    // some other surface is caught by the capability + decline pair.
    return AlignmentChipRoute.SendText(
        query = label ?: value!!,
        selectionValue = value ?: label!!,
        locationDeclined = kind == AlignmentKind.GPS_PROMPT ||
            (chip.capability == AlignmentChip.CAPABILITY_LOCATION && chip.isDecline),
        photoDeclined = kind == AlignmentKind.UPLOAD_PHOTO
    )
}

/**
 * True when the chip should run a device capability instead of sending its text. Prefers the
 * backend's [AlignmentChip.behavior]; falls back to the app's `action == "invoke"` when the
 * payload predates it.
 */
val AlignmentChip.invokesCapability: Boolean
    get() = when {
        !behavior.isNullOrBlank() -> behavior == AlignmentChip.BEHAVIOR_INVOKE_CAPABILITY
        else -> action == AlignmentChip.ACTION_SELECT
    }

/**
 * True when the chip declines whatever the surface asked for. `behavior == "continue"` is the
 * live signal; the value/action matches keep the app's older payloads working.
 */
val AlignmentChip.isDecline: Boolean
    get() = behavior == AlignmentChip.BEHAVIOR_CONTINUE ||
        value == AlignmentChip.VALUE_NOT_NOW ||
        value == AlignmentChip.VALUE_USE_APPROXIMATE_LOCATION ||
        action == AlignmentChip.ACTION_DECLINE ||
        action == AlignmentChip.ACTION_CONTINUE
