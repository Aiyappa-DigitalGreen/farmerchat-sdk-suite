/**
 * TermsOfUseDialog — port of the Compose SDK `components/TermsOfUseDialog.kt` (2.0.0).
 *
 * Full-screen in-app dialog that renders a Terms-of-Use / policy `url` in a WebView, with an
 * "Accept and continue" button pinned to the bottom. Used on Home when the host asks for the
 * terms surface; the URL comes from the cached `farmerchatTermsOfUse` (HomeState, endpoint #4).
 *
 * Analytics: the app tracks a Plotline ToS event on accept. The SDK never calls the app's
 * AnalyticsManager (root CLAUDE.md §6 bans third-party analytics inside SDK packages), so this
 * is a plain `onAcceptAndContinue` host callback — the caller owns tracking, exactly as in the
 * Compose reference.
 *
 * Deviations from the Compose reference (deliberate):
 *  - **Optional WebView.** `react-native-webview` is an optional peer (see
 *    `ui/components/optionalModules.ts`). When it is absent the dialog offers the same
 *    external-browser fallback `LegalContentScreen` uses, and the accept action stays available
 *    so the farmer is never stuck.
 *  - **`Modal`, not `Dialog(usePlatformDefaultWidth = false)`.** RN's full-screen equivalent;
 *    `onRequestClose` carries the Android back gesture that Compose's `onDismissRequest` does.
 */
import React, { useState } from 'react';
import { Linking, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Labels } from '../../core/labels';
import { useLabel, useTheme } from '../context';
import { PrimaryButton } from './Buttons';
import { DefaultAppBar, LogoSpinnerVertical } from './Chrome';
import { getWebViewModule } from './optionalModules';
import { spacing, typography, White } from '../theme';

export function TermsOfUseDialog(props: {
  visible: boolean;
  /** Terms-of-use URL to load (the caller ensures it is non-blank). */
  url: string;
  /** Dialog header title. */
  title: string;
  /** Called when the user closes the dialog (back gesture or the X). */
  onDismiss: () => void;
  /** Called when the user taps "Accept and continue". */
  onAcceptAndContinue: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const webView = getWebViewModule();

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={props.onDismiss}
      statusBarTranslucent
    >
      <View style={[styles.root, { backgroundColor: theme.brand.surfacePrimary }]}>
        {/* Shared app bar: close button on the left, centered white title on the green brand
            bar (it handles the status-bar inset itself). */}
        <DefaultAppBar
          title={props.title}
          navIcon="close"
          onNavPress={props.onDismiss}
          showGlow={false}
        />

        <View style={styles.body}>
          {webView ? (
            <>
              <webView.WebView
                source={{ uri: props.url }}
                javaScriptEnabled
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={() => setIsLoading(false)}
                style={styles.webView}
              />
              {isLoading ? (
                <View style={styles.loadingOverlay}>
                  <LogoSpinnerVertical message={label(Labels.LOADING, 'Loading...')} />
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.fallback}>
              <Text
                style={[typography.body, { color: theme.textSecondary, textAlign: 'center' }]}
              >
                {label('legal_open_external', 'This page will open in your browser.')}
              </Text>
              <PrimaryButton
                label={label('legal_open_browser', 'Open in browser')}
                onPress={() => void Linking.openURL(props.url)}
              />
            </View>
          )}
        </View>

        {/* Bottom action bar: an elevated footer surface lifts the accept button above the
            scrolling terms content with a soft top shadow. */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.brand.surfacePrimary,
              paddingBottom: 12 + insets.bottom,
            },
          ]}
        >
          <PrimaryButton
            label={label(Labels.ACCEPT_AND_CONTINUE, 'Accept and continue')}
            state="Chevron"
            height={54}
            onPress={props.onAcceptAndContinue}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, width: '100%' },
  // Compose sets the WebView's own background to white so a page that paints no background
  // does not show the green brand surface through it.
  webView: { flex: 1, backgroundColor: White },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: White,
    alignItems: 'center',
    // Compose: `contentAlignment = Alignment.TopCenter` with a 24dp top pad.
    justifyContent: 'flex-start',
    paddingTop: 24,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
    backgroundColor: White,
  },
  footer: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 12,
    // Compose `shadowElevation = 12.dp`.
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
});
