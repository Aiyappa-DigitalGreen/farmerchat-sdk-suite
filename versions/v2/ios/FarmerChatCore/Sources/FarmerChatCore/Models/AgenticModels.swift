import Foundation

/// Events streamed from the agentic text-query endpoint (#27a,
/// `api/chat/get_answer_for_text_query_agentic/`). **SDK 2.0.0 only** — the 1.0.0 path keeps the
/// synchronous #27 contract (root CLAUDE.md §3).
///
/// Swift port of `core/model/AgenticModels.kt` (versions/v2/android), itself a port of the app's
/// `domain/model/chat/AgenticEvent.kt` (fc-compose-agentic @ c0524dd6).
///
/// The terminal ``metadata`` event reuses ``TextPromptResponse`` — its payload is field-compatible
/// — so the final UI state is built with exactly the same logic as the non-agentic path.
///
/// Event ordering observed by the app: `tool_call`/`tool_result` → `text_delta`* → `done` →
/// `metadata`. The stream finalizes on ``metadata`` (the richest payload). ``done`` is a
/// non-terminal fallback used only if the stream ends WITHOUT a ``metadata``, so the answer is
/// never lost.
///
/// Deliberately NOT `Equatable`: ``TextPromptResponse`` is not, and pattern matching covers the
/// only consumers (the view model and the parser tests).
public enum AgenticEvent: Sendable {

    /// A tool the agent decided to invoke. `statusText` is a short human-readable progress label.
    case toolCall(name: String?, statusText: String?)

    /// Result of a previously called tool. `statusText` is a short progress label.
    case toolResult(name: String?, statusText: String?)

    /// Incremental chunk of the answer; accumulate these for live typing.
    case textDelta(String)

    /// Terminal event carrying the full response, follow-up questions and display flags.
    case metadata(TextPromptResponse)

    /// Non-terminal "done": generation finished. Carries the final answer and plain follow-up
    /// strings but NOT the richer ``TextPromptResponse`` fields (message_id, follow-up ids). A
    /// ``metadata`` normally follows and takes precedence; this is kept only as a fallback.
    case done(answer: String?, followUps: [String])

    /// Transport/stream failure (connection dropped, non-2xx, malformed stream).
    case failure(message: String?, kind: StreamErrorKind)
}

/// Why an agentic stream ended without a complete answer. Drives distinct error UI.
///
/// - `network` connectivity drop mid-stream (URLError / timeout / unknown host).
/// - `server`  non-2xx status or an error payload.
/// - `tool`    an MCP tool/action failed. **Reserved** — the current wire protocol has no
///   tool-failure signal, so this is never emitted yet. It is the extension point for when the
///   backend adds a `tool_error` event or an error field on `tool_result`.
/// - `unknown` stream closed without a terminal event and no transport error was seen.
public enum StreamErrorKind: String, Sendable, Equatable, CaseIterable {
    case network
    case server
    case tool
    case unknown
}

// MARK: - Wire payloads
//
// Gson's `@SerializedName(alternate:)` has no Codable equivalent, so every alias set is decoded
// by hand: the FIRST key present with a usable value wins, in the same order Android lists them.
// The aliases exist because backend variants name the same field differently; losing the value
// would silently break live typing or drop a finished answer.

/// `text_delta` payload — aliases: `delta`, `text`, `content`, `token`, `chunk`.
struct AgenticTextDeltaPayload: Decodable {
    let delta: String?

    private enum CodingKeys: String, CodingKey {
        case delta, text, content, token, chunk
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        delta = container.firstString(of: [.delta, .text, .content, .token, .chunk])
    }
}

/// `tool_call` / `tool_result` payload — status aliases: `status_text`, `statusText`, `status`,
/// `label`.
struct AgenticToolPayload: Decodable {
    let name: String?
    let statusText: String?

    private enum CodingKeys: String, CodingKey {
        case name
        case statusText = "status_text"
        case statusTextCamel = "statusText"
        case status
        case label
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = container.firstString(of: [.name])
        statusText = container.firstString(of: [.statusText, .statusTextCamel, .status, .label])
    }
}

/// `done` payload (fallback terminal — see ``AgenticEvent/done(answer:followUps:)``). The real
/// payload carries far more (model, trace, metrics); only the answer and follow-ups are needed to
/// finalize when `metadata` never arrives.
struct AgenticDonePayload: Decodable {
    let answer: String?
    let followUps: [String]?

    private enum CodingKeys: String, CodingKey {
        case answer, response, text
        case finalAnswer = "final_answer"
        case followups
        case followUpsSnake = "follow_ups"
        case followUpsCamel = "followUps"
        case followUpQuestions = "follow_up_questions"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        answer = container.firstString(of: [.answer, .response, .text, .finalAnswer])
        followUps = container.firstStringArray(
            of: [.followups, .followUpsSnake, .followUpsCamel, .followUpQuestions]
        )
    }
}

// MARK: - Alias decoding helpers

extension KeyedDecodingContainer {
    /// First key that decodes to a non-nil `String`. Never throws: a key holding the wrong type is
    /// skipped rather than failing the whole payload.
    func firstString(of keys: [K]) -> String? {
        for key in keys {
            if let value = (try? decodeIfPresent(String.self, forKey: key)) ?? nil {
                return value
            }
        }
        return nil
    }

    /// First key that decodes to a non-nil `[String]`. A list of objects (the shape #27 uses for
    /// `follow_up_questions`) is skipped rather than failing the payload.
    func firstStringArray(of keys: [K]) -> [String]? {
        for key in keys {
            if let value = (try? decodeIfPresent([String].self, forKey: key)) ?? nil {
                return value
            }
        }
        return nil
    }
}
