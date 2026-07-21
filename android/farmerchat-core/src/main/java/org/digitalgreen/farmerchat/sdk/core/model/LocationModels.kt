package org.digitalgreen.farmerchat.sdk.core.model

// ---------------- Update user location (POST api/user/update_user_location/) ----------------

data class UpdateLocationRequest(
    val lat: String? = null,
    val long: String? = null,
    val user_id: String,
    val country: String? = null,
    val level_2: String? = null,
    val level_3: String? = null,
    val level_4: String? = null,
    val level_5: String? = null,
    val level_6: String? = null,
    val display_address: String? = null,
    val osm_response: OsmResponse? = null
)

data class OsmResponse(
    val address: OsmAddress? = null,
    val addresstype: String? = null,
    val boundingbox: List<String>? = null,
    val class_name: String? = null,
    val display_name: String? = null,
    val importance: Double? = null,
    val lat: String? = null,
    val licence: String? = null,
    val lon: String? = null,
    val name: String? = null,
    val osm_id: Long? = null,
    val osm_type: String? = null,
    val place_id: Int? = null,
    val place_rank: Int? = null,
    val type: String? = null
)

data class OsmAddress(
    val city: String? = null,
    val country: String? = null,
    val country_code: String? = null,
    val county: String? = null,
    val postcode: String? = null,
    val state: String? = null,
    val state_district: String? = null,
    val village: String? = null
)

data class GetLocationResponse(
    val error_message: String? = null,
    val user_profile: LocationUserProfile? = null
)

data class LocationUserProfile(
    val user_id: String? = null,
    val country_name: String? = null,
    val country_code: String? = null,
    val geography_level2_name: String? = null,
    val geography_level3: String? = null,
    val geography_level4: String? = null,
    val geography_level5: String? = null,
    val geography_level6: String? = null,
    val display_address: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null
)
