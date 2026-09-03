package org.digitalgreen.farmerchat.sdk.core.ui.home

import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.model.AcceptPPandTCResponse
import org.digitalgreen.farmerchat.sdk.core.model.LatestPolicyVersion
import org.digitalgreen.farmerchat.sdk.core.model.PolicyAcceptanceStatusResponse
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pins the mandatory Terms-of-Use acceptance gate (endpoint #7a) — [requiresTermsAcceptance] and
 * [latestTermsOfServiceUrl].
 *
 * Worth pinning because the sheet this predicate raises is **non-cancellable**. Every way of
 * getting it wrong is a farmer locked out of Home rather than a build failure:
 *  * raising it before #7a has answered (Idle/Loading must be false),
 *  * failing to lower it once #7 succeeds (the only exit),
 *  * lowering it on a #7 *failure* (which would let the user past the gate unaccepted),
 *  * or loading #4's `farmerchatTermsOfUse` instead of #7a's `terms_of_service_url`.
 *
 * The live #7a shape these fixtures mirror is recorded in docs/02 §Endpoint #7a.
 */
class TermsOfUseGateTest {

    private val policyVersion = LatestPolicyVersion(
        id = 2,
        policy_type = "combined",
        version_label = "v2",
        published_at = "2026-09-02T14:09:15.601280Z",
        terms_of_service_url = "https://farmerchat.farmstack.co/v2/farmer_chat_tos_stage/",
        privacy_policy_url = "https://farmerchat.farmstack.co/farmer_chat_pp/"
    )

    private fun status(requires: Boolean, version: LatestPolicyVersion? = policyVersion) =
        PolicyAcceptanceStatusResponse(
            requires_acceptance = requires,
            terms_accepted = !requires,
            terms_accepted_at = null,
            latest_policy_version = version
        )

    private val accepted = UiState.Success(
        AcceptPPandTCResponse(
            message = "ok",
            success = true,
            terms_accepted = true,
            terms_accepted_at = "2026-09-03T00:00:00Z"
        )
    )

    // ------------------------------------------------------------------ raising the gate

    @Test
    fun `gate is down before the check has run`() {
        assertFalse(HomeState().requiresTermsAcceptance())
        assertFalse(
            HomeState(policyAcceptanceState = UiState.Loading).requiresTermsAcceptance()
        )
    }

    @Test
    fun `gate stays down when the check itself failed`() {
        // A P2 failure must not block Home — the app treats only a positive
        // requires_acceptance as the signal.
        assertFalse(
            HomeState(policyAcceptanceState = UiState.Error("boom", code = 500))
                .requiresTermsAcceptance()
        )
    }

    @Test
    fun `gate rises on requires_acceptance true`() {
        assertTrue(
            HomeState(policyAcceptanceState = UiState.Success(status(requires = true)))
                .requiresTermsAcceptance()
        )
    }

    @Test
    fun `gate stays down when acceptance is not required`() {
        assertFalse(
            HomeState(policyAcceptanceState = UiState.Success(status(requires = false)))
                .requiresTermsAcceptance()
        )
    }

    // ------------------------------------------------------------------ lowering the gate

    @Test
    fun `a successful accept_terms is the only thing that lowers the gate`() {
        val base = HomeState(policyAcceptanceState = UiState.Success(status(requires = true)))
        assertTrue(base.requiresTermsAcceptance())
        assertFalse(base.copy(acceptTermsState = accepted).requiresTermsAcceptance())
    }

    @Test
    fun `an in-flight or failed accept_terms leaves the gate up`() {
        val base = HomeState(policyAcceptanceState = UiState.Success(status(requires = true)))
        // Loading: still up, so the sheet keeps showing its spinner rather than vanishing.
        assertTrue(base.copy(acceptTermsState = UiState.Loading).requiresTermsAcceptance())
        // Error: still up, and the sheet's buttons re-enable for a retry. Lowering it here
        // would let the farmer past the gate without having accepted.
        assertTrue(
            base.copy(acceptTermsState = UiState.Error("no network", isNetworkError = true))
                .requiresTermsAcceptance()
        )
    }

    @Test
    fun `a re-required acceptance re-raises the gate after acceptTermsState resets`() {
        // HomeViewModel.fetchPolicyAcceptanceStatus resets acceptTermsState to Idle in the same
        // update as policyAcceptanceState = Loading, precisely so a stale Success from the
        // dismissible TermsOfUseDialog earlier in the session cannot suppress a new prompt.
        val stale = HomeState(
            policyAcceptanceState = UiState.Success(status(requires = true)),
            acceptTermsState = accepted
        )
        assertFalse(stale.requiresTermsAcceptance())

        val afterReset = stale.copy(
            policyAcceptanceState = UiState.Success(status(requires = true)),
            acceptTermsState = UiState.Idle
        )
        assertTrue(afterReset.requiresTermsAcceptance())
    }

    // ------------------------------------------------------------------ the content-screen URL

    @Test
    fun `content screen loads the 7a terms_of_service_url, never the number 4 link`() {
        val state = HomeState(
            policyAcceptanceState = UiState.Success(status(requires = true)),
            // #4's link is deliberately different, and must never be picked up here.
            farmerchatTermsOfUse = "https://example.invalid/number-4-terms"
        )
        assertEquals(
            "https://farmerchat.farmstack.co/v2/farmer_chat_tos_stage/",
            state.latestTermsOfServiceUrl()
        )
    }

    @Test
    fun `terms url is null when the check has not answered or carries no version`() {
        assertNull(HomeState().latestTermsOfServiceUrl())
        assertNull(HomeState(policyAcceptanceState = UiState.Loading).latestTermsOfServiceUrl())
        // latest_policy_version is nullable on the wire; the gate still rises, but "Read terms"
        // has nothing to open — the UI guards on a non-blank URL.
        val noVersion = HomeState(
            policyAcceptanceState = UiState.Success(status(requires = true, version = null))
        )
        assertTrue(noVersion.requiresTermsAcceptance())
        assertNull(noVersion.latestTermsOfServiceUrl())
    }
}
