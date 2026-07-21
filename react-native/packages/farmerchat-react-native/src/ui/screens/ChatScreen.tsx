/**
 * Chat (docs/01 §3.8) — thread with markdown answers, follow-up chips,
 * clarification label, voice-clip bubbles, Listen TTS, image queries,
 * share/download answer card, retry, history pagination with position
 * restore, input overlays. Initialization picks exactly one of:
 * LoadChatHistory / InitializeVoicePrototype / InitializeWithPreGeneratedContent /
 * SendQuestionWithImage / InitializeWithQuestion.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { AnalyticsEvents, ScreenNames } from '../../core/analytics';
import { useLabel, useSdk, useTheme } from '../context';
import {
  deriveChatUiState,
  useChat,
  type AiResponse,
  type ChatMessage,
  type UserMessage,
} from '../../state/useChat';
import { PrimaryButton, ScrollToBottomButton } from '../components/Buttons';
import { SuggestedCard } from '../components/Cards';
import { AiAnswerBlock, ThinkingIndicator } from '../components/AiAnswer';
import { LogoAppBar, LogoSpinner, Toast, useToastState } from '../components/Chrome';
import {
  fileUriToBase64,
  PermissionSettingsDialog,
  PhotoInputSheet,
  PrimaryInputButtons,
  TextInputOverlay,
  VoiceInputOverlay,
  type PickedImage,
  type RecordedAudio,
} from '../components/InputOverlays';
import { useShareCard } from '../components/ShareCard';
import { stopAllVoiceClips, VoiceClip } from '../components/VoiceClip';
import { FcIcon } from '../components/Icon';
import type { ChatRouteParams } from '../navigation/types';
import { radius, spacing, typography } from '../theme';

export function ChatScreen(props: {
  params: ChatRouteParams;
  onClose: () => void;
  onOpenDrawer: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const sdk = useSdk();
  const label = useLabel();
  const { state, onAction } = useChat(sdk);
  const { toast, showToast } = useToastState();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [textInputVisible, setTextInputVisible] = useState(false);
  const [voiceInputVisible, setVoiceInputVisible] = useState(false);
  const [photoInputVisible, setPhotoInputVisible] = useState(false);
  const [permissionDialog, setPermissionDialog] = useState<'camera' | 'microphone' | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const isHistoryEntry = props.params.source === 'history';

  // --- reveal tracking (pure UI, docs/01 §3.8 preserved) ----------------------
  // Which AI answers have finished the client-side typewriter reveal. This is
  // purely presentational: it gates the fade-in of the action row + follow-ups
  // and never touches useChat / the network. A Set guard keeps markRevealed
  // idempotent so re-renders during scroll can't restart or blank an answer.
  const [revealedIds, setRevealedIds] = useState<ReadonlySet<string>>(() => new Set());
  const markRevealed = useCallback((id: string) => {
    setRevealedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  // --- initialization (exactly one action — docs/01 §3.8) ---------------------
  useEffect(() => {
    sdk.analytics.trackScreenView(ScreenNames.CHAT, { source: props.params.source ?? 'home' });
    const p = props.params;
    const init = async () => {
      if (p.conversationId) {
        onAction({ type: 'LoadChatHistory', conversationId: p.conversationId, page: 1 });
      } else if (p.audioUri && !p.question) {
        try {
          const base64 = await fileUriToBase64(p.audioUri);
          onAction({
            type: 'InitializeVoicePrototype',
            audioUri: p.audioUri,
            audioBase64: base64,
            audioFormat: 'aac',
            originScreenName: p.source ?? 'home',
          });
        } catch {
          showToast(label('chat_error_generic', 'Something went wrong. Please try again.'), 'error');
        }
      } else if (p.preGeneratedAnswer !== undefined && p.preGeneratedAnswer !== null) {
        onAction({
          type: 'InitializeWithPreGeneratedContent',
          question: p.question ?? '',
          answer: p.preGeneratedAnswer,
          followUpQuestions: p.follow_up_questions ?? null,
          homeStatementId: p.homeStatementId ?? null,
          userMessageImageUri: p.imageUri ?? null,
        });
      } else if (p.imageUri) {
        try {
          const base64 = await fileUriToBase64(p.imageUri);
          onAction({
            type: 'SendQuestionWithImage',
            question: p.question ?? '',
            imageUri: p.imageUri,
            imageBase64: base64,
          });
        } catch {
          showToast(label('chat_error_generic', 'Something went wrong. Please try again.'), 'error');
        }
      } else if (p.question) {
        onAction({
          type: 'InitializeWithQuestion',
          question: p.question,
          transcriptionId: p.transcriptionId ?? null,
          audioUri: p.audioUri ?? null,
          originScreenName: p.source ?? 'home',
          isWeatherAdviceCTA: p.isWeatherAdviceCTA === true,
          isSSFR: p.isSSFR === true,
          ssfrCrop: p.ssfrCrop ?? null,
          channel: p.channel ?? null,
          statementId: p.statementId ?? null,
        });
      }
    };
    void init();
    return () => {
      sdk.analytics.trackScreenExit(ScreenNames.CHAT);
      onAction({ type: 'ClearMessages' });
      void stopAllVoiceClips();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- TTS playback (expo-av) ---------------------------------------------------
  const ttsSound = useRef<Audio.Sound | null>(null);
  useEffect(() => {
    const url = state.audioPlaybackUrl;
    if (!url) return;
    let cancelled = false;
    const play = async () => {
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
          (status: AVPlaybackStatus) => {
            if (status.isLoaded && status.didJustFinish) {
              onAction({ type: 'SetAudioPlaying', isPlaying: false });
              onAction({ type: 'ClearAudioPlaybackUrl' });
            }
          },
        );
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        ttsSound.current = sound;
        onAction({ type: 'SetAudioPlaying', isPlaying: true });
      } catch {
        onAction({ type: 'ClearAudioPlaybackUrl' });
      }
    };
    void play();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.audioPlaybackUrl]);

  useEffect(
    () => () => {
      const sound = ttsSound.current;
      ttsSound.current = null;
      if (sound) void sound.unloadAsync().catch(() => undefined);
    },
    [],
  );

  const toggleListen = useCallback(() => {
    if (state.isAudioPlaying && ttsSound.current) {
      void ttsSound.current.pauseAsync();
      onAction({ type: 'SetAudioPlaying', isPlaying: false });
    } else if (state.audioPlaybackUrl && ttsSound.current) {
      void ttsSound.current.playAsync();
      onAction({ type: 'SetAudioPlaying', isPlaying: true });
    } else {
      onAction({ type: 'SynthesiseAudio' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isAudioPlaying, state.audioPlaybackUrl]);

  // --- history pagination: load-more when scrolled to top, position kept by
  //     maintainVisibleContentPosition (docs/01 §3.8) --------------------------
  const onScrollNearTop = useCallback(() => {
    if (isHistoryEntry && state.historyNextPage !== null && !state.isLoadingMoreHistory) {
      onAction({
        type: 'LoadChatHistory',
        conversationId: props.params.conversationId ?? '',
        page: state.historyNextPage,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHistoryEntry, state.historyNextPage, state.isLoadingMoreHistory]);

  // one-time scroll-to-bottom on isInitialHistoryLoaded
  useEffect(() => {
    if (state.isInitialHistoryLoaded) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
    }
  }, [state.isInitialHistoryLoaded]);

  // auto-scroll on new messages (non-history sends)
  const messageCount = state.messages.length;
  useEffect(() => {
    if (!isHistoryEntry && messageCount > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageCount]);

  // --- share/download card --------------------------------------------------------
  const lastAi = useMemo(
    () => [...state.messages].reverse().find((m): m is AiResponse => m.kind === 'ai') ?? null,
    [state.messages],
  );
  const firstUser = useMemo(
    () => state.messages.find((m): m is UserMessage => m.kind === 'user') ?? null,
    [state.messages],
  );
  const shareCard = useShareCard(firstUser?.text ?? '', lastAi?.text ?? '');

  // --- follow-up sends ---------------------------------------------------------------
  const sendFollowUpText = useCallback(
    (text: string) => {
      setTextInputVisible(false);
      onAction({ type: 'SendFollowUpQuestion', question: text });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const sendFollowUpVoice = useCallback(
    (audio: RecordedAudio) => {
      setVoiceInputVisible(false);
      onAction({
        type: 'SendFollowUpVoiceQuestion',
        audioUri: audio.uri,
        audioBase64: audio.base64,
        audioFormat: audio.format,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const sendFollowUpImage = useCallback(
    (image: PickedImage) => {
      setPhotoInputVisible(false);
      onAction({
        type: 'SendQuestionWithImage',
        question: '',
        imageUri: image.uri,
        imageBase64: image.base64,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // --- rendering ------------------------------------------------------------------------
  const uiState = deriveChatUiState(state);

  const renderMessage = ({ item }: { item: ChatMessage }): React.ReactElement | null => {
    switch (item.kind) {
      case 'user':
        return <UserBubble message={item} />;
      case 'ai': {
        const isLast = lastAi?.id === item.id;
        // Only a fresh answer animates: the newest AI message, not a history
        // entry, not pre-generated, and only until it has revealed once.
        const shouldAnimate =
          isLast && !isHistoryEntry && !item.isPreGenerated && !revealedIds.has(item.id);
        const revealed = revealedIds.has(item.id);
        return (
          <AiBubble
            message={item}
            isLast={isLast}
            animate={shouldAnimate}
            revealed={revealed}
            onRevealComplete={() => markRevealed(item.id)}
            clarificationRequired={state.clarificationRequired && isLast}
            isTtsEnabled={state.isTtsEnabled && sdk.config.enableVoice}
            isLoadingTts={state.isLoadingSynthesiseAudio}
            isPlayingTts={state.isAudioPlaying}
            onListen={toggleListen}
            onShare={() => void shareCard.handle.share(sdk)}
            onDownload={() => void shareCard.handle.download(sdk)}
            onReadFullAdvice={
              item.isPreGenerated
                ? () =>
                    onAction({
                      type: 'ReplacePreGeneratedWithQuestion',
                      question: firstUser?.text ?? '',
                      triggerInputType: 'card',
                    })
                : undefined
            }
            onFollowUp={(q) => onAction({ type: 'SendFollowUpQuestion', question: q })}
          />
        );
      }
      case 'loading':
        return (
          <View style={styles.loadingBubble}>
            <ThinkingIndicator label={label('chat_thinking', 'Finding the best advice…')} />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surfaceReading }]}>
      <LogoAppBar
        navIcon={isHistoryEntry ? 'menu' : 'close'}
        onNavPress={() => {
          if (isHistoryEntry) {
            props.onOpenDrawer();
          } else {
            sdk.analytics.track(AnalyticsEvents.CHAT_SCREEN_BACK_BUTTON_CLICK, {});
            props.onClose();
          }
        }}
        showLogo={uiState.kind === 'thread' && !state.isLoading}
      />

      {uiState.kind === 'loading' ? (
        <View style={styles.centerBody}>
          {uiState.questionText || uiState.imageUri || uiState.audioUri ? (
            <UserBubble
              message={{
                kind: 'user',
                id: 'pending',
                text: uiState.questionText ?? '',
                imageUri: uiState.imageUri,
                audioUri: uiState.audioUri,
                userBubbleImageWideBanner: uiState.imageUri !== null,
                isFailed: false,
              }}
            />
          ) : null}
          <ThinkingIndicator label={label('chat_loading', 'Finding the best advice…')} />
        </View>
      ) : uiState.kind === 'error' ? (
        <View style={styles.centerBody}>
          {uiState.questionText || uiState.imageUri || uiState.audioUri ? (
            <UserBubble
              message={{
                kind: 'user',
                id: 'failed',
                text: uiState.questionText ?? '',
                imageUri: uiState.imageUri,
                audioUri: uiState.audioUri,
                userBubbleImageWideBanner: uiState.imageUri !== null,
                isFailed: true,
              }}
            />
          ) : null}
          <Text style={[typography.body, { color: theme.textPrimary, textAlign: 'center' }]}>
            {uiState.message}
          </Text>
          <PrimaryButton
            label={label('chat_retry', 'Try again')}
            onPress={() => onAction({ type: 'RetryLastRequest' })}
            style={{ minWidth: 180 }}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={state.messages}
            renderItem={renderMessage}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.thread}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onStartReached={onScrollNearTop}
            onStartReachedThreshold={0.2}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const distanceToBottom =
                contentSize.height - contentOffset.y - layoutMeasurement.height;
              setShowScrollToBottom(distanceToBottom > 400);
            }}
            scrollEventThrottle={100}
            ListHeaderComponent={
              state.isLoadingMoreHistory ? (
                <LogoSpinner message={label('chat_loading_older', 'Loading older messages…')} />
              ) : null
            }
            ListFooterComponent={
              <ThreadFooter
                suggestedQuestions={state.suggestedQuestions}
                clarificationRequired={state.clarificationRequired}
                errorMessage={state.errorMessage}
                isLoading={state.isLoading}
                revealed={lastAi == null || revealedIds.has(lastAi.id)}
                askLabel={label('fc_v2_app_label_ask', 'Ask')}
                onFollowUp={(q) => onAction({ type: 'SendFollowUpQuestion', question: q })}
                onRetry={() => onAction({ type: 'RetryLastRequest' })}
              />
            }
          />
          <ScrollToBottomButton
            visible={showScrollToBottom}
            onPress={() => listRef.current?.scrollToEnd({ animated: true })}
          />
          {!state.isLoading ? (
            <PrimaryInputButtons
              variant="chat"
              showPhoto={sdk.config.enableImages}
              showSpeak={sdk.config.enableVoice}
              onPhoto={() => setPhotoInputVisible(true)}
              onSpeak={() => setVoiceInputVisible(true)}
              onType={() => setTextInputVisible(true)}
            />
          ) : null}
        </View>
      )}

      {shareCard.cardElement}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TextInputOverlay
          visible={textInputVisible}
          placeholder={label('chat_text_hint', 'Ask a follow-up question…')}
          sendLabel={label('home_text_send', 'Send')}
          onSend={sendFollowUpText}
          onClose={() => setTextInputVisible(false)}
        />
      </KeyboardAvoidingView>
      <VoiceInputOverlay
        visible={voiceInputVisible}
        onSend={sendFollowUpVoice}
        onClose={() => setVoiceInputVisible(false)}
        onPermissionPermanentlyDenied={() => setPermissionDialog('microphone')}
      />
      <PhotoInputSheet
        visible={photoInputVisible}
        onPicked={sendFollowUpImage}
        onClose={() => setPhotoInputVisible(false)}
        onPermissionPermanentlyDenied={() => setPermissionDialog('camera')}
      />
      <PermissionSettingsDialog
        visible={permissionDialog !== null}
        permission={permissionDialog ?? 'camera'}
        onDismiss={() => setPermissionDialog(null)}
      />
      <Toast toast={toast} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Bubbles
// ---------------------------------------------------------------------------

function UserBubble(props: { message: UserMessage }): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();
  const { message } = props;
  return (
    <View style={styles.userRow}>
      <View
        style={[
          styles.userBubble,
          { backgroundColor: theme.bubbleUser },
          message.userBubbleImageWideBanner && styles.wideBanner,
          message.isFailed && { opacity: 0.6 },
        ]}
      >
        {message.imageUri ? (
          <Image
            source={{ uri: message.imageUri }}
            style={message.userBubbleImageWideBanner ? styles.bannerImage : styles.thumbImage}
            resizeMode="cover"
          />
        ) : null}
        {message.audioUri ? <VoiceClip audioUri={message.audioUri} tint="onBrand" /> : null}
        {message.text.length > 0 ? (
          <Text style={[typography.body, { color: theme.bubbleUserText }]}>{message.text}</Text>
        ) : null}
      </View>
      {message.isFailed ? (
        <Text style={[typography.caption, { color: theme.error, textAlign: 'right' }]}>
          {label('chat_failed_to_send', 'Not sent')}
        </Text>
      ) : null}
    </View>
  );
}

function AiBubble(props: {
  message: AiResponse;
  isLast: boolean;
  animate: boolean;
  revealed: boolean;
  onRevealComplete: () => void;
  clarificationRequired: boolean;
  isTtsEnabled: boolean;
  isLoadingTts: boolean;
  isPlayingTts: boolean;
  onListen: () => void;
  onShare: () => void;
  onDownload: () => void;
  onReadFullAdvice?: () => void;
  onFollowUp: (question: string) => void;
}): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();
  const { message } = props;
  // Action row appears only once the answer has finished revealing.
  const showActions = props.isLast && props.revealed;
  return (
    <View style={styles.aiRow}>
      {props.clarificationRequired ? (
        <View
          style={[
            styles.clarification,
            { backgroundColor: theme.chipBackground, borderColor: theme.chipBorder },
          ]}
        >
          <Text style={[typography.bodySmall, { color: theme.textSecondary }]}>
            {label(
              'chat_clarification_required',
              'I need a little more detail to answer accurately:',
            )}
          </Text>
        </View>
      ) : null}
      <View style={styles.aiBubble}>
        <AiAnswerBlock
          text={message.text}
          animate={props.animate}
          color={theme.bubbleAiText}
          onRevealComplete={props.onRevealComplete}
        />
        {message.contentProvider && message.hideSource !== true ? (
          <Text style={[typography.caption, { color: theme.textTertiary, marginTop: spacing.sm }]}>
            {label('chat_source', 'Source: {name}', { name: message.contentProvider })}
          </Text>
        ) : null}
      </View>
      {showActions ? (
        <FadeIn style={styles.aiActions}>
          {message.isPreGenerated && props.onReadFullAdvice ? (
            <PrimaryButton
              label={label('chat_read_full_advice', 'Read full advice')}
              onPress={props.onReadFullAdvice}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : null}
          <View style={styles.actionRow}>
            {message.hideShareIcon !== true ? (
              <>
                <ActionChip
                  icon="share"
                  text={label('fc_v2_app_label_share', 'Share')}
                  onPress={props.onShare}
                />
                <ActionChip
                  icon="save"
                  text={label('fc_v2_app_label_save', 'Save')}
                  onPress={props.onDownload}
                />
              </>
            ) : null}
            {props.isTtsEnabled && message.hideTtsSpeaker !== true ? (
              <ActionChip
                icon={props.isPlayingTts ? 'pause' : 'speaker'}
                text={label('chat_listen', 'Listen')}
                isLoading={props.isLoadingTts}
                onPress={props.onListen}
              />
            ) : null}
          </View>
        </FadeIn>
      ) : null}
    </View>
  );
}

/** Pill-shaped action button (Share / Save / Listen) under the last answer. */
function ActionChip(props: {
  icon: React.ComponentProps<typeof FcIcon>['name'];
  text: string;
  isLoading?: boolean;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const accent = theme.brand.foregroundSecondary;
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.actionChip,
        {
          backgroundColor: c.surfaceSecondary,
          borderColor: withChipAlpha(accent, 0.28),
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {props.isLoading ? (
        <ActivityIndicator size="small" color={accent} />
      ) : (
        <FcIcon name={props.icon} size={16} tint={accent} />
      )}
      <Text style={[typography.labelMedium, { color: c.foregroundPrimary }]}>{props.text}</Text>
    </Pressable>
  );
}

/** Fade + slight rise, used for the reveal-gated action row and follow-ups. */
function FadeIn(props: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [anim]);
  return (
    <Animated.View
      style={[
        props.style,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
    >
      {props.children}
    </Animated.View>
  );
}

function withChipAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(color.trim());
  if (!m) return color;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function ThreadFooter(props: {
  suggestedQuestions: string[] | null;
  clarificationRequired: boolean;
  errorMessage: string | null;
  isLoading: boolean;
  revealed: boolean;
  askLabel: string;
  onFollowUp: (question: string) => void;
  onRetry: () => void;
}): React.ReactElement | null {
  const theme = useTheme();
  const label = useLabel();
  if (props.isLoading) return null;
  const hasFollowUps =
    props.revealed && props.suggestedQuestions != null && props.suggestedQuestions.length > 0;
  return (
    <View style={styles.footer}>
      {props.errorMessage ? (
        <View style={styles.inlineError}>
          <Text style={[typography.bodySmall, { color: theme.error, textAlign: 'center' }]}>
            {props.errorMessage}
          </Text>
          <PrimaryButton
            label={label('chat_retry', 'Try again')}
            onPress={props.onRetry}
            style={{ alignSelf: 'center', minWidth: 160 }}
          />
        </View>
      ) : null}
      {hasFollowUps ? (
        <FadeIn style={styles.followUpSection}>
          <View style={styles.followUpTitleRow}>
            <View
              style={[styles.followUpDot, { backgroundColor: theme.brand.foregroundSecondary }]}
            />
            <Text
              style={[typography.titleSmall, { color: theme.textSecondary }]}
            >
              {props.clarificationRequired
                ? label('chat_clarification_suggestions', 'Choose a follow-up option below')
                : label('chat_related_questions', 'Related questions')}
            </Text>
          </View>
          {(props.suggestedQuestions ?? []).map((q, index) => (
            <SuggestedCard
              key={`${index}-${q}`}
              question={q}
              askLabel={props.askLabel}
              onPress={() => props.onFollowUp(q)}
            />
          ))}
        </FadeIn>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerBody: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  thread: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  userRow: { alignItems: 'flex-end', gap: spacing.xs, marginVertical: spacing.xs },
  userBubble: {
    maxWidth: 300,
    // Asymmetric tail — three corners rounded, bottom-right sharp.
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.sm / 2,
    padding: spacing.md,
    gap: spacing.sm,
  },
  wideBanner: { width: '100%', maxWidth: '100%' },
  bannerImage: { width: '100%', height: 160, borderRadius: radius.md },
  thumbImage: { width: 96, height: 96, borderRadius: radius.md },
  aiRow: { alignItems: 'flex-start', gap: spacing.md, marginVertical: spacing.xs },
  // The AI answer reads directly on the reading surface (no bordered bubble) to
  // match the redesign; markdown + optional source note only.
  aiBubble: { width: '100%', paddingRight: spacing.xs },
  aiActions: { gap: spacing.md, width: '100%' },
  actionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 40,
    borderRadius: radius.rounded,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
  },
  clarification: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  loadingBubble: { alignItems: 'flex-start' },
  footer: { gap: spacing.lg, paddingTop: spacing.sm, paddingBottom: 96 },
  followUpSection: { gap: spacing.sm },
  followUpTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  followUpDot: { width: 6, height: 6, borderRadius: 3 },
  inlineError: { gap: spacing.md },
});
