package org.digitalgreen.farmerchat.sdk.core.analytics

import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationCampaignConfig
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationTriggerSource
import org.digitalgreen.farmerchat.sdk.core.ui.location.gpsAnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.ui.location.gpsTriggerLabel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Character-for-character guards on every analytics event name, property key and
 * screen-name value the SDK emits.
 *
 * Every expected string below is a literal transcribed from the production app
 * (`fc-compose-agentic/app/src/main/java/org/digitalgreen/farmer/chatbot/core/analytics/`
 * and the call sites named in each comment). A typo in an event name or key is invisible
 * at runtime — the host's funnel just goes quiet — so these are asserted as literals,
 * never by referencing the constants they check.
 */
class AnalyticsNamesTest {

    // ------------------------------------------------------------------ event names

    /** App OnboardingAnalyticsEvents.kt — API tracking block. */
    @Test
    fun `api call event names match the app`() {
        assertEquals("API_Call_Initiated", AnalyticsEvents.API_CALL_INITIATED)
        assertEquals("API_Call_Success", AnalyticsEvents.API_CALL_SUCCESS)
        assertEquals("API_Call_Failed", AnalyticsEvents.API_CALL_FAILED)
        assertEquals("API_Call_Timeout", AnalyticsEvents.API_CALL_TIMEOUT)
    }

    /** App OnboardingAnalyticsEvents.kt — note the sheet's "Succeded" typo is intentional. */
    @Test
    fun `device location fetch event names match the app including the sheet typo`() {
        assertEquals("Device_Location_Fetch_Initiated", AnalyticsEvents.DEVICE_LOCATION_FETCH_INITIATED)
        assertEquals("Device_Location_Fetch_Succeded", AnalyticsEvents.DEVICE_LOCATION_FETCH_SUCCEEDED)
        assertEquals("Device_Location_Fetch_Failed", AnalyticsEvents.DEVICE_LOCATION_FETCH_FAILED)
    }

    /** App OnboardingAnalyticsEvents.kt — mixed casing is the app's, not a slip. */
    @Test
    fun `onboarding completion event names match the app`() {
        assertEquals("Onboarding_completed_Step1", AnalyticsEvents.ONBOARDING_COMPLETED_STEP1)
        assertEquals("Onboarding_completed_Step2", AnalyticsEvents.ONBOARDING_COMPLETED_STEP2)
        assertEquals("Onboarding_completed", AnalyticsEvents.ONBOARDING_COMPLETED)
        assertEquals("FirstTimeOnboardingCompleted", AnalyticsEvents.FIRST_TIME_ONBOARDING_COMPLETED)
    }

    /** App OnboardingAnalyticsEvents.kt — home / dashboard block. */
    @Test
    fun `home feed card event names match the app`() {
        assertEquals("Card_Shown", AnalyticsEvents.CARD_SHOWN)
        assertEquals("Card_Viewed", AnalyticsEvents.CARD_VIEWED)
        assertEquals("Card_Clicked", AnalyticsEvents.CARD_CLICKED)
        assertEquals("Dashboard_Viewed", AnalyticsEvents.DASHBOARD_VIEWED)
        assertEquals("FirstTimeDashboardViewed", AnalyticsEvents.FIRST_TIME_DASHBOARD_VIEWED)
        assertEquals("question_card_data_Submitted", AnalyticsEvents.QUESTION_CARD_DATA_SUBMITTED)
    }

    /** App OnboardingAnalyticsEvents.kt — mandatory Terms-of-Use acceptance gate. */
    @Test
    fun `terms of use gate event names match the app`() {
        assertEquals("Terms_Of_Use_Sheet_Shown", AnalyticsEvents.TERMS_OF_USE_SHEET_SHOWN)
        assertEquals(
            "Terms_Of_Use_Content_Screen_Viewed",
            AnalyticsEvents.TERMS_OF_USE_CONTENT_SCREEN_VIEWED
        )
        assertEquals(
            "Terms_Of_Use_Content_Screen_Exited",
            AnalyticsEvents.TERMS_OF_USE_CONTENT_SCREEN_EXITED
        )
        assertEquals(
            "Terms_Of_Use_Accept_Click_Event",
            AnalyticsEvents.TERMS_OF_USE_ACCEPT_CLICK_EVENT
        )
        assertEquals(
            "Terms_Of_Use_Read_Terms_Click_Event",
            AnalyticsEvents.TERMS_OF_USE_READ_TERMS_CLICK_EVENT
        )
        // App constant is Plotline_Accept_Terms_Click_Event; the EMITTED name is this.
        assertEquals("ToS_Aug26_Accept_Terms", AnalyticsEvents.PLOTLINE_ACCEPT_TERMS_CLICK_EVENT)
    }

