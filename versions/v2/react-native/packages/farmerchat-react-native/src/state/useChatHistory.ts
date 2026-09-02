/**
 * useChatHistory — port of `ChatHistoryViewModel` (docs/01 §3.9):
 * grouped + paginated conversation list (endpoint #22 dual format),
 * drawer recent-8 questions, silent refresh.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnalyticsEvents } from '../core/analytics';
import type { FarmerChatSdk } from '../core/sdk';
import {
  normalizeConversationList,
  type ConversationListItem,
} from '../core/types';

export type DrawerQuestionType = 'camera' | 'mic' | 'keyboard' | 'card';

export interface DrawerQuestion {
  conversationId: string;
  question: string;
  type: DrawerQuestionType;
}

export interface ChatHistoryUiState {
  items: ConversationListItem[];
  isLoading: boolean;
  errorMessage: string | null;
  isNetworkError: boolean;
  canLoadMore: boolean;
  query: string;
}

const initialHistoryState: ChatHistoryUiState = {
  items: [],
  isLoading: false,
  errorMessage: null,
  isNetworkError: false,
  canLoadMore: false,
  query: '',
};

export function drawerTypeFromMessageType(
  messageType: string | null | undefined,
): DrawerQuestionType {
  switch ((messageType ?? '').toLowerCase()) {
    case 'query_audio':
    case 'audio':
    case 'voice':
      return 'mic';
    case 'input_image':
    case 'image':
    case 'camera':
      return 'camera';
    case 'card':
    case 'statement':
      return 'card';
    default:
      return 'keyboard';
  }
}

export interface GroupedHistorySection {
  title: string;
  data: ConversationListItem[];
}

export interface UseChatHistoryResult {
  state: ChatHistoryUiState;
  refresh: () => void;
  refreshSilently: () => void;
  loadNextPage: () => void;
  setQuery: (query: string) => void;
  filteredItems: () => ConversationListItem[];
  groupedSections: () => GroupedHistorySection[];
  /** Recent 8 questions for the drawer (docs/01 §4). */
  recentQuestions: () => DrawerQuestion[];
  trackItemOpened: (conversationId: string) => void;
}

export function useChatHistory(sdk: FarmerChatSdk): UseChatHistoryResult {
  const [state, setState] = useState<ChatHistoryUiState>(initialHistoryState);
  const mounted = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pageRef = useRef(1);
  const nextPageRef = useRef<number | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (page: number, options: { silent?: boolean; append?: boolean }) => {
      const userId = sdk.session.userId;
      if (!userId || inFlight.current) return;
      inFlight.current = true;
      if (!options.silent) {
        setState((prev) => ({ ...prev, isLoading: true, errorMessage: null }));
      }
      const result = await sdk.api.getConversationList(userId, page);
      inFlight.current = false;
      if (!mounted.current) return;
      if (result.ok) {
        const normalized = normalizeConversationList(result.data, page);
        pageRef.current = page;
        nextPageRef.current = normalized.nextPage;
        setState((prev) => ({
          ...prev,
          items: options.append
            ? dedupeById([...prev.items, ...normalized.items])
            : normalized.items,
          isLoading: false,
          errorMessage: null,
          isNetworkError: false,
          canLoadMore: normalized.nextPage !== null,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          errorMessage:
            result.message ??
            sdk.labels.getLabel('history_error', 'Could not load your chats.'),
          isNetworkError: result.isNetworkError || result.isTimeout,
        }));
      }
    },
    [sdk],
  );

  const refresh = useCallback(() => {
    void load(1, { append: false });
  }, [load]);

  const refreshSilently = useCallback(() => {
    void load(1, { silent: true, append: false });
  }, [load]);

  const loadNextPage = useCallback(() => {
    const next = nextPageRef.current;
    if (next === null || stateRef.current.isLoading) return;
    void load(next, { append: true });
  }, [load]);

  const setQuery = useCallback((query: string) => {
    setState((prev) => ({ ...prev, query }));
  }, []);

  const filteredItems = useCallback((): ConversationListItem[] => {
    const s = stateRef.current;
    const q = s.query.trim().toLowerCase();
    if (q.length === 0) return s.items;
    return s.items.filter((item) =>
      (item.conversation_title ?? '').toLowerCase().includes(q),
    );
  }, []);

  const groupedSections = useCallback((): GroupedHistorySection[] => {
    const sections: GroupedHistorySection[] = [];
    const byGroup = new Map<string, ConversationListItem[]>();
    for (const item of filteredItems()) {
      const group = item.grouping ?? '';
      const bucket = byGroup.get(group);
      if (bucket) {
        bucket.push(item);
      } else {
        byGroup.set(group, [item]);
        sections.push({ title: group, data: byGroup.get(group)! });
      }
    }
    return sections;
  }, [filteredItems]);

  const recentQuestions = useCallback((): DrawerQuestion[] => {
    return stateRef.current.items.slice(0, 8).map((item) => ({
      conversationId: item.conversation_id,
      question: item.conversation_title ?? '',
      type: drawerTypeFromMessageType(item.message_type),
    }));
  }, []);

  const trackItemOpened = useCallback(
    (conversationId: string) => {
      sdk.analytics.track(AnalyticsEvents.NEW_CHAT_CLICK_EVENT, {
        conversation_id: conversationId,
      });
    },
    [sdk],
  );

  return {
    state,
    refresh,
    refreshSilently,
    loadNextPage,
    setQuery,
    filteredItems,
    groupedSections,
    recentQuestions,
    trackItemOpened,
  };
}

function dedupeById(items: ConversationListItem[]): ConversationListItem[] {
  const seen = new Set<string>();
  const out: ConversationListItem[] = [];
  for (const item of items) {
    if (seen.has(item.conversation_id)) continue;
    seen.add(item.conversation_id);
    out.push(item);
  }
  return out;
}
