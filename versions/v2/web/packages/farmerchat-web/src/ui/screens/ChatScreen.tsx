/**
 * Chat (docs/01 §3.8): thread with markdown answers, user bubbles (text /
 * voice clip / image), follow-up chips (endpoint #29), clarification label,
 * Read-full-advice for pre-generated answers, Listen (TTS), share/download
 * answer card via canvas, retry on failure, history pagination (load older on
 * scroll-up, position restore), scroll-to-bottom indicator, input overlays.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLabel, useSdk } from '../context';
import { LogoSpinner, PrimaryButton, Toast } from '../components/common';
import { ActionButton } from '../components/common';
import { FcIcon } from '../components/FcIcon';
import { ChatResponseActions, FollowUpSection, LogoAppBar, ScrollIndicator, Tips } from '../components/chatParts';
import { AiAnswerBlock } from '../components/AiAnswerBlock';
import { AlignmentSurface, StreamErrorCard, StreamProgress } from '../components/agentic';
import { capabilityChipRoute, isAdditiveAlignment } from '../../core/alignment';
import type { AlignmentKind } from '../../core/alignment';
import type { AlignmentChip } from '../../core/types';
import { PrefKeys } from '../../core/storage';
import { isLocationSuccess, type LocationPromptActions } from '../../state/useLocationPrompt';
import { TextInputOverlay, VoiceInputOverlay, PhotoInputOverlay, PrimaryInputButtons, VoiceClip, InputKind } from '../components/inputs';
import { InputComposer, ComposerAttachment, InputComposerHandle } from '../components/InputComposer';
import { LocationChatBubble } from '../components/LocationChatBubble';
import { composerBarHeight } from '../components/composerLayout';
import { shareAnswerCard, downloadAnswerCard } from '../components/shareCard';
import { useChat, AiResponse, UserMessage } from '../../state/useChat';
import { Events, Screens } from '../../core/analytics';
import type { ChatRouteParams } from '../router';

export function ChatScreen(props: {
  params: ChatRouteParams;
  onClose: () => void;
  onOpenDrawer: () => void;
  /**
   * 2.0.0: the GPS_PROMPT capability chip drives the shared location flow, whose state machine
   * and overlay live in `FarmerChatRoot` (Compose reads the same single
   * `graph.locationPromptManager` from the chat screen).
   */
  locationActions: LocationPromptActions;
}) {
  const { services, toast, navigator } = useSdk();
  const label = useLabel();
  const [chat, actions] = useChat(services);
  const [overlay, setOverlay] = useState<InputKind | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const initRef = useRef(false);
  const prevHeightRef = useRef(0);
  const loadingOlderRef = useRef(false);

  const { params } = props;
  const isHistoryEntry = params.source === 'history';

  // 2.0.0: with the composer on, the unified InputComposer replaces BOTH the Photo/Speak/Type row
  // and the text overlay — Compose gates exactly this on `config.resolvedComposerUi`: the host's
  // `enableComposerUi`, or `enableAgenticChat` when omitted (the app's independent
  // `v2_composer_ui_enabled` flag). With it off nothing below changes, so a 1.0.0 host keeps v1.
  const isComposerUi = services.config.composerUi;
  const composerRef = useRef<InputComposerHandle | null>(null);
  // A single image per query, mirroring Compose's `photoUris` (rendered `.take(1)`). The photo
  // overlay fills this; `onSend` consumes it, so the question and the image travel together.
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);

  // The alignment escape hatch ("Type or say it.") must land on whichever input surface is live:
  // the composer field when it owns the bar (Compose calls `focusTextInput`), else the overlay
  // the composer replaced.
  const focusComposerOrTypeOverlay = useCallback(() => {
    if (isComposerUi) composerRef.current?.focus();
    else setOverlay('type');
  }, [isComposerUi]);

  // Send from the composer: an attached image routes through image analysis (#28), plain text
  // through the follow-up path — the same split as Compose's `sendFromComposer`.
  const sendFromComposer = useCallback(
    (text: string) => {
      const attachment = attachments[0];
      const file = attachment?.file;
      setAttachments([]);
      if (file && attachment) {
        void actions.sendQuestionWithImage(text.trim(), file, attachment.url);
      } else if (text.trim().length > 0) {
        void actions.sendFollowUpQuestion(text.trim());
      }
    },
    [actions, attachments],
  );

  // ---------------------------------------------------------------- capability chips (2.0.0)
  // GPS_PROMPT and UPLOAD_PHOTO chips do NOT send their text as a question — they invoke a
  // browser capability and only the OUTCOME is sent. Every other chip stays on the plain
  // `selectAlignmentChip` path. Port of Compose's `handleAlignmentChip`.
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const locationActionsRef = useRef(props.locationActions);
  locationActionsRef.current = props.locationActions;

  // The location prompt lives in FarmerChatRoot and outlives this screen, so an armed outcome
  // callback must be dropped when the screen goes away — otherwise it would fire into an
  // unmounted chat.
  useEffect(() => {
    const actionsRef = locationActionsRef;
    return () => actionsRef.current.cancelPendingOutcome();
  }, []);

  /**
   * The address shown in the location bubble, assembled as the app does it: approximate location
   * name, then state, then country — blank parts dropped, de-duplicated, joined with ", ".
   *
   * `APPROX_LOCATION_NAME` (ported 2026-10-08: written by the location flow, district > state >
   * country, and back-filled from the profile on Home entry) leads; `USER_DISTRICT` is the
   * fallback for installs that predate the key.
   */
  const resolveLocationAddress = useCallback((): string => {
    const parts = [
      services.store.getString(PrefKeys.APPROX_LOCATION_NAME) || services.store.getString(PrefKeys.USER_DISTRICT),
      services.store.getString(PrefKeys.USER_STATE),
      services.store.getString(PrefKeys.USER_COUNTRY_NAME),
    ]
      .map((value) => (value ?? '').trim())
      .filter((value) => value.length > 0);
    return Array.from(new Set(parts)).join(', ');
  }, [services.store]);

  /** A photo picked for an UPLOAD_PHOTO chip: attached in composer mode, sent immediately else. */
  const handleCapabilityPhoto = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      const url = URL.createObjectURL(file);
      if (isComposerUi) {
        // App parity (Compose `cameraLauncher`/`galleryLauncher`): in composer mode the photo is
        // ATTACHED so it can be sent together with typed text. Only one image is allowed, so a
        // new pick replaces the old.
        setAttachments([{ url, file, alt: label('photo_attached', 'Attached photo') }]);
        composerRef.current?.focus();
        return;
      }
      void actions.sendQuestionWithImage('', file, url);
    },
    [actions, isComposerUi, label],
  );

  /**
   * Routes an alignment chip tap through the ONE routing table in `core/alignment.ts`: capability
   * chips invoke a capability, everything else sends text. Port of the app's
   * `onAlignmentChipClick`.
   */
  const handleAlignmentChip = useCallback(
    (messageId: string, kind: AlignmentKind, chip: AlignmentChip) => {
      switch (capabilityChipRoute(kind, chip)) {
        case 'LOCATION':
          // Interstitial / permission / recovery are owned by LocationPromptOverlay; the outcome
          // comes back on the callback armed here, keyed to THIS message, so an outcome belonging
          // to Home or Settings can never land on this surface. The hook refuses to arm while
          // another location flow is in progress (Compose's `Idle` guard).
          props.locationActions.triggerFromLocalContext((outcome) => {
            // Success = a fix is stored: 'location_fetched', or 'post_settings_preference_exists'
            // (permission re-granted from the Recovery sheet with a fix already saved).
            if (isLocationSuccess(outcome)) {
              void actions.sendLocationSharedQuery(messageId, resolveLocationAddress());
              return;
            }
            // Denied / cancelled / fetch failed: still answer the blocking question, by sending
            // the decline text as an ordinary follow-up. The app sends this through
            // `SendAlignmentChip` with `locationDeclined` + parent_message_id; the SDK has
            // neither, so the correlation and the chip analytics are lost (docs/04).
            //
            // The label key is real (app `Labels.kt:222`) but endpoint #3 does not serve it yet,
            // so the English fallback is what actually renders today. Do not shorten the key.
            void actions.sendFollowUpQuestion(
              label('fc_v2_app_label_location_permission_declined', 'Continue without sharing my location'),
            );
          });
          break;
        case 'CAMERA':
          // Straight to the camera picker — NOT the composer's photo overlay, which would ask the
          // farmer to choose a source they already chose on the chip.
          cameraInputRef.current?.click();
          break;
        case 'GALLERY':
          galleryInputRef.current?.click();
          break;
        default:
          void actions.selectAlignmentChip(messageId, kind, chip);
      }
    },
    [actions, label, props.locationActions, resolveLocationAddress],
  );

  // Answer reveal (client-side typewriter, view-only — see AiAnswerBlock).
  // Tracks AiResponse ids whose reveal has finished. ONLY the newest fresh
  // answer animates; history + pre-generated answers render in full at once and
  // are NOT tracked here (their `revealed` gate is short-circuited below).
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const markRevealed = useCallback((id: string) => {
    setRevealedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Initialization — exactly one path (docs/01 §3.8 initialization LaunchedEffect).
  useEffect(() => {
    services.analytics.screenView(Screens.CHAT);
    if (!initRef.current) {
      initRef.current = true;
      if (isHistoryEntry && params.conversationId) {
        void actions.loadChatHistory(params.conversationId, 1);
      } else if (params.voiceBase64 && !params.question) {
        void actions.initializeVoicePrototype(
          {
            base64: params.voiceBase64,
            format: params.voiceFormat ?? 'ogg',
            mimeType: 'audio/webm',
            durationMs: 0,
            objectUrl: params.audioUri ?? '',
            blob: new Blob(),
          },
          Screens.HOME,
        );
      } else if (params.preGeneratedAnswer != null) {
        actions.initializeWithPreGeneratedContent(
          params.question ?? '',
          params.preGeneratedAnswer,
          params.followUpQuestions ?? null,
          params.homeStatementId != null ? Number(params.homeStatementId) || null : null,
          params.imageUri ?? null,
        );
      } else if (params.imageBlob && params.imageUri) {
        void actions.sendQuestionWithImage(params.question ?? '', params.imageBlob, params.imageUri);
      } else if (params.question) {
        void actions.initializeWithQuestion(params.question, {
          transcriptionId: params.transcriptionId ?? null,
          audioUri: params.audioUri ?? null,
          isWeatherAdviceCTA: params.isWeatherAdviceCTA ?? false,
          isSSFR: params.isSSFR ?? false,
          ssfrCrop: params.ssfrCrop ?? null,
          channel: params.channel ?? null,
          contentCardImageUrl: params.contentCardImageUrl ?? null,
        });
      }
    }
    return () => {
      services.analytics.screenExit(Screens.CHAT);
      actions.clearMessages(); // onDispose parity
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ reserve + pinning
  // ChatScreen.kt: the last response holds a min-height equal to the scroller's viewport, and the
  // farmer's question is scrolled to the TOP (20dp content padding) so the answer grows into the
  // reserve below it — the screen never follows the stream's tail. Keyed on the last message id,
  // isLoading and the first history load, exactly like Compose's LaunchedEffect.
  const [viewportHeight, setViewportHeight] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportHeight(el.clientHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const setRowRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  };
  const lastMessage = chat.messages[chat.messages.length - 1];
  const historyScrolledRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !lastMessage) return;
    if (loadingOlderRef.current) {
      // Older page prepended: keep the reading position.
      el.scrollTop = el.scrollHeight - prevHeightRef.current;
      loadingOlderRef.current = false;
      return;
    }
    if (isHistoryEntry && chat.isInitialHistoryLoaded && !historyScrolledRef.current) {
      // History entry: the first question sits at the top.
      historyScrolledRef.current = true;
      el.scrollTop = 0;
      return;
    }
    const msgs = chat.messages;
    const finalIdx = msgs.length - 1;
    const final = msgs[finalIdx];
    const finalHoldsReserve = final.kind === 'ai' && holdsReserve(final, true);
    let anchorIdx = finalIdx;
    if (finalHoldsReserve || final.kind === 'loading') {
      for (let i = finalIdx - 1; i >= 0; i--) {
        if (msgs[i].kind === 'user' || msgs[i].kind === 'location') {
          anchorIdx = i;
          break;
        }
      }
    }
    const anchor = rowRefs.current.get(msgs[anchorIdx].id);
    if (!anchor) return;
    const target = Math.max(0, anchor.offsetTop - 20);
    // A hidden page never animates a smooth scroll, and a layout change mid-animation can cut it
    // short; either way the question was left wherever it was. So check once the animation should
    // have finished and snap to the target, unless the farmer scrolled by hand in the meantime.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      el.scrollTo({ top: target });
      return;
    }
    let userScrolled = false;
    const onUser = () => { userScrolled = true; };
    const userEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    userEvents.forEach((n) => el.addEventListener(n, onUser, { passive: true }));
    el.scrollTo({ top: target, behavior: 'smooth' });
    const settle = setTimeout(() => {
      userEvents.forEach((n) => el.removeEventListener(n, onUser));
      // Re-read the anchor: rows above it may have changed height since the effect ran.
      const settled = Math.max(0, anchor.offsetTop - 20);
      if (!userScrolled && Math.abs(el.scrollTop - settled) > 2) el.scrollTo({ top: settled });
    }, 700);
    return () => {
      clearTimeout(settle);
      userEvents.forEach((n) => el.removeEventListener(n, onUser));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage?.id, chat.isLoading, chat.isInitialHistoryLoaded]);

  /** core ChatReserve.kt holdsChatReserve. */
  function holdsReserve(ai: AiResponse, isLastAi: boolean): boolean {
    if (!isLastAi) return false;
    const pendingAlignment = !!ai.alignmentKind && (ai.alignmentSelectedValues ?? []).length === 0;
    return !!ai.isStreaming || !!ai.isInterrupted || !chat.isLoading || pendingAlignment;
  }

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Load older pages near the top (docs/01 §3.8 history pagination).
    if (el.scrollTop <= 0 && chat.historyNextPage != null && !chat.isLoadingMoreHistory && params.conversationId) {
      prevHeightRef.current = el.scrollHeight;
      loadingOlderRef.current = true;
      void actions.loadChatHistory(params.conversationId, chat.historyNextPage);
    }
  }, [actions, chat.historyNextPage, chat.isLoadingMoreHistory, params.conversationId]);

  const share = useCallback(
    async (ai: AiResponse) => {
      services.analytics.track(Events.ANSWER_SHARE_BUTTON_CLICKED, { message_id: ai.messageId ?? '' });
      const question = lastUserQuestionBefore(chat.messages, ai.id);
      const result = await shareAnswerCard(
        question,
        ai.text,
        label('fc_v2_app_label_farmerchat', 'FarmerChat'),
        label('fc_v2_app_label_share_app_message', 'Answered by FarmerChat'),
      );
      if (result === 'failed') toast.show(label('fc_v2_app_label_failed_to_save', 'Failed to save'), { kind: 'error' });
    },
    [chat.messages, label, services.analytics, toast],
  );

  const download = useCallback(
    async (ai: AiResponse) => {
      services.analytics.track(Events.ANSWER_SAVE_BUTTON_CLICKED, { message_id: ai.messageId ?? '' });
      const question = lastUserQuestionBefore(chat.messages, ai.id);
      const ok = await downloadAnswerCard(
        question,
        ai.text,
        label('fc_v2_app_label_farmerchat', 'FarmerChat'),
        label('fc_v2_app_label_share_app_message', 'Answered by FarmerChat'),
      );
      if (!ok) toast.show(label('fc_v2_app_label_failed_to_save', 'Failed to save'), { kind: 'error' });
      else toast.show(label('fc_v2_app_label_saved_to_gallery', 'Saved to gallery'));
    },
    [chat.messages, label, services.analytics, toast],
  );

  const hasThread = chat.messages.some((m) => m.kind === 'ai' || m.kind === 'loading');
  // Id of the newest AI answer — the only message eligible for the reveal.
  let lastAi: AiResponse | null = null;
  for (const m of chat.messages) if (m.kind === 'ai') lastAi = m;
  const lastAiId = lastAi?.id ?? null;
  const lastAnswerRevealed = !lastAi || isHistoryEntry || !!lastAi.isPreGenerated || !!lastAi.isStreaming || revealedIds.has(lastAi.id) || !!lastAi.isAgentic;
  const followUps = chat.suggestedQuestions ?? [];
  const additiveSurfaceOpen = !!lastAi?.alignmentKind && isAdditiveAlignment(lastAi.alignmentKind) && (lastAi.alignmentChips ?? []).length > 0;
  const showFollowUps =
    followUps.length > 0 && !chat.isLoading && lastAnswerRevealed && !additiveSurfaceOpen && !lastAi?.hideFollowUpQuestion;
  const showTips = chat.isLoading && !(lastAi?.isStreaming && lastAi.text.trim().length > 0);
  const reserveStyle = viewportHeight > 0 ? { minHeight: viewportHeight } : undefined;
  const isChatOnly = services.config.mode === 'CHAT_ONLY';
  const drawerOn = services.config.showDrawer;

  // LogoAppBar's left button: Home entry → ArrowBack circle (CHAT_ONLY: Close, 12dp radius);
  // History entry → Menu (drawer on) or ArrowBack (drawer off), 12dp radius.
  const leading = isHistoryEntry
    ? drawerOn
      ? { icon: 'm_menu' as const, radius: 'md' as const, ariaLabel: 'menu', onClick: props.onOpenDrawer }
      : { icon: 'm_arrow_back' as const, radius: 'md' as const, ariaLabel: 'back', onClick: props.onClose }
    : isChatOnly
      ? { icon: 'm_close' as const, radius: 'md' as const, ariaLabel: 'close', onClick: props.onClose }
      : { icon: 'm_arrow_back' as const, radius: 'rounded' as const, ariaLabel: 'back', onClick: props.onClose };

  // InlineErrorContent.kt: [48dp red circle + white Close 24] 12dp ["Something went wrong" bodyMedium,
  // foregroundPrimary, weight 1] 8dp [Try again pill: surfaceTertiary, radius MD 12, padding 10/12,
  // Refresh 16 + 4dp + labelMedium]. The text is always the fixed label, never the raw error.
  const retry = () => {
    services.analytics.track(Events.CONTENT_TRY_AGAIN_CLICKED, { screen_name: Screens.CHAT });
    actions.clearError();
    void actions.retryLastRequest();
  };
  // ListenButton enabled = isTtsEnabled (ChatResponseActions.kt / AlignmentSurface.kt): when TTS is
  // off the pill is still drawn, dimmed. Server hide flag and a missing message id still remove it.
  const ttsFor = (ai: AiResponse) =>
    !ai.hideTtsSpeaker && ai.messageId
      ? {
          enabled: chat.isTtsEnabled,
          loading: chat.isLoadingSynthesiseAudio,
          playing: chat.isAudioPlaying,
          hasAudio: !!chat.audioPlaybackUrl,
          onClick: () => void actions.synthesiseAudio(ai.messageId!, ai.text),
        }
      : null;
  const followUpSection = (
    <div className="fcsdk-c-fadein300">
      <FollowUpSection
        title={
          chat.clarificationRequired
            ? label('fc_v2_app_label_choose_a_followup_option_below', 'Choose an option from the below')
            : label('fc_v2_app_label_related_questions', 'You can also ask')
        }
        questions={followUps}
        useChips
        clarificationRequired={chat.clarificationRequired}
        onClick={(_, q) => void actions.sendFollowUpQuestion(q)}
      />
    </div>
  );

  const inlineError = (
    <div className="fcsdk-c-inlineerror" role="alert">
      <span className="fcsdk-c-inlineerror-icon" aria-label="Error">
        <FcIcon name="m_close" size={24} tint="#FFFFFF" />
      </span>
      <span className="fc-t-bodyMedium fcsdk-c-inlineerror-text">
        {label('fc_v2_app_label_something_went_wrong', 'Something went wrong')}
      </span>
      <button type="button" className="fcsdk-c-inlineerror-retry" onClick={retry}>
        <FcIcon name="m_refresh" size={16} tint="currentColor" />
        <span className="fc-t-labelMedium">{label('fc_v2_app_label_try_again', 'Try again')}</span>
      </button>
    </div>
  );

  return (
    <div className={'fcsdk-screen fcsdk-c-chat' + (isComposerUi ? ' fcsdk-screen--composer' : '')}>
      <LogoAppBar
        leading={{
          ...leading,
          onClick: () => {
            services.analytics.track(Events.CHAT_SCREEN_BACK_BUTTON_CLICK, {});
            leading.onClick();
          },
        }}
        showLogo={hasThread && !chat.isLoading}
        trailing={
          !drawerOn ? (
            <span style={{ display: 'flex', gap: 8 }}>
              {services.config.showHistory ? (
                <ActionButton icon="icon_timer" radius="md" ariaLabel="history" onClick={() => navigator.push({ name: 'chatHistory' })} />
              ) : null}
              <ActionButton icon="icon_language" radius="md" ariaLabel="language" onClick={() => navigator.push({ name: 'settingsLanguage' })} />
            </span>
          ) : undefined
        }
      />

      <div className="fcsdk-c-chat-body">
        <div
          className="fcsdk-scroll fcsdk-c-chat-scroll"
          ref={scrollRef}
          onScroll={onScroll}
          style={{
            paddingBottom: isComposerUi
              ? // ChatThreadContent.kt:307 — bottom = inputButtonsHeight (composerBarHeight(floating)) + 16.dp.
                `calc(${composerBarHeight({ floating: true }) - 20 + 16}px + max(var(--fc-inset-bottom), 20px))`
              : 24,
          }}
        >
          {chat.isLoadingMoreHistory ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <LogoSpinner horizontal message={label('fc_v2_app_label_loading_more', 'Loading more...')} />
            </div>
          ) : null}

          {chat.messages.map((msg, idx) => {
            const isFinal = idx === chat.messages.length - 1;
            if (msg.kind === 'loading') {
              return (
                <div key={msg.id} ref={setRowRef(msg.id)} style={isFinal ? reserveStyle : undefined}>
                  {/* ChatThreadContent.kt LoadingPlaceholder: LogoSpinnerHorizontal with the shimmering
                      primary-colour label — the same component the streaming status uses. */}
                  <div role="status" aria-live="polite">
                    <LogoSpinner horizontal message={label('fc_v2_app_label_getting_your_answer', 'Getting your answer…')} />
                  </div>
                </div>
              );
            }
            if (msg.kind === 'user') {
              // ChatThreadContent.kt: Column(spacedBy 12) [bubble row, start padding 64] + the inline
              // error under the failed question; a failed LAST question holds a viewport of height
              // so it stays pinned at the top with the retry card beneath it.
              const failedHere = chat.failedMessageId === msg.id && !!chat.errorMessage && !chat.isLoading;
              return (
                <div
                  key={msg.id}
                  ref={setRowRef(msg.id)}
                  className="fcsdk-c-usercol"
                  style={failedHere && isFinal ? reserveStyle : undefined}
                >
                  <div className="fcsdk-c-row-end fcsdk-c-row-user">
                    <UserBubble message={msg} />
                  </div>
                  {failedHere ? inlineError : null}
                </div>
              );
            }
            if (msg.kind === 'location') {
              return (
                <div key={msg.id} ref={setRowRef(msg.id)} className="fcsdk-c-row-end">
                  <LocationChatBubble address={msg.address} label={label('fc_v2_app_label_your_location', 'Your location:')} />
                </div>
              );
            }
            const ai = msg;
            const isLastAi = ai.id === lastAiId;
            const shouldAnimate =
              isLastAi && !isHistoryEntry && !ai.isPreGenerated && !ai.isStreaming && !ai.isAgentic && !revealedIds.has(ai.id);
            const revealed = !shouldAnimate || revealedIds.has(ai.id);
            // Newest answer AND final row (core ChatReserve.kt isLastResponse): an unanswered
            // alignment surface with a typed follow-up below it must collapse, or two rows hold a
            // screenful each and the new question never reaches the top.
            const reserve = holdsReserve(ai, isLastAi && isFinal) ? reserveStyle : undefined;
            const alignmentKind = ai.alignmentKind ?? null;
            if (alignmentKind && !isAdditiveAlignment(alignmentKind)) {
              return (
                <div key={ai.id} ref={setRowRef(ai.id)} style={reserve}>
                  <AlignmentSurface
                    kind={alignmentKind}
                    message={ai.text}
                    chips={ai.alignmentChips ?? []}
                    selectedValues={ai.alignmentSelectedValues ?? []}
                    isLoading={chat.isLoading}
                    isLatest={isLastAi}
                    onChipClick={(chip) => handleAlignmentChip(ai.id, alignmentKind, chip)}
                    onTypeInstead={focusComposerOrTypeOverlay}
                    tts={ttsFor(ai)}
                  />
                </div>
              );
            }
            const streamingNoText = ai.isStreaming;
            const settled = isLastAi && !chat.isLoading && !ai.isInterrupted && revealed && !ai.isStreaming;
            return (
              <div key={ai.id} ref={setRowRef(ai.id)} className="fcsdk-c-ai" style={reserve}>
                {/* AiAnswer.kt: bare markdown at full width — no bubble, card or background. */}
                <AiAnswerBlock text={ai.text} animate={shouldAnimate} onRevealComplete={() => markRevealed(ai.id)} />
                {streamingNoText ? <StreamProgress text={ai.text} status={ai.streamingStatus} /> : null}
                {ai.isInterrupted && isLastAi ? (
                  <StreamErrorCard
                    errorKind={ai.streamErrorKind ?? 'UNKNOWN'}
                    hasPartial={ai.text.trim().length > 0}
                    onRetry={() => {
                      actions.clearError();
                      void actions.retryLastRequest();
                    }}
                  />
                ) : null}
                {settled ? (
                  <div className="fcsdk-c-settle">
                    {/* ChatResponseActions.kt (app dev/v2.5): Column(padding top 24) — "Read full
                        advice" (+16) REPLACES the action row on a pre-generated answer; every other
                        answer gets the agentic row (+1). The follow-ups live INSIDE this column (so
                        inside the last answer's viewport reserve), then 28 + 12 below. */}
                    {ai.isPreGenerated && chat.readFullAdviceRequestedForMessageId !== ai.id ? (
                      <div className="fcsdk-c-wobble fcsdk-c-wobble--block" style={{ marginBottom: 16 }}>
                        <PrimaryButton
                          label={label('fc_v2_app_label_read_full_advice', 'Read full advice')}
                          onClick={() => void actions.replacePreGeneratedWithQuestion(lastUserQuestionBefore(chat.messages, ai.id), 'card')}
                        />
                      </div>
                    ) : (
                      <div style={{ marginBottom: 1 }}>
                        <ChatResponseActions
                          agentic
                          showShare={!ai.hideShareIcon}
                          tts={ttsFor(ai)}
                          onShare={() => void share(ai)}
                          onSave={() => void download(ai)}
                        />
                      </div>
                    )}
                    {!additiveSurfaceOpen ? (
                      <>
                        {showFollowUps ? followUpSection : null}
                        <div style={{ height: 40 }} />
                      </>
                    ) : null}
                  </div>
                ) : null}
                {alignmentKind && isAdditiveAlignment(alignmentKind) && !ai.isStreaming ? (
                  <div style={{ marginTop: 4 }}>
                  <AlignmentSurface
                    kind={alignmentKind}
                    message={ai.alignmentMessage ?? ''}
                    chips={ai.alignmentChips ?? []}
                    selectedValues={ai.alignmentSelectedValues ?? []}
                    isLoading={chat.isLoading}
                    isLatest={isLastAi}
                    onChipClick={(chip) => handleAlignmentChip(ai.id, alignmentKind, chip)}
                  />
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* An error not tied to a question bubble (e.g. history) still gets the inline row. */}
          {chat.errorMessage && !chat.isLoading && !chat.messages.some((m) => m.id === chat.failedMessageId) ? inlineError : null}

        </div>

        <ScrollIndicator
          triggerKey={lastAi && !chat.isLoading && !chat.errorMessage ? lastAi.id : null}
          // ChatThreadContent.kt:669 — padding(bottom = inputButtonsHeight + 16.dp).
          bottom={isComposerUi ? composerBarHeight({ floating: true }) + 16 : 72 + 8 + 16}
          hasContentBelow={() => {
            const el = scrollRef.current;
            return !!el && el.scrollHeight - el.scrollTop - el.clientHeight >= 48 + (isComposerUi ? 92 : 24);
          }}
          onClick={() => {
            const el = scrollRef.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
          }}
        />

        {showTips ? <Tips /> : null}
      </div>

      {/* 2.0.0 composer, or the v1 Photo/Speak/Type row. The row is hidden while an input overlay
          is open; the composer instead slides off-screen (`visible`), keeping the same rhythm
          Compose gives it via `visible = !(isThread && state.isLoading)`. */}
      {isComposerUi ? (
        <InputComposer
          floating
          compact
          showAura
          fadeColor="var(--fc-c-reading-primary)"
          visible={!chat.isLoading && overlay === null}
          placeholder={label('fc_v2_app_label_ask_about_your_farm', 'Ask about your farm...')}
          attachments={attachments}
          onRemoveAttachment={(index) => setAttachments((list) => list.filter((_, i) => i !== index))}
          onReady={(handle) => {
            composerRef.current = handle;
          }}
          onPhotoClick={() => setOverlay('photo')}
          onVoiceClick={() => setOverlay('speak')}
          onSend={sendFromComposer}
          enableImages={services.config.enableImages}
          enableVoice={services.config.enableVoice}
          photoLabel={label('fc_v2_app_label_photo', 'Photo')}
          voiceLabel={label('fc_v2_app_label_speak', 'Speak')}
          sendLabel={label('fc_v2_app_label_send', 'Send')}
          removeLabel={label('photo_remove', 'Remove image')}
        />
      ) : overlay === null ? (
        <div className="fcsdk-chat-inputbar">
          <PrimaryInputButtons onSelect={setOverlay} enableVoice={services.config.enableVoice} enableImages={services.config.enableImages} />
        </div>
      ) : null}

      {/* The composer owns typing, so the text overlay it replaced is never opened in that mode. */}
      {!isComposerUi && overlay === 'type' ? (
        <TextInputOverlay
          onClose={() => setOverlay(null)}
          onPhoto={services.config.enableImages ? () => setOverlay('photo') : undefined}
          onVoice={services.config.enableVoice ? () => setOverlay('speak') : undefined}
          onSend={(text) => {
            setOverlay(null);
            void actions.sendFollowUpQuestion(text);
          }}
        />
      ) : null}
      {overlay === 'speak' ? (
        <VoiceInputOverlay
          onClose={() => setOverlay(null)}
          onPermissionDenied={() => {
            setOverlay(null);
            toast.show(label('mic_permission_denied', 'Microphone permission is needed to ask by voice.'), { kind: 'error' });
          }}
          onRecorded={(recording) => {
            setOverlay(null);
            void actions.sendFollowUpVoiceQuestion(recording);
          }}
        />
      ) : null}
      {overlay === 'photo' ? (
        <PhotoInputOverlay
          attachOnly={isComposerUi}
          onClose={() => setOverlay(null)}
          onPicked={(file, objectUrl, question) => {
            setOverlay(null);
            if (isComposerUi) {
              // Attach and focus the field: the question is typed beside the thumbnail.
              setAttachments([{ url: objectUrl, file, alt: label('photo_attached', 'Attached photo') }]);
              composerRef.current?.focus();
              return;
            }
            void actions.sendQuestionWithImage(question, file, objectUrl);
          }}
        />
      ) : null}

      {/* Capability-chip pickers. Hidden inputs clicked directly by `handleAlignmentChip`, so a
          `take_photo` / `choose_from_gallery` chip opens the camera or the gallery itself rather
          than the Photo overlay's source picker. `capture` is a hint browsers may ignore. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          handleCapabilityPhoto(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          handleCapabilityPhoto(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <Toast message={toast.message} />
    </div>
  );
}

/**
 * UserChatBubble.kt: max 290dp, 20/20/0/20 corners (bottom-end sharp), reading-secondary, 16dp
 * padding, 10dp gaps; a caption-less photo is a bare 220×160 radius-16 image.
 */
function UserBubble(props: { message: UserMessage }) {
  const m = props.message;
  if (m.imageUri && !m.text && !m.audioUri) {
    return <img className="fcsdk-c-userimg" src={m.imageUri} alt="" />;
  }
  return (
    <div className="fcsdk-c-user">
      {m.audioUri ? <VoiceClip src={m.audioUri} /> : null}
      {m.imageUri ? (
        <img
          src={m.imageUri}
          alt=""
          className={m.userBubbleImageWideBanner ? 'fcsdk-c-user-banner' : 'fcsdk-c-user-thumb'}
        />
      ) : null}
      {m.text ? <span className="fc-t-bodyMedium fcsdk-c-user-text">{m.text.trim()}</span> : null}
    </div>
  );
}

function lastUserQuestionBefore(messages: ReturnType<typeof useChat>[0]['messages'], aiId: string): string {
  let lastQuestion = '';
  for (const m of messages) {
    if (m.kind === 'ai' && m.id === aiId) break;
    if (m.kind === 'user' && m.text) lastQuestion = m.text;
  }
  return lastQuestion;
}
