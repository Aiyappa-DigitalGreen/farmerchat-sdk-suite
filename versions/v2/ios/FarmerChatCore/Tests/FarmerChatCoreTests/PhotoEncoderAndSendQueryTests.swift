import XCTest
import ImageIO
import CoreGraphics
import UniformTypeIdentifiers
@testable import FarmerChatCore

/// App `ImageUtils.addGpsToImageAndConvertToBase64` port + Send_Query-on-response payload.
final class PhotoEncoderAndSendQueryTests: XCTestCase {

    /// A JPEG of `width`×`height`, optionally with GPS EXIF.
    private func jpeg(width: Int, height: Int, gps: (Double, Double)? = nil) -> Data {
        let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
        ctx.setFillColor(CGColor(red: 0.2, green: 0.6, blue: 0.3, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
        let image = ctx.makeImage()!
        let out = NSMutableData()
        let dest = CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil)!
        var props: [CFString: Any] = [kCGImageDestinationLossyCompressionQuality: 1.0]
        if let gps {
            props[kCGImagePropertyGPSDictionary] = [
                kCGImagePropertyGPSLatitude: abs(gps.0), kCGImagePropertyGPSLatitudeRef: gps.0 >= 0 ? "N" : "S",
                kCGImagePropertyGPSLongitude: abs(gps.1), kCGImagePropertyGPSLongitudeRef: gps.1 >= 0 ? "E" : "W"
            ] as [CFString: Any]
        }
        CGImageDestinationAddImage(dest, image, props as CFDictionary)
        XCTAssertTrue(CGImageDestinationFinalize(dest))
        return out as Data
    }

    func testFitsWithin1000AndKeepsThePhotosOwnGPS() throws {
        let source = jpeg(width: 4000, height: 3000, gps: (12.9716, 77.5946))
        let encoded = try XCTUnwrap(PhotoUploadEncoder.encode(source, fallbackLocation: (1, 1)))
        XCTAssertEqual(encoded.pixelWidth, 1000)
        XCTAssertEqual(encoded.pixelHeight, 750)
        XCTAssertLessThan(encoded.data.count, source.count)
        // The photo's own GPS wins over the device fallback, and it is written back into the EXIF.
        let gps = try XCTUnwrap(PhotoUploadEncoder.readGPS(from: encoded.data))
        XCTAssertEqual(gps.latitude, 12.9716, accuracy: 0.0001)
        XCTAssertEqual(gps.longitude, 77.5946, accuracy: 0.0001)
        XCTAssertEqual(encoded.latitude ?? 0, 12.9716, accuracy: 0.0001)
    }

    func testNoPhotoGPSUsesDeviceLocationAndRefs() throws {
        let encoded = try XCTUnwrap(PhotoUploadEncoder.encode(jpeg(width: 800, height: 600), fallbackLocation: (-1.2921, -36.8219)))
        XCTAssertEqual(encoded.pixelWidth, 800, "never scaled up")
        let gps = try XCTUnwrap(PhotoUploadEncoder.readGPS(from: encoded.data))
        XCTAssertEqual(gps.latitude, -1.2921, accuracy: 0.0001, "S ref")
        XCTAssertEqual(gps.longitude, -36.8219, accuracy: 0.0001, "W ref")
    }

    func testNoLocationAtAllWritesNoGPS() throws {
        let encoded = try XCTUnwrap(PhotoUploadEncoder.encode(jpeg(width: 1200, height: 2400), fallbackLocation: nil))
        XCTAssertEqual(encoded.pixelHeight, 1000)
        XCTAssertEqual(encoded.pixelWidth, 500)
        XCTAssertNil(PhotoUploadEncoder.readGPS(from: encoded.data))
        XCTAssertNil(encoded.latitude)
    }

    func testUndecodableDataFails() {
        XCTAssertNil(PhotoUploadEncoder.encode(Data("not an image".utf8), fallbackLocation: nil))
    }

    func testAppTruncationRules() {
        // convertToExifFormat: whole degrees, whole minutes, seconds truncated to 1/1000.
        let v = PhotoUploadEncoder.exifDegrees(12.971_623_4)
        XCTAssertEqual(v, 12 + 58.0 / 60 + 17.844 / 3600, accuracy: 1e-9)
        XCTAssertTrue(PhotoUploadEncoder.fittedSize(width: 3000, height: 2001) == (1000, 667))
        XCTAssertTrue(PhotoUploadEncoder.fittedSize(width: 4032, height: 3024) == (1000, 750))
        XCTAssertTrue(PhotoUploadEncoder.fittedSize(width: 1000, height: 1000) == (1000, 1000))
    }

    // MARK: - Send_Query on the response

    func testSendQueryUpgradesToAvailableWhenTheResponsePresentsChips() {
        let pending = ChatViewModel.PendingSendQuery(base: ["input_type": "text"], chip: .none, triggeredInputType: "text")
        let props = ChatViewModel.sendQueryProps(pending, valid: true, intent: nil, shownChipType: "upload-photo")
        XCTAssertEqual(props["agentic_chip_status"], "available")
        XCTAssertEqual(props["agentic_chip_shown_type"], "upload-photo")
        XCTAssertEqual(props["Valid_Query"], "true")
        XCTAssertEqual(props["click_type"], "text")
        for key in ["asset_type", "asset_name", "concern", "stage", "intent"] { XCTAssertEqual(props[key], "", key) }
        XCTAssertEqual(props["clarification_needed_asset"], "false")
    }

    func testSendQueryKeepsSelectedAndSkipped() {
        let chipTap = ChatViewModel.PendingSendQuery(
            base: [:], chip: .selected(type: "alignment-clarify", value: "x", label: "X"), triggeredInputType: "align_chip_sel")
        let p1 = ChatViewModel.sendQueryProps(chipTap, valid: false, intent: nil, shownChipType: "gps-prompt")
        XCTAssertEqual(p1["agentic_chip_status"], "selected")
        XCTAssertEqual(p1["agentic_chip_shown_type"], "")
        XCTAssertEqual(p1["Valid_Query"], "false")
        let skipped = ChatViewModel.PendingSendQuery(
            base: [:], chip: ChipAnalytics(status: "skipped", skippedType: "gender-select"), triggeredInputType: "text")
        let p2 = ChatViewModel.sendQueryProps(skipped, valid: true, intent: nil, shownChipType: "upload-photo")
        XCTAssertEqual(p2["agentic_chip_status"], "skipped")
        XCTAssertEqual(p2["agentic_chip_skipped_type"], "gender-select")
    }
}
