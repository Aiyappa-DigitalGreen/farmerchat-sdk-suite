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
            Text(fcLabel("auth_title", "Sign up with phone number"))
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(theme.content.foregroundPrimary)
                .padding(.top, 8)

            Text(fcLabel("auth_subtitle", "We'll send you a verification code"))
                .font(.system(size: 16))
                .foregroundColor(theme.content.foregroundSecondary)

            HStack(spacing: 10) {
                // CountryCodeSelector
                Button(action: { showCountryPicker = true }) {
                    HStack(spacing: 6) {
                        if viewModel.state.isLoadingCountries {
                            ProgressView().scaleEffect(0.8)
                        } else {
                            Text(viewModel.state.selectedCountry?.flag ?? "🌐")
                            Text(viewModel.state.countryCode)
                                .font(.system(size: 17, weight: .medium))
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
                    placeholder: fcLabel("phone_placeholder", "Phone number"),
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
                    .font(.system(size: 13))
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
                title: fcLabel("privacy_policy", "Privacy policy")
            )
        } label: {
            Text(fcLabel("auth_legal", "By continuing you agree to our Terms and Privacy policy"))
                .font(.system(size: 12))
                .foregroundColor(theme.content.foregroundSecondary)
                .multilineTextAlignment(.leading)
        }
        .buttonStyle(.plain)
        .padding(.top, 4)
    }

    // MARK: - OTP entry step

    private var otpEntry: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(fcLabel("otp_title", "Enter the 4-digit code"))
                .font(.system(size: 24, weight: .bold))
                .foregroundColor(theme.content.foregroundPrimary)
                .padding(.top, 8)

            Text(fcLabel("otp_subtitle", "Sent to {phone}", params: ["phone": viewModel.phoneE164]))
                .font(.system(size: 16))
                .foregroundColor(theme.content.foregroundSecondary)

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
                    .font(.system(size: 13))
                    .foregroundColor(FCPrimitive.red500)
            }

            FCPrimaryButton(
                title: fcLabel("verify", "Verify"),
                state: viewModel.state.verifyOtpState.isLoading ? .loading : .normal,
                enabled: viewModel.state.otp.count == AuthViewModel.otpLength,
                action: { viewModel.verifyOtp() }
            )

            // Countdown / resend / start-over.
            if viewModel.state.otpSecondsRemaining > 0 {
                Text(fcLabel("otp_resend_in", "Resend code in {time}", params: ["time": timerText]))
                    .font(.system(size: 14))
                    .foregroundColor(theme.content.foregroundSecondary)
                    .frame(maxWidth: .infinity)
            } else {
                HStack(spacing: 20) {
                    Button(fcLabel("otp_resend", "Resend code")) { viewModel.resendOtp() }
                    Button(fcLabel("otp_start_over", "Start over")) { viewModel.startOver() }
                }
                .font(.system(size: 15, weight: .semibold))
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
                title: fcLabel("select_country", "Select country"),
                leading: .close,
                onLeadingTap: { dismiss() }
            )

            FCTextField(
                placeholder: fcLabel("search", "Search"),
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
                title: fcLabel("save", "Save"),
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
