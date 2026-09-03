import XCTest
@testable import FarmerChatCore

/// Guards the device-locale location fallback. Swift counterpart of Android's
/// `CountryLatLngProviderTest`.
///
/// Background: this SDK used to hardcode Bengaluru (12.9716, 77.5946) as the fallback location, so
/// every guest the backend could not place — anywhere on earth — was seeded with Karnataka and got
/// Karnataka's advice. The app never did that: it derives the country from the device locale and
/// uses that country's centroid, accepting it only when both parts are non-zero.
///
/// The centroid table is generated verbatim from the app's `utils/CountryLatLngProvider.kt`; a
/// wrong entry fails silently, so the count and a few spot values are asserted here.
final class CountryLatLngProviderTests: XCTestCase {

    func testAKnownCountryReturnsItsExactCentroid() {
        assertLatLng(CountryLatLngProvider.getLatLng("KE"), -0.023559, 37.906193)
        assertLatLng(CountryLatLngProvider.getLatLng("IN"), 20.593684, 78.96288)
        assertLatLng(CountryLatLngProvider.getLatLng("NG"), 9.081999, 8.675277)
    }

    func testAnUnknownOrBlankCountryReturnsZeroNotAGuess() {
        // The critical one: nothing may silently stand in for an unresolved country.
        assertLatLng(CountryLatLngProvider.getLatLng("ZZ"), 0.0, 0.0)
        assertLatLng(CountryLatLngProvider.getLatLng(""), 0.0, 0.0)
        assertLatLng(CountryLatLngProvider.getLatLng("in"), 0.0, 0.0)  // case-sensitive, as the app
    }

    func testZeroCoordinatesAreNeverTreatedAsResolved() {
        // (0,0) is a real point in the Gulf of Guinea; sending it would be a wrong answer, not a
        // missing one. isResolved is what stops that.
        XCTAssertFalse(CountryLatLngProvider.isResolved(lat: 0.0, lng: 0.0))
        XCTAssertFalse(CountryLatLngProvider.isResolved(lat: 0.0, lng: 37.9))
        XCTAssertFalse(CountryLatLngProvider.isResolved(lat: -0.02, lng: 0.0))
        XCTAssertTrue(CountryLatLngProvider.isResolved(lat: -0.023559, lng: 37.906193))
    }

    func testBengaluruIsNotTheFallbackForAnything() {
        // The exact regression: no country's centroid may be the old hardcoded default.
        for code in ["IN", "KE", "ZZ", "", "US", "NG"] {
            let hit = CountryLatLngProvider.getLatLng(code)
            XCTAssertFalse(hit.lat == 12.9716 && hit.lng == 77.5946, "\(code) resolved to Bengaluru")
        }
    }

    func testTheTableMatchesTheAppsEntryCount() {
        // Ported verbatim from the app: 247 entries. A drift here means the port was edited by
        // hand instead of regenerated. Swift dictionary literals also trap at RUNTIME on a
        // duplicate key rather than failing to compile, so this assertion earns its place.
        XCTAssertEqual(247, CountryLatLngProvider.entryCount)
    }

    // MARK: - The config defaults that make the derive path reachable at all

    func testAnUnconfiguredConfigLeavesLocationUnsetSoTheLocaleIsUsed() {
        // If these carried a hardcoded region the whole fallback would be dead code: the config
        // override wins over the locale, so a non-empty default silently disables derivation.
        let config = FarmerChatConfig(environment: .prod)
        XCTAssertEqual("", config.defaultCountryCode)
        XCTAssertEqual("", config.defaultStateCode)
        XCTAssertEqual(FarmerChatConfig.coordinateUnset, config.defaultLatitude)
        XCTAssertEqual(FarmerChatConfig.coordinateUnset, config.defaultLongitude)
        XCTAssertFalse(
            CountryLatLngProvider.isResolved(lat: config.defaultLatitude, lng: config.defaultLongitude)
        )
    }

    func testAnExplicitHostOverrideStillWins() {
        let config = FarmerChatConfig(
            environment: .prod,
            defaultCountryCode: "NG",
            defaultLatitude: 9.081999,
            defaultLongitude: 8.675277
        )
        XCTAssertEqual("NG", config.defaultCountryCode)
        XCTAssertEqual("NG", config.resolvedFallbackCountryCode)
        assertLatLng(config.resolvedFallbackCoordinates, 9.081999, 8.675277)
    }

    func testTheResolvedCountryIsNeverBlankBecauseEndpoint2Rejectsit() {
        // Endpoint #2 400s on a blank `country_code` ({"error": "Country code is required"},
        // verified live 2026-09-03), so the chain must always terminate in something non-blank —
        // the device locale's region, else the "KE" last resort.
        let resolved = FarmerChatConfig(environment: .prod).resolvedFallbackCountryCode
        XCTAssertFalse(resolved.isEmpty)
        let locale = CountryLatLngProvider.fromDeviceLocale().countryCode
        XCTAssertEqual(locale.isEmpty ? FarmerChatConfig.lastResortCountryCode : locale, resolved)
    }

    func testFromDeviceLocaleAgreesWithItsOwnResolvedness() {
        // Machine-independent invariant only: asserting a specific region would be flaky across
        // dev machines and CI. What matters is that the pair and the guard cannot disagree.
        let derived = CountryLatLngProvider.fromDeviceLocale()
        let expected = CountryLatLngProvider.getLatLng(derived.countryCode)
        assertLatLng((derived.lat, derived.lng), expected.lat, expected.lng)
        if derived.countryCode.isEmpty {
            XCTAssertFalse(CountryLatLngProvider.isResolved(lat: derived.lat, lng: derived.lng))
        }
    }

    private func assertLatLng(
        _ actual: (lat: Double, lng: Double),
        _ lat: Double,
        _ lng: Double,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertEqual(actual.lat, lat, accuracy: 1e-9, file: file, line: line)
        XCTAssertEqual(actual.lng, lng, accuracy: 1e-9, file: file, line: line)
    }
}
