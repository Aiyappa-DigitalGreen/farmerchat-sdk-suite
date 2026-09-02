# React Native rules (adds to root CLAUDE.md — read that first)

- Package `@digitalgreenorg/farmerchat-react-native`, TypeScript strict, Expo SDK 52+ / RN 0.76+, no custom native modules.
- Peer deps only for heavy things (react-navigation, expo-av, expo-image-picker, expo-location, async-storage, react-native-webview, react-native-view-shot optional). SDK must degrade gracefully (feature off + console warn) when an optional peer is absent — never crash on import.
- fetch + AbortController client; 401 refresh single-flight mutex; AsyncStorage keys prefixed `fc_sdk_`.
- State machines as hooks/reducers mirroring the app's UDF Action/State names.
- Verify: `npx tsc --noEmit` clean before claiming done; record in docs/04.
