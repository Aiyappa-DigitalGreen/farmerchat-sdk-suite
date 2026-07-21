package org.digitalgreen.farmerchat.sdk.core.remote

import org.digitalgreen.farmerchat.sdk.core.model.GeoRequestBody
import org.digitalgreen.farmerchat.sdk.core.model.GeoResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * Google Geolocation API — used as language auto-detect fallback.
 * POST https://www.googleapis.com/geolocation/v1/geolocate?key=<GEO_API_KEY>
 */
interface GoogleGeoApi {

    @POST("geolocation/v1/geolocate")
    suspend fun geolocate(
        @Query("key") apiKey: String,
        @Body body: GeoRequestBody = GeoRequestBody(considerIp = true)
    ): Response<GeoResponse>
}
