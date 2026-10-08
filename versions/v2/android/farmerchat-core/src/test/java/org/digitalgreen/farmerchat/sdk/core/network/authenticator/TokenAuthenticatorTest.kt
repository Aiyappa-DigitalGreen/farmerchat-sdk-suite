package org.digitalgreen.farmerchat.sdk.core.network.authenticator

import com.google.gson.Gson
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.digitalgreen.farmerchat.sdk.core.auth.AuthApi
import org.digitalgreen.farmerchat.sdk.core.auth.GuestReplacedSignal
import org.digitalgreen.farmerchat.sdk.core.auth.GuestReplacement
import org.digitalgreen.farmerchat.sdk.core.auth.TokenStore
import org.digitalgreen.farmerchat.sdk.core.model.InitializeGuestUserResponse
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences.Keys
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.IOException

/**
 * Step 3 (guest re-initialisation) of [TokenAuthenticator] — docs/02 "TokenAuthenticator (401 refresh)".
 * The auth API is a real Retrofit [AuthApi] over an OkHttp client whose terminal interceptor
 * answers canned responses per path (no network), mirroring EndpointOverrideInterceptorTest.
 */
class TokenAuthenticatorTest {

    private class FakeTokenStore(
        var access: String? = "old-access",
        var refresh: String? = "",          // blank → Step 1 (refresh) is skipped
        var user: String? = "old-user",
        var device: String? = "device-1"
    ) : TokenStore {
        override fun getAccessToken() = access
        override fun getRefreshToken() = refresh
        override fun saveTokens(accessToken: String?, refreshToken: String?) {
            access = accessToken; refresh = refreshToken
        }
        override fun getUserId() = user
        override fun saveUserId(userId: String) { user = userId }
        override fun getDeviceId() = device
        override fun clear() { access = null; refresh = null }
    }

    /** path suffix → (code, body) or an IOException to throw. */
    private class FakeBackend(val routes: Map<String, Any>) {
        val hits = mutableListOf<String>()
        val bodies = mutableMapOf<String, String>()
        val interceptor = Interceptor { chain ->
            val req = chain.request()
            val path = req.url.encodedPath
            hits += path
            req.body?.let { b -> Buffer().also { b.writeTo(it) }.readUtf8().let { bodies[path] = it } }
            val route = routes.entries.firstOrNull { path.endsWith(it.key) }?.value
                ?: (404 to "{}")
            if (route is IOException) throw route
            val (code, body) = route as Pair<*, *>
            Response.Builder().request(req).protocol(Protocol.HTTP_1_1)
                .code(code as Int).message("x")
                .body((body as String).toResponseBody("application/json".toMediaType())).build()
        }
        val api: AuthApi = Retrofit.Builder()
            .baseUrl("https://host.example/")
            .client(OkHttpClient.Builder().addInterceptor(interceptor).build())
            .addConverterFactory(GsonConverterFactory.create(Gson()))
            .build()
            .create(AuthApi::class.java)
        fun hit(suffix: String) = hits.any { it.endsWith(suffix) }
    }

    private val sendTokens = "api/user/send_tokens/"
    private val initUser = "api/user/initialize_user/"
    private val initOk = """{"access_token":"new-access","refresh_token":"new-refresh","user_id":"new-user","show_crops_livestocks":false}"""

    private fun authenticator(
        store: FakeTokenStore,
        backend: FakeBackend,
        phoneVerified: Boolean,
        expired: () -> Unit = {},
        reinit: (InitializeGuestUserResponse) -> Unit = {},
        stored: Pair<Double?, Double?> = 12.5 to 77.25,
        fallback: () -> Pair<Double, Double>? = { 1.0 to 38.0 }
    ) = TokenAuthenticator(
        tokenStore = store,
        authApiProvider = { backend.api },
        guestApiKey = "guest-key",
        onSessionExpired = expired,
        isPhoneVerified = { phoneVerified },
        deviceIdSupplier = { store.device },
        storedLatLong = { stored },
        fallbackLatLong = fallback,
        onGuestReinitialized = reinit,
        isMainThread = { false }
    )

    /** A 401 for an ordinary API call carrying the store's current (failed) token. */
    private fun unauthorized(): Response {
        val req = Request.Builder().url("https://host.example/api/chat/new_conversation/")
            .header("Authorization", "Bearer old-access").build()
        return Response.Builder().request(req).protocol(Protocol.HTTP_1_1)
            .code(401).message("Unauthorized").body("".toResponseBody()).build()
    }

    @Test fun `guest + send_tokens 400 re-initialises and retries`() {
        val store = FakeTokenStore()
        val backend = FakeBackend(mapOf(
            sendTokens to (400 to """{"detail":"User not found or inactive."}"""),
            initUser to (200 to initOk)
        ))
        var expired = 0; var reinit = 0
        val retried = authenticator(store, backend, phoneVerified = false,
            expired = { expired++ }, reinit = { reinit++ }).authenticate(null, unauthorized())

        assertNotNull(retried)
        assertEquals("Bearer new-access", retried!!.header("Authorization"))
        assertEquals("https://host.example/api/chat/new_conversation/", retried.url.toString())
        assertTrue(backend.hit(initUser))
        assertEquals("new-access", store.access)
        assertEquals("new-refresh", store.refresh)
        assertEquals("new-user", store.user)
        assertEquals("conversation id removed", 1, reinit)
        assertEquals(0, expired)
        val body = backend.bodies.entries.first { it.key.endsWith(initUser) }.value
        assertTrue(body, body.contains("\"device_id\":\"device-1\""))
        assertTrue(body, body.contains("\"lat\":12.5") && body.contains("\"long\":77.25"))
    }

