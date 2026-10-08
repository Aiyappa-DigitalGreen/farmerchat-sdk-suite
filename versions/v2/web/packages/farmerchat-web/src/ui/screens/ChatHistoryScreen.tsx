/**
 * ChatHistory (docs/01 §3.9): "Recent Chats" app bar (menu), grouped list by
 * API `grouping`, icons by message_type, center spinner when loading+empty,
 * inline retry for pagination errors, initial failure → error screen,
 * "Loading more…" footer, scroll-near-bottom pagination.
 */

import { useEffect, useRef } from 'react';
import { useLabel, useSdk } from '../context';
import { DefaultAppBar, ListCard, ListItem, LogoSpinner, PrimaryButton, SecondaryButton } from '../components/common';
import type { IconName } from '../components/FcIcon';
import type { ChatHistoryUiState, ChatHistoryActions } from '../../state/useChatHistory';
import { Events, Screens } from '../../core/analytics';
import type { ConversationListItem } from '../../core/types';

function itemIcon(messageType: string | null | undefined): IconName {
  switch (messageType) {
    case 'query_audio':
    case 'audio':
    case 'voice':
    case 'mic':
      return 'icon_mic';
    case 'input_image':
    case 'image':
    case 'camera':
      return 'icon_camera';
    case 'card':
    case 'statement':
    case 'pre_generated':
      return 'icon_card';
    default:
      return 'icon_keyboard';
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

  // ChatHistoryScreen.kt: list padded 8/20 with 8 between items; a labelLarge muted group header,
  // then one ListCard per group of 48dp rows with 20dp tinted type icons.
  return (
    <div className="fcsdk-screen fcsdk-c-screen">
      <DefaultAppBar title={label('fc_v2_app_label_recent_chats', 'Recent Chats')} leadingIcon="menu" onLeadingClick={props.onOpenDrawer} />
      {!canShowHistory ? (
        // Web-only: compose never gates this screen (docs/04). Kept for guests on web.
        <div className="fcsdk-c-center" style={{ flexDirection: 'column', gap: 12, padding: 24 }}>
          <p className="fcsdk-c-title fc-t-titleMedium">{label('fc_v2_app_label_save_your_questions_answers', 'Save your questions and answers')}</p>
          <p className="fcsdk-c-subtitle fc-t-bodyMedium">
            {label('fc_v2_app_label_well_save_your_chats_you_continue', "We'll save your chats so you can continue later.")}
          </p>
          <SecondaryButton label={label('fc_v2_app_label_sign_up', 'Sign up')} onClick={props.onSignUpClick} />
        </div>
      ) : history.isLoading && history.items.length === 0 ? (
        <div className="fcsdk-c-center">
          <LogoSpinner message={label('fc_v2_app_label_loading_chats', 'Loading chats...')} />
        </div>
      ) : history.items.length === 0 ? (
        <div className="fcsdk-c-center">
          <p className="fcsdk-c-muted fc-t-bodyMedium" style={{ margin: 0 }}>{label('fc_v2_app_label_no_chats_yet', 'No chats yet.')}</p>
        </div>
      ) : (
        <div className="fcsdk-scroll" ref={scrollRef} onScroll={onScroll}>
          <div className="fcsdk-c-section" style={{ padding: '8px 20px', gap: 8 }}>
            {groups.map((group, gi) => (
              <div key={gi} className="fcsdk-c-section" style={{ gap: 8 }}>
                {group.heading ? (
                  <div className="fcsdk-c-muted fc-t-labelLarge" style={{ paddingTop: 12 }}>
                    {group.heading}
                  </div>
                ) : null}
                <ListCard>
                  {group.items.map((item, i) => (
                    <ListItem
                      key={item.conversation_id ?? `${gi}-${i}`}
                      icon={itemIcon(item.message_type)}
                      text={item.conversation_title ?? ''}
                      divider={i < group.items.length - 1}
                      onClick={() => {
                        services.analytics.track(Events.NEW_CHAT_CLICK_EVENT, { conversation_id: item.conversation_id ?? '' });
                        if (item.conversation_id) props.onOpenChat(item.conversation_id);
                      }}
                    />
                  ))}
                </ListCard>
              </div>
            ))}
            {history.isLoadingMore ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                <LogoSpinner horizontal message={label('fc_v2_app_label_loading_more', 'Loading more...')} />
              </div>
            ) : null}
            {history.errorMessage && history.items.length > 0 ? (
              <div className="fcsdk-c-section" style={{ alignItems: 'center', gap: 8, padding: '12px 0' }}>
                <span className="fcsdk-c-muted fc-t-bodyMedium">
                  {label('fc_v2_app_label_couldnt_load_more_chats', "Couldn't load more chats")}
                </span>
                <div>
                  <PrimaryButton
                    className="fcsdk-c-btn-wrap"
                    label={label('fc_v2_app_label_try_again', 'Try again')}
                    onClick={() => void historyActions.loadNextPage()}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
