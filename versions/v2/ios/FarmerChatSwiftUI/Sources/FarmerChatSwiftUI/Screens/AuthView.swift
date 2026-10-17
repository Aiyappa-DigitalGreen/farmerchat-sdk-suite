import SwiftUI
import FarmerChatCore

/// Port of AuthScreen: PhoneEntry (country selector + WhatsApp/SMS buttons)
/// and OtpEntry (4-digit input with .oneTimeCode autofill, 180 s countdown,
/// Resend/Start-over). Country picker as a full-screen sheet with search.
struct AuthView: View {
    @Environment(\.fcTheme) private var theme
    @EnvironmentObject var router: FCRouter
    @StateObject private var viewModel = AuthViewModel()
    @StateObject private var toast = FCToastState()
    @State private var showCountryPicker = false
    @State private var didAppear = false

    var body: some View {
        VStack(spacing: 0) {
            FCAppBar(
                // AuthScreen.kt:426 — "Sign up".
                title: fcLabel(FCLabels.signUp, "Sign up"),
                leading: .close,
                onLeadingTap: { router.pop() }
            )

            ScrollView {
                switch viewModel.state.step {
                case .phoneEntry:
                    phoneEntry
                case .otpEntry:
                    otpEntry
                }
            }
        }
        .background(theme.content.surfacePrimary.ignoresSafeArea())
        .fcToastHost(toast)
        .task {
            guard !didAppear else { return }
            didAppear = true
            let env = FarmerChat.shared
            env.analytics.screenViewed(ScreenNames.auth)
            viewModel.trackVerificationStarted()
            viewModel.fetchCountries()
        }
        .onChange(of: viewModel.state.toast) { authToast in
            guard let authToast else { return }
            toast.show(authToast.kind == .error ? .error : .info, authToast.message)
            viewModel.consumeToast()
        }
        .onChange(of: viewModel.state.verifyOtpState.isSuccess) { success in
            guard success else { return }
            // App delays 800 ms before onSuccess.
            Task {
                try? await Task.sleep(nanoseconds: 800_000_000)
                FarmerChat.shared.analytics.screenExited(ScreenNames.verifyOtp)
                router.onAuthSuccess()
            }
        }
        .sheet(isPresented: $showCountryPicker) {
            CountryPickerSheet(
                countries: viewModel.state.countries,
                selected: viewModel.state.selectedCountry,
                onSave: { country in
                    viewModel.selectCountry(country)
                    showCountryPicker = false
                }
            )
        }
        .sheet(item: $router.legalSheet) { item in
            LegalContentView(url: item.url, title: item.title)
        }
    }

    // MARK: - Phone entry step

