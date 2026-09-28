package org.digitalgreen.farmerchat.sdk

/**
 * What an embedded chat does on arrival — the host screen's "the user already started
 * something" hand-off (a question typed on the host's home screen, a photo, a voice note, a push
 * notification's answer, a thread picked from the host's own history list).
 *
 * All optional; precedence when several are set: [conversationId] → [preGeneratedAnswer] →
 * [imageUri] → [audioUri] → [question] → empty chat.
 *
 * URIs must be readable by this app (`file://` in the app's cache/files dir, or a granted
 * `content://`).
 */
class FarmerChatLaunch @JvmOverloads constructor(
    /** Question asked immediately (or the caption for [imageUri], or the prompt of [preGeneratedAnswer]). */
    val question: String? = null,
    /** Opens this existing conversation (history thread). */
    val conversationId: String? = null,
    /** Photo sent on arrival, with [question] as its optional text. */
    val imageUri: String? = null,
    /** Voice recording transcribed and asked on arrival. */
    val audioUri: String? = null,
    /** Show [question] + this answer without calling the API (e.g. a push notification's content). */
    val preGeneratedAnswer: String? = null,
    /** Follow-up chips shown under [preGeneratedAnswer]. */
    val followUpQuestions: List<String>? = null,
    /** Start a fresh conversation instead of continuing the current one. */
    val startNewConversation: Boolean = false,
)
