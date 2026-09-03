import Foundation
import Combine

// MARK: - UDF Action (port of splash/udf/OnboardingAction.kt)

public enum OnboardingAction: Sendable {
    case fetchGeoLocation(fromScreen: String)
    case consumeGeoResult
    case fetchSupportedLanguages(countryCode: String?, state: String?)
    case selectLanguage(languageId: Int)
    case applyLanguageFromModal(languageId: Int, languageCode: String)
    case fetchLegalLinks
    case getStartedClicked
    case acceptTerms
    case consumeLanguageResult
    case consumeErrorNavigation
    case resetState
}

// MARK: - UDF State (port of splash/udf/OnboardingState.kt)

public struct OnboardingState: Sendable {
    public var geoState: UiState<GeoResponse> = .idle
    public var guestInitState: UiState<InitializeGuestUserResponse> = .idle
    public var languageState: UiState<[SupportedLanguageGroup]> = .idle
    public var expandedLanguages: Bool = false
    public var selectedLanguageId: Int?
    public var languageCode: String?
    public var labelsRefreshToken: Int = 0
    public var isFetchingLabels: Bool = false
    public var fetchingLabelsForId: Int?
    public var isApplyingLanguageFromModal: Bool = false
    public var privacyPolicyUrl: String?
    public var termsOfUseUrl: String?
    public var isSubmittingLanguage: Bool = false
    public var languageSubmitSuccess: Bool = false
    public var submitErrorMessage: String?
    public var shouldNavigateToError: Bool = false
    public var errorIsNetworkError: Bool = true
    public var errorFromScreen: String = ""

    public init() {}

    /// All selectable languages flattened for the current expansion state.
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

// MARK: - ViewModel (port of OnboardingSharedViewModel)

@MainActor
public final class OnboardingViewModel: ObservableObject {
    @Published public private(set) var state = OnboardingState()

    private let env: FarmerChat
    private var api: FarmerChatAPI { env.api }
    private var prefs: PreferenceStore { env.prefs }
    private var labels: LabelManager { env.labels }
    private var config: FarmerChatConfig { env.config }
    private var selectDebounce: Task<Void, Never>?

    public init(env: FarmerChat = .shared) {
        self.env = env
    }

    public func onAction(_ action: OnboardingAction) {
        switch action {
        case .fetchGeoLocation(let fromScreen):
            Task { await fetchGeoLocation(fromScreen: fromScreen) }
        case .consumeGeoResult:
            state.geoState = .idle
        case .fetchSupportedLanguages(let countryCode, let regionState):
            Task { await fetchSupportedLanguages(countryCode: countryCode, state: regionState) }
        case .selectLanguage(let languageId):
            selectLanguage(languageId)
        case .applyLanguageFromModal(let languageId, let languageCode):
            Task { await applyLanguageFromModal(languageId: languageId, languageCode: languageCode) }
        case .fetchLegalLinks:
            Task { await fetchLegalLinks() }
        case .getStartedClicked:
            Task { await submitLanguage() }
        case .acceptTerms:
            Task { await acceptTerms() }
        case .consumeLanguageResult:
            state.languageSubmitSuccess = false
            state.submitErrorMessage = nil
        case .consumeErrorNavigation:
            state.shouldNavigateToError = false
        case .resetState:
            state = OnboardingState()
        }
    }

    public var expandedLanguages: Bool {
        get { state.expandedLanguages }
        set { state.expandedLanguages = newValue }
    }

    public func toggleExpandedLanguages() {
        state.expandedLanguages.toggle()
    }

    // MARK: - Bootstrap: guest init + geo + language fetch

