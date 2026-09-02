package org.digitalgreen.farmerchat.sdk.core.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

// ---------------- Update profile / name ----------------

data class UserNameRequest(
    val age: Int? = null,
    val farmer_reach_count: Int? = null,
    val gender: String? = null,
    val land_holding: String? = null,
    val live_stock_details: List<LiveStockDetail>? = null,
    val name: String? = null,
    val profile_picture: String? = null,
    val receive_com_via_whatsapp: Boolean = false,
    val role: String? = null,
    val specialization: String? = null,
    val user_id: String
)

data class UserNameResponse(
    val message: String,
    val user_profile: UpdateUserName
)

data class UpdateUserName(
    val address: UpdateUserAddress? = null,
    val age: Int? = null,
    val country: Int? = null,
    val crop_details: List<String>? = null,
    val farmer_reach_count: Int? = null,
    val first_name: String? = null,
    val gender: String? = null,
    val geography_level2: String? = null,
    val geography_level3: String? = null,
    val geography_level4: String? = null,
    val geography_level5: String? = null,
    val geography_level6: String? = null,
    val id: String? = null,
    val land_holding: String? = null,
    val last_name: String? = null,
    val lat: String? = null,
    val live_stock_details: List<LiveStockDetail>? = null,
    val long: String? = null,
    val preferred_language: String? = null,
    val phone: String? = null,
    val phone_country_code: String? = null,
    val profile_picture: String? = null,
    val role: String? = null,
    val specialization: String? = null,
    val user_id: String? = null
)

data class LiveStockDetail(
    val count: Int? = null,
    val type: String? = null
) : Serializable

data class UpdateUserAddress(
    val address_line1: String? = null,
    val address_line2: String? = null,
    val village: String? = null,
    val district: String? = null,
    val state: String? = null,
    val pincode: String? = null
)

// ---------------- Build version ----------------

data class UpdateBuildVersionRequest(
    val user_id: String
)

data class UpdateBuildVersionResponse(
    val message: String?,
    val build_version: String?,
    val user_id: String?
) : Serializable

// ---------------- View profile ----------------

data class FarmerProfile(
    @SerializedName("user_profile") val userProfile: ProfileUser,
    @SerializedName("role_assigned") val roleAssigned: RoleAssigned?
)

data class RoleAssigned(
    val id: Int? = null,
    val role_name: String? = null,
    val role_display_name: String? = null
)

data class ProfileUser(
    val address: ProfileAddress? = null,
    val age: Int? = null,
    val country: Int? = null,
    val country_name: String? = null,
    val crop_details: List<ProfileCrop>? = null,
    val farmland_details: List<ProfileFarmlandDetails>? = null,
    val farmer_reach_count: Int? = null,
    val first_name: String? = null,
    val gender: String? = null,
    val geography_display_address: String? = null,
    val geography_level2: Int? = null,
    val geography_level2_name: String? = null,
    val geography_level3: String? = null,
    val geography_level4: String? = null,
    val geography_level5: String? = null,
    val geography_level6: String? = null,
    val id: String? = null,
    val land_holding: String? = null,
    val last_name: String? = null,
    val lat: String? = null,
    val live_stock_details: List<LiveStockDetail>? = null,
    val llm_model: String? = null,
    val long: String? = null,
    val memory: List<ProfileMemory>? = null,
    val preferred_language: String? = null,
    val phone: String? = null,
    val phone_country_code: String? = null,
    val profile_picture: String? = null,
    var receive_com_via_whatsapp: Boolean = false,
    val role: List<ProfileRole>? = null,
    val show_feedback_prompt: Boolean? = null,
    val specialization: String? = null,
    val user_id: String? = null
) {
    fun displayName(): String {
        fun sanitize(value: String?): String {
            val v = value?.trim().orEmpty()
            return if (v.equals("No Name", ignoreCase = true) || v.equals("null", ignoreCase = true)) "" else v
        }
        val first = sanitize(first_name)
        val last = sanitize(last_name)
        return listOf(first, last).filter { it.isNotBlank() }.joinToString(" ").trim()
    }
}

data class ProfileAddress(
    val country: String? = null,
    val level_2: String? = null,
    val level_3: String? = null,
    val level_4: String? = null,
    val level_5: String? = null,
    val level_6: String? = null,
    val city: String? = null,
    val state: String? = null,
    val state_district: String? = null
)

data class ProfileCrop(
    val id: String? = null,
    val text: String? = null
)

data class ProfileFarmlandDetails(
    val country_name: String? = null,
    val crops_grown: List<String>? = null,
    val display_address: String? = null,
    val farm_name: String? = null,
    val id: String? = null,
    val land_holding: String? = null,
    val lat: String? = null,
    val long: String? = null,
    val geography_level2_name: String? = null,
    val geography_level2_other: String? = null,
    val geography_level3: String? = null,
    val geography_level4: String? = null,
    val geography_level5: String? = null,
    val geography_level6: String? = null,
    val user_id: String? = null
)

data class ProfileMemory(
    val concerns: List<String>? = null,
    val last_known_stage: String? = null,
    val last_known_stage_time: String? = null,
    val last_queried_time: String? = null,
    val name: String? = null,
    val time_added: String? = null,
    val type: String? = null
)

data class ProfileRole(
    val id: String? = null,
    val text: String? = null
)
