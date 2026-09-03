package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.animation.ArgbEvaluator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.FrameLayout
import androidx.annotation.ColorInt
import androidx.annotation.ColorRes
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.core.view.updateLayoutParams
import coil.load
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcViewInputComposerBinding
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcRecolor
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens

/**
 * Unified input composer (2.0.0) — the Views port of Compose `components/InputComposer.kt`.
 *
 * ONE bar — camera / text field / mic-or-send — replacing v1's separate text-input overlay plus
 * Photo/Speak/Type button row. Home seats it floating (horizontal margins, 24dp corners, above
 * the nav bar); Chat seats it anchored and [compact].
 *
 * Every geometry constant below is lifted verbatim from InputComposer.kt so both flavours
 * measure the same. The pieces deliberately NOT ported are recorded in docs/04:
 *  - the idle gradient "aura" flowing around the field (Home-only, decorative);
 *  - the full-screen scrim / tap-to-dismiss branch, which never runs because both Compose call
 *    sites pass `isAnchored = true`;
 *  - the scroll-to-bottom pill, which Views already renders from ChatFragment.
 */
internal class InputComposerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : FrameLayout(context, attrs) {

    private companion object {
        // ---- Compose geometry (InputComposer.kt). Standard / compact pairs. ----
        /** Padding above the button row, inside the composer sheet. */
        const val TOP_INSIDE = 12f
        const val TOP_INSIDE_COMPACT = 10f

        /** Height of the circular button row (camera / text field / mic-or-send). */
        const val BUTTON_ROW = 48f
        const val BUTTON_ROW_COMPACT = 42f

        /** Icon size inside the action buttons. */
        const val ACTION_ICON = 22f
        const val ACTION_ICON_COMPACT = 20f

        /** Padding below the button row when the IME is closed. */
        const val AT_REST_GAP = 12f
        const val AT_REST_GAP_COMPACT = 8f

        /** Padding below the button row when the IME is open. */
        const val KEYBOARD_GAP = 12f
        const val KEYBOARD_GAP_COMPACT = 10f

        /** Floating: gap between the sheet bottom and the screen bottom, at rest. */
        const val FLOATING_BOTTOM_GAP = 20f

        /** Floating: gap between the sheet bottom and the IME when focused. */
        const val FLOATING_KEYBOARD_GAP = 4f

        /** Max field height (Compose heightIn(min = 24, max = 72) + maxLines = 3). */
        const val FIELD_MAX_HEIGHT = 72f

        /** Compose `animateDpAsState(tween(250))` for the compact/standard transition. */
        const val SIZE_ANIM_MS = 250L

        /** Compose `animateColorAsState(tween(220))` for the field + placeholder colors. */
        const val COLOR_ANIM_MS = 220L

        /** Compose `animateDpAsState(tween(300))` for the show/hide slide. */
        const val SLIDE_ANIM_MS = 300L

        /** Compose slides the bar 400dp off-screen when `visible = false`. */
        const val HIDDEN_OFFSET = 400f

        /** Rotating-placeholder dwell and crossfade (Compose delay(3000) + fade 400). */
        const val PLACEHOLDER_ROTATE_MS = 3000L
        const val PLACEHOLDER_FADE_MS = 400L
    }

    private val binding: FcViewInputComposerBinding =
        FcViewInputComposerBinding.inflate(LayoutInflater.from(context), this)

    // ------------------------------------------------------------------ host hooks

    var onSend: (String) -> Unit = {}
    var onPhotoClick: () -> Unit = {}
    var onVoiceClick: () -> Unit = {}
    var onFocusChange: (Boolean) -> Unit = {}
    var onRemovePhoto: (Int) -> Unit = {}

    /** Called whenever the at-rest bar height changes, so the host can reserve list padding. */
    var onBarHeightChanged: (Int) -> Unit = {}

    // ------------------------------------------------------------------ configuration

    /** Compose `compact`: shrinks the row and paddings, but only while the field is focused. */
    var compact: Boolean = false
        set(value) {
            field = value
            applySizes(animate = false)
        }