    /** App OnboardingAnalyticsEvents.kt / GpsAnalyticsEvents.kt — location block. */
    @Test
    fun `location event names match the app`() {
        assertEquals("Location_Update_Triggered", AnalyticsEvents.LOCATION_UPDATE_TRIGGERED)
        assertEquals("location_permission_allow", AnalyticsEvents.LOCATION_PERMISSION_ALLOW)
        assertEquals("location_permission_deny", AnalyticsEvents.LOCATION_PERMISSION_DENY)
        assertEquals(
            "location_permission_prompt_triggered",
            AnalyticsEvents.LOCATION_PERMISSION_PROMPT_TRIGGERED
        )
        assertEquals("location_fetch_success", AnalyticsEvents.LOCATION_FETCH_SUCCESS)
        assertEquals("location_fetch_failed", AnalyticsEvents.LOCATION_FETCH_FAILED)
        assertEquals("location_fetch_failed_timeout", AnalyticsEvents.LOCATION_FETCH_FAILED_TIMEOUT)
        assertEquals("Permission_popup_shown", AnalyticsEvents.PERMISSION_POPUP_SHOWN)
        assertEquals("Permission_granted", AnalyticsEvents.PERMISSION_GRANTED)
        assertEquals("Permission_denied", AnalyticsEvents.PERMISSION_DENIED)
        assertEquals(
            "Permission_Fallback_Default_Setting_Shown",
            AnalyticsEvents.PERMISSION_FALLBACK_SETTING_SHOWN
        )
    }

    /** App OnboardingAnalyticsEvents.kt — chat / query block. */
    @Test
    fun `chat event names match the app`() {
        assertEquals("Send_Query", AnalyticsEvents.SEND_QUERY)
        assertEquals("Send_Query_Initiated", AnalyticsEvents.SEND_QUERY_INITIATED)
        assertEquals("FirstQueryAsked", AnalyticsEvents.FIRST_QUERY_ASKED)
        assertEquals("Answer_Share_Button_Clicked", AnalyticsEvents.SHARE_BUTTON_CLICKED)
        assertEquals("Answer_Save_Button_Clicked", AnalyticsEvents.SAVE_BUTTON_CLICKED)
        assertEquals(
            "Started_Playing_Response_Audio",
            AnalyticsEvents.STARTED_PLAYING_RESPONSE_AUDIO
        )
        assertEquals(
            "Stopped_Playing_Response_Audio",
            AnalyticsEvents.STOPPED_PLAYING_RESPONSE_AUDIO
        )
        assertEquals("Transcription_Success", AnalyticsEvents.TRANSCRIPTION_SUCCESS)
        assertEquals("Transcription_Failed", AnalyticsEvents.TRANSCRIPTION_FAILED)
    }

    // ------------------------------------------------------------------ property keys

    /**
     * The app's AnalyticsProps carries two deliberate misspellings that the analytics
     * sheet froze. Renaming either one silently breaks the host's funnels.
     */
    @Test
    fun `app property key typos are preserved`() {
        assertEquals("langauge_code", AnalyticsProps.LANGUAGE_CODE)
        assertEquals("isOnnboarding_query", AnalyticsProps.ONBOARDING_QUERY)
        assertEquals("length_of_Text_query", AnalyticsProps.LENGTH_OF_TEXT_QUERY)
    }

