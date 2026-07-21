/**
 * AppDrawer (docs/01 §4) — shared drawer wrapping Home/Chat/Settings/Help/
 * SettingsLanguage/ChatHistory: nav items, recent 8 questions (typed
 * camera/mic/keyboard/card icons), "See all", sign-up CTA / current language,
 * history error retry, silent refresh on open.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLabel, useTheme } from '../context';
import type { DrawerQuestion } from '../../state/useChatHistory';
import { LogoMark, LogoSpinner } from '../components/Chrome';
import { FcIcon } from '../components/Icon';
import type { IconName } from '../assets';
import { radius, spacing, typography } from '../theme';

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
  onNavigate: (route: 'home' | 'settings' | 'settings/language' | 'help' | 'chatHistory') => void;
  isAuthenticated: boolean;
  onSeeAllClick: () => void;
  onSignUpClick: () => void;
  currentLanguage: string | null;
  previousQuestions: DrawerQuestion[];
  historyErrorMessage: string | null;
  onRetryHistory: () => void;
  isLoadingHistory: boolean;
  onOpenQuestion: (question: DrawerQuestion) => void;
  /** C3 toggles — hide the Settings entry / the history section. Default true. */
  showSettings?: boolean;
  showHistory?: boolean;
}

export function AppDrawerContent(props: AppDrawerProps): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();

  const showSettings = props.showSettings !== false;
  const showHistory = props.showHistory !== false;
  const c = theme.content;
  const NavItem = (p: {
    icon: IconName;
    text: string;
    route: 'home' | 'settings' | 'settings/language' | 'help' | 'chatHistory';
    activeMatch: string;
  }) => {
    const active = props.currentRoute === p.activeMatch;
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => props.onNavigate(p.route)}
        style={[
          styles.navItem,
          active && { backgroundColor: c.surfaceActive, borderRadius: radius.md },
        ]}
      >
        <FcIcon
          name={p.icon}
          size={22}
          tint={active ? c.borderActive : c.foregroundPrimary}
        />
        <Text
          style={[
            typography.bodyMedium,
            {
              color: active ? c.borderActive : c.foregroundPrimary,
              fontWeight: active ? '700' : '400',
            },
          ]}
        >
          {p.text}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.surfaceSecondary }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <LogoMark size={40} color={c.foregroundPrimary} />
          <Text style={[typography.titleLarge, { color: c.foregroundPrimary }]}>FarmerChat</Text>
        </View>

        <NavItem icon="home" text={label('drawer_home', 'Home')} route="home" activeMatch="Home" />
        {showSettings ? (
          <NavItem
            icon="settings"
            text={label('drawer_settings', 'Settings')}
            route="settings"
            activeMatch="Settings"
          />
        ) : null}
        <NavItem
          icon="language"
          text={label('drawer_language', 'Language')}
          route="settings/language"
          activeMatch="SettingsLanguage"
        />
        <NavItem icon="help" text={label('drawer_help', 'Help')} route="help" activeMatch="Help" />

        {showHistory ? (
          <>
            <View style={[styles.divider, { backgroundColor: theme.divider }]} />

            <Text style={[typography.bodySmall, styles.sectionTitle, { color: theme.textTertiary }]}>
              {label('drawer_recent', 'Recent questions')}
            </Text>
            {props.isLoadingHistory && props.previousQuestions.length === 0 ? (
          <LogoSpinner message={null} />
        ) : props.historyErrorMessage ? (
          <View style={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
            <Text style={[typography.bodySmall, { color: theme.error }]}>
              {props.historyErrorMessage}
            </Text>
            <Text
              onPress={props.onRetryHistory}
              style={[typography.bodySmall, { color: theme.brandPrimary, fontWeight: '600' }]}
            >
              {label('drawer_retry', 'Try again')}
            </Text>
          </View>
        ) : props.previousQuestions.length === 0 ? (
          <Text
            style={[typography.bodySmall, { color: theme.textTertiary, paddingHorizontal: spacing.md }]}
          >
            {label('drawer_no_questions', 'Your questions will appear here')}
          </Text>
        ) : (
          props.previousQuestions.map((q) => (
            <Pressable
              key={q.conversationId}
              accessibilityRole="button"
              onPress={() => props.onOpenQuestion(q)}
              style={styles.questionRow}
            >
              <FcIcon name={questionIcon(q.type)} size={16} tint={c.foregroundSecondary} />
              <Text
                style={[typography.bodySmall, { color: theme.textPrimary, flex: 1 }]}
                numberOfLines={2}
              >
                {q.question}
              </Text>
            </Pressable>
          ))
        )}
        {props.previousQuestions.length > 0 ? (
          <Text
            onPress={props.onSeeAllClick}
            style={[
              typography.bodySmall,
              {
                color: theme.brandPrimary,
                fontWeight: '600',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              },
            ]}
          >
            {label('drawer_see_all', 'See all')} ›
          </Text>
        ) : null}
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { borderColor: theme.divider }]}>
        {!props.isAuthenticated ? (
          <Pressable
            accessibilityRole="button"
            onPress={props.onSignUpClick}
            style={[styles.signUp, { backgroundColor: theme.brandPrimary }]}
          >
            <Text style={[typography.button, { color: theme.textOnBrand }]}>
              {label('drawer_signup', 'Sign up')}
            </Text>
          </Pressable>
        ) : null}
        {props.currentLanguage ? (
          <Text style={[typography.caption, { color: theme.textTertiary }]}>
            {label('drawer_current_language', 'Language: {name}', {
              name: props.currentLanguage,
            })}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.xs },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  divider: { height: 1, marginVertical: spacing.md },
  sectionTitle: {
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  footer: { borderTopWidth: 1, padding: spacing.lg, gap: spacing.md },
  signUp: {
    borderRadius: radius.pill,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
});
