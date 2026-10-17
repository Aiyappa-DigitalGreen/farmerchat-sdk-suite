/**
 * <FarmerChatFab/> — drop-in floating launcher (docs/04 row 52). Renders a
 * pinned circular (or extended) button that, on press, reveals the full
 * FarmerChat journey in an absolute-fill overlay. Unlike a bare `openChat()` call
 * this mounts the SDK view, so it works from a host screen that never renders
 * <FarmerChatView/> itself. Needs only a prior `FarmerChat.initialize(config)`.
 *
 * Why an overlay and not an RN `<Modal>`: a Modal is a separate native window, and on the new
 * architecture react-native-screens' native stack inside it throws "ScreenContainer is not
 * attached under ReactRootView" (blank chat). The overlay stays in the host's root view. It
 * fills the FAB's parent, so place `<FarmerChatFab/>` in a full-screen container (e.g. the
 * app root), as you would any floating button.
 */
import React from 'react';
import {
  BackHandler,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { FarmerChat } from './FarmerChat';
import { FarmerChatView } from './FarmerChatView';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  emitSdkExit,
  onFallbackCloseSlot,
  onScreenHasOwnExit,
  onSdkExit,
  type FallbackCloseSlot,
} from './core/exitSignal';
import { Assets } from './ui/assets';
import { brandLogo, dayTheme } from './ui/theme';

export interface FarmerChatFabProps {
  /** Deep-link straight into a chat asking this question; when omitted the full journey opens. */
  question?: string;
  /** Render as an extended launcher with this text beside the mark. Defaults to `config.fabLabel`. */
  label?: string;
  /** Corner to pin the launcher to (default 'bottom-right'). */
  position?: 'bottom-right' | 'bottom-left';
  /** Override the launcher background (else `config.fabBackgroundColor`, else host brand). */
  backgroundColor?: string;
  /** Override the icon/label color (else `config.fabContentColor`, else on-brand). */
  contentColor?: string;
  /** Custom launcher icon; overrides the FarmerChat logo mark (rendered untinted). */
  icon?: ImageSourcePropType;
}

/** Config-level FAB defaults, read outside the provider (safe before/without init). */
function fabConfigDefaults(): { label?: string; bg?: string; fg?: string } {
  if (!FarmerChat.isInitialized) return {};
  const c = FarmerChat.getInstance().config;
  return {
    label: c.fabLabel ?? undefined,
    bg: c.fabBackgroundColor ?? undefined,
    fg: c.fabContentColor ?? undefined,
  };
}

