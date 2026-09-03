/**
 * Home (docs/01 §3.7): HomeAppBar (hamburger + weather chip), greeting with
 * skeleton, sticky Photo/Speak/Type inputs, SSFR card, "For your farm today"
 * feed (content / single-select / multi-select cards), feed error with retry,
 * text/voice/photo overlays, MarkImageViewed at ≥50% visibility, weather CTA
 * through the location prompt.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLabel, useSdk } from '../context';
import { Icon, LogoSpinner, Skeleton, Toast } from '../components/common';
import { ContentCard, SingleSelectCard, MultiSelectCard, SsfrCard, HomeFeedErrorUI } from '../components/cards';
import { PrimaryInputButtons, TextInputOverlay, VoiceInputOverlay, PhotoInputOverlay, InputKind } from '../components/inputs';
import { InputComposer, ComposerAttachment, InputComposerHandle } from '../components/InputComposer';
import { TermsOfUseDialog } from '../components/TermsOfUseDialog';
import { composerBarHeight } from '../components/composerLayout';
import { useHome } from '../../state/useHome';
import { useEnterName } from '../../state/useEnterName';
import type { LocationPromptActions } from '../../state/useLocationPrompt';
import { Events, Screens } from '../../core/analytics';
import { PrefKeys } from '../../core/storage';
import type { SectionDto, SectionOption } from '../../core/types';
import type { ChatRouteParams } from '../router';
import { renderableSections } from '../../core/types';

/**
 * How long an open request waits for the terms URL to land before giving up and toasting.
 * Parity with the Kotlin `withTimeoutOrNull(5_000)` around the URL wait.
 */
const TERMS_URL_WAIT_MS = 5_000;

/**
 * Scroll distance over which the agentic Home gradient band fades out, in px (Compose dp 1:1 —
 * `gradientFadePx = 215.dp`).
 */
const HOME_BAND_FADE_PX = 215;

type CardKind = 'content' | 'single' | 'multi';

function cardKind(section: SectionDto): CardKind {
  const sel = (section.selection_type ?? '').toLowerCase();
  if (sel.includes('multi')) return 'multi';
  if (sel.includes('single')) return 'single';
  if ((section.options ?? []).length > 0) {
    return (section.unique_key ?? section.label ?? '').toLowerCase().includes('gender') ? 'single' : 'multi';
  }
  return 'content';
}

