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
    /// Read for typography only — this screen deliberately paints fixed green primitives
    /// rather than theme colors (it is a forced-light brand surface), but the type scale must
    /// still follow the farmer's language.
    @Environment(\.fcTheme) private var theme
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
    /// App `FullScreenMessage(title =)`: the app-bar title (the GPS interstitial's "Share Location").
    var barTitle: String?
    /// App `leftIcon` ← (interstitial Back). Replaces the logo glow when set.
    var onBack: (() -> Void)?
    /// App `rightLabel` text action (interstitial "Skip").
    var rightLabel: String?
    var onRight: (() -> Void)?
    /// App `PrimaryButtonState.Chevron`: a trailing chevron on the primary CTA.
    var primaryChevron: Bool = false

    @State private var debounced = false

    public var body: some View {
        ZStack {
            FCPrimitive.green800.ignoresSafeArea()
            VStack(spacing: 0) {
                // App bar with yellow glow behind the logo.
                HStack(spacing: 8) {
                    if let onBack {
                        Button(action: onBack) {
                            Image(systemName: "arrow.left")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(width: 44, height: 44)
                        }
                        .buttonStyle(.plain)
                    } else {
                    ZStack {
                        // App parity (AppBars.kt:189-194): DefaultAppBar's glow is 80dp
                        // tall and lives INSIDE the bar, at full alpha. iOS previously drew
                        // an 84pt circle here (and earlier revisions a 120pt page-wide glow).
                        Circle()
                            .fill(FCPrimitive.sun300.opacity(0.35))
                            .frame(width: 80, height: 80)
                            .blur(radius: 26)
                        FCLogoMark(size: 36, tint: .white)
                    }
                    }
                    if let barTitle {
                        Text(barTitle)
                            .fcTextStyle(theme.typography.titleMedium)
                            .foregroundColor(.white)
                            .lineLimit(1)
                    }
                    Spacer()
                    if let rightLabel, let onRight {
                        Button(action: onRight) {
                            Text(rightLabel)
                                .fcTextStyle(theme.typography.labelLarge)
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .frame(height: 44)
                        }
                        .buttonStyle(.plain)
                    }
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
                    .padding(.vertical, 16)

                Spacer()

                // App parity (FullScreenMessage.kt:124-144): the text column is 10dp-spaced
                // and sits 28dp above the CTA, inside a 28dp horizontal inset. iOS had a
                // 32dp inset and a 12dp gap.
                VStack(spacing: 10) {
                    Text(title)
                        .fcTextStyle(theme.typography.displaySmall)
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)

                    Text(subtitle)
                        .fcTextStyle(theme.typography.bodyMedium)
                        .foregroundColor(.white.opacity(0.85))
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 28)
                .padding(.bottom, 28)

                VStack(spacing: 0) {
                    // Forced light-mode primary button. 64pt tall per
                    // FullScreenMessage.kt:167; the label is `labelLarge` because android
                    // routes it through PrimaryButton (Buttons.kt:110) — `bodyMedium` at
                    // FullScreenMessage.kt:59 is the *subtitle* default, not this.
                    Button(action: primaryTapped) {
                        HStack(spacing: 8) {
                            if primaryLoading {
                                ProgressView().tint(FCPrimitive.green800)
                            }
                            Text(primaryTitle)
                                .fcTextStyle(theme.typography.labelLarge)
                            if primaryChevron && !primaryLoading {
                                Image(systemName: "chevron.right")
                                    .font(.system(size: 15, weight: .semibold))
                            }
                        }
                        .foregroundColor(FCPrimitive.green800)
                        .frame(maxWidth: .infinity)
                        .frame(height: 64)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .disabled(primaryLoading || debounced)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)

                    if let secondaryTitle, let onSecondary {
                        Button(action: onSecondary) {
                            Text(secondaryTitle)
                                .fcTextStyle(theme.typography.bodyMedium)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                        }
                        .buttonStyle(.plain)
                    }
                }
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
