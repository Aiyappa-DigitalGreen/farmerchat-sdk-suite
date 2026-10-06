plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    id("maven-publish")
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        freeCompilerArgs.add("-Xexplicit-api=warning")
    }
}

android {
    namespace = "org.digitalgreen.farmerchat.sdk.analytics.posthog"
    compileSdk = 36

    defaultConfig {
        minSdk = 26
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        release { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    lint { abortOnError = false }
    publishing {
        singleVariant("release") { withSourcesJar() }
    }
    testOptions {
        unitTests { isReturnDefaultValues = true }
    }
}

dependencies {
    // `api`, not `implementation`: a host wiring this adapter holds FarmerChatConfig.Builder
    // and FarmerChatAnalyticsListener types from core in its own source.
    api(project(":farmerchat-core"))
    implementation(libs.posthog.android)

    testImplementation(libs.junit)
}
