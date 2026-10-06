# -*- coding: utf-8 -*-
from content import *
from plat_android import S,P,SUB,CB,TBL

RN = {
 "id":"react-native","name":"React Native","flavour":"iOS + Android","badge":"TypeScript",
 "intro":["The React Native SDK renders the journey with native components on both platforms from "
   "one JavaScript integration. It is a TypeScript package with peer dependencies on React "
   "Navigation, AsyncStorage and Expo AV.",
   "Use it when you want a single integration across both stores. For deeper native control, the "
   "Android and iOS SDKs expose the same configuration surface."],
 "sections":[
  S("install","Install the FarmerChat SDK",
    DISTRIBUTION,
    SUB("Add the package"),
    CB([("npm","shell",None,"npm install @digitalgreenorg/farmerchat-react-native"),
        ("yarn","shell",None,"yarn add @digitalgreenorg/farmerchat-react-native")]),
    ("warn","Not on npm yet",[
     "<code>npm view @digitalgreenorg/farmerchat-react-native</code> returns 404. Until it is "
     "published, install from the local checkout: <code>npm install "
     "../farmerchat-sdk-suite/versions/v2/react-native/packages/farmerchat-react-native</code>"]),
    SUB("Install the peer dependencies"),
    P("The SDK does not bundle navigation or storage &mdash; it uses the ones your app already has."),
    CB([("npm","shell",None,"""npm install \\
  @react-navigation/native \\
  @react-navigation/native-stack \\
  @react-navigation/drawer \\
  @react-native-async-storage/async-storage \\
  expo-av""")])),

  S("launch","Launch the journey",
    SUB("Initialize the SDK"),
    P("Call <code>initialize</code> once, at module scope or in your root component before "
      "rendering any FarmerChat view."),
    CB([("TypeScript","ts","App.tsx","""import { FarmerChat } from '@digitalgreenorg/farmerchat-react-native';

FarmerChat.initialize({
  environment: 'PROD',
  guestApiKey: '<your guest API key>',
  geoApiKey: '<your Google Geolocation key>',
  languageCode: 'en',
  defaultCountryCode: 'IN',
});""")]),
    SUB("Render the journey"),
    P("<code>FarmerChatView</code> is the whole journey. Give it a full screen in your navigator."),
    CB([("TypeScript","ts",None,"""import { FarmerChatView } from '@digitalgreenorg/farmerchat-react-native';

function FarmerChatScreen() {
  return <FarmerChatView />;
}

// In your navigator
<Stack.Screen
  name="FarmerChat"
  component={FarmerChatScreen}
  options={{ headerShown: false }}
/>""")]),
    SUB("Or use the floating launcher"),
    P("<code>FarmerChatFab</code> reveals the journey in a full-screen modal with a close button "
      "&mdash; no navigator wiring needed."),
    CB([("TypeScript","ts",None,"""import { FarmerChatFab } from '@digitalgreenorg/farmerchat-react-native';

<View style={{ flex: 1 }}>
  <MyHomeScreen />
  <FarmerChatFab />
</View>""")])),

  S("scope","Scope the experience",
    TBL(["Option","What it controls"], CONFIG_ROWS),
    SUB("Chat only"),
    CB([("TypeScript","ts",None,"""FarmerChat.initialize({
  environment: 'PROD',
  guestApiKey: '<your guest API key>',
  mode: 'CHAT_ONLY',
  showDrawer: false,     // moves history + language into the chat app bar
  showHistory: true,
  showSettings: false,
  showNameScreen: false,
});""")]),
    CHAT_ONLY_NOTE,
    SUB("Turn off a question mode"),
    CB([("TypeScript","ts",None,"""FarmerChat.initialize({
  environment: 'PROD',
  enableVoice: false,   // no mic
  enableImages: false,  // no camera
});""")])),

  S("identity","Identity and authentication",
    P("Guest by default, with phone/OTP sign-in inside the journey. Supply your own token to skip "
      "the SDK's auth UI."),
    CB([("TypeScript","ts",None,"""FarmerChat.initialize({
  environment: 'PROD',
  authMode: 'HOST_TOKEN',
  accessToken: await myAuth.currentAccessToken(),
  // Called at init when no accessToken was given, and again on a 401.
  tokenProvider: async () => myAuth.freshAccessToken(),
});""")]),
    CB([("TypeScript","ts",None,"""const signedIn = FarmerChat.isAuthenticated();
FarmerChat.logout();

const unsubscribe = FarmerChat.addAuthStateListener((isAuthed) => {
  console.log('signed in:', isAuthed);
});""")])),

  S("theming","Theming",
    P("Override only what must match your app; unset values keep the FarmerChat look."),
    CB([("TypeScript","ts",None,"""FarmerChat.initialize({
  environment: 'PROD',
  appearance: 'auto',           // 'day' | 'night' | 'auto'
  theme: {
    brandPrimary: '#00C950',
    shape: {
      cardCornerRadius: 24,
      buttonCornerRadius: 999,  // fully rounded, the current default
      inputCornerRadius: 12,
    },
  },
  messageFontSize: 15,
});""")])),

  S("labels","Labels and languages",
    P("Override individual strings using the generated <code>Labels</code> constants."),
    CB([("TypeScript","ts",None,"""import { Labels } from '@digitalgreenorg/farmerchat-react-native';

FarmerChat.initialize({
  environment: 'PROD',
  stringOverrides: {
    [Labels.RECENT_CHATS]: 'Past advice',
    [Labels.SHARE_LOCATION]: 'Share my farm',
  },
});""")]),
    LABELS_NOTE),

  S("analytics","Analytics",
    P("The SDK emits the same events the FarmerChat app tracks, through a listener you provide."),
    CB([("TypeScript","ts",None,"""FarmerChat.initialize({
  environment: 'PROD',
  enableAnalytics: true,   // default false
  onEvent: (name, props) => MyAnalytics.track(name, props),
  onScreenView: (screen) => MyAnalytics.screen(screen),
  onChatOpened: () => {},
  onMessageSent: (text) => {},
  onAnswerReceived: (messageId) => {},
  onError: (code, message) => MyLogger.warn(code, message),
});""")]),
    ANALYTICS_NOTE),

  S("permissions","Permissions",
    P("React Native apps still ship native manifests. Declare permissions in both."),
    CB([("Android","xml","android/app/src/main/AndroidManifest.xml",PERMS_ANDROID),
        ("iOS","xml","ios/MyApp/Info.plist",PERMS_IOS)])),

  S("advanced","Advanced",
    SUB("Deep-link into a question"),
    CB([("TypeScript","ts",None,"""FarmerChat.openChat({ question: 'Why are my tomato leaves yellow?' });
FarmerChat.openChat({ conversationId: savedId });""")]),
    SUB("Streaming agentic chat"),
    CB([("TypeScript","ts",None,"FarmerChat.initialize({ environment: 'PROD', enableAgenticChat: true });")]),
    SUB("Embed chat inline"),
    P("<code>FarmerChatInlineView</code> renders the chat inside your own layout rather than "
      "taking the screen."),
    CB([("TypeScript","ts",None,"""import { FarmerChatInlineView } from '@digitalgreenorg/farmerchat-react-native';

<View style={{ height: 480 }}>
  <FarmerChatInlineView />
</View>""")])),
]}

