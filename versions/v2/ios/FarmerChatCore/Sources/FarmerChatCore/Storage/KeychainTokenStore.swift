import Foundation
import Security

/// Token persistence backed by the iOS Keychain.
/// Key names mirror the app's `TokenStore`; `clear()` removes only tokens,
/// never the device id (parity with the Android store).
final class KeychainTokenStore: @unchecked Sendable {

    enum Key: String {
        case accessToken = "farmer_chat_app_access_token"
        case refreshToken = "farmer_chat_app_refresh_token"
        case userId = "logged_user_id_key"
        case deviceId = "your_android_device_id" // kept verbatim for cross-platform key parity
    }

    private let service = "org.digitalgreen.farmerchat.sdk"
    private let lock = NSLock()

    public init() {}

    // MARK: - Public accessors

    public var accessToken: String? {
        get { read(.accessToken) }
        set { write(.accessToken, value: newValue) }
    }

    public var refreshToken: String? {
        get { read(.refreshToken) }
        set { write(.refreshToken, value: newValue) }
    }

    public var userId: String? {
        get { read(.userId) }
        set { write(.userId, value: newValue) }
    }

    /// Stable per-install device identifier (created on first read).
    public var deviceId: String {
        lock.lock()
        defer { lock.unlock() }
        if let existing = readUnlocked(.deviceId) { return existing }
        let generated = UUID().uuidString.lowercased()
        writeUnlocked(.deviceId, value: generated)
        return generated
    }

    public func saveTokens(access: String?, refresh: String?) {
        if let access { accessToken = access }
        if let refresh { refreshToken = refresh }
    }

    /// Removes only tokens (access/refresh/userId), preserving the device id.
    public func clear() {
        write(.accessToken, value: nil)
        write(.refreshToken, value: nil)
        write(.userId, value: nil)
    }

    // MARK: - Keychain plumbing

    private func read(_ key: Key) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return readUnlocked(key)
    }

    private func write(_ key: Key, value: String?) {
        lock.lock()
        defer { lock.unlock() }
        writeUnlocked(key, value: value)
    }

    private func baseQuery(_ key: Key) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue
        ]
    }

    private func readUnlocked(_ key: Key) -> String? {
        var query = baseQuery(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func writeUnlocked(_ key: Key, value: String?) {
        let query = baseQuery(key)
        guard let value else {
            SecItemDelete(query as CFDictionary)
            return
        }
        let data = Data(value.utf8)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData as String] = data
            addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(addQuery as CFDictionary, nil)
        }
    }
}
