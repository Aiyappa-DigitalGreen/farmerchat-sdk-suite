/**
 * Chat (docs/01 §3.8): thread with markdown answers, user bubbles (text /
 * voice clip / image), follow-up chips (endpoint #29), clarification label,
 * Read-full-advice for pre-generated answers, Listen (TTS), share/download
 * answer card via canvas, retry on failure, history pagination (load older on
 * scroll-up, position restore), scroll-to-bottom indicator, input overlays.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLabel, useSdk } from '../context';
import { Icon, LogoSpinner, Toast } from '../components/common';
import { AiAnswerBlock, ThinkingIndicator } from '../components/AiAnswerBlock';
import { AlignmentSurface, StreamErrorCard, StreamProgress } from '../components/agentic';
import { capabilityChipRoute, isAdditiveAlignment } from '../../core/alignment';
import type { AlignmentKind } from '../../core/alignment';
import type { AlignmentChip } from '../../core/types';
import { PrefKeys } from '../../core/storage';
import type { LocationPromptActions } from '../../state/useLocationPrompt';
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
  const { services, toast } = useSdk();
  const label = useLabel();
  const [chat, actions] = useChat(services);
  const [overlay, setOverlay] = useState<InputKind | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const initRef = useRef(false);
  const prevHeightRef = useRef(0);
  const loadingOlderRef = useRef(false);

  const { params } = props;
  const isHistoryEntry = params.source === 'history';

  // 2.0.0: with agentic chat on, the unified InputComposer replaces BOTH the Photo/Speak/Type row
  // and the text overlay — Compose gates exactly this on `isComposerUi = config.enableAgenticChat`
  // (ChatScreen.kt:167). With the flag off nothing below changes, so a 1.0.0 host keeps v1 input.
  const isComposerUi = services.config.enableAgenticChat;
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
   * Pref mapping, same deviation `HomeScreen`'s location pill already documents: the SDK has no
   * `APPROX_LOCATION_NAME` key on web (that one is written from `user_profile.display_address`,
   * which web's `GetLocationResponse` does not model), so `USER_DISTRICT` — the finest-grained
   * place the web location flow stores — stands in for it. Recorded in docs/04.
   */
  const resolveLocationAddress = useCallback((): string => {
    const parts = [
      services.store.getString(PrefKeys.USER_DISTRICT),
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
            if (outcome.kind === 'continue' && outcome.reason === 'location_fetched') {
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

  // While a fresh answer reveals, keep its growing tail (and blinking caret) in
  // view — but never yank the viewport if the user has scrolled up to read.
  const revealScrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 220) el.scrollTop = el.scrollHeight;
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
        });
      }
    }
    return () => {
      services.analytics.screenExit(Screens.CHAT);
      actions.clearMessages(); // onDispose parity
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll-to-bottom on new messages; position restore after history prepend.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (loadingOlderRef.current) {
      // Restore position after older page prepended.
      el.scrollTop = el.scrollHeight - prevHeightRef.current;
      loadingOlderRef.current = false;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [chat.messages.length, chat.isInitialHistoryLoaded]);

  // When a reveal finishes, the action row + follow-ups fade in below the answer
  // (message count is unchanged, so the effect above does not fire). Bring them
  // into view — but only if the user is already near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 320) el.scrollTop = el.scrollHeight;
  }, [revealedIds]);

  // While an agentic answer streams, its bubble grows without the message COUNT changing, so the
  // effect above never fires. Track the streamed text length and keep the tail in view (still
  // respecting a user who has scrolled up to read).
  let streamingTextLength = -1;
  for (const m of chat.messages) if (m.kind === 'ai' && m.isStreaming) streamingTextLength = m.text.length;
  useEffect(() => {
    if (streamingTextLength >= 0) revealScrollToBottom();
  }, [streamingTextLength, revealScrollToBottom]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distanceFromBottom > 260);
    // Load older pages near the top (docs/01 §3.8 history pagination).
    if (el.scrollTop < 60 && chat.historyNextPage != null && !chat.isLoadingMoreHistory && params.conversationId) {
      prevHeightRef.current = el.scrollHeight;
      loadingOlderRef.current = true;
      void actions.loadChatHistory(params.conversationId, chat.historyNextPage);
    }
  }, [actions, chat.historyNextPage, chat.isLoadingMoreHistory, params.conversationId]);

  const share = useCallback(
    async (ai: AiResponse) => {
      services.analytics.track(Events.ANSWER_SHARE_BUTTON_CLICKED, { message_id: ai.messageId ?? '' });
      const question = lastUserQuestionBefore(chat.messages, ai.id);
      const result = await shareAnswerCard(question, ai.text, label('app_name', 'FarmerChat'));
      if (result === 'failed') toast.show(label('chat_share_failed', 'Could not share the answer.'));
    },
    [chat.messages, label, services.analytics, toast],
  );

  const download = useCallback(
    async (ai: AiResponse) => {
      services.analytics.track(Events.ANSWER_SAVE_BUTTON_CLICKED, { message_id: ai.messageId ?? '' });
      const question = lastUserQuestionBefore(chat.messages, ai.id);
      const ok = await downloadAnswerCard(question, ai.text, label('app_name', 'FarmerChat'));
      if (!ok) toast.show(label('chat_download_failed', 'Could not download the answer.'));
      else toast.show(label('chat_download_done', 'Answer saved.'));
    },
    [chat.messages, label, services.analytics, toast],
  );

  const isInitialLoading = chat.isLoading && chat.messages.filter((m) => m.kind !== 'loading').length <= 1;
  const hasThread = chat.messages.length > 0;

  // Id of the newest AI answer — the only message eligible for the reveal.
  let lastAiId: string | null = null;
  for (const m of chat.messages) if (m.kind === 'ai') lastAiId = m.id;

  return (
    <div className={'fcsdk-screen fcsdk-chat-surface' + (isComposerUi ? ' fcsdk-screen--composer' : '')}>
      {/* LogoAppBar: Close for Home entry / Menu for History entry */}
      <div className="fcsdk-appbar">
        <button
          type="button"
          className="fcsdk-iconbtn"
          aria-label={isHistoryEntry ? 'menu' : 'close'}
          onClick={() => {
            services.analytics.track(Events.CHAT_SCREEN_BACK_BUTTON_CLICK, {});
            if (isHistoryEntry) props.onOpenDrawer();
            else props.onClose();
          }}
        >
          {isHistoryEntry ? Icon.menu : Icon.close}
        </button>
        <div className="fcsdk-appbar-title">
          {hasThread && !chat.isLoading ? `${Icon.logo} ${label('app_name', 'FarmerChat')}` : ''}
        </div>
      </div>

      <div
        className="fcsdk-scroll"
        ref={scrollRef}
        onScroll={onScroll}
        // Reserve the floating composer's height so the last bubble is not hidden behind it
        // (Compose: `contentPadding = composerBarHeight(floating = true)`).
        style={isComposerUi ? { paddingBottom: composerBarHeight({ floating: true, compact: true }) } : undefined}
      >
        {chat.isLoadingMoreHistory ? (
          <div className="fcsdk-loadmore">
            <LogoSpinner message={label('chat_loading_more', 'Loading more…')} />
          </div>
        ) : null}

        <div className="fcsdk-thread">
          {chat.messages.map((msg) => {
            if (msg.kind === 'loading') {
              return <ThinkingIndicator key={msg.id} label={label('chat_getting_answer', 'Getting your answer…')} />;
            }
            if (msg.kind === 'user') {
              return <UserBubble key={msg.id} message={msg} onRetry={chat.failedMessageId === msg.id ? () => void actions.retryLastRequest() : undefined} />;
            }
            // 2.0.0: the farmer's resolved location, standing in for the text bubble they would
            // otherwise have sent. Right-aligned because it is their own message — Compose wraps
            // it in a `contentAlignment = Alignment.CenterEnd` Box (ChatScreen.kt:699).
            if (msg.kind === 'location') {
              return (
                <div key={msg.id} className="fcsdk-bubble-location-row">
                  <LocationChatBubble address={msg.address} label={label('chat_your_location', 'Your location:')} />
                </div>
              );
            }
            const ai = msg;
            const isLastAi = ai.id === lastAiId;
            // Only the newest, fresh answer animates: not history, not
            // pre-generated, and only until it has revealed once. Everything
            // else short-circuits `revealed` to true and shows at once.
            // An AGENTIC answer never animates: the text already arrived a token at a time, and
            // animating it again would re-type an answer the user just watched appear.
            const shouldAnimate =
              isLastAi && !isHistoryEntry && !ai.isPreGenerated && !ai.isAgentic && !revealedIds.has(ai.id);
            const revealed = !shouldAnimate || revealedIds.has(ai.id);
            const followUps = ai.followUpQuestions ?? [];

            // 2.0.0 alignment surfaces. An EXCLUSIVE surface owns the message area: it replaces
            // the answer, its action row and its related-questions section. An ADDITIVE one falls
            // through to the normal answer branch and renders below it as a nudge.
            const alignmentKind = ai.alignmentKind ?? null;
            if (alignmentKind && !isAdditiveAlignment(alignmentKind)) {
              return (
                <div key={ai.id} className="fcsdk-bubble-ai">
                  <AlignmentSurface
                    kind={alignmentKind}
                    message={ai.text}
                    chips={ai.alignmentChips ?? []}
                    selectedValues={ai.alignmentSelectedValues ?? []}
                    isLoading={chat.isLoading}
                    isLatest={isLastAi}
                    onChipClick={(chip) => handleAlignmentChip(ai.id, alignmentKind, chip)}
                    onTypeInstead={focusComposerOrTypeOverlay}
                  />
                </div>
              );
            }

            return (
              <div key={ai.id} className="fcsdk-bubble-ai">
                <AiAnswerBlock
                  text={ai.text}
                  animate={shouldAnimate}
                  onRevealComplete={() => markRevealed(ai.id)}
                  onRevealProgress={revealScrollToBottom}
                />
                {/* Tool progress / "getting your answer" / 4 s stall hint while streaming. */}
                {ai.isStreaming ? <StreamProgress text={ai.text} status={ai.streamingStatus} /> : null}
                {/* ADDITIVE surface: a nudge below the real answer (gender-select /
                    commodity-confirm). The answer above keeps its own action row. */}
                {alignmentKind && isAdditiveAlignment(alignmentKind) ? (
                  <AlignmentSurface
                    kind={alignmentKind}
                    message={ai.alignmentMessage ?? ''}
                    chips={ai.alignmentChips ?? []}
                    selectedValues={ai.alignmentSelectedValues ?? []}
                    isLoading={chat.isLoading}
                    isLatest={isLastAi}
                    onChipClick={(chip) => handleAlignmentChip(ai.id, alignmentKind, chip)}
                  />
                ) : null}
                {/* Interrupted terminal state: keep any partial answer above and offer retry.
                    Only the latest answer shows the card — an older failed question keeps its
                    partial text but drops the retry action. */}
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
                {ai.clarificationRequired ? (
                  <div className="fcsdk-clarification">{label('chat_clarification', 'I need a bit more detail to answer well.')}</div>
                ) : null}
                {/* Action row + follow-ups fade in only AFTER the reveal completes — and never
                    while the answer is still streaming or was interrupted. */}
                {revealed && !ai.isStreaming && !ai.isInterrupted ? (
                  ai.isPreGenerated ? (
                    <div className="fcsdk-response-actions fcsdk-fade-in">
                      <button
                        type="button"
                        className="fcsdk-action-chip"
                        onClick={() => void actions.replacePreGeneratedWithQuestion(lastUserQuestionBefore(chat.messages, ai.id), 'card')}
                      >
                        {Icon.chat} {label('chat_read_full_advice', 'Read full advice')}
                      </button>
                    </div>
                  ) : (
                    <div className="fcsdk-response-actions fcsdk-fade-in">
                      {chat.isTtsEnabled && !ai.hideTtsSpeaker && ai.messageId ? (
                        <button
                          type="button"
                          className="fcsdk-action-chip"
                          onClick={() => void actions.synthesiseAudio(ai.messageId!, ai.text)}
                          disabled={chat.isLoadingSynthesiseAudio}
                        >
                          {chat.isAudioPlaying ? Icon.pause : Icon.speaker}{' '}
                          {chat.isLoadingSynthesiseAudio
                            ? label('chat_listen_loading', 'Preparing…')
                            : chat.isAudioPlaying
                              ? label('chat_listen_pause', 'Pause')
                              : label('chat_listen', 'Listen')}
                        </button>
                      ) : null}
                      {!ai.hideShareIcon ? (
                        <>
                          <button type="button" className="fcsdk-action-chip" onClick={() => void share(ai)}>
                            {Icon.share} {label('chat_share', 'Share')}
                          </button>
                          <button type="button" className="fcsdk-action-chip" onClick={() => void download(ai)}>
                            {Icon.download} {label('chat_download', 'Download')}
                          </button>
                        </>
                      ) : null}
                    </div>
                  )
                ) : null}
                {revealed && !ai.isStreaming && followUps.length > 0 && !ai.hideFollowUpQuestion ? (
                  <div className="fcsdk-followups fcsdk-fade-in">
                    <div className="fcsdk-followups-title">
                      <span className="fcsdk-followups-dot" aria-hidden />
                      {chat.clarificationRequired
                        ? label('chat_clarify_options', 'Did you mean:')
                        : label('chat_related_questions', 'Related questions')}
                    </div>
                    <div className="fcsdk-followups-list">
                      {followUps.map((q, i) => (
                        <button key={i} type="button" className="fcsdk-followup-chip" onClick={() => void actions.sendFollowUpQuestion(q)}>
                          <span className="fcsdk-followup-chip-text">{q}</span>
                          <span className="fcsdk-followup-chip-arrow" aria-hidden>
                            {Icon.chevronRight}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* ChatErrorContent (inline) */}
          {chat.errorMessage && !chat.isLoading ? (
            <div className="fcsdk-bubble-ai" role="alert">
              <div className="fcsdk-error-inline" style={{ marginBottom: 8 }}>
                {chat.errorMessage}
              </div>
              <div className="fcsdk-response-actions">
                <button
                  type="button"
                  className="fcsdk-action-chip"
                  onClick={() => {
                    actions.clearError();
                    void actions.retryLastRequest();
                  }}
                >
                  {Icon.retry} {label('chat_retry', 'Try again')}
                </button>
              </div>
            </div>
          ) : null}

          {isInitialLoading && chat.messages.length === 0 ? <LogoSpinner message={label('chat_loading', 'Loading…')} /> : null}
        </div>
      </div>

      {showScrollDown ? (
        <button
          type="button"
          className="fcsdk-scrolldown"
          aria-label={label('chat_scroll_to_bottom', 'Scroll to bottom')}
          onClick={() => {
            const el = scrollRef.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
          }}
        >
          ↓
        </button>
      ) : null}

      {/* 2.0.0 composer, or the v1 Photo/Speak/Type row. The row is hidden while an input overlay
          is open; the composer instead slides off-screen (`visible`), keeping the same rhythm
          Compose gives it via `visible = !(isThread && state.isLoading)`. */}
      {isComposerUi ? (
        <InputComposer
          floating
          compact
          showAura={false}
          visible={!chat.isLoading && overlay === null}
          placeholder={label('chat_composer_placeholder', 'Ask about your farm...')}
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
          photoLabel={label('input_photo', 'Photo')}
          voiceLabel={label('input_speak', 'Speak')}
          sendLabel={label('chat_send', 'Send')}
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
            toast.show(label('mic_permission_denied', 'Microphone permission is needed to ask by voice.'));
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

function UserBubble(props: { message: UserMessage; onRetry?: () => void }) {
  const label = useLabel();
  const m = props.message;
  return (
    <div className={`fcsdk-bubble-user${m.isFailed ? ' fcsdk-bubble-user--failed' : ''}`}>
      {m.imageUri ? <img src={m.imageUri} alt="" style={{ width: m.userBubbleImageWideBanner ? '100%' : 140 }} /> : null}
      {m.audioUri ? <VoiceClip src={m.audioUri} /> : null}
      {m.text ? <span>{m.text}</span> : null}
      {m.isFailed && props.onRetry ? (
        <button type="button" className="fcsdk-action-chip" onClick={props.onRetry} style={{ alignSelf: 'flex-end' }}>
          {Icon.retry} {label('chat_retry', 'Try again')}
        </button>
      ) : null}
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
