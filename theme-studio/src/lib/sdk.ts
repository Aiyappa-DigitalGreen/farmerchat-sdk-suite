/* FarmerChat Theme Studio — SDK download/setup metadata.
 *
 * NO-HALLUCINATION: every fact here is grounded in the repo, not invented.
 *   - versions: only real, shipped versions (see web package.json, iOS podspec
 *     / git tag ios-v1.0.0, android project.version) — all 1.0.0 today.
 *   - package ids, install methods, peer deps, requirements, Info.plist keys:
 *     verbatim from INTEGRATION.md (which is derived from the SDK sources).
 *   - repo URL: from ios/FarmerChatUIKit/FarmerChatUIKit.podspec `:git`.
 * The themed initialize() code is delegated to the byte-verified export.ts
 * generators, so setup code never drifts from the Export panel.
 * Add a version by appending to SDK_VERSIONS — do NOT fabricate one. */
import { currentCode, themeJSON } from "./export"
import type { PlatformId, ThemeState } from "./theme"

export const SDK_REPO = "https://github.com/digitalgreenorg/farmerchat-sdk-suite"

/** Real, shipped versions only (newest first). */
export const SDK_VERSIONS = ["1.0.0"] as const
export type SdkVersion = (typeof SDK_VERSIONS)[number]

export interface SdkMeta {
  id: PlatformId
  name: string
  packageId: string
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
    packageId: "org.digitalgreen:farmerchat-android-compose",
    reqs: ["Compose or Views"],
    installLang: "kotlin",
    codeLang: "kotlin",
    install: (v) =>
      [
        "// build.gradle.kts (app)",
        "dependencies {",
        `    implementation("org.digitalgreen:farmerchat-android-compose:${v}")`,
        `    // XML hosts: use "org.digitalgreen:farmerchat-android-views:${v}" instead`,
        "}",
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
      "Host needs no manifest changes — the SDK declares its Activity + FileProvider.",
      "Camera / mic / location permissions are declared by the SDK and requested at use.",
      "launch() resolves whichever UI artifact is present; Compose wins if both.",
    ],
    source: `${SDK_REPO}/tree/main/android`,
  },
  {
    id: "ios",
    name: "iOS",
    packageId: "FarmerChatCore · FarmerChatSwiftUI · FarmerChatUIKit",
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