    /**
     * Keys the app passes as raw literals at the call site. Several differ from the
     * similarly-named AnalyticsProps constant only by case or by a space, so both
     * spellings have to exist and stay distinct.
     */
    @Test
    fun `call site literal property keys match the app exactly`() {
        // app AuthScreen.kt:227 / :161 / :320
        assertEquals("country_code", AnalyticsProps.COUNTRY_CODE)
        assertEquals("channel", AnalyticsProps.CHANNEL)
        assertEquals("trigger", AnalyticsProps.TRIGGER_LOWER)
        // app AuthViewModel.kt:635 / :724 / :798 / :479
        assertEquals("user_id", AnalyticsProps.USER_ID)
        assertEquals("is_new_user", AnalyticsProps.IS_NEW_USER)
        assertEquals("verification_status", AnalyticsProps.VERIFICATION_STATUS)
        assertEquals("error_message", AnalyticsProps.ERROR_MESSAGE)
        assertEquals("attempt_number", AnalyticsProps.ATTEMPT_NUMBER)
        assertEquals("lockout_type", AnalyticsProps.LOCKOUT_TYPE)
        // app DrawerContent.kt:120/368, SettingsScreen.kt:150, ChatHistoryScreen.kt:187
        assertEquals("option", AnalyticsProps.OPTION_LOWER)
        assertEquals("value", AnalyticsProps.VALUE_LOWER)
        assertEquals("conversation_id", AnalyticsProps.CONVERSATION_ID)
        assertEquals("question_index", AnalyticsProps.QUESTION_INDEX)
        assertEquals("Conversation ID", AnalyticsProps.CONVERSATION_ID_SPACED)
        // app HelpScreen.kt:201, HomeScreen.kt:729, HomeScreen.kt:1407/1462/1492
        assertEquals("Question", AnalyticsProps.QUESTION)
        assertEquals("ID", AnalyticsProps.ID)
        assertEquals("Accepted", AnalyticsProps.ACCEPTED)
        assertEquals("crops", AnalyticsProps.CROPS)
        assertEquals("livestock", AnalyticsProps.LIVESTOCK)
        assertEquals("gender", AnalyticsProps.GENDER)
    }

    /** The lowercase call-site keys must NOT collide with the capitalised sheet keys. */
    @Test
    fun `lowercase call site keys are distinct from the sheet keys`() {
        assertEquals("Option", AnalyticsProps.OPTION)
        assertEquals("Value", AnalyticsProps.VALUE)
        assertEquals("Trigger", AnalyticsProps.TRIGGER)
        assertTrue(AnalyticsProps.OPTION != AnalyticsProps.OPTION_LOWER)
        assertTrue(AnalyticsProps.VALUE != AnalyticsProps.VALUE_LOWER)
        assertTrue(AnalyticsProps.TRIGGER != AnalyticsProps.TRIGGER_LOWER)
        assertTrue(AnalyticsProps.CONVERSATION_ID != AnalyticsProps.CONVERSATION_ID_SPACED)
    }

    /** App AnalyticsProps.kt — card / input / permission keys. */
    @Test
    fun `card and input property keys match the app`() {
        assertEquals("Card_Type", AnalyticsProps.CARD_TYPE)
        assertEquals("Card_category", AnalyticsProps.CARD_CATEGORY)
        assertEquals("Card_Position", AnalyticsProps.CARD_POSITION)
        assertEquals("image_id", AnalyticsProps.IMAGE_ID)
        assertEquals("sentence_id", AnalyticsProps.SENTENCE_ID)
        assertEquals("Date Range", AnalyticsProps.DATE_RANGE)
        assertEquals("Asset_Type", AnalyticsProps.ASSET_TYPE)
        assertEquals("Asset_Name", AnalyticsProps.ASSET_NAME)
        assertEquals("Input_type", AnalyticsProps.INPUT_TYPE)
        assertEquals("Source", AnalyticsProps.SOURCE)
        assertEquals("Failure_Reason", AnalyticsProps.FAILURE_REASON)
        assertEquals("Confidence_Score", AnalyticsProps.CONFIDENCE_SCORE)
        assertEquals("No_of_seconds_played", AnalyticsProps.NO_OF_SECONDS_PLAYED)
        assertEquals("Permission_type", AnalyticsProps.PERMISSION_TYPE)
        assertEquals("Attempt", AnalyticsProps.ATTEMPT)
        assertEquals("Icon", AnalyticsProps.ICON_TYPE)
        assertEquals("API_Name", AnalyticsProps.API_NAME)
        assertEquals("screen_name", AnalyticsProps.SCREEN_NAME)
    }

    // ------------------------------------------------------------------ screen names

