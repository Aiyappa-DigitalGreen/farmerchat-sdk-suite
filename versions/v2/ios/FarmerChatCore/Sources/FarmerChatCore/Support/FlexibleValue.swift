import Foundation

/// Lossy decoder for backend fields that arrive as Int, String or Double
/// (e.g. `id`, `statement_id`, `message_id`). Mirrors the Android Gson
/// tolerance for `Any`-typed identifiers.
public enum FlexibleID: Codable, Hashable, CustomStringConvertible, Sendable {
    case int(Int)
    case string(String)
    case double(Double)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let intValue = try? container.decode(Int.self) {
            self = .int(intValue)
        } else if let doubleValue = try? container.decode(Double.self) {
            self = .double(doubleValue)
        } else if let stringValue = try? container.decode(String.self) {
            self = .string(stringValue)
        } else {
            throw DecodingError.typeMismatch(
                FlexibleID.self,
                DecodingError.Context(
                    codingPath: decoder.codingPath,
                    debugDescription: "id is neither Int, Double nor String"
                )
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .int(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .double(let value): try container.encode(value)
        }
    }

    public var stringValue: String {
        switch self {
        case .int(let value): return String(value)
        case .string(let value): return value
        case .double(let value):
            // Render 12.0 as "12" the way Gson's Any→toString commonly leaks.
            if value.truncatingRemainder(dividingBy: 1) == 0 {
                return String(Int(value))
            }
            return String(value)
        }
    }

    public var intValue: Int? {
        switch self {
        case .int(let value): return value
        case .string(let value): return Int(value) ?? Int(Double(value) ?? .nan)
        case .double(let value): return Int(value)
        }
    }

    public var description: String { stringValue }

    public init(_ value: Int) { self = .int(value) }
    public init(_ value: String) { self = .string(value) }
}

/// Lossy wrapper: decodes the wrapped value or silently yields nil instead of
/// failing the whole payload (used for fields the backend types inconsistently).
@propertyWrapper
public struct LossyOptional<Wrapped: Codable & Sendable>: Codable, Sendable {
    public var wrappedValue: Wrapped?

    public init(wrappedValue: Wrapped? = nil) {
        self.wrappedValue = wrappedValue
    }

    public init(from decoder: Decoder) throws {
        let container = try? decoder.singleValueContainer()
        wrappedValue = try? container?.decode(Wrapped.self)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let wrappedValue {
            try container.encode(wrappedValue)
        } else {
            try container.encodeNil()
        }
    }
}

extension LossyOptional: Equatable where Wrapped: Equatable {}
extension LossyOptional: Hashable where Wrapped: Hashable {}

extension KeyedDecodingContainer {
    public func decode<T: Codable & Sendable>(
        _ type: LossyOptional<T>.Type,
        forKey key: Key
    ) throws -> LossyOptional<T> {
        (try? decodeIfPresent(LossyOptional<T>.self, forKey: key)) ?? LossyOptional<T>(wrappedValue: nil)
    }
}

/// Lossy bool: decodes JSON bools, "True"/"False" strings (any case) and 0/1
/// numbers — Gson-parity for the backend's stringly-typed booleans (e.g.
/// `show_crops_livestocks: "False"` on initialize_user). Unrecognized values
/// yield nil rather than failing the whole payload.
@propertyWrapper
public struct FlexibleBool: Codable, Hashable, Sendable {
    public var wrappedValue: Bool?

    public init(wrappedValue: Bool? = nil) {
        self.wrappedValue = wrappedValue
    }

    public init(from decoder: Decoder) throws {
        guard let container = try? decoder.singleValueContainer() else { return }
        if let boolValue = try? container.decode(Bool.self) {
            wrappedValue = boolValue
        } else if let stringValue = try? container.decode(String.self) {
            switch stringValue.lowercased() {
            case "true": wrappedValue = true
            case "false": wrappedValue = false
            default: wrappedValue = nil
            }
        } else if let intValue = try? container.decode(Int.self) {
            wrappedValue = intValue != 0
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let wrappedValue {
            try container.encode(wrappedValue)
        } else {
            try container.encodeNil()
        }
    }
}

extension KeyedDecodingContainer {
    public func decode(_ type: FlexibleBool.Type, forKey key: Key) throws -> FlexibleBool {
        (try? decodeIfPresent(FlexibleBool.self, forKey: key)) ?? FlexibleBool(wrappedValue: nil)
    }
}

/// Minimal type-erased JSON value used for free-form maps (e.g. OSM responses,
/// section meta blobs) without dragging in a dependency.
public enum JSONValue: Codable, Hashable, Sendable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Int.self) {
            self = .int(value)
        } else if let value = try? container.decode(Double.self) {
            self = .double(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .int(let value): try container.encode(value)
        case .double(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    public var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }
}
