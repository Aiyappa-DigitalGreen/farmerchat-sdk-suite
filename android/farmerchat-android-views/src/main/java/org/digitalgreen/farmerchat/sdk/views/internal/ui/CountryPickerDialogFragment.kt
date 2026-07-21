package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
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

/** Full-screen country picker (search + radio list + Save), per docs 01 §3.4. */
internal class CountryPickerDialogFragment(
    private val countries: List<CountryItem>,
    initialSelection: CountryItem?,
    private val onSave: (CountryItem) -> Unit
) : DialogFragment() {

    // Zero-arg constructor for framework recreation; picker simply dismisses.
    @Suppress("unused")
    constructor() : this(emptyList(), null, {})

    private var selection: CountryItem? = initialSelection
    private var filtered: List<CountryItem> = countries

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
        val binding = FcDialogCountryPickerBinding.bind(view)
        val labels = FarmerChat.requireGraph().labelManager

        binding.fcCountryPickerTitle.text =
            labels.getLabel(Labels.SELECT_COUNTRY_CODE, "Select country code")
        binding.fcCountrySearch.hint = labels.getLabel(Labels.SEARCH, "Search")
        binding.fcCountrySaveButton.text =
            labels.getLabel(Labels.SAVE_SELECTION, "Save selection")

        val adapter = CountryAdapter()
        binding.fcCountryList.layoutManager = LinearLayoutManager(requireContext())
        binding.fcCountryList.adapter = adapter

        binding.fcCountrySearch.doAfterTextChanged { editable ->
            val query = editable?.toString().orEmpty().trim()
            filtered = if (query.isBlank()) countries else countries.filter {
                it.name.contains(query, ignoreCase = true) ||
                    it.display_name.contains(query, ignoreCase = true) ||
                    it.phone_country_code.contains(query)
            }
            adapter.notifyDataSetChanged()
        }

        binding.fcCountryPickerClose.setOnClickListener { dismissAllowingStateLoss() }
        binding.fcCountrySaveButton.setOnClickListener {
            selection?.let(onSave)
            dismissAllowingStateLoss()
        }
    }

    private inner class CountryAdapter : RecyclerView.Adapter<CountryAdapter.Holder>() {

        inner class Holder(val binding: FcItemCountryRowBinding) :
            RecyclerView.ViewHolder(binding.root)

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
            Holder(
                FcItemCountryRowBinding.inflate(
                    LayoutInflater.from(parent.context), parent, false
                )
            )

        override fun getItemCount(): Int = filtered.size

        override fun onBindViewHolder(holder: Holder, position: Int) {
            val country = filtered[position]
            holder.binding.fcCountryName.text =
                "${country.display_name.ifBlank { country.name }} (${country.phone_country_code})"
            holder.binding.fcCountryRadio.isChecked = country.id == selection?.id
            holder.binding.root.setOnClickListener {
                selection = country
                notifyDataSetChanged()
            }
        }
    }
}
