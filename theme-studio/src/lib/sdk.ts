/* FarmerChat Theme Studio — SDK download/setup metadata.
 *
 * NO-HALLUCINATION: every fact here is grounded in the repo, not invented.
 *   - versions: only real, shipped versions, and they differ PER PLATFORM.
 *     android `build.gradle.kts` declares 2.0.0 (versions/v2); the iOS podspec,
 *     web `core/version.ts` and the RN package.json under versions/v2 were never
 *     bumped and still declare 1.0.0. A single global version would therefore
 *     print `npm install ...@2.0.0`, which does not exist — hence `SdkMeta.versions`.
 *   - package ids, install methods, peer deps, requirements, Info.plist keys:
 *     verbatim from INTEGRATION.md (which is derived from the SDK sources).
 *   - repo URL: from ios/FarmerChatUIKit/FarmerChatUIKit.podspec `:git`.
 * The themed initialize() code is delegated to the byte-verified export.ts
 * generators, so setup code never drifts from the Export panel.
 * Add a version by appending to SDK_VERSIONS — do NOT fabricate one. */
import { currentCode, themeJSON } from "./export"
import type { PlatformId, ThemeState } from "./theme"

export const SDK_REPO = "https://github.com/digitalgreenorg/farmerchat-sdk-suite"

/** Union of every platform's shipped versions (newest first) — the selector's options. */
export const SDK_VERSIONS = ["2.0.0", "1.0.0"] as const
export type SdkVersion = (typeof SDK_VERSIONS)[number]

export interface SdkMeta {
  id: PlatformId
  name: string
  packageId: string
  /** Versions this platform actually publishes (newest first). */
  versions: readonly string[]
  /** Compatibility badges (from INTEGRATION.md). */
  reqs: string[]
  /** Language hint for the install fence. */
  installLang: string
  /** Language hint for the code fence (matches export EXT). */
  codeLang: string
  install: (v: string) => string
  usage: string
  notes: string[]
  /** Link to the platform's source tree (dir exists in the repo). */
  source: string
  /** Extra source ref shown as a chip (e.g. the iOS git tag), if any. */
  sourceTag?: (v: string) => string
}