WEB = {
 "id":"web","name":"Web","flavour":"React","badge":"TypeScript · React 18",
 "intro":["The Web SDK renders the journey in the browser as a React component, or mounts "
   "imperatively into any DOM element from a non-React app. React 18 is a peer dependency.",
   "Session state persists to <code>localStorage</code> under the <code>fc_sdk_</code> prefix, so "
   "a returning farmer keeps their language, identity and conversation history."],
 "sections":[
  S("install","Install the FarmerChat SDK",
    DISTRIBUTION,
    SUB("Add the package"),
    CB([("npm","shell",None,"npm install @digitalgreenorg/farmerchat-web"),
        ("yarn","shell",None,"yarn add @digitalgreenorg/farmerchat-web"),
        ("pnpm","shell",None,"pnpm add @digitalgreenorg/farmerchat-web")]),
    ("warn","Not on npm yet",[
     "<code>npm view @digitalgreenorg/farmerchat-web</code> returns 404. Until it is published, "
     "install from the local checkout: <code>npm install "
     "../farmerchat-sdk-suite/versions/v2/web/packages/farmerchat-web</code>"]),
    SUB("Peer dependencies"),
    CB([("npm","shell",None,"npm install react@^18 react-dom@^18")])),

  S("launch","Launch the journey",
    SUB("Initialize the SDK"),
    CB([("TypeScript","ts","main.tsx","""import { FarmerChat } from '@digitalgreenorg/farmerchat-web';

FarmerChat.initialize({
  environment: 'PROD',
  guestApiKey: '<your guest API key>',
  geoApiKey: '<your Google Geolocation key>',
  languageCode: 'en',
  defaultCountryCode: 'IN',
});""")]),
    SUB("Render the journey"),
    CB([("React","ts",None,"""import { FarmerChatView } from '@digitalgreenorg/farmerchat-web';

export default function FarmerChatPage() {
  return (
    <div style={{ height: '100vh' }}>
      <FarmerChatView />
    </div>
  );
}""")]),
    SUB("Or mount imperatively"),
    P("For apps that are not React, <code>mount</code> renders into any element and returns an "
      "unmount handle."),
    CB([("JavaScript","ts",None,"""import { FarmerChat } from '@digitalgreenorg/farmerchat-web';

const handle = FarmerChat.mount(
  document.getElementById('farmerchat'),
  { environment: 'PROD', guestApiKey: '<your guest API key>' }
);

// later
handle.unmount();""")]),
    SUB("Or use the floating launcher"),
    CB([("React","ts",None,"""import { FarmerChatFab } from '@digitalgreenorg/farmerchat-web';

<FarmerChatFab />""")])),

  S("scope","Scope the experience",
    TBL(["Option","What it controls"], CONFIG_ROWS),
    SUB("Chat only"),
    CB([("TypeScript","ts",None,"""FarmerChat.initialize({
  environment: 'PROD',
  guestApiKey: '<your guest API key>',
  mode: 'CHAT_ONLY',
  showDrawer: false,     // moves history + language into the chat app bar
  showHistory: true,
  showSettings: false,
  showNameScreen: false,
});""")]),
    CHAT_ONLY_NOTE),

  S("identity","Identity and authentication",
    CB([("TypeScript","ts",None,"""FarmerChat.initialize({
  environment: 'PROD',
  authMode: 'HOST_TOKEN',
  accessToken: await myAuth.currentAccessToken(),
  tokenProvider: async () => myAuth.freshAccessToken(),
});""")]),
    CB([("TypeScript","ts",None,"""const signedIn = FarmerChat.isAuthenticated();
FarmerChat.logout();

const unsubscribe = FarmerChat.addAuthStateListener((isAuthed) => {
  console.log('signed in:', isAuthed);
});""")]),
    ("note","Where the session lives",[
     "Tokens and preferences persist to <code>localStorage</code> under the <code>fc_sdk_</code> "
     "prefix. Clearing site data signs the farmer out."])),

  S("theming","Theming",
    P("The theme resolves to CSS custom properties on the SDK root, so it composes with your own "
      "stylesheet rather than fighting it."),
    CB([("TypeScript","ts",None,"""FarmerChat.initialize({
  environment: 'PROD',
  appearance: 'auto',           // 'day' | 'night' | 'auto'
  theme: {
    colors: { brandPrimary: '#00C950' },
    shape: {
      cardCornerRadius: 16,
      buttonCornerRadius: 999,  // fully rounded, the current default
      inputCornerRadius: 12,
    },
    typography: { fontFamily: 'Public Sans, system-ui, sans-serif' },
  },
});""")])),

  S("labels","Labels and languages",
    CB([("TypeScript","ts",None,"""FarmerChat.initialize({
  environment: 'PROD',
  stringOverrides: {
    fc_v2_app_label_recent_chats: 'Past advice',
  },
});""")]),
    LABELS_NOTE),

  S("analytics","Analytics",
    CB([("TypeScript","ts",None,"""FarmerChat.initialize({
  environment: 'PROD',
  enableAnalytics: true,   // default false
  onEvent: (name, props) => MyAnalytics.track(name, props),
  onScreenView: (screen) => MyAnalytics.screen(screen),
  onError: (code, message) => MyLogger.warn(code, message),
});""")]),
    ANALYTICS_NOTE),

  S("permissions","Permissions",
    P("The browser owns permissions &mdash; there is no manifest to edit. The SDK asks at the "
      "point of use and degrades when a farmer declines."),
    TBL(["Capability","Browser requirement"],[
     ("Voice questions","<code>getUserMedia</code> microphone prompt. Requires a secure context (HTTPS or localhost)."),
     ("Photo questions","A file input; camera capture where the browser supports it."),
     ("Weather &amp; local advice","<code>navigator.geolocation</code> prompt, with an IP-based fallback when declined.")]),
    ("warn","HTTPS is required",[
     "Microphone and geolocation are unavailable on plain <code>http://</code> outside localhost. "
     "Voice questions silently never start if you serve the page insecurely."])),

  S("advanced","Advanced",
    SUB("Deep-link into a question"),
    CB([("TypeScript","ts",None,"""FarmerChat.openChat({ question: 'Why are my tomato leaves yellow?' });
FarmerChat.openChat({ conversationId: savedId });""")]),
    SUB("Streaming agentic chat"),
    CB([("TypeScript","ts",None,"FarmerChat.initialize({ environment: 'PROD', enableAgenticChat: true });")]),
    SUB("Point at your own backend"),
    CB([("TypeScript","ts",None,"""FarmerChat.initialize({
  environment: 'PROD',
  customBaseUrl: 'https://farmerchat.internal.example/',
});""")])),
]}
