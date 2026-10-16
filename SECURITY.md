# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Report it privately through GitHub: open this repository's **Security** tab and choose
**Report a vulnerability** (GitHub private vulnerability reporting). Include:

- the affected package and version (for example `io.github.aiyappa-digitalgreen:farmerchat-core:2.2.0`,
  `FarmerChatCore 2.2.0`, `@digitalgreenorg/farmerchat-web@2.2.0`)
- the platform and OS / browser version
- steps to reproduce, and what an attacker could achieve

We will coordinate a disclosure date with you once a fix is ready.

## Supported versions

| Line | Packages | Status |
|---|---|---|
| 2.x | `versions/v2/` (Android, iOS, React Native, Web, widget) | Current |
| 1.x | top-level `android/`, `ios/`, `react-native/`, `web/` | Previous line |

## Scope notes

- The SDKs ship two client-side keys (the FarmerChat guest API key and a Google Geolocation key).
  Anything embedded in a mobile or web client can be extracted; this is known and documented in
  `docs/05-open-questions.md`. Reports about extracting them are out of scope. Reports about using
  them to reach something they should not are in scope.
- The hosted demo (`versions/v2/web/railway`) is a demo, but its stage proxy is public. Issues with
  it are in scope.
