/**
 * ChatHistoryViewModel port — ChatHistoryUiState (docs/01 §3.9). Grouped,
 * paginated conversation list shared by the ChatHistory screen and the drawer
 * (recent 8 questions).
 */

import { useCallback, useRef, useState } from 'react';
import type { SdkServices } from '../core/services';
import type { ConversationListItem } from '../core/types';

export interface ChatHistoryUiState {
  items: ConversationListItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  errorMessage: string | null;
  isNetworkError: boolean;
  canLoadMore: boolean;
  query: string;
}

const initialState: ChatHistoryUiState = {
  items: [],
  isLoading: false,
  isLoadingMore: false,
  errorMessage: null,
  isNetworkError: false,
  canLoadMore: false,
  query: '',
};

export interface ChatHistoryActions {
  refresh: () => Promise<void>;
  refreshSilently: () => Promise<void>;
  loadNextPage: () => Promise<void>;
  setQuery: (q: string) => void;
  filteredItems: () => ConversationListItem[];
  /** Recent N questions for the drawer. */
  recentQuestions: (limit?: number) => ConversationListItem[];
}

export function useChatHistory(services: SdkServices): [ChatHistoryUiState, ChatHistoryActions] {
  const [state, setState] = useState<ChatHistoryUiState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pageRef = useRef(1);
  const { api, session } = services;

  const load = useCallback(
    async (page: number, silent: boolean) => {
      if (page === 1) {
        pageRef.current = 1;
        if (!silent) setState((s) => ({ ...s, isLoading: true, errorMessage: null }));
      } else {
        setState((s) => ({ ...s, isLoadingMore: true, errorMessage: null }));
      }
      const res = await api.getConversationList(session.userId ?? '', page);
      if (!res.ok) {
        setState((s) => ({
          ...s,
          isLoading: false,
          isLoadingMore: false,
          errorMessage: res.message,
          isNetworkError: res.isNetworkError || res.isTimeout,
        }));
        return;
      }
      pageRef.current = page;
      setState((s) => ({
        ...s,
        items: page === 1 ? res.data.results : [...s.items, ...res.data.results],
        isLoading: false,
        isLoadingMore: false,
        errorMessage: null,
        isNetworkError: false,
        canLoadMore: res.data.next_page !== null && res.data.next_page !== undefined,
      }));
    },
    [api, session],
  );

  const refresh = useCallback(() => load(1, false), [load]);
  const refreshSilently = useCallback(() => load(1, true), [load]);

  const loadNextPage = useCallback(async () => {
    const s = stateRef.current;
    if (!s.canLoadMore || s.isLoadingMore || s.isLoading) return;
    await load(pageRef.current + 1, false);
  }, [load]);

  const setQuery = useCallback((q: string) => setState((s) => ({ ...s, query: q })), []);

  const filteredItems = useCallback((): ConversationListItem[] => {
    const s = stateRef.current;
    if (!s.query.trim()) return s.items;
    const q = s.query.trim().toLowerCase();
    return s.items.filter((item) =>
      (item.conversation_title ?? item.question ?? item.title ?? '').toLowerCase().includes(q),
    );
  }, []);

  const recentQuestions = useCallback((limit = 8): ConversationListItem[] => {
    return stateRef.current.items.slice(0, limit);
  }, []);

  return [state, { refresh, refreshSilently, loadNextPage, setQuery, filteredItems, recentQuestions }];
}
