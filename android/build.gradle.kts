// Top-level build file for the FarmerChat Android SDK suite.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.kotlin.parcelize) apply false
}

// -----------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for the published SDK coordinate.
// groupId  = org.digitalgreen.farmerchat
// version  = FarmerChatVersion (below)
// Every publishable module reads project.group / project.version — no other
// module hard-codes the group or version.
// -----------------------------------------------------------------------------
val farmerChatGroup = "org.digitalgreen.farmerchat"
val farmerChatVersion = "1.1.0" // == FarmerChatVersion

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
