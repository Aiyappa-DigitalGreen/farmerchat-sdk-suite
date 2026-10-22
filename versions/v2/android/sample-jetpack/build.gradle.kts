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
    namespace = "org.digitalgreen.farmerchat.sample.jetpack"
    compileSdk = 36

    defaultConfig {
        applicationId = "org.digitalgreen.farmerchat.sample.jetpack"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true }
}

dependencies {
    // ── The only FarmerChat dependency you need ──────────────────────────────
    // In-repo it's a project dependency; published, it's the Maven coordinate:
    //   implementation("org.digitalgreen.farmerchat:farmerchat-android-compose:1.0.0")
    implementation(project(":farmerchat-android-compose"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
}
