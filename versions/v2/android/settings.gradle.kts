pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        // The SDK is resolved ONLINE, like any host app: :sample-consumer pulls
        // io.github.aiyappa-digitalgreen:* from Maven Central (no mavenLocal). It cannot build until
        // the first release is published there (RELEASING.md); CI and release.yml exclude it until then.
        google()
        mavenCentral()
    }
}

rootProject.name = "farmerchat-android-sdk"

include(":farmerchat-core")
include(":farmerchat-android-compose")
include(":farmerchat-android-views")

// Optional analytics adapter. NOT part of the SDK packages — root CLAUDE.md §6 bans vendor
// analytics SDKs inside those; this is a separate artifact a host opts into.
include(":farmerchat-analytics-posthog")
// project(...)-based samples (visual/dev iteration):
include(":sample-compose")
include(":sample-views")
// minimal "host app" sample: dependency + FarmerChatFab → chat, one customization file:
include(":sample-jetpack")
// coordinate-based consumer (distribution proof — depends on the SDK from Maven Central):
include(":sample-consumer")
