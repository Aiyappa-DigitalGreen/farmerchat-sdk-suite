/**
 * Help (docs/01 §3.12) — "How to use FarmerChat" FAQ ListCard (skeleton rows,
 * empty state, FAQ items → onOpenUrl), "More" section (Terms/Privacy),
 * footer version + "© Digital Green".
 */
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalyticsEvents, ScreenNames } from '../../core/analytics';
import { SDK_VERSION } from '../../core/config';
import { useLabel, useSdk, useTheme } from '../context';
import { useHelp } from '../../state/useSettings';
import { ListCard, ListItem } from '../components/Cards';
import { DefaultAppBar, SkeletonBlock } from '../components/Chrome';
import { spacing, typography } from '../theme';

export function HelpScreen(props: {
  onOpenDrawer: () => void;
  onOpenUrl: (url: string, title: string) => void;
  onNavigateToError: (isNetworkError: boolean, retry: () => void) => void;
}): React.ReactElement {
  const theme = useTheme();
  const sdk = useSdk();
  const label = useLabel();
  const { helpState, reload } = useHelp(sdk);

  useEffect(() => {
    sdk.analytics.trackScreenView(ScreenNames.HELP);
    reload();
    return () => sdk.analytics.trackScreenExit(ScreenNames.HELP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (helpState.kind === 'error') {
      props.onNavigateToError(helpState.isNetworkError, reload);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helpState.kind]);

  const faqs = helpState.kind === 'success' ? helpState.data.faqs : null;
  const legal = helpState.kind === 'success' ? helpState.data.legal ?? null : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <DefaultAppBar
        title={label('help_title', 'Help')}
        navIcon="menu"
        onNavPress={props.onOpenDrawer}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <ListCard title={label('help_faq_section', 'How to use FarmerChat')}>
          {faqs === null ? (
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              <SkeletonBlock width="90%" height={16} />
              <SkeletonBlock width="75%" height={16} />
              <SkeletonBlock width="85%" height={16} />
            </View>
          ) : faqs.length === 0 ? (
            <View style={{ padding: spacing.lg }}>
              <Text style={[typography.body, { color: theme.textSecondary }]}>
                {label('help_faq_empty', 'No help articles available yet.')}
              </Text>
            </View>
          ) : (
            faqs.map((faq, index) => (
              <ListItem
                key={faq.id ?? index}
                icon="help"
                label={faq.question ?? faq.title ?? ''}
                onPress={() => {
                  // App parity: the FAQ link is `webview-url` (alt `webview_url`).
                  const faqUrl = faq['webview-url'] ?? faq.webview_url;
                  if (!faqUrl) return;
                  sdk.analytics.track(AnalyticsEvents.FAQ_CLICKED, {
                    question: faq.question ?? faq.title ?? '',
                  });
                  props.onOpenUrl(faqUrl, label('legal_faq', 'FAQ'));
                }}
              />
            ))
          )}
        </ListCard>

        <ListCard title={label('help_more_section', 'More')}>
          <ListItem
            icon="card"
            label={label('legal_terms', 'Terms of use')}
            onPress={() => {
              // App parity: nested terms-of-use object with its own webview-url.
              const url =
                legal?.['terms-of-use']?.['webview-url'] ??
                legal?.['terms-of-use']?.webview_url ??
                'https://digitalgreen.org/terms-of-use/';
              props.onOpenUrl(url, label('legal_terms', 'Terms of use'));
            }}
          />
          <ListItem
            icon="info"
            label={label('legal_privacy', 'Privacy policy')}
            onPress={() => {
              const url =
                legal?.['privacy-policy']?.['webview-url'] ??
                legal?.['privacy-policy']?.webview_url ??
                'https://digitalgreen.org/privacy-policy/';
              props.onOpenUrl(url, label('legal_privacy', 'Privacy policy'));
            }}
          />
        </ListCard>

        <View style={styles.footer}>
          <Text style={[typography.bodySmall, { color: theme.textTertiary }]}>
            {label('help_version', 'Version {name}', { name: SDK_VERSION })}
          </Text>
          <Text style={[typography.bodySmall, { color: theme.textTertiary }]}>
            © Digital Green
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.xl },
  footer: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
});
