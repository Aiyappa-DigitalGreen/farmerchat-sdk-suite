package org.digitalgreen.farmerchat.sdk.core.auth

import org.digitalgreen.farmerchat.sdk.core.remote.ApiConstants
import org.digitalgreen.farmerchat.sdk.core.model.InitializeGuestUserRequest
import org.digitalgreen.farmerchat.sdk.core.model.InitializeGuestUserResponse
import org.digitalgreen.farmerchat.sdk.core.model.RefreshTokenRequest
import org.digitalgreen.farmerchat.sdk.core.model.RefreshTokenResponse
import org.digitalgreen.farmerchat.sdk.core.model.SendNewTokenRequest
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

/**
 * Token endpoints, non-suspend (synchronously executed from [TokenAuthenticator]).
 */
interface AuthApi {

    @POST(ApiConstants.AUTH_REFRESH)
    fun refreshToken(
        @Body request: RefreshTokenRequest
    ): Call<RefreshTokenResponse>

    @POST(ApiConstants.SEND_USER_TOKENS)
    fun sendUserTokens(
        @Header("API-Key") apiKey: String,
        @Body body: SendNewTokenRequest
    ): Call<RefreshTokenResponse>

    /**
     * Endpoint #1 (guest init), same path/header/body as [ApiServices.initializeGuestUser] but as a
     * blocking [Call] — used only by [TokenAuthenticator] Step 3 (guest re-initialisation), which
     * runs synchronously on an OkHttp thread.
     */
    @POST(ApiConstants.INITIALIZE_GUEST_USER)
    fun initializeGuestUser(
        @Header("API-Key") apiKey: String,
        @Body body: InitializeGuestUserRequest
    ): Call<InitializeGuestUserResponse>
}
