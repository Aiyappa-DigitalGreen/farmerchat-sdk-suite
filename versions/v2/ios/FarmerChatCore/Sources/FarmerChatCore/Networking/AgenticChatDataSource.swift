import Foundation

/// Maps one wire payload to an ``AgenticEvent``.
///
/// Split out from the transport so the framing can be unit-tested: the wire **cannot** be
/// exercised against a live stream yet (see ``AgenticChatDataSource``), which makes these tests
/// the only guard on the mapping.
enum AgenticEventParser {

    /// `TOOL_CALL`, `tool_call` and `toolCall` all normalize to the same key.
    static func normalizeType(_ raw: String?) -> String {
        (raw ?? "").lowercased().filter { $0.isLetter || $0.isNumber }
    }

    /// Reads a `type` discriminator from inside the JSON payload when no SSE `event:` line came.
    static func readTypeField(_ data: String) -> String? {
        guard let bytes = data.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: bytes) as? [String: Any] else {
            return nil
        }
        return (object["type"] as? String) ?? (object["event"] as? String)
    }

    /// Parses and maps one event payload. Returns nil when there is nothing to surface — a blank
    /// payload, malformed JSON, or scaffolding that carries neither text nor an answer.
    static func parse(type: String?, data rawData: String) -> AgenticEvent? {
        let data = rawData.trimmingCharacters(in: .whitespacesAndNewlines)
        if data.isEmpty { return nil }
        guard let bytes = data.data(using: .utf8) else { return nil }

        var normalized = normalizeType(type)
        if normalized.isEmpty { normalized = normalizeType(readTypeField(data)) }
        let decoder = JSONDecoder()

        switch normalized {
        case "textdelta":
            guard let payload = try? decoder.decode(AgenticTextDeltaPayload.self, from: bytes),
                  let delta = payload.delta, !delta.isEmpty else { return nil }
            return .textDelta(delta)

        case "toolcall":
            guard let payload = try? decoder.decode(AgenticToolPayload.self, from: bytes) else { return nil }
            return .toolCall(name: payload.name, statusText: payload.statusText)

        case "toolresult":
            guard let payload = try? decoder.decode(AgenticToolPayload.self, from: bytes) else { return nil }
            return .toolResult(name: payload.name, statusText: payload.statusText)

        case "metadata":
            guard let response = try? decoder.decode(TextPromptResponse.self, from: bytes) else { return nil }
            return .metadata(response)

        // Non-terminal fallback: the reader does NOT stop here, so a following `metadata` still
        // wins.
        case "done":
            guard let payload = try? decoder.decode(AgenticDonePayload.self, from: bytes) else { return nil }
            return .done(answer: payload.answer, followUps: payload.followUps ?? [])

        // Unknown / missing type: never silently drop a real answer. Some backend variants stream
        // the final response as a bare, typeless JSON object with no `event:`/`type`
        // discriminator — which would otherwise surface to the user as "Something went wrong".
        // Recover it: a payload carrying answer text or follow-ups is the terminal response; one
        // carrying an incremental chunk is a delta. Genuine section headers carry neither and
        // correctly map to nil.
        default:
            if let full = try? decoder.decode(TextPromptResponse.self, from: bytes),
               !(full.response ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                   || !(full.followUpQuestions ?? []).isEmpty {
                return .metadata(full)
            }
            if let payload = try? decoder.decode(AgenticTextDeltaPayload.self, from: bytes),
               let delta = payload.delta, !delta.isEmpty {
                return .textDelta(delta)
            }
            return nil
        }
    }
}

/// Line-driven state machine turning the #27a byte stream into ``AgenticEvent``s.
///
/// ⚠ **The wire framing is not confirmed against a real stream** (a guest receives 0 bytes on dev,
/// stage and prod — docs/05-open-questions.md), so this is deliberately permissive in exactly the
/// way the Android reader is:
/// - accepts `data:`-prefixed SSE framing, where a blank line ends an event,
/// - accepts bare NDJSON (one JSON object per line), dispatched immediately,
/// - resolves the event type from an SSE `event:` line when present, else a `type`/`event` field
///   inside the JSON, matched case/separator-insensitively.
///
/// Structural deviation from Android (which inlines this loop in its data source): extracted so
/// the framing itself — not just the payload mapping — is unit-testable. Behaviour is line-for-line
/// the same.
struct AgenticStreamDecoder {
    private var eventType: String?
    private var dataBuffer = ""