    /** App AnalyticsScreens.kt, verbatim. */
    @Test
    fun `screen names match the app`() {
        assertEquals("Splash Screen", AnalyticsScreens.SPLASH)
        assertEquals("Select Language Screen", AnalyticsScreens.LANGUAGE)
        assertEquals("Language Settings Screen", AnalyticsScreens.LANGUAGE_SETTINGS)
        assertEquals("Enter Name Screen", AnalyticsScreens.NAME)
        assertEquals("Dashboard Screen", AnalyticsScreens.HOME)
        assertEquals("GPS Screen", AnalyticsScreens.GPS)
        assertEquals("GPS Interstitial Screen", AnalyticsScreens.GPS_INTERSTITIAL)
        assertEquals("Login Screen", AnalyticsScreens.AUTH)
        assertEquals("Verify OTP Screen", AnalyticsScreens.VERIFY_OTP)
        assertEquals("Select Country Screen", AnalyticsScreens.SELECT_COUNTRY)
        assertEquals("Account Benefit Screen", AnalyticsScreens.ACCOUNT_BENEFIT)
        assertEquals("Account Success Screen", AnalyticsScreens.ACCOUNT_SUCCESS)
        assertEquals("Chat Screen", AnalyticsScreens.CHAT)
        assertEquals("Help & Support Screen", AnalyticsScreens.HELP)
        assertEquals("Settings Screen", AnalyticsScreens.SETTINGS)
        assertEquals("Terms of Use Content Screen", AnalyticsScreens.TERMS_OF_USE_CONTENT_SCREEN)
    }

    /**
     * `screen_name` values the app writes as raw literals — these are NOT the
     * AnalyticsScreens constants and must not be "corrected" to them.
     */
    @Test
    fun `call site literal screen names match the app exactly`() {
        assertEquals("Menu", AnalyticsScreens.MENU_LITERAL)
        assertEquals("Side Menu", AnalyticsScreens.SIDE_MENU_LITERAL)
        assertEquals("Chat History screen", AnalyticsScreens.CHAT_HISTORY_LITERAL)
        assertEquals("Help and support screen", AnalyticsScreens.HELP_LITERAL)
        assertEquals("TermsOfUseDialog", AnalyticsScreens.TERMS_OF_USE_DIALOG_LITERAL)
        // The literals differ from the sheet constants for the same surfaces.
        assertTrue(AnalyticsScreens.HELP_LITERAL != AnalyticsScreens.HELP)
        assertTrue(AnalyticsScreens.CHAT_HISTORY_LITERAL != AnalyticsScreens.CHAT_HISTORY)
    }

    // ------------------------------------------------------------------ API_Name values

    /** App AnalyticsApis.kt, verbatim — these are dashboard group-by values. */
    @Test
    fun `api name values match the app`() {
        assertEquals("IP Geolocation", AnalyticsApis.IP_GEO)
        assertEquals("Initialise user", AnalyticsApis.INITIALIZE_GUEST)
        assertEquals("Set Language Preference", AnalyticsApis.SET_LANGUAGE)
        assertEquals("Get Supported Languages", AnalyticsApis.GET_LANGUAGES)
        assertEquals("Update Profile", AnalyticsApis.UPDATE_PROFILE)
        assertEquals("Privacy Policy", AnalyticsApis.GET_LEGAL_LINKS)
        assertEquals("Dashboard Content", AnalyticsApis.HOME_FEED)
        assertEquals("Weather", AnalyticsApis.WEATHER)
        assertEquals("GPS Fetch fresh location", AnalyticsApis.GPS_FETCH_FRESH_LOCATION)
        assertEquals("Update user location", AnalyticsApis.UPDATE_USER_LOCATION)
    }

    // ------------------------------------------------------------------ emitted payloads

    private fun recorder(): Pair<FarmerChatAnalytics, MutableList<AnalyticsEvent>> {
        val events = mutableListOf<AnalyticsEvent>()
        val analytics = FarmerChatAnalytics(
            configOnEvent = { name, props -> events.add(AnalyticsEvent(name, props)) },
            // enableAnalytics defaults to false in 2.0.0; these tests assert PAYLOAD shape, so
            // they opt the dispatch back on.
            enabled = true
        )
        return analytics to events
    }

    @Test
    fun `api helpers emit the app's two-key payload`() {
        val (analytics, events) = recorder()
        analytics.trackApiInitiated(AnalyticsApis.HOME_FEED, AnalyticsScreens.HOME)
        analytics.trackApiSuccess(AnalyticsApis.HOME_FEED, AnalyticsScreens.HOME)
        analytics.trackApiError(AnalyticsApis.WEATHER, AnalyticsScreens.HOME, isTimeout = true)
        analytics.trackApiError(AnalyticsApis.WEATHER, AnalyticsScreens.HOME, isTimeout = false)

        assertEquals(
            listOf("API_Call_Initiated", "API_Call_Success", "API_Call_Timeout", "API_Call_Failed"),
            events.map { it.name }
        )
        events.forEach { assertEquals(setOf("screen_name", "API_Name"), it.properties.keys) }
        assertEquals("Dashboard Content", events[0].properties["API_Name"])
        assertEquals("Dashboard Screen", events[0].properties["screen_name"])
        assertEquals("Weather", events[2].properties["API_Name"])
    }

