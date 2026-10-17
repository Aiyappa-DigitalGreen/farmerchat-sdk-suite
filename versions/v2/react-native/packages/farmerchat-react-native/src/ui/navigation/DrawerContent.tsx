/**
 * AppDrawer (docs/01 §4) — port of the app's components/drawer/DrawerContent.kt:
 *
 *  - 320 wide on brand surfaceSecondary (dark green), white wordmark 16 tall (24 / 56 / 20 inset);
 *  - Home / "Language: <name>" / Settings / Help & Support rows: 52 tall, radius MD, 14 side
 *    padding, 24dp green icon, labelMedium white, selected row on surfaceTertiary;
 *  - a 1dp divider (surfacePrimary @ 20 %);
 *  - signed in: "Recent chats" header (titleMedium, tappable → history), up to 8 question rows
 *    (18dp typed icons), loading / error + Try again / "No chats yet.", and a pinned "See all"
 *    chevron button over a 14dp fade;
 *  - guest: the sign-up card pinned to the bottom (surfaceTertiary, radius LG) with
 *    SAVE_YOUR_QUESTIONS_ANSWERS / WELL_SAVE_YOUR_CHATS_YOU_CONTINUE and a "Sign up" chevron button.
 */
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLabel, useTheme } from '../context';
import type { DrawerQuestion } from '../../state/useChatHistory';
import type { DrawerRoute } from '../../core/chatWire';
import { Labels } from '../../core/labels';
import { LogoSpinnerVertical } from '../components/Chrome';
import { PrimaryButton } from '../components/Buttons';
import { FcIcon } from '../components/Icon';
import { Assets, type IconName } from '../assets';
import { radius, typography } from '../theme';

/** App drawer width (DrawerContent.kt `.width(320.dp)`). */
export const DRAWER_WIDTH = 320;

/** Most questions the drawer lists (DrawerContent.kt `previousQuestions.take(8)`). */
export const DRAWER_MAX_QUESTIONS = 8;

function questionIcon(type: DrawerQuestion['type']): IconName {
  switch (type) {
    case 'camera':
      return 'camera';
    case 'mic':
      return 'mic';
    case 'card':
      return 'card';
    case 'keyboard':
      return 'keyboard';
  }
}

export interface AppDrawerProps {
  currentRoute: string | null;
  onNavigate: (route: DrawerRoute) => void;
  isAuthenticated: boolean;
  onSeeAllClick: () => void;
  onSignUpClick: () => void;
  currentLanguage: string | null;
  previousQuestions: DrawerQuestion[];
  historyErrorMessage: string | null;
  onRetryHistory: () => void;
  isLoadingHistory: boolean;
  onOpenQuestion: (question: DrawerQuestion, index: number) => void;
  /** C3 toggles — hide the Settings entry / the history section. Default true. */
  showSettings?: boolean;
  showHistory?: boolean;
}

