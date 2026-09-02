package org.digitalgreen.farmerchat.sdk.views.internal.drawer

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import org.digitalgreen.farmerchat.sdk.core.ui.history.DrawerQuestion
import org.digitalgreen.farmerchat.sdk.core.ui.history.DrawerQuestionType
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemDrawerQuestionBinding

/** Recent-8 questions in the drawer, icon by DrawerQuestionType. */
internal class DrawerQuestionAdapter(
    private val onClick: (DrawerQuestion) -> Unit
) : RecyclerView.Adapter<DrawerQuestionAdapter.Holder>() {

    private val items = mutableListOf<DrawerQuestion>()

    fun submit(questions: List<DrawerQuestion>) {
        items.clear()
        items.addAll(questions)
        notifyDataSetChanged()
    }

    internal class Holder(val binding: FcItemDrawerQuestionBinding) :
        RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
        Holder(
            FcItemDrawerQuestionBinding.inflate(
                LayoutInflater.from(parent.context), parent, false
            )
        )

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val item = items[position]
        holder.binding.fcDrawerQuestionTitle.text = item.title
        holder.binding.fcDrawerQuestionIcon.setImageResource(
            when (item.type) {
                DrawerQuestionType.Camera -> R.drawable.fc_icon_camera
                DrawerQuestionType.Mic -> R.drawable.fc_icon_mic
                DrawerQuestionType.Card -> R.drawable.fc_icon_card
                DrawerQuestionType.Keyboard -> R.drawable.fc_icon_keyboard
            }
        )
        holder.binding.root.setOnClickListener { onClick(item) }
    }
}