    @Test fun `guest with blank user id re-initialises without calling send_tokens`() {
        val store = FakeTokenStore(user = "")
        val backend = FakeBackend(mapOf(initUser to (200 to initOk)))
        val retried = authenticator(store, backend, phoneVerified = false).authenticate(null, unauthorized())
        assertNotNull(retried)
        assertFalse(backend.hit(sendTokens))
        assertEquals("new-user", store.user)
    }

    @Test fun `phone-verified user + send_tokens 400 is not re-initialised`() {
        val store = FakeTokenStore()
        val backend = FakeBackend(mapOf(
            sendTokens to (400 to """{"detail":"User not found or inactive."}"""),
            initUser to (200 to initOk)
        ))
        var expired = 0; var reinit = 0
        val result = authenticator(store, backend, phoneVerified = true,
            expired = { expired++ }, reinit = { reinit++ }).authenticate(null, unauthorized())
        assertNull(result)
        assertFalse(backend.hit(initUser))
        assertEquals(1, expired)
        assertEquals(0, reinit)
        assertEquals("old-user", store.user)
    }

    @Test fun `send_tokens network failure does not re-initialise`() {
        val store = FakeTokenStore()
        val backend = FakeBackend(mapOf(
            sendTokens to IOException("timeout"),
            initUser to (200 to initOk)
        ))
        var expired = 0
        val result = authenticator(store, backend, phoneVerified = false, expired = { expired++ })
            .authenticate(null, unauthorized())
        assertNull(result)
        assertFalse(backend.hit(initUser))
        assertEquals("unchanged behaviour: exception path does not fire onSessionExpired", 0, expired)
        assertEquals("old-access", store.access)
    }

    @Test fun `send_tokens 5xx does not re-initialise`() {
        val store = FakeTokenStore()
        val backend = FakeBackend(mapOf(sendTokens to (503 to "{}"), initUser to (200 to initOk)))
        var expired = 0
        val result = authenticator(store, backend, phoneVerified = false, expired = { expired++ })
            .authenticate(null, unauthorized())
        assertNull(result)
        assertFalse(backend.hit(initUser))
        assertEquals(1, expired)
    }

    @Test fun `failed re-init expires the session`() {
        val store = FakeTokenStore()
        val backend = FakeBackend(mapOf(sendTokens to (400 to "{}"), initUser to (500 to "{}")))
        var expired = 0; var reinit = 0
        val result = authenticator(store, backend, phoneVerified = false,
            expired = { expired++ }, reinit = { reinit++ }).authenticate(null, unauthorized())
        assertNull(result)
        assertEquals(1, expired)
        assertEquals(0, reinit)
        assertEquals("old-user", store.user)
    }

    // ---------------------------------------------------------------- Step 3 coordinates

    private val rejected = mapOf(
        "api/user/send_tokens/" to (400 to """{"detail":"User not found or inactive."}"""),
        "api/user/initialize_user/" to (200 to """{"access_token":"new-access","refresh_token":"new-refresh","user_id":"new-user","show_crops_livestocks":false}""")
    )

    private fun initBody(backend: FakeBackend) =
        backend.bodies.entries.first { it.key.endsWith(initUser) }.value

    @Test fun `no stored fix sends the onboarding fallback coordinates`() {
        val backend = FakeBackend(rejected)
        val retried = authenticator(FakeTokenStore(), backend, phoneVerified = false,
            stored = null to null, fallback = { -1.29 to 36.82 }).authenticate(null, unauthorized())
        assertNotNull(retried)
        val body = initBody(backend)
        assertTrue(body, body.contains("\"lat\":-1.29") && body.contains("\"long\":36.82"))
    }

    @Test fun `a stored 0,0 fix is unresolved and falls through to the fallback`() {
        val backend = FakeBackend(rejected)
        authenticator(FakeTokenStore(), backend, phoneVerified = false,
            stored = 0.0 to 0.0, fallback = { -1.29 to 36.82 }).authenticate(null, unauthorized())
        val body = initBody(backend)
        assertTrue(body, body.contains("\"lat\":-1.29") && body.contains("\"long\":36.82"))
    }

    @Test fun `stored fix wins over the fallback`() {
        val backend = FakeBackend(rejected)
        authenticator(FakeTokenStore(), backend, phoneVerified = false,
            stored = 12.5 to 77.25, fallback = { -1.29 to 36.82 }).authenticate(null, unauthorized())
        val body = initBody(backend)
        assertTrue(body, body.contains("\"lat\":12.5") && body.contains("\"long\":77.25"))
    }