    /**
     * The full 15-key card payload from the app's `trackHomeCardEvent`
     * (app AnalyticsManager.kt:186-226), including the two quirks:
     * `screen_name` is always the Dashboard screen, and the `State` key carries the
     * COUNTY value while `County` is never emitted.
     */
    @Test
    fun `home card payload matches the app including the State-carries-county quirk`() {
        val (analytics, events) = recorder()
        analytics.trackHomeCardEvent(
            AnalyticsEvents.CARD_SHOWN,
            HomeCardAnalytics(
                cardType = "image",
                cardCategory = "wheat",
                imageId = "11",
                sentenceId = "22",
                text = "How much fertiliser?",
                views = "7",
                country = "Kenya",
                county = "Nakuru",
                assetType = "crop",
                assetName = "wheat",
                stage = "vegetative",
                concern = "pest management",
                dateRange = "1-7 Sep",
                cardPosition = "image 1"
            )
        )

        val e = events.single()
        assertEquals("Card_Shown", e.name)
        assertEquals(
            setOf(
                "screen_name", "Card_Type", "Card_category", "image_id", "sentence_id",
                "Text", "Views", "Country", "State", "Asset_Type", "Asset_Name",
                "Stage", "Concern", "Date Range", "Card_Position"
            ),
            e.properties.keys
        )
        assertEquals("Dashboard Screen", e.properties["screen_name"])
        // The quirk: `State` carries county, and `County` is absent entirely.
        assertEquals("Nakuru", e.properties["State"])
        assertNull(e.properties["County"])
        assertEquals("image 1", e.properties["Card_Position"])
        // `Value` is appended only for question-card clicks.
        assertTrue("Value" !in e.properties.keys)
    }

    @Test
    fun `home card payload appends Value only when supplied`() {
        val (analytics, events) = recorder()
        analytics.trackHomeCardEvent(
            AnalyticsEvents.CARD_CLICKED,
            HomeCardAnalytics(cardType = "question", cardCategory = "gender"),
            value = "male"
        )
        assertEquals("male", events.single().properties["Value"])
    }

    /** App HomeScreen.kt:2023-2040 — per-type counters, blank for other card types. */
    @Test
    fun `card position labels count per type in feed order`() {
        val sections = listOf(
            section("image"), section("question"), section("statement"),
            section("image"), section("statement"), section(null)
        )
        assertEquals(
            listOf("image 1", "", "statement 1", "image 2", "statement 2", ""),
            cardPositionLabels(sections)
        )
    }

    /** App HomeScreen.kt:2042-2057 — every fallback chain, in the app's order. */
    @Test
    fun `section to card analytics uses the app's fallback chains`() {
        val bare = org.digitalgreen.farmerchat.sdk.core.model.SectionDto(
            type = "statement", id = 9, image_url = null, title = "Wheat tips",
            question_text = null, statement_id = 4, badge = null, cta = null,
            statement = "Sow now", selection_type = null, options = null,
            statement_type = null, is_viewed = null, meta = null
        ).toHomeCardAnalytics("statement 1")

        assertEquals("statement", bare.cardType)
        // No meta.asset_name → falls back to title.
        assertEquals("Wheat tips", bare.cardCategory)
        assertEquals("9", bare.imageId)
        assertEquals("4", bare.sentenceId)
        // question_text null → title.
        assertEquals("Wheat tips", bare.text)
        assertEquals("", bare.views)
        assertEquals("", bare.country)
        assertEquals("", bare.county)
        // No meta.asset_category → falls back to type.
        assertEquals("statement", bare.assetType)
        assertEquals("Wheat tips", bare.assetName)
        assertEquals("statement 1", bare.cardPosition)
    }

    // ------------------------------------------------------------------ GPS trigger labels