export function HomeScreen(props: {
  onOpenDrawer: () => void;
  onOpenChat: (params: ChatRouteParams) => void;
  locationActions: LocationPromptActions;
  /**
   * 2.0.0: something outside Home asked for the in-app Terms-of-Use dialog — on the web, the host
   * calling `openScreen('termsofuse')`. Home consumes the request via
   * [onTermsOfUseRequestConsumed] once acted on, so a later terms fetch cannot re-open it.
   */
  openTermsOfUseRequested?: boolean;
  onTermsOfUseRequestConsumed?: () => void;
}) {
  const { services, toast } = useSdk();
  const label = useLabel();
  const [home, homeActions] = useHome(services);
  const [, nameActions] = useEnterName(services);
  const [overlay, setOverlay] = useState<InputKind | null>(null);
  const [submittingCardId, setSubmittingCardId] = useState<string | null>(null);
  const initRef = useRef(false);

  // 2.0.0: the floating composer replaces the sticky Photo/Speak/Type row and the text overlay,
  // and Home switches to the agentic visual treatment. Compose gates all of it on the same
  // `isComposerUi = config.enableAgenticChat` (HomeScreen.kt:159).
  const isComposerUi = services.config.enableAgenticChat;
  const composerRef = useRef<InputComposerHandle | null>(null);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  // Re-runs the terms-of-use wait effect when its timeout expires with no URL in hand.
  const [termsWaitTick, setTermsWaitTick] = useState(0);
  // Scroll offset, only read in composer mode: the green gradient band fades out over the first
  // ~215px of scroll so it does not linger once the feed has risen (Compose `gradientAlpha`).
  const [scrollTop, setScrollTop] = useState(0);
  const bandAlpha = Math.max(0, Math.min(1, 1 - scrollTop / HOME_BAND_FADE_PX));

  // Send from the composer: an attached image opens chat through image analysis, plain text as a
  // normal query — the same split Compose's `sendMessage(query, photoUris.firstOrNull())` makes.
  const sendFromComposer = useCallback(
    (text: string) => {
      const attachment = attachments[0];
      const file = attachment?.file;
      setAttachments([]);
      if (file && attachment) {
        props.onOpenChat({ source: 'home', question: text.trim(), imageUri: attachment.url, imageBlob: file });
      } else if (text.trim().length > 0) {
        props.onOpenChat({ source: 'home', question: text.trim() });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attachments, props.onOpenChat],
  );

  useEffect(() => {
    services.analytics.screenView(Screens.HOME);
    if (!initRef.current) {
      initRef.current = true;
      // §3.7 lifecycle: NewConversation, LoadHome + LoadWeather on entry.
      void homeActions.newConversation();
      void homeActions.loadHome();
      if (services.config.enableWeather) void homeActions.loadWeather();
      // App parity (HomeScreen.kt:346): fetch the legal links on EVERY Home entry, not lazily
      // when the dialog is asked for — the URL has to already be on its way by the time an open
      // request arrives. Best-effort; a failure only leaves the URL null.
      void homeActions.fetchPrivacyPolicy();
    }
    return () => services.analytics.screenExit(Screens.HOME);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ terms-of-use dialog
  const [showTermsOfUseDialog, setShowTermsOfUseDialog] = useState(false);
  const termsUrl = home.farmerchatTermsOfUse;

  // The URL is fetched on Home entry, so an open request can arrive before the fetch completes.
  // Wait briefly for a non-blank URL, then open — otherwise toast and CONSUME the request, so it
  // never opens unprompted on a later fetch (app parity, HomeScreen.kt:358).
  const requested = props.openTermsOfUseRequested ?? false;
  const termsWaitStartedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!requested) {
      termsWaitStartedRef.current = null;
      return;
    }
    if (termsWaitStartedRef.current === null) termsWaitStartedRef.current = Date.now();
    if (termsUrl && termsUrl.trim().length > 0) {
      services.analytics.track(Events.TERMS_OF_USE_OPENED, {});
      setShowTermsOfUseDialog(true);
      props.onTermsOfUseRequestConsumed?.();
      return;
    }
    const elapsed = Date.now() - termsWaitStartedRef.current;
    const remaining = TERMS_URL_WAIT_MS - elapsed;
    if (remaining <= 0) {
      toast.show(label('unable_to_load_legal_links', 'Unable to load Terms of Use'));
      props.onTermsOfUseRequestConsumed?.();
      return;
    }
    // Re-check when the wait expires; a `termsUrl` arriving sooner re-runs this effect anyway.
    const timer = window.setTimeout(() => setTermsWaitTick((t) => t + 1), remaining);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, termsUrl, termsWaitTick]);

  const weather = home.weatherState.status === 'success' ? home.weatherState.data : null;

  const openWeatherChat = useCallback(() => {
    services.analytics.track(Events.WEATHER_FORECAST_VIEWED, {});
    props.onOpenChat({
      source: 'home',
      // App parity: weather CTA asks the app's label WHAT_IS_THE_PRESENT_WEATHER.
      question: label('WHAT_IS_THE_PRESENT_WEATHER', 'What is the present weather?'),
      isWeatherAdviceCTA: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, props.onOpenChat]);

  const onWeatherClick = useCallback(() => {
    // Weather routes through the location prompt when location is unknown.
    props.locationActions.triggerFromWeather(openWeatherChat);
  }, [openWeatherChat, props.locationActions]);

  const onContentCardTap = useCallback(
    async (section: SectionDto) => {
      services.analytics.track(Events.CARD_CLICKED, { statement_id: section.statement_id ?? '', title: section.title ?? '' });
      const question = section.question_text ?? section.title ?? '';
      // App parity (HomeScreen.kt:851): with agentic chat on, a card tap SKIPS the pre-generated
      // answer API (#13 fetchImageStatement) and sends the card question into chat as a normal
      // text query, for both image and statement cards.
      //
      // SDK deviation, same as the Compose port: the app also forwards the card image url so chat
      // can show it as a display-only banner on the user bubble. ChatRouteParams has no
      // display-only image field — its `imageUri`/`imageBlob` route the query through image
      // analysis, which is exactly what this path must avoid — so the banner is dropped.
      if (isComposerUi) {
        if (question.trim().length > 0) {
          props.onOpenChat({
            source: 'home',
            question,
            homeStatementId: section.statement_id != null ? String(section.statement_id) : undefined,
          });
        }
        return;
      }
      if (section.statement_id != null) {
        // App parity (HomeScreen.kt:580-584): content-card tap sends image_card / text_card.
        const triggerType =
          section.type === 'image' ? 'image_card' : section.type === 'statement' ? 'text_card' : 'card';
        const statement = await homeActions.fetchImageStatement(section.statement_id, triggerType);
        props.onOpenChat({
          source: 'home',
          question,
          preGeneratedAnswer: statement?.short_answer ?? undefined,
          // App parity: #26 follow-ups are objects — sort by sequence, map to strings.
          followUpQuestions: (statement?.follow_up_questions ?? [])
            .slice()
            .sort((a, b) =>
              typeof a === 'object' && a && typeof b === 'object' && b ? (a.sequence ?? 0) - (b.sequence ?? 0) : 0,
            )
            .map((q) => (typeof q === 'string' ? q : q?.question ?? ''))
            .filter((q) => q.length > 0),
          homeStatementId: statement?.message_id ?? String(section.statement_id),
          imageUri: section.image_url ?? undefined,
        });
      } else {
        props.onOpenChat({ source: 'home', question });
      }
    },
    [homeActions, isComposerUi, props, services.analytics],
  );

  const onSingleSelectSubmit = useCallback(
    async (section: SectionDto, option: SectionOption) => {
      const sectionId = section.id ?? String(section.statement_id ?? '');
      setSubmittingCardId(sectionId);
      services.analytics.track(Events.QUESTION_CARD_DATA_SUBMITTED, { card: section.unique_key ?? 'gender', value: option.text ?? '' });
      // Gender card goes through the profile update action (docs/01 §3.7).
      await nameActions.updateUserName({ user_id: services.session.userId ?? '', gender: option.text ?? String(option.id ?? '') }, Screens.HOME);
      setSubmittingCardId(null);
      homeActions.dismissCard(sectionId);
      toast.show(label('card_saved', 'Saved!'));
    },
    [homeActions, label, nameActions, services, toast],
  );

  const onMultiSelectSubmit = useCallback(
    async (section: SectionDto, options: SectionOption[]) => {
      const sectionId = section.id ?? String(section.statement_id ?? '');
      const key = (section.unique_key ?? section.label ?? '').toLowerCase();
      setSubmittingCardId(sectionId);
      services.analytics.track(Events.QUESTION_CARD_DATA_SUBMITTED, { card: key || 'crop', count: options.length });
      if (key.includes('livestock')) {
        await nameActions.updateUserName(
          {
            user_id: services.session.userId ?? '',
            live_stock_details: options.map((o) => ({ id: typeof o.id === 'number' ? o.id : undefined, name: o.text ?? '' })),
          },
          Screens.HOME,
        );
      } else {
        await homeActions.updateCultivatedCrops(options.map((o) => o.id ?? o.text ?? ''));
      }
      setSubmittingCardId(null);
      homeActions.dismissCard(sectionId);
      toast.show(label('card_saved', 'Saved!'));
    },
    [homeActions, label, nameActions, services, toast],
  );

  const feed = home.homeFeedState;
  const greeting = feed.status === 'success' ? (feed.data.greeting ?? '') : null;

  // The pill shows the resolved place once known, else invites sharing. Compose's
  // `HomeLocationPill` is driven by the core LocationPromptManager; web has no such widget, so
  // this reads the same prefs that flow writes (district → state → country) and falls back to the
  // share prompt. Logged as a deviation in docs/04.
  const locationPillLabel = (() => {
    const district = services.store.getString(PrefKeys.USER_DISTRICT);
    const state = services.store.getString(PrefKeys.USER_STATE);
    const country = services.store.getString(PrefKeys.USER_COUNTRY_NAME);
    const place = [district, state, country].find((value) => (value ?? '').trim().length > 0);
    if (place) return place;
    return label('home_share_location', 'Share your location');
  })();

  return (
    <div className={'fcsdk-screen' + (isComposerUi ? ' fcsdk-screen--composer fcsdk-home--agentic' : '')}>
      {/* 2.0.0 agentic Home: a fixed green→transparent band behind the header and first card,
          with the yellow glow at top centre. Solid to ~58.8% of a band ~36.6% of the surface
          tall, transparent by its bottom; fades over ~215px of scroll (HomeScreen.kt:536).
          Compose also sways decorative `Sunbeams` inside it — not ported; logged in docs/04. */}
      {isComposerUi ? (
        <div className="fcsdk-home-band" style={{ opacity: bandAlpha }} aria-hidden>
          <span className="fcsdk-home-band-glow" />
        </div>
      ) : null}

      {/* HomeAppBar */}
      <div className="fcsdk-appbar">
        {services.config.showDrawer ? (
          <button
            type="button"
            className="fcsdk-iconbtn"
            aria-label="menu"
            onClick={() => {
              services.analytics.track(Events.HAMBURGER_MENU_CLICKED, {});
              props.onOpenDrawer();
            }}
          >
            {Icon.menu}
          </button>
        ) : (
          <span style={{ width: 10 }} />
        )}
        <div className="fcsdk-appbar-title">{label('app_name', 'FarmerChat')}</div>
        {services.config.enableWeather ? (
          <button type="button" className="fcsdk-weatherbtn" onClick={onWeatherClick} aria-label={label('weather_chip', 'Weather')}>
            <span aria-hidden>{weather?.weather_icon ? <img src={weather.weather_icon} alt="" style={{ width: 18, height: 18 }} /> : Icon.weatherDefault}</span>
            {weather?.current_temp ? `${weather.current_temp}°` : label('weather_chip', 'Weather')}
          </button>
        ) : null}
      </div>

      <div
        className="fcsdk-scroll"
        onScroll={isComposerUi ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
        // Reserve the floating composer's height so the last feed card is not hidden behind it
        // (Compose: `contentPadding = composerBarHeight(floating = true)`).
        style={isComposerUi ? { paddingBottom: composerBarHeight({ floating: true }) } : undefined}
      >
        {/* Agentic top section (2.0.0) / plain greeting (1.0.0). App parity
            (HomeScreen.kt:668): centred logo mark, leaf-flanked "For your farm today", the
            location pill, then the greeting centred beneath. */}
        {isComposerUi ? (
          <div className="fcsdk-home-agentic-head">
            <span className="fcsdk-home-logomark" aria-hidden>
              {Icon.logo}
            </span>
            <div className="fcsdk-home-sectionhead">
              <span className="fcsdk-home-leaf" aria-hidden>
                🌿
              </span>
              <span>{label('home_feed_header', 'For your farm today')}</span>
              <span className="fcsdk-home-leaf fcsdk-home-leaf--flip" aria-hidden>
                🌿
              </span>
            </div>
            <button
              type="button"
              className="fcsdk-home-locationpill"
              onClick={() => {
                if (props.locationActions.hasKnownLocation()) return;
                void props.locationActions.shareLocation();
              }}
            >
              <span aria-hidden>{Icon.location}</span>
              <span>{locationPillLabel}</span>
            </button>
            {greeting === null ? (
              <Skeleton width="70%" height={24} />
            ) : (
              <div className="fcsdk-greeting fcsdk-greeting--centred">
                {greeting || label('home_greeting_fallback', 'Hello! How can I help your farm today?')}
              </div>
            )}
          </div>
        ) : greeting === null ? (
          <div style={{ padding: '18px 16px 6px' }}>
            <Skeleton width="70%" height={24} />
          </div>
        ) : (
          <div className="fcsdk-greeting">{greeting || label('home_greeting_fallback', 'Hello! How can I help your farm today?')}</div>
        )}

        {/* Sticky Photo/Speak/Type. App parity (HomeScreen.kt:1184): in composer mode the slot is
            kept but rendered empty — the floating composer replaces these buttons. */}
        {!isComposerUi ? (
          <div className="fcsdk-sticky-inputs">
            <PrimaryInputButtons onSelect={setOverlay} enableVoice={services.config.enableVoice} enableImages={services.config.enableImages} />
          </div>
        ) : null}

        {feed.status === 'loading' || feed.status === 'idle' ? (
          <LogoSpinner message={label('home_loading', "Getting today's advice")} />
        ) : feed.status === 'error' ? (
          <HomeFeedErrorUI
            message={feed.message}
            onRetry={() => {
              services.analytics.track(Events.CONTENT_TRY_AGAIN_CLICKED, {});
              void homeActions.loadHome(true);
            }}
          />
        ) : (
          <>
            {feed.data.ssfr_enable && services.config.enableSsfr ? (
              <SsfrCard
                onCropClick={(crop) =>
                  props.onOpenChat({
                    source: 'home',
                    question: label('ssfr_question', 'Give me fertilizer advice for my {crop}', { crop }),
                    isSSFR: true,
                    ssfrCrop: crop,
                  })
                }
              />
            ) : null}

            {/* App parity (HomeScreen.kt:811): agentic mode already shows "For your farm today"
                as the top-of-feed section header, so the in-feed one is skipped to avoid a
                duplicate title. */}
            {!isComposerUi ? (
              <div className="fcsdk-feedheader">{label('home_feed_header', 'For your farm today')}</div>
            ) : null}

            {renderableSections(feed.data.sections)
              .filter((s) => !home.dismissedCardIds.has(s.id ?? String(s.statement_id ?? '')))
              .map((section, i) => {
                const kind = cardKind(section);
                const sectionId = section.id ?? String(section.statement_id ?? i);
                if (kind === 'single') {
                  return (
                    <SingleSelectCard key={sectionId} section={section} isSubmitting={submittingCardId === sectionId} onSubmit={(opt) => void onSingleSelectSubmit(section, opt)} />
                  );
                }
                if (kind === 'multi') {
                  return (
                    <MultiSelectCard key={sectionId} section={section} isSubmitting={submittingCardId === sectionId} onSubmit={(opts) => void onMultiSelectSubmit(section, opts)} />
                  );
                }
                return (
                  <ContentCard
                    key={sectionId}
                    section={section}
                    onTap={() => void onContentCardTap(section)}
                    onVisible={() => {
                      services.analytics.track(Events.CARD_VIEWED, { statement_id: section.statement_id ?? '' });
                      if (section.statement_id != null && !section.is_viewed) void homeActions.markImageViewed(section.statement_id);
                    }}
                  />
                );
              })}

            <div className="fcsdk-feedfooter">{label('home_feed_footer', "That's all for today. Ask me anything!")}</div>
          </>
        )}
      </div>

      {/* 2.0.0 floating composer (camera / field / mic|send), replacing BOTH the sticky buttons
          and the text overlay — Compose HomeScreen.kt:947. */}
      {isComposerUi ? (
        <InputComposer
          floating
          showAura
          placeholder={label('home_composer_placeholder', 'Ask about your farm...')}
          attachments={attachments}
          onRemoveAttachment={(index) => setAttachments((list) => list.filter((_, i) => i !== index))}
          onReady={(handle) => {
            composerRef.current = handle;
          }}
          onPhotoClick={() => setOverlay('photo')}
          onVoiceClick={() => setOverlay('speak')}
          onFocusChange={(focused) => {
            // Tapping the field to type is the composer's equivalent of the legacy Type button,
            // so the same CHAT_ICON_CLICKED (Text) signal fires on focus gain (HomeScreen.kt:990).
            if (focused) services.analytics.track(Events.CHAT_ICON_CLICKED, { screen_name: Screens.HOME, icon_type: 'Text' });
          }}
          onSend={sendFromComposer}
          enableImages={services.config.enableImages}
          enableVoice={services.config.enableVoice}
          photoLabel={label('input_photo', 'Photo')}
          voiceLabel={label('input_speak', 'Speak')}
          sendLabel={label('chat_send', 'Send')}
          removeLabel={label('photo_remove', 'Remove image')}
        />
      ) : null}

      {/* Input overlays. The composer owns typing, so the text overlay is unused in that mode. */}
      {!isComposerUi && overlay === 'type' ? (
        <TextInputOverlay
          onClose={() => setOverlay(null)}
          onSend={(text) => {
            setOverlay(null);
            props.onOpenChat({ source: 'home', question: text });
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
            // Voice-prototype entry: Chat transcribes then asks (docs/01 §3.8 InitializeVoicePrototype).
            props.onOpenChat({ source: 'home', audioUri: recording.objectUrl, voiceBase64: recording.base64, voiceFormat: recording.format });
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
            props.onOpenChat({ source: 'home', question, imageUri: objectUrl, imageBlob: file });
          }}
        />
      ) : null}

      {/* 2.0.0 in-app Terms-of-Use dialog. The URL guard is repeated here so the dialog stays
          correct even if state is refetched to null while it is open. */}
      {showTermsOfUseDialog && termsUrl && termsUrl.trim().length > 0 ? (
        <TermsOfUseDialog
          url={termsUrl}
          title={label('terms_of_use', 'Terms of Use')}
          onDismiss={() => setShowTermsOfUseDialog(false)}
          onAcceptAndContinue={() => {
            // accept_terms (#7) — best-effort; the dialog closes either way. The app also tracks a
            // Plotline ToS event here; the SDK emits no Plotline-named event (root CLAUDE.md §2
            // forbids new event names), so only TERMS_OF_USE_OPENED above reaches the host.
            void homeActions.acceptTerms();
            setShowTermsOfUseDialog(false);
          }}
        />
      ) : null}

      <Toast message={toast.message} />
    </div>
  );
}
