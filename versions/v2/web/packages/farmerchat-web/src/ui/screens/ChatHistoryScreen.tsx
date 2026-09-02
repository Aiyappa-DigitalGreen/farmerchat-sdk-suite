/**
 * ChatHistory (docs/01 §3.9): "Recent Chats" app bar (menu), grouped list by
 * API `grouping`, icons by message_type, center spinner when loading+empty,
 * inline retry for pagination errors, initial failure → error screen,
 * "Loading more…" footer, scroll-near-bottom pagination.
 */

import { useEffect, useRef } from 'react';
import { useLabel, useSdk } from '../context';
import { DefaultAppBar, Icon, ListCard, ListItem, LogoSpinner, PrimaryButton, SecondaryButton } from '../components/common';
import type { ChatHistoryUiState, ChatHistoryActions } from '../../state/useChatHistory';
import { Events, Screens } from '../../core/analytics';
import type { ConversationListItem } from '../../core/types';

function itemIcon(messageType: string | null | undefined): string {
  switch (messageType) {
    case 'query_audio':
    case 'audio':
    case 'voice':
    case 'mic':
      return Icon.mic;
    case 'input_image':
    case 'image':
    case 'camera':
      return Icon.camera;
    case 'card':
    case 'statement':
    case 'pre_generated':
      return Icon.card;
    default:
      return Icon.keyboard;
  }
}

export function ChatHistoryScreen(props: {
  history: ChatHistoryUiState;
  historyActions: ChatHistoryActions;
  onOpenDrawer: () => void;
  onOpenChat: (conversationId: string) => void;
  onNavigateToError: (isNetworkError: boolean) => void;
  onSignUpClick: () => void;
}) {
  const { services } = useSdk();
  const label = useLabel();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { history, historyActions } = props;
  // History is auth-gated: guests never load chats (mirrors android-compose).
  const canShowHistory = services.session.isAuthenticated() && services.config.showHistory;

  useEffect(() => {
    services.analytics.screenView(Screens.CHAT_HISTORY);
    if (canShowHistory) void historyActions.refresh();
    return () => services.analytics.screenExit(Screens.CHAT_HISTORY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial-load failure → full error screen (docs/01 §3.9).
  useEffect(() => {
    if (history.errorMessage && history.items.length === 0 && !history.isLoading) {
      props.onNavigateToError(history.isNetworkError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.errorMessage, history.items.length, history.isLoading]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 220) {
      void historyActions.loadNextPage();
    }
  };

  // Group by API `grouping` preserving order.
  const groups: Array<{ heading: string | null; items: ConversationListItem[] }> = [];
  for (const item of history.items) {
    const heading = item.grouping ?? null;
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.items.push(item);
    else groups.push({ heading, items: [item] });
  }

  return (
    <div className="fcsdk-screen">
      <DefaultAppBar title={label('chat_history_title', 'Recent Chats')} leadingIcon="menu" onLeadingClick={props.onOpenDrawer} />
      <div className="fcsdk-scroll" ref={scrollRef} onScroll={onScroll}>
        {!canShowHistory ? (
          <div className="fcsdk-feed-error">
            <div style={{ fontSize: 40 }} aria-hidden>
              {Icon.chat}
            </div>
            <div>{label('chat_history_signup_title', 'Sign up to save your questions')}</div>
            <div style={{ opacity: 0.8 }}>
              {label('chat_history_signup_body', "We'll save your chats so you can continue anytime.")}
            </div>
            <div className="fcsdk-pad">
              <SecondaryButton label={label('chat_history_sign_up', 'Sign up')} onClick={props.onSignUpClick} />
            </div>
          </div>
        ) : history.isLoading && history.items.length === 0 ? (
          <LogoSpinner message={label('chat_history_loading', 'Loading your chats…')} />
        ) : history.items.length === 0 ? (
          <div className="fcsdk-feed-error">
            <div style={{ fontSize: 40 }} aria-hidden>
              {Icon.chat}
            </div>
            <div>{label('chat_history_empty', 'No chats yet. Ask your first question!')}</div>
          </div>
        ) : (
          <>
            {groups.map((group, gi) => (
              <div key={gi}>
                {group.heading ? <div className="fcsdk-sectionheader">{group.heading}</div> : null}
                <ListCard>
                  {group.items.map((item, i) => (
                    <ListItem
                      key={item.conversation_id ?? `${gi}-${i}`}
                      icon={itemIcon(item.message_type)}
                      text={item.conversation_title ?? ''}
                      onClick={() => {
                        services.analytics.track(Events.NEW_CHAT_CLICK_EVENT, { conversation_id: item.conversation_id ?? '' });
                        if (item.conversation_id) props.onOpenChat(item.conversation_id);
                      }}
                    />
                  ))}
                </ListCard>
              </div>
            ))}
            {history.isLoadingMore ? <LogoSpinner message={label('chat_history_loading_more', 'Loading more…')} /> : null}
            {history.errorMessage && history.items.length > 0 ? (
              <div className="fcsdk-pad">
                <PrimaryButton label={label('chat_history_retry', 'Retry')} onClick={() => void historyActions.loadNextPage()} />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
