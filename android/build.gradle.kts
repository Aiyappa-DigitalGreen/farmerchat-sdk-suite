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
val farmerChatVersion = "1.0.0" // == FarmerChatVersion

// Expose to all modules (referenced by publish blocks and, optionally, runtime).
extra["FarmerChatGroup"] = farmerChatGroup
extra["FarmerChatVersion"] = farmerChatVersion

subprojects {
    group = farmerChatGroup
    version = farmerChatVersion
}
