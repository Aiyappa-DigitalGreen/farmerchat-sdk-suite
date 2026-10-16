import Foundation
import ImageIO
import CoreLocation
import UniformTypeIdentifiers

/// A photo prepared for upload, the way the app's `ImageUtils.addGpsToImageAndConvertToBase64`
/// prepares it (fc-compose-agentic `utils/ImageUtils.kt:47-300`).
public struct EncodedPhoto: Sendable, Equatable {
    /// The re-encoded JPEG (with the GPS EXIF when a location was available).
    public let data: Data
    public var base64: String { data.base64EncodedString() }
    /// The location written into the EXIF — the photo's own, else the device's — or nil.
    public let latitude: Double?
    public let longitude: Double?
    public let pixelWidth: Int
    public let pixelHeight: Int
}

/// Port of `ImageUtils` for every photo send (composer camera / gallery and the UPLOAD_PHOTO
/// chips, both flavours):
/// 1. read GPS from the photo's own EXIF (`readGpsFromImage`);
/// 2. else the CURRENT location, only if location permission is already granted — never a new
///    prompt (`fetchCurrentLocation`, 5 s timeout);
/// 3. scale down (never up) to fit 1000×1000, aspect kept (`resizeBitmap`);
/// 4. JPEG at quality 80 (`compressBitmapToBase64`);
/// 5. write GPS latitude / longitude + N/S / E/W refs into the EXIF when a location exists, the
///    value truncated as the app's `convertToExifFormat` does (whole degrees, whole minutes,
///    seconds to 1/1000).
///
/// One deliberate difference: the EXIF orientation is applied while scaling (Android's
/// `BitmapFactory` drops it, so the app uploads a portrait photo sideways). Recorded in the report.
public enum PhotoUploadEncoder {
    public static let maxDimension = 1000
    public static let jpegQuality: CGFloat = 0.8

    /// GPS from the image's own metadata, as signed decimal degrees.
    public static func readGPS(from data: Data) -> (latitude: Double, longitude: Double)? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let gps = props[kCGImagePropertyGPSDictionary] as? [CFString: Any],
              let lat = (gps[kCGImagePropertyGPSLatitude] as? NSNumber)?.doubleValue,
              let lon = (gps[kCGImagePropertyGPSLongitude] as? NSNumber)?.doubleValue else { return nil }
        let latRef = (gps[kCGImagePropertyGPSLatitudeRef] as? String) ?? "N"
        let lonRef = (gps[kCGImagePropertyGPSLongitudeRef] as? String) ?? "E"
        return (latRef.uppercased() == "S" ? -lat : lat, lonRef.uppercased() == "W" ? -lon : lon)
    }

    /// `convertToExifFormat`: |value| as D/1, M/1, S·1000/1000 with each part truncated; returned
    /// as the decimal ImageIO writes back into those rationals.
    public static func exifDegrees(_ value: Double) -> Double {
        let absValue = abs(value)
        let degrees = Double(Int(absValue))
        let minutes = Double(Int((absValue - degrees) * 60))
        let seconds = Double(Int((absValue - degrees - minutes / 60.0) * 3600 * 1000)) / 1000
        return degrees + minutes / 60.0 + seconds / 3600.0
    }

    /// The fitted size: unchanged when it already fits, else scaled by the smaller ratio with the
    /// app's truncation (`(originalWidth * scale).toInt()`).
    public static func fittedSize(width: Int, height: Int, max: Int = maxDimension) -> (width: Int, height: Int) {
        guard width > max || height > max else { return (width, height) }
        // Kotlin `Float` arithmetic, as `resizeBitmap` does it.
        let scale = Swift.min(Float(max) / Float(width), Float(max) / Float(height))
        return (Int(Float(width) * scale), Int(Float(height) * scale))
    }

    /// Steps 1 and 3-5. `fallbackLocation` is used only when the photo carries no GPS.
    public static func encode(_ data: Data, fallbackLocation: (latitude: Double, longitude: Double)?) -> EncodedPhoto? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] else { return nil }
        let location = readGPS(from: data) ?? fallbackLocation

        // Oriented pixel size, so the 1000 box applies to the image as displayed.
        var width = (props[kCGImagePropertyPixelWidth] as? NSNumber)?.intValue ?? 0
        var height = (props[kCGImagePropertyPixelHeight] as? NSNumber)?.intValue ?? 0
        let orientation = (props[kCGImagePropertyOrientation] as? NSNumber)?.intValue ?? 1
        if orientation >= 5 { swap(&width, &height) }
        guard width > 0, height > 0 else { return nil }
        let target = fittedSize(width: width, height: height)
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: Swift.max(target.width, target.height)
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }

        let out = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        var properties: [CFString: Any] = [kCGImageDestinationLossyCompressionQuality: jpegQuality]
        if let location {
            properties[kCGImagePropertyGPSDictionary] = [
                kCGImagePropertyGPSLatitude: exifDegrees(location.latitude),
                kCGImagePropertyGPSLatitudeRef: location.latitude >= 0 ? "N" : "S",
                kCGImagePropertyGPSLongitude: exifDegrees(location.longitude),
                kCGImagePropertyGPSLongitudeRef: location.longitude >= 0 ? "E" : "W"
            ] as [CFString: Any]
        }
        CGImageDestinationAddImage(destination, image, properties as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { return nil }
        return EncodedPhoto(
            data: out as Data,
            latitude: location?.latitude,
            longitude: location?.longitude,
            pixelWidth: image.width,
            pixelHeight: image.height
        )
    }

    /// Step 2: the device's current location ONLY when permission is already granted (no prompt),
    /// within `timeout` seconds; nil otherwise.
    @MainActor
    public static func currentLocationIfAuthorized(timeout: TimeInterval = 5) async -> (latitude: Double, longitude: Double)? {
        let manager = CLLocationManager()
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: break
        default: return nil
        }
        let fetcher = OneShotLocation(manager: manager)
        let fix = await fetcher.fetch(timeout: timeout) ?? manager.location
        return fix.map { ($0.coordinate.latitude, $0.coordinate.longitude) }
    }
}

/// One `requestLocation()` with a timeout (FusedLocationProvider `getCurrentLocation` + 5 s).
@MainActor
private final class OneShotLocation: NSObject, CLLocationManagerDelegate {
    private let manager: CLLocationManager
    private var continuation: CheckedContinuation<CLLocation?, Never>?

    init(manager: CLLocationManager) {
        self.manager = manager
        super.init()
    }

    func fetch(timeout: TimeInterval) async -> CLLocation? {
        await withCheckedContinuation { (c: CheckedContinuation<CLLocation?, Never>) in
            continuation = c
            manager.delegate = self
            manager.desiredAccuracy = kCLLocationAccuracyHundredMeters // ~ PRIORITY_BALANCED_POWER_ACCURACY
            manager.requestLocation()
            DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in self?.finish(nil) }
        }
    }

    private func finish(_ location: CLLocation?) {
        guard let c = continuation else { return }
        continuation = nil
        manager.delegate = nil
        c.resume(returning: location)
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let last = locations.last
        Task { @MainActor in self.finish(last) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in self.finish(nil) }
    }
}
