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
import { useHome } from '../../state/useHome';
import { useEnterName } from '../../state/useEnterName';
import type { LocationPromptActions } from '../../state/useLocationPrompt';
import { Events, Screens } from '../../core/analytics';
import type { SectionDto, SectionOption } from '../../core/types';
import type { ChatRouteParams } from '../router';

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
}) {
  const { services, toast } = useSdk();
  const label = useLabel();
  const [home, homeActions] = useHome(services);
  const [, nameActions] = useEnterName(services);
  const [overlay, setOverlay] = useState<InputKind | null>(null);
  const [submittingCardId, setSubmittingCardId] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    services.analytics.screenView(Screens.HOME);
    if (!initRef.current) {
      initRef.current = true;
      // §3.7 lifecycle: NewConversation, LoadHome + LoadWeather on entry.
      void homeActions.newConversation();
      void homeActions.loadHome();
      if (services.config.enableWeather) void homeActions.loadWeather();
    }
    return () => services.analytics.screenExit(Screens.HOME);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weather = home.weatherState.status === 'success' ? home.weatherState.data : null;

  const openWeatherChat = useCallback(() => {
    services.analytics.track(Events.WEATHER_FORECAST_VIEWED, {});
    props.onOpenChat({
      source: 'home',
      question: label('weather_advice_question', 'What does the weather mean for my farm today?'),
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
      if (section.statement_id != null) {
        const statement = await homeActions.fetchImageStatement(section.statement_id, 'card');
        props.onOpenChat({
          source: 'home',
          question,
          preGeneratedAnswer: statement?.short_answer ?? undefined,
          followUpQuestions: statement?.follow_up_questions ?? undefined,
          homeStatementId: statement?.message_id ?? String(section.statement_id),
          imageUri: section.image_url ?? undefined,
        });
      } else {
        props.onOpenChat({ source: 'home', question });
      }
    },
    [homeActions, props, services.analytics],
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

  return (
    <div className="fcsdk-screen">
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
            {weather?.current_temp != null ? `${Math.round(weather.current_temp)}°` : label('weather_chip', 'Weather')}
          </button>
        ) : null}
      </div>

      <div className="fcsdk-scroll">
        {/* Greeting */}
        {greeting === null ? (
          <div style={{ padding: '18px 16px 6px' }}>
            <Skeleton width="70%" height={24} />
          </div>
        ) : (
          <div className="fcsdk-greeting">{greeting || label('home_greeting_fallback', 'Hello! How can I help your farm today?')}</div>
        )}

        {/* Sticky Photo/Speak/Type */}
        <div className="fcsdk-sticky-inputs">
          <PrimaryInputButtons onSelect={setOverlay} enableVoice={services.config.enableVoice} enableImages={services.config.enableImages} />
        </div>

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

            <div className="fcsdk-feedheader">{label('home_feed_header', 'For your farm today')}</div>

            {(feed.data.sections ?? [])
              .filter((s) => !home.dismissedCardIds.has(s.id ?? String(s.statement_id ?? '')))
              .filter((s) => (s.type ?? '') !== 'plotline_widget')
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

      {/* Input overlays */}
      {overlay === 'type' ? (
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
          onClose={() => setOverlay(null)}
          onPicked={(file, objectUrl, question) => {
            setOverlay(null);
            props.onOpenChat({ source: 'home', question, imageUri: objectUrl, imageBlob: file });
          }}
        />
      ) : null}

      <Toast message={toast.message} />
    </div>
  );
}
