import Foundation
import Combine

/// Port of `LanguageSettingsState` (Settings → LanguageChooser).
public struct LanguageSettingsState: Sendable {
    public var languageState: UiState<[SupportedLanguageGroup]> = .idle
    public var expandedLanguages: Bool = false
    public var selectedLanguageId: Int?
    public var selectedLanguageCode: String?
    public var isFetchingLabels: Bool = false
    public var fetchingLabelsForId: Int?
    public var isSubmittingLanguage: Bool = false
    public var languageSubmitSuccess: Bool = false
    public var submitErrorMessage: String?
    public var labelsRefreshToken: Int = 0

    public init() {}

    public func visibleLanguages() -> [SupportedLanguage] {
        guard case .success(let groups) = languageState else { return [] }
        let priority = groups.flatMap { $0.priorityView ?? [] }
        guard expandedLanguages else { return priority }
        let expanded = groups.flatMap { $0.expandedView ?? [] }
        var seen = Set<Int>()
        return (priority + expanded).filter { seen.insert($0.id).inserted }
    }

    public func hasExpandableLanguages() -> Bool {
        guard case .success(let groups) = languageState else { return false }
        return groups.contains { !($0.expandedView ?? []).isEmpty }
    }
}

// MARK: - ViewModel (port of SettingsViewModel: language chooser + appearance)

@MainActor
public final class SettingsViewModel: ObservableObject {
    @Published public private(set) var state = LanguageSettingsState()
    @Published public var appearanceMode: FarmerChatAppearance

    private let env: FarmerChat

    public init(env: FarmerChat = .shared) {
        self.env = env
        self.appearanceMode = env.appearance
    }

    public var isAuthenticated: Bool { env.session.isAuthenticated }

    public var userName: String {
        env.prefs.string(.userName) ?? ""
    }

    public var currentLanguageDisplay: String {
        env.prefs.string(.selectedLanguageDisplayName) ?? ""
    }

    public var currentLanguageCode: String {
        env.prefs.string(.selectedLanguageCode) ?? "en"
    }

    // MARK: - Appearance

    public func setAppearanceMode(_ mode: FarmerChatAppearance) {
        appearanceMode = mode
        env.setAppearance(mode)
        env.analytics.track(AnalyticsEvents.settingsOptionSelected, props: [
            "option": "appearance",
            "value": mode.rawValue
        ])
        let theme: String
        switch mode {
        case .day: theme = "Light"
        case .night: theme = "Dark"
        case .auto: theme = "Default"
        }
        env.analytics.setUserAttribute("THEME", value: theme)
    }

    // MARK: - Language chooser

    public func loadLanguages() {
        guard !state.languageState.isLoading else { return }
        state.languageState = .loading
        Task {
            // Same guard as onboarding: endpoint #2 400s on a blank `country_code`, and the
            // preference is empty whenever guest init never resolved one. `defaultCountryCode`
            // is now empty by default ("derive from the device locale"), so this MUST go through
            // the same resolver — reading the raw field would send a blank and 400.
            let result = await env.api.countryWiseSupportedLanguages(
                countryCode: env.prefs.string(.userCountryCode)?.nonBlank
                    ?? env.config.resolvedFallbackCountryCode,
                state: env.prefs.string(.userState)?.nonBlank
                    ?? env.config.defaultStateCode
            )
            switch result {
            case .success(let groups):
                state.languageState = .success(groups)
                let storedId = env.prefs.int(.selectedLanguageId)
                if storedId != 0 {
                    state.selectedLanguageId = storedId
                    state.selectedLanguageCode = env.prefs.string(.selectedLanguageCode)
                }
            case .error(let error):
                state.languageState = .error(
                    message: error.message ?? env.labels.label(FCLabels.somethingWentWrongPleaseTryAgain, fallback: "Something went wrong. Please try again."),
                    code: error.code,
                    isNetworkError: error.isNetworkError
                )
            }
        }
    }

    public func toggleExpandedLanguages() {
        state.expandedLanguages.toggle()
    }

    public func selectLanguage(id: Int, code: String?) {
        state.selectedLanguageId = id
        state.selectedLanguageCode = code
        env.analytics.track(AnalyticsEvents.languageSelected, props: ["language_id": String(id), "screen": ScreenNames.languageChooser])
        Task { await fetchLabels(languageId: id, code: code) }
    }

    private func fetchLabels(languageId: Int, code: String?) async {
        state.isFetchingLabels = true
        state.fetchingLabelsForId = languageId
        defer {
            state.isFetchingLabels = false
            state.fetchingLabelsForId = nil
        }
        let result = await env.api.getLabels(languageId: languageId)
        if case .success(let map) = result {
            if let code {
                env.prefs.setString(code, .selectedLanguageCode)
            }
            env.labels.update(labels: map)
            state.labelsRefreshToken += 1
        }
    }

    public func submitLanguage() {
        guard let languageId = state.selectedLanguageId, !state.isSubmittingLanguage else { return }
        guard let userId = env.session.userId else { return }
        state.isSubmittingLanguage = true
        Task {
            defer { state.isSubmittingLanguage = false }
            let result = await env.api.setPreferredLanguage(SetPreferredLanguageRequest(userId: userId, languageId: languageId))
            switch result {
            case .success:
                env.prefs.setInt(languageId, .selectedLanguageId)
                if let code = state.selectedLanguageCode {
                    env.prefs.setString(code, .selectedLanguageCode)
                }
                if case .success(let groups) = state.languageState {
                    let all = groups.flatMap { ($0.priorityView ?? []) + ($0.expandedView ?? []) }
                    if let display = all.first(where: { $0.id == languageId })?.displayName {
                        env.prefs.setString(display, .selectedLanguageDisplayName)
                    }
                }
                env.analytics.track(AnalyticsEvents.languageSubmitted, props: [
                    "language_id": String(languageId),
                    "screen": ScreenNames.languageChooser
                ])
                if let code = state.selectedLanguageCode {
                    env.analytics.setUserAttribute("PREFERRED_LANGUAGE", value: code)
                }
                state.languageSubmitSuccess = true
            case .error(let error):
                state.submitErrorMessage = error.message
                    ?? env.labels.label(FCLabels.somethingWentWrongPleaseTryAgain, fallback: "Something went wrong. Please try again.")
            }
        }
    }

    public func consumeLanguageResult() {
        state.languageSubmitSuccess = false
        state.submitErrorMessage = nil
    }

    // MARK: - Sign-up gating (drawer/settings sign-up → interstitial or Auth)

    /// `getUserQuestionCount()` → `bypass_interstitial` decides AccountBenefits vs Auth.
    public func shouldBypassInterstitial() async -> Bool {
        let result = await env.api.userQuestionCount()
        if case .success(let response) = result {
            return response.bypassInterstitial ?? false
        }
        return false
    }
}
