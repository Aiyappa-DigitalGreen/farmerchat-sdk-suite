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
import { TextInputOverlay, VoiceInputOverlay, PhotoInputOverlay, PrimaryInputButtons, VoiceClip, InputKind } from '../components/inputs';
import { shareAnswerCard, downloadAnswerCard } from '../components/shareCard';
import { useChat, AiResponse, UserMessage } from '../../state/useChat';
import { Events, Screens } from '../../core/analytics';
import type { ChatRouteParams } from '../router';

export function ChatScreen(props: { params: ChatRouteParams; onClose: () => void; onOpenDrawer: () => void }) {
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
    <div className="fcsdk-screen fcsdk-chat-surface">
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

      <div className="fcsdk-scroll" ref={scrollRef} onScroll={onScroll}>
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
            const ai = msg;
            // Only the newest, fresh answer animates: not history, not
            // pre-generated, and only until it has revealed once. Everything
            // else short-circuits `revealed` to true and shows at once.
            const shouldAnimate = ai.id === lastAiId && !isHistoryEntry && !ai.isPreGenerated && !revealedIds.has(ai.id);
            const revealed = !shouldAnimate || revealedIds.has(ai.id);
            const followUps = ai.followUpQuestions ?? [];
            return (
              <div key={ai.id} className="fcsdk-bubble-ai">
                <AiAnswerBlock
                  text={ai.text}
                  animate={shouldAnimate}
                  onRevealComplete={() => markRevealed(ai.id)}
                  onRevealProgress={revealScrollToBottom}
                />
                {ai.clarificationRequired ? (
                  <div className="fcsdk-clarification">{label('chat_clarification', 'I need a bit more detail to answer well.')}</div>
                ) : null}
                {/* Action row + follow-ups fade in only AFTER the reveal completes. */}
                {revealed ? (
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
                {revealed && followUps.length > 0 && !ai.hideFollowUpQuestion ? (
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

      {/* Follow-up input bar */}
      <div className="fcsdk-chat-inputbar">
        <PrimaryInputButtons onSelect={setOverlay} enableVoice={services.config.enableVoice} enableImages={services.config.enableImages} />
      </div>

      {overlay === 'type' ? (
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
          onClose={() => setOverlay(null)}
          onPicked={(file, objectUrl, question) => {
            setOverlay(null);
            void actions.sendQuestionWithImage(question, file, objectUrl);
          }}
        />
      ) : null}

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
