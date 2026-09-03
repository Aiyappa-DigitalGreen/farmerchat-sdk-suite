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
  useWindowDimensions,
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
  type LocationMessage,
  type UserMessage,
} from '../../state/useChat';
import { PrimaryButton, ScrollToBottomButton } from '../components/Buttons';
import { SuggestedCard } from '../components/Cards';
import { AiAnswerBlock, ThinkingIndicator } from '../components/AiAnswer';
import {
  AlignmentSurface,
  StreamErrorCard,
  StreamStallHint,
} from '../components/AgenticSurfaces';
import { Labels } from '../../core/labels';
import { StreamErrorKinds } from '../../core/agenticModels';
import {
  AlignmentChipRoutes,
  isAdditiveAlignment,
  routeAlignmentChip,
} from '../../core/types';
import type { AlignmentChip, AlignmentKind } from '../../core/types';
import { StorageKeys } from '../../core/sessionStore';
import { isLocationObtained, isTerminalLocationOutcome } from '../../core/locationOutcome';
import type { UseLocationPromptResult } from '../../state/useLocationPrompt';
import { LogoAppBar, LogoSpinner, Toast, useToastState } from '../components/Chrome';
import {
  captureImageFromCamera,
  fileUriToBase64,
  PermissionSettingsDialog,
  PhotoInputSheet,
  pickImageFromGallery,
  PrimaryInputButtons,
  TextInputOverlay,
  VoiceInputOverlay,
  type PickedImage,
  type RecordedAudio,
} from '../components/InputOverlays';
import { InputComposer, type InputComposerHandle } from '../components/InputComposer';
import { LocationChatBubble } from '../components/LocationChatBubble';
import { useShareCard } from '../components/ShareCard';
import { stopAllVoiceClips, VoiceClip } from '../components/VoiceClip';
import { FcIcon } from '../components/Icon';
import type { ChatRouteParams } from '../navigation/types';
import { radius, spacing, typography } from '../theme';

