/**
 * Shared drawer (docs/01 §4) wrapping Home/Chat/Settings/Help/SettingsLanguage/
 * ChatHistory: nav items, recent 8 questions (typed icons), sign-up / See all,
 * current language, retry on history error.
 */

import type { ConversationListItem } from '../../core/types';
import { Icon, LogoGlyph, LogoSpinner, TextButton } from './common';
import { useLabel, useSdk } from '../context';
import { Events } from '../../core/analytics';

export type DrawerRoute = 'home' | 'settings' | 'settings/language' | 'help' | 'chatHistory';

function questionIcon(messageType: string | null | undefined): string {
  switch (messageType) {
    case 'query_audio':
    case 'mic':
      return Icon.mic;
    case 'input_image':
    case 'camera':
      return Icon.camera;
    case 'card':
      return Icon.card;
    default:
      return Icon.keyboard;
  }
}

export function Drawer(props: {
  open: boolean;
  currentRoute: string;
  onClose: () => void;
  onNavigate: (route: DrawerRoute) => void;
  isAuthenticated: boolean;
  onSeeAllClick: () => void;
  onSignUpClick: () => void;
  currentLanguage: string;
  previousQuestions: ConversationListItem[];
  historyErrorMessage: string | null;
  onRetryHistory: () => void;
  isLoadingHistory: boolean;
  onOpenQuestion: (item: ConversationListItem) => void;
  userName: string | null;
}) {
  const label = useLabel();
  const { services } = useSdk();
  // Recent chats / History are auth-gated: guests never see history (mirrors the
  // android-compose drawer, which renders the recent section only when authenticated).
  const canShowHistory = services.config.showHistory && props.isAuthenticated;
  const showSettings = services.config.showSettings;
  if (!props.open) return null;

  const navItem = (route: DrawerRoute, icon: string, text: string) => (
    <button
      type="button"
      className={`fcsdk-drawer-item${props.currentRoute === route ? ' fcsdk-drawer-item--active' : ''}`}
      onClick={() => {
        services.analytics.track(Events.MENU_OPTION_CLICK_EVENT, { option: route });
        props.onNavigate(route);
      }}
    >
      <span aria-hidden>{icon}</span>
      <span style={{ flex: 1 }}>{text}</span>
    </button>
  );

  return (
    <>
      <div className="fcsdk-drawer-scrim" onClick={props.onClose} />
      <nav className="fcsdk-drawer" aria-label="FarmerChat menu">
        <div className="fcsdk-drawer-head">
          <div style={{ fontSize: 28 }} aria-hidden>
            <LogoGlyph />
          </div>
          <div style={{ fontWeight: 800, fontSize: 17, marginTop: 6 }}>
            {props.userName || label('fc_v2_app_label_farmerchat', 'FarmerChat')}
          </div>
          <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>{props.currentLanguage}</div>
        </div>
        <div className="fcsdk-scroll">
          {/* Order matches the app (components/drawer/DrawerContent.kt) and the Android SDK:
              Home -> Language -> Settings -> Help, with recent chats BELOW the divider. */}
          {navItem('home', '🏠', label('fc_v2_app_label_home', 'Home'))}
          {navItem('settings/language', '🌐', label('fc_v2_app_label_language', 'Language'))}
          {showSettings ? navItem('settings', '⚙️', label('fc_v2_app_label_settings', 'Settings')) : null}
          {navItem('help', '❓', label('fc_v2_app_label_help', 'Help'))}
          {canShowHistory ? navItem('chatHistory', Icon.chat, label('drawer_recent_chats', 'Recent Chats')) : null}

          {canShowHistory ? <div className="fcsdk-drawer-section">{label('drawer_previous_questions', 'Previous questions')}</div> : null}
          {!canShowHistory ? null : props.isLoadingHistory ? (
            <LogoSpinner />
          ) : props.historyErrorMessage ? (
            <div className="fcsdk-pad">
              <div className="fcsdk-error-inline">{props.historyErrorMessage}</div>
              <TextButton label={label('drawer_retry', 'Retry')} onClick={props.onRetryHistory} />
            </div>
          ) : (
            <>
              {props.previousQuestions.map((item, i) => (
                <button key={item.conversation_id ?? i} type="button" className="fcsdk-drawer-q" onClick={() => props.onOpenQuestion(item)}>
                  <span aria-hidden>{questionIcon(item.message_type)}</span>
                  <span className="fcsdk-qtext">{item.conversation_title ?? ''}</span>
                </button>
              ))}
              {props.previousQuestions.length > 0 ? (
                <div style={{ padding: '2px 10px' }}>
                  <TextButton
                    label={label('fc_v2_app_label_see_all', 'See all')}
                    onClick={() => {
                      services.analytics.track(Events.CHAT_HISTORY_CLICK_EVENT, { source: 'drawer' });
                      props.onSeeAllClick();
                    }}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
        {!props.isAuthenticated ? (
          <div style={{ padding: '12px 16px 16px' }}>
            <button
              type="button"
              className="fcsdk-btn-secondary"
              onClick={() => {
                services.analytics.track(Events.MENU_OPTION_CLICK_EVENT, { option: 'sign_up' });
                props.onSignUpClick();
              }}
            >
              {label('fc_v2_app_label_sign_up', 'Sign up')}
            </button>
          </div>
        ) : null}
      </nav>
    </>
  );
}
