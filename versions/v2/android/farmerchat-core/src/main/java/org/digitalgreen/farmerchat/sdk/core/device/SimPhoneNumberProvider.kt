package org.digitalgreen.farmerchat.sdk.core.device

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat

/**
 * Reads the phone numbers of the device's active SIMs so the Auth screen can offer them instead
 * of making the farmer type their own number.
 *
 * Port of the app's `utils/sim/SimPhoneNumberProvider.kt` (fc-compose-agentic @ 0c8c740f).
 *
 * ## The SDK does NOT declare the permissions this needs
 *
 * `READ_PHONE_STATE` and `READ_PHONE_NUMBERS` are sensitive, and a library manifest merges into
 * every host — a host that never shows the Auth screen would still inherit them and have to
 * justify them on their store listing. So the SDK declares neither, and this provider degrades to
 * "no SIM numbers" unless the HOST declares them:
 *
 * ```xml
 * <uses-permission android:name="android.permission.READ_PHONE_STATE" />
 * <uses-permission android:name="android.permission.READ_PHONE_NUMBERS" />
 * ```
 *
 * [canReadPhoneNumber] is a pure runtime check, so an undeclared permission is simply "denied" —
 * never a crash. Requesting a permission the host has not declared is denied immediately by the
 * platform, which is also safe.
 *
 * ## Never throws
 *
 * Telephony can be absent entirely (Wi-Fi-only tablets, some TV/auto builds), the service cast
 * can fail, and OEM telephony stacks are known to throw from `createForSubscriptionId`. Every
 * path returns an empty list instead. Same hardening contract as [CarrierInfoProvider].
 */
object SimPhoneNumberProvider {

    /**
     * Both permissions are required. `READ_PHONE_NUMBERS` is API 26+, and the SDK's minSdk IS 26,
     * so unlike the app there is no pre-O branch to take here.
     */
    fun canReadPhoneNumber(context: Context): Boolean =
        hasPermission(context, Manifest.permission.READ_PHONE_STATE) &&
            hasPermission(context, Manifest.permission.READ_PHONE_NUMBERS)

    /** The permissions a host must request before [getSimLineNumbers] can return anything. */
    val requiredPermissions: Array<String> = arrayOf(
        Manifest.permission.READ_PHONE_STATE,
        Manifest.permission.READ_PHONE_NUMBERS
    )

    /**
     * True when the HOST has declared both permissions in its merged manifest.
     *
     * This is the SDK's opt-in signal. Android denies a request for an undeclared permission
     * instantly and without a dialog, so asking anyway would just show the farmer a failure toast
     * for a feature their host never enabled. The SDK therefore prompts only when the host has
     * declared the permissions, and is completely silent otherwise.
     */
    fun isDeclaredByHost(context: Context): Boolean = runCatching {
        val declared = context.packageManager
            .getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
            .requestedPermissions
            ?.toSet()
            .orEmpty()
        requiredPermissions.all { it in declared }
    }.getOrDefault(false)

    /**
     * Distinct, non-blank line numbers across the active subscriptions — empty when the
     * permissions are missing, telephony is unavailable, or the SIMs report no number (common:
     * many carriers simply do not write MSISDN to the SIM).
     */
    fun getSimLineNumbers(context: Context): List<String> {
        if (!canReadPhoneNumber(context)) return emptyList()
        return runCatching { readLineNumbers(context) }.getOrDefault(emptyList())
    }

    private fun readLineNumbers(context: Context): List<String> {
        val subscriptionManager = context
            .getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
            ?: return emptyList()
        val activeSubs = subscriptionManager.activeSubscriptionInfoList ?: return emptyList()
        if (activeSubs.isEmpty()) return emptyList()

        val telephonyManager = context
            .getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
            ?: return emptyList()

        return activeSubs.mapNotNull { sub ->
            runCatching {
                telephonyManager.createForSubscriptionId(sub.subscriptionId)
                    .line1Number
                    ?.trim()
                    ?.takeIf { it.isNotBlank() }
            }.getOrNull()
        }.distinct()
    }

    private fun hasPermission(context: Context, permission: String): Boolean =
        runCatching {
            ContextCompat.checkSelfPermission(context, permission) ==
                PackageManager.PERMISSION_GRANTED
        }.getOrDefault(false)
}
