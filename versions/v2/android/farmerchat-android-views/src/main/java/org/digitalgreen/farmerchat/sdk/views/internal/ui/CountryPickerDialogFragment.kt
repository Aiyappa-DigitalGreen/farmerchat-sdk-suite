package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import androidx.core.content.getSystemService
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.DialogFragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.CountryItem
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcDialogCountryPickerBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemCountryRowBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemCountrySearchBinding
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcRecolor
import org.digitalgreen.farmerchat.sdk.views.internal.util.applySystemBarBackdrop
import org.digitalgreen.farmerchat.sdk.views.internal.util.loadSvgOrImage

/**
 * Full-screen country picker, per app `AuthScreen.kt` `CountryPickerScreen` (docs 01 §3.4):
 * green close bar, search field as the first list item, flagged radio rows, Save in a fixed
 * bottom area. Selection is local until Save, exactly like the app's `rememberSaveable`.
 */
internal class CountryPickerDialogFragment(
    private val countries: List<CountryItem>,
    initialSelection: CountryItem?,
    private val onSave: (CountryItem) -> Unit
) : DialogFragment() {

    // Zero-arg constructor for framework recreation; picker simply dismisses.
    @Suppress("unused")
    constructor() : this(emptyList(), null, {})

    private var selectedId: Int? = initialSelection?.id
    private var query: String = ""
    private var filtered: List<CountryItem> = countries
    private var binding: FcDialogCountryPickerBinding? = null

    override fun getTheme(): Int = R.style.Theme_FarmerChatSdk

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = FcDialogCountryPickerBinding.inflate(inflater, container, false).root

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        if (countries.isEmpty()) {
            dismissAllowingStateLoss()
            return
        }
        val b = FcDialogCountryPickerBinding.bind(view).also { binding = it }
        val labels = FarmerChat.requireGraph().labelManager
        b.root.applySystemBarBackdrop(bottomRes = R.color.fc_surface_secondary)

        b.fcCountryPickerAppBar.fcAppBarTitle.text =
            labels.getLabel(Labels.SELECT_COUNTRY_CODE, "Select country code")
        b.fcCountryPickerAppBar.fcAppBarLeft.setImageResource(R.drawable.fc_ic_close)
        b.fcCountryPickerAppBar.fcAppBarLeft.setBackgroundResource(R.drawable.fc_bg_appbar_chip_round)
        // Set after inflation, so the inflater recolor never saw it.
        FcRecolor.maybeRecolor(b.fcCountryPickerAppBar.fcAppBarLeft)
        b.fcCountryPickerAppBar.fcAppBarLeft.setOnClickListener { dismissAllowingStateLoss() }

        b.fcCountrySaveButton.text = labels.getLabel(Labels.SAVE_SELECTION, "Save selection")
        b.fcCountrySaveButton.setButtonEnabled(selectedId != null)
        b.fcCountrySaveButton.setOnClickListener {
            countries.firstOrNull { it.id == selectedId }?.let(onSave)
            dismissAllowingStateLoss()
        }

        b.fcCountryList.layoutManager = LinearLayoutManager(requireContext())
        b.fcCountryList.adapter = CountryAdapter(labels.getLabel(Labels.SEARCH, "Search"))
    }

    override fun onDestroyView() {
        binding = null
        super.onDestroyView()
    }

    /** App filter: prefix match on `name` or `display_name`, case-insensitive. */
    private fun applyFilter(raw: String) {
        query = raw
        val q = raw.trim()
        filtered = if (q.isEmpty()) countries else countries.filter {
            it.name.startsWith(q, ignoreCase = true) || it.display_name.startsWith(q, ignoreCase = true)
        }
    }

    private fun hideKeyboard(view: View) {
        view.context.getSystemService<InputMethodManager>()
            ?.hideSoftInputFromWindow(view.windowToken, 0)
    }

    private inner class CountryAdapter(private val searchHint: String) :
        RecyclerView.Adapter<RecyclerView.ViewHolder>() {

        private inner class SearchHolder(val b: FcItemCountrySearchBinding) : RecyclerView.ViewHolder(b.root)
        private inner class RowHolder(val b: FcItemCountryRowBinding) : RecyclerView.ViewHolder(b.root)

        override fun getItemViewType(position: Int): Int = if (position == 0) TYPE_SEARCH else TYPE_ROW

        override fun getItemCount(): Int = filtered.size + 1

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
            val inflater = LayoutInflater.from(parent.context)
            return if (viewType == TYPE_SEARCH) {
                SearchHolder(FcItemCountrySearchBinding.inflate(inflater, parent, false)).also { h ->
                    h.b.fcCountrySearch.hint = searchHint
                    h.b.fcCountrySearch.setText(query)
                    h.b.fcCountrySearch.doAfterTextChanged { e ->
                        val before = filtered
                        applyFilter(e?.toString().orEmpty())
                        if (before != filtered) {
                            // Rebind rows only — rebinding the search item would steal focus.
                            notifyItemRangeRemoved(1, before.size)
                            notifyItemRangeInserted(1, filtered.size)
                        }
                    }
                }
            } else {
                RowHolder(FcItemCountryRowBinding.inflate(inflater, parent, false))
            }
        }

        override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
            if (holder !is RowHolder) return
            val country = filtered[position - 1]
            val selected = country.id == selectedId
            val row = holder.b
            // App label is `"${c.name} (${c.phone_country_code})"` — `name`, not display_name.
            row.fcCountryName.text = "${country.name} (${country.phone_country_code})"
            row.fcCountryRadio.setImageResource(
                if (selected) R.drawable.fc_radio_dot_selected
                else R.drawable.fc_radio_dot_unselected_on_primary
            )
            row.fcCountryRowRoot.setBackgroundResource(
                if (selected) R.drawable.fc_bg_radio_row_selected else R.drawable.fc_bg_radio_row
            )
            FcRecolor.maybeRecolor(row.fcCountryRowRoot)
            FcRecolor.maybeRecolor(row.fcCountryRadio)

            val flagUrl = country.flag
            row.fcCountryFlag.isVisible = !flagUrl.isNullOrBlank()
            row.fcCountryFlagEmoji.isVisible = flagUrl.isNullOrBlank() && country.code.isNotBlank()
            if (!flagUrl.isNullOrBlank()) {
                row.fcCountryFlag.setImageDrawable(null)
                row.fcCountryFlag.loadSvgOrImage(flagUrl)
            } else {
                row.fcCountryFlagEmoji.text = isoToFlagEmoji(country.code)
            }

            row.root.setOnClickListener { v ->
                hideKeyboard(v)
                val previous = filtered.indexOfFirst { it.id == selectedId }
                selectedId = country.id
                if (previous >= 0) notifyItemChanged(previous + 1)
                notifyItemChanged(holder.bindingAdapterPosition)
                binding?.fcCountrySaveButton?.setButtonEnabled(true)
            }
        }
    }

    private companion object {
        const val TYPE_SEARCH = 0
        const val TYPE_ROW = 1

        /** App fallback when the API sends no flag URL (RadioButton.kt `isoToFlagEmoji`). */
        fun isoToFlagEmoji(iso: String): String {
            val code = iso.trim().uppercase()
            if (code.length != 2) return "🇮🇳"
            val first = code[0] - 'A' + 0x1F1E6
            val second = code[1] - 'A' + 0x1F1E6
            return String(Character.toChars(first)) + String(Character.toChars(second))
        }
    }
}
