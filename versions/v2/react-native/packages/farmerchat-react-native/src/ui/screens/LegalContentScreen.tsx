/**
 * LegalContent (dialog route) — WebView with Close app bar + loading spinner
 * (docs/01 §3.17, PolicyWebViewScreen). Falls back to the external browser
 * when react-native-webview is not installed (optional peer).
 */
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnalyticsEvents } from '../../core/analytics';
import { useLabel, useSdk, useTheme } from '../context';
import { DefaultAppBar, LogoSpinner } from '../components/Chrome';
import { PrimaryButton } from '../components/Buttons';
import { getWebViewModule } from '../components/optionalModules';
import { spacing, typography } from '../theme';

export function LegalContentScreen(props: {
  url: string;
  title: string;
  onClose: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const sdk = useSdk();
  const label = useLabel();
  const [isLoading, setIsLoading] = useState(true);
  const webView = getWebViewModule();

  // `faq_terms` toggles the title to "FAQ" (docs/01 §3.17)
  const title = props.url.includes('faq_terms') ? label('fc_v2_app_label_faq', 'FAQ') : props.title;

  useEffect(() => {
    const lower = `${props.url} ${props.title}`.toLowerCase();
    if (lower.includes('privacy')) {
      sdk.analytics.track(AnalyticsEvents.PRIVACY_POLICY_OPENED, { url: props.url });
    } else if (lower.includes('terms')) {
      sdk.analytics.track(AnalyticsEvents.TERMS_OF_USE_OPENED, { url: props.url });
    }
  }, [props.title, props.url, sdk]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <DefaultAppBar title={title} navIcon="close" onNavPress={props.onClose} />
      {webView ? (
        <View style={{ flex: 1 }}>
          <webView.WebView
            source={{ uri: props.url }}
            javaScriptEnabled
            onLoadEnd={() => setIsLoading(false)}
            style={{ flex: 1, backgroundColor: theme.background }}
          />
          {isLoading ? (
            <View style={[styles.loading, { backgroundColor: theme.background }]}>
              <LogoSpinner message={label('fc_v2_app_label_loading', 'Loading…')} />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.fallback}>
          <Text style={[typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>
            {label(
              'legal_open_external',
              'This page will open in your browser.',
            )}
          </Text>
          <PrimaryButton
            label={label('legal_open_browser', 'Open in browser')}
            onPress={() => void Linking.openURL(props.url)}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
});
