package org.digitalgreen.farmerchat.sdk.core.device

import android.content.Context
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager

/**
 * Reads the SIM carrier (mobile network operator) for analytics segmentation, e.g. comparing
 * usage between users on free-data carrier plans (Safaricom, Airtel, Ethio Telecom, ...) and
 * those without.
 *
 * 1:1 port of the app's `utils/sim/CarrierInfoProvider.kt` (fc-compose-agentic @ 0c8c740f,
 * 2d5ee864 + hardening 2fbe0924).
 *
 * We deliberately use the SIM operator (the SIM issuer), NOT the network operator, because the
 * network operator changes under roaming and would misattribute the carrier. None of these reads
 * requires a runtime permission.
 *
 * On dual-SIM devices we target the default data subscription (the SIM most relevant to a
 * free-data plan), falling back to the default TelephonyManager when that isn't available.
 *
 * Hardening contract: this NEVER throws. Telephony may be absent entirely (Wi-Fi-only tablets,
 * some Android TV/auto builds), the service cast may fail, and OEM telephony stacks are known to
 * throw from `simState` / `createForSubscriptionId`. Every path returns null instead.
 */
public object CarrierInfoProvider {

    /**
     * @param name Human-readable SIM operator name, e.g. "Safaricom". Empty/casing varies by device.
     * @param code Numeric MCC+MNC operator code, e.g. "63902". Stable identifier for segmentation.
     */
    public data class CarrierInfo(
        val name: String,
        val code: String
    ) {
        public val hasAny: Boolean get() = name.isNotBlank() || code.isNotBlank()
    }

    /** Returns carrier info for the default data SIM, or null when no SIM/operator is available. */
    public fun getCarrierInfo(context: Context): CarrierInfo? =
        runCatching { read(resolveTelephonyManager(context)) }.getOrNull()

    /**
     * The pure part of the read, split out so the "telephony absent ⇒ null, never throw"
     * contract is unit-testable without a real [Context]/[TelephonyManager].
     */
    internal fun read(tm: TelephonyManager?): CarrierInfo? {
        if (tm == null) return null
        return readCarrier(
            simReady = { tm.simState == TelephonyManager.SIM_STATE_READY },
            operatorName = { tm.simOperatorName },
            operatorCode = { tm.simOperator }
        )
    }

    /**
     * Fully injectable core: any supplier may throw (OEM telephony stacks do) and the result is
     * null rather than a crash on the splash path.
     */
    internal fun readCarrier(
        simReady: () -> Boolean,
        operatorName: () -> String?,
        operatorCode: () -> String?
    ): CarrierInfo? {
        // simState guards no-SIM / eSIM-without-profile / no-service cases where the reads are
        // meaningless.
        val ready = runCatching { simReady() }.getOrDefault(false)
        if (!ready) return null

        val name = runCatching { operatorName() }.getOrNull()?.trim().orEmpty()
        val code = runCatching { operatorCode() }.getOrNull()?.trim().orEmpty()

        return CarrierInfo(name = name, code = code).takeIf { it.hasAny }
    }

    private fun resolveTelephonyManager(context: Context): TelephonyManager? {
        val baseTm = runCatching {
            context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
        }.getOrNull() ?: return null

        val dataSubId =
            runCatching { SubscriptionManager.getDefaultDataSubscriptionId() }.getOrNull()
        if (dataSubId != null && dataSubId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
            runCatching { baseTm.createForSubscriptionId(dataSubId) }.getOrNull()?.let { return it }
        }
        return baseTm
    }
}
