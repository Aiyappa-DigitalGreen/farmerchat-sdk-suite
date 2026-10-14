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
// groupId  = org.digitalgreen.farmerchat
// version  = FarmerChatVersion (below)
// Every publishable module reads project.group / project.version — no other
// module hard-codes the group or version.
// -----------------------------------------------------------------------------
val farmerChatGroup = "org.digitalgreen.farmerchat"
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
//   Publish:  ./gradlew publishAllPublicationsToFarmerChatRepository //               -PfarmerchatRepoUrl=https://maven.pkg.github.com/digitalgreenorg/farmerchat-sdk-suite //               -PfarmerchatRepoUser=<user> -PfarmerchatRepoToken=<token>
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
