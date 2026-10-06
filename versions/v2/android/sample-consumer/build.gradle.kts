plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

android {
    namespace = "org.digitalgreen.farmerchat.sample.consumer"
    compileSdk = 36

    defaultConfig {
        applicationId = "org.digitalgreen.farmerchat.sample.consumer"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    // ------------------------------------------------------------------------
    // DISTRIBUTION PROOF: the SDK is consumed by MAVEN COORDINATE from
    // mavenLocal() — NOT via project(":farmerchat-android-compose").
    // Run `./gradlew publishToMavenLocal` first, then
    // `./gradlew :sample-consumer:assembleDebug`.
    // farmerchat-core is pulled in transitively via the compose POM dependency.
    // ------------------------------------------------------------------------
    implementation("org.digitalgreen.farmerchat:farmerchat-android-compose:2.2.0")

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
}
