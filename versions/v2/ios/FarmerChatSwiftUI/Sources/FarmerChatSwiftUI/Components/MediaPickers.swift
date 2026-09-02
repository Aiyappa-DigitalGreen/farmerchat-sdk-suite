import SwiftUI
import PhotosUI
import SafariServices
import WebKit
import AVFoundation
import FarmerChatCore

// MARK: - Picked image payload

public struct FCPickedImage {
    public let image: UIImage
    public let jpegData: Data
    /// Temp file the chat bubble renders from.
    public let fileURL: URL

    init?(image: UIImage) {
        guard let data = image.jpegData(compressionQuality: 0.8) else { return nil }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("fc_sdk_img_\(UUID().uuidString).jpg")
        do {
            try data.write(to: url)
        } catch {
            return nil
        }
        self.image = image
        self.jpegData = data
        self.fileURL = url
    }
}

// MARK: - PHPicker (gallery)

public struct FCPhotoLibraryPicker: UIViewControllerRepresentable {
    let onPicked: (FCPickedImage?) -> Void

    public func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.filter = .images
        config.selectionLimit = 1
        let controller = PHPickerViewController(configuration: config)
        controller.delegate = context.coordinator
        return controller
    }

    public func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}

    public func makeCoordinator() -> Coordinator {
        Coordinator(onPicked: onPicked)
    }

    public final class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let onPicked: (FCPickedImage?) -> Void

        init(onPicked: @escaping (FCPickedImage?) -> Void) {
            self.onPicked = onPicked
        }

        public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)
            guard let provider = results.first?.itemProvider, provider.canLoadObject(ofClass: UIImage.self) else {
                onPicked(nil)
                return
            }
            provider.loadObject(ofClass: UIImage.self) { [onPicked] object, _ in
                DispatchQueue.main.async {
                    onPicked((object as? UIImage).flatMap(FCPickedImage.init(image:)))
                }
            }
        }
    }
}

// MARK: - Camera

public struct FCCameraPicker: UIViewControllerRepresentable {
    let onPicked: (FCPickedImage?) -> Void

    public static var isCameraAvailable: Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
    }

    public func makeUIViewController(context: Context) -> UIImagePickerController {
        let controller = UIImagePickerController()
        controller.sourceType = .camera
        controller.delegate = context.coordinator
        return controller
    }

    public func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    public func makeCoordinator() -> Coordinator {
        Coordinator(onPicked: onPicked)
    }

    public final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onPicked: (FCPickedImage?) -> Void

        init(onPicked: @escaping (FCPickedImage?) -> Void) {
            self.onPicked = onPicked
        }

        public func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            picker.dismiss(animated: true)
            let image = (info[.originalImage] as? UIImage)
            onPicked(image.flatMap(FCPickedImage.init(image:)))
        }

        public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
            onPicked(nil)
        }
    }
}

// MARK: - Camera permission helper (deny/attempt counting like the app)

@MainActor
public enum FCCameraPermission {
    public static func request(env: FarmerChat = .shared) async -> Bool {
        env.prefs.setInt(env.prefs.int(.cameraAttemptCount) + 1, .cameraAttemptCount)
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            return true
        case .notDetermined:
            let granted = await AVCaptureDevice.requestAccess(for: .video)
            if !granted {
                env.prefs.setInt(env.prefs.int(.cameraDenyCount) + 1, .cameraDenyCount)
            }
            return granted
        default:
            env.prefs.setInt(env.prefs.int(.cameraDenyCount) + 1, .cameraDenyCount)
            return false
        }
    }

    /// Settings dialog after 2 denials, matching the app.
    public static func shouldShowSettingsDialog(env: FarmerChat = .shared) -> Bool {
        env.prefs.int(.cameraDenyCount) >= 2
    }
}

@MainActor
public enum FCMicPermission {
    public static func request(env: FarmerChat = .shared, recorder: AudioRecorderService) async -> Bool {
        env.prefs.setInt(env.prefs.int(.micAttemptCount) + 1, .micAttemptCount)
        let granted = await recorder.requestPermission()
        if !granted {
            env.prefs.setInt(env.prefs.int(.micDenyCount) + 1, .micDenyCount)
        }
        return granted
    }

    public static func shouldShowSettingsDialog(env: FarmerChat = .shared) -> Bool {
        env.prefs.int(.micDenyCount) >= 2
    }
}

// MARK: - Share sheet

public struct FCShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    public func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    public func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Legal WebView (port of PolicyWebViewScreen) + Safari

public struct FCWebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool

    public func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: url))
        return webView
    }

    public func updateUIView(_ uiView: WKWebView, context: Context) {}

    public func makeCoordinator() -> Coordinator {
        Coordinator(isLoading: $isLoading)
    }

    public final class Coordinator: NSObject, WKNavigationDelegate {
        @Binding var isLoading: Bool

        init(isLoading: Binding<Bool>) {
            _isLoading = isLoading
        }

        public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isLoading = false
        }

        public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            isLoading = false
        }
    }
}

public struct FCSafariView: UIViewControllerRepresentable {
    let url: URL

    public func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    public func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}

// MARK: - Remote image (Coil analogue; URLSession + cache)

public struct FCRemoteImage: View {
    let urlString: String?
    var contentMode: ContentMode = .fill

    public var body: some View {
        if let urlString, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: contentMode)
                case .failure:
                    Color.gray.opacity(0.15)
                case .empty:
                    ZStack {
                        Color.gray.opacity(0.1)
                        ProgressView()
                    }
                @unknown default:
                    Color.gray.opacity(0.1)
                }
            }
        } else {
            Color.gray.opacity(0.1)
        }
    }
}
