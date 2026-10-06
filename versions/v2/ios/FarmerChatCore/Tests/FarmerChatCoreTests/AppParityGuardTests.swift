import XCTest
@testable import FarmerChatCore

/// Pins the app-parity fixes made to the iOS UI.
///
/// ## Why these live in FarmerChatCore
///
/// The fixes are in `FarmerChatSwiftUI`, which is an **iOS-only** package — `swift test` targets
/// macOS and cannot compile it (see root CLAUDE.md §5). So these read the SwiftUI sources off
/// disk and assert on their text. That is the same approach the Android guards take, and for the
/// same reason: every defect that was found on this platform was a source value, not a rendering
/// difference we could reach from a test.
///
/// ## What they guard
///
/// iOS passed **39 label keys that exist in no catalogue**, so `getLabel` fell through to the
/// English fallback on every lookup, in every language. That is invisible unless the UI is
/// exercised in a non-English language — nothing in CI caught it, and it survived a full port
/// plus several fidelity passes. Six were mapped onto existing `FCLabels` constants; this stops
/// them regressing and stops new bare-string keys appearing.
final class AppParityGuardTests: XCTestCase {

    /// Repo-relative path resolution from this file, so the test does not depend on the working
    /// directory the runner happens to use.
    private func swiftUISource(_ relative: String) throws -> String {
        let here = URL(fileURLWithPath: #filePath)
        let iosRoot = here
            .deletingLastPathComponent()   // FarmerChatCoreTests
            .deletingLastPathComponent()   // Tests
            .deletingLastPathComponent()   // FarmerChatCore
            .deletingLastPathComponent()   // ios  <- FarmerChatSwiftUI is a SIBLING package
        let file = iosRoot
            .appendingPathComponent("FarmerChatSwiftUI/Sources/FarmerChatSwiftUI")
            .appendingPathComponent(relative)
        return try String(contentsOf: file, encoding: .utf8)
    }

    // MARK: - label keys

    /// `type_placeholder` is in no catalogue. `FCLabels.askAboutYourFarm`
    /// (`fc_v2_app_label_ask_about_your_farm`) already existed at `Labels.swift:42` and is served
    /// — it simply was not used here.
    func testComposerPlaceholderUsesTheServedConstant() throws {
        for screen in ["Screens/ChatView.swift", "Screens/HomeView.swift"] {
            let src = try swiftUISource(screen)
            XCTAssertTrue(
                src.contains("FCLabels.askAboutYourFarm"),
                "\(screen): the composer placeholder must use the served constant"
            )
            XCTAssertFalse(
                src.contains("fcLabel(\"type_placeholder\""),
                "\(screen): `type_placeholder` exists in no catalogue — it always rendered English"
            )
        }
    }

    /// App parity: the phone field's placeholder is the literal digit mask.
    /// `phone_placeholder` was never a served key.
    func testPhoneFieldUsesTheLiteralDigitMask() throws {
        let src = try swiftUISource("Screens/AuthView.swift")
        XCTAssertTrue(src.contains("\"00000 00000\""), "phone placeholder is the digit mask")
        XCTAssertFalse(
            src.contains("fcLabel(\"phone_placeholder\""),
            "`phone_placeholder` is in no catalogue"
        )
    }

    /// Every key endpoint #3 serves is `fc_v2_*`-prefixed — 287 entries on DEV, zero short keys —
    /// so a bare short string cannot resolve by construction.
    ///
    /// This is a **ratchet**, and the bound is MEASURED, not chosen: these five screens hold
    /// exactly 18 bare keys today. (An earlier version of this test guessed 12 and failed —
    /// the number came from running it, which is the only way to set a baseline honestly.)
    ///
    /// 39 bare keys existed across the whole flavour; 6 were mapped onto served constants. The
    /// rest are strings the backend has no entry for — a content gap, not a code bug. Lowering
    /// this bound as more get mapped is the point; raising it means a new invented key was
    /// accepted.
    func testBareLabelKeyCountDoesNotGrow() throws {
        let files = [
            "Screens/AuthView.swift", "Screens/ChatView.swift", "Screens/HomeView.swift",
            "Screens/SettingsViews.swift", "Screens/EnterNameView.swift",
        ]
        var bare = Set<String>()
        for f in files {
            let src = try swiftUISource(f)
            for match in src.matchingGroups(#"fcLabel\(\s*"([a-zA-Z0-9_.]+)""#) {
                if !match.hasPrefix("fc_v2_") { bare.insert(match) }
            }
        }
        XCTAssertLessThanOrEqual(
            bare.count, 18,
            """
            \(bare.count) bare label keys in these screens: \(bare.sorted().joined(separator: ", ")).
            A bare key resolves to nothing and renders the English fallback in every language.
            Use the matching FCLabels constant, or confirm the backend serves no such string.
            """
        )
    }

    // MARK: - the catalogue itself

    /// `FCLabels` is the healthy half of the iOS story: 255 of its 262 constants resolve against
    /// the served map. This pins the constant the composer fix depends on.
    func testAskAboutYourFarmConstantIsTheServedKey() {
        XCTAssertEqual(FCLabels.askAboutYourFarm, "fc_v2_app_label_ask_about_your_farm")
    }
}

private extension String {
    /// First capture group of every match — enough for the key scan above, and avoids pulling in
    /// a regex dependency.
    func matchingGroups(_ pattern: String) -> [String] {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return [] }
        let ns = self as NSString
        return re.matches(in: self, range: NSRange(location: 0, length: ns.length)).compactMap {
            $0.numberOfRanges > 1 ? ns.substring(with: $0.range(at: 1)) : nil
        }
    }
}
