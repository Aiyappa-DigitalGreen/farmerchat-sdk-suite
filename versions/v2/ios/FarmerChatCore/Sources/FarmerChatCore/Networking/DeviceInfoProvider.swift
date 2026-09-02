import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// Builds the `Device-Info` header: URL-encoded JSON device configuration —
/// the iOS analogue of the app's `AuthHeaderInterceptor` payload.
struct DeviceInfoProvider: Sendable {
    let deviceId: String

    init(deviceId: String) {
        self.deviceId = deviceId
    }

    func deviceConfigJSON() -> [String: String] {
        var info: [String: String] = [
            "platform": "ios",
            "sdk_name": "farmerchat-ios",
            "sdk_version": FarmerChatSDK.version,
            "device_id": deviceId,
            "locale": Locale.current.identifier,
            "timezone": TimeZone.current.identifier
        ]
        #if canImport(UIKit) && !os(watchOS)
        // UIDevice must be touched on the main thread only for battery-type
        // APIs; these static accessors are thread-safe.
        info["device_model"] = Self.hardwareModel()
        info["os_version"] = ProcessInfo.processInfo.operatingSystemVersionString
        #else
        info["device_model"] = "unknown"
        info["os_version"] = ProcessInfo.processInfo.operatingSystemVersionString
        #endif
        if let hostVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String {
            info["app_version"] = hostVersion
        }
        if let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String {
            info["app_build"] = build
        }
        return info
    }

    /// URL-encoded JSON string for the `Device-Info` header.
    func deviceInfoHeaderValue() -> String {
        let json = deviceConfigJSON()
        guard let data = try? JSONSerialization.data(withJSONObject: json, options: [.sortedKeys]),
              let string = String(data: data, encoding: .utf8) else {
            return ""
        }
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return string.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
    }

    static func hardwareModel() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let mirror = Mirror(reflecting: systemInfo.machine)
        let identifier = mirror.children.reduce(into: "") { result, element in
            guard let value = element.value as? Int8, value != 0 else { return }
            result.append(Character(UnicodeScalar(UInt8(value))))
        }
        return identifier.isEmpty ? "unknown" : identifier
    }
}

public enum FarmerChatSDK {
    public static let version = "1.0.0"
    public static let buildVersionHeader = "v2"
}
