plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    id("maven-publish")
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        // The SDK's own UI artifact may reach the internal service graph.
        freeCompilerArgs.add("-opt-in=org.digitalgreen.farmerchat.sdk.InternalFarmerChatApi")
    }
}

android {
    namespace = "org.digitalgreen.farmerchat.sdk.compose"
    compileSdk = 36
    resourcePrefix = "fc_"

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
    buildFeatures {
        compose = true
    }
    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }
}

dependencies {
    api(project(":farmerchat-core"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.core.splashscreen)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.coil.compose)
    implementation(libs.coil.svg)

    // Optional platform integrations (guarded at runtime; absence must never crash)
    implementation(libs.play.services.location)
    implementation(libs.play.services.auth.api.phone)
}

publishing {
    publications {
        register<MavenPublication>("release") {
            groupId = project.group.toString()
            artifactId = "farmerchat-android-compose"
            version = project.version.toString()
            // The generated POM declares a dependency on farmerchat-core
            // (from `api(project(":farmerchat-core"))`) plus the Compose runtime deps.
            afterEvaluate { from(components["release"]) }
            pom {
                name.set("FarmerChat Compose SDK")
                description.set(
                    "Full FarmerChat journey as a Jetpack Compose drop-in " +
                        "(FarmerChatActivity / FarmerChatRoot / FarmerChatInline / FarmerChatFab). " +
                        "Depends on farmerchat-core."
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
