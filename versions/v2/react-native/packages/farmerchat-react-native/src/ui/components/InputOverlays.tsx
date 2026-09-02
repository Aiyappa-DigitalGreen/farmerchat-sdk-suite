/**
 * User input — 1:1 port of the Compose SDK components/UserInput.kt:
 * PrimaryInputButtons (Photo/Speak/Type — Green800 rounded-16 tiles with the
 * app's green icons), TextInputOverlay (white top-rounded sheet: circular
 * camera + input pill + circular send/mic), VoiceInput sheet (Speak now +
 * waveform + trash/send circles + 30 s cap), PhotoInput sheet (Camera/Photos
 * tiles) and PermissionSettingsDialog with deny/attempt counting.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { AnalyticsEvents } from '../../core/analytics';
import { Labels } from '../../core/labels';
import { StorageKeys } from '../../core/sessionStore';
import { useLabel, useSdk, useTheme } from '../context';
import { radius, typography, dayTheme } from '../theme';
import { FcIcon } from './Icon';
import type { IconName } from '../assets';
import { PrimaryButton, SecondaryButton } from './Buttons';

export interface PickedImage {
  uri: string;
  base64: string;
}

export interface RecordedAudio {
  uri: string;
  base64: string;
  /** input_audio_encoding_format — "aac" (m4a container) on RN, docs/05 #1. */
  format: string;
}

const MAX_RECORDING_SECONDS = 30;

/** Reads a local file uri into base64 (fetch + FileReader; no expo-file-system dep). */
export async function fileUriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result ?? '');
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error('Could not read recorded file'));
    reader.readAsDataURL(blob);
  });
}

// ---------------------------------------------------------------------------
// PrimaryInputButtons — Photo / Speak / Type tiles on the brand surface
// ---------------------------------------------------------------------------

export function PrimaryInputButtons(props: {
  onPhoto: () => void;
  onSpeak: () => void;
  onType: () => void;
  showPhoto: boolean;
  showSpeak: boolean;
  variant?: 'home' | 'chat';
}): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();
  const isChat = props.variant === 'chat';
  const tileHeight = isChat ? 72 : 78;
  const padTop = isChat ? 13 : 17;
  const padBottom = isChat ? 9 : 12;

  const Tile = (p: { icon: IconName; text: string; onPress: () => void }) => (
    <Pressable
      accessibilityRole="button"
      onPress={p.onPress}
      style={({ pressed }) => [
        styles.inputTile,
        {
          height: tileHeight,
          paddingTop: padTop,
          paddingBottom: padBottom,
          backgroundColor: theme.brand.surfaceSecondary,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <FcIcon name={p.icon} size={28} tint={theme.content.buttonPrimaryAccent} />
      <Text style={[typography.labelSmall, { color: theme.brand.foregroundPrimary }]}>
        {p.text}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.inputRow,
        {
          backgroundColor: isChat
            ? theme.content.surfaceReadingPrimary
            : theme.brand.surfacePrimary,
          borderTopWidth: isChat ? 0.5 : 0,
          borderTopColor: 'rgba(0,0,0,0.1)',
        },
      ]}
    >
      {props.showPhoto ? (
        <Tile icon="camera" text={label(Labels.PHOTO, 'Photo')} onPress={props.onPhoto} />
      ) : null}
      {props.showSpeak ? (
        <Tile icon="mic" text={label(Labels.SPEAK, 'Speak')} onPress={props.onSpeak} />
      ) : null}
      <Tile icon="keyboard" text={label(Labels.TYPE, 'Type')} onPress={props.onType} />
    </View>
  );
}

