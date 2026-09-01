package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.ConversationListItem
import org.digitalgreen.farmerchat.sdk.core.ui.history.ChatHistoryViewModel
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentChatHistoryBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemHistoryFooterBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemHistoryHeaderBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemHistoryRowBinding
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.activityCoreVm
import org.digitalgreen.farmerchat.sdk.views.internal.journeyHost
import org.digitalgreen.farmerchat.sdk.FarmerChat

/** Chat history — grouped, paginated conversation list (doc 01 §3.9). */
internal class ChatHistoryFragment : BaseFragment(R.layout.fc_fragment_chat_history) {

    override val analyticsScreenName: String = AnalyticsScreens.CHAT_HISTORY

    // Shared drawer-wide instance (app parity).
    private val vm: ChatHistoryViewModel by lazy {
        activityCoreVm("chat_history") { graph.chatHistoryViewModel() }
    }

    private lateinit var binding: FcFragmentChatHistoryBinding
    private lateinit var adapter: HistoryAdapter
    private var hadItems = false
    private var navigatedToError = false

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentChatHistoryBinding.bind(view)

        binding.fcHistoryAppBar.fcAppBarTitle.text = label(Labels.RECENT_CHATS, "Recent Chats")
        // With the drawer off (CHAT_ONLY) openDrawer() is a no-op and the user would be
        // stranded on this screen — fall back to a plain back navigation.
        binding.fcHistoryAppBar.fcAppBarLeft.setOnClickListener {
            if (FarmerChat.requireGraph().config.showDrawer) {
                journeyHost()?.openDrawer()
            } else if (!findNavController().popBackStack()) {
                NavRoutes.navigateHomeOrChat(findNavController())
            }
        }
        if (!FarmerChat.requireGraph().config.showDrawer) {
            binding.fcHistoryAppBar.fcAppBarLeft.setImageResource(R.drawable.fc_ic_back)
        }
        binding.fcHistoryRetry.text = label(Labels.TRY_AGAIN, "Try again")
        binding.fcHistoryRetry.setOnClickListener { vm.refresh() }
        binding.fcHistoryLoading.text = label(Labels.LOADING_CHATS, "Loading chats...")

        adapter = HistoryAdapter()
        val layoutManager = LinearLayoutManager(requireContext())
        binding.fcHistoryList.layoutManager = layoutManager
        binding.fcHistoryList.adapter = adapter
        binding.fcHistoryList.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                if (dy <= 0) return
                val state = vm.state.value
                if (state.canLoadMore && !state.isLoading &&
                    layoutManager.findLastVisibleItemPosition() >= adapter.itemCount - 3
                ) {
                    vm.loadNextPage()
                }
            }
        })

        vm.refresh()

        vm.state.collectWhenStarted { state ->
            if (state.items.isNotEmpty()) hadItems = true

            binding.fcHistoryLoading.isVisible = state.isLoading && state.items.isEmpty()
            binding.fcHistoryList.isVisible = state.items.isNotEmpty()

            val paginationError = state.errorMessage != null && hadItems
            // Inline retry once the user already bounced off the error screen.
            binding.fcHistoryErrorBox.isVisible =
                state.errorMessage != null && !hadItems && navigatedToError
            binding.fcHistoryErrorText.text = state.errorMessage.orEmpty()
            // Initial-load failure → error screen navigation (doc 01 §3.9).
            if (state.errorMessage != null && !hadItems && !navigatedToError) {
                navigatedToError = true
                findNavController().navigate(
                    R.id.fc_dest_error,
                    NavRoutes.errorArgs(state.isNetworkError, "chathistory"),
                    NavRoutes.singleTop()
                )
                return@collectWhenStarted
            }

            adapter.submit(
                items = state.items,
                showLoadingFooter = state.isLoading && state.items.isNotEmpty(),
                showRetryFooter = paginationError
            )
        }
    }

    private fun openChat(conversationId: String) {
        graph.analytics.track(AnalyticsEvents.NEW_CHAT_CLICK_EVENT)
        findNavController().navigate(
            R.id.fc_dest_chat,
            NavRoutes.chatArgs(source = "history", conversationId = conversationId)
        )
    }

    // ------------------------------------------------------------------ adapter

    private sealed interface Row {
        data class Header(val title: String) : Row
        data class Item(val item: ConversationListItem) : Row
        data class Footer(val retry: Boolean) : Row
    }

    private inner class HistoryAdapter : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

        private var rows: List<Row> = emptyList()

        fun submit(
            items: List<ConversationListItem>,
            showLoadingFooter: Boolean,
            showRetryFooter: Boolean
        ) {
            rows = buildList {
                var lastGroup: String? = null
                items.forEach { item ->
                    val group = item.grouping.orEmpty()
                    if (group.isNotBlank() && group != lastGroup) {
                        lastGroup = group
                        add(Row.Header(group))
                    }
                    add(Row.Item(item))
                }
                if (showLoadingFooter) add(Row.Footer(retry = false))
                if (showRetryFooter) add(Row.Footer(retry = true))
            }
            notifyDataSetChanged()
        }

        override fun getItemCount(): Int = rows.size

        override fun getItemViewType(position: Int): Int = when (rows[position]) {
            is Row.Header -> 0
            is Row.Item -> 1
            is Row.Footer -> 2
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
            val inflater = LayoutInflater.from(parent.context)
            return when (viewType) {
                0 -> object : RecyclerView.ViewHolder(
                    FcItemHistoryHeaderBinding.inflate(inflater, parent, false).root
                ) {}
                1 -> object : RecyclerView.ViewHolder(
                    FcItemHistoryRowBinding.inflate(inflater, parent, false).root
                ) {}
                else -> object : RecyclerView.ViewHolder(
                    FcItemHistoryFooterBinding.inflate(inflater, parent, false).root
                ) {}
            }
        }

        override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
            when (val row = rows[position]) {
                is Row.Header -> {
                    FcItemHistoryHeaderBinding.bind(holder.itemView).fcHistoryHeaderText.text =
                        row.title
                }
                is Row.Item -> {
                    val binding = FcItemHistoryRowBinding.bind(holder.itemView)
                    binding.fcHistoryRowTitle.text = row.item.conversation_title.orEmpty()
                    binding.fcHistoryRowIcon.setImageResource(
                        when (row.item.message_type?.lowercase()) {
                            "image", "input_image", "camera" -> R.drawable.fc_icon_camera
                            "voice", "audio", "query_audio", "mic" -> R.drawable.fc_icon_mic
                            "card", "statement", "pre_generated" -> R.drawable.fc_icon_card
                            else -> R.drawable.fc_icon_keyboard
                        }
                    )
                    binding.root.setOnClickListener { openChat(row.item.conversation_id) }
                }
                is Row.Footer -> {
                    val binding = FcItemHistoryFooterBinding.bind(holder.itemView)
                    binding.fcHistoryFooterProgress.isVisible = !row.retry
                    binding.fcHistoryFooterText.text = if (row.retry) {
                        label(Labels.COULDNT_LOAD_MORE_CHATS, "Couldn't load more chats")
                    } else {
                        label(Labels.LOADING_MORE, "Loading more...")
                    }
                    binding.fcHistoryFooterRetry.isVisible = row.retry
                    binding.fcHistoryFooterRetry.text = label(Labels.TRY_AGAIN, "Try again")
                    binding.fcHistoryFooterRetry.setOnClickListener { vm.loadNextPage() }
                }
            }
        }
    }
}
