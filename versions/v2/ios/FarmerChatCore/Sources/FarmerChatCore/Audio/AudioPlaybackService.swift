import Foundation
import AVFoundation
import Combine

/// Playback for synthesised TTS URLs and user voice clips.
/// AVPlayer replaces the app's MediaPlayer; a single player instance is shared
/// so only one clip plays at a time (parity with the app's chat behavior).
public final class AudioPlaybackService: NSObject, ObservableObject, @unchecked Sendable {
    public enum PlaybackState: Equatable {
        case idle
        case loading(id: String)
        case playing(id: String)
        case paused(id: String)
    }

    @Published public private(set) var state: PlaybackState = .idle
    /// Position (seconds) of the item currently loaded.
    @Published public private(set) var position: TimeInterval = 0
    @Published public private(set) var duration: TimeInterval = 0

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var currentId: String?

    /// Fired when a clip finishes; carries the clip id.
    public let didFinish = PassthroughSubject<String, Never>()

    public override init() {
        super.init()
    }

    deinit {
        teardown()
    }

    // MARK: - Controls

    /// Plays a remote or local URL. `id` identifies the clip (message id).
    /// Calling for the current id toggles resume; a new id replaces playback.
    public func play(url: URL, id: String) {
        if currentId == id, let player {
            player.play()
            state = .playing(id: id)
            return
        }
        teardown()
        currentId = id
        state = .loading(id: id)

        #if os(iOS)
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        #endif

        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        self.player = player

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak self] _ in
            guard let self, let id = self.currentId else { return }
            self.state = .idle
            self.position = 0
            self.didFinish.send(id)
        }

        timeObserver = player.addPeriodicTimeObserver(
            forInterval: CMTime(seconds: 0.25, preferredTimescale: 600),
            queue: .main
        ) { [weak self] time in
            guard let self else { return }
            self.position = time.seconds
            if let duration = self.player?.currentItem?.duration.seconds, duration.isFinite {
                self.duration = duration
            }
            if case .loading(let id) = self.state, time.seconds > 0 {
                self.state = .playing(id: id)
            }
        }

        player.play()
        state = .playing(id: id)
    }

    public func pause() {
        guard let currentId else { return }
        player?.pause()
        state = .paused(id: currentId)
    }

    public func resume() {
        guard let currentId else { return }
        player?.play()
        state = .playing(id: currentId)
    }

    public func stop() {
        teardown()
        state = .idle
        position = 0
        duration = 0
    }

    public func isPlaying(id: String) -> Bool {
        if case .playing(let current) = state { return current == id }
        return false
    }

    public func isActive(id: String) -> Bool {
        currentId == id && state != .idle
    }

    /// Preloads a clip's duration (voice bubbles show length before playing).
    public func loadDuration(url: URL) async -> TimeInterval? {
        let asset = AVURLAsset(url: url)
        if #available(iOS 15.0, macOS 12.0, *) {
            guard let duration = try? await asset.load(.duration) else { return nil }
            let seconds = duration.seconds
            return seconds.isFinite ? seconds : nil
        } else {
            let seconds = asset.duration.seconds
            return seconds.isFinite ? seconds : nil
        }
    }

    private func teardown() {
        if let timeObserver, let player {
            player.removeTimeObserver(timeObserver)
        }
        timeObserver = nil
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }
        endObserver = nil
        player?.pause()
        player = nil
        currentId = nil
    }
}
