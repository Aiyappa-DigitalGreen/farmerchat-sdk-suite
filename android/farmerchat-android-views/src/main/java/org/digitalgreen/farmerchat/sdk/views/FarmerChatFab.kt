package org.digitalgreen.farmerchat.sdk.views

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.util.AttributeSet
import com.google.android.material.floatingactionbutton.FloatingActionButton
import org.digitalgreen.farmerchat.sdk.FarmerChat

/**
 * Drop-in floating action button that opens FarmerChat from XML layouts:
 *
 * ```xml
 * <org.digitalgreen.farmerchat.sdk.views.FarmerChatFab
 *     android:layout_width="wrap_content"
 *     android:layout_height="wrap_content"
 *     android:layout_gravity="bottom|end"
 *     android:layout_margin="16dp" />
 * ```
 *
 * No wiring needed beyond [FarmerChat.initialize] at app startup. Set [question]
 * to deep-link straight into a chat asking it; otherwise the full journey launches.
 * Assign your own OnClickListener to override the default behavior entirely.
 */
class FarmerChatFab @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FloatingActionButton(context, attrs, defStyleAttr) {

    /** Optional question to open chat with instead of launching the full journey. */
    var question: String? = null

    init {
        setImageResource(R.drawable.fc_logo_mark)
        contentDescription = "FarmerChat"
        // Material's constructor always seeds a theme tint, so "not set" can't be
        // detected via backgroundTintList — honor only an explicit XML backgroundTint.
        val hasExplicitTint = attrs != null &&
            (0 until attrs.attributeCount).any { attrs.getAttributeName(it) == "backgroundTint" }
        if (!hasExplicitTint) {
            backgroundTintList =
                ColorStateList.valueOf(context.getColor(R.color.fc_green700))
        }
        imageTintList = ColorStateList.valueOf(Color.WHITE)
        setOnClickListener {
            val q = question
            if (q != null) FarmerChat.openChat(context, question = q)
            else FarmerChat.launch(context)
        }
    }
}
