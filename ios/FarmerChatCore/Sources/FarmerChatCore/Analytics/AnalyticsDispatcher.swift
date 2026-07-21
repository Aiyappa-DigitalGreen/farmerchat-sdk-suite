import Foundation

/// Analytics event names — identical to the app's constants so hosts can
/// forward them to their own stacks unchanged (doc 02 §Analytics).
public enum AnalyticsEvents {
    public static let appOpened = "App_Opened"
    public static let screenViewed = "Screen_Viewed"
    public static let screenExited = "Screen_Exited"
    public static let dashboardViewed = "Dashboard_Viewed"
    public static let hamburgerMenuClicked = "Hamburger_Menu_Clicked"
    public static let contentTryAgainClicked = "Content_Try_Again_Clicked"

    // Auth
    public static let mobileVerificationStarted = "Mobile_verification_Started"
    public static let sendOtpClickEvent = "Send_OTP_Click_Event"
    public static let submitOtp = "Submit_OTP"
    public static let registrationCompleted = "Registration_Completed"
    public static let loginCompleted = "Login_Completed"
    public static let signupContinueClicked = "Signup_Continue_Clicked"
    public static let logoutClickEvent = "Logout_Click_Event"

    // Cards / feed
    public static let cardShown = "Card_Shown"
    public static let cardViewed = "Card_Viewed"
    public static let cardClicked = "Card_Clicked"
    public static let cardDismissed = "Card_Dismissed"

    // Query pipeline
    public static let sendQueryInitiated = "Send_Query_Initiated"
    public static let sendQuery = "Send_Query"
    public static let firstQueryAsked = "FirstQueryAsked"
    public static let transcriptionSuccess = "Transcription_Success"
    public static let transcriptionFailed = "Transcription_Failed"
    public static let startedPlayingResponseAudio = "Started_Playing_Response_Audio"
    public static let stoppedPlayingResponseAudio = "Stopped_Playing_Response_Audio"
    public static let newChatClickEvent = "New_Chat_Click_Event"
    public static let followUpQuestionClicked = "Follow_Up_Question_Clicked"
    public static let readFullAdviceClicked = "Read_Full_Advice_Clicked"
    public static let shareResponseClicked = "Share_Response_Clicked"
    public static let downloadResponseClicked = "Download_Response_Clicked"

    // Settings / language
    public static let settingsOptionSelected = "Settings_Option_Selected"
    public static let languageSelected = "Language_Selected"
    public static let languageSubmitted = "Language_Submitted"
    public static let nameUpdated = "Name_Updated"
    public static let nameSkipped = "Name_Skipped"

    // Weather / GPS
    public static let weatherClicked = "Weather_Clicked"
    public static let gpsFlowStep = "gps_flow_step"
    public static let gpsLocationShared = "GPS_Location_Shared"
    public static let gpsLocationSkipped = "GPS_Location_Skipped"
    public static let gpsLocationFailed = "GPS_Location_Failed"

    // Force-update / misc parity constants
    public static let forceUpdatePopupUpdateClicked = "FORCE_UPDATE_POPUP_UPDATE_CLICKED"
    public static let forceUpdatePopupCancelClicked = "FORCE_UPDATE_POPUP_CANCEL_CLICKED"
}

/// Common screen names used for Screen_Viewed / Screen_Exited props.
public enum ScreenNames {
    public static let splash = "SPLASH"
    public static let language = "LANGUAGE"
    public static let enterName = "ENTER_NAME"
    public static let auth = "AUTH"
    public static let verifyOtp = "VERIFY_OTP"
    public static let accountBenefits = "ACCOUNT_BENEFITS"
    public static let accountSuccess = "ACCOUNT_SUCCESS"
    public static let home = "HOME"
    public static let chat = "CHAT"
    public static let chatHistory = "CHAT_HISTORY"
    public static let settings = "SETTINGS"
    public static let settingsName = "SETTINGS_NAME"
    public static let languageChooser = "LANGUAGE_CHOOSER"
    public static let help = "HELP"
    public static let error = "ERROR"
    public static let fullScreenMessage = "FULL_SCREEN_MESSAGE"
    public static let locationPrompt = "LOCATION_PROMPT"
}

/// Fan-out point for analytics. The SDK never embeds third-party analytics
/// SDKs; everything is emitted to the host via `FarmerChatConfig.onEvent`.
public final class AnalyticsDispatcher: @unchecked Sendable {
    private let handler: FarmerChatEventHandler?
    /// Semantic screen callbacks (docs/07 C4). Fired alongside raw events.
    private let onScreenView: (@Sendable (String) -> Void)?
    private let onChatOpened: (@Sendable () -> Void)?
    private let lock = NSLock()
    private var userAttributes: [String: String] = [:]

    public init(
        handler: FarmerChatEventHandler?,
        onScreenView: (@Sendable (String) -> Void)? = nil,
        onChatOpened: (@Sendable () -> Void)? = nil
    ) {
        self.handler = handler
        self.onScreenView = onScreenView
        self.onChatOpened = onChatOpened
    }

    public func track(_ name: String, props: [String: String] = [:]) {
        handler?(name, props)
    }

    public func screenViewed(_ screen: String, extra: [String: String] = [:]) {
        var props = extra
        props["screen_name"] = screen
        track(AnalyticsEvents.screenViewed, props: props)
        // C4 semantic callbacks.
        onScreenView?(screen)
        if screen == ScreenNames.chat { onChatOpened?() }
    }

    public func screenExited(_ screen: String, extra: [String: String] = [:]) {
        var props = extra
        props["screen_name"] = screen
        track(AnalyticsEvents.screenExited, props: props)
    }

    /// User attributes are emitted as events with a reserved name so hosts can
    /// map them onto their identity systems.
    public func setUserAttribute(_ key: String, value: String) {
        lock.lock()
        userAttributes[key] = value
        lock.unlock()
        track("User_Attribute_Set", props: ["attribute": key, "value": value])
    }

    public func attribute(_ key: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return userAttributes[key]
    }
}
