import SwiftUI
import UIKit
import FarmerChatCore

/// Farmer illustration slots — the app's country farmer pictures (CountryImageAssets.kt),
/// bundled in Core as ``FCFarmerIllustration``. `symbol` is the fallback drawn only when a
/// binary build did not carry the resource bundle.
public enum FCIllustration {
    case lookingAtCamera
    case lookingAtSky
    case lookingAtPhone

    var asset: FCFarmerIllustration {
        switch self {
        case .lookingAtCamera: return .lookingAtCamera
        case .lookingAtSky: return .lookingAtSky
        case .lookingAtPhone: return .lookingAtPhone
        }
    }

    var symbol: String {
        switch self {
        case .lookingAtCamera: return "person.crop.square.badge.camera"
        case .lookingAtSky: return "sun.max"
        case .lookingAtPhone: return "iphone.gen3"
        }
    }
}

/// Port of `FullScreenMessage` (app ui/error/NoInternetScreen.kt): the shared green full-screen
/// layout behind Sign up (AccountBenefits), You're all set, No internet / Something went wrong
/// and the location interstitial.
///
/// - `brand.surfacePrimary` ground; a DefaultAppBar WITH its 80pt yellow glow: centred white
///   titleMedium title, an optional 42pt left tile (ArrowBack / Close, Radius.Rounded or MD) and
///   an optional right label tile ("Skip").
/// - The country farmer illustration (Fit, max 322pt wide) in the flexible space, 16pt above and
///   below; then the displaySmall main message and the subtitle (bodyMedium, or bodyLarge where
///   the screen asks), white, 10pt apart, 28pt sides, 28pt above the CTA.
/// - A forced-LIGHT 64pt PrimaryButton (Green800, white label, Green500 chevron), 20pt sides.
///
/// The SDK drew a Green800 ground, an SF symbol, a white CTA with green text and a bottom Skip
/// link — the RN-style version, not the app's.
public struct FCFullScreenMessage: View {
    @Environment(\.fcTheme) private var theme
    /// The main message (app `mainMessage`).
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
    /// App `FullScreenMessage(title =)`: the app-bar title.
    var barTitle: String?
    /// App `leftIcon` = ArrowBack.
    var onBack: (() -> Void)?
    /// App `rightLabel` ("Skip").
    var rightLabel: String?
    var onRight: (() -> Void)?
    /// App `PrimaryButtonState.Chevron`.
    var primaryChevron: Bool = false
    /// App `subtitleTextStyle = bodyLarge` (Sign up, You're all set).
    var subtitleLarge: Bool = false
    /// App `leftRadius` / `rightRadius = Radius.Rounded` (Sign up); MD otherwise.
    var roundedBarActions: Bool = false

    @State private var debounced = false

    public var body: some View {
        ZStack {
            theme.brand.surfacePrimary.ignoresSafeArea()
            VStack(spacing: 0) {
                FCAppBar(
                    title: barTitle ?? "",
                    leading: onBack != nil ? .back : (onClose != nil ? .close : .none),
                    onLeadingTap: onBack ?? onClose,
                    trailing: rightTile,
                    showGlow: true,
                    leadingRadius: roundedBarActions ? 21 : 12
                )

                VStack(spacing: 0) {
                    illustrationView
                        .frame(maxWidth: 322, maxHeight: .infinity)
                        .padding(.vertical, 16)

                    VStack(spacing: 10) {
                        Text(title)
                            .fcTextStyle(theme.typography.displaySmall)
                            .foregroundColor(theme.brand.foregroundPrimary)
                            .multilineTextAlignment(.center)
                        Text(subtitle)
                            .fcTextStyle(subtitleLarge ? theme.typography.bodyLarge : theme.typography.bodyMedium)
                            .foregroundColor(theme.brand.foregroundPrimary)
                            .multilineTextAlignment(.center)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 28)
                }
                .padding(.horizontal, 28)
                .frame(maxWidth: .infinity)

                primaryButton
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)

                if let secondaryTitle, let onSecondary {
                    Button(action: onSecondary) {
                        Text(secondaryTitle)
                            .fcTextStyle(theme.typography.bodyMedium)
                            .foregroundColor(theme.brand.foregroundPrimary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private var illustrationView: some View {
        if let url = illustration.asset.url(prefs: FarmerChat.shared.prefs),
           let image = UIImage(contentsOfFile: url.path) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .accessibilityHidden(true)
        } else {
            Image(systemName: illustration.symbol)
                .font(.system(size: 96, weight: .light))
                .foregroundColor(FCPrimitive.green500)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    /// ActionButton with a label (DefaultAppBar `rightLabel`): 42pt, `brand.surfaceSecondary`.
    private var rightTile: AnyView? {
        guard let rightLabel, let onRight else { return nil }
        return AnyView(
            Button(action: onRight) {
                Text(rightLabel)
                    .fcTextStyle(theme.typography.labelLarge)
                    .foregroundColor(theme.brand.foregroundPrimary)
                    .padding(.horizontal, 16)
                    .frame(minWidth: 42)
                    .frame(height: 42)
                    .background(
                        RoundedRectangle(cornerRadius: roundedBarActions ? 21 : 12, style: .continuous)
                            .fill(theme.brand.surfaceSecondary)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fcAppBarTrailing")
        )
    }

    /// Forced light PrimaryButton (Buttons.kt): Green800, white titleMedium, Green500 chevron.
    private var primaryButton: some View {
        Button(action: primaryTapped) {
            HStack(spacing: 8) {
                if primaryLoading || (enablePrimaryDebounce && debounced) {
                    ProgressView().tint(FCPrimitive.green500)
                }
                Text(primaryTitle)
                    .fcTextStyle(theme.typography.titleMedium)
                    .foregroundColor(.white)
                if primaryChevron && !primaryLoading {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(FCPrimitive.green500)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 64)
            .background(FCPrimitive.green800)
            .clipShape(RoundedRectangle(cornerRadius: theme.shapes.button, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(primaryLoading || debounced)
        .accessibilityIdentifier("fcFullScreenPrimary")
    }

    private func primaryTapped() {
        if enablePrimaryDebounce {
            guard !debounced else { return }
            debounced = true
            // NoInternetScreen.kt: the "Try again" debounce lasts 1500 ms.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { debounced = false }
        }
        onPrimary()
    }
}
