# FarmerChat — React Native SDK

- **Package:** [`packages/farmerchat-react-native`](packages/farmerchat-react-native) — `@digitalgreenorg/farmerchat-react-native` (TypeScript strict, Expo SDK 52+/RN 0.76+, no custom native modules). See its README for install/permissions/usage.
- **Example:** [`example/`](example) — minimal Expo host app consuming the package via a `file:` dependency, with SDK init + analytics event logging.

## Verification status

- `npx tsc --noEmit` and the `tsc` build both pass cleanly (root CLAUDE.md §5 minimum check — recorded in `docs/04-parity-matrix.md`).
- Runtime-tested on an Android emulator via Expo Go (SDK 52) against the live dev environment on 2026-07-17: guest init, language onboarding, name save, splash routing, dashboard, and the chat send/"Not sent"/Try again path. The dev backend's `get_answer_for_text_query` returned a persistent 500 during that run, so a successful AI answer has not yet been observed — details and remaining debts (audio/image/location/OTP) in `docs/04-parity-matrix.md`.

## 2.0.0 agentic UI (opt-in)

`FarmerChatConfig.enableAgenticChat` defaults to **false**; with it off the 1.0.0 input surface
(Photo/Speak/Type tiles + text overlay) and the green Home surface are untouched. With it **on**:

- Chat and Home swap their input for `InputComposer` (camera / text field / mic-or-send).
- Home switches to the grey reading surface with the green gradient band, the pinned logo +
  leaf-flanked "For your farm today" header and the location pill, and a card tap sends the card
  question into chat as a plain text query instead of calling #13.
- `FarmerChat.openScreen('termsofuse')` lands on Home and opens the in-app Terms-of-Use dialog.
- **Capability chips.** A `gps-prompt` / `upload-photo` alignment surface's `invoke` chip does not
  send its text as the question: "Share my location" runs the shared location flow and then
  re-sends the farmer's ORIGINAL question with the resolved address shown as a location bubble,
  while "Take a photo" / "Choose from gallery" open the camera or the gallery directly. Declining
  (or a cancel / failure) answers the blocking question with "Continue without sharing my
  location". Every other chip, `Not now` included, still sends its text.
  Needs `expo-location` and `expo-image-picker` (already peer deps) and, for the address, a
  logged-in user — a guest has no district/state/country stored, so no bubble is shown.

**Host requirement (both paths, and now also the composer):** the Android host activity must set
`android:windowSoftInputMode="adjustResize"`. The composer consumes the IME inset itself on iOS
but relies on the window resize on Android; without it the bar sits behind the keyboard.

Deviations from the android-compose reference, and the exact reasons, are recorded in
`docs/04-parity-matrix.md` under "react-native composer + agentic Home wiring".

## Development

```sh
cd packages/farmerchat-react-native
npm install          # dev deps for typechecking/building
npm run typecheck    # npx tsc --noEmit
npm run build        # emits dist/
```

## Running the example (Android emulator)

```sh
cd packages/farmerchat-react-native && npm install && npm run build
cd ../../example && npm install
npx expo start --android    # installs/launches Expo Go on the running emulator
```

Notes:
- `example/metro.config.js` is required: the package is a symlinked `file:` dependency carrying its own `node_modules`, so Metro must watch the package folder, resolve modules only from `example/node_modules`, and block the package's `node_modules` (otherwise duplicate React → invalid-hook-call crash).
- `expo-asset` must stay a **direct** dependency of the example: npm nests it under `expo/node_modules`, where `@expo/metro-config` cannot resolve it (`The required package expo-asset cannot be found`).
- If the automatic Expo Go download fails, install it manually: fetch the `androidClientUrl` from `https://api.expo.dev/v2/versions` (sdkVersions → 52.0.0) and `adb install` the APK, then open `exp://127.0.0.1:8081` after `adb reverse tcp:8081 tcp:8081`.
