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
import org.digitalgreen.farmerchat.sdk.core.auth.AuthApi
import org.digitalgreen.farmerchat.sdk.core.auth.TokenStore
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
        reinit: () -> Unit = {}
    ) = TokenAuthenticator(
        tokenStore = store,
        authApiProvider = { backend.api },
        guestApiKey = "guest-key",
        onSessionExpired = expired,
        isPhoneVerified = { phoneVerified },
        deviceIdSupplier = { store.device },
        storedLatLong = { 12.5 to 77.25 },
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
}
