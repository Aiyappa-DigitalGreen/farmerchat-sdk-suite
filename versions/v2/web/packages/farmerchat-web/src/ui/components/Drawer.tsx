/**
 * Shared drawer (docs/01 §4) wrapping Home/Chat/Settings/Help/SettingsLanguage/
 * ChatHistory: nav items, recent 8 questions (typed icons), sign-up / See all,
 * current language, retry on history error.
 */

import type { ConversationListItem } from '../../core/types';
import { LogoSpinner, PrimaryButton } from './common';
import { FcIcon, type IconName } from './FcIcon';
import { useLabel, useSdk } from '../context';
import { Events } from '../../core/analytics';

export type DrawerRoute = 'home' | 'settings' | 'settings/language' | 'help' | 'chatHistory';

function questionIcon(messageType: string | null | undefined): IconName {
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
  const navItem = (route: DrawerRoute, icon: IconName, text: string, option: string) => (
    <button
      type="button"
      className={`fcsdk-c-drawer-btn${props.currentRoute === route ? ' fcsdk-c-drawer-btn--active' : ''}`}
      onClick={() => {
        services.analytics.track(Events.MENU_OPTION_CLICK_EVENT, { option });
        props.onNavigate(route);
      }}
    >
      <FcIcon name={icon} size={24} />
      <span className="fc-t-labelMedium fcsdk-c-drawer-btn-label">{text}</span>
    </button>
  );
  const hasHistory = props.previousQuestions.length > 0;
  const isNetwork = /network|internet/i.test(props.historyErrorMessage ?? '');

  // Drawer.kt: a 300dp #08361B sheet (both themes) sliding in over a 32% scrim — wordmark, 52dp
  // rows, a faint brand rule, then Recent chats (signed in) or the sign-up card (guests).
  return (
    <div className={`fcsdk-c-drawer-host${props.open ? ' fcsdk-c-drawer-host--open' : ''}`} aria-hidden={!props.open}>
      <div className="fcsdk-c-drawer-scrim" onClick={props.onClose} />
      <nav className="fcsdk-c-drawer" aria-label="FarmerChat menu">
        <FcIcon name="logo_wordmark" height={16} tint="#FFFFFF" className="fcsdk-c-drawer-wordmark" title="FarmerChat" />
        <div className="fcsdk-c-drawer-nav">
          {navItem('home', 'icon_home', label('fc_v2_app_label_home', 'Home'), 'Home')}
          {navItem(
            'settings/language',
            'icon_language',
            `${label('fc_v2_app_label_language', 'Language')}: ${props.currentLanguage}`,
            'Language',
          )}
          {showSettings ? navItem('settings', 'icon_settings', label('fc_v2_app_label_settings', 'Settings'), 'Settings') : null}
          {navItem('help', 'icon_help', label('fc_v2_app_label_help_support', 'Help & Support'), 'Help_Support')}
        </div>
        <div className="fcsdk-c-drawer-rule" />
        {canShowHistory ? (
          <div className="fcsdk-c-drawer-history">
            <div className="fcsdk-c-drawer-historyscroll" style={{ paddingBottom: hasHistory ? 62 : 0 }}>
              <button
                type="button"
                className="fc-t-titleMedium fcsdk-c-drawer-recent"
                onClick={() => {
                  services.analytics.track(Events.CHAT_HISTORY_CLICK_EVENT, { source: 'drawer' });
                  props.onSeeAllClick();
                }}
              >
                {label('fc_v2_app_label_recent_chats', 'Recent chats')}
              </button>
              {props.isLoadingHistory ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <LogoSpinner message={label('fc_v2_app_label_loading_chats', 'Loading chats...')} labelColor="#FFFFFF" />
                </div>
              ) : props.historyErrorMessage ? (
                <div className="fcsdk-c-drawer-error">
                  <div className="fc-t-titleSmall" style={{ color: '#00C950', textAlign: 'center' }}>
                    {isNetwork
                      ? label('fc_v2_app_label_no_internet_connection', 'No internet connection')
                      : label('fc_v2_app_label_failed_to_load_chats', 'Failed to load chats')}
                  </div>
                  <div className="fc-t-bodySmall" style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
                    {label('fc_v2_app_label_please_connect_internet_try_again', 'Check your connection and try again')}
                  </div>
                  <PrimaryButton variant="dark" label={label('fc_v2_app_label_try_again', 'Try again')} onClick={props.onRetryHistory} />
                </div>
              ) : hasHistory ? (
                <div className="fcsdk-c-drawer-nav">
                  {props.previousQuestions.slice(0, 8).map((item, i) => (
                    <button key={item.conversation_id ?? i} type="button" className="fcsdk-c-drawer-btn" onClick={() => props.onOpenQuestion(item)}>
                      <FcIcon name={questionIcon(item.message_type)} size={18} />
                      <span className="fc-t-labelMedium fcsdk-c-drawer-btn-label">{item.conversation_title ?? ''}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="fc-t-bodyMedium" style={{ color: '#FFFFFF', padding: '10px 22px' }}>
                  {label('fc_v2_app_label_no_chats_yet', 'No chats yet.')}
                </div>
              )}
            </div>
            {hasHistory && !props.isLoadingHistory && !props.historyErrorMessage ? (
              <div className="fcsdk-c-drawer-seeall">
                <div className="fcsdk-c-drawer-seeall-fade" />
                <div style={{ padding: '0 16px', background: '#08361B' }}>
                  <PrimaryButton
                    variant="dark"
                    state="chevron"
                    label={label('fc_v2_app_label_see_all', 'See all')}
                    onClick={() => {
                      services.analytics.track(Events.CHAT_HISTORY_CLICK_EVENT, { source: 'drawer' });
                      props.onSeeAllClick();
                    }}
                  />
                </div>
              </div>
            ) : null}
            <div style={{ height: 8 }} />
          </div>
        ) : (
          <>
            <div style={{ flex: 1 }} />
            {!props.isAuthenticated ? (
              <div className="fcsdk-c-drawer-signup">
                <div className="fcsdk-c-section" style={{ gap: 12 }}>
                  <div className="fc-t-titleMedium" style={{ color: '#00C950', textAlign: 'center' }}>
                    {label('fc_v2_app_label_save_your_questions_answers', 'Save your questions and answers')}
                  </div>
                  <div className="fc-t-bodyMedium" style={{ color: '#FFFFFF', textAlign: 'center' }}>
                    {label('fc_v2_app_label_well_save_your_chats_you_continue', "We'll save your chats so you can continue later.")}
                  </div>
                </div>
                <PrimaryButton
                  variant="dark"
                  state="chevron"
                  label={label('fc_v2_app_label_sign_up', 'Sign up')}
                  onClick={() => {
                    services.analytics.track(Events.MENU_OPTION_CLICK_EVENT, { option: 'Signup' });
                    props.onSignUpClick();
                  }}
                />
              </div>
            ) : null}
            <div style={{ height: 8 }} />
          </>
        )}
      </nav>
    </div>
  );
}
