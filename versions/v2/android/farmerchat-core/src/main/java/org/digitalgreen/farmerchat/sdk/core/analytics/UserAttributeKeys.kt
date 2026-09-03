package org.digitalgreen.farmerchat.sdk.core.analytics

/**
 * User-ATTRIBUTE keys (not event names, not event property keys).
 *
 * These are the keys the production app passes to `UserAttributeTracker.track()`, which fans out
 * to MoEngage `setUserAttribute`, Firebase `setUserProperty`, Plotline `identify` and Adjust
 * global partner params. The SDK bundles no vendor SDK (root CLAUDE.md §6): it raises the same
 * key/value pairs through [org.digitalgreen.farmerchat.sdk.FarmerChatConfig.onUserAttribute] so a
 * host can forward them to whatever it uses.
 *
 * Every string is transcribed character-for-character from the app's
 * `core/analytics/UserAttributeKeys.kt` (fc-compose-agentic @ 0c8c740f, commit 2fbe0924). A typo
 * here is invisible at runtime — it just creates a second, empty column in someone's dashboard
 * weeks later — so `UserAttributeKeysTest` asserts them as literals.
 *
 * SCOPE: the app defines 54 attribute keys. Only the 7 device/carrier ones below are raised by
 * the SDK today; see docs/04-parity-matrix.md. This object deliberately does not declare keys
 * nothing raises.
 */
public object UserAttributeKeys {

    /** SIM carrier / mobile network operator name, e.g. "Safaricom", "Airtel", "Ethio Telecom". */
    public const val CARRIER_NAME: String = "Carrier_Name"

    /** SIM carrier numeric operator code (MCC+MNC), e.g. "63902". Stable id for segmentation. */
    public const val CARRIER_CODE: String = "Carrier_Code"

    /** Runtime environment: "emulator" or "physical_device". Lets a host exclude test/QA traffic. */
    public const val DEVICE_TYPE: String = "Device_Type"

    /** Device brand, e.g. "samsung", "xiaomi". */
    public const val BRAND: String = "Brand"

    /** Device model, e.g. "SM-G991B", "Pixel 7". */
    public const val MODEL: String = "Model"

    /** Device manufacturer, e.g. "Samsung", "Google". */
    public const val MANUFACTURER: String = "Manufacturer"

    /** Operating system family, constant "android" (the VALUE lives in DeviceTypeProvider.OS). */
    public const val OS: String = "OS"
}