export function AppDrawerContent(props: AppDrawerProps): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();
  const insets = useSafeAreaInsets();
  const b = theme.brand;

  const showSettings = props.showSettings !== false;
  const showHistory = props.showHistory !== false;
  const questions = props.previousQuestions.slice(0, DRAWER_MAX_QUESTIONS);

  const Row = (p: { icon: IconName; text: string; selected: boolean; iconSize?: number; onPress: () => void }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: p.selected }}
      onPress={p.onPress}
      style={[styles.row, { backgroundColor: p.selected ? b.surfaceTertiary : b.surfaceSecondary }]}
    >
      <FcIcon name={p.icon} size={p.iconSize ?? 24} tint={b.foregroundSecondary} />
      <Text numberOfLines={1} style={[typography.labelMedium, styles.rowText, { color: b.foregroundPrimary }]}>
        {p.text}
      </Text>
    </Pressable>
  );

  const languageText = `${label(Labels.LANGUAGE, 'Language')}: ${props.currentLanguage ?? 'English'}`;
  const isNetworkMessage = (m: string) => /network|internet/i.test(m);

  return (
    <View style={[styles.container, { backgroundColor: b.surfaceSecondary, paddingTop: insets.top }]}>
      <Image
        source={Assets.logoWordmark}
        resizeMode="contain"
        style={[styles.wordmark, { tintColor: '#FFFFFF' }]}
        accessibilityLabel="FarmerChat"
      />

      {/* Order matches the app: Home -> Language -> Settings -> Help & Support. */}
      <View style={styles.nav}>
        <Row
          icon="home"
          text={label(Labels.HOME, 'Home')}
          selected={props.currentRoute === 'Home'}
          onPress={() => props.onNavigate('home')}
        />
        <Row
          icon="language"
          text={languageText}
          selected={props.currentRoute === 'SettingsLanguage'}
          onPress={() => props.onNavigate('settings/language')}
        />
        {showSettings ? (
          <Row
            icon="settings"
            text={label(Labels.SETTINGS, 'Settings')}
            selected={props.currentRoute === 'Settings'}
            onPress={() => props.onNavigate('settings')}
          />
        ) : null}
        <Row
          icon="help"
          text={label(Labels.HELP_SUPPORT, 'Help & Support')}
          selected={props.currentRoute === 'Help'}
          onPress={() => props.onNavigate('help')}
        />
      </View>

      <View style={{ height: 8 }} />
      <View style={[styles.divider, { backgroundColor: b.surfacePrimary }]} />

      {props.isAuthenticated ? (
        showHistory ? (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ paddingBottom: questions.length > 0 ? 62 : 0 }}>
              <Text
                onPress={props.onSeeAllClick}
                style={[typography.titleMedium, styles.recentHeader, { color: b.foregroundPrimary }]}
              >
                {label(Labels.RECENT_CHATS, 'Recent chats')}
              </Text>
              {props.isLoadingHistory ? (
                <View style={styles.loading}>
                  <LogoSpinnerVertical color="#FFFFFF" message={label(Labels.LOADING_CHATS, 'Loading chats...')} />
                </View>
              ) : props.historyErrorMessage != null ? (
                <View style={styles.error}>
                  <Text style={[typography.titleSmall, { color: b.foregroundSecondary, textAlign: 'center' }]}>
                    {isNetworkMessage(props.historyErrorMessage)
                      ? label(Labels.NO_INTERNET_CONNECTION, 'No internet connection')
                      : label(Labels.FAILED_TO_LOAD_CHATS, 'Failed to load chats')}
                  </Text>
                  <Text
                    style={[typography.bodySmall, { color: b.foregroundPrimary, opacity: 0.7, textAlign: 'center' }]}
                  >
                    {label(Labels.PLEASE_CONNECT_INTERNET_TRY_AGAIN, 'Check your connection and try again')}
                  </Text>
                  <PrimaryButton
                    forceDark
                    label={label(Labels.TRY_AGAIN, 'Try again')}
                    onPress={props.onRetryHistory}
                    style={{ alignSelf: 'stretch' }}
                  />
                </View>
              ) : questions.length > 0 ? (
                <View style={styles.nav}>
                  {questions.map((q, index) => (
                    <Row
                      key={q.conversationId}
                      icon={questionIcon(q.type)}
                      iconSize={18}
                      text={q.question}
                      selected={false}
                      onPress={() => props.onOpenQuestion(q, index)}
                    />
                  ))}
                </View>
              ) : (
                <Text style={[typography.bodyMedium, styles.empty, { color: b.foregroundPrimary }]}>
                  {label(Labels.NO_CHATS_YET, 'No chats yet.')}
                </Text>
              )}
            </ScrollView>
            {questions.length > 0 ? (
              <View style={styles.seeAllDock} pointerEvents="box-none">
                <View pointerEvents="none" style={styles.fade}>
                  {[0.15, 0.4, 0.7, 0.9].map((o) => (
                    <View key={o} style={{ flex: 1, backgroundColor: b.surfaceSecondary, opacity: o }} />
                  ))}
                </View>
                <View style={{ backgroundColor: b.surfaceSecondary, paddingHorizontal: 16 }}>
                  <PrimaryButton
                    forceDark
                    state="Chevron"
                    label={label(Labels.SEE_ALL, 'See all')}
                    onPress={props.onSeeAllClick}
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )
      ) : (
        <>
          <View style={{ flex: 1 }} />
          <View style={[styles.signUpCard, { backgroundColor: b.surfaceTertiary }]}>
            <View style={{ gap: 12, alignItems: 'center', alignSelf: 'stretch' }}>
              <Text style={[typography.titleMedium, { color: b.foregroundSecondary, textAlign: 'center' }]}>
                {label(Labels.SAVE_YOUR_QUESTIONS_ANSWERS, 'Save your past questions')}
              </Text>
              <Text style={[typography.bodyMedium, { color: b.foregroundPrimary, textAlign: 'center' }]}>
                {label(Labels.WELL_SAVE_YOUR_CHATS_YOU_CONTINUE, 'Keep your answers and come back anytime')}
              </Text>
            </View>
            <PrimaryButton
              forceDark
              state="Chevron"
              label={label(Labels.SIGN_UP, 'Sign up')}
              onPress={props.onSignUpClick}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </>
      )}

      <View style={{ height: 8 + insets.bottom }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  wordmark: { marginLeft: 24, marginTop: 56, marginBottom: 20, height: 16, width: (16 * 1200) / 153 },
  nav: { paddingHorizontal: 12 },
  row: {
    height: 52,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: { flex: 1 },
  divider: { height: 1, opacity: 0.2 },
  recentHeader: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 10 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  error: { paddingHorizontal: 16, paddingVertical: 20, gap: 12, alignItems: 'center' },
  empty: { paddingHorizontal: 22, paddingVertical: 10 },
  seeAllDock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  fade: { height: 14 },
  signUpCard: {
    marginHorizontal: 12,
    borderRadius: radius.lg,
    paddingTop: 18,
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 16,
    alignItems: 'center',
  },
});
