import SwiftUI
import FarmerChatCore

/// Farmer illustration slots (the app ships PNG illustrations; the SDK uses
/// SF-symbol compositions to stay asset-free).
public enum FCIllustration {
    case lookingAtCamera
    case lookingAtSky
    case lookingAtPhone

    var symbol: String {
        switch self {
        case .lookingAtCamera: return "person.crop.square.badge.camera"
        case .lookingAtSky: return "sun.max"
        case .lookingAtPhone: return "iphone.gen3"
        }
    }
}

/// Port of `FullScreenMessage` (NoInternetScreen.kt): shared green full-screen
/// layout — app bar with yellow glow, illustration, title/subtitle, forced
/// light-mode primary button, optional secondary CTA, optional debounce.
public struct FCFullScreenMessage: View {
    let title: String
    let subtitle: String
    var illustration: FCIllustration = .lookingAtSky
    let primaryTitle: String
    var primaryLoading: Bool = false
    var enablePrimaryDebounce: Bool = false
    let onPrimary: () -> Void
    var secondaryTitle: String?
    var onSecondary: (() -> Void)?
    var onClose: (() -> Void)?

    @State private var debounced = false

    public var body: some View {
        ZStack {
            FCPrimitive.green800.ignoresSafeArea()
            VStack(spacing: 0) {
                // App bar with yellow glow behind the logo.
                HStack {
                    ZStack {
                        Circle()
                            .fill(FCPrimitive.sun300.opacity(0.35))
                            .frame(width: 84, height: 84)
                            .blur(radius: 26)
                        FCLogoMark(size: 36, tint: .white)
                    }
                    Spacer()
                    if let onClose {
                        Button(action: onClose) {
                            Image(systemName: "xmark")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .frame(height: 64)

                Spacer()

                Image(systemName: illustration.symbol)
                    .font(.system(size: 96, weight: .light))
                    .foregroundColor(FCPrimitive.green500)
                    .padding(.bottom, 40)

                Text(title)
                    .font(.system(size: 30, weight: .bold))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

                Text(subtitle)
                    .font(.system(size: 17))
                    .foregroundColor(.white.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
                    .padding(.top, 12)

                Spacer()

                VStack(spacing: 12) {
                    // Forced light-mode primary button.
                    Button(action: primaryTapped) {
                        HStack(spacing: 8) {
                            if primaryLoading {
                                ProgressView().tint(FCPrimitive.green800)
                            }
                            Text(primaryTitle)
                                .font(.system(size: 17, weight: .semibold))
                        }
                        .foregroundColor(FCPrimitive.green800)
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(primaryLoading || debounced)

                    if let secondaryTitle, let onSecondary {
                        Button(action: onSecondary) {
                            Text(secondaryTitle)
                                .font(.system(size: 17, weight: .medium))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 48)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 24)
            }
        }
        .preferredColorScheme(.dark) // status bar legibility on green
    }

    private func primaryTapped() {
        if enablePrimaryDebounce {
            guard !debounced else { return }
            debounced = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { debounced = false }
        }
        onPrimary()
    }
}