/** Circular input action button — always light-mode colors (Green800 + green icon). */
export function InputActionButton(props: {
  onPress: () => void;
  icon: IconName;
  isLoading?: boolean;
  enabled?: boolean;
  size?: number;
  iconSize?: number;
  overrideBackground?: string;
  overrideTint?: string;
}): React.ReactElement {
  const size = props.size ?? 48;
  const enabled = props.enabled !== false && props.isLoading !== true;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!enabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: props.overrideBackground ?? dayTheme.content.buttonPrimarySurface,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: enabled ? (pressed ? 0.85 : 1) : 0.6,
        },
      ]}
    >
      {props.isLoading ? (
        <ActivityIndicator size="small" color={dayTheme.content.buttonPrimaryAccent} />
      ) : (
        <FcIcon
          name={props.icon}
          size={props.iconSize ?? 22}
          tint={props.overrideTint ?? dayTheme.content.buttonPrimaryAccent}
        />
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Text input overlay (white top-rounded bottom sheet)
// ---------------------------------------------------------------------------

export function TextInputOverlay(props: {
  visible: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
  onPhoto?: () => void;
  onVoice?: () => void;
  placeholder: string;
  sendLabel: string;
}): React.ReactElement | null {
  const theme = useTheme();
  const c = theme.content;
  const [text, setText] = useState('');
  useEffect(() => {
    if (!props.visible) setText('');
  }, [props.visible]);
  if (!props.visible) return null;

  const hasContent = text.trim().length > 0;
  const send = () => {
    if (!hasContent) return;
    Keyboard.dismiss();
    props.onSend(text.trim());
    setText('');
  };

  return (
    <View style={styles.overlayFill} pointerEvents="box-none">
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]}
        onPress={props.onClose}
      />
      <View
        style={[
          styles.textSheet,
          { backgroundColor: c.surfaceSecondary },
        ]}
      >
        <View style={styles.textSheetRow}>
          {!hasContent && props.onPhoto ? (
            <InputActionButton icon="camera" onPress={props.onPhoto} />
          ) : null}
          <View
            style={[
              styles.textField,
              {
                backgroundColor: c.surfacePrimary,
                borderRadius: hasContent ? radius.lg : radius.rounded,
              },
            ]}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={props.placeholder}
              placeholderTextColor={c.formPlaceholder}
              autoFocus
              multiline
              selectionColor={c.borderActive}
              style={[typography.bodyLarge, { color: c.foregroundPrimary, maxHeight: 88, padding: 0 }]}
            />
          </View>
          <InputActionButton
            icon={hasContent ? 'send' : 'mic'}
            onPress={() => {
              if (hasContent) {
                send();
              } else if (props.onVoice) {
                Keyboard.dismiss();
                props.onVoice();
              }
            }}
          />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Voice input sheet — expo-av recording (m4a/AAC), 30 s cap, waveform
// ---------------------------------------------------------------------------

export function VoiceInputOverlay(props: {
  visible: boolean;
  onSend: (audio: RecordedAudio) => void;
  onClose: () => void;
  onPermissionPermanentlyDenied: () => void;
}): React.ReactElement | null {
  const theme = useTheme();
  const c = theme.content;
  const sdk = useSdk();
  const label = useLabel();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bars = useRef(
    Array.from({ length: 36 }, () => 0.15 + Math.random() * 0.85),
  ).current;

  const cleanup = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        // already stopped
      }
    }
    setIsRecording(false);
    setIsProcessing(false);
    setElapsedSec(0);
  }, []);

  const handleSend = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    setIsProcessing(true);
    sdk.analytics.track(AnalyticsEvents.SEND_RECORD_AUDIO_CLICK_EVENT, {});
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      if (!uri) throw new Error('no uri');
      const base64 = await fileUriToBase64(uri);
      setIsProcessing(false);
      props.onSend({ uri, base64, format: 'aac' });
    } catch {
      sdk.analytics.track(AnalyticsEvents.INPUT_CAPTURE_FAILED, { input: 'voice' });
      setIsProcessing(false);
      setError(label(Labels.FAILED_TO_START_RECORDING, 'Failed to start recording'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, props.onSend]);

  const start = useCallback(async () => {
    setError(null);
    sdk.store.set(
      StorageKeys.MIC_PERMISSION_ATTEMPT_COUNT,
      sdk.store.getInt(StorageKeys.MIC_PERMISSION_ATTEMPT_COUNT) + 1,
    );
    const permission = await Audio.requestPermissionsAsync();
    if (permission.status !== 'granted') {
      sdk.analytics.track(AnalyticsEvents.PERMISSION_DENIED, {
        permission_type: 'Microphone',
      });
      const denyCount = sdk.store.getInt(StorageKeys.MIC_PERMISSION_DENY_COUNT) + 1;
      sdk.store.set(StorageKeys.MIC_PERMISSION_DENY_COUNT, denyCount);
      if (denyCount >= 2 || permission.canAskAgain === false) {
        props.onPermissionPermanentlyDenied();
      }
      props.onClose();
      return;
    }
    sdk.analytics.track(AnalyticsEvents.PERMISSION_GRANTED, {
      permission_type: 'Microphone',
    });
    sdk.store.set(StorageKeys.MIC_PERMISSION_DENY_COUNT, 0);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setElapsedSec(0);
      timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    } catch {
      sdk.analytics.track(AnalyticsEvents.INPUT_CAPTURE_FAILED, { input: 'voice' });
      setError(label(Labels.FAILED_TO_START_RECORDING, 'Failed to start recording'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, props]);

  useEffect(() => {
    if (props.visible) {
      void start();
    } else {
      void cleanup();
    }
    return () => {
      void cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visible]);

  // 30 s cap → auto send
  useEffect(() => {
    if (isRecording && elapsedSec >= MAX_RECORDING_SECONDS) {
      void handleSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, isRecording]);

  if (!props.visible) return null;

  const handleCancel = () => {
    sdk.analytics.track(AnalyticsEvents.CANCEL_RECORD_AUDIO_CLICK_EVENT, {});
    void cleanup();
    props.onClose();
  };

  const secondsRemaining = Math.max(0, MAX_RECORDING_SECONDS - elapsedSec);
  const progress = elapsedSec / MAX_RECORDING_SECONDS;
  const activeBarCount = Math.round(progress * bars.length);

  return (
    <View style={styles.overlayFill} pointerEvents="box-none">
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]}
        onPress={handleCancel}
      />
      <View style={[styles.voiceSheet, { backgroundColor: c.surfaceSecondary }]}>
        <Text
          style={[
            typography.titleLarge,
            { color: c.foregroundPrimary, textAlign: 'center' },
          ]}
        >
          {isProcessing
            ? label(Labels.PROCESSING, 'Processing...')
            : label(Labels.LISTENING, 'Speak now')}
        </Text>
        <Text
          style={[
            typography.bodyLarge,
            { color: c.foregroundPrimary, textAlign: 'center', marginTop: 8 },
          ]}
        >
          {isProcessing
            ? label(Labels.ONE_SECOND_PLEASE, 'One second, please...')
            : label(Labels.ASK_YOUR_FARMING_QUESTION, 'Ask about your farm or livestock')}
        </Text>
        {error ? (
          <Text
            style={[
              typography.bodySmall,
              { color: theme.brand.feedbackFail, textAlign: 'center', marginTop: 12 },
            ]}
          >
            {error}
          </Text>
        ) : null}

        <View style={styles.voiceRow}>
          <InputActionButton icon="trash" iconSize={26} onPress={handleCancel} />
          <View style={[styles.voiceClip, { backgroundColor: c.surfacePrimary }]}>
            <View style={styles.voiceBars}>
              {bars.map((amp, i) => (
                <View
                  key={i}
                  style={{
                    width: 3,
                    height: Math.max(6, Math.min(30, amp * 30)),
                    borderRadius: 8,
                    backgroundColor:
                      isRecording && i < activeBarCount
                        ? c.buttonPrimaryAccent
                        : c.foregroundTertiary,
                  }}
                />
              ))}
            </View>
            <Text style={[typography.labelSmall, { color: c.foregroundSecondary }]}>
              0:{String(secondsRemaining).padStart(2, '0')}
            </Text>
          </View>
          <InputActionButton
            icon="send"
            onPress={() => void handleSend()}
            isLoading={isProcessing}
            enabled={isRecording && elapsedSec > 0}
          />
        </View>

        <View style={styles.voiceHint}>
          <FcIcon name="info" size={20} tint={c.borderActive} />
          <Text
            numberOfLines={1}
            style={[typography.bodySmall, { color: c.foregroundSecondary }]}
          >
            {label(Labels.VOICE_INPUT_IS_STILL_IMPROVING, 'Keep background noise low')}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Photo input — Camera / Photos tiles (expo-image-picker)
// ---------------------------------------------------------------------------

export function PhotoInputSheet(props: {
  visible: boolean;
  onPicked: (image: PickedImage) => void;
  onClose: () => void;
  onPermissionPermanentlyDenied: () => void;
}): React.ReactElement | null {
  const theme = useTheme();
  const c = theme.content;
  const sdk = useSdk();
  const label = useLabel();

  if (!props.visible) return null;

  const handleResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) {
      props.onClose();
      return;
    }
    const asset = result.assets[0];
    if (!asset || !asset.base64) {
      sdk.analytics.track(AnalyticsEvents.INPUT_CAPTURE_FAILED, { input: 'image' });
      props.onClose();
      return;
    }
    props.onPicked({ uri: asset.uri, base64: asset.base64 });
  };

  const openCamera = async () => {
    sdk.analytics.track(AnalyticsEvents.IMAGE_OPTION_DIALOG_CLICK_EVENT, {
      option: 'camera',
    });
    sdk.store.set(
      StorageKeys.CAMERA_PERMISSION_ATTEMPT_COUNT,
      sdk.store.getInt(StorageKeys.CAMERA_PERMISSION_ATTEMPT_COUNT) + 1,
    );
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      sdk.analytics.track(AnalyticsEvents.PERMISSION_DENIED, {
        permission_type: 'Camera',
      });
      const denyCount = sdk.store.getInt(StorageKeys.CAMERA_PERMISSION_DENY_COUNT) + 1;
      sdk.store.set(StorageKeys.CAMERA_PERMISSION_DENY_COUNT, denyCount);
      if (denyCount >= 2 || permission.canAskAgain === false) {
        props.onPermissionPermanentlyDenied();
      }
      props.onClose();
      return;
    }
    sdk.analytics.track(AnalyticsEvents.PERMISSION_GRANTED, { permission_type: 'Camera' });
    sdk.store.set(StorageKeys.CAMERA_PERMISSION_DENY_COUNT, 0);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      });
      handleResult(result);
    } catch {
      sdk.analytics.track(AnalyticsEvents.INPUT_CAPTURE_FAILED, { input: 'image' });
      props.onClose();
    }
  };

  const openGallery = async () => {
    sdk.analytics.track(AnalyticsEvents.IMAGE_OPTION_DIALOG_CLICK_EVENT, {
      option: 'gallery',
    });
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
      });
      handleResult(result);
    } catch {
      sdk.analytics.track(AnalyticsEvents.INPUT_CAPTURE_FAILED, { input: 'image' });
      props.onClose();
    }
  };

  const Tile = (p: { icon: IconName; text: string; onPress: () => void }) => (
    <Pressable
      accessibilityRole="button"
      onPress={p.onPress}
      style={({ pressed }) => [
        styles.photoTile,
        { backgroundColor: c.surfaceTertiary, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <FcIcon name={p.icon} size={32} tint={c.foregroundPrimary} />
      <Text style={[typography.labelMedium, { color: c.foregroundSecondary, marginTop: 8 }]}>
        {p.text}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.overlayFill} pointerEvents="box-none">
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]}
        onPress={props.onClose}
      />
      <View style={[styles.photoSheet, { backgroundColor: c.surfaceSecondary }]}>
        <View style={styles.photoTiles}>
          <Tile
            icon="camera"
            text={label(Labels.CAMERA, 'Camera')}
            onPress={() => void openCamera()}
          />
          <Tile
            icon="gallery"
            text={label(Labels.PHOTOS, 'Photos')}
            onPress={() => void openGallery()}
          />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PermissionSettingsDialog — shown after 2 denials
// ---------------------------------------------------------------------------

export function PermissionSettingsDialog(props: {
  visible: boolean;
  permission: 'camera' | 'microphone' | 'location';
  onDismiss: () => void;
}): React.ReactElement | null {
  const theme = useTheme();
  const c = theme.content;
  const sdk = useSdk();
  const label = useLabel();
  useEffect(() => {
    if (props.visible) {
      sdk.analytics.track(AnalyticsEvents.PERMISSION_FALLBACK_DEFAULT_SETTING_SHOWN, {
        permission_type: props.permission,
      });
    }
  }, [props.permission, props.visible, sdk]);
  if (!props.visible) return null;
  const title =
    props.permission === 'microphone'
      ? label(Labels.MICROPHONE_PERMISSION_REQUIRED, 'Microphone permission required')
      : label(Labels.CAMERA_PERMISSION_REQUIRED, 'Camera permission required');
  return (
    <Modal transparent animationType="fade" onRequestClose={props.onDismiss}>
      <View style={[styles.modalBackdrop, { backgroundColor: c.scrim }]}>
        <View style={[styles.dialog, { backgroundColor: c.surfaceSecondary }]}>
          <Text style={[typography.titleMedium, { color: c.foregroundPrimary }]}>
            {title}
          </Text>
          <Text style={[typography.bodyMedium, { color: c.foregroundSecondary }]}>
            {label(
              Labels.THIS_FUNCTION_REQUIRED_ENABLE_IN_DEVICE_SETTINGS,
              'This permission is needed for the app to function properly. Please enable it in your device settings.',
            )}
          </Text>
          <PrimaryButton
            label={label(Labels.GO_TO_SETTINGS, 'Go to settings')}
            onPress={() => {
              sdk.analytics.track(
                AnalyticsEvents.PERMISSION_FALLBACK_DEFAULT_SETTING_CLICKED,
                { permission_type: props.permission },
              );
              void Linking.openSettings();
              props.onDismiss();
            }}
          />
          <SecondaryButton
            label={label(Labels.CANCEL, 'Cancel')}
            onPress={() => {
              sdk.analytics.track(
                AnalyticsEvents.PERMISSION_FALLBACK_DEFAULT_SETTING_CANCELED,
                { permission_type: props.permission },
              );
              props.onDismiss();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  inputTile: {
    flex: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  overlayFill: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  textSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
  },
  textSheetRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  textField: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  voiceSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 8,
    paddingTop: 48,
    paddingBottom: 24,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    marginTop: 32,
  },
  voiceClip: {
    flex: 1,
    height: 50,
    borderRadius: radius.rounded,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  voiceBars: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 32,
    marginBottom: 8,
  },
  photoSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 12,
    paddingTop: 24,
    paddingBottom: 16,
  },
  photoTiles: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 8,
  },
  photoTile: {
    flex: 1,
    height: 168,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    alignSelf: 'stretch',
    borderRadius: radius.xxl,
    padding: 24,
    gap: 16,
  },
});
