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
  Easing,
  FlatList,
  type LayoutChangeEvent,
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
import { ActionButton, PrimaryButton, ScrollIndicator } from '../components/Buttons';
import { AiAnswerBlock } from '../components/AiAnswer';
import {
  AlignmentSurface,
  InlineErrorContent,
  NumberedChip,
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
import { INLINE_SPINNER_STYLE, LogoAppBar, LogoSpinner, Toast, useToastState } from '../components/Chrome';
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
import { SweepBorder } from '../components/Gradients';
import type { ChatRouteParams } from '../navigation/types';
import { Green500, radius, spacing, typography } from '../theme';

export function ChatScreen(props: {
  params: ChatRouteParams;
  onClose: () => void;
  onOpenDrawer: () => void;
  /** Drawer off: back out of a history thread (pop, or exit when it is the journey root). */
  onBack: () => void;
  /** Drawer off: the chat bar's Past Advice button (ChatFragment.setUpAppBarActions). */
  onOpenHistory: () => void;
  /** Drawer off: the chat bar's language button. */
  onOpenLanguage: () => void;
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

  // ChatThreadContent.kt `reserveHeightDp`: the reserve below a pinned question is the LIST's
  // measured viewport, not the screen height (which ignores the app bar and insets and would
  // over-reserve). Falls back to the window height before the first layout pass.
  const windowHeight = useWindowDimensions().height;
  const [viewportHeight, setViewportHeight] = useState(0);
  const reserveHeight = viewportHeight > 0 ? viewportHeight : windowHeight;

  // ChatThreadContent.kt `showIndicator`: is there content (≥ two 24dp lines) hidden below the
  // viewport? Tracked from scroll / layout / content-size events.
  const scrollMetrics = useRef({ content: 0, offset: 0, viewport: 0 });
  const [contentBelow, setContentBelow] = useState(false);
  // The final row's blank reserve (set below, once the reserve helpers exist) is not content.
  const tailBlankRef = useRef<() => number>(() => 0);
  const updateContentBelow = useCallback(() => {
    const { content, offset, viewport } = scrollMetrics.current;
    // THREAD_BOTTOM_GAP is the content padding after the last item, not hidden content.
    const realContent = content - tailBlankRef.current();
    setContentBelow(realContent - offset - viewport - THREAD_BOTTOM_GAP >= 2 * 24);
  }, []);

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
          showToast(label('fc_v2_app_label_something_went_wrong_please_try_again', 'Something went wrong. Please try again.'), 'error');
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
          showToast(label('fc_v2_app_label_something_went_wrong_please_try_again', 'Something went wrong. Please try again.'), 'error');
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

  // --- reserve + pinning (core ChatReserve.kt; web ChatScreen.tsx) -----------------------------
  // The newest answer holds a viewport of height below the farmer's question, and the question is
  // scrolled to the TOP of the viewport (minus the 20dp content top padding) so the answer grows
  // into the reserve beneath it. The screen never follows the stream's tail: the anchor effect is
  // keyed on the tail id + isLoading (+ the first history load) only, never on text deltas.
  const holdsReserve = (ai: AiResponse, isLastAi: boolean): boolean =>
    isLastAi &&
    (ai.isStreaming === true ||
      ai.isInterrupted === true ||
      !state.isLoading ||
      (ai.alignmentKind != null && (ai.alignmentSelectedValues ?? []).length === 0));

  const finalMessage = state.messages[state.messages.length - 1];
  const tailId = finalMessage?.id ?? null;
  // Does the FINAL row hold the reserve (a reserve-holding AI response, or the loading
  // placeholder)? Then the anchor is the farmer's question above it (ChatReserve.kt
  // chatScrollAnchorIndex).
  const finalHoldsSpace =
    finalMessage !== undefined &&
    (finalMessage.kind === 'loading' ||
      // A final AI row is by definition the newest AI response.
      (finalMessage.kind === 'ai' && holdsReserve(finalMessage, true)));
  const finalHoldsSpaceRef = useRef(false);
  finalHoldsSpaceRef.current = finalHoldsSpace;
  const tailIdRef = useRef<string | null>(null);
  tailIdRef.current = tailId;

  // The blank part of the final row's reserve (reserve minus its real content height). The
  // scroll indicator must neither count it as "content below" nor scroll into it.
  const rowRealHeights = useRef(new Map<string, number>());
  const reserveHeightRef = useRef(reserveHeight);
  reserveHeightRef.current = reserveHeight;
  const tailBlank = useCallback((): number => {
    const id = tailIdRef.current;
    const h = id === null ? undefined : rowRealHeights.current.get(id);
    if (!finalHoldsSpaceRef.current || h === undefined) return 0;
    return Math.max(0, reserveHeightRef.current - h);
  }, []);
  tailBlankRef.current = tailBlank;
  const onReserveContentLayout = useCallback(
    (id: string, height: number) => {
      rowRealHeights.current.set(id, height);
      if (id === tailIdRef.current) updateContentBelow();
    },
    [updateContentBelow],
  );
  // Scroll indicator: the bottom of REAL content, never the blank end of the reserve.
  const scrollToContentEnd = useCallback(() => {
    const blank = tailBlank();
    if (blank <= 0) {
      listRef.current?.scrollToEnd({ animated: true });
      return;
    }
    const { content, viewport } = scrollMetrics.current;
    listRef.current?.scrollToOffset({
      offset: Math.max(0, content - blank - viewport),
      animated: true,
    });
  }, [tailBlank]);

  const anchorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRetries = useRef(0);
  const scheduleScroll = useCallback((fn: () => void, delay = 100) => {
    if (anchorTimer.current !== null) clearTimeout(anchorTimer.current);
    anchorTimer.current = setTimeout(() => {
      anchorTimer.current = null;
      fn();
    }, delay);
  }, []);
  useEffect(
    () => () => {
      if (anchorTimer.current !== null) clearTimeout(anchorTimer.current);
    },
    [],
  );
  const scrollToAnchor = useCallback((index: number) => {
    // viewOffset 20 = the thread's paddingTop (the cell offsets already include it), i.e. the
    // web's `offsetTop - 20` / Compose's anchor with the 20dp content padding.
    listRef.current?.scrollToIndex({ index, viewPosition: 0, viewOffset: 20, animated: true });
  }, []);
  // Without getItemLayout an unmeasured row fails: jump near it, then retry a bounded number of
  // times once FlatList has rendered and measured it.
  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({
        offset: Math.max(0, info.averageItemLength * info.index),
        animated: false,
      });
      if (anchorRetries.current >= 3) return;
      anchorRetries.current += 1;
      scheduleScroll(() => scrollToAnchor(info.index), 50);
    },
    [scheduleScroll, scrollToAnchor],
  );

  // History entry: the tail id at the first load. Until a NEW tail appears nothing auto-scrolls
  // (older pages keep the visible position via maintainVisibleContentPosition). undefined = the
  // first page has not loaded yet; null = a new tail has appeared, anchoring is live.
  const historyTailRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (tailId === null) return;
    if (isHistoryEntry) {
      if (!state.isInitialHistoryLoaded) return;
      if (historyTailRef.current === undefined) {
        // First open: the first message sits at the top, once.
        historyTailRef.current = tailId;
        scheduleScroll(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));
        return;
      }
      if (historyTailRef.current === tailId) return;
      historyTailRef.current = null;
    }
    const lastIndex = state.messages.length - 1;
    const anchor = finalHoldsSpace && lastIndex > 0 ? lastIndex - 1 : lastIndex;
    anchorRetries.current = 0;
    // Deferred so the new rows (and their reserve minHeight) are laid out first; otherwise the
    // scroll clamps at the old max offset and the question never reaches the top.
    scheduleScroll(() => scrollToAnchor(anchor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tailId, state.isLoading, state.isInitialHistoryLoaded]);

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
        if (props.locationPrompt.isIdle()) {
          pendingLocationSourceId.current = messageId;
          // fromAgenticChip: the GPS analytics funnel is attributed to Chat (app parity).
          props.locationPrompt.triggerFromLocalContext(true);
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

  const retryLastRequest = () => onAction({ type: 'RetryLastRequest' });
  // ChatScreen.kt onRetry: a failed VOICE question is not resent — the voice input reopens so
  // the farmer can record again.
  const retryVoice = () => setVoiceInputVisible(true);

  // An error that is not attached to a question bubble (e.g. a history load) still gets the inline
  // row at the end of the thread; an interrupted stream shows its own StreamErrorCard instead.
  const standaloneError =
    state.errorMessage !== null &&
    !state.isLoading &&
    lastAi?.isInterrupted !== true &&
    !state.messages.some((m) => m.id === state.failedMessageId);

  const renderMessage = ({ item }: { item: ChatMessage }): React.ReactElement | null => {
    switch (item.kind) {
      case 'user': {
        // ChatThreadContent.kt: the failed question carries InlineErrorContent beneath it, and a
        // failed LAST message reserves a viewport of height (the fail reserve).
        const failed = state.failedMessageId === item.id && state.errorMessage !== null;
        const isLastMessage = state.messages[state.messages.length - 1]?.id === item.id;
        return (
          <UserItem
            message={item}
            failed={failed}
            minHeight={failed && isLastMessage ? reserveHeight : null}
            onRetry={retryLastRequest}
            onVoiceRetry={retryVoice}
          />
        );
      }
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
        // core ChatReserve.kt holdsChatReserve — the exclusive alignment surface holds it too.
        const reserve = holdsReserve(item, isLast) ? reserveHeight : null;
        if (alignmentKind !== null && !isAdditiveAlignment(alignmentKind)) {
          return (
            <ReserveRow
              id={item.id}
              minHeight={reserve}
              style={styles.aiRow}
              onContentLayout={onReserveContentLayout}
            >
              <AlignmentSurface
                kind={alignmentKind}
                message={item.text}
                chips={item.alignmentChips ?? []}
                selectedValues={item.alignmentSelectedValues ?? []}
                isLoading={state.isLoading}
                isLatest={isLast}
                onChipPress={(chip) => handleAlignmentChip(item.id, alignmentKind, chip)}
                onTypeInstead={() => setTextInputVisible(true)}
                // AlignmentSurface.kt Listen pill: ListenButton(light, enabled = isTtsEnabled).
                listen={
                  sdk.config.enableVoice && item.hideTtsSpeaker !== true ? (
                    <ActionChip
                      icon={state.isAudioPlaying ? 'pause' : 'speaker'}
                      text={label(Labels.LISTEN, 'Listen')}
                      isLoading={state.isLoadingSynthesiseAudio}
                      enabled={state.isTtsEnabled}
                      onPress={toggleListen}
                    />
                  ) : null
                }
              />
            </ReserveRow>
          );
        }
        return (
          <ReserveRow id={item.id} minHeight={reserve} onContentLayout={onReserveContentLayout}>
            <AiBubble
              message={item}
              isLast={isLast}
              animate={shouldAnimate}
              revealed={revealed}
              onRevealComplete={() => markRevealed(item.id)}
              clarificationRequired={state.clarificationRequired && isLast}
              // Host `enableVoice = false` removes the Listen pill; the server's TTS flag only dims
              // it (ListenButton.kt: enabled = isTtsEnabled → alpha 0.4, not clickable).
              ttsAvailable={sdk.config.enableVoice}
              isTtsEnabled={state.isTtsEnabled}
              isLoadingTts={state.isLoadingSynthesiseAudio}
              isPlayingTts={state.isAudioPlaying}
              onListen={toggleListen}
              onShare={() => void shareCard.handle.share(sdk)}
              // App parity (ChatThreadContent.kt): offered only on a pre-generated answer with a
              // non-blank question, and not once read-full-advice was already requested for it.
              onReadFullAdvice={
                item.isPreGenerated &&
                (firstUser?.text ?? '').trim().length > 0 &&
                state.readFullAdviceRequestedForMessageId !== item.id
                  ? () =>
                      onAction({
                        type: 'ReplacePreGeneratedWithQuestion',
                        question: firstUser?.text ?? '',
                        triggerInputType: 'card',
                      })
                  : undefined
              }
              followUps={state.suggestedQuestions}
              // App parity (ChatThreadContent.kt): a pre-generated answer never shows the
              // clarification treatment.
              followUpsClarification={state.clarificationRequired && item.isPreGenerated !== true}
              onFollowUp={(q) => onAction({ type: 'SendFollowUpQuestion', question: q })}
              onAlignmentChipPress={(chip) => handleAlignmentChip(item.id, alignmentKind, chip)}
              isThreadLoading={state.isLoading}
              onRetryStream={() => onAction({ type: 'RetryLastRequest' })}
            />
          </ReserveRow>
        );
      }
      case 'loading':
        return (
          // ChatThreadContent.kt LoadingPlaceholder: LogoSpinnerHorizontal + "Getting your
          // answer…" — the same spinner the streaming status uses (no shimmer on RN; see
          // LogoSpinner). As the final row it holds the same viewport reserve as an answer, so
          // the question above it stays pinned at the top (ChatReserve.kt).
          <ReserveRow
            id={item.id}
            minHeight={state.messages[state.messages.length - 1]?.id === item.id ? reserveHeight : null}
            onContentLayout={onReserveContentLayout}
          >
            <View style={styles.loadingBubble} accessibilityLiveRegion="polite">
              <LogoSpinner
                message={label(Labels.GETTING_YOUR_ANSWER, 'Getting your answer…')}
                style={INLINE_SPINNER_STYLE}
              />
            </View>
          </ReserveRow>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surfaceReading }]}>
      <LogoAppBar
        // ChatScreen.kt: History → Menu; Home → the self-contained R.drawable.leftbutton back
        // arrow. CHAT_ONLY has no Home behind it, so it keeps the close glyph (as on web).
        // Drawer off (the CHAT_ONLY default): a history thread gets a plain back instead of a
        // menu that would open a suppressed drawer (web ChatScreen / views ChatFragment parity).
        navIcon={
          isHistoryEntry
            ? sdk.config.showDrawer
              ? 'menu'
              : 'back'
            : sdk.config.mode === 'CHAT_ONLY'
              ? 'close'
              : 'homeBack'
        }
        onNavPress={() => {
          if (isHistoryEntry && !sdk.config.showDrawer) {
            props.onBack();
          } else if (isHistoryEntry) {
            props.onOpenDrawer();
          } else {
            sdk.analytics.track(AnalyticsEvents.CHAT_SCREEN_BACK_BUTTON_CLICK, {});
            props.onClose();
          }
        }}
        showLogo={uiState.kind === 'thread' && !state.isLoading}
        // ChatFragment.setUpAppBarActions / web ChatScreen: with the drawer OFF (the CHAT_ONLY
        // default) there is otherwise no way to reach Past Advice or the language screen. History
        // is gated on showHistory; language is always shown — it is the only way to change
        // language once onboarding is skipped. With the drawer on, the drawer stays the single
        // navigation surface.
        rightContent={
          sdk.config.showDrawer ? undefined : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {sdk.config.showHistory ? (
                <ActionButton
                  testID="fc-chat-history"
                  accessibilityLabel={label(Labels.RECENT_CHATS, 'Recent Chats')}
                  onPress={props.onOpenHistory}
                  icon="timer"
                  background={theme.brand.surfaceSecondary}
                  iconColor={theme.brand.foregroundPrimary}
                  style={{ borderRadius: radius.md }}
                />
              ) : null}
              <ActionButton
                testID="fc-chat-language"
                accessibilityLabel={label(Labels.LANGUAGE, 'Language')}
                onPress={props.onOpenLanguage}
                icon="language"
                background={theme.brand.surfaceSecondary}
                iconColor={theme.brand.foregroundPrimary}
                style={{ borderRadius: radius.md }}
              />
            </View>
          )
        }
      />

      {uiState.kind === 'loading' ? (
        // ChatLoadingContent.kt: Column(padding h20 / top 20, spacedBy 16) — top-aligned.
        <View style={styles.initialColumn}>
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
          <View accessibilityLiveRegion="polite">
            <LogoSpinner
              message={label(Labels.GETTING_YOUR_ANSWER, 'Getting your answer…')}
              style={INLINE_SPINNER_STYLE}
            />
          </View>
        </View>
      ) : uiState.kind === 'error' ? (
        // ChatErrorContent.kt: same column; the question bubble, then InlineErrorContent (fixed
        // "Something went wrong" label — never the raw error).
        <View style={styles.initialColumn}>
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
          {uiState.audioUri ? (
            <VoiceRetryPill onPress={retryVoice} />
          ) : (
            <InlineErrorContent onRetry={retryLastRequest} />
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <FlatList
              ref={listRef}
              data={state.messages}
              renderItem={renderMessage}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.thread}
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              onScrollToIndexFailed={onScrollToIndexFailed}
              onStartReached={onScrollNearTop}
              onStartReachedThreshold={0.2}
              onLayout={(e: LayoutChangeEvent) => {
                const h = e.nativeEvent.layout.height;
                scrollMetrics.current.viewport = h;
                setViewportHeight((prev) => (prev === h ? prev : h));
                updateContentBelow();
              }}
              onContentSizeChange={(_w, h) => {
                scrollMetrics.current.content = h;
                updateContentBelow();
              }}
              onScroll={(e) => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                scrollMetrics.current = {
                  content: contentSize.height,
                  offset: contentOffset.y,
                  viewport: layoutMeasurement.height,
                };
                updateContentBelow();
              }}
              scrollEventThrottle={100}
              ListHeaderComponent={
                state.isLoadingMoreHistory ? (
                  <LogoSpinner message={label('chat_loading_older', 'Loading older messages…')} />
                ) : null
              }
              // ChatThreadContent.kt:239 — contentPadding bottom = inputButtonsHeight + 16. Both
              // RN input surfaces (the InputComposer and the legacy Photo/Speak/Type row) are flow
              // siblings BELOW this list, not overlays, so they already take their own height;
              // the 16 is the list's spacedBy gap before this (zero-height) footer.
              ListFooterComponent={
                <ThreadFooter
                  showError={standaloneError}
                  onRetry={retryLastRequest}
                />
              }
            />
            {/* ChatThreadContent.kt:576 — only with no error, not loading, and content below;
                padding(bottom = inputButtonsHeight + 16) = 16 above this list's bottom edge,
                since the input surface is a flow sibling here. */}
            <ScrollIndicator
              triggerKey={
                !state.isLoading && state.errorMessage === null
                  ? state.messages.filter((m) => m.kind === 'ai').length
                  : null
              }
              available={contentBelow && !state.isLoading && state.errorMessage === null}
              onPress={scrollToContentEnd}
              style={styles.scrollIndicator}
            />
          </View>
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
            sendLabel={label('fc_v2_app_label_send', 'Send')}
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

/**
 * A chat row that may hold the viewport reserve (`minHeight`). The tree shape never changes with
 * the reserve (so toggling it cannot remount the row and restart its typewriter); the inner View
 * reports the row's REAL content height so the scroll indicator can ignore the blank reserve.
 */
function ReserveRow(props: {
  id: string;
  minHeight: number | null;
  style?: StyleProp<ViewStyle>;
  onContentLayout: (id: string, height: number) => void;
  children: React.ReactNode;
}): React.ReactElement {
  const { id, onContentLayout } = props;
  return (
    <View style={[props.style, props.minHeight != null ? { minHeight: props.minHeight } : null]}>
      <View onLayout={(e: LayoutChangeEvent) => onContentLayout(id, e.nativeEvent.layout.height)}>
        {props.children}
      </View>
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
  /** Host `enableVoice`: false removes the Listen pill entirely. */
  ttsAvailable: boolean;
  /** Server TTS flag: false keeps the pill but dims it (alpha 0.4) and disables it. */
  isTtsEnabled: boolean;
  isLoadingTts: boolean;
  isPlayingTts: boolean;
  onListen: () => void;
  onShare: () => void;
  onReadFullAdvice?: () => void;
  /** Endpoint #29 follow-ups (`ChatState.suggestedQuestions`). */
  followUps: string[] | null;
  /** "Choose an option from the below" title + agentic chips instead of "You can also ask". */
  followUpsClarification: boolean;
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
  const isThreadLoading = props.isThreadLoading === true;
  // The viewport reserve (Compose `streamReserveModifier`, core ChatReserve.kt) is applied by
  // the caller's ReserveRow wrapper — streaming, interrupted, FINISHED (`!isLoading`) and
  // pending-alignment — paired with ChatScreen's anchor scroll that pins the question on top.
  const additiveAlignmentKind =
    message.alignmentKind != null && isAdditiveAlignment(message.alignmentKind)
      ? message.alignmentKind
      : null;
  // ChatThreadContent.kt:500 — the action block belongs to the last response once the thread is
  // idle (`isLastResponse && !isLoading`), and here also only once the typewriter has finished
  // and never while a stream is running or after it broke. (AiAnswerBlock reports "revealed"
  // immediately when animate=false, which is every delta of a stream.)
  const showActions =
    props.isLast && props.revealed && !isStreaming && !isInterrupted && !isThreadLoading;
  // ChatResponseActions.kt `showFollowUps`: false only when an additive alignment surface with
  // chips renders below and owns the next action. NOT hidden by an error.
  const showFollowUps = !(
    additiveAlignmentKind !== null && (message.alignmentChips ?? []).length > 0
  );
  const followUps = props.followUps ?? [];
  const streamStatusText =
    message.streamingStatus != null && message.streamingStatus.trim().length > 0
      ? message.streamingStatus
      : null;
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

        {/* Tool progress, or the initial "getting your answer" state before any text arrives.
            ChatThreadContent.kt places it directly under the MarkdownText (no spacer). */}
        {isStreaming && (message.text.length === 0 || streamStatusText !== null) ? (
          <LogoSpinner
            message={streamStatusText ?? label(Labels.GETTING_YOUR_ANSWER, 'Getting your answer…')}
            style={INLINE_SPINNER_STYLE}
          />
        ) : null}

        {/* Text is flowing but has stalled with no tool status: a transient client-side hint,
            NOT a failure. Keyed on text length so the next delta clears it automatically. */}
        {isStreaming && message.text.length > 0 && streamStatusText === null ? (
          <StreamStallHint messageId={message.id} textLength={message.text.length} />
        ) : null}
      </View>

      {/* Interrupted terminal state: keep any partial answer above and offer retry. Only the
          latest answer shows the card — an older failed question keeps its partial text but
          drops the retry action. StreamErrorCard carries its own 16dp top offset. */}
      {isInterrupted && props.isLast ? (
        <StreamErrorCard
          errorKind={message.streamErrorKind ?? StreamErrorKinds.UNKNOWN}
          hasPartial={message.text.trim().length > 0}
          onRetry={() => props.onRetryStream?.()}
        />
      ) : null}
      {showActions ? (
        // ChatResponseActions.kt: Column(padding top 24). Its AnimatedVisibility enter is
        // fadeIn() only — no slide.
        <FadeIn style={styles.aiActions} rise={false}>
          {/* ChatResponseActions.kt (app dev/v2.5): the branches are EXCLUSIVE. A pre-generated
              answer with "Read full advice" available shows ONLY that button (+16); every other
              answer (agentic, legacy, pre-generated after the tap) gets the agentic row (+1) —
              ChatThreadContent.kt passes `useChips = true` for all of them. */}
          {message.isPreGenerated && props.onReadFullAdvice ? (
            <>
              <AttentionWobble delayMs={1800}>
                <PrimaryButton
                  label={label(Labels.READ_FULL_ADVICE, 'Read full advice')}
                  onPress={props.onReadFullAdvice}
                />
              </AttentionWobble>
              <View style={{ height: 16 }} />
            </>
          ) : (
            <>
              <View style={styles.aiWarning}>
                <FcIcon name="info" size={18} tint={theme.content.buttonPrimaryAccent} />
                <Text
                  style={[
                    typography.labelSmall,
                    { color: theme.content.foregroundSecondary, flexShrink: 1 },
                  ]}
                >
                  {label(
                    Labels.AI_MAY_BE_WRONG_PLEASE_DOUBLE_CHECK,
                    'AI may be wrong. Please double-check.',
                  )}
                </Text>
              </View>
              <View style={styles.actionRow}>
                {message.hideShareIcon !== true ? (
                  <ActionChip
                    icon="share"
                    text={label(Labels.SHARE_DOWNLOAD, 'Share')}
                    accentBorder
                    onPress={props.onShare}
                  />
                ) : null}
                {props.ttsAvailable && message.hideTtsSpeaker !== true ? (
                  <ActionChip
                    icon={props.isPlayingTts ? 'pause' : 'speaker'}
                    text={label(Labels.LISTEN, 'Listen')}
                    isLoading={props.isLoadingTts}
                    enabled={props.isTtsEnabled}
                    onPress={props.onListen}
                  />
                ) : null}
              </View>
              <View style={{ height: 1 }} />
            </>
          )}
          {/* The follow-ups live INSIDE the last answer's column (so inside its reserve), not as
              a separate list item after it: [fadeIn 300: 16, titleMedium title, 10, chips 8
              apart] + 28 + 12. */}
          {showFollowUps ? (
            <>
              {followUps.length > 0 ? (
                <FadeIn durationMs={300} rise={false}>
                  <View style={{ height: 16 }} />
                  <Text style={[typography.titleMedium, { color: theme.content.foregroundPrimary }]}>
                    {props.followUpsClarification
                      ? label(Labels.CHOOSE_A_FOLLOWUP_OPTION_BELOW, 'Choose an option from the below')
                      : label(Labels.RELATED_QUESTIONS, 'You can also ask')}
                  </Text>
                  <View style={{ height: 10 }} />
                  <View style={styles.followUpChips}>
                    {followUps.map((q, index) => (
                      <NumberedChip
                        key={`${index}-${q}`}
                        label={q}
                        number={index + 1}
                        visual={props.followUpsClarification ? 'agentic' : 'suggested'}
                        onPress={() => props.onFollowUp(q)}
                      />
                    ))}
                  </View>
                </FadeIn>
              ) : null}
              <View style={{ height: 28 + 12 }} />
            </>
          ) : null}
        </FadeIn>
      ) : null}

      {/* ADDITIVE surface: a nudge below the real answer (gender-select / commodity-confirm),
          16dp under it, and only once the message is no longer streaming. Single-tap; the
          answer above keeps its own action row. */}
      {additiveAlignmentKind !== null && !isStreaming ? (
        <View style={styles.additiveSurface}>
          <AlignmentSurface
            kind={additiveAlignmentKind}
            message={message.alignmentMessage ?? ''}
            chips={message.alignmentChips ?? []}
            selectedValues={message.alignmentSelectedValues ?? []}
            isLoading={isThreadLoading}
            isLatest={props.isLast}
            additive
            onChipPress={(chip) => props.onAlignmentChipPress?.(chip)}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Light (agentic) action pill under the last answer — Compose `ActionButton(radius = Rounded,
 * background = surfaceReadingSecondary)` for Share and `ListenButton(light = true)` for Listen:
 * 42dp tall, foregroundPrimary 23dp icon + labelMedium. Share carries the 3dp
 * `brand.accentSweepBorder` sweep gradient ({@link SweepBorder}).
 *
 * `enabled = false` is ListenButton.kt's TTS-off treatment: still drawn, at alpha 0.4, and not
 * clickable.
 */
function ActionChip(props: {
  icon: React.ComponentProps<typeof FcIcon>['name'];
  text: string;
  isLoading?: boolean;
  enabled?: boolean;
  /** Share only: the 3dp accent sweep border. */
  accentBorder?: boolean;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const enabled = props.enabled !== false;
  const content = (
    <>
      {props.isLoading ? (
        <ActivityIndicator size="small" color={c.foregroundPrimary} />
      ) : (
        <FcIcon name={props.icon} size={23} tint={c.foregroundPrimary} />
      )}
      <Text style={[typography.labelMedium, { color: c.foregroundPrimary }]}>{props.text}</Text>
    </>
  );
  if (props.accentBorder) {
    return (
      <Pressable
        onPress={props.onPress}
        disabled={props.isLoading === true || !enabled}
        accessibilityRole="button"
        style={({ pressed }) => ({ opacity: !enabled ? 0.4 : pressed ? 0.75 : 1 })}
      >
        <SweepBorder
          width={ACCENT_BORDER_WIDTH}
          radius={ACTION_CHIP_HEIGHT / 2}
          innerStyle={[
            styles.actionChipInner,
            { backgroundColor: c.surfaceReadingSecondary, paddingLeft: 12 - ACCENT_BORDER_WIDTH, paddingRight: 16 - ACCENT_BORDER_WIDTH },
          ]}
        >
          {content}
        </SweepBorder>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.isLoading === true || !enabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [
        styles.actionChip,
        {
          paddingHorizontal: 12,
          gap: 6,
          backgroundColor: c.surfaceReadingSecondary,
          opacity: !enabled ? 0.4 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {content}
    </Pressable>
  );
}

/** ActionButton.kt: 42dp pill; the accent border is 3dp of it. */
const ACTION_CHIP_HEIGHT = 42;
const ACCENT_BORDER_WIDTH = 3;

/** ChatThreadContent.kt: LazyColumn spacedBy(16) — also the gap after the last item. */
const THREAD_BOTTOM_GAP = 16;

/**
 * Reveal animation for the answer actions and the related-questions block.
 *
 * `rise` (the default) adds an 8px lift to the fade. Both chat call sites opt out: app parity
 * (`ChatThreadContent.kt` AnimatedVisibility(enter = fadeIn()) for the action block, and
 * `ChatResponseActions.kt` fadeIn(tween(300)) for the follow-ups) is a fade only, "so surrounding
 * content doesn't shift".
 */
function FadeIn(props: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  durationMs?: number;
  rise?: boolean;
}): React.ReactElement {
  const anim = useRef(new Animated.Value(0)).current;
  const duration = props.durationMs ?? 350;
  const rise = props.rise ?? true;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }).start();
  }, [anim, duration]);
  return (
    <Animated.View
      style={[
        props.style,
        {
          opacity: anim,
          transform: rise
            ? [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }]
            : [],
        },
      ]}
    >
      {props.children}
    </Animated.View>
  );
}

/**
 * AttentionWobble.kt `attentionWobble(delayMs)` with its defaults: after the delay, one bounce
 * (scale → 0.95 on spring(ζ 0.7, k 800), back → 1 on spring(ζ 0.35, k 400)), then 2 rotation
 * cycles of +1.5° (60ms) → −1.5° (120ms) → 0 (60ms), EaseInOut. RN spring damping = 2ζ√k.
 *
 * DEVIATION: the app gates this on Remote Config (`v2_wobble_animation_enabled`) and a
 * once-per-day card-click rule; the SDK has neither (and may not add storage keys), so it always
 * plays.
 */
function AttentionWobble(props: { delayMs: number; children: React.ReactNode }): React.ReactElement {
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);
    const turn = (toValue: number, duration: number) =>
      Animated.timing(rotation, { toValue, duration, easing: easeInOut, useNativeDriver: true });
    const cycle = () => Animated.sequence([turn(1.5, 60), turn(-1.5, 120), turn(0, 60)]);
    const anim = Animated.sequence([
      Animated.delay(props.delayMs),
      Animated.spring(scale, { toValue: 0.95, stiffness: 800, damping: 2 * 0.7 * Math.sqrt(800), mass: 1, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, stiffness: 400, damping: 2 * 0.35 * Math.sqrt(400), mass: 1, useNativeDriver: true }),
      cycle(),
      cycle(),
    ]);
    anim.start();
    return () => anim.stop();
  }, [props.delayMs, scale, rotation]);
  const rotate = rotation.interpolate({ inputRange: [-1.5, 1.5], outputRange: ['-1.5deg', '1.5deg'] });
  return (
    <Animated.View style={{ transform: [{ scale }, { rotate }] }}>{props.children}</Animated.View>
  );
}

/**
 * ChatThreadContent.kt user item: Column(spacedBy 12) [bubble row (start padding 64, End), the
 * InlineErrorContent of a failed question], faded in over 500ms. A failed LAST question holds
 * `minHeight` (the viewport) so it stays pinned with the retry row beneath it.
 */
function UserItem(props: {
  message: UserMessage;
  failed: boolean;
  minHeight: number | null;
  onRetry: () => void;
  onVoiceRetry: () => void;
}): React.ReactElement {
  const alpha = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(alpha, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [alpha]);
  return (
    <Animated.View
      style={[
        styles.userItem,
        { opacity: alpha },
        props.minHeight != null ? { minHeight: props.minHeight } : null,
      ]}
    >
      <UserBubble message={props.message} />
      {props.failed ? (
        props.message.audioUri ? (
          <VoiceRetryPill onPress={props.onVoiceRetry} />
        ) : (
          <InlineErrorContent onRetry={props.onRetry} />
        )
      ) : null}
    </Animated.View>
  );
}

/**
 * ChatThreadContent.kt:314 / ChatErrorContent.kt: a failed VOICE question gets
 * LogoSpinnerHorizontal(state = Retry) right-aligned instead of InlineErrorContent — a
 * surfaceTertiary radius-12 pill (padding s10 e14 v10, spacedBy 6) with a 23dp Refresh and a
 * labelMedium "Try again". (No analytics on this branch in the app.)
 */
function VoiceRetryPill(props: { onPress: () => void }): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();
  const c = theme.content;
  return (
    <View style={styles.voiceRetryRow}>
      <Pressable
        accessibilityRole="button"
        onPress={props.onPress}
        style={({ pressed }) => [
          styles.voiceRetryPill,
          { backgroundColor: c.surfaceTertiary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <FcIcon name="refresh" size={23} tint={c.foregroundPrimary} />
        <Text style={[typography.labelMedium, { color: c.foregroundPrimary }]}>
          {label(Labels.TRY_AGAIN, 'Try again')}
        </Text>
      </Pressable>
    </View>
  );
}

/** The thread's (zero-height) footer: only an error that is not tied to a question bubble. */
function ThreadFooter(props: { showError: boolean; onRetry: () => void }): React.ReactElement {
  return (
    <View style={styles.footer}>
      {props.showError ? <InlineErrorContent onRetry={props.onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // ChatLoadingContent.kt / ChatErrorContent.kt: Column(padding h20, top 20, spacedBy 16).
  initialColumn: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  // ChatThreadContent.kt: padding(horizontal 20), contentPadding(top 20), spacedBy(16); the
  // bottom 16 is the gap before the footer (see ListFooterComponent).
  thread: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 0, gap: THREAD_BOTTOM_GAP },
  userItem: { gap: 12 },
  // Row(fillMaxWidth, padding(start = 64), Arrangement.End).
  userRow: { alignItems: 'flex-end', gap: spacing.xs, paddingLeft: 64 },
  userBubble: {
    // UserChatBubble.kt widthIn(max = 290.dp).
    maxWidth: 290,
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
  // The item is a plain Column: children stretch, and every gap is an explicit app spacer.
  aiRow: { alignItems: 'stretch' },
  // The AI answer reads directly on the reading surface (no bordered bubble) to
  // match the redesign; markdown + optional source note only.
  aiBubble: { width: '100%', paddingRight: spacing.xs },
  // ChatResponseActions.kt Column(padding top = 24).
  aiActions: { width: '100%', paddingTop: 24 },
  // ChatResponseActions.kt: Share + Listen spacedBy(8), 12dp under the AI note.
  actionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  additiveSurface: { marginTop: 16 },
  followUpChips: { gap: 8 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ACTION_CHIP_HEIGHT,
    borderRadius: radius.rounded,
  },
  actionChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: ACTION_CHIP_HEIGHT - 2 * ACCENT_BORDER_WIDTH,
  },
  // ChatResponseActions.kt: info icon + "AI may be wrong" note, 6dp apart.
  aiWarning: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clarification: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  loadingBubble: { alignItems: 'flex-start' },
  footer: { paddingTop: 0 },
  voiceRetryRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  voiceRetryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  // 40dp disc, bottom-centred, 16 above the list's bottom edge.
  scrollIndicator: { position: 'absolute', bottom: 16, left: '50%', marginLeft: -20 },
});
