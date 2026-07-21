/**
 * <FarmerChatView/> — the full-screen FarmerChat journey (docs/03 §Shared
 * public surface): bootstrap(splash) → language → name → home → chat/history →
 * settings, with OTP auth reachable from drawer/settings. Must be rendered
 * inside <FarmerChatProvider> (or with FarmerChat.initialize() called first).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FarmerChat } from './FarmerChat';
import { FarmerChatProvider } from './FarmerChatProvider';
import { AppNavGraph } from './ui/navigation/AppNavGraph';

export function FarmerChatView(): React.ReactElement {
  const content = (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={styles.root}>
          <AppNavGraph />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  // Allow standalone usage without an explicit provider when the host called
  // FarmerChat.initialize() imperatively.
  if (FarmerChat.isInitialized) {
    return <FarmerChatProvider>{content}</FarmerChatProvider>;
  }
  return content;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
