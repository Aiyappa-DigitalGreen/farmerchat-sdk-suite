//
//  FCLabelKeys.swift
//  FarmerChatUIKit
//
//  GENERATED — the Objective-C-reachable form of `FarmerChatCore.FCLabels`.
//
//  `FCLabels` is a Swift `enum` with `static let` members, which is **invisible to Objective-C**.
//  Without this file an Objective-C host populating `FCFarmerChatConfiguration.stringOverrides`
//  would hand-type bare keys like `"feed_footer"` — exactly the defect that left 96% of iOS label
//  call sites unable to resolve a server label (see `docs/05-open-questions.md`). Overrides are
//  matched on the canonical key, so a bare key silently never applies.
//
//  Every member **references `FCLabels` rather than restating the string**, deliberately: two
//  generated copies of 263 literals would drift the first time someone added a key to one of them,
//  with nothing to catch it. This way `FCLabels` is the single source of truth and a key removed
//  or renamed there fails THIS file's compilation.
//
//  Members whose name is a C/Objective-C reserved word are suffixed `Label` (`continue` →
//  `continueLabel`, `auto` → `autoLabel`) — a bare `continue` cannot be a selector in a `.m`.
//

import Foundation
import FarmerChatCore

/// Canonical server label keys (263), reachable from Objective-C as class properties:
/// `FCLabelKeys.recentChats`, `[FCLabelKeys shareLocation]`.
@objc(FCLabelKeys)
public final class FCLabelKeys: NSObject {
    private override init() { super.init() }

