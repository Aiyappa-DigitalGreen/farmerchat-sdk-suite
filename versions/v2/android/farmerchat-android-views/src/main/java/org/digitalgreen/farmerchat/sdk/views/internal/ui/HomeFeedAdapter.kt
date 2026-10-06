package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.recyclerview.widget.RecyclerView
import coil.load
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.AiImageOverlayView
import org.digitalgreen.farmerchat.sdk.core.model.OptionDto
import org.digitalgreen.farmerchat.sdk.core.model.SectionDto
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemHomeContentCardBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemHomeFeedHeaderBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemHomeFooterBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemHomeSelectCardBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemHomeSsfrBinding
import org.digitalgreen.farmerchat.sdk.views.internal.util.dp
import org.digitalgreen.farmerchat.sdk.views.R

/**
 * Home feed: [SSFR card?] + feed header + content/single-select/multi-select
 * cards (+dismiss) + footer. plotline_widget sections are omitted (doc 03).
 */
internal class HomeFeedAdapter(
    private val callbacks: Callbacks
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    internal interface Callbacks {
        fun onContentCardClick(section: SectionDto)
        fun onSingleSelect(section: SectionDto, option: OptionDto)
        fun onMultiSelectConfirm(section: SectionDto, optionIds: List<String>)
        fun onDismiss(section: SectionDto)
        fun onSsfrWheat()
        fun onSsfrMaize()
        fun labelFor(key: String, fallback: String): String
    }

    internal sealed interface Item {
        data object Ssfr : Item
        data object Header : Item
        data class Card(val section: SectionDto) : Item
        data object Footer : Item
    }

    private companion object {
        const val TYPE_SSFR = 0
        const val TYPE_HEADER = 1
        const val TYPE_CONTENT = 2
        const val TYPE_SELECT = 3
        const val TYPE_FOOTER = 4
    }

    private var items: List<Item> = emptyList()
    private val multiSelections = mutableMapOf<String, MutableSet<String>>()

    /**
     * @param showHeader false in composer (agentic) mode. Compose parity
     *   (`HomeScreen.kt:926`, `if (!isComposerUi) { item("feedHeader") … }`): in composer mode the
     *   header above the feed ALREADY shows `FOR_YOUR_FARM_TODAY`, so emitting the in-feed header
     *   too printed the same served string twice, stacked — observed on emulator-5554 as
     *   "ರೈತರು ಹೆಚ್ಚು ಏನು ಕೇಳುತ್ತಿದ್ದಾರೆ ಎಂದು ತಿಳಿಯಿರಿ" rendered large and then again small.
     *   Compose has always guarded this; views did not.
     */
    fun submit(
        sections: List<SectionDto>,
        ssfrEnabled: Boolean,
        dismissedIds: Set<String>,
        showHeader: Boolean = true
    ) {
        items = buildList {
            if (ssfrEnabled) add(Item.Ssfr)
            if (showHeader) add(Item.Header)
            sections
                .filter { it.type != "plotline_widget" }
                .filterNot { dismissedIds.contains(it.stableId()) }
                .forEach { add(Item.Card(it)) }
            add(Item.Footer)
        }
        notifyDataSetChanged()
    }

    /** Section at an adapter position (visibility tracking for mark-viewed). */
    fun sectionAt(position: Int): SectionDto? =
        (items.getOrNull(position) as? Item.Card)?.section

    override fun getItemCount(): Int = items.size

    override fun getItemViewType(position: Int): Int = when (val item = items[position]) {
        is Item.Ssfr -> TYPE_SSFR
        is Item.Header -> TYPE_HEADER
        is Item.Card ->
            if (item.section.type == "question" && item.section.options != null) TYPE_SELECT
            else TYPE_CONTENT
        is Item.Footer -> TYPE_FOOTER
    }

    private class SsfrHolder(val binding: FcItemHomeSsfrBinding) : RecyclerView.ViewHolder(binding.root)
    private class HeaderHolder(val binding: FcItemHomeFeedHeaderBinding) : RecyclerView.ViewHolder(binding.root)
    private class ContentHolder(val binding: FcItemHomeContentCardBinding) : RecyclerView.ViewHolder(binding.root)
    private class SelectHolder(val binding: FcItemHomeSelectCardBinding) : RecyclerView.ViewHolder(binding.root)
    private class FooterHolder(val binding: FcItemHomeFooterBinding) : RecyclerView.ViewHolder(binding.root)

    /**
     * App FeedFooter.kt: once the footer is on screen the text fades in over 900ms and the hand
     * waves three times (+16 / -12 degrees, pivot at its base, after a 200ms delay), then settles.
     * A RecyclerView item is bound as it scrolls into view, which is the app's visibility trigger.
     */
    private fun animateFooter(fb: FcItemHomeFooterBinding) {
        val wave = fb.fcFeedFooterWave
        val text = fb.fcFeedFooterText
        wave.animate().cancel(); text.animate().cancel()
        wave.alpha = 0f; text.alpha = 0f; wave.rotation = 0f
        wave.post { wave.pivotX = wave.width / 2f; wave.pivotY = wave.height.toFloat() }
        wave.animate().alpha(1f).setDuration(900).start()
        text.animate().alpha(1f).setDuration(900).start()
        val ease = androidx.interpolator.view.animation.FastOutSlowInInterpolator()
        val steps = listOf(16f to 160L, -12f to 180L, 16f to 160L, -12f to 180L, 16f to 160L, -12f to 180L, 0f to 160L)
        val rotate = android.animation.AnimatorSet().apply {
            playSequentially(steps.map { (deg, ms) ->
                android.animation.ObjectAnimator.ofFloat(wave, android.view.View.ROTATION, deg).apply {
                    duration = ms; interpolator = ease
                }
            })
            startDelay = 200
        }
        rotate.start()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            TYPE_SSFR -> SsfrHolder(FcItemHomeSsfrBinding.inflate(inflater, parent, false))
            TYPE_HEADER -> HeaderHolder(FcItemHomeFeedHeaderBinding.inflate(inflater, parent, false))
            TYPE_CONTENT -> ContentHolder(FcItemHomeContentCardBinding.inflate(inflater, parent, false))
            TYPE_SELECT -> SelectHolder(FcItemHomeSelectCardBinding.inflate(inflater, parent, false))
            else -> FooterHolder(FcItemHomeFooterBinding.inflate(inflater, parent, false))
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val item = items[position]) {
            is Item.Ssfr -> bindSsfr(holder as SsfrHolder)
            is Item.Header -> {
                (holder as HeaderHolder).binding.fcFeedHeaderTitle.text =
                    callbacks.labelFor(
                        org.digitalgreen.farmerchat.sdk.core.labels.Labels.FOR_YOUR_FARM_TODAY,
                        "For your farm today"
                    )
            }
            is Item.Card -> when (holder) {
                is ContentHolder -> bindContent(holder, item.section)
                is SelectHolder -> bindSelect(holder, item.section)
            }
            is Item.Footer -> {
                val fb = (holder as FooterHolder).binding
                fb.fcFeedFooterText.text =
                    callbacks.labelFor(
                        org.digitalgreen.farmerchat.sdk.core.labels.Labels.HAVE_A_GREAT_DAY_COME_BACK_TOMORROW,
                        "Have a great day,\ncome back tomorrow"
                    )
                animateFooter(fb)
            }
        }
    }

    private fun bindSsfr(holder: SsfrHolder) {
        val b = holder.binding
        b.fcSsfrTitle.text = callbacks.labelFor(
            org.digitalgreen.farmerchat.sdk.core.labels.Labels.SSFR_ADVISORY, "SSFR Advisory"
        )
        b.fcSsfrSubtitle.text = callbacks.labelFor(
            org.digitalgreen.farmerchat.sdk.core.labels.Labels.SSFR_ADVISORY_DESCRIPTION,
            "Access site specific fertilizer recommendations"
        )
        b.fcSsfrWheatLabel.text = callbacks.labelFor(
            org.digitalgreen.farmerchat.sdk.core.labels.Labels.SSFR_WHEAT, "Wheat"
        )
        b.fcSsfrMaizeLabel.text = callbacks.labelFor(
            org.digitalgreen.farmerchat.sdk.core.labels.Labels.SSFR_MAIZE, "Maize"
        )
        b.fcSsfrWheat.setOnClickListener { callbacks.onSsfrWheat() }
        b.fcSsfrMaize.setOnClickListener { callbacks.onSsfrMaize() }
    }

    private fun bindContent(holder: ContentHolder, section: SectionDto) {
        val b = holder.binding
        val hasImage = section.type == "image" && !section.image_url.isNullOrBlank()
        b.fcCardImageFrame.isVisible = hasImage
        if (hasImage) {
            // 16:9 image inset by 8dp inside the card (Compose ContentCard parity).
            b.fcCardImage.post {
                val width = b.fcCardImage.width
                if (width > 0) {
                    val target = width * 9 / 16
                    if (b.fcCardImage.layoutParams.height != target) {
                        b.fcCardImage.layoutParams = b.fcCardImage.layoutParams.apply {
                            height = target
                        }
                    }
                }
            }
            // App parity (components/cards/ContentCard.kt): loading and error draw two
            // DIFFERENT placeholder animations, driven off the Coil request state.
            val overlay = b.fcCardImageOverlay
            b.fcCardImage.load(section.image_url) {
                listener(
                    onStart = { overlay.setMode(AiImageOverlayView.Mode.LOADING) },
                    onSuccess = { _, _ -> overlay.setMode(AiImageOverlayView.Mode.HIDDEN) },
                    onError = { _, _ -> overlay.setMode(AiImageOverlayView.Mode.ERROR) },
                    onCancel = { overlay.setMode(AiImageOverlayView.Mode.HIDDEN) }
                )
            }
        } else {
            b.fcCardImageOverlay.setMode(AiImageOverlayView.Mode.HIDDEN)
        }

        // App ContentCard: an image card carries the view-count badge; a text-only card may open
        // with the personalisation tag (meta.asset_name). Title top spacing follows from which
        // header is present: image -> 8 + 4dp, tag -> 10 + 4dp, neither -> 18 + 4dp.
        val viewCount = section.badge?.takeIf { it.show == true }?.count
        b.fcCardViewBadge.isVisible = hasImage && viewCount != null
        b.fcCardViewCount.text = viewCount.orEmpty()
        // App parity (HomeScreen.kt:1337-1355): Home never passes `personalizationLabel`, so the
        // app shows NO tag even when `meta.asset_name` is set. Kept as a null so the spacing rule
        // below still reads the same as the app's ContentCard.
        val tag: String? = null
        b.fcCardPersonalization.isVisible = tag != null
        b.fcCardPersonalizationLabel.text = tag.orEmpty()
        val density = b.root.resources.displayMetrics.density
        b.fcCardTitle.setPadding(
            b.fcCardTitle.paddingLeft,
            ((when { hasImage -> 12; tag != null -> 14; else -> 22 }) * density).toInt(),
            b.fcCardTitle.paddingRight,
            0
        )

        // App HomeScreen.kt ContentCard(headline = section.question_text ?: section.title): the
        // QUESTION wins. Views preferred `title`, so the goat card read "Goat (Meat) - Colostrum
        // Management" where the app reads "Why \"Pehla Doodh\" is a MUST for Strong Goat Kids!".
        val headline = section.question_text ?: section.title.orEmpty()
        b.fcCardTitle.isVisible = headline.isNotBlank()
        b.fcCardTitle.text = headline
        b.fcCardCta.text = callbacks.labelFor(
            org.digitalgreen.farmerchat.sdk.core.labels.Labels.START_CHAT, "Start chat"
        )
        b.fcCardCta.state = org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView.State.CHEVRON
        b.root.setOnClickListener { callbacks.onContentCardClick(section) }
        b.fcCardCta.setOnClickListener { callbacks.onContentCardClick(section) }
    }

    private val singleSelections = mutableMapOf<String, String>()

    private fun bindSelect(holder: SelectHolder, section: SectionDto) {
        val b = holder.binding
        val context = b.root.context
        val isMulti = section.selection_type == "multiple"
        b.fcSelectStatement.text = section.statement ?: section.title.orEmpty()
        b.fcSelectDismiss.setOnClickListener { callbacks.onDismiss(section) }
        b.fcSelectOptions.removeAllViews()

        val sectionKey = section.stableId()
        val multiSelected = multiSelections.getOrPut(sectionKey) { mutableSetOf() }

        fun optionId(option: OptionDto): String? = option.id ?: option.text

        fun refreshConfirm() {
            val hasSelection =
                if (isMulti) multiSelected.isNotEmpty() else singleSelections.containsKey(sectionKey)
            b.fcSelectConfirm.isVisible = hasSelection
        }

        section.options.orEmpty().forEach { option ->
            val row = android.widget.LinearLayout(context).apply {
                orientation = android.widget.LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
                val padH = 16.dp(context)
                val padV = if (isMulti) 12.dp(context) else 14.dp(context)
                setPadding(padH, padV, padH, padV)
            }
            val dot = android.widget.ImageView(context)
            val text = android.widget.TextView(context).apply {
                textSize = if (isMulti) 15f else 17f
                setTextColor(
                    org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens.color(
                        context, R.color.fc_foreground_primary
                    )
                )
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
                this.text = option.text
            }

            fun render() {
                val id = optionId(option)
                val selected =
                    if (isMulti) multiSelected.contains(id)
                    else singleSelections[sectionKey] == id
                if (isMulti) {
                    row.setBackgroundResource(
                        if (selected) R.drawable.fc_bg_checkbox_selected
                        else R.drawable.fc_bg_option_row
                    )
                } else {
                    row.setBackgroundResource(
                        if (selected) R.drawable.fc_bg_radio_row_selected
                        else R.drawable.fc_bg_option_row
                    )
                    dot.setImageResource(
                        if (selected) R.drawable.fc_radio_dot_selected
                        else R.drawable.fc_radio_dot_unselected
                    )
                }
            }

            if (!isMulti) {
                row.addView(
                    dot,
                    android.widget.LinearLayout.LayoutParams(20.dp(context), 20.dp(context))
                )
                text.setPadding(12.dp(context), 0, 0, 0)
            }
            row.addView(
                text,
                android.widget.LinearLayout.LayoutParams(
                    0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f
                )
            )

            row.setOnClickListener {
                val id = optionId(option) ?: return@setOnClickListener
                if (isMulti) {
                    if (!multiSelected.remove(id)) multiSelected.add(id)
                } else {
                    if (singleSelections[sectionKey] == id) {
                        singleSelections.remove(sectionKey)
                    } else {
                        singleSelections[sectionKey] = id
                    }
                }
                refreshConfirm()
                // Re-render all rows in this card.
                notifyItemChanged(holder.bindingAdapterPosition)
            }

            render()
            val params = android.view.ViewGroup.MarginLayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 6.dp(context) }
            b.fcSelectOptions.addView(row, params)
        }

        b.fcSelectConfirm.text = callbacks.labelFor(
            org.digitalgreen.farmerchat.sdk.core.labels.Labels.CONFIRM, "Confirm"
        )
        b.fcSelectConfirm.setSquareCorners()
        refreshConfirm()
        b.fcSelectConfirm.setOnClickListener {
            if (isMulti) {
                callbacks.onMultiSelectConfirm(section, multiSelected.toList())
            } else {
                val id = singleSelections[sectionKey] ?: return@setOnClickListener
                val option = section.options.orEmpty().firstOrNull {
                    (it.id ?: it.text) == id
                } ?: return@setOnClickListener
                callbacks.onSingleSelect(section, option)
            }
        }
    }
}
