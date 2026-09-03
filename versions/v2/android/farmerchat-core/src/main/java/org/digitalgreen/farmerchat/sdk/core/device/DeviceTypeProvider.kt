package org.digitalgreen.farmerchat.sdk.core.device

import android.os.Build

/**
 * Classifies whether the SDK is running on an emulator or a physical ("actual") device, for
 * analytics segmentation alongside the SIM carrier attribute. This lets a host filter out
 * internal test/QA traffic (which typically runs on emulators) when analysing real behaviour.
 *
 * 1:1 port of the app's `utils/DeviceTypeProvider.kt` (fc-compose-agentic @ 0c8c740f, 15b1c33d).
 * Detection is heuristic and best-effort: it inspects the well-known emulator fingerprints
 * exposed by [Build]. These cover the standard Android Studio / Google emulators and common
 * alternatives (Genymotion, BlueStacks, Nox, ...). No runtime permission is required, and every
 * read is wrapped so a hostile/odd ROM can never make onboarding throw.
 */
public object DeviceTypeProvider {

    public const val EMULATOR: String = "emulator"

    /**
     * Value for a real handset. Note the name says "actual" while the value says
     * "physical_device" — both are verbatim from the app, because the VALUE is what lands in
     * the host's dashboard and must not be "corrected".
     */
    public const val ACTUAL_DEVICE: String = "physical_device"

    /** Operating system family. Constant "android" for segmentation across platforms. */
    public const val OS: String = "android"

    /** Returns [EMULATOR] or [ACTUAL_DEVICE] for analytics tagging. */
    public fun getDeviceType(): String = if (isEmulator()) EMULATOR else ACTUAL_DEVICE

    /** Device brand, e.g. "samsung", "xiaomi". Best-effort; empty when unavailable. */
    public fun getBrand(): String = runCatching { Build.BRAND.orEmpty() }.getOrDefault("")

    /** Device model, e.g. "SM-G991B", "Pixel 7". Best-effort; empty when unavailable. */
    public fun getModel(): String = runCatching { Build.MODEL.orEmpty() }.getOrDefault("")

    /** Device manufacturer, e.g. "Samsung", "Google". Best-effort; empty when unavailable. */
    public fun getManufacturer(): String =
        runCatching { Build.MANUFACTURER.orEmpty() }.getOrDefault("")

    /** True when the current build fingerprint matches a known emulator/simulator. */
    public fun isEmulator(): Boolean = runCatching {
        val fingerprint = Build.FINGERPRINT.orEmpty()
        val model = Build.MODEL.orEmpty()
        val manufacturer = Build.MANUFACTURER.orEmpty()
        val brand = Build.BRAND.orEmpty()
        val device = Build.DEVICE.orEmpty()
        val product = Build.PRODUCT.orEmpty()
        val hardware = Build.HARDWARE.orEmpty()

        fingerprint.startsWith("generic") ||
            fingerprint.startsWith("unknown") ||
            fingerprint.contains("emulator", ignoreCase = true) ||
            (brand.startsWith("generic") && device.startsWith("generic")) ||
            model.contains("google_sdk", ignoreCase = true) ||
            model.contains("Emulator", ignoreCase = true) ||
            model.contains("Android SDK built for", ignoreCase = true) ||
            model.contains("sdk_gphone", ignoreCase = true) ||
            manufacturer.contains("Genymotion", ignoreCase = true) ||
            hardware.contains("goldfish", ignoreCase = true) ||
            hardware.contains("ranchu", ignoreCase = true) ||
            hardware.contains("vbox", ignoreCase = true) ||
            product.contains("sdk", ignoreCase = true) ||
            product.contains("emulator", ignoreCase = true) ||
            product.contains("simulator", ignoreCase = true)
    }.getOrDefault(false)
}