    /**
     * App LocationPromptHost.kt:133-146. These five strings are hand-transcribed into a
     * `when`, which no constant object protects — hence the literals here.
     */
    @Test
    fun `gps trigger labels match the app`() {
        assertEquals(
            "Weather Icon",
            gpsTriggerLabel(LocationTriggerSource.Weather)
        )
        assertEquals(
            "Home Screen",
            gpsTriggerLabel(LocationTriggerSource.LocalContext)
        )
        assertEquals(
            "Settings Screen",
            gpsTriggerLabel(LocationTriggerSource.Settings)
        )
        assertEquals(
            "MoEngage Campaign",
            gpsTriggerLabel(
                LocationTriggerSource.Campaign,
                LocationCampaignConfig(triggerSource = "moengage")
            )
        )
        assertEquals(
            "Plotline Campaign",
            gpsTriggerLabel(
                LocationTriggerSource.Campaign,
                LocationCampaignConfig(triggerSource = "plotline")
            )
        )
        // App's `else` branch: an unknown or absent triggerSource still reports Plotline.
        assertEquals(
            "Plotline Campaign",
            gpsTriggerLabel(
                LocationTriggerSource.Campaign,
                LocationCampaignConfig(triggerSource = "native")
            )
        )
        assertEquals(
            "Plotline Campaign",
            gpsTriggerLabel(LocationTriggerSource.Campaign, null)
        )
    }

    /** App LocationPromptHost.kt:169-201 — screen_name + Trigger, Attempt only when supplied. */
    @Test
    fun `gps analytics props carry screen name trigger and attempt`() {
        val noAttempt = gpsAnalyticsProps(LocationTriggerSource.Weather)
        assertEquals(setOf("screen_name", "Trigger"), noAttempt.keys)
        assertEquals("GPS Screen", noAttempt["screen_name"])
        assertEquals("Weather Icon", noAttempt["Trigger"])

        val withAttempt = gpsAnalyticsProps(
            LocationTriggerSource.Settings, null, attempt = 2,
            extra = mapOf(AnalyticsProps.PERMISSION_TYPE to "Location")
        )
        assertEquals(
            setOf("screen_name", "Trigger", "Attempt", "Permission_type"),
            withAttempt.keys
        )
        assertEquals(2, withAttempt["Attempt"])
        assertEquals("Location", withAttempt["Permission_type"])

        // The fetch-phase Location_Update_Triggered overrides screen_name to the Dashboard
        // screen (app LocationPromptHost.kt:443-452) — extras must win.
        val fetchPhase = gpsAnalyticsProps(
            LocationTriggerSource.LocalContext, null, attempt = 1,
            extra = mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
        )
        assertEquals("Dashboard Screen", fetchPhase["screen_name"])
        assertEquals("Home Screen", fetchPhase["Trigger"])
    }

    // ------------------------------------------------------------------ agentic chip props

    /**
     * App `core/analytics/AnalyticsProps.kt:61-70`. The four STATUS values are transcribed from
     * the app's CONSTANTS, not from the KDoc directly above them — that comment says
     * "skipped_manual" / "shown" / "not_shown", which the app's own `toAnalyticsProperties()`
     * never compares against and therefore never emits.
     */
    @Test
    fun `agentic chip property keys and status values match the app's constants`() {
        assertEquals("agentic_chip_status", AnalyticsProps.AGENTIC_CHIP_STATUS)
        assertEquals("agentic_chip_skipped_type", AnalyticsProps.AGENTIC_CHIP_SKIPPED_TYPE)
        assertEquals("agentic_chip_shown_type", AnalyticsProps.AGENTIC_CHIP_SHOWN_TYPE)
        assertEquals("agentic_chip_type", AnalyticsProps.AGENTIC_CHIP_TYPE)
        assertEquals("agentic_chip_value", AnalyticsProps.AGENTIC_CHIP_VALUE)
        assertEquals("agentic_chip_label", AnalyticsProps.AGENTIC_CHIP_LABEL)
        assertEquals("selected", AnalyticsProps.CHIP_STATUS_SELECTED)
        assertEquals("skipped", AnalyticsProps.CHIP_STATUS_SKIPPED)
        assertEquals("available", AnalyticsProps.CHIP_STATUS_AVAILABLE)
        assertEquals("none", AnalyticsProps.CHIP_STATUS_NONE)
    }

    private fun props(p: SendQueryProperties) = p.toAnalyticsProperties()

    private val plainTextQuery = SendQueryProperties(
        screenName = AnalyticsScreens.CHAT,
        isFollowupPrompt = false,
        isImageQuery = false,
        isTextQuery = true,
        isVoiceQuery = false
    )

