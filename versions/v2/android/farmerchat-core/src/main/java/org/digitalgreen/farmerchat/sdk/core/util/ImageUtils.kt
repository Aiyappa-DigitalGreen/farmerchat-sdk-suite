package org.digitalgreen.farmerchat.sdk.core.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import java.io.ByteArrayOutputStream

/**
 * Image handling for image queries (endpoint #28). Decodes + downscales the
 * picked/captured image, compresses to JPEG and base64-encodes it; GPS
 * coordinates come from the SDK's stored location (app parity: ImageUtils
 * reads EXIF/current location and persists to PLANTIX prefs — the SDK uses the
 * already-persisted FARMER_APP_LATITUDE/LONGITUDE).
 */
object ImageUtils {

    private const val TAG = "FcSdkImageUtils"
    private const val MAX_DIMENSION = 1280
    private const val JPEG_QUALITY = 85

    data class ImageResult(
        val base64Image: String,
        val latitude: Double?,
        val longitude: Double?,
        val sizeKb: Int
    )

    suspend fun prepareImageForUpload(
        context: Context,
        imageUri: Uri,
        prefs: SdkPreferences
    ): ImageResult? = withContext(Dispatchers.IO) {
        try {
            val resolver = context.contentResolver

            // Bounds pass for downsampling
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            // With inJustDecodeBounds decodeStream ALWAYS returns null (it only fills [bounds]),
            // so its result must not be the "unreadable" signal — using it rejected every photo
            // before upload ("Failed to process image"). Unreadable = no stream, or no size.
            val opened = resolver.openInputStream(imageUri)?.use {
                BitmapFactory.decodeStream(it, null, bounds)
                true
            } ?: false
            if (!opened || bounds.outWidth <= 0 || bounds.outHeight <= 0) return@withContext null

            var sampleSize = 1
            var width = bounds.outWidth
            var height = bounds.outHeight
            while (width / 2 >= MAX_DIMENSION || height / 2 >= MAX_DIMENSION) {
                sampleSize *= 2
                width /= 2
                height /= 2
            }

            val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
            val bitmap = resolver.openInputStream(imageUri)?.use {
                BitmapFactory.decodeStream(it, null, decodeOptions)
            } ?: return@withContext null

            val scaled = scaleDown(bitmap, MAX_DIMENSION)
            val output = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, output)
            val bytes = output.toByteArray()
            if (scaled !== bitmap) bitmap.recycle()

            val lat = prefs.getString(SdkPreferences.Keys.FARMER_APP_LATITUDE, "").toDoubleOrNull()
            val lng = prefs.getString(SdkPreferences.Keys.FARMER_APP_LONGITUDE, "").toDoubleOrNull()

            ImageResult(
                base64Image = Base64.encodeToString(bytes, Base64.NO_WRAP),
                latitude = lat,
                longitude = lng,
                sizeKb = bytes.size / 1024
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to prepare image", e)
            null
        }
    }

    private fun scaleDown(bitmap: Bitmap, maxDimension: Int): Bitmap {
        val maxSide = maxOf(bitmap.width, bitmap.height)
        if (maxSide <= maxDimension) return bitmap
        val ratio = maxDimension.toFloat() / maxSide
        return Bitmap.createScaledBitmap(
            bitmap,
            (bitmap.width * ratio).toInt().coerceAtLeast(1),
            (bitmap.height * ratio).toInt().coerceAtLeast(1),
            true
        )
    }
}
