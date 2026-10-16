// Top-level build file for the FarmerChat Android SDK suite.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.kotlin.parcelize) apply false
    alias(libs.plugins.kotlinx.binary.compatibility.validator)
    alias(libs.plugins.dokka)
}

// -----------------------------------------------------------------------------
// PUBLIC API BASELINE (binary-compatibility-validator).
// `./gradlew apiDump` writes <module>/api/<module>.api; `./gradlew apiCheck` fails when the
// compiled public surface no longer matches it. Commit the .api files: a diff in them is a
// public-API change and must be deliberate (docs/03). Declarations marked
// @InternalFarmerChatApi are not public API. Samples are hosts, not SDK artifacts.
// -----------------------------------------------------------------------------
apiValidation {
    nonPublicMarkers += "org.digitalgreen.farmerchat.sdk.InternalFarmerChatApi"
    ignoredProjects += listOf("sample-compose", "sample-views", "sample-jetpack", "sample-consumer")
}

// -----------------------------------------------------------------------------
// API REFERENCE (Dokka). `./gradlew :dokkaGenerate` writes one aggregated HTML site for the
// four library modules to build/dokka/html. Build-time only; nothing is added to any AAR/POM.
// -----------------------------------------------------------------------------
val sdkLibraryModules = listOf(
    ":farmerchat-core",
    ":farmerchat-android-compose",
    ":farmerchat-android-views",
    ":farmerchat-analytics-posthog",
)
sdkLibraryModules.forEach { path ->
    project(path) { apply(plugin = "org.jetbrains.dokka") }
}
dependencies {
    sdkLibraryModules.forEach { dokka(project(it)) }
}
dokka {
    moduleName.set("FarmerChat Android SDK")
}

// -----------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for the published SDK coordinate.
// groupId  = io.github.aiyappa-digitalgreen
// version  = FarmerChatVersion (below)
// Every publishable module reads project.group / project.version — no other
// module hard-codes the group or version.
// -----------------------------------------------------------------------------
// Maven Central namespace io.github.aiyappa-digitalgreen (verified through GitHub, 2026-10-16). This is
// the Maven group only; Kotlin packages stay org.digitalgreen.farmerchat.sdk.*.
val farmerChatGroup = "io.github.aiyappa-digitalgreen"
val farmerChatVersion = "2.2.0" // == FarmerChatVersion (agentic streaming; see versions/v2/README.md)

// Expose to all modules (referenced by publish blocks and, optionally, runtime).
extra["FarmerChatGroup"] = farmerChatGroup
extra["FarmerChatVersion"] = farmerChatVersion

subprojects {
    group = farmerChatGroup
    version = farmerChatVersion
}

// -----------------------------------------------------------------------------
// PUBLISH TARGET (why hosts outside this repo could not resolve the SDK)
//
// Each library module declares `publishing { publications { ... } }` but no
// `repositories { }`. With no publish repository, maven-publish can only run
// `publishToMavenLocal` — the artifact lands in ~/.m2 on ONE machine and no other
// app, developer or CI can resolve it. That is why the SDK was only consumable
// from inside this folder.
//
// This block adds a real remote, configured entirely from Gradle properties or
// environment variables so NO credentials are committed. It is inert until the
// URL is provided, so local `publishToMavenLocal` keeps working untouched.
//
//   Publish:  ./gradlew publishAllPublicationsToFarmerChatRepository //               -PfarmerchatRepoUrl=https://maven.pkg.github.com/Aiyappa-DigitalGreen/farmerchat-sdk-suite //               -PfarmerchatRepoUser=<user> -PfarmerchatRepoToken=<token>
//   Or set FARMERCHAT_REPO_URL / FARMERCHAT_REPO_USER / FARMERCHAT_REPO_TOKEN.
//
// Consumers then add that same URL to their settings.gradle.kts dependencyResolutionManagement.
// -----------------------------------------------------------------------------
subprojects {
    plugins.withId("maven-publish") {
        extensions.configure<PublishingExtension>("publishing") {
            val repoUrl = (findProperty("farmerchatRepoUrl") as String?)
                ?: System.getenv("FARMERCHAT_REPO_URL")
            if (!repoUrl.isNullOrBlank()) {
                repositories {
                    maven {
                        name = "FarmerChat"
                        url = uri(repoUrl)
                        credentials {
                            username = (findProperty("farmerchatRepoUser") as String?)
                                ?: System.getenv("FARMERCHAT_REPO_USER") ?: ""
                            password = (findProperty("farmerchatRepoToken") as String?)
                                ?: System.getenv("FARMERCHAT_REPO_TOKEN") ?: ""
                        }
                    }
                }
            }
        }
    }
}

