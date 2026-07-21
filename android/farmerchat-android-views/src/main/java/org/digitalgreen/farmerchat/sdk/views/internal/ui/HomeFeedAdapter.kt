package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.recyclerview.widget.RecyclerView
import coil.load
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

    fun submit(sections: List<SectionDto>, ssfrEnabled: Boolean, dismissedIds: Set<String>) {
        items = buildList {
            if (ssfrEnabled) add(Item.Ssfr)
            add(Item.Header)
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
                (holder as FooterHolder).binding.fcFeedFooterText.text =
                    callbacks.labelFor(
                        org.digitalgreen.farmerchat.sdk.core.labels.Labels.HAVE_A_GREAT_DAY_COME_BACK_TOMORROW,
                        "Have a great day,\ncome back tomorrow"
                    )
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
        b.fcCardImage.isVisible = hasImage
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
            b.fcCardImage.load(section.image_url)
        }

        val headline = section.title?.takeIf { it.isNotBlank() }
            ?: section.question_text.orEmpty()
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
                    androidx.core.content.ContextCompat.getColor(
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
