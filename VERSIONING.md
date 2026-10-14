# Versioning and deprecation

## One version across the suite

Every v2 package ships with the same version number: the Android artifacts, the three iOS packages,
React Native, Web and the widget. A host that uses two platforms never has to match different
version lines. The release workflow refuses to run when any package's version string differs.

## Semantic versioning

`MAJOR.MINOR.PATCH`, applied to the public API. That is the API in `docs/03-sdk-architecture.md`,
the public types each package exports, and the behaviour documented for them.

| Change | Bump | Examples |
|---|---|---|
| Removing or renaming public API, changing a default that alters behaviour, raising a minimum OS or toolchain | MAJOR | `guestApiKey` → `farmerChatApiKey`; `mode` default changed to `CHAT_ONLY` (both 2.0) |
| New public API, new config fields with backward-compatible defaults | MINOR | `shutdown()`, `clearAllData()`, `onLinkClick` |
| Fixes with no public API change | PATCH | a crash fix, a layout fix, a dependency update |

Android symbols marked `@InternalFarmerChatApi` and anything documented as internal are not public
API and can change in any release.

## Deprecation

1. A public API is deprecated in a MINOR release, with the platform's deprecation marker
   (`@Deprecated` in Kotlin, `@available(*, deprecated)` in Swift, `@deprecated` in TSDoc). The
   message names the replacement.
2. The deprecation is listed under **Deprecated** in `CHANGELOG.md` and explained in
   `versions/v2/MIGRATION.md`.
3. It is removed no earlier than the next MAJOR release.
4. Removals are listed under **Breaking** in the CHANGELOG and covered by a migration entry.

## Support window

How long each major version receives fixes after the next one ships is **not yet decided**. Until
it is, 2.x is the current line and 1.x receives fixes only by agreement. See `SECURITY.md` for
how to report vulnerabilities.

## Compatibility checks

CI compares each package's public API with a committed baseline (Android `.api` files, the web and
React Native `etc/*.api.md` reports) or with the previous commit (iOS FarmerChatCore; the iOS-only
SwiftUI and UIKit packages are not covered yet), so any change to the public surface shows up in
review. To update a baseline after an intended change, run the package's API update task and
commit the result together with the version bump it requires.
