package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.content.Context
import android.text.InputFilter
import android.text.InputType
import android.util.AttributeSet
import android.view.Gravity
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.widget.doAfterTextChanged
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.util.dp

/**
 * 4-box OTP input: a single hidden EditText captures input (works with SMS
 * autofill/paste) rendered as 4 boxes (port of the app's OtpInput).
 */
internal class OtpView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : FrameLayout(context, attrs) {

    companion object {
        const val LENGTH = 4
    }

    private val boxes = mutableListOf<TextView>()
    private val hiddenInput = EditText(context).apply {
        inputType = InputType.TYPE_CLASS_NUMBER
        filters = arrayOf(InputFilter.LengthFilter(LENGTH))
        alpha = 0f
        isCursorVisible = false
        background = null
        importantForAutofill = IMPORTANT_FOR_AUTOFILL_YES
    }

    var onOtpChanged: ((String) -> Unit)? = null

    val otp: String get() = hiddenInput.text?.toString().orEmpty()

    init {
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        repeat(LENGTH) { index ->
            val box = TextView(context).apply {
                gravity = Gravity.CENTER
                textSize = 22f
                setTextColor(ContextCompat.getColor(context, R.color.fc_foreground_primary))
                background = ContextCompat.getDrawable(context, R.drawable.fc_bg_otp_box)
            }
            boxes += box
            row.addView(box, LinearLayout.LayoutParams(56.dp(context), 56.dp(context)).apply {
                if (index > 0) marginStart = 10.dp(context)
            })
        }
        addView(row, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        addView(hiddenInput, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        hiddenInput.doAfterTextChanged {
            render()
            onOtpChanged?.invoke(otp)
        }
        setOnClickListener { focusInput() }
        render()
    }

    fun setOtp(value: String) {
        val digits = value.filter { it.isDigit() }.take(LENGTH)
        if (digits != otp) {
            hiddenInput.setText(digits)
            hiddenInput.setSelection(digits.length)
        }
    }

    fun focusInput() {
        hiddenInput.requestFocus()
        val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.showSoftInput(hiddenInput, InputMethodManager.SHOW_IMPLICIT)
    }

    private fun render() {
        val value = otp
        boxes.forEachIndexed { index, box ->
            box.text = value.getOrNull(index)?.toString() ?: ""
            val active = index == value.length.coerceAtMost(LENGTH - 1) && value.length < LENGTH ||
                (value.length == LENGTH && index == LENGTH - 1)
            box.background = ContextCompat.getDrawable(
                context,
                if (active) R.drawable.fc_bg_otp_box_active else R.drawable.fc_bg_otp_box
            )
        }
    }
}
