package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.digitalgreen.farmerchat.sdk.core.model.TextPromptRequest

/**
 * The agentic (#27a) request for a photo question. This is a port of the app's
 * `fetchPlantixResponse` agentic branch (fc-compose-agentic `ChatViewModel.kt:1863-1879`): the
 * same eight fields, `triggered_input_type = "image"`, and no location or parent fields. The
 * #28 `PlantixRequest` carries latitude and longitude; the agentic one does not.
 */
internal fun buildAgenticImageRequest(
    conversationId: String,
    query: String,
    base64Image: String,
    imageName: String,
    retry: Boolean,
    streamingRequired: Boolean
): TextPromptRequest = TextPromptRequest(
    conversation_id = conversationId,
    query = query,
    message_id = "",
    triggered_input_type = "image",
    use_entity_extraction = true,
    retry = retry,
    image = base64Image,
    image_name = imageName,
    streaming_required = streamingRequired
)
