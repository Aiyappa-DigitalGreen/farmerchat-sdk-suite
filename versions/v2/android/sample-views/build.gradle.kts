import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

// PostHog credentials. Read from `local.properties` (gitignored) or a -P gradle property, and
// NEVER committed — the iOS project made the same choice deliberately after finding plaintext
// keys in a git history. Unset simply leaves PostHog off: `FarmerChatPostHog.setup` treats a
// blank key as "off" and logs it, rather than crashing on launch.
fun localSecret(name: String): String? {
    val fromCommandLine = project.findProperty(name) as String?
    if (!fromCommandLine.isNullOrBlank()) return fromCommandLine
    val file = rootProject.file("local.properties")
    if (!file.exists()) return null
    val props = Properties()
    file.inputStream().use { stream -> props.load(stream) }
    return props.getProperty(name)
}

val posthogKey: String = localSecret("POSTHOG_API_KEY").orEmpty()
val posthogHost: String = localSecret("POSTHOG_HOST") ?: "https://us.i.posthog.com"

android {
    namespace = "org.digitalgreen.farmerchat.sample.views"
    compileSdk = 36

    defaultConfig {
        applicationId = "org.digitalgreen.farmerchat.sample.views"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "POSTHOG_API_KEY", "\"$posthogKey\"")
        buildConfigField("String", "POSTHOG_HOST", "\"$posthogHost\"")
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
        buildConfig = true
        viewBinding = true
    }
}

dependencies {
    implementation(project(":farmerchat-android-views"))
    implementation(project(":farmerchat-analytics-posthog"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.constraintlayout)
}