    /// True once a terminal `metadata` event was emitted; the reader stops reading after it.
    private(set) var sawTerminalMetadata = false

    /// Feeds one line (without its trailing newline). Returns an event when this line completed
    /// one, exactly as Android's reader dispatches at most one event per line.
    mutating func feed(line rawLine: String) -> AgenticEvent? {
        // Real SSE uses CRLF. Android's `readUtf8Line` strips the CR for free; splitting on LF
        // does not, and a lone "\r" line would then not read as blank — which would silently stop
        // every event boundary from firing.
        var line = rawLine
        if line.hasSuffix("\r") { line.removeLast() }

        // Event boundary: dispatch whatever has accumulated.
        if line.trimmingCharacters(in: .whitespaces).isEmpty {
            return flush()
        }
        // SSE comment / keep-alive.
        if line.hasPrefix(":") { return nil }
        // SSE event name.
        if line.hasPrefix("event:") {
            eventType = String(line.dropFirst("event:".count))
                .trimmingCharacters(in: .whitespaces)
            return nil
        }
        // SSE data. Per the spec multiple data: lines in one event join with a newline (harmless
        // whitespace inside a JSON payload).
        if line.hasPrefix("data:") {
            if !dataBuffer.isEmpty { dataBuffer.append("\n") }
            dataBuffer.append(
                String(line.dropFirst("data:".count)).trimmingCharacters(in: .whitespaces)
            )
            return nil
        }
        // Bare JSON object on its own line (NDJSON): dispatch immediately.
        if line.drop(while: { $0 == " " || $0 == "\t" }).first == "{" {
            let event = dispatch(type: eventType, data: line.trimmingCharacters(in: .whitespaces))
            eventType = nil
            dataBuffer = ""
            return event
        }
        // Any other non-blank line: continuation of the payload.
        dataBuffer.append(line)
        return nil
    }

    /// Flushes a final event that was not terminated by a trailing blank line.
    mutating func finish() -> AgenticEvent? { flush() }

    private mutating func flush() -> AgenticEvent? {
        let event = dispatch(type: eventType, data: dataBuffer)
        eventType = nil
        dataBuffer = ""
        return event
    }

    private mutating func dispatch(type: String?, data: String) -> AgenticEvent? {
        guard let event = AgenticEventParser.parse(type: type, data: data) else { return nil }
        if case .metadata = event { sawTerminalMetadata = true }
        return event
    }
}

/// Streams endpoint **#27a** (`api/chat/get_answer_for_text_query_agentic/`) as an
/// `AsyncThrowingStream` of ``AgenticEvent``. **SDK 2.0.0 only** — 1.0.0 keeps the synchronous #27
/// path (root CLAUDE.md §3).
///
/// Transport, verified live 2026-09-02 on dev / stage / prod:
/// - The request must send `Accept: application/json`. The backend **406s**
///   `Accept: text/event-stream`.
/// - The response is `Content-Type: text/event-stream`, `Transfer-Encoding: chunked`.
/// - There must be **no read/resource timeout**: agentic answers stream for minutes. This type
///   owns a dedicated `URLSession` and never goes through ``APIClient/execute(_:as:)`` or
///   ``ApiPriority``, whose whole job is to impose the P1/P2/P3 deadlines that would cut a stream
///   short. Note a `URLRequest.timeoutInterval` **overrides** the session configuration, so the
///   request must not carry a priority timeout either.
/// - Auth is unchanged: `Authorization: Bearer`, `Build-Version`, `Device-Info` and the 401
///   refresh (skip-list + loop guard at 2, via the shared single-flight ``TokenRefresher``) behave
///   exactly as on every other call.
///
/// Errors never throw out of the stream: a transport or status failure is surfaced as
/// ``AgenticEvent/failure(message:kind:)`` and the stream then finishes, matching Android's flow.
/// Only cancellation throws (`CancellationError`), so a consumer that left the screen writes no
/// stale error card.
final class AgenticChatDataSource: @unchecked Sendable {

    /// Effectively "no timeout" (7 days) for both the idle-read and whole-resource limits.
    /// `URLSession` has no infinite sentinel — 0 means "use the default", and `.infinity` is not a
    /// supported value — so a large finite interval is the documented way to express this.
    static let noTimeoutInterval: TimeInterval = 7 * 24 * 60 * 60

    static let path = "api/chat/get_answer_for_text_query_agentic/"
    static let apiName = "get_answer_for_text_query_agentic"

