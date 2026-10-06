plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
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
    namespace = "org.digitalgreen.farmerchat.sdk.views"
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
        viewBinding = true
        compose = true
    }
    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }
}

// `ViewsAppParityTest` reads the layout and values XML off the filesystem at runtime, which
// Gradle does not otherwise treat as an input to a JVM test task. Without this the task reports
// UP-TO-DATE after a resource-only change and the guard silently does not run — verified by
// mutating four resources and watching three of them go undetected.
tasks.withType<Test>().configureEach {
    inputs.dir(layout.projectDirectory.dir("src/main/res"))
        .withPropertyName("parityTestResources")
        .withPathSensitivity(PathSensitivity.RELATIVE)
}

dependencies {
    api(project(":farmerchat-core"))

    // Compose — for TEXT RENDERING ONLY. See `FcComposeText`.
    //
    // Deliberately the raw Compose libraries and NOT `:farmerchat-android-compose`: depending on
    // that module would put its `FarmerChatActivity` on every views host's classpath, and
    // `FarmerChat.resolveActivityClass()` tries the compose activity FIRST — so a views host would
    // silently start the Compose UI instead. See docs/04 and the views-flavour memory.
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.foundation)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.fragment.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.androidx.constraintlayout)
    implementation(libs.androidx.recyclerview)
    implementation(libs.androidx.swiperefreshlayout)
    implementation(libs.androidx.navigation.fragment)
    implementation(libs.androidx.navigation.ui)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.core.splashscreen)

    testImplementation(libs.junit)

    implementation(libs.coil)
    implementation(libs.coil.svg)

    // Optional platform integrations (guarded at runtime; absence must never crash)
    implementation(libs.play.services.location)
    implementation(libs.play.services.auth.api.phone)
}

publishing {
    publications {
        register<MavenPublication>("release") {
            groupId = project.group.toString()
            artifactId = "farmerchat-android-views"
            version = project.version.toString()
            // The generated POM declares a dependency on farmerchat-core
            // (from `api(project(":farmerchat-core"))`) plus the Views runtime deps.
            afterEvaluate { from(components["release"]) }
            pom {
                name.set("FarmerChat Views SDK")
                description.set(
                    "Full FarmerChat journey in XML + Fragments " +
                        "(FarmerChatActivity / FarmerChatFragment / FarmerChatFab). " +
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