    private var phoneEntry: some View {
        VStack(alignment: .leading, spacing: 16) {
            // App parity (AuthScreen.kt:801-814). THREE things were wrong here, not just the
            // type: the label keys were SDK inventions (`auth_title` / `auth_subtitle`) that
            // endpoint #3 serves for nobody, so every farmer read the English fallback whatever
            // their language; the fallback copy itself was invented rather than the app's; and
            // the headings were left-aligned at 24/16 pt where the app centres them at 22/17.
            Text(isSending
                 ? fcLabel(FCLabels.enterPhoneNumber, "Enter phone number")
                 : fcLabel(FCLabels.enterYourPhoneNumber, "Enter your phone number"))
                .fcTextStyle(theme.typography.titleLarge)
                .foregroundColor(theme.content.foregroundPrimary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.top, 8)

            Text(isSending
                 ? fcLabel(FCLabels.sendOtpSigninShort, "And we will send you a one time code")
                 : fcLabel(FCLabels.sendOtpSignin, "We'll send a one-time code to sign you in"))
                .fcTextStyle(theme.typography.bodyMedium)
                .foregroundColor(theme.content.foregroundSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.top, -8)
                .padding(.bottom, 8)

            HStack(spacing: 8) {
                // CountryCodeSelector
                Button(action: { showCountryPicker = true }) {
                    HStack(spacing: 6) {
                        if viewModel.state.isLoadingCountries {
                            ProgressView().scaleEffect(0.8)
                        } else {
                            if let url = viewModel.state.selectedCountry?.flagImageURL {
                                FCRemoteImage(urlString: url.absoluteString, contentMode: .fit)
                                    .frame(width: 24, height: 16)
                            } else {
                                Text(viewModel.state.selectedCountry?.flagText ?? "🌐")
                            }
                            Text(viewModel.state.countryCode)
                                .fcTextStyle(theme.typography.bodyMedium)
                                .foregroundColor(theme.content.foregroundPrimary)
                        }
                    }
                    .padding(.horizontal, 12)
                    .frame(minWidth: 90)
                    .frame(height: 56)
                    .background(theme.content.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(theme.content.borderDefault, lineWidth: 0.5)
                    )
                }
                .buttonStyle(.plain)
                .disabled(isSending)

                FCTextField(
                    // App parity (AuthScreen): the phone field's placeholder is the literal digit mask,
                    // not a label. `phone_placeholder` was never a served key. Matches the same
                    // fix on android compose — see docs/04 "Label-key resolution audit".
                    placeholder: "00000 00000",
                    text: Binding(
                        get: { viewModel.state.phoneLocal },
                        set: { viewModel.setPhoneLocal($0) }
                    ),
                    keyboard: .phonePad,
                    contentType: .telephoneNumber,
                    autoFocus: true
                )
            }

            if let phoneError = viewModel.state.phoneError {
                Text(phoneError)
                    .fcTextStyle(theme.typography.labelSmall)
                    .foregroundColor(FCPrimitive.red500)
            }

            // AuthScreen.kt AgreementCard, 20pt under the phone row.
            agreementCard
                .padding(.top, 4)

            if viewModel.state.isLoadingChannels {
                ProgressView().frame(maxWidth: .infinity)
            } else if isSending {
                // AuthScreen.kt:893 — one loading button while the code is being sent.
                FCPrimaryButton(
                    title: fcLabel(FCLabels.sendingCode, "Sending code..."),
                    state: .loading,
                    action: {},
                    height: 56
                )
            } else {
                VStack(spacing: 8) {
                    if viewModel.state.availableChannels.whatsappEnabled {
                        sendButton(
                            title: fcLabel(FCLabels.sendViaWhatsapp, "Send via WhatsApp"),
                            icon: "phone.bubble.left.fill",
                            id: "fcAuthSendWhatsapp"
                        ) { viewModel.sendOtp(channel: "whatsapp") }
                    }
                    if viewModel.state.availableChannels.smsEnabled {
                        sendButton(
                            title: fcLabel(FCLabels.sendViaSms, "Send via SMS"),
                            icon: "message.fill",
                            id: "fcAuthSendSms"
                        ) { viewModel.sendOtp(channel: "sms") }
                    }
                }
            }

            consentText
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private var isSending: Bool { viewModel.state.sendOtpState.isLoading }

    /// AuthScreen.kt AgreementCard: Neutral200, radius 16, 18/12 padding; bold 18pt title,
    /// two 15pt bullets, a bold-italic 14pt note — black on the light card.
    private var agreementCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(fcLabel(FCLabels.agreementCardTitle, "What you are agreeing to:"))
                .font(.system(size: 18, weight: .bold))
            VStack(alignment: .leading, spacing: 2) {
                bullet(fcLabel(FCLabels.agreementPointVerificationCode, "A verification code by SMS or WhatsApp"))
                bullet(fcLabel(FCLabels.agreementPointUpdates, "FarmerChat updates, farming information, and occasional surveys or research by SMS, phone, or WhatsApp"))
            }
            Text(fcLabel(FCLabels.agreementCardInfoText, "Surveys or research may be conducted by Digital Green or trusted partners working with us."))
                .font(.system(size: 14, weight: .bold).italic())
        }
        .foregroundColor(.black)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(red: 0xE4 / 255, green: 0xE4 / 255, blue: 0xE7 / 255)))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("fcAuthAgreement")
    }

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 0) {
            Text("•").font(.system(size: 15)).frame(width: 16, alignment: .leading)
            Text(text).font(.system(size: 15)).fixedSize(horizontal: false, vertical: true)
        }
    }

    /// PrimaryButton with a leading icon, 48pt (AuthScreen.kt:907-930).
    private func sendButton(title: String, icon: String, id: String, action: @escaping () -> Void) -> some View {
        let enabled = viewModel.isPhoneValid()
        return Button(action: { if enabled { action() } }) {
            HStack(spacing: 8) {
                Image(systemName: icon).font(.system(size: 17, weight: .semibold))
                    .foregroundColor(theme.content.buttonPrimaryAccent.opacity(enabled ? 1 : 0.5))
                Text(title)
                    .fcTextStyle(theme.typography.titleMedium)
                    .foregroundColor(theme.content.buttonPrimaryForeground.opacity(enabled ? 1 : 0.5))
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(theme.content.buttonPrimarySurface)
            .clipShape(RoundedRectangle(cornerRadius: theme.shapes.button, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }

    /// AuthConsentText: centred 15pt secondary, prefix + underlined "Privacy Policy" + suffix.
    private var consentText: some View {
        Button {
            router.openLegal(
                url: "https://digitalgreen.org/privacy-policy/",
                title: fcLabel(FCLabels.privacyPolicy, "Privacy policy")
            )
        } label: {
            (Text(fcLabel(FCLabels.authConsentPrefix, "By continuing, you agree to these communications.\nSee our "))
             + Text(fcLabel(FCLabels.privacyPolicy, "Privacy Policy")).underline()
             + Text(" " + fcLabel(FCLabels.authConsentSuffix, "for more information, including how to withdraw your consent.")))
                .font(.system(size: 15))
                .foregroundColor(theme.content.foregroundSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }

    private func sendState(for channel: String) -> PrimaryButtonState {
        viewModel.state.sendOtpState.isLoading && viewModel.state.lastChannel == channel ? .loading : .normal
    }

    // MARK: - OTP entry step

    private var otpEntry: some View {
        VStack(alignment: .leading, spacing: 16) {
            // App parity (AuthScreen.kt:1039-1050) — same three problems as the phone step:
            // invented keys, invented copy, wrong type and alignment. Note the app's OTP
            // subtitle carries NO phone-number parameter; it is a fixed sentence.
            Text(fcLabel(FCLabels.enterCodeWeSent, "Enter the code we sent"))
                .fcTextStyle(theme.typography.titleLarge)
                .foregroundColor(theme.content.foregroundPrimary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.top, 8)

            Text(fcLabel(FCLabels.checkYourMessagesCode, "Check your messages for the code"))
                .fcTextStyle(theme.typography.bodyMedium)
                .foregroundColor(theme.content.foregroundSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)

            FCOtpInput(
                otp: Binding(
                    get: { viewModel.state.otp },
                    set: { viewModel.setOtp($0) }
                ),
                length: AuthViewModel.otpLength
            )
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)

            if let otpError = viewModel.state.otpError {
                Text(otpError)
                    .fcTextStyle(theme.typography.labelSmall)
                    .foregroundColor(FCPrimitive.red500)
            }

            FCPrimaryButton(
                title: fcLabel(FCLabels.verify, "Verify"),
                state: viewModel.state.verifyOtpState.isLoading ? .loading : .normal,
                enabled: viewModel.state.otp.count == AuthViewModel.otpLength,
                action: { viewModel.verifyOtp() }
            )

            // Countdown / resend / start-over.
            if viewModel.state.otpSecondsRemaining > 0 {
                Text(fcLabel("otp_resend_in", "Resend code in {time}", params: ["time": timerText]))
                    .fcTextStyle(theme.typography.bodySmall)
                    .foregroundColor(theme.content.foregroundSecondary)
                    .frame(maxWidth: .infinity)
            } else {
                HStack(spacing: 20) {
                    Button(fcLabel(FCLabels.resendCode, "Resend code")) { viewModel.resendOtp() }
                    Button(fcLabel(FCLabels.startOver, "Start over")) { viewModel.startOver() }
                }
                .fcTextStyle(theme.typography.labelLarge)
                .foregroundColor(theme.brand.surfacePrimary)
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private var timerText: String {
        let remaining = viewModel.state.otpSecondsRemaining
        return String(format: "%d:%02d", remaining / 60, remaining % 60)
    }
}

// MARK: - Country picker (full-screen sheet with search + radio list + Save)

struct CountryPickerSheet: View {
    @Environment(\.fcTheme) private var theme
    @Environment(\.dismiss) private var dismiss
    let countries: [CountryItem]
    let selected: CountryItem?
    let onSave: (CountryItem) -> Void

    @State private var search = ""
    @State private var pending: CountryItem?

    var body: some View {
        VStack(spacing: 0) {
            FCAppBar(
                title: fcLabel(FCLabels.selectCountryCode, "Select country code"),
                leading: .close,
                onLeadingTap: { dismiss() }
            )

            FCTextField(
                placeholder: fcLabel(FCLabels.search, "Search"),
                text: $search
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 8)

            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(filtered) { country in
                        FCRadioRow(
                            title: [country.flagText, country.displayName ?? country.name].compactMap { $0 }.joined(separator: " "),
                            subtitle: country.phoneCountryCode.map { $0.hasPrefix("+") ? $0 : "+\($0)" },
                            selected: (pending ?? selected) == country,
                            action: { pending = country }
                        )
                    }
                }
                .padding(.horizontal, 8)
            }

            FCPrimaryButton(
                title: fcLabel(FCLabels.save, "Save"),
                enabled: (pending ?? selected) != nil,
                action: {
                    if let choice = pending ?? selected {
                        onSave(choice)
                    }
                }
            )
            .padding(16)
        }
        .background(theme.content.surfacePrimary.ignoresSafeArea())
    }

    private var filtered: [CountryItem] {
        let query = search.trimmingCharacters(in: .whitespaces).lowercased()
        guard !query.isEmpty else { return countries }
        return countries.filter { country in
            (country.displayName ?? "").lowercased().contains(query)
                || (country.name ?? "").lowercased().contains(query)
                || (country.phoneCountryCode ?? "").contains(query)
        }
    }
}
