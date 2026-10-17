import Foundation

/// The app's country farmer illustrations (`utils/CountryImageAssets.kt`), shown by the
/// full-screen message screens (Sign up, You're all set, No internet / error, the location
/// interstitial). Bundled as Core resources — the same webp files the Android SDK ships.
public enum FCFarmerIllustration: String, CaseIterable, Sendable {
    case lookingAtCamera = "farmer_looking_at_camera"
    case lookingAtPhone = "farmer_looking_at_phone"
    case lookingAtPhoneSquare = "farmer_looking_at_phone_square"
    case lookingAtSky = "farmer_looking_at_sky"

    /// CountryImageAssets.kt: ke / et / ng / in, anything else (or blank) → ke.
    static let supportedCountries: Set<String> = ["ke", "et", "ng", "in"]

    static func folder(for countryCode: String?) -> String {
        let code = (countryCode ?? "").trimmingCharacters(in: .whitespaces).lowercased()
        return supportedCountries.contains(code) ? code : "ke"
    }

    /// The file for the farmer's country (`USER_COUNTRY_CODE`), or nil when the resource bundle
    /// is not present (a binary build that did not carry it) — callers then draw a fallback.
    public func url(countryCode: String?) -> URL? {
        guard let root = Self.resourceRoot else { return nil }
        let file = root
            .appendingPathComponent(Self.folder(for: countryCode))
            .appendingPathComponent(rawValue + ".webp")
        return FileManager.default.fileExists(atPath: file.path) ? file : nil
    }

    /// For the current farmer, from prefs.
    public func url(prefs: PreferenceStore) -> URL? {
        url(countryCode: prefs.string(.userCountryCode))
    }

    // MARK: - Resource lookup

    private final class BundleToken {}

    /// Locates `FarmerIllustrations/` without `Bundle.module`, whose generated accessor traps
    /// when the resource bundle is missing. Looks for SwiftPM's `FarmerChatCore_FarmerChatCore`
    /// bundle next to the app, the framework and the test bundle, then for the folder itself.
    static let resourceRoot: URL? = {
        let bundleName = "FarmerChatCore_FarmerChatCore.bundle"
        let owner = Bundle(for: BundleToken.self)
        var candidates: [URL] = []
        for base in [Bundle.main.resourceURL, owner.resourceURL, owner.bundleURL.deletingLastPathComponent(), Bundle.main.bundleURL] {
            guard let base else { continue }
            candidates.append(base.appendingPathComponent(bundleName))
            candidates.append(base.appendingPathComponent(bundleName).appendingPathComponent("Contents/Resources"))
            candidates.append(base)
        }
        for candidate in candidates {
            let folder = candidate.appendingPathComponent("FarmerIllustrations")
            var isDir: ObjCBool = false
            if FileManager.default.fileExists(atPath: folder.path, isDirectory: &isDir), isDir.boolValue {
                return folder
            }
        }
        return nil
    }()
}
