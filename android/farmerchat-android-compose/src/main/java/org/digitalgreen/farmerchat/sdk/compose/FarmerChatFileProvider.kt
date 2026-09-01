package org.digitalgreen.farmerchat.sdk.compose

import androidx.core.content.FileProvider

/**
 * The SDK's own [FileProvider] subclass (camera capture + share/download).
 *
 * It exists purely so the SDK's `<provider>` manifest node has a class name of
 * its own. The manifest merger keys provider nodes by `android:name`, so a
 * library declaring `androidx.core.content.FileProvider` directly collides with
 * every host app that also uses a FileProvider ("Attribute
 * provider#androidx.core.content.FileProvider@authorities ... is also present").
 * The authority string (`${applicationId}.fc_sdk_fileprovider`) and the
 * `fc_sdk_file_paths` resource are unchanged.
 */
class FarmerChatFileProvider : FileProvider()