// -----------------------------------------------------------------------------
// MAVEN CENTRAL (Central Portal, central.sonatype.com)
//
// Central requires signed artifacts, a sources jar, a javadoc jar and a full POM. The modules
// declare the jars and the POM; this block adds signing and a local "CentralBundle" repository
// in Maven layout (Gradle writes the md5/sha1 checksums Central also requires).
//
//   ./gradlew centralBundle   → build/central-bundle.zip, uploaded by .github/workflows/release.yml
//
// Signing is active ONLY when an in-memory key is supplied (SIGNING_KEY = ASCII-armored private
// key, SIGNING_PASSWORD = its passphrase), as Gradle properties or environment variables. Without
// one, nothing is signed, so `publishToMavenLocal` behaves exactly as before. The three SDK
// artifacts are bundled; farmerchat-analytics-posthog is not published (docs/04).
// -----------------------------------------------------------------------------
val centralModules = listOf(":farmerchat-core", ":farmerchat-android-compose", ":farmerchat-android-views")
val centralStagingDir = layout.buildDirectory.dir("central-staging")
val signingKey = (findProperty("signingKey") as String?) ?: System.getenv("SIGNING_KEY")
val signingPassword = (findProperty("signingPassword") as String?) ?: System.getenv("SIGNING_PASSWORD")

centralModules.forEach { path ->
    project(path) {
        // Javadoc jar from this module's Dokka 2 output. AGP's own withJavadocJar() runs an older
        // bundled Dokka that crashes on the Compose module under Kotlin 2.3 ("PermittedSubclasses
        // requires ASM9"), so it is not used.
        val dokkaJavadocJar = tasks.register<Jar>("dokkaJavadocJar") {
            archiveClassifier.set("javadoc")
            dependsOn("dokkaGeneratePublicationHtml")
            from(layout.buildDirectory.dir("dokka/html"))
        }
        plugins.withId("maven-publish") {
            extensions.configure<PublishingExtension>("publishing") {
                publications.withType<MavenPublication>().configureEach { artifact(dokkaJavadocJar) }
                repositories {
                    maven {
                        name = "CentralBundle"
                        url = uri(centralStagingDir)
                    }
                }
            }
            if (!signingKey.isNullOrBlank()) {
                apply(plugin = "signing")
                afterEvaluate {
                    extensions.configure<SigningExtension>("signing") {
                        useInMemoryPgpKeys(signingKey, signingPassword ?: "")
                        sign(extensions.getByType<PublishingExtension>().publications)
                    }
                }
            }
        }
    }
}

val cleanCentralStaging = tasks.register<Delete>("cleanCentralStaging") {
    delete(centralStagingDir)
    doFirst {
        // Fail before anything is built: Central rejects unsigned artifacts.
        check(!signingKey.isNullOrBlank()) { "centralBundle needs SIGNING_KEY / SIGNING_PASSWORD." }
    }
}
centralModules.forEach { path ->
    project(path) {
        tasks.matching { it.name == "publishAllPublicationsToCentralBundleRepository" }
            .configureEach { dependsOn(cleanCentralStaging) }
    }
}

tasks.register<Zip>("centralBundle") {
    group = "publishing"
    description = "Signed Maven Central upload bundle for the three SDK artifacts."
    dependsOn(centralModules.map { "$it:publishAllPublicationsToCentralBundleRepository" })
    from(centralStagingDir)
    // Central computes these itself and rejects bundles that carry them.
    exclude("**/maven-metadata*")
    archiveFileName.set("central-bundle.zip")
    destinationDirectory.set(layout.buildDirectory)
}