    /// Language bootstrap, app order (`OnboardingSharedViewModel.fetchGeoAndInitialize`):
    /// geolocate first (tolerated failure), then guest init WITH the
    /// coordinates, then languages using the init response's country/state
    /// (falling back to stored hints, else empty — the param is always sent).
    public func bootstrapLanguages() async {
        var lat: Double?
        var lng: Double?
        var accuracy: Double?
        state.geoState = .loading
        let geo = await api.geolocate()
        state.geoState = UiState.from(geo, fallbackMessage: "Could not detect location")
        if case .success(let response) = geo, let location = response.location {
            lat = location.lat
            lng = location.lng
            accuracy = response.accuracy
            prefs.setDouble(location.lat, .latitude)
            prefs.setDouble(location.lng, .longitude)
        } else {
            // P1 fallback endpoint — tolerated failure. The app does NOT then proceed with no
            // coordinates: it falls back to the DEVICE LOCALE's country centroid
            // (`CountryLatLngProvider.getLatLngFromDeviceLocale`) and accepts it only when
            // `lat != 0.0 && lng != 0.0`. A locale with no region yields (0.0, 0.0), which must
            // stay unresolved — sending it would place the farmer off West Africa.
            //
            // Covers BOTH a failed call and a success carrying no `location` (Android only
            // handles the former — noted in docs/04).
            //
            // Deliberately NOT persisted to `.latitude`/`.longitude`: a country centroid is not
            // this user's location, and writing it would leak a fake precise fix into every
            // later read. It only feeds guest init, exactly as the app does.
            let fallback = config.resolvedFallbackCoordinates
            if CountryLatLngProvider.isResolved(lat: fallback.lat, lng: fallback.lng) {
                lat = fallback.lat
                lng = fallback.lng
                accuracy = 0.0
            }
        }

        state.guestInitState = .loading
        let initResult = await env.session.ensureGuestSession(lat: lat, long: lng, accuracy: accuracy)
        state.guestInitState = UiState.from(initResult, fallbackMessage: labels.label("error_generic", fallback: "Something went wrong. Please try again."))
        switch initResult {
        case .success(let response):
            // Endpoint #2 400s on a blank `country_code`, and a fresh guest on an unresolvable
            // IP comes back with country_code == nil. Fall through to the persisted value, then
            // to the host config (if set), then to the DEVICE LOCALE's region, and only as a
            // last resort to `lastResortCountryCode` — never to "".
            let countryCode = response.countryCode?.nonBlank
                ?? prefs.string(.userCountryCode)?.nonBlank
                ?? config.resolvedFallbackCountryCode
            let regionState = response.state?.nonBlank
                ?? prefs.string(.userState)?.nonBlank
                ?? config.defaultStateCode
            // GUEST HOME FIX: endpoint #12 returns an EMPTY feed until the backend has a
            // resolved location, and it resolves one ONLY from coordinates (a country name alone
            // is rejected). A guest the backend cannot place by IP, who never reaches the GPS
            // prompt, would otherwise land on a permanently blank home screen.
            if (response.countryCode?.nonBlank) == nil {
                await seedDefaultLocation()
            }
            await fetchSupportedLanguages(countryCode: countryCode, state: regionState)
        case .error(let error):
            // App parity: guest-init failure routes to the error screen.
            state.shouldNavigateToError = true
            state.errorIsNetworkError = error.isNetworkError
            state.errorFromScreen = "language"
        }
    }

    private func fetchGeoLocation(fromScreen: String) async {
        state.geoState = .loading
        let result = await api.geolocate()
        state.geoState = UiState.from(result, fallbackMessage: "Could not detect location")
        if case .success(let geo) = result, let location = geo.location {
            prefs.setDouble(location.lat, .latitude)
            prefs.setDouble(location.lng, .longitude)
        }
    }

    /// Posts the resolved fallback coordinates to endpoint #11 so a guest with no resolvable
    /// location still gets a home feed. Best-effort — a failure just leaves the feed empty,
    /// which is the pre-existing behaviour, so it never blocks onboarding.
    ///
    /// The coordinates are the host's explicit config override, else the DEVICE LOCALE's country
    /// centroid — the app's own fallback. There is NO hardcoded city: a previous build defaulted
    /// to Bengaluru, so every guest the backend could not place was told about Karnataka.
    private func seedDefaultLocation() async {
        guard let userId = env.session.userId else { return }
        let fallback = config.resolvedFallbackCoordinates
        // Nothing resolved — not the host's config, not the device locale. Send nothing rather
        // than guess: an unplaceable guest gets an empty feed, which is honest, where a guessed
        // city (or (0,0), a real point in the Gulf of Guinea) would silently give them another
        // country's advice.
        guard CountryLatLngProvider.isResolved(lat: fallback.lat, lng: fallback.lng) else { return }
        let result = await api.updateUserLocation(
            UpdateLocationRequest(
                userId: userId,
                lat: fallback.lat,
                long: fallback.lng
            )
        )
        // NOTE: the live #11 response nests everything under `user_profile`, which
        // `GetLocationResponse` does not model (it exposes only the flat `country`/`state`
        // fields). Persisting is best-effort — what actually matters here is that the CALL
        // sets the location server-side, which is what unblocks the #12 feed. Tracked in
        // docs/04 as a model gap.
        if case .success(let response) = result {
            if let code = response.country?.nonBlank {
                prefs.setString(code, .userCountryCode)
            }
            if let state = response.state?.nonBlank {
                prefs.setString(state, .userState)
            }
        }
    }

