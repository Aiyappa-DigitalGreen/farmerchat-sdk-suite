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
