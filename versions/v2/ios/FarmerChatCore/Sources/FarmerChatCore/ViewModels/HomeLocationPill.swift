import Foundation

/// The Home location pill's states (app `components/buttons/LocationButton.kt`, Figma "Location
/// 2.0"). One pill carries the whole acquisition lifecycle.
public enum FCLocationPillState: Equatable, Sendable {
    /// "Set your location" — nothing known yet (pill at 72% fill).
    case invite
    /// "Getting your location" — the pill's own flow is acquiring a fix.
    case searching
    /// "Location found" — held ~1.5 s after the pill's flow succeeds.
    case success
    /// "<place> - Change".
    case located
    /// "Allow location in Settings" — permission denied twice and still not granted.
    case blocked

    /// App HomeScreen.kt `HomeLocationPill` precedence: blocked › searching › success › located ›
    /// invite. `located` needs a stored fix WITH a live permission, or any known place name.
    public static func resolve(
        isBlocked: Bool,
        isSearching: Bool,
        showSuccess: Bool,
        hasStoredFix: Bool,
        hasPermission: Bool,
        placeName: String
    ) -> FCLocationPillState {
        if isBlocked { return .blocked }
        if isSearching { return .searching }
        if showSuccess { return .success }
        if (hasStoredFix && hasPermission) || !placeName.trimmingCharacters(in: .whitespaces).isEmpty {
            return .located
        }
        return .invite
    }

    /// App: the spinner shows only once acquisition has started for the PILL's own flow
    /// (`RequestEnableGps` / `FetchingLocation` with `source == LocalContext`) — never while the
    /// system permission dialog is still up, and never for a weather or campaign flow.
    public static func isSearching(state: LocationPromptState, source: LocationPromptSource) -> Bool {
        guard source == .localContext else { return false }
        switch state {
        case .requestEnableGps, .fetchingLocation: return true
        default: return false
        }
    }

    /// The pill's own flow is running (any non-terminal LocalContext state) — used to detect the
    /// flow's successful end, which shows `success` briefly.
    public static func isFlowActive(state: LocationPromptState, source: LocationPromptSource) -> Bool {
        guard source == .localContext else { return false }
        switch state {
        case .interstitial, .requestPermission, .requestEnableGps, .fetchingLocation, .recovery: return true
        default: return false
        }
    }
}
