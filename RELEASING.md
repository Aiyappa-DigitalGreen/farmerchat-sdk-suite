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

2. **Claim the namespace `org.digitalgreen`.** Every SDK artifact is published as
   `org.digitalgreen.farmerchat:*`, so this exact namespace is needed.
   - In the Portal: *Namespaces* → *Add Namespace* → `org.digitalgreen`.
   - The Portal shows a verification key. Ask whoever manages DNS for `digitalgreen.org` to add it
     as a **TXT record** on `digitalgreen.org`.
   - Back in the Portal, click *Verify Namespace*. It turns *Verified* once the record is visible.

   Don't register a GitHub-based namespace (`io.github.…`) as a shortcut. It would change every
   artifact's coordinates, which breaks existing apps and would have to change again later.

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

1. Create the Digital Green Portal account, ideally on a shared address rather than a person's.
2. Ask Central support (central-support@sonatype.com) to transfer the `org.digitalgreen` namespace
   to it, or to add that account to the namespace. They confirm ownership through the same DNS
   record.
3. Generate a user token on the new account and replace `MAVEN_CENTRAL_USERNAME` /
   `MAVEN_CENTRAL_PASSWORD`. Optionally create a new signing key on a team address and replace
   `SIGNING_KEY` / `SIGNING_PASSWORD`; keep the old public key on the keyserver, since past releases
   were signed with it.
4. Update the `<developer>` email in the three Android `build.gradle.kts` POM blocks.

The coordinates (`org.digitalgreen.farmerchat:*`) never change, so host apps notice nothing.

## Other registries

| Registry | Secret | State |
|---|---|---|
| npm (web, widget, React Native) | `NPM_TOKEN` (automation token for the `@digitalgreenorg` org) | Ready once the secret exists |
| CocoaPods | `COCOAPODS_TRUNK_TOKEN` | Blocked: the podspec's paths need restructuring first (see docs/04) |
| Swift Package Manager | none | Blocked: needs a root `Package.swift`, which raises SPM users to iOS 16 (team decision) |