    @objc public static let acceptAndContinue = FCLabels.acceptAndContinue
    @objc public static let accessDenied = FCLabels.accessDenied
    @objc public static let accountDetails = FCLabels.accountDetails
    @objc public static let addOneClearPhoto = FCLabels.addOneClearPhoto
    @objc public static let agreementCardInfoText = FCLabels.agreementCardInfoText
    @objc public static let agreementCardTitle = FCLabels.agreementCardTitle
    @objc public static let agreementPointSurveys = FCLabels.agreementPointSurveys
    @objc public static let agreementPointUpdates = FCLabels.agreementPointUpdates
    @objc public static let agreementPointVerificationCode = FCLabels.agreementPointVerificationCode
    @objc public static let aiMayBeWrongPleaseDoubleCheck = FCLabels.aiMayBeWrongPleaseDoubleCheck
    @objc public static let allLanguages = FCLabels.allLanguages
    @objc public static let allSet = FCLabels.allSet
    @objc public static let allowLocationInSettings = FCLabels.allowLocationInSettings
    @objc public static let alsoSee = FCLabels.alsoSee
    @objc public static let appearance = FCLabels.appearance
    @objc public static let applyLanguage = FCLabels.applyLanguage
    @objc public static let applyingLanguage = FCLabels.applyingLanguage
    @objc public static let approximate = FCLabels.approximate
    @objc public static let ask = FCLabels.ask
    @objc public static let askAFollowupQuestions = FCLabels.askAFollowupQuestions
    @objc public static let askAboutYourFarm = FCLabels.askAboutYourFarm
    @objc public static let askSpecificCrops = FCLabels.askSpecificCrops
    @objc public static let askYourFarmingQuestion = FCLabels.askYourFarmingQuestion
    @objc public static let asrIsDisabledForYourSelectedLanguage = FCLabels.asrIsDisabledForYourSelectedLanguage
    @objc public static let audioNotAvailable = FCLabels.audioNotAvailable
    @objc public static let authConsentPrefix = FCLabels.authConsentPrefix
    @objc public static let authConsentSuffix = FCLabels.authConsentSuffix
    @objc public static let autoLabel = FCLabels.auto
    @objc public static let back = FCLabels.back
    @objc public static let byContinuingToVerificationYouAreAcceptingOur = FCLabels.byContinuingToVerificationYouAreAcceptingOur
    @objc public static let byContinuingYouAgreeToOur = FCLabels.byContinuingYouAgreeToOur
    @objc public static let byTappingGetStartedYouAgreeToOur = FCLabels.byTappingGetStartedYouAgreeToOur
    @objc public static let camera = FCLabels.camera
    @objc public static let cameraPermissionRequired = FCLabels.cameraPermissionRequired
    @objc public static let cancel = FCLabels.cancel
    @objc public static let cantLoadRightNow = FCLabels.cantLoadRightNow
    @objc public static let change = FCLabels.change
    @objc public static let characters = FCLabels.characters
    @objc public static let checkYourInternetConnection = FCLabels.checkYourInternetConnection
    @objc public static let checkYourMessagesCode = FCLabels.checkYourMessagesCode
    @objc public static let chooseAFollowupOptionBelow = FCLabels.chooseAFollowupOptionBelow
    @objc public static let chooseOne = FCLabels.chooseOne
    @objc public static let chooseSimNumber = FCLabels.chooseSimNumber
    @objc public static let chooseYourLanguage = FCLabels.chooseYourLanguage
    @objc public static let close = FCLabels.close
    @objc public static let comebackTomorrow = FCLabels.comebackTomorrow
    @objc public static let confirm = FCLabels.confirm
    @objc public static let connectionStoppedPartialSaved = FCLabels.connectionStoppedPartialSaved
    @objc public static let continueLabel = FCLabels.`continue`
    @objc public static let continueWithoutLocation = FCLabels.continueWithoutLocation
    @objc public static let couldntGetYourLocation = FCLabels.couldntGetYourLocation
    @objc public static let couldntLoadMoreChats = FCLabels.couldntLoadMoreChats
    @objc public static let countryCode = FCLabels.countryCode
    @objc public static let countryPhoneFormat = FCLabels.countryPhoneFormat
    @objc public static let day = FCLabels.day
    @objc public static let didYouKnow = FCLabels.didYouKnow
    @objc public static let digitalGreen = FCLabels.digitalGreen
    @objc public static let dontSeeYourOption = FCLabels.dontSeeYourOption
    @objc public static let enterCodeWeSent = FCLabels.enterCodeWeSent
    @objc public static let enterPhoneNumber = FCLabels.enterPhoneNumber
    @objc public static let enterYourName = FCLabels.enterYourName
    @objc public static let enterYourPhoneNumber = FCLabels.enterYourPhoneNumber
    @objc public static let estimated = FCLabels.estimated
    @objc public static let failedToGetResponse = FCLabels.failedToGetResponse
    @objc public static let failedToLoadChatHistory = FCLabels.failedToLoadChatHistory
    @objc public static let failedToLoadChats = FCLabels.failedToLoadChats
    @objc public static let failedToProcessAudio = FCLabels.failedToProcessAudio
    @objc public static let failedToProcessImage = FCLabels.failedToProcessImage
    @objc public static let failedToSave = FCLabels.failedToSave
    @objc public static let failedToStartRecording = FCLabels.failedToStartRecording
    @objc public static let faq = FCLabels.faq
    @objc public static let farmerchat = FCLabels.farmerchat
    @objc public static let farmerchatAdjustsYourPhoneSettings = FCLabels.farmerchatAdjustsYourPhoneSettings
    @objc public static let farmerchatAlwaysDarkMode = FCLabels.farmerchatAlwaysDarkMode
    @objc public static let farmerchatAlwaysLightMode = FCLabels.farmerchatAlwaysLightMode
    @objc public static let farmerchatCouldntLoad = FCLabels.farmerchatCouldntLoad
    @objc public static let farmerchatNeedsTheInternet = FCLabels.farmerchatNeedsTheInternet
    @objc public static let farmerchatStarting = FCLabels.farmerchatStarting
    @objc public static let farmerchatTagline = FCLabels.farmerchatTagline
    @objc public static let farmerchatV200 = FCLabels.farmerchatV200
    @objc public static let forYourFarmToday = FCLabels.forYourFarmToday
    @objc public static let gallery = FCLabels.gallery
    @objc public static let getAdviceYourArea = FCLabels.getAdviceYourArea
    @objc public static let getLocalAdvice = FCLabels.getLocalAdvice
    @objc public static let getStarted = FCLabels.getStarted
    @objc public static let getStartedByClickingOnPhotoSpeakOrTypeToAskYourQuestion = FCLabels.getStartedByClickingOnPhotoSpeakOrTypeToAskYourQuestion
    @objc public static let gettingTodaysAdvice = FCLabels.gettingTodaysAdvice
    @objc public static let gettingYourAnswer = FCLabels.gettingYourAnswer
    @objc public static let gettingYourLocation = FCLabels.gettingYourLocation
    @objc public static let goToSettings = FCLabels.goToSettings
    @objc public static let haveAGreatDayComeBackTomorrow = FCLabels.haveAGreatDayComeBackTomorrow
    @objc public static let hello = FCLabels.hello
    @objc public static let help = FCLabels.help
    @objc public static let helpSupport = FCLabels.helpSupport
    @objc public static let home = FCLabels.home
    @objc public static let howDidThingsGoToday = FCLabels.howDidThingsGoToday
    @objc public static let howToUseFarmerchat = FCLabels.howToUseFarmerchat
    @objc public static let howWeHelpYouEvening = FCLabels.howWeHelpYouEvening
    @objc public static let howWeHelpYouMorning = FCLabels.howWeHelpYouMorning
    @objc public static let howWeHelpYouToday = FCLabels.howWeHelpYouToday
    @objc public static let howsFarmGoingToday = FCLabels.howsFarmGoingToday
    @objc public static let howsFarmLookingMorning = FCLabels.howsFarmLookingMorning
    @objc public static let invalidRequestPleaseTryAgain = FCLabels.invalidRequestPleaseTryAgain
    @objc public static let language = FCLabels.language
    @objc public static let languageUpdated = FCLabels.languageUpdated
    @objc public static let linkUnavailable = FCLabels.linkUnavailable
    @objc public static let listen = FCLabels.listen
    @objc public static let listening = FCLabels.listening
    @objc public static let loading = FCLabels.loading
    @objc public static let loadingChats = FCLabels.loadingChats
    @objc public static let loadingLanguages = FCLabels.loadingLanguages
    @objc public static let loadingMore = FCLabels.loadingMore
    @objc public static let location = FCLabels.location
    @objc public static let locationFound = FCLabels.locationFound
    @objc public static let locationGpsTurnedOff = FCLabels.locationGpsTurnedOff
    @objc public static let locationGpsTurnedOffTurningHelps = FCLabels.locationGpsTurnedOffTurningHelps
    @objc public static let locationHelperAdviceWeather = FCLabels.locationHelperAdviceWeather
    @objc public static let locationHelperChangeAnytime = FCLabels.locationHelperChangeAnytime
    @objc public static let locationHelperShare = FCLabels.locationHelperShare
    @objc public static let locationHelpsSuggestions = FCLabels.locationHelpsSuggestions
    @objc public static let locationPermissionDeclined = FCLabels.locationPermissionDeclined
    @objc public static let locationTailorAdvice = FCLabels.locationTailorAdvice
    @objc public static let locationUpdated = FCLabels.locationUpdated
    @objc public static let locationWeatherAdvice = FCLabels.locationWeatherAdvice
    @objc public static let logout = FCLabels.logout
    @objc public static let microphonePermissionIsRequiredForVoiceInput = FCLabels.microphonePermissionIsRequiredForVoiceInput
    @objc public static let microphonePermissionRequired = FCLabels.microphonePermissionRequired
    @objc public static let more = FCLabels.more
    @objc public static let myFarm = FCLabels.myFarm
    @objc public static let name = FCLabels.name
    @objc public static let nameMustBeAtLeast = FCLabels.nameMustBeAtLeast
    @objc public static let nameMustBeAtMost = FCLabels.nameMustBeAtMost
    @objc public static let needHelpAnythingToday = FCLabels.needHelpAnythingToday
    @objc public static let networkErrorPleaseTryAgain = FCLabels.networkErrorPleaseTryAgain
    @objc public static let networkIsSlowPleaseTryAgain = FCLabels.networkIsSlowPleaseTryAgain
    @objc public static let newConversation = FCLabels.newConversation
    @objc public static let night = FCLabels.night
    @objc public static let noAudioAvailableMessage = FCLabels.noAudioAvailableMessage
    @objc public static let noAudioRecordedOrConversationNotStarted = FCLabels.noAudioRecordedOrConversationNotStarted
    @objc public static let noCameraAppAvailable = FCLabels.noCameraAppAvailable
    @objc public static let noChatsYet = FCLabels.noChatsYet
    @objc public static let noFaqsAvailable = FCLabels.noFaqsAvailable
    @objc public static let noInternetConnection = FCLabels.noInternetConnection
    @objc public static let noNetwork = FCLabels.noNetwork
    @objc public static let oneSecondPlease = FCLabels.oneSecondPlease
    @objc public static let orAskAFollowupQuestions = FCLabels.orAskAFollowupQuestions
    @objc public static let photo = FCLabels.photo
    @objc public static let photoNotShared = FCLabels.photoNotShared
    @objc public static let photoPermissionDeclined = FCLabels.photoPermissionDeclined
    @objc public static let photos = FCLabels.photos
    @objc public static let pleaseAlsoSeeOur = FCLabels.pleaseAlsoSeeOur
    @objc public static let pleaseCheckTryAgain = FCLabels.pleaseCheckTryAgain
    @objc public static let pleaseConfirm = FCLabels.pleaseConfirm
    @objc public static let pleaseConnectInternetTryAgain = FCLabels.pleaseConnectInternetTryAgain
    @objc public static let pleaseEnableCameraSettings = FCLabels.pleaseEnableCameraSettings
    @objc public static let pleaseEnableMicrophoneSettings = FCLabels.pleaseEnableMicrophoneSettings
    @objc public static let pleaseEnter = FCLabels.pleaseEnter
    @objc public static let pleaseEnterAValidNumber = FCLabels.pleaseEnterAValidNumber
    @objc public static let pleaseEnterAValidOtp = FCLabels.pleaseEnterAValidOtp
    @objc public static let pleaseTryAgain = FCLabels.pleaseTryAgain
    @objc public static let practicalAdviceYourFarm = FCLabels.practicalAdviceYourFarm
    @objc public static let previousQuestionsMenu = FCLabels.previousQuestionsMenu
    @objc public static let privacyPolicy = FCLabels.privacyPolicy
    @objc public static let processing = FCLabels.processing
    @objc public static let quickTip = FCLabels.quickTip
    @objc public static let readFullAdvice = FCLabels.readFullAdvice
    @objc public static let recentChats = FCLabels.recentChats
    @objc public static let relatedQuestions = FCLabels.relatedQuestions
    @objc public static let requestTimedOutPleaseTryAgain = FCLabels.requestTimedOutPleaseTryAgain
    @objc public static let resendCode = FCLabels.resendCode
    @objc public static let responsePausedResuming = FCLabels.responsePausedResuming
    @objc public static let save = FCLabels.save
    @objc public static let saveLanguage = FCLabels.saveLanguage
    @objc public static let saveName = FCLabels.saveName
    @objc public static let saveSelection = FCLabels.saveSelection
    @objc public static let saveYourQuestionsAnswers = FCLabels.saveYourQuestionsAnswers
    @objc public static let savedToGallery = FCLabels.savedToGallery
    @objc public static let saving = FCLabels.saving
    @objc public static let search = FCLabels.search
    @objc public static let seconds = FCLabels.seconds
    @objc public static let secureConnectionFailed = FCLabels.secureConnectionFailed
    @objc public static let seeAll = FCLabels.seeAll
    @objc public static let selectCountryCode = FCLabels.selectCountryCode
    @objc public static let send = FCLabels.send
    @objc public static let sendOneTimeCode = FCLabels.sendOneTimeCode
    @objc public static let sendOtpSignin = FCLabels.sendOtpSignin
    @objc public static let sendOtpSigninShort = FCLabels.sendOtpSigninShort
    @objc public static let sendViaSms = FCLabels.sendViaSms
    @objc public static let sendViaWhatsapp = FCLabels.sendViaWhatsapp
    @objc public static let sendingCode = FCLabels.sendingCode
    @objc public static let serverIsBusyPleaseTryAgain = FCLabels.serverIsBusyPleaseTryAgain
    @objc public static let serviceNotFound = FCLabels.serviceNotFound
    @objc public static let sessionExpiredPleaseLoginAgain = FCLabels.sessionExpiredPleaseLoginAgain
    @objc public static let setYourLocation = FCLabels.setYourLocation
    @objc public static let settingLanguage = FCLabels.settingLanguage
    @objc public static let settingLoadingStateImmediatelyGpsFetchInProgress = FCLabels.settingLoadingStateImmediatelyGpsFetchInProgress
    @objc public static let settings = FCLabels.settings
    @objc public static let shareAppMessage = FCLabels.shareAppMessage
    @objc public static let shareDownload = FCLabels.shareDownload
    @objc public static let shareLocation = FCLabels.shareLocation
    @objc public static let shareLocationTitle = FCLabels.shareLocationTitle
    @objc public static let signUp = FCLabels.signUp
    @objc public static let signUpPhoneNumber = FCLabels.signUpPhoneNumber
    @objc public static let skip = FCLabels.skip
    @objc public static let skipForNow = FCLabels.skipForNow
    @objc public static let somethingWentWrong = FCLabels.somethingWentWrong
    @objc public static let somethingWentWrongPleaseTryAgain = FCLabels.somethingWentWrongPleaseTryAgain
    @objc public static let speak = FCLabels.speak
    @objc public static let ssfrAdvisory = FCLabels.ssfrAdvisory
    @objc public static let ssfrAdvisoryDescription = FCLabels.ssfrAdvisoryDescription
    @objc public static let ssfrMaize = FCLabels.ssfrMaize
    @objc public static let ssfrMaizeQuestion = FCLabels.ssfrMaizeQuestion
    @objc public static let ssfrWheat = FCLabels.ssfrWheat
    @objc public static let ssfrWheatQuestion = FCLabels.ssfrWheatQuestion
    @objc public static let startChat = FCLabels.startChat
    @objc public static let startOver = FCLabels.startOver
    @objc public static let startUsingFarmerchat = FCLabels.startUsingFarmerchat
    @objc public static let storageExceeded = FCLabels.storageExceeded
    @objc public static let termsOfUse = FCLabels.termsOfUse
    @objc public static let termsPrivacyAgreement = FCLabels.termsPrivacyAgreement
    @objc public static let thankYouYourAnswerHelpsUsGiveMoreAccurateAdvice = FCLabels.thankYouYourAnswerHelpsUsGiveMoreAccurateAdvice
    @objc public static let thisFunctionRequiredEnableInDeviceSettings = FCLabels.thisFunctionRequiredEnableInDeviceSettings
    @objc public static let tipsAskSpecificCrops = FCLabels.tipsAskSpecificCrops
    @objc public static let tipsListCannotBeEmpty = FCLabels.tipsListCannotBeEmpty
    @objc public static let tooManyRequestsPleaseTryAgainLater = FCLabels.tooManyRequestsPleaseTryAgainLater
    @objc public static let transcriptionFailedPleaseTryAgain = FCLabels.transcriptionFailedPleaseTryAgain
    @objc public static let transcriptionUnclear = FCLabels.transcriptionUnclear
    @objc public static let tryAgain = FCLabels.tryAgain
    @objc public static let tryThis = FCLabels.tryThis
    @objc public static let turnLocationOnNow = FCLabels.turnLocationOnNow
    @objc public static let turnOnGps = FCLabels.turnOnGps
    @objc public static let turnOnInSettings = FCLabels.turnOnInSettings
    @objc public static let turnOnLocation = FCLabels.turnOnLocation
    @objc public static let turningHelpsTailorAnswersYourArea = FCLabels.turningHelpsTailorAnswersYourArea
    @objc public static let type = FCLabels.type
    @objc public static let typeOrSayIt = FCLabels.typeOrSayIt
    @objc public static let unableToConnectPleaseTryAgain = FCLabels.unableToConnectPleaseTryAgain
    @objc public static let unableToLoadLegalLinks = FCLabels.unableToLoadLegalLinks
    @objc public static let unknownError = FCLabels.unknownError
    @objc public static let uploadPhotosForPlantDiseaseIdentification = FCLabels.uploadPhotosForPlantDiseaseIdentification
    @objc public static let uploadPhotosPlantDiseaseIdentification = FCLabels.uploadPhotosPlantDiseaseIdentification
    @objc public static let userCancelledOrUserProviderError = FCLabels.userCancelledOrUserProviderError
    @objc public static let verify = FCLabels.verify
    @objc public static let verifying = FCLabels.verifying
    @objc public static let voice = FCLabels.voice
    @objc public static let voiceInputIsStillImproving = FCLabels.voiceInputIsStillImproving
    @objc public static let weGreetYouName = FCLabels.weGreetYouName
    @objc public static let weNeedYourLocation = FCLabels.weNeedYourLocation
    @objc public static let wellSaveYourChatsYouContinue = FCLabels.wellSaveYourChatsYouContinue
    @objc public static let whatDoYouNeedHelpToday = FCLabels.whatDoYouNeedHelpToday
    @objc public static let whatIsThePresentWeather = FCLabels.whatIsThePresentWeather
    @objc public static let whatIsWrongWithMyCrop = FCLabels.whatIsWrongWithMyCrop
    @objc public static let whatShouldWeCallYou = FCLabels.whatShouldWeCallYou
    @objc public static let whatWeHelpYou = FCLabels.whatWeHelpYou
    @objc public static let whatWrongMyCrop = FCLabels.whatWrongMyCrop
    @objc public static let youCanAskFollowupQuestionsToGetMoreDetails = FCLabels.youCanAskFollowupQuestionsToGetMoreDetails
    @objc public static let youChangeLater = FCLabels.youChangeLater
    @objc public static let yourLocation = FCLabels.yourLocation
    @objc public static let yourName = FCLabels.yourName
    @objc public static let yourNameHasUpdated = FCLabels.yourNameHasUpdated
    @objc public static let yourNameOrNickname = FCLabels.yourNameOrNickname
    @objc public static let yourPhone = FCLabels.yourPhone
    @objc public static let youreAllSet = FCLabels.youreAllSet
}
