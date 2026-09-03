package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.recyclerview.widget.RecyclerView
import org.digitalgreen.farmerchat.sdk.core.ui.settings.LanguageDisplayOrder
import org.digitalgreen.farmerchat.sdk.core.model.SupportedLanguage
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemLanguageExpanderBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemLanguageHeaderBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemLanguageRowBinding

/**
 * Language radio list shared by onboarding Language and Settings → Language:
 * optional header, priority rows, "All languages" expander, expanded rows.
 * Per-row progress while that row's labels are being fetched.
 */
internal class LanguageListAdapter(
    private val showHeader: Boolean,
    private val onSelect: (SupportedLanguage) -> Unit
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    private companion object {
        const val TYPE_HEADER = 0
        const val TYPE_ROW = 1
        const val TYPE_EXPANDER = 2
    }

    private sealed interface Item {
        data object Header : Item
        data class Row(val language: SupportedLanguage) : Item
        data object Expander : Item
    }

    var headerTitle: String = ""
    var headerSubtitle: String = ""
    var expanderLabel: String = ""

    private var priority: List<SupportedLanguage> = emptyList()
    private var expanded: List<SupportedLanguage> = emptyList()
    private var isExpanded = false
    private var selectedId: Int? = null
    private var fetchingForId: Int? = null

    private var items: List<Item> = emptyList()

    fun submit(
        priorityLanguages: List<SupportedLanguage>,
        expandedLanguages: List<SupportedLanguage>,
        selectedLanguageId: Int?,
        fetchingLabelsForId: Int?
    ) {
        priority = priorityLanguages
        expanded = expandedLanguages
        selectedId = selectedLanguageId
        fetchingForId = fetchingLabelsForId
        rebuild()
    }

    private fun rebuild() {
        // App parity (LanguageScreen.kt / LanguageChooserScreen.kt `displayedLanguages`):
        // while collapsed, a selection that lives only in the "All languages" list is
        // pinned to the top of the priority rows rather than force-expanding the list.
        val rows = LanguageDisplayOrder.rowsToShow(
            priority = priority,
            expanded = expanded,
            selectedId = selectedId,
            isExpanded = isExpanded
        )
        items = buildList {
            if (showHeader) add(Item.Header)
            rows.forEach { add(Item.Row(it)) }
            if (expanded.isNotEmpty()) {
                if (isExpanded) {
                    expanded.forEach { add(Item.Row(it)) }
                } else {
                    add(Item.Expander)
                }
            }
        }
        notifyDataSetChanged()
    }

    override fun getItemCount(): Int = items.size

    override fun getItemViewType(position: Int): Int = when (items[position]) {
        is Item.Header -> TYPE_HEADER
        is Item.Row -> TYPE_ROW
        is Item.Expander -> TYPE_EXPANDER
    }

    private class HeaderHolder(val binding: FcItemLanguageHeaderBinding) :
        RecyclerView.ViewHolder(binding.root)

    private class RowHolder(val binding: FcItemLanguageRowBinding) :
        RecyclerView.ViewHolder(binding.root)

    private class ExpanderHolder(val binding: FcItemLanguageExpanderBinding) :
        RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            TYPE_HEADER -> HeaderHolder(FcItemLanguageHeaderBinding.inflate(inflater, parent, false))
            TYPE_ROW -> RowHolder(FcItemLanguageRowBinding.inflate(inflater, parent, false))
            else -> ExpanderHolder(FcItemLanguageExpanderBinding.inflate(inflater, parent, false))
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val item = items[position]) {
            is Item.Header -> {
                val h = holder as HeaderHolder
                h.binding.fcLanguageTitle.text = headerTitle
                h.binding.fcLanguageSubtitle.text = headerSubtitle
            }
            is Item.Row -> {
                val h = holder as RowHolder
                val language = item.language
                val selected = language.id == selectedId
                h.binding.fcLangName.text =
                    language.displayName.ifBlank { language.name }
                h.binding.fcLangRadio.setImageResource(
                    if (selected) R.drawable.fc_radio_dot_selected
                    else R.drawable.fc_radio_dot_unselected
                )
                h.binding.fcLangRowRoot.setBackgroundResource(
                    if (selected) R.drawable.fc_bg_radio_row_selected
                    else R.drawable.fc_bg_radio_row
                )
                // Host-theme recolor of the runtime-set selection accent (drawables
                // swapped in code are not seen by the inflation factory).
                org.digitalgreen.farmerchat.sdk.views.internal.theme.FcRecolor
                    .maybeRecolor(h.binding.fcLangRadio)
                org.digitalgreen.farmerchat.sdk.views.internal.theme.FcRecolor
                    .maybeRecolor(h.binding.fcLangRowRoot)
                h.binding.fcLangProgress.isVisible = language.id == fetchingForId
                h.binding.root.setOnClickListener { onSelect(language) }
            }
            is Item.Expander -> {
                val h = holder as ExpanderHolder
                h.binding.fcLangExpander.text = expanderLabel
                h.binding.root.setOnClickListener {
                    isExpanded = true
                    rebuild()
                }
            }
        }
    }
}
