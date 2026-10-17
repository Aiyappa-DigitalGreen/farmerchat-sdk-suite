/**
 * Drawer analytics, exactly as the app's DrawerContent.kt sends them.
 * - Menu rows → `Menu_Option_Click_Event { option }` with "Home" | "Language" | "Settings" |
 *   "Help_Support" | "Signup" (trackMenuOptionClick, :119-130).
 * - "Recent chats" header and "See all" → `Chat_History_Click_Event { screen_name: "Menu" }`
 *   (trackChatHistoryClickFromMenu, :132-143).
 * - A recent question → `Chat_History_Click { screen_name: "Side Menu", conversation_id,
 *   question_index }` (:367-378; the index is sent as a string).
 */
export type DrawerMenuOption = 'Home' | 'Language' | 'Settings' | 'Help_Support' | 'Signup';

export function menuOptionProps(option: DrawerMenuOption): { option: DrawerMenuOption } {
  return { option };
}

export function chatHistoryFromMenuProps(): { screen_name: string } {
  return { screen_name: 'Menu' };
}

export function drawerQuestionClickProps(
  conversationId: string | null | undefined,
  index: number,
): { screen_name: string; conversation_id: string; question_index: string } {
  return { screen_name: 'Side Menu', conversation_id: conversationId ?? '', question_index: String(index) };
}
