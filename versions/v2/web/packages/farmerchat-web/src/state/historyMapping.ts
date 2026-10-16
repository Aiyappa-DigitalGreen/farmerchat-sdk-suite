/**
 * History mapping (#32 `conversation_chat_history`) — message_type_id: 1=query_text,
 * 2=query_audio, 3=response_text, 7=follow_up_questions, 11=input_image (docs/02).
 *
 * Port of the app's `ChatViewModel.mapConversationChatHistoryToChatHistoryMessages`
 * (fc-compose-agentic `ui/chat/ChatViewModel.kt:1254-1316`). Kept React-free so the
 * framework-less Node test runner can exercise it (`test/historyMapping.test.ts`).
 */

import type { ConversationChatHistoryMessageItem } from '../core/types';
import type { ChatMessage } from './useChat';

export interface MappedHistoryPage {
  messages: ChatMessage[];
  /**
   * The newest turn's follow-ups — the chips under the last answer. Question strings only: the
   * app keeps no `follow_up_question_id` from history (ChatViewModel.kt:1296-1300), so a chip
   * tapped in a reopened conversation sends no #30.
   */
  trailingQuestions: string[] | null;
  clarification: boolean;
}

/** Keeps the first occurrence of each message id — a duplicate key breaks list identity. */
export function dedupeById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

/**
 * App `sortedWith(compareBy(nullsLast(naturalOrder())) { it.message_input_time })`: oldest turn
 * first, items without a time last, ties kept in server order (both sorts are stable). DEMO
 * returns a page NEWEST turn first (verified 2026-10-16), so without this the thread renders
 * upside down and the trailing follow-up chips belong to the OLDEST answer.
 *
 * The times are ISO-8601 UTC strings of one fixed shape, so string order is time order — the
 * same `naturalOrder()` comparison the app makes on the raw string.
 */
export function sortHistoryItems(items: readonly ConversationChatHistoryMessageItem[]): ConversationChatHistoryMessageItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ta = a.item.message_input_time ?? null;
      const tb = b.item.message_input_time ?? null;
      if (ta === tb) return a.index - b.index;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return ta < tb ? -1 : ta > tb ? 1 : a.index - b.index;
    })
    .map((x) => x.item);
}

// A query and its response SHARE one `message_id` (verified live 2026-09-01: a single turn returns
// type 1, 3 and 7 all carrying the same id). Using it as the React key collides two rows — app
// parity (fc-compose ChatViewModel.kt:1027) keys on message_id + message_type_id + page + index.
// `messageId` keeps the raw API id for TTS/follow-ups.
export function mapHistoryItems(rawItems: readonly ConversationChatHistoryMessageItem[], page = 1): MappedHistoryPage {
  const items = sortHistoryItems(rawItems);
  const messages: ChatMessage[] = [];
  let trailingQuestions: string[] | null = null;
  let clarification = false;

  for (const [index, item] of items.entries()) {
    const typeId = item.message_type_id ?? typeIdFromName(item.message_type);
    // page + index already make the id unique, so an id-less item needs no random part (and this
    // module stays free of `./helpers`, which the Node test runner cannot load).
    const uiId = `${item.message_id ?? 'hist'}_${typeId ?? 'x'}_${page}_${index}`;
    switch (typeId) {
      case 1:
        messages.push({
          kind: 'user',
          id: uiId,
          text: item.query_text ?? '',
          isFailed: false,
        });
        trailingQuestions = null;
        break;
      case 2:
        messages.push({
          kind: 'user',
          id: uiId,
          // App ChatViewModel.kt:1273: `query_text ?: heard_query_text ?: ""` — the stored query
          // first, the raw transcription only when there is none (null, not blank, falls through).
          text: item.query_text ?? item.heard_query_text ?? '',
          audioUri: item.query_media_file_url ?? undefined,
          isFailed: false,
        });
        trailingQuestions = null;
        break;
      case 11:
        messages.push({
          kind: 'user',
          id: uiId,
          text: item.query_text ?? '',
          imageUri: item.query_media_file_url ?? undefined,
          userBubbleImageWideBanner: true,
          isFailed: false,
        });
        trailingQuestions = null;
        break;
      case 3:
        messages.push({
          kind: 'ai',
          id: uiId,
          text: item.response_text ?? '',
          isPreGenerated: false,
          messageId: item.message_id ?? undefined,
          hideTtsSpeaker: item.hide_tts_speaker ?? false,
          actualContentProvider: item.actual_content_provider ?? null,
          clarificationRequired: item.clarification_required ?? false,
        });
        if (item.clarification_required) clarification = true;
        trailingQuestions = null;
        break;
      case 7: {
        // The server sends type-7 questions as objects `{ follow_up_question_id, sequence,
        // question }` (a plain string form is tolerated). App parity, ChatViewModel.kt:1296-1300:
        // only `it.question` is kept, in server order; `follow_up_question_id` is dropped even
        // though #32 carries it (verified on DEMO 2026-10-16).
        const questions = (item.questions ?? [])
          .map((q) => (typeof q === 'string' ? q : (q?.question ?? '')))
          .filter((q): q is string => q.length > 0);
        // Attach to the previous AI response; keep as trailing suggestions too.
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i]!;
          if (m.kind === 'ai') {
            messages[i] = { ...m, followUpQuestions: questions };
            break;
          }
        }
        trailingQuestions = questions.length > 0 ? questions : null;
        if (item.clarification_required) clarification = true;
        break;
      }
      default:
        // Unknown message types are skipped, matching the app's tolerant parsing.
        break;
    }
  }
  return { messages, trailingQuestions, clarification };
}

function typeIdFromName(name: string | null | undefined): number {
  switch (name) {
    case 'query_text':
      return 1;
    case 'query_audio':
      return 2;
    case 'response_text':
      return 3;
    case 'follow_up_questions':
      return 7;
    case 'input_image':
      return 11;
    default:
      return 0;
  }
}
