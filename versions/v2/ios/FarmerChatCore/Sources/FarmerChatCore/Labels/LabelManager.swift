import Foundation

/// Server-driven i18n labels (endpoint #3), matching the app's `LabelManager`:
/// resolves `${baseKey}_${langCode}` → `${baseKey}_en` → English fallback →
/// raw key, with `{name}` / `{{name}}` template substitution.
/// All SDK user-visible strings resolve through this type.
public final class LabelManager: @unchecked Sendable {
    private let prefs: PreferenceStore
    private let lock = NSLock()
    private var labels: [String: String] = [:]
    /// C5 host overrides (highest precedence) + forced locale.
    private var hostOverrides: [String: String] = [:]
    private var forcedLocale: String?

    public init(prefs: PreferenceStore) {
        self.prefs = prefs
        loadPersisted()
    }

    /// Applies `FarmerChatConfig.stringOverrides` and `locale` (docs/07 C5).
    public func configure(overrides: [String: String], forcedLocale: String?) {
        lock.lock()
        hostOverrides = overrides
        self.forcedLocale = forcedLocale
        lock.unlock()
    }

    // MARK: - Loading / persistence

    public func loadPersisted() {
        guard let json = prefs.string(.languageLabelsJson),
              let data = json.data(using: .utf8),
              let map = try? JSONDecoder().decode([String: String].self, from: data) else {
            return
        }
        lock.lock()
        labels = map
        lock.unlock()
    }

    public func update(labels newLabels: [String: String]) {
        lock.lock()
        labels = newLabels
        lock.unlock()
        if let data = try? JSONEncoder().encode(newLabels),
           let json = String(data: data, encoding: .utf8) {
            prefs.setString(json, .languageLabelsJson)
            prefs.setBool(true, .languageLabelsLoaded)
        }
    }

    public var hasServerLabels: Bool {
        lock.lock()
        defer { lock.unlock() }
        return !labels.isEmpty
    }

    public var languageCode: String {
        lock.lock(); let forced = forcedLocale; lock.unlock()
        // App parity (LabelManager.kt): normalize before building `${key}_${lang}`
        // so a code like "EN" / " hi " still resolves its localized keys.
        let code = forced ?? prefs.string(.selectedLanguageCode) ?? "en"
        let normalized = code.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return normalized.isEmpty ? "en" : normalized
    }

    // MARK: - Resolution

    /// `getLabel(baseKey, englishFallback, params?)`. Resolution order (C5):
    /// host override → server `${key}_${lang}` → server `${key}_en` →
    /// English fallback → raw key.
    public func label(_ baseKey: String, fallback: String, params: [String: String] = [:]) -> String {
        lock.lock()
        let map = labels
        let overrides = hostOverrides
        lock.unlock()
        let lang = languageCode
        let raw = overrides[baseKey]
            ?? map["\(baseKey)_\(lang)"]
            ?? map["\(baseKey)_en"]
            ?? fallback
        let resolved = raw.isEmpty ? baseKey : raw
        return Self.applyTemplate(resolved, params: params)
    }

    // MARK: - Answer-generation tips

    /// The tip cards shown while an answer is generated. Port of the app's
    /// `ui/chat/component/ChatLoadingContent.kt answerGenerationTips()` (fc-compose-agentic
    /// dev/v2.5, :103-162), the same rule the Android core and react-native `labelManager.ts` use:
    ///
    /// - every served label key `fc_v2_app_label_tips_<name>_title_<lang>` names a tip; names are
    ///   de-duplicated and sorted;
    /// - its title is `…_<name>_title_<lang>` then `…_title_en`, its body
    ///   `…_<name>_statement_<lang>` then `…_statement_en`; a tip missing either side is dropped;
    /// - when no server tip resolves, the app's three built-in tips, through ``label(_:fallback:params:)``.
    ///
    /// Reads the raw server map, as the app does (host overrides only reach the fallback trio).
    /// Never empty. The caller shuffles, as `Tips.kt` does per show.
    public func answerGenerationTips() -> [AnswerGenerationTip] {
        lock.lock()
        let map = labels
        lock.unlock()
        let lang = languageCode
        let names = Set(map.keys.compactMap(Self.tipName(fromTitleKey:))).sorted()
        let dynamic: [AnswerGenerationTip] = names.compactMap { name in
            let titleBase = "\(Self.tipsPrefix)\(name)_title"
            let statementBase = "\(Self.tipsPrefix)\(name)_statement"
            guard let title = map["\(titleBase)_\(lang)"] ?? map["\(titleBase)_en"],
                  let body = map["\(statementBase)_\(lang)"] ?? map["\(statementBase)_en"] else { return nil }
            return AnswerGenerationTip(title: title, body: body)
        }
        if !dynamic.isEmpty { return dynamic }
        return [
            AnswerGenerationTip(
                title: label(FCLabels.didYouKnow, fallback: "Did you know?"),
                body: label(FCLabels.youCanAskFollowupQuestionsToGetMoreDetails, fallback: "You can ask follow-up questions to get more details")
            ),
            AnswerGenerationTip(
                title: label(FCLabels.quickTip, fallback: "Quick tip"),
                body: label(FCLabels.tipsAskSpecificCrops, fallback: "Try asking about specific crops or problems")
            ),
            AnswerGenerationTip(
                title: label(FCLabels.tryThis, fallback: "Try this"),
                body: label(FCLabels.uploadPhotosForPlantDiseaseIdentification, fallback: "Upload photos for plant disease identification")
            )
        ]
    }

    private static let tipsPrefix = "fc_v2_app_label_tips_"

    /// `^fc_v2_app_label_tips_(.+)_title_([a-z]{2,3})$` → the `(.+)` group, else nil.
    static func tipName(fromTitleKey key: String) -> String? {
        guard key.hasPrefix(tipsPrefix) else { return nil }
        let rest = key.dropFirst(tipsPrefix.count)
        // The language suffix: the text after the LAST "_" — 2-3 lowercase ASCII letters.
        guard let underscore = rest.lastIndex(of: "_") else { return nil }
        let lang = rest[rest.index(after: underscore)...]
        guard (2...3).contains(lang.count), lang.allSatisfy({ ("a"..."z").contains($0) }) else { return nil }
        let head = rest[..<underscore]
        let marker = "_title"
        guard head.hasSuffix(marker) else { return nil }
        let name = head.dropLast(marker.count)
        return name.isEmpty ? nil : String(name)
    }

    /// `{name}` and `{{name}}` substitution.
    public static func applyTemplate(_ text: String, params: [String: String]) -> String {
        guard !params.isEmpty else { return text }
        var result = text
        for (key, value) in params {
            result = result.replacingOccurrences(of: "{{\(key)}}", with: value)
            result = result.replacingOccurrences(of: "{\(key)}", with: value)
        }
        return result
    }
}

/// One answer-generation tip card (app `components/Tip.kt` `TipData`).
public struct AnswerGenerationTip: Sendable, Equatable {
    public let title: String
    public let body: String

    public init(title: String, body: String) {
        self.title = title
        self.body = body
    }
}
