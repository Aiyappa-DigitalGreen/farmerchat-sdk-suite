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
                title: "",
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
            Text(fcLabel(FCLabels.enterYourPhoneNumber, "Enter your phone number"))
                .fcTextStyle(theme.typography.titleLarge)
                .foregroundColor(theme.content.foregroundPrimary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.top, 8)

            Text(fcLabel(FCLabels.sendOtpSignin, "We'll send a one-time code to sign you in"))
                .fcTextStyle(theme.typography.bodyMedium)
                .foregroundColor(theme.content.foregroundSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)

            HStack(spacing: 10) {
                // CountryCodeSelector
                Button(action: { showCountryPicker = true }) {
                    HStack(spacing: 6) {
                        if viewModel.state.isLoadingCountries {
                            ProgressView().scaleEffect(0.8)
                        } else {
                            Text(viewModel.state.selectedCountry?.flag ?? "🌐")
                            Text(viewModel.state.countryCode)
                                .fcTextStyle(theme.typography.bodyMedium)
                                .foregroundColor(theme.content.foregroundPrimary)
                            Image(systemName: "chevron.down")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(theme.content.foregroundSecondary)
                        }
                    }
                    .padding(.horizontal, 12)
                    .frame(height: 56)
                    .background(theme.content.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(theme.content.borderDefault, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)

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

            if viewModel.state.isLoadingChannels {
                ProgressView().frame(maxWidth: .infinity)
            } else {
                VStack(spacing: 10) {
                    if viewModel.state.availableChannels.whatsappEnabled {
                        FCPrimaryButton(
                            title: fcLabel("send_code_whatsapp", "Get code on WhatsApp"),
                            state: sendState(for: "whatsapp"),
                            enabled: viewModel.isPhoneValid(),
                            action: { viewModel.sendOtp(channel: "whatsapp") }
                        )
                    }
                    if viewModel.state.availableChannels.smsEnabled {
                        FCPrimaryButton(
                            title: fcLabel("send_code_sms", "Get code by SMS"),
                            state: sendState(for: "sms"),
                            enabled: viewModel.isPhoneValid(),
                            action: { viewModel.sendOtp(channel: "sms") }
                        )
                    }
                }
                .padding(.top, 8)
            }

            legalFooter
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private func sendState(for channel: String) -> PrimaryButtonState {
        viewModel.state.sendOtpState.isLoading && viewModel.state.lastChannel == channel ? .loading : .normal
    }

    private var legalFooter: some View {
        Button {
            router.openLegal(
                url: "https://digitalgreen.org/privacy-policy/",
                title: fcLabel(FCLabels.privacyPolicy, "Privacy policy")
            )
        } label: {
            Text(fcLabel(FCLabels.termsPrivacyAgreement, "By continuing you agree to our Terms and Privacy policy"))
                .fcTextStyle(theme.typography.bodySmall)
                .foregroundColor(theme.content.foregroundSecondary)
                .multilineTextAlignment(.leading)
        }
        .buttonStyle(.plain)
        .padding(.top, 4)
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
                title: fcLabel(FCLabels.selectCountryCode, "Select country"),
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
                            title: "\(country.flag ?? "") \(country.displayName ?? country.name ?? "")",
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
