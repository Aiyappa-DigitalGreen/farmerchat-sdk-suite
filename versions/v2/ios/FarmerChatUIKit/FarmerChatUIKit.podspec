Pod::Spec.new do |s|
  s.name             = 'FarmerChatUIKit'
  s.version          = '2.2.0'
  s.summary          = 'FarmerChat full app-as-SDK — UIKit entry (iOS 15+).'
  s.description      = <<-DESC
    Embeddable FarmerChat journey (onboarding, home feed, AI chat with voice
    and image queries, chat history, settings, OTP auth) as a UIKit
    view controller. Networking, session, and state machines come from the
    bundled FarmerChatCore sources. No third-party analytics SDKs — events
    are emitted through a host-pluggable listener.
  DESC
  s.homepage         = 'https://github.com/digitalgreenorg/farmerchat-sdk-suite'
  s.license          = { :type => 'Apache-2.0' }
  s.author           = { 'Digital Green' => 'support@digitalgreen.org' }
  s.source           = { :git => 'https://github.com/digitalgreenorg/farmerchat-sdk-suite.git', :tag => "ios-v#{s.version}" }

  s.swift_version    = '5.9'
  s.ios.deployment_target = '15.0'

  # CocoaPods consumers get Core + UIKit in one pod (SPM users take the two
  # packages separately).
  s.source_files = [
    'Sources/FarmerChatUIKit/**/*.swift',
    '../FarmerChatCore/Sources/FarmerChatCore/**/*.swift'
  ]

  s.frameworks = 'UIKit', 'AVFoundation', 'CoreLocation', 'Security', 'SafariServices', 'WebKit', 'Photos', 'PhotosUI'
end
