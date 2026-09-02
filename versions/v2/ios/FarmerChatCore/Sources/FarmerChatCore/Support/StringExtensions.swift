import Foundation

extension String {
    /// `self` when it contains at least one non-whitespace character, otherwise `nil`.
    ///
    /// Used for API query params the backend rejects when blank — notably endpoint #2's
    /// `country_code`, which returns HTTP 400 `{"error": "Country code is required"}` for `""`.
    /// A plain `??` chain only catches `nil`, so an empty persisted preference would still
    /// reach the wire; `nonBlank` collapses both cases.
    var nonBlank: String? {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : self
    }
}
