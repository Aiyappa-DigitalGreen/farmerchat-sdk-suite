import Foundation
import AVFoundation

/// Voice-query recorder. iOS records m4a/AAC (44.1 kHz mono) — the platform
/// fallback the app also supports — and the transcription request carries
/// `input_audio_encoding_format: "aac"` (doc 03 fidelity map).
public final class AudioRecorderService: NSObject, ObservableObject, @unchecked Sendable {
    public static let audioFormatField = "aac"

    public enum RecorderError: Error, LocalizedError {
        case permissionDenied
        case notRecording
        case failedToStart
        case emptyRecording

        public var errorDescription: String? {
            switch self {
            case .permissionDenied: return "Microphone permission denied"
            case .notRecording: return "No active recording"
            case .failedToStart: return "Could not start the recorder"
            case .emptyRecording: return "Recording produced no audio"
            }
        }
    }

    @Published public private(set) var isRecording = false
    @Published public private(set) var elapsedSeconds: TimeInterval = 0
    /// Normalized 0...1 metering level for waveform-style UI.
    @Published public private(set) var meterLevel: Float = 0

    private var recorder: AVAudioRecorder?
    private var meterTimer: Timer?
    private var currentFileURL: URL?

    public override init() {
        super.init()
    }

    // MARK: - Permission

    public func requestPermission() async -> Bool {
        #if os(iOS)
        return await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
        #else
        return true
        #endif
    }

    public var permissionDenied: Bool {
        #if os(iOS)
        return AVAudioSession.sharedInstance().recordPermission == .denied
        #else
        return false
        #endif
    }

    // MARK: - Recording

    public func startRecording() throws {
        guard !isRecording else { return }
        #if os(iOS)
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
        try audioSession.setActive(true)
        #endif

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("fc_sdk_voice_\(UUID().uuidString)")
            .appendingPathExtension("m4a")

        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            AVEncoderBitRateKey: 64_000
        ]

        let recorder = try AVAudioRecorder(url: url, settings: settings)
        recorder.isMeteringEnabled = true
        guard recorder.record() else {
            throw RecorderError.failedToStart
        }
        self.recorder = recorder
        self.currentFileURL = url
        isRecording = true
        elapsedSeconds = 0
        startMetering()
    }

    /// Stops and returns the finished clip.
    public func stopRecording() throws -> RecordedClip {
        guard let recorder, let url = currentFileURL else {
            throw RecorderError.notRecording
        }
        recorder.stop()
        stopMetering()
        self.recorder = nil
        isRecording = false
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
        let data = (try? Data(contentsOf: url)) ?? Data()
        guard !data.isEmpty else {
            throw RecorderError.emptyRecording
        }
        return RecordedClip(fileURL: url, data: data, duration: elapsedSeconds)
    }

    public func cancelRecording() {
        recorder?.stop()
        stopMetering()
        recorder = nil
        isRecording = false
        if let url = currentFileURL {
            try? FileManager.default.removeItem(at: url)
        }
        currentFileURL = nil
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
    }

    private func startMetering() {
        meterTimer?.invalidate()
        meterTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self, let recorder = self.recorder else { return }
            recorder.updateMeters()
            self.elapsedSeconds = recorder.currentTime
            let db = recorder.averagePower(forChannel: 0) // -160...0
            self.meterLevel = max(0, min(1, (db + 50) / 50))
        }
    }

    private func stopMetering() {
        meterTimer?.invalidate()
        meterTimer = nil
        meterLevel = 0
    }
}

/// A finished voice recording, ready for the transcription pipeline.
public struct RecordedClip: Sendable {
    public let fileURL: URL
    public let data: Data
    public let duration: TimeInterval

    /// Base64 payload for `SetVoiceRequest.query`.
    public var base64Audio: String {
        data.base64EncodedString()
    }
}
