import Foundation
import Combine

/// Help screen data (port of `GetHelpSupportUseCase` consumption in HelpScreen).
@MainActor
public final class HelpViewModel: ObservableObject {
    @Published public private(set) var helpState: UiState<HelpSupportResponse> = .idle
    @Published public private(set) var reloadToken = 0

    private let env: FarmerChat

    public init(env: FarmerChat = .shared) {
        self.env = env
    }

    public func load() {
        guard !helpState.isLoading else { return }
        helpState = .loading
        Task {
            let lang = env.prefs.string(.selectedLanguageCode) ?? "en"
            let country = env.prefs.string(.userCountryCode)
            // App parity: FAQ `theme` derives from appearance (Day→light, Night→dark, Auto→default).
            let mode = env.appearance.rawValue.lowercased()
            let theme = mode == "day" ? "light" : (mode == "night" ? "dark" : "default")
            let result = await env.api.faqs(lang: lang, limit: 5, theme: theme, country: country)
            helpState = UiState.from(
                result,
                fallbackMessage: env.labels.label(FCLabels.somethingWentWrongPleaseTryAgain, fallback: "Something went wrong. Please try again.")
            )
        }
    }

    public func reload() {
        reloadToken += 1
        helpState = .idle
        load()
    }

    public var faqs: [FaqItem] {
        helpState.value?.data?.faqs ?? []
    }

    public var legal: HelpLegal? {
        helpState.value?.data?.legal
    }
}