    private var placeholder: String = ""
    private var placeholders: List<String> = emptyList()
    private var photoUris: List<Uri> = emptyList()

    // ------------------------------------------------------------------ state

    private var isFocused = false
    private var imeBottom = 0
    private var navBottom = 0
    private var placeholderIndex = 0
    private var barHeightPx = 0
    private var hiddenBySlide = false

    private val handler = Handler(Looper.getMainLooper())
    private val rotateRunnable = object : Runnable {
        override fun run() {
            val list = placeholders
            if (list.size < 2 || isFocused) return
            placeholderIndex = (placeholderIndex + 1) % list.size
            crossfadePlaceholder(list[placeholderIndex])
            handler.postDelayed(this, PLACEHOLDER_ROTATE_MS)
        }
    }

    private var sizeAnimator: ValueAnimator? = null
    private var fieldColorAnimator: ValueAnimator? = null
    private var hintColorAnimator: ValueAnimator? = null

    /** 0 = standard metrics, 1 = compact metrics. Animated so the bar resizes in place. */
    private var compactFraction = 0f

    /** Which of the two stacked placeholder views is currently showing. */
    private var hintShowingA = true

    private val imm: InputMethodManager?
        get() = context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager

    // ------------------------------------------------------------------ init

    init {
        // The sheet is opaque and consumes its own taps; the wrapper band must not let list
        // content show through the 10dp gutters (Compose's floating wrapper background).
        binding.fcComposerSheet.setOnClickListener { /* consume */ }

        binding.fcComposerCamera.setOnClickListener {
            clearFocusAndHideKeyboard()
            onPhotoClick()
        }

        binding.fcComposerAction.setOnClickListener {
            if (hasContent()) {
                val text = binding.fcComposerInput.text?.toString().orEmpty()
                clearFocusAndHideKeyboard()
                binding.fcComposerInput.setText("")
                onSend(text)
            } else {
                clearFocusAndHideKeyboard()
                onVoiceClick()
            }
        }

        binding.fcComposerThumbRemove.setOnClickListener { onRemovePhoto(0) }

        // Compose lets a tap anywhere on the field column request focus.
        binding.fcComposerField.setOnClickListener { requestInputFocus() }

        binding.fcComposerInput.setOnFocusChangeListener { _, focused ->
            if (isFocused == focused) return@setOnFocusChangeListener
            isFocused = focused
            applySizes(animate = true)
            applyFieldColors(animate = true)
            applyPlaceholderRotation()
            applyInsetSeating()
            onFocusChange(focused)
        }

        binding.fcComposerInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) = Unit
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) = Unit
            override fun afterTextChanged(s: Editable?) {
                applyContentState()
                applyFieldColors(animate = true)
            }
        })

        // Compose: keyboard "Done" only dismisses; it never sends.
        binding.fcComposerInput.setOnEditorActionListener { _, _, _ ->
            clearFocusAndHideKeyboard()
            true
        }

        binding.fcComposerInput.maxHeight = FIELD_MAX_HEIGHT.dpPx()

        applyImeInsets()
        applySizes(animate = false)
        applyFieldColors(animate = false)
        applyContentState()
        // Programmatic tints/fills below the inflater factory's reach (see FcTokens KDoc).
        FcRecolor.maybeRecolor(binding.fcComposerCamera)
        FcRecolor.maybeRecolor(binding.fcComposerAction)
    }

    override fun onDetachedFromWindow() {
        handler.removeCallbacks(rotateRunnable)
        sizeAnimator?.cancel()
        fieldColorAnimator?.cancel()
        hintColorAnimator?.cancel()
        super.onDetachedFromWindow()
    }

    // ------------------------------------------------------------------ public API

    /**
     * The composer sheet color (Compose `surfaceColor`). Both call sites pass the brand
     * surface, so this stays a resource rather than a raw int and keeps host theming.
     */
    fun setSurfaceColorRes(@ColorRes res: Int) {
        (binding.fcComposerSheet.background as? GradientDrawable)?.let { bg ->
            val d = bg.mutate() as GradientDrawable
            d.setColor(FcTokens.color(context, res))
            binding.fcComposerSheet.background = FcRecolor.active()
                ?.let { FcRecolor.recolorDrawable(d, it) } ?: d
        }
    }

    /**
     * The color the surrounding band resolves to (Compose `fadeColor`) — the parent screen's
     * surface, so the band that hides scrolling content reads as part of the screen.
     */
    fun setFadeColorRes(@ColorRes res: Int) {
        binding.fcComposerFade.setBackgroundColor(FcTokens.color(context, res))
    }

    /** Single placeholder (Compose `placeholder`). */
    fun setPlaceholder(text: String) {
        placeholder = text
        placeholders = emptyList()
        placeholderIndex = 0
        currentHint().setShimmerText(text)
        applyPlaceholderRotation()
    }

    /**
     * Rotating placeholders (Compose `placeholders`): crossfaded every ~3s while the field is
     * unfocused. A list shorter than 2 behaves exactly like [setPlaceholder].
     */
    fun setPlaceholders(texts: List<String>) {
        placeholders = texts.filter { it.isNotBlank() }
        placeholderIndex = 0
        placeholders.firstOrNull()?.let {
            placeholder = it
            currentHint().setShimmerText(it)
        }
        applyPlaceholderRotation()
    }

    /**
     * Attached image URIs. Compose allows a SINGLE image per query and renders only the first,
     * so anything past index 0 is ignored here too.
     */
    fun setPhotoUris(uris: List<Uri>) {
        photoUris = uris
        val first = uris.firstOrNull()
        binding.fcComposerThumbBox.isVisible = first != null
        if (first != null) binding.fcComposerThumb.load(first)
        applyContentState()
        applyFieldColors(animate = true)
    }

    /** Compose `visible`: slides the bar off-screen (used while an answer is generating). */
    fun setBarVisible(visible: Boolean) {
        if (hiddenBySlide == !visible) return
        hiddenBySlide = !visible
        if (!visible) clearFocusAndHideKeyboard()
        animate().cancel()
        animate()
            .translationY(if (visible) 0f else HIDDEN_OFFSET.dpPx().toFloat())
            .setDuration(SLIDE_ANIM_MS)
            .start()
    }

    fun requestInputFocus() {
        binding.fcComposerInput.requestFocus()
        imm?.showSoftInput(binding.fcComposerInput, InputMethodManager.SHOW_IMPLICIT)
    }

    fun setText(text: String) {
        binding.fcComposerInput.setText(text)
        binding.fcComposerInput.setSelection(text.length)
    }

    fun clearText() {
        binding.fcComposerInput.setText("")
        clearFocusAndHideKeyboard()
    }

    /** At-rest bar height in px — what a host list must reserve as bottom padding. */
    fun barHeightPx(): Int = barHeightPx

    // ------------------------------------------------------------------ internals

    private fun hasContent(): Boolean =
        binding.fcComposerInput.text?.toString()?.isNotBlank() == true || photoUris.isNotEmpty()

    private fun clearFocusAndHideKeyboard() {
        binding.fcComposerInput.clearFocus()
        imm?.hideSoftInputFromWindow(binding.fcComposerInput.windowToken, 0)
    }

    /**
     * Compose: the camera hides once an image is attached or text is being typed, and the mic
     * flips to send as soon as there is any content.
     */
    private fun applyContentState() {
        val content = hasContent()
        binding.fcComposerCamera.isVisible =
            photoUris.isEmpty() && binding.fcComposerInput.text.isNullOrBlank()
        binding.fcComposerAction.setImageResource(
            if (content) R.drawable.fc_icon_send else R.drawable.fc_icon_mic
        )
        FcRecolor.maybeRecolor(binding.fcComposerAction)
        val showHint = binding.fcComposerInput.text.isNullOrEmpty()
        binding.fcComposerHintA.isVisible = showHint && hintShowingA
        binding.fcComposerHintB.isVisible = showHint && !hintShowingA
    }

    /**
     * Compose: the field is "active" when focused OR carrying content — active sits on
     * surfaceReadingTertiary with the neutral form-placeholder grey, idle on surfaceSecondary
     * with foregroundPrimary at full strength so the prompt reads as an invitation.
     */
    private fun applyFieldColors(animate: Boolean) {
        val active = isFocused || hasContent()
        val fieldTarget = FcTokens.color(
            context,
            if (active) R.color.fc_surface_reading_tertiary else R.color.fc_surface_secondary
        )
        val hintTarget = FcTokens.color(
            context,
            if (active) R.color.fc_form_placeholder else R.color.fc_foreground_primary
        )

        val fieldBg = (binding.fcComposerField.background as? GradientDrawable)
            ?.let { it.mutate() as GradientDrawable }
        val fieldFrom = fieldBg?.color?.defaultColor ?: fieldTarget
        val hintFrom = binding.fcComposerHintA.baseColor

        fieldColorAnimator?.cancel()
        hintColorAnimator?.cancel()

        if (!animate) {
            fieldBg?.let { it.setColor(fieldTarget); binding.fcComposerField.background = it }
            setHintBaseColor(hintTarget)
            return
        }

        if (fieldBg != null && fieldFrom != fieldTarget) {
            fieldColorAnimator = ValueAnimator.ofObject(ArgbEvaluator(), fieldFrom, fieldTarget)
                .apply {
                    duration = COLOR_ANIM_MS
                    addUpdateListener {
                        fieldBg.setColor(it.animatedValue as Int)
                        binding.fcComposerField.background = fieldBg
                    }
                    start()
                }
        }
        if (hintFrom != hintTarget) {
            hintColorAnimator = ValueAnimator.ofObject(ArgbEvaluator(), hintFrom, hintTarget)
                .apply {
                    duration = COLOR_ANIM_MS
                    addUpdateListener { setHintBaseColor(it.animatedValue as Int) }
                    start()
                }
        }
    }

    private fun setHintBaseColor(@ColorInt color: Int) {
        binding.fcComposerHintA.baseColor = color
        binding.fcComposerHintB.baseColor = color
    }

    private fun currentHint(): ShimmerTextView =
        if (hintShowingA) binding.fcComposerHintA else binding.fcComposerHintB

    /**
     * Compose gates the shimmer on `enabled = !isFocused` and pauses the rotation while the
     * field is focused; both resume when focus is lost.
     */
    private fun applyPlaceholderRotation() {
        binding.fcComposerHintA.shimmerEnabled = !isFocused
        binding.fcComposerHintB.shimmerEnabled = !isFocused
        handler.removeCallbacks(rotateRunnable)
        if (placeholders.size >= 2 && !isFocused) {
            handler.postDelayed(rotateRunnable, PLACEHOLDER_ROTATE_MS)
        }
    }

    /** Two stacked views fading in opposite directions = Compose's simultaneous crossfade. */
    private fun crossfadePlaceholder(text: String) {
        val outgoing = currentHint()
        val incoming = if (hintShowingA) binding.fcComposerHintB else binding.fcComposerHintA
        hintShowingA = !hintShowingA
        incoming.setShimmerText(text)
        incoming.alpha = 0f
        incoming.isVisible = binding.fcComposerInput.text.isNullOrEmpty()
        incoming.animate().alpha(1f).setDuration(PLACEHOLDER_FADE_MS).start()
        outgoing.animate().alpha(0f).setDuration(PLACEHOLDER_FADE_MS).start()
    }

    /**
     * The compact/standard metrics transition. Compose animates each dimension independently
     * with the same 250ms tween, so one driving fraction reproduces it exactly.
     */
    private fun applySizes(animate: Boolean) {
        // Compose: `effectivelyCompact = compact && isFocused` — Chat's bar is standard at rest
        // and only shrinks once the farmer starts typing.
        val target = if (compact && isFocused) 1f else 0f
        sizeAnimator?.cancel()
        if (!animate || compactFraction == target) {
            compactFraction = target
            layoutForFraction(target)
            return
        }
        sizeAnimator = ValueAnimator.ofFloat(compactFraction, target).apply {
            duration = SIZE_ANIM_MS
            addUpdateListener {
                compactFraction = it.animatedValue as Float
                layoutForFraction(compactFraction)
            }
            start()
        }
    }

    private fun layoutForFraction(f: Float) {
        val buttonRow = lerp(BUTTON_ROW, BUTTON_ROW_COMPACT, f).dpPx()
        val actionIcon = lerp(ACTION_ICON, ACTION_ICON_COMPACT, f).dpPx()
        val topInside = lerp(TOP_INSIDE, TOP_INSIDE_COMPACT, f).dpPx()

        listOf(binding.fcComposerCamera, binding.fcComposerAction).forEach { button ->
            button.updateLayoutParams<ViewGroup.LayoutParams> {
                width = buttonRow
                height = buttonRow
            }
            // Compose sizes the glyph inside a fixed circle; padding is the Views equivalent.
            val pad = ((buttonRow - actionIcon) / 2).coerceAtLeast(0)
            button.setPadding(pad, pad, pad, pad)
        }
        binding.fcComposerField.minimumHeight = buttonRow
        binding.fcComposerSheet.setPadding(
            binding.fcComposerSheet.paddingLeft,
            topInside,
            binding.fcComposerSheet.paddingRight,
            binding.fcComposerSheet.paddingBottom
        )
        applyInsetSeating()
    }

    /**
     * IME-aware seating. Compose's floating composer consumes
     * `WindowInsets.navigationBars.union(WindowInsets.ime)` on the wrapper and then adds the
     * REMAINDER up to the design gap, so the total is max(navInset, 20dp) rather than their sum.
     *
     * The Views reading of those insets is [applyImeInsets]; this applies them.
     */
    private fun applyInsetSeating() {
        val f = compactFraction
        val keyboardOpen = imeBottom > 0
        val outerBottom = if (keyboardOpen) {
            imeBottom + FLOATING_KEYBOARD_GAP.dpPx()
        } else {
            maxOf(navBottom, FLOATING_BOTTOM_GAP.dpPx())
        }
        binding.fcComposerFade.setPadding(0, 0, 0, outerBottom)

        val innerBottom = if (keyboardOpen) {
            lerp(KEYBOARD_GAP, KEYBOARD_GAP_COMPACT, f).dpPx()
        } else {
            lerp(AT_REST_GAP, AT_REST_GAP_COMPACT, f).dpPx()
        }
        binding.fcComposerSheet.setPadding(
            binding.fcComposerSheet.paddingLeft,
            binding.fcComposerSheet.paddingTop,
            binding.fcComposerSheet.paddingRight,
            innerBottom
        )

        // Compose `composerBarHeight(floating = true)`: hosts reserve list space at the
        // STANDARD size, so layout stays stable as the bar shrinks within the reservation.
        val height = TOP_INSIDE.dpPx() + BUTTON_ROW.dpPx() + AT_REST_GAP.dpPx() +
            maxOf(navBottom, FLOATING_BOTTOM_GAP.dpPx())
        if (height != barHeightPx) {
            barHeightPx = height
            onBarHeightChanged(height)
        }
    }

    /**
     * Reads the ROOT window insets rather than the dispatched ones.
     *
     * Both host layouts put this composer next to a `fitsSystemWindows="true"` LinearLayout, and
     * a sibling that consumes the insets first would leave this callback seeing 0 — the same
     * mechanism (and reason) as InputOverlaysController.applyImeInsets(), which must not regress.
     */
    private fun applyImeInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(this) { view, insets ->
            val source = ViewCompat.getRootWindowInsets(view) ?: insets
            imeBottom = source.getInsets(WindowInsetsCompat.Type.ime()).bottom
            navBottom = source.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom
            // Compose `LaunchedEffect(isKeyboardVisible)`: a keyboard dismissed by the back
            // gesture must also drop focus, or the compact size and the active placeholder
            // color stay stuck in the typing state.
            if (imeBottom == 0 && isFocused) clearFocusAndHideKeyboard()
            applyInsetSeating()
            insets
        }
        ViewCompat.requestApplyInsets(this)
    }

    private fun lerp(from: Float, to: Float, f: Float): Float = from + (to - from) * f

    private fun Float.dpPx(): Int =
        (this * context.resources.displayMetrics.density).toInt()
}