    private func fetchSupportedLanguages(countryCode: String?, state regionState: String?) async {
        state.languageState = .loading
        let result = await api.countryWiseSupportedLanguages(countryCode: countryCode, state: regionState)
        switch result {
        case .success(let groups):
            state.languageState = .success(groups)
            // Preselect: previously chosen, else config languageCode.
            let storedId = prefs.int(.selectedLanguageId)
            let preselectCode = prefs.string(.selectedLanguageCode)
            let all = groups.flatMap { ($0.priorityView ?? []) + ($0.expandedView ?? []) }
            if storedId != 0, all.contains(where: { $0.id == storedId }) {
                state.selectedLanguageId = storedId
                state.languageCode = all.first { $0.id == storedId }?.code
            } else if let code = preselectCode, let match = all.first(where: { $0.code == code }) {
                state.selectedLanguageId = match.id
                state.languageCode = match.code
            }
        case .error(let error):
            state.languageState = .error(
                message: error.message ?? labels.label("error_generic", fallback: "Something went wrong. Please try again."),
                code: error.code,
                isNetworkError: error.isNetworkError
            )
        }
    }

    // MARK: - Selection (debounced label fetch, like the app)

    private func selectLanguage(_ languageId: Int) {
        state.selectedLanguageId = languageId
        let all = state.visibleLanguages()
        state.languageCode = all.first { $0.id == languageId }?.code
        env.analytics.track(AnalyticsEvents.languageSelected, props: ["language_id": String(languageId)])

        selectDebounce?.cancel()
        selectDebounce = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            await self?.fetchLabels(languageId: languageId)
        }
    }

    private func fetchLabels(languageId: Int) async {
        state.isFetchingLabels = true
        state.fetchingLabelsForId = languageId
        defer {
            state.isFetchingLabels = false
            state.fetchingLabelsForId = nil
        }
        let result = await api.getLabels(languageId: languageId)
        if case .success(let map) = result {
            // Persist the language code *before* updating labels so lookups
            // resolve against the new language.
            if let code = state.languageCode {
                prefs.setString(code, .selectedLanguageCode)
            }
            labels.update(labels: map)
            state.labelsRefreshToken += 1
        }
    }

    private func applyLanguageFromModal(languageId: Int, languageCode: String) async {
        state.isApplyingLanguageFromModal = true
        defer { state.isApplyingLanguageFromModal = false }
        state.selectedLanguageId = languageId
        state.languageCode = languageCode
        prefs.setString(languageCode, .selectedLanguageCode)
        await fetchLabels(languageId: languageId)
    }

    // MARK: - Legal

    private func fetchLegalLinks() async {
        let result = await api.privacyPolicy()
        if case .success(let response) = result {
            state.privacyPolicyUrl = response.privacyPolicy
            state.termsOfUseUrl = response.termsOfUse
        }
    }

    private func acceptTerms() async {
        guard let userId = env.session.userId else { return }
        _ = await api.acceptTerms(AcceptPPandTCRequest(userId: userId))
        prefs.setBool(true, .termsAccepted)
    }

    // MARK: - Submit ("Start using FarmerChat")

    private func submitLanguage() async {
        guard let languageId = state.selectedLanguageId, !state.isSubmittingLanguage else { return }
        guard let userId = env.session.userId else {
            state.submitErrorMessage = labels.label("error_generic", fallback: "Something went wrong. Please try again.")
            return
        }
        state.isSubmittingLanguage = true
        defer { state.isSubmittingLanguage = false }

        let result = await api.setPreferredLanguage(SetPreferredLanguageRequest(userId: userId, languageId: languageId))
        switch result {
        case .success:
            prefs.setInt(languageId, .selectedLanguageId)
            if let code = state.languageCode {
                prefs.setString(code, .selectedLanguageCode)
            }
            if case .success(let groups) = state.languageState {
                let all = groups.flatMap { ($0.priorityView ?? []) + ($0.expandedView ?? []) }
                if let display = all.first(where: { $0.id == languageId })?.displayName {
                    prefs.setString(display, .selectedLanguageDisplayName)
                }
            }
            prefs.setBool(true, .languageDone)
            env.analytics.track(AnalyticsEvents.languageSubmitted, props: ["language_id": String(languageId)])
            state.languageSubmitSuccess = true
        case .error(let error):
            if error.isNetworkError {
                state.shouldNavigateToError = true
                state.errorIsNetworkError = true
                state.errorFromScreen = "language"
            } else {
                state.submitErrorMessage = error.message
                    ?? labels.label("error_generic", fallback: "Something went wrong. Please try again.")
            }
        }
    }
}
