/**
 * ChatHistory (docs/01 §3.9) — "Recent Chats" grouped list (section headers
 * from API `grouping`, icon by message_type), pagination near bottom,
 * center spinner when loading+empty, inline retry for pagination errors,
 * initial-load failure → error screen.
 */
import React, { useEffect } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenNames } from '../../core/analytics';
import { useLabel, useSdk, useTheme } from '../context';
import {
  drawerTypeFromMessageType,
  type UseChatHistoryResult,
} from '../../state/useChatHistory';
import { PrimaryButton } from '../components/Buttons';
import { ListItem } from '../components/Cards';
import { DefaultAppBar, LogoSpinner } from '../components/Chrome';
import { radius, spacing, typography } from '../theme';

import type { IconName } from '../assets';

function iconFor(messageType: string | null | undefined): IconName {
  switch (drawerTypeFromMessageType(messageType)) {
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

export function ChatHistoryScreen(props: {
  history: UseChatHistoryResult;
  onOpenDrawer: () => void;
  onOpenChatFromHistory: (conversationId: string) => void;
  onNavigateToError: (isNetworkError: boolean) => void;
}): React.ReactElement {
  const theme = useTheme();
  const sdk = useSdk();
  const label = useLabel();
  const { history } = props;
  const { state } = history;

  useEffect(() => {
    sdk.analytics.trackScreenView('Chat History Screen');
    // History gates behind authentication (mirrors android-compose): guests
    // never load chat history — only OTP-verified or HOST_TOKEN users do.
    if (sdk.session.isAuthenticated) history.refresh();
    return () => sdk.analytics.trackScreenExit('Chat History Screen');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // initial-load failure → full error screen; pagination errors stay inline
  useEffect(() => {
    if (state.errorMessage !== null && state.items.length === 0) {
      props.onNavigateToError(state.isNetworkError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.errorMessage]);

  const sections = history.groupedSections().map((section) => ({
    title: section.title,
    data: section.data,
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <DefaultAppBar
        title={label('history_title', 'Recent Chats')}
        navIcon="menu"
        onNavPress={props.onOpenDrawer}
      />
      {state.isLoading && state.items.length === 0 ? (
        <View style={styles.center}>
          <LogoSpinner message={label('history_loading', 'Loading your chats…')} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.conversation_id}
          stickySectionHeadersEnabled={false}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (state.canLoadMore && state.errorMessage === null) {
              history.loadNextPage();
            }
          }}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <Text
                style={[
                  typography.bodySmall,
                  styles.sectionHeader,
                  { color: theme.textTertiary },
                ]}
              >
                {section.title}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.itemCard,
                { backgroundColor: theme.cardBackground, borderColor: theme.border },
              ]}
            >
              <ListItem
                icon={iconFor(item.message_type)}
                label={item.conversation_title ?? ''}
                onPress={() => {
                  history.trackItemOpened(item.conversation_id);
                  props.onOpenChatFromHistory(item.conversation_id);
                }}
              />
            </View>
          )}
          ListEmptyComponent={
            <Text
              style={[
                typography.body,
                { color: theme.textSecondary, textAlign: 'center', marginTop: spacing.xxl },
              ]}
            >
              {label('history_empty', 'No chats yet. Ask your first question!')}
            </Text>
          }
          ListFooterComponent={
            state.errorMessage !== null && state.items.length > 0 ? (
              <View style={styles.footerRetry}>
                <Text style={[typography.bodySmall, { color: theme.error, textAlign: 'center' }]}>
                  {state.errorMessage}
                </Text>
                <PrimaryButton
                  label={label('history_retry', 'Try again')}
                  onPress={() => history.loadNextPage()}
                />
              </View>
            ) : state.canLoadMore ? (
              <LogoSpinner message={label('history_loading_more', 'Loading more…')} />
            ) : null
          }
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: {
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xs,
  },
  itemCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  footerRetry: { padding: spacing.lg, gap: spacing.md },
});
