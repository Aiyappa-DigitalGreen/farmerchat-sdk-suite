plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    id("maven-publish")
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        // Warn (not fail) on missing explicit-API modifiers so the published
        // surface stays deliberate. Warning (not strict) mode — strict would
        // flood on the 1:1-ported UDF/model classes.
        freeCompilerArgs.add("-Xexplicit-api=warning")
    }
}

android {
    namespace = "org.digitalgreen.farmerchat.sdk.core"
    compileSdk = 36

    defaultConfig {
        minSdk = 26
        consumerProguardFiles("consumer-rules.pro")
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
    lint {
        abortOnError = false
    }
    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }

    testOptions {
        unitTests {
            // The agentic parser logs a warning on a malformed event. Without this, every
            // android.util.Log call throws "not mocked" and the error path is untestable —
            // which is exactly the path that must never take down the chat.
            isReturnDefaultValues = true
        }
    }

}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.coroutines.android)

    // Networking stack is an INTERNAL implementation detail of core (used only by
    // FarmerChatGraph + repositories). No public signature exposes a Retrofit/
    // OkHttp/Gson type, so these stay OFF the consumer's compile classpath.
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.gson)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.gson)

    testImplementation(libs.junit)
}

publishing {
    publications {
        register<MavenPublication>("release") {
            groupId = project.group.toString()
            artifactId = "farmerchat-core"
            version = project.version.toString()
            afterEvaluate { from(components["release"]) }
            pom {
                name.set("FarmerChat Core SDK")
                description.set(
                    "Headless core (API client with priority timeouts + 401 refresh, " +
                        "session/token store, label manager, use cases and per-screen UDF " +
                        "state machines) for the FarmerChat Android SDK. No UI dependencies."
                )
                url.set("https://github.com/digitalgreenorg/farmerchat-sdk-suite")
                licenses {
                    license {
                        name.set("The Apache License, Version 2.0")
                        url.set("https://www.apache.org/licenses/LICENSE-2.0.txt")
                    }
                }
                developers {
                    developer {
                        id.set("digitalgreen")
                        name.set("Digital Green")
                        organizationUrl.set("https://www.digitalgreen.org")
                    }
                }
                scm {
                    url.set("https://github.com/digitalgreenorg/farmerchat-sdk-suite")
                    connection.set("scm:git:https://github.com/digitalgreenorg/farmerchat-sdk-suite.git")
                }
            }
        }
    }
}