export function FarmerChatFab(props: FarmerChatFabProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const openRef = React.useRef(false);
  openRef.current = open;
  // The chat's own Close (CHAT_ONLY) fires the SDK exit: dismiss the overlay it lives in.
  React.useEffect(() => onSdkExit(() => setOpen(false)), []);
  // Fallback close only where the visible screen has no exit of its own (route-driven).
  const [screenHasOwnExit, setScreenHasOwnExit] = React.useState(false);
  React.useEffect(() => onScreenHasOwnExit(setScreenHasOwnExit), []);
  const [closeSlot, setCloseSlot] = React.useState<FallbackCloseSlot>('right');
  // The ✕ column ends just under the button (inset + 8 + 40); 120 until the inset is measured.
  const [closeColumnHeight, setCloseColumnHeight] = React.useState(120);
  React.useEffect(() => onFallbackCloseSlot(setCloseSlot), []);
  const showFallbackClose = !screenHasOwnExit;
  // Android hardware back. Registered ONCE, when the FAB mounts, i.e. before the overlay's
  // NavigationContainer registers its own listener. BackHandler calls the newest listener first,
  // so the SDK's navigation (and any SDK screen handler) pops its stack first; only when it has
  // nothing left to pop does this run: close the overlay and fire `onExit`, as the old Modal's
  // onRequestClose closed it. Closed overlay: return false so the host's back runs.
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!openRef.current) return false;
      exitOverlay();
      return true;
    });
    return () => sub.remove();
  }, []);
  const defaults = fabConfigDefaults();
  // Precedence: per-instance prop → config default → theme brand.
  const bg = props.backgroundColor ?? defaults.bg ?? dayTheme.brandPrimary;
  const fg = props.contentColor ?? defaults.fg ?? dayTheme.textOnBrand;
  const label = props.label ?? defaults.label;
  const hostLogo = brandLogo;
  const iconSource = props.icon ?? hostLogo ?? Assets.logoMark;
  const iconIsCustom = props.icon != null || hostLogo != null;


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
          label ? styles.fabExtended : styles.fabRound,
        ]}
      >
        <Image
          source={iconSource}
          resizeMode="contain"
          style={[styles.icon, { tintColor: iconIsCustom ? undefined : fg }]}
        />
        {label ? (
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        ) : null}
      </Pressable>

      {open ? (
        // Above the host content and the launcher: zIndex (iOS / layout order) + elevation
        // (Android draws higher elevation on top). FarmerChatView brings its own
        // SafeAreaProvider, so every SDK screen pads for the status bar and nav bar itself.
        <View style={styles.overlay}>
          <FarmerChatView />
          {showFallbackClose && closeSlot !== 'hidden' ? (
            // Home, language and onboarding have no exit of their own (and iOS has no system
            // Back), so the overlay keeps its fallback close there. The CHAT_ONLY chat draws its
            // own ✕; a second one would cover the globe button (iOS FAB fix, b26efcb).
            // Its own SafeAreaProvider: the live top inset keeps the ✕ on the app-bar row even
            // after a display-size / density change (scenario F3), which the status-bar height constant
            // (a startup constant) does not follow.
            // The provider is sized to the ✕ column only: a native SafeAreaProvider ignores
            // pointerEvents on Android, so a full-screen one swallowed every tap and scroll.
            <SafeAreaProvider
              style={[
                styles.closeColumn,
                { height: closeColumnHeight },
                closeSlot === 'left' ? { left: FALLBACK_CLOSE_LEFT_HOME } : { right: 16 },
              ]}
            >
              <FallbackClose onTop={(top) => setCloseColumnHeight(top + FALLBACK_CLOSE_SIZE)} />
            </SafeAreaProvider>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

/**
 * Overlay back / dismissal: fire the host's `onExit` (C4) — which also emits the internal exit
 * signal that closes this overlay — without the SDK being initialized being a crash.
 */
function exitOverlay(): void {
  if (FarmerChat.isInitialized) {
    FarmerChat.getInstance().analytics.fireCallback('onExit');
  } else {
    emitSdkExit();
  }
}

/** Fallback ✕ button size. */
const FALLBACK_CLOSE_SIZE = 40;

/** Home: after the 42dp menu button at 16dp (Chrome HomeAppBar). */
const FALLBACK_CLOSE_LEFT_HOME = 70;

/**
 * On the app-bar row, just below the live safe-area top (status bar / Dynamic Island). iOS used a
 * fixed 44, which sat ~20pt above the bar row on notch / Dynamic Island phones (scenario F3 iOS).
 */
function FallbackClose(props: { onTop: (top: number) => void }): React.ReactElement {
  const insets = useSafeAreaInsets();
  const top = insets.top + 8;
  const { onTop } = props;
  // Shrink the provider column to the button so no content under the bar is a dead zone.
  React.useEffect(() => onTop(top), [onTop, top]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close FarmerChat"
      onPress={exitOverlay}
      style={[styles.close, { top, left: 0 }]}
    >
      <Text style={styles.closeText}>✕</Text>
    </Pressable>
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: '#FFFFFF',
  },
  // Home: clear of the weather pill, in the gap after the menu button; elsewhere top-right.
  // Tall enough for any status bar + 8 + the 40dp button; nothing interactive sits under it.
  closeColumn: { position: 'absolute', top: 0, width: FALLBACK_CLOSE_SIZE },
  close: {
    position: 'absolute',
    width: FALLBACK_CLOSE_SIZE,
    height: FALLBACK_CLOSE_SIZE,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  closeText: { color: '#ffffff', fontSize: 18, lineHeight: 20 },
});