export function ChatScreen(props: {
  params: ChatRouteParams;
  onClose: () => void;
  onOpenDrawer: () => void;
  /**
   * The SHARED location-prompt state machine (the same instance Home and the prompt host use).
   * 2.0.0: a `gps-prompt` capability chip drives it, and the outcome comes back on its event
   * listener — so this screen must not create its own, or the host overlay would never render
   * the permission/fetch UI for it.
   */
  locationPrompt: UseLocationPromptResult;
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

  // 2.0.0 composer UI. The app gates this on two independent Firebase Remote Config flags
  // (`getComposerUiEnabled()` for the input surface, `getAgenticChatEnabled()` for the visual
  // theme + routing). The SDK carries no Remote Config, so the host supplies both:
  // `enableComposerUi` (omitted ⇒ follow `enableAgenticChat`), resolved into `config.composerUi`
  // — same resolution as Compose. With it off, the 1.0.0 Photo/Speak/Type row + text overlay are
  // untouched, so a host that has not opted in sees no change (root CLAUDE.md §3).
  const isComposerUi = sdk.config.composerUi;
  const composerRef = useRef<InputComposerHandle>(null);
  // Single attached image per query — the composer renders the thumbnail, this screen owns it.
  const [attachedImage, setAttachedImage] = useState<PickedImage | null>(null);

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

  // --- capability chips (2.0.0) ---------------------------------------------------------
  // GPS_PROMPT and UPLOAD_PHOTO chips do NOT send their text as a question — they invoke a
  // device capability and only the OUTCOME is sent. Every other chip stays on the plain
  // SelectAlignmentChip path. Port of the app's `onAlignmentChipClick`.

  /**
   * Which surface's chip armed the location flow. A REF, not state: the outcome listener below
   * is registered once and would capture a stale `null` forever if this were `useState` — the
   * exact way this producer dies silently while every type check still passes.
   */
  const pendingLocationSourceId = useRef<string | null>(null);

  /**
   * The address shown in the location bubble, assembled from the stored geography exactly as
   * the app's `composeResolvedAddress` does: best-known place name, then state, then country,
   * blank parts dropped, de-duplicated, joined with ", ".
   *
   * DEVIATION (documented in docs/04, same as the Home location pill): Android's first part is
   * `APPROX_LOCATION_NAME`, which core writes from the #16 `display_address`. This store has no
   * such key and inventing one is out of bounds (root CLAUDE.md §2), so `USER_DISTRICT` — which
   * #11 fills — stands in for it. A guest has none of the three written, so the address is
   * blank and NO bubble is appended; that is the app-parity branch, not a failure.
   */
  const composeResolvedAddress = (): string => {
    const parts = [
      sdk.store.getString(StorageKeys.USER_DISTRICT) ?? '',
      sdk.store.getString(StorageKeys.USER_STATE) ?? '',
      sdk.store.getString(StorageKeys.USER_COUNTRY_NAME) ?? '',
    ].map((part) => part.trim());
    return Array.from(new Set(parts.filter((part) => part.length > 0))).join(', ');
  };

  // Observe location outcomes for the chat share-location flow. Subscribed for the life of the
  // screen but inert until armed (pendingLocationSourceId.current !== null), so an outcome
  // belonging to Home or Settings is ignored.
  useEffect(
    () =>
      props.locationPrompt.addEventListener((event) => {
        const srcId = pendingLocationSourceId.current;
        if (srcId === null) return;
        // Only a TERMINAL event settles the request; `LocationReady` /
        // `LocationUpdatedFromWidget` are Home's business.
        if (!isTerminalLocationOutcome(event)) return;
        if (event.source !== 'localContext') return;
        // A terminal event for our request — disarm before dispatching.
        pendingLocationSourceId.current = null;
        // `Continue` alone is NOT success: a dismissed error also settles the caller, so the
        // shared reason rule decides (core `isLocationObtained`), never an inline comparison.
        if (isLocationObtained(event)) {
          onAction({
            type: 'SendLocationSharedQuery',
            sourceMessageId: srcId,
            address: composeResolvedAddress(),
          });
        } else {
          // Denied / cancelled / fetch failed: still answer the blocking question, by sending
          // the decline text as an ordinary follow-up. The app sends this through
          // `SendAlignmentChip` with `locationDeclined` + parent_message_id; the SDK has
          // neither, so the correlation and the chip analytics are lost (docs/04).
          onAction({
            type: 'SendFollowUpQuestion',
            question: label(
              Labels.LOCATION_PERMISSION_DECLINED,
              'Continue without sharing my location',
            ),
          });
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.locationPrompt, label],
  );

  /**
   * Hands a photo taken/picked FOR A CAPABILITY CHIP to the same place the Camera/Photos sheet
   * hands its result: attached to the composer in 2.0.0 (so the farmer can add words to it,
   * app parity), sent immediately on the 1.0.0 surface.
   */
  const deliverCapabilityImage = (image: PickedImage) => {
    if (isComposerUi) {
      setAttachedImage(image);
      composerRef.current?.focus();
    } else {
      onAction({
        type: 'SendQuestionWithImage',
        question: '',
        imageUri: image.uri,
        imageBase64: image.base64,
      });
    }
  };

  /**
   * Routes an alignment chip tap: a capability chip invokes its capability, everything else
   * sends text through `SelectAlignmentChip`. Deliberately a plain function, NOT a
   * `useCallback([])` like the sends above — it reads `locationPrompt.state` live, which a
   * memoized closure would freeze at mount. Mirror of Compose's `val handleAlignmentChip`.
   */
  const handleAlignmentChip = (
    messageId: string,
    kind: AlignmentKind | null,
    chip: AlignmentChip,
  ) => {
    switch (routeAlignmentChip(kind, chip)) {
      case AlignmentChipRoutes.LOCATION:
        // Permission dialog / GPS fetch / recovery are owned by LocationPromptHost; the outcome
        // arrives on the listener above. Only start when no other location flow is running
        // (mirrors Home's guard).
        if (props.locationPrompt.state.kind === 'Idle') {
          pendingLocationSourceId.current = messageId;
          props.locationPrompt.triggerFromLocalContext();
        }
        return;
      case AlignmentChipRoutes.CAMERA:
        void captureImageFromCamera(sdk, {
          onPermissionPermanentlyDenied: () => setPermissionDialog('camera'),
        }).then((image) => {
          if (image) deliverCapabilityImage(image);
        });
        return;
      case AlignmentChipRoutes.GALLERY:
        void pickImageFromGallery(sdk).then((image) => {
          if (image) deliverCapabilityImage(image);
        });
        return;
      case AlignmentChipRoutes.TEXT:
        if (kind !== null) {
          onAction({ type: 'SelectAlignmentChip', messageId, chip, kind });
        }
        return;
    }
  };

  // --- rendering ------------------------------------------------------------------------
  const uiState = deriveChatUiState(state);

  /**
   * Composer send — identical on both input surfaces, so it is defined once (Compose
   * `sendFromComposer`, ChatScreen.kt:1082). An attached image routes through image analysis;
   * otherwise a non-blank query is a plain follow-up.
   */
  const sendFromComposer = useCallback(
    (text: string) => {
      const image = attachedImage;
      composerRef.current?.clear();
      setAttachedImage(null);
      if (image) {
        onAction({
          type: 'SendQuestionWithImage',
          question: text,
          imageUri: image.uri,
          imageBase64: image.base64,
        });
      } else if (text.trim().length > 0) {
        onAction({ type: 'SendFollowUpQuestion', question: text.trim() });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attachedImage],
  );

  const renderMessage = ({ item }: { item: ChatMessage }): React.ReactElement | null => {
    switch (item.kind) {
      case 'user':
        return <UserBubble message={item} />;
      // 2.0.0: the farmer's resolved location, standing in for the text bubble they would
      // otherwise have sent. Right-aligned because it is their reply to a GPS_PROMPT chip
      // (Compose ChatScreen.kt:699).
      case 'location':
        return <LocationBubbleRow message={item} />;
      case 'ai': {
        const isLast = lastAi?.id === item.id;
        // Only a fresh answer animates: the newest AI message, not a history
        // entry, not pre-generated, and only until it has revealed once.
        const shouldAnimate =
          isLast && !isHistoryEntry && !item.isPreGenerated && !revealedIds.has(item.id);
        const revealed = revealedIds.has(item.id);
        const alignmentKind = item.alignmentKind ?? null;
        // 2.0.0: an EXCLUSIVE alignment surface owns the message area — it replaces the answer,
        // its action row and its related-questions section. An ADDITIVE one falls through to the
        // normal answer branch and renders below it as a nudge (see AiBubble).
        if (alignmentKind !== null && !isAdditiveAlignment(alignmentKind)) {
          return (
            <View style={styles.aiRow}>
              <AlignmentSurface
                kind={alignmentKind}
                message={item.text}
                chips={item.alignmentChips ?? []}
                selectedValues={item.alignmentSelectedValues ?? []}
                isLoading={state.isLoading}
                isLatest={isLast}
                onChipPress={(chip) => handleAlignmentChip(item.id, alignmentKind, chip)}
                onTypeInstead={() => setTextInputVisible(true)}
              />
            </View>
          );
        }
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
            onAlignmentChipPress={(chip) => handleAlignmentChip(item.id, alignmentKind, chip)}
            isThreadLoading={state.isLoading}
            onRetryStream={() => onAction({ type: 'RetryLastRequest' })}
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
                // App parity (ChatThreadContent.kt:100 / ChatScreen.kt:675): the composer UI
                // reserves the composer bar's height at the bottom so the last bubble is not
                // hidden behind it; the legacy input keeps the 96 that fits the
                // Photo/Speak/Type row. The RN composer is a flow element rather than an
                // overlay (see InputComposer's header), so it already occupies that space —
                // only the small breathing gap is reserved here.
                bottomPadding={isComposerUi ? spacing.xl : 96}
                suggestedQuestions={state.suggestedQuestions}
                clarificationRequired={state.clarificationRequired}
                // An interrupted agentic stream renders its own inline StreamErrorCard (with
                // kind- and partial-aware copy) on the answer bubble; showing the footer error
                // too would give the farmer two retry buttons for one failure.
                errorMessage={lastAi?.isInterrupted === true ? null : state.errorMessage}
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
          {/* App parity (ChatThreadContent.kt:243 / ChatScreen.kt:1048): the composer UI drops
              this row entirely — the InputComposer below already carries camera and mic. */}
          {!isComposerUi &&
          !state.isLoading &&
          !textInputVisible &&
          !voiceInputVisible &&
          !photoInputVisible ? (
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

      {/* App parity (ChatInputOverlays.kt:57 / ChatScreen.kt:1097): anchored + compact
          composer. It handles the IME itself, so it must NOT be wrapped in the
          KeyboardAvoidingView below — that would double the bottom inset and float the pill
          too high, the RN counterpart of the Compose imePadding() double-inset note. The
          SafeAreaView root has already consumed the bottom inset, hence bottomInset={0}. */}
      {isComposerUi ? (
        <InputComposer
          ref={composerRef}
          floating
          isAnchored
          compact
          bottomInset={0}
          // Slides off-screen while an answer is generating, then back — the same visibility
          // rhythm PrimaryInputButtons has in the legacy layout.
          visible={!(uiState.kind === 'thread' && state.isLoading)}
          surfaceColor={theme.brand.surfacePrimary}
          fadeColor={theme.content.surfaceReadingPrimary}
          placeholder={label(Labels.ASK_ABOUT_YOUR_FARM, 'Ask about your farm...')}
          showPhoto={sdk.config.enableImages}
          showVoice={sdk.config.enableVoice}
          attachedImageUri={attachedImage?.uri ?? null}
          onRemoveAttachedImage={() => setAttachedImage(null)}
          onPhotoPress={() => {
            // Camera is only offered when no image is attached — the same guard the Compose
            // composer applies (HomeScreen.kt:967).
            if (!attachedImage) {
              sdk.analytics.track(AnalyticsEvents.IMAGE_OPTION_DIALOG_CLICK_EVENT, {
                screen_name: ScreenNames.CHAT,
              });
              setPhotoInputVisible(true);
            }
          }}
          onVoicePress={() => {
            sdk.analytics.track(AnalyticsEvents.MICROPHONE_CLICK_EVENT, {
              screen_name: ScreenNames.CHAT,
            });
            setVoiceInputVisible(true);
          }}
          onSend={sendFromComposer}
        />
      ) : null}

      {shareCard.cardElement}

      {/* `undefined` on Android was a no-op, so the composer sat behind the IME exactly like the
          android-compose imePadding() bug. 'height' is the Android counterpart of iOS 'padding'.
          NOTE: this only works if the HOST activity uses windowSoftInputMode="adjustResize" —
          documented in the react-native README. */}
      {!isComposerUi ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TextInputOverlay
            visible={textInputVisible}
            placeholder={label('chat_text_hint', 'Ask a follow-up question…')}
            sendLabel={label('home_text_send', 'Send')}
            onSend={sendFollowUpText}
            onClose={() => setTextInputVisible(false)}
          />
        </KeyboardAvoidingView>
      ) : null}
      <VoiceInputOverlay
        visible={voiceInputVisible}
        onSend={sendFollowUpVoice}
        onClose={() => setVoiceInputVisible(false)}
        onPermissionPermanentlyDenied={() => setPermissionDialog('microphone')}
      />
      <PhotoInputSheet
        visible={photoInputVisible}
        // Composer UI: a picked photo becomes the composer's single attachment (the farmer can
        // type a question alongside it, or send it bare). The legacy sheet has nowhere to hold
        // one, so it sends immediately, exactly as in 1.0.0.
        onPicked={
          isComposerUi
            ? (image) => {
                setPhotoInputVisible(false);
                setAttachedImage(image);
                composerRef.current?.focus();
              }
            : sendFollowUpImage
        }
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
  const cfg = useSdk().config;
  const { message } = props;
  // Chat UI customization (null = current theme behavior). Keep the sharp tail.
  const cornerOverride =
    cfg.bubbleCornerRadius != null
      ? {
          borderTopLeftRadius: cfg.bubbleCornerRadius,
          borderTopRightRadius: cfg.bubbleCornerRadius,
          borderBottomLeftRadius: cfg.bubbleCornerRadius,
        }
      : null;
  const fontOverride = cfg.messageFontSize != null ? { fontSize: cfg.messageFontSize } : null;
  return (
    <View style={styles.userRow}>
      <View
        style={[
          styles.userBubble,
          { backgroundColor: cfg.userBubbleColor ?? theme.bubbleUser },
          cornerOverride,
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
          <Text style={[typography.body, { color: cfg.userBubbleTextColor ?? theme.bubbleUserText }, fontOverride]}>
            {message.text}
          </Text>
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

/**
 * The location bubble row — right-aligned, mirroring the Compose `Box(contentAlignment =
 * CenterEnd)` wrapper around `LocationChatBubble` (ChatScreen.kt:701).
 */
function LocationBubbleRow(props: { message: LocationMessage }): React.ReactElement {
  const label = useLabel();
  return (
    <View style={styles.userRow}>
      <LocationChatBubble
        address={props.message.address}
        label={label(Labels.YOUR_LOCATION, 'Your location:')}
      />
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
  // ---- agentic (2.0.0) ----
  /** Tapped chip on an ADDITIVE alignment surface rendered below this answer. */
  onAlignmentChipPress?: (chip: AlignmentChip) => void;
  /** ChatState.isLoading — locks alignment chips while another query is in flight. */
  isThreadLoading?: boolean;
  /** Retry after an interrupted stream. */
  onRetryStream?: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();
  const cfg = useSdk().config;
  const { message } = props;
  const isStreaming = message.isStreaming === true;
  const isInterrupted = message.isInterrupted === true;
  // While a stream is live the answer grows in place, so reserve a screen's height to pin the
  // question at the top instead of letting the list clamp it downward as text arrives. Also held
  // for the interrupted state so the error card sits near the top. Port of the Compose
  // `streamReserve` (Modifier.heightIn(min = screenHeightDp)).
  const windowHeight = useWindowDimensions().height;
  const streamReserve =
    props.isLast && (isStreaming || isInterrupted) ? { minHeight: windowHeight } : null;
  const additiveAlignmentKind =
    message.alignmentKind != null && isAdditiveAlignment(message.alignmentKind)
      ? message.alignmentKind
      : null;
  // Action row appears only once the answer has finished revealing — and never while a stream is
  // still running or after it broke. (AiAnswerBlock reports "revealed" immediately when
  // animate=false, which is every delta of a stream, so `revealed` alone is not enough.)
  const showActions = props.isLast && props.revealed && !isStreaming && !isInterrupted;
  return (
    <View style={[styles.aiRow, streamReserve]}>
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
          // A streaming answer must NEVER run the typewriter reveal — the text is already
          // arriving a token at a time, and animating it again double-types it.
          animate={props.animate && !isStreaming}
          color={cfg.aiBubbleTextColor ?? theme.bubbleAiText}
          fontSize={cfg.messageFontSize ?? undefined}
          onRevealComplete={props.onRevealComplete}
        />
        {message.contentProvider && message.hideSource !== true ? (
          <Text style={[typography.caption, { color: theme.textTertiary, marginTop: spacing.sm }]}>
            {label('chat_source', 'Source: {name}', { name: message.contentProvider })}
          </Text>
        ) : null}

        {/* Tool progress, or the initial "getting your answer" state before any text arrives. */}
        {isStreaming &&
        (message.text.length === 0 ||
          (message.streamingStatus != null && message.streamingStatus.trim().length > 0)) ? (
          <View style={styles.streamStatus}>
            <LogoSpinner
              message={
                message.streamingStatus != null && message.streamingStatus.trim().length > 0
                  ? message.streamingStatus
                  : label(Labels.GETTING_YOUR_ANSWER, 'Getting your answer…')
              }
            />
          </View>
        ) : null}

        {/* Text is flowing but has stalled with no tool status: a transient client-side hint,
            NOT a failure. Keyed on text length so the next delta clears it automatically. */}
        {isStreaming &&
        message.text.length > 0 &&
        (message.streamingStatus == null || message.streamingStatus.trim().length === 0) ? (
          <View style={styles.streamStatus}>
            <StreamStallHint messageId={message.id} textLength={message.text.length} />
          </View>
        ) : null}
      </View>

      {/* ADDITIVE surface: a nudge below the real answer (gender-select / commodity-confirm).
          Single-tap; the answer above keeps its own action row. */}
      {additiveAlignmentKind !== null ? (
        <AlignmentSurface
          kind={additiveAlignmentKind}
          message={message.alignmentMessage ?? ''}
          chips={message.alignmentChips ?? []}
          selectedValues={message.alignmentSelectedValues ?? []}
          isLoading={props.isThreadLoading === true}
          isLatest={props.isLast}
          additive
          onChipPress={(chip) => props.onAlignmentChipPress?.(chip)}
        />
      ) : null}

      {/* Interrupted terminal state: keep any partial answer above and offer retry. Only the
          latest answer shows the card — an older failed question keeps its partial text but
          drops the retry action. */}
      {isInterrupted && props.isLast ? (
        <StreamErrorCard
          errorKind={message.streamErrorKind ?? StreamErrorKinds.UNKNOWN}
          hasPartial={message.text.trim().length > 0}
          onRetry={() => props.onRetryStream?.()}
        />
      ) : null}
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
  /** Space kept below the thread so the input surface never covers the last bubble. */
  bottomPadding: number;
  onFollowUp: (question: string) => void;
  onRetry: () => void;
}): React.ReactElement | null {
  const theme = useTheme();
  const label = useLabel();
  if (props.isLoading) return null;
  const hasFollowUps =
    props.revealed && props.suggestedQuestions != null && props.suggestedQuestions.length > 0;
  return (
    <View style={[styles.footer, { paddingBottom: props.bottomPadding }]}>
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
  streamStatus: { marginTop: spacing.sm },
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