    private let client: APIClient
    private let session: URLSession

    init(client: APIClient, session: URLSession? = nil) {
        self.client = client
        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.default
            configuration.timeoutIntervalForRequest = AgenticChatDataSource.noTimeoutInterval
            configuration.timeoutIntervalForResource = AgenticChatDataSource.noTimeoutInterval
            configuration.waitsForConnectivity = false
            self.session = URLSession(configuration: configuration)
        }
    }

    func stream(_ body: TextPromptRequest) -> AsyncThrowingStream<AgenticEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task { [weak self] in
                guard let self else {
                    continuation.finish()
                    return
                }
                await self.run(body, continuation: continuation)
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // MARK: - Reader

    private func run(
        _ body: TextPromptRequest,
        continuation: AsyncThrowingStream<AgenticEvent, Error>.Continuation
    ) async {
        guard let payload = try? JSONEncoder().encode(body) else {
            continuation.yield(.failure(message: "Failed to encode agentic request", kind: .unknown))
            continuation.finish()
            return
        }

        var authAttempts = 0
        var bearer = client.tokenStore.accessToken

        while true {
            guard var request = client.streamingRequest(path: AgenticChatDataSource.path, body: payload) else {
                continuation.yield(.failure(message: "Invalid agentic URL", kind: .unknown))
                continuation.finish()
                return
            }
            if let bearer, !bearer.isEmpty {
                request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
            }

            let bytes: URLSession.AsyncBytes
            let response: URLResponse
            do {
                (bytes, response) = try await session.bytes(for: request)
            } catch {
                if isCancellation(error) {
                    continuation.finish(throwing: CancellationError())
                } else {
                    continuation.yield(.failure(message: error.localizedDescription, kind: .network))
                    continuation.finish()
                }
                return
            }

            guard let http = response as? HTTPURLResponse else {
                continuation.yield(.failure(message: "Non-HTTP agentic response", kind: .server))
                continuation.finish()
                return
            }

            // Status is known before a single body byte is consumed.
            if http.statusCode == 401,
               !TokenRefresher.shouldSkip(url: request.url),
               authAttempts < 2 {
                authAttempts += 1
                switch await client.refresher.authenticate(staleToken: bearer) {
                case .refreshed(let newToken):
                    bearer = newToken
                    continue // reissue the stream request with the fresh token
                case .sessionExpired:
                    continuation.yield(.failure(message: "HTTP 401", kind: .server))
                    continuation.finish()
                    return
                }
            }

            guard (200..<300).contains(http.statusCode) else {
                continuation.yield(.failure(message: "HTTP \(http.statusCode)", kind: .server))
                continuation.finish()
                return
            }

            await consume(bytes, continuation: continuation)
            return
        }
    }

    private func consume(
        _ bytes: URLSession.AsyncBytes,
        continuation: AsyncThrowingStream<AgenticEvent, Error>.Continuation
    ) async {
        var decoder = AgenticStreamDecoder()
        var lineBytes: [UInt8] = []
        do {
            for try await byte in bytes {
                if byte == UInt8(ascii: "\n") {
                    let line = String(decoding: lineBytes, as: UTF8.self)
                    lineBytes.removeAll(keepingCapacity: true)
                    if let event = decoder.feed(line: line) {
                        continuation.yield(event)
                        if decoder.sawTerminalMetadata {
                            continuation.finish()
                            return
                        }
                    }
                } else {
                    lineBytes.append(byte)
                }
            }
            // Trailing bytes with no final newline, then a flush for an event that was never
            // terminated by a blank line.
            if !lineBytes.isEmpty,
               let event = decoder.feed(line: String(decoding: lineBytes, as: UTF8.self)) {
                continuation.yield(event)
                if decoder.sawTerminalMetadata {
                    continuation.finish()
                    return
                }
            }
            if let event = decoder.finish() { continuation.yield(event) }
            continuation.finish()
        } catch {
            if isCancellation(error) {
                continuation.finish(throwing: CancellationError())
            } else {
                // A mid-stream throw is a transport problem (socket dropped, timeout, DNS).
                continuation.yield(.failure(message: error.localizedDescription, kind: .network))
                continuation.finish()
            }
        }
    }

    private func isCancellation(_ error: any Error) -> Bool {
        if error is CancellationError { return true }
        if Task.isCancelled { return true }
        let nsError = error as NSError
        return nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCancelled
    }
}
