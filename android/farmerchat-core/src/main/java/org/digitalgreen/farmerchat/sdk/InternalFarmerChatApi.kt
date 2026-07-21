package org.digitalgreen.farmerchat.sdk

/**
 * Marks declarations that are internal plumbing of the FarmerChat SDK and are
 * NOT part of the supported public API. They are visible across the SDK's own
 * artifacts (`farmerchat-android-compose` / `farmerchat-android-views`, which
 * opt in at the module level) but host apps must never touch them — doing so
 * requires an explicit `@OptIn(InternalFarmerChatApi::class)` and comes with no
 * compatibility guarantees.
 */
@RequiresOptIn(
    level = RequiresOptIn.Level.ERROR,
    message = "This is internal FarmerChat SDK plumbing and is not part of the supported public API. " +
        "It may change or be removed without notice."
)
@Retention(AnnotationRetention.BINARY)
@Target(
    AnnotationTarget.CLASS,
    AnnotationTarget.FUNCTION,
    AnnotationTarget.PROPERTY,
    AnnotationTarget.CONSTRUCTOR
)
annotation class InternalFarmerChatApi

/**
 * Published SDK version — the single runtime mirror of the Gradle coordinate
 * version (`org.digitalgreen.farmerchat:*:1.0.0`). Kept in sync with the
 * `farmerChatVersion` declared in the root build script.
 */
object FarmerChatVersion {
    const val VERSION: String = "1.0.0"
}