    @Test fun `unresolved fallback sends no coordinates`() {
        for (fallback in listOf<() -> Pair<Double, Double>?>(
            { null }, { 0.0 to 0.0 }, { throw IllegalStateException("no locale") }
        )) {
            val backend = FakeBackend(rejected)
            val store = FakeTokenStore()
            val retried = authenticator(store, backend, phoneVerified = false,
                stored = null to null, fallback = fallback).authenticate(null, unauthorized())
            assertNotNull("still re-initialises without coordinates", retried)
            val body = initBody(backend)
            assertTrue(body, body.contains("\"device_id\":\"device-1\""))
            assertFalse(body, body.contains("\"lat\"") || body.contains("\"long\""))
            assertEquals("new-user", store.user)
        }
    }

    // ---------------------------------------------------------------- Step 3 success effects

    @Test fun `success rewrites the old user's place keys from the response`() {
        val backend = FakeBackend(mapOf(
            sendTokens to (400 to "{}"),
            initUser to (200 to """{"access_token":"new-access","refresh_token":"new-refresh","user_id":"new-user","show_crops_livestocks":false,"country_code":"KE","country":"Kenya","state":"Nairobi"}""")
        ))
        val prefs = mutableMapOf(
            Keys.NEW_CONVERSATION_ID to "old-conv",
            Keys.APPROX_LOCATION_NAME to "Bagalkot",
            Keys.USER_SELECTED_STATE_CODE to "Karnataka",
            Keys.USER_COUNTRY_NAME to "India",
            Keys.USER_COUNTRY_CODE to "IN",
            Keys.SELECTED_LANGUAGE_CODE to "hi"
        )
        authenticator(FakeTokenStore(), backend, phoneVerified = false, reinit = { response ->
            GuestReplacement.rewritePrefs(response, remove = { prefs.remove(it) },
                put = { k, v -> prefs[k] = v })
        }).authenticate(null, unauthorized())

        assertNull(prefs[Keys.NEW_CONVERSATION_ID])
        assertNull("old place name dropped", prefs[Keys.APPROX_LOCATION_NAME])
        assertEquals("KE", prefs[Keys.USER_COUNTRY_CODE])
        assertEquals("Kenya", prefs[Keys.USER_COUNTRY_NAME])
        assertEquals("Nairobi", prefs[Keys.USER_SELECTED_STATE_CODE])
        assertEquals("unrelated prefs kept", "hi", prefs[Keys.SELECTED_LANGUAGE_CODE])
    }

    @Test fun `a response without a place still drops the old one`() {
        val prefs = mutableMapOf(
            Keys.APPROX_LOCATION_NAME to "Bagalkot",
            Keys.USER_SELECTED_STATE_CODE to "Karnataka",
            Keys.USER_COUNTRY_NAME to "India",
            Keys.USER_COUNTRY_CODE to "IN"
        )
        authenticator(FakeTokenStore(), FakeBackend(rejected), phoneVerified = false, reinit = { response ->
            GuestReplacement.rewritePrefs(response, remove = { prefs.remove(it) },
                put = { k, v -> prefs[k] = v })
        }).authenticate(null, unauthorized())
        assertNull(prefs[Keys.APPROX_LOCATION_NAME])
        assertNull(prefs[Keys.USER_SELECTED_STATE_CODE])
        assertNull(prefs[Keys.USER_COUNTRY_NAME])
        assertEquals("country code is overwritten only when the response has one", "IN", prefs[Keys.USER_COUNTRY_CODE])
    }

    @Test fun `guest-replaced signal fires once, not again for a concurrent 401 on the old token`() = runBlocking {
        val signal = GuestReplacedSignal()
        var received = 0
        var generationSeenByListener = -1
        assertEquals(0, signal.generation)
        val collector = launch(start = CoroutineStart.UNDISPATCHED) {
            signal.events.collect { received++; generationSeenByListener = signal.generation }
        }
        val store = FakeTokenStore()
        val backend = FakeBackend(rejected)
        var hook = 0
        val auth = authenticator(store, backend, phoneVerified = false, reinit = {
            hook++
            signal.notifyGuestReplaced()
        })
        assertNotNull(auth.authenticate(null, unauthorized()))
        // A second request that 401'd with the old token takes the single-flight short-circuit.
        val second = auth.authenticate(null, unauthorized())
        assertEquals("Bearer new-access", second!!.header("Authorization"))
        yield()
        assertEquals(1, hook)
        assertEquals(1, received)
        assertEquals("generation bumped once", 1, signal.generation)
        assertEquals("bumped BEFORE listeners run", 1, generationSeenByListener)
        assertEquals(1, backend.hits.count { it.endsWith(initUser) })
        collector.cancel()
    }

    @Test fun `guest generation increments on every replacement`() {
        val signal = GuestReplacedSignal()
        val captured = signal.generation      // a load starting now
        signal.notifyGuestReplaced()
        assertTrue("a load captured before the replacement is stale", captured != signal.generation)
        val recaptured = signal.generation    // the reload
        assertEquals(recaptured, signal.generation)
        signal.notifyGuestReplaced()
        assertEquals(2, signal.generation)
    }
}
