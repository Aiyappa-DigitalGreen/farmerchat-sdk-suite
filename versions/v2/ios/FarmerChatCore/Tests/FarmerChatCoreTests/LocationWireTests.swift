import XCTest
@testable import FarmerChatCore

/// `update_user_location` sends lat/long as STRINGS, as the app does
/// (`UpdateLocationRequest(lat: String?, long: String?)`) and as the Android SDK does.
final class LocationWireTests: XCTestCase {
    private func json(_ r: UpdateLocationRequest) throws -> [String: Any] {
        try JSONSerialization.jsonObject(with: JSONEncoder().encode(r)) as! [String: Any]
    }

    func testCoordinatesEncodeAsStrings() throws {
        let j = try json(UpdateLocationRequest(userId: "u", lat: 12.9716, long: 77.5946))
        XCTAssertEqual(j["lat"] as? String, "12.9716")
        XCTAssertEqual(j["long"] as? String, "77.5946")
        XCTAssertEqual(j["user_id"] as? String, "u")
    }

    func testAbsentCoordinatesAreOmitted() throws {
        let j = try json(UpdateLocationRequest(userId: "u", country: "IN"))
        XCTAssertNil(j["lat"]); XCTAssertNil(j["long"])
        XCTAssertEqual(j["country"] as? String, "IN")
    }

    func testDecodesStringOrNumber() throws {
        let a = try JSONDecoder().decode(UpdateLocationRequest.self, from: Data(#"{"lat":"1.5","long":2.5,"user_id":"u"}"#.utf8))
        XCTAssertEqual(a.lat, 1.5); XCTAssertEqual(a.long, 2.5)
    }
}
