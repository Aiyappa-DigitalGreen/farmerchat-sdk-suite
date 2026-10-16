# Releasing the FarmerChat SDKs

Releases run from GitHub Actions only (`.github/workflows/release.yml`). Pushing a tag such as
`v2.3.0` checks that every package's version matches the tag and that `CHANGELOG.md` has a
`## [2.3.0]` section, builds and tests all four platforms, uploads to each registry whose secrets are
set, and creates a **draft** GitHub release for review. To rehearse without publishing, run the
workflow manually (Actions → Release (v2) → Run workflow) with `dry_run` ticked.

## One-time setup: Maven Central (Android)

The Android build is ready: `./gradlew centralBundle` produces a signed bundle in the layout
Central requires. What's left is an account, a namespace and two secrets, all outside the repo.
For now the account is in **aiyappa@digitalgreen.org**'s name; it moves to a Digital Green account
later (see the end of this section).

1. **Create the Central Portal account.** Go to <https://central.sonatype.com>, choose *Sign in* →
   *Sign up*, and register with `aiyappa@digitalgreen.org`. Confirm the email.

2. **Verify the namespace `io.github.aiyappa-digitalgreen`.** The SDK is published as
   `io.github.aiyappa-digitalgreen:*`, verified through the GitHub account
   `Aiyappa-DigitalGreen`; no domain or DNS change is needed.
   - If you signed up with *Continue with GitHub*, the Portal has already created and verified it.
   - Otherwise: *Namespaces* → *Add Namespace* → `io.github.aiyappa-digitalgreen`. The Portal
     shows a verification key. Create a **public** GitHub repository under `Aiyappa-DigitalGreen`
     whose name is exactly that key, click *Verify Namespace*, then delete the repository.

3. **Create a user token.** Portal → your account → *Generate User Token*. It has a username and
   a password. These are not your login password.

4. **Create the signing key.** Central only accepts signed artifacts.
   ```bash
   brew install gnupg
   gpg --quick-generate-key "FarmerChat SDK <aiyappa@digitalgreen.org>" rsa4096 sign 3y
   gpg --list-keys --keyid-format short          # note the key id
   gpg --keyserver keyserver.ubuntu.com --send-keys <KEY_ID>   # Central checks the public key here
   gpg --armor --export-secret-keys <KEY_ID> > signing-key.asc
   ```
   Keep `signing-key.asc` and the passphrase somewhere safe, then delete the local file once it's
   stored as a secret.

5. **Store the four secrets in GitHub.**
   ```bash
   gh secret set MAVEN_CENTRAL_USERNAME   # token username from step 3
   gh secret set MAVEN_CENTRAL_PASSWORD   # token password from step 3
   gh secret set SIGNING_KEY < signing-key.asc
   gh secret set SIGNING_PASSWORD         # the key's passphrase
   ```

6. **Release.** Bump the version on every platform, add the CHANGELOG section, then push the tag.
   The workflow uploads to Central as *USER_MANAGED*: Central validates the upload and then waits.
   Open <https://central.sonatype.com> → *Deployments*, check `farmerchat-<version>` and click
   **Publish**. Artifacts appear on Maven Central within about 30 minutes.

### Moving to the Digital Green account later

The group `io.github.aiyappa-digitalgreen` is tied to the `Aiyappa-DigitalGreen` GitHub account.
Two paths:

- **Keep the group, change the owner.** Ask Central support (central-support@sonatype.com) to give a
  Digital Green Portal account access to the namespace, then replace the
  `MAVEN_CENTRAL_USERNAME`/`PASSWORD` secrets. Host apps notice nothing. The group still reads
  `aiyappa-digitalgreen`.
- **Move to a Digital Green group** (`org.digitalgreen.farmerchat` through the digitalgreen.org DNS
  record, or `io.github.digitalgreenorg`). This is a **breaking** change for every host app: publish
  the next MAJOR version under the new group, keep the old group's last version as is, and list
  it under Breaking in CHANGELOG.md and MIGRATION.md (VERSIONING.md).

Either way, update the `<developer>` email in the three Android `build.gradle.kts` POM blocks if
the contact changes.

## Other registries

| Registry | Secret | State |
|---|---|---|
| npm (web, widget, React Native) | `NPM_TOKEN` (automation token for the `@digitalgreenorg` org) | Ready once the secret exists |
| CocoaPods | `COCOAPODS_TRUNK_TOKEN` | Blocked: the podspec's paths need restructuring first (see docs/04) |
| Swift Package Manager | none | Blocked: needs a root `Package.swift`, which raises SPM users to iOS 16 (team decision) |