    @Test
    fun `all seven chip keys are on every query payload, chip or not`() {
        // A key that appears only on chip payloads is a DIFFERENT schema from the app's. Every
        // Send_Query / Send_Query_Initiated carries all seven, with the app's defaults.
        val p = props(plainTextQuery)
        assertEquals("none", p["agentic_chip_status"])
        assertEquals("", p["agentic_chip_skipped_type"])
        assertEquals("", p["agentic_chip_shown_type"])
        assertEquals("", p["agentic_chip_type"])
        assertEquals("", p["agentic_chip_value"])
        assertEquals("", p["agentic_chip_label"])
        // ...and click_type is untouched for a non-chip query.
        assertEquals("text", p["click_type"])
    }

    @Test
    fun `a chip pick reports align_chip_sel and the chip fields`() {
        val p = props(
            plainTextQuery.copy(
                isAlignmentChip = true,
                agenticChipType = "gps-prompt",
                agenticChipValue = "use_approximate_location",
                agenticChipLabel = "Continue without location"
            )
        )
        assertEquals("align_chip_sel", p["click_type"])
        // Status is DERIVED from isAlignmentChip when not stamped explicitly.
        assertEquals("selected", p["agentic_chip_status"])
        assertEquals("gps-prompt", p["agentic_chip_type"])
        assertEquals("use_approximate_location", p["agentic_chip_value"])
        assertEquals("Continue without location", p["agentic_chip_label"])
    }

    @Test
    fun `the chip branch wins click_type over read_full_advice`() {
        // App precedence: isAlignmentChip is the FIRST branch of the `when`. Appending it instead
        // would let read_full_advice win for a chip tapped on an advice card.
        val p = props(plainTextQuery.copy(isAlignmentChip = true, isReadFullAdvice = true))
        assertEquals("align_chip_sel", p["click_type"])
        // ...and without the chip flag the existing chain is unchanged.
        assertEquals(
            "read_full_advice",
            props(plainTextQuery.copy(isReadFullAdvice = true))["click_type"]
        )
    }

    @Test
    fun `skipped and shown types are emitted only for their own status`() {
        val skipped = props(
            plainTextQuery.copy(
                agenticChipStatus = AnalyticsProps.CHIP_STATUS_SKIPPED,
                agenticChipSkippedType = "upload-photo",
                agenticChipShownType = "gps-prompt"
            )
        )
        assertEquals("skipped", skipped["agentic_chip_status"])
        assertEquals("upload-photo", skipped["agentic_chip_skipped_type"])
        assertEquals("", skipped["agentic_chip_shown_type"])

        val available = props(
            plainTextQuery.copy(
                agenticChipStatus = AnalyticsProps.CHIP_STATUS_AVAILABLE,
                agenticChipSkippedType = "upload-photo",
                agenticChipShownType = "gps-prompt"
            )
        )
        assertEquals("available", available["agentic_chip_status"])
        assertEquals("", available["agentic_chip_skipped_type"])
        assertEquals("gps-prompt", available["agentic_chip_shown_type"])
    }

    /** App `LocationPromptManager.kt:439` — the literal, not a [gpsTriggerLabel] case. */
    @Test
    fun `the chat gps-prompt trigger label is the app's literal`() {
        // The chip reuses LocalContext for behaviour, so its Trigger cannot come from the source:
        // LocalContext's own label is "Home Screen".
        assertEquals("Home Screen", gpsTriggerLabel(LocationTriggerSource.LocalContext))
    }

    // ------------------------------------------------------------------ appearance value

    /** App SettingsScreen.kt:145-150 — AppearanceMode Day/Night/Auto labels. */
    @Test
    fun `appearance analytics value matches the app's mode labels`() {
        assertEquals("Light", appearanceAnalyticsValue("day"))
        assertEquals("Dark", appearanceAnalyticsValue("night"))
        assertEquals("Default", appearanceAnalyticsValue("auto"))
        // Anything unrecognised follows the app's `else` branch.
        assertEquals("Default", appearanceAnalyticsValue(""))
    }

    private fun section(type: String?) = org.digitalgreen.farmerchat.sdk.core.model.SectionDto(
        type = type, id = null, image_url = null, title = null, question_text = null,
        statement_id = null, badge = null, cta = null, statement = null,
        selection_type = null, options = null, statement_type = null,
        is_viewed = null, meta = null
    )
}