export const SDK_META: SdkMeta[] = [
  {
    id: "web",
    name: "Web",
    packageId: "@digitalgreenorg/farmerchat-web",
    versions: ["1.0.0"],
    reqs: ["React 18"],
    installLang: "bash",
    codeLang: "tsx",
    install: (v) => `npm install @digitalgreenorg/farmerchat-web@${v}`,
    usage: [
      "// After initialize() above, render anywhere — no config prop needed,",
      "// it reuses the shared config (including your theme):",
      "<FarmerChat />",
      "",
      "// or imperative mount into a container:",
      "FarmerChat.mount(document.getElementById('chat')!);",
      "",
      "// zero-wiring floating launcher:",
      "<FarmerChatFab />",
    ].join("\n"),
    notes: [
      "FarmerChat is a React component with static methods: initialize() sets global config (incl. your theme); <FarmerChat/> and mount() then render using it. Or pass a config prop directly.",
      "FarmerChatSDK is an alias of FarmerChat for the programmatic API.",
      "Styles are scoped (.fcsdk-*) and embed in any container; mic / camera / geolocation are capability-detected.",
    ],
    source: `${SDK_REPO}/tree/main/web`,
  },
  {
    id: "rn",
    name: "React Native",
    packageId: "@digitalgreenorg/farmerchat-react-native",
    versions: ["1.0.0"],
    reqs: ["Expo 52+", "RN 0.76+"],
    installLang: "bash",
    codeLang: "tsx",
    install: (v) => `npm install @digitalgreenorg/farmerchat-react-native@${v}`,
    usage: [
      "import { FarmerChat, FarmerChatProvider, FarmerChatView } from '@digitalgreenorg/farmerchat-react-native';",
      "",
      "export default () => (",
      "  <FarmerChatProvider>",
      "    <FarmerChatView />",
      "  </FarmerChatProvider>",
      ");",
    ].join("\n"),
    notes: [
      "Peer deps: react-navigation (native-stack), expo-av, expo-image-picker, expo-location, async-storage.",
      "Optional: react-native-webview, react-native-view-shot (features degrade gracefully without them).",
    ],
    source: `${SDK_REPO}/tree/main/react-native`,
  },
  {
    id: "android",
    name: "Android",
    // groupId is org.digitalgreen.FARMERCHAT — see versions/v2/android/build.gradle.kts
    // (`farmerChatGroup`). It was previously written as plain `org.digitalgreen`, which is not a
    // coordinate that resolves anywhere.
    packageId: "org.digitalgreen.farmerchat:farmerchat-android-compose",
    versions: ["2.0.0", "1.0.0"],
    reqs: ["Compose or Views", "AGP 8.13+ (Compose flavour)"],
    installLang: "kotlin",
    codeLang: "kotlin",
    install: (v) =>
      [
        "// build.gradle.kts (app)",
        "dependencies {",
        `    implementation("org.digitalgreen.farmerchat:farmerchat-android-compose:${v}")`,
        "",
        "    // XML/Fragment hosts: the Views artifact additionally provides a real",
        "    // FarmerChatFab View (the Compose one is a @Composable). Adding BOTH is",
        "    // supported — FarmerChat.launch() prefers the Compose Activity when present.",
        `    // implementation("org.digitalgreen.farmerchat:farmerchat-android-views:${v}")`,
        "}",
        "",
        "// farmerchat-core arrives transitively via the POM — do not add it explicitly.",
      ].join("\n"),
    usage: [
      "// Anywhere after initialize():",
      'FarmerChat.launch(context)',
      'FarmerChat.openChat(context, question = "How do I treat leaf rust?")',
      "",
      "// or the zero-wiring floating bubble in any Scaffold:",
      "Scaffold(floatingActionButton = { FarmerChatFab() }) { ... }",
    ].join("\n"),
    notes: [
      "The SDK declares its own Activity + FileProvider, and the camera / mic / location permissions it requests at use.",
      "launch() resolves whichever UI artifact is present; Compose wins if both.",
      "Compose flavour needs AGP 8.13+ in the HOST. Older toolchains (8.9.x) mis-dex the SDK's InputComposer and the app dies on the chat screen with java.lang.VerifyError. The Views flavour is unaffected.",
      "minSdk below 26: add tools:overrideLibrary=\"org.digitalgreen.farmerchat.sdk.views, org.digitalgreen.farmerchat.sdk.compose, org.digitalgreen.farmerchat.sdk.core\" to your <uses-sdk> — the compose entry is required whenever the Compose artifact is present.",
      "Analytics are OFF by default in 2.0.0 (enableAnalytics). The generated initialize() sets it explicitly so it is never a silent surprise.",
      "SIM number pre-fill on the Auth screen is host-opt-in: declare READ_PHONE_STATE + READ_PHONE_NUMBERS to enable it; the SDK declares neither and stays silent without them.",
    ],
    source: `${SDK_REPO}/tree/main/versions/v2/android`,
  },
  {
    id: "ios",
    name: "iOS",
    packageId: "FarmerChatCore · FarmerChatSwiftUI · FarmerChatUIKit",
    versions: ["1.0.0"],
    reqs: ["SwiftUI iOS 16+", "UIKit iOS 15+"],
    installLang: "swift",
    codeLang: "swift",
    install: (v) =>
      [
        "// Swift Package Manager — add the local packages",
        "//   Xcode ▸ File ▸ Add Packages… ▸ Add Local…",
        "//   ios/FarmerChatCore  +  ios/FarmerChatSwiftUI",
        `// (repo git tag for this release: ios-v${v})`,
        "",
        "// or CocoaPods (UIKit):",
        `pod 'FarmerChatUIKit', '~> ${v.split(".").slice(0, 2).join(".")}'`,
      ].join("\n"),
    usage: [
      "// SwiftUI — embed the full journey:",
      "import FarmerChatCore, FarmerChatSwiftUI",
      "FarmerChatView()",
      "",
      "// UIKit host — present the view controller:",
      "import FarmerChatCore, FarmerChatUIKit",
      "let vc = FarmerChatViewController()",
      "present(vc, animated: true)",
    ].join("\n"),
    notes: [
      "iOS 16+ hosts should prefer the SwiftUI package (higher fidelity).",
      "UIKit hosts: add Info.plist keys — NSMicrophoneUsageDescription, NSCameraUsageDescription, NSPhotoLibraryUsageDescription, NSPhotoLibraryAddUsageDescription, NSLocationWhenInUseUsageDescription.",
    ],
    source: `${SDK_REPO}/tree/main/ios`,
    sourceTag: (v) => `ios-v${v}`,
  },
]

/**
 * The version a card should actually show.
 *
 * The selector lists the union across platforms, but a platform must never advertise a version it
 * does not publish — printing `npm install ...@2.0.0` for web would be exactly the fabrication
 * this file's header forbids. Falls back to the platform's newest.
 */
export function resolveVersion(meta: SdkMeta, selected: string): string {
  return meta.versions.includes(selected) ? selected : meta.versions[0]
}

/** Full themed quick-start doc (Markdown) for one platform + version. */
export function quickStart(state: ThemeState, meta: SdkMeta, version: string): string {
  const code = currentCode(state, meta.id)
  const L: string[] = []
  L.push(`# FarmerChat SDK — ${meta.name} quick-start (v${version})`)
  L.push("")
  L.push(`- **Package:** \`${meta.packageId}\``)
  L.push(`- **Requirements:** ${meta.reqs.join(", ")}`)
  L.push(`- **Source:** ${meta.source}${meta.sourceTag ? ` (tag \`${meta.sourceTag(version)}\`)` : ""}`)
  L.push("")
  L.push("## 1. Install")
  L.push("```" + meta.installLang)
  L.push(meta.install(version))
  L.push("```")
  L.push("")
  L.push("## 2. Initialize (with your Theme Studio theme)")
  L.push("```" + meta.codeLang)
  L.push(code)
  L.push("```")
  L.push("")
  L.push("## 3. Launch")
  L.push("```" + meta.codeLang)
  L.push(meta.usage)
  L.push("```")
  L.push("")
  L.push("## Notes")
  meta.notes.forEach((nt) => L.push(`- ${nt}`))
  L.push("")
  L.push("---")
  L.push("_Generated by FarmerChat Theme Studio. Init code is byte-identical to the Export panel._")
  L.push("")
  return L.join("\n")
}

/** The theme.json payload (re-exported for the downloads UI). */
export function themeConfigJSON(state: ThemeState): string {
  return themeJSON(state)
}
