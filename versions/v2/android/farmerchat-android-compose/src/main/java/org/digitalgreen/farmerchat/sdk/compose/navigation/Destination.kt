package org.digitalgreen.farmerchat.sdk.compose.navigation

import kotlinx.serialization.Serializable

/**
 * All navigation routes of the FarmerChat journey — port of the app's
 * Destination.kt (doc 01 §2). Type-safe navigation-compose destinations.
 */
sealed interface Destination {

    @Serializable
    data object Splash : Destination

    @Serializable
    data object Language : Destination

    @Serializable
    data object Name : Destination

    @Serializable
    data object Home : Destination

    @Serializable
    data class Chat(
        val source: String = "home",
        val question: String? = null,
        val conversationId: String? = null,
        val imageUri: String? = null,
        val transcriptionId: String? = null,
        val audioUri: String? = null,
        val statementId: Int? = null,
        val homeStatementId: String? = null,
        val preGeneratedAnswer: String? = null,
        val followUpQuestions: List<String> = emptyList(),
        val isWeatherAdviceCTA: Boolean = false,
        val isSSFR: Boolean = false,
        val ssfrCrop: String? = null,
        val channel: String? = null
    ) : Destination

    @Serializable
    data object Settings : Destination

    @Serializable
    data object SettingsName : Destination

    @Serializable
    data object Help : Destination

    @Serializable
    data object SettingsLanguage : Destination

    @Serializable
    data object ChatHistory : Destination

    @Serializable
    data class Error(
        val isNetworkError: Boolean = true,
        val fromScreen: String = ""
    ) : Destination

    @Serializable
    data object AccountBenefits : Destination

    @Serializable
    data object Auth : Destination

    @Serializable
    data object AccountSuccess : Destination

    /** Rendered as a full-width dialog (WebView). */
    @Serializable
    data class LegalContent(
        val url: String,
        val title: String
    ) : Destination
}
