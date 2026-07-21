/**
 * <FarmerChatInlineView/> (docs/07 Part C — C1) — the full FarmerChat journey
 * as a host-placeable component that fills ITS CONTAINER rather than the whole
 * screen. Identical behavior to <FarmerChatView/>, but the host controls size
 * via the `style` prop (e.g. a fixed-height card, a tab panel, a split view).
 *
 * The host must give the container a size (height/flex); with no size the
 * embedded journey collapses, exactly like any other flex child.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FarmerChat } from './FarmerChat';
import { FarmerChatProvider } from './FarmerChatProvider';
import { AppNavGraph } from './ui/navigation/AppNavGraph';

export function FarmerChatInlineView(props: {
  /** Container style — the host sizes/positions the embedded view. */
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const content = (
    <GestureHandlerRootView style={[styles.fill, props.style]}>
      <SafeAreaProvider>
        <View style={styles.fill}>
          <AppNavGraph />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  // Standalone usage when the host called FarmerChat.initialize() imperatively.
  if (FarmerChat.isInitialized) {
    return <FarmerChatProvider>{content}</FarmerChatProvider>;
  }
  return content;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
