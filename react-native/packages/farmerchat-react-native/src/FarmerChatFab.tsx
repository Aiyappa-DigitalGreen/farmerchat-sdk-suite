/**
 * <FarmerChatFab/> — drop-in floating launcher (docs/04 row 52). Renders a
 * pinned circular (or extended) button that, on press, reveals the full
 * FarmerChat journey in a full-screen Modal. Unlike a bare `openChat()` call
 * this mounts the SDK view, so it works from a host screen that never renders
 * <FarmerChatView/> itself. Needs only a prior `FarmerChat.initialize(config)`.
 */
import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FarmerChat } from './FarmerChat';
import { FarmerChatView } from './FarmerChatView';
import { Assets } from './ui/assets';
import { brandLogo, dayTheme } from './ui/theme';

export interface FarmerChatFabProps {
  /** Deep-link straight into a chat asking this question; when omitted the full journey opens. */
  question?: string;
  /** Render as an extended launcher with this text beside the mark. */
  label?: string;
  /** Corner to pin the launcher to (default 'bottom-right'). */
  position?: 'bottom-right' | 'bottom-left';
  /** Override the launcher background (defaults to the resolved host brand color). */
  backgroundColor?: string;
  /** Override the icon/label color (defaults to the resolved on-brand color). */
  contentColor?: string;
}

export function FarmerChatFab(props: FarmerChatFabProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const bg = props.backgroundColor ?? dayTheme.brandPrimary;
  const fg = props.contentColor ?? dayTheme.textOnBrand;
  const hostLogo = brandLogo;

  const onPress = () => {
    setOpen(true);
    // Queues a pending target consumed the moment the revealed view mounts.
    if (props.question) FarmerChat.openChat(props.question);
  };

  const sidePin =
    props.position === 'bottom-left' ? { left: 20 } : { right: 20 };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open FarmerChat"
        onPress={onPress}
        style={[
          styles.fab,
          sidePin,
          { backgroundColor: bg },
          props.label ? styles.fabExtended : styles.fabRound,
        ]}
      >
        <Image
          source={hostLogo ?? Assets.logoMark}
          resizeMode="contain"
          style={[styles.icon, { tintColor: hostLogo ? undefined : fg }]}
        />
        {props.label ? (
          <Text style={[styles.label, { color: fg }]}>{props.label}</Text>
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        presentationStyle="fullScreen"
      >
        <View style={styles.modalRoot}>
          <FarmerChatView />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close FarmerChat"
            onPress={() => setOpen(false)}
            style={styles.close}
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 20,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabRound: { width: 56 },
  fabExtended: { paddingHorizontal: 22, columnGap: 10 },
  icon: { width: 26, height: 26 },
  label: { fontSize: 15, fontWeight: '600' },
  modalRoot: { flex: 1 },
  close: {
    position: 'absolute',
    top: 44,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeText: { color: '#ffffff', fontSize: 18, lineHeight: 20 },
});
