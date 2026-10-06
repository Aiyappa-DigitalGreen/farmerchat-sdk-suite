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
        // mavenLocal() first so :sample-consumer resolves the FarmerChat SDK
        // published by `./gradlew publishToMavenLocal` (import-by-coordinate proof).
        mavenLocal()
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
// coordinate-based consumer (distribution proof — depends on the SDK via mavenLocal):
include(":sample-consumer")
