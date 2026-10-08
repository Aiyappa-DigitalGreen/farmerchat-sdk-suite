/**
 * Home (docs/01 §3.7): HomeAppBar (hamburger + weather chip), greeting with
 * skeleton, sticky Photo/Speak/Type inputs, SSFR card, "For your farm today"
 * feed (content / single-select / multi-select cards), feed error with retry,
 * text/voice/photo overlays, MarkImageViewed at ≥50% visibility, weather CTA
 * through the location prompt.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLabel, useSdk } from '../context';
import { ActionButton, CircularProgress, LogoSpinner, Toast } from '../components/common';
import { FcIcon, type IconName } from '../components/FcIcon';
import { Assets } from '../assets';
import { ContentCard, SingleSelectCard, MultiSelectCard, SsfrCard, HomeFeedErrorUI, FeedFooter } from '../components/cards';
import { PrimaryInputButtons, TextInputOverlay, VoiceInputOverlay, PhotoInputOverlay, InputKind } from '../components/inputs';
import { InputComposer, ComposerAttachment, InputComposerHandle } from '../components/InputComposer';
import { TermsOfUseDialog } from '../components/TermsOfUseDialog';
import { composerBarHeight } from '../components/composerLayout';
import { useHome } from '../../state/useHome';
import { useEnterName } from '../../state/useEnterName';
import { useUserProfile } from '../../state/useUserProfile';
import { approxPlaceName } from '../../state/helpers';
import type { LocationPromptActions, LocationPromptState } from '../../state/useLocationPrompt';
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
  /** The shared location machine's state (pill searching state, error routing). */
  locationState: LocationPromptState;
  /**
   * Navigate to the shared Error screen (offline weather chip, location-flow errors). App parity:
   * HomeScreen.kt:258-266 / :546-575.
   */
  onNavigateToError: (isNetworkError: boolean, fromScreen: string) => void;
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
  const [, profileActions] = useUserProfile(services);
  const [placeTick, setPlaceTick] = useState(0);
  const [overlay, setOverlay] = useState<InputKind | null>(null);
  const [submittingCardId, setSubmittingCardId] = useState<string | null>(null);
  const initRef = useRef(false);

  // 2.0.0: the floating composer replaces the sticky Photo/Speak/Type row and the text overlay,
  // and Home switches to the agentic visual treatment. Compose gates all of it on the same
  // `config.resolvedComposerUi` — the host's `enableComposerUi`, or `enableAgenticChat` when
  // omitted (the app's `v2_composer_ui_enabled` flag, which it treats as independent).
  const isComposerUi = services.config.composerUi;
  const composerRef = useRef<InputComposerHandle | null>(null);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  // Re-runs the terms-of-use wait effect when its timeout expires with no URL in hand.
  const [termsWaitTick, setTermsWaitTick] = useState(0);
  // App parity (HomeScreen.kt 70adc5fd): in composer mode the header CONTENT (logo, "For your
  // farm today", location pill) is a FIXED overlay over the feed, and the feed's top strip masks
  // out so cards dissolve INTO the gradient band as they scroll up behind it. `headHeight` is
  // that overlay's measured height: the scroller reserves exactly it, and the mask ends exactly
  // there — where the first card rests — so the resting card is never faded.
  const agenticHeadRef = useRef<HTMLDivElement | null>(null);
  const [headHeight, setHeadHeight] = useState(0);
  useEffect(() => {
    const node = agenticHeadRef.current;
    if (!isComposerUi || node === null) return;
    const measure = () => setHeadHeight(node.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
    // The header only exists once the feed has loaded, so re-measure when that happens.
  }, [isComposerUi, home.homeFeedState.status]);

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
      // HomeViewModel.backfillApproxLocationName: fill the pill's place name from the profile's
      // geography (district > state > country) when nothing wrote it yet. Never overwrites.
      void profileActions.fetchProfile('home').then((profile) => {
        const u = (profile?.userProfile ?? null) as
          | { geography_level3?: string | null; geography_level2_name?: string | null; country_name?: string | null }
          | null;
        const place = [u?.geography_level3, u?.geography_level2_name, u?.country_name].find((v) => (v ?? '').trim().length > 0);
        if (place && !(services.store.getString(PrefKeys.APPROX_LOCATION_NAME) ?? '').trim()) {
          services.store.setString(PrefKeys.APPROX_LOCATION_NAME, place);
        }
        setPlaceTick((t) => t + 1);
      });
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
    props.onOpenChat({
      source: 'home',
      // App parity: weather CTA asks the app's label WHAT_IS_THE_PRESENT_WEATHER.
      question: label('fc_v2_app_label_what_is_the_present_weather', 'What is the present weather?'),
      isWeatherAdviceCTA: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, props.onOpenChat]);

  const onWeatherClick = useCallback(() => {
    // App parity (HomeScreen.kt:546-575): offline → No Internet; ignored while the feed is still
    // loading or while another location flow is running. With a stored fix triggerFromWeather
    // navigates straight away; otherwise the location flow runs first.
    const online = typeof navigator === 'undefined' || !('onLine' in navigator) ? true : navigator.onLine;
    if (!online) {
      props.onNavigateToError(true, 'home_weather');
      return;
    }
    if (home.homeFeedState.status === 'loading') return;
    services.analytics.track(Events.WEATHER_FORECAST_VIEWED, { screen_name: Screens.HOME });
    if (props.locationState.kind !== 'Idle') return;
    props.locationActions.triggerFromWeather(openWeatherChat);
  }, [home.homeFeedState.status, openWeatherChat, props, services.analytics]);

  // App parity (HomeScreen.kt:258-266): a location-flow Error while Home is the visible screen is
  // not drawn by the overlay — Home routes it to the shared Error screen and closes the flow
  // silently (FarmerChatRoot passes `hideError` to the overlay while Home is current).
  const locationErrorType = props.locationState.kind === 'Error' ? props.locationState.errorType : null;
  useEffect(() => {
    if (locationErrorType === null) return;
    props.onNavigateToError(locationErrorType === 'NoNetwork', 'home');
    props.locationActions.dismiss(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationErrorType]);

  // App parity (HomeScreen.kt:270): reload the feed AND the weather once when the Home pill's own
  // flow succeeds (Continue(LocalContext, "location_fetched")). Keyed on the success event, not a
  // state → Idle transition, so a denied or backed-out prompt does not trigger a wasted reload.
  // (The app's other trigger, LocationUpdatedFromWidget, comes from campaigns, which web has none of.)
  useEffect(
    () =>
      props.locationActions.subscribe((event) => {
        if (event.source === 'localContext' && event.kind === 'continue' && event.reason === 'location_fetched') {
          void homeActions.loadHome(true);
          if (services.config.enableWeather) void homeActions.loadWeather(true);
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.locationActions.subscribe],
  );

  const onContentCardTap = useCallback(
    async (section: SectionDto) => {
      services.analytics.track(Events.CARD_CLICKED, { statement_id: section.statement_id ?? '', title: section.title ?? '' });
      const question = section.question_text ?? section.title ?? '';
      // App parity (HomeScreen.kt:851): with agentic chat on, a card tap SKIPS the pre-generated
      // answer API (#13 fetchImageStatement) and sends the card question into chat as a normal
      // text query, for both image and statement cards.
      //
      // The card image is forwarded as `contentCardImageUrl`, a display-only banner on the
      // question bubble (not `imageUri`/`imageBlob`, which would route through image analysis).
      if (isComposerUi) {
        if (question.trim().length > 0) {
          // HomeScreen.kt:1027-1051: the card image rides along display-only, and no
          // homeStatementId is sent on the agentic path.
          props.onOpenChat({ source: 'home', question, contentCardImageUrl: section.image_url ?? undefined });
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
    },
    [nameActions, services],
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
    },
    [homeActions, nameActions, services],
  );

  const feed = home.homeFeedState;
  // composerBarHeight(floating) = 12 + 48 + 12 + max(navInset, 20) (+74 with a photo attached),
  // as CSS so the host's bottom inset (--fc-inset-bottom) is honoured like Compose's WindowInsets.
  const composerBottom = `calc(${composerBarHeight({ floating: true }) - 20 + (attachments.length > 0 ? 74 : 0)}px + max(var(--fc-inset-bottom), 20px))`;

  // ------------------------------------------------------------------ location pill (LocationButton.kt)
  // State priority: Blocked > Searching > Success (held 1.5s after the pill's own flow finds a
  // fix) > Located (a stored place) > Invite.
  const [pillSuccess, setPillSuccess] = useState(false);
  useEffect(
    () =>
      props.locationActions.subscribe((event) => {
        if (event.source === 'localContext' && event.kind === 'continue' && event.reason === 'location_fetched') {
          setPillSuccess(true);
          window.setTimeout(() => setPillSuccess(false), 1500);
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.locationActions.subscribe],
  );
  const isPillSearching =
    props.locationState.source === 'localContext' &&
    (props.locationState.kind === 'RequestEnableGps' || props.locationState.kind === 'FetchingLocation');
  void placeTick;
  const place = approxPlaceName(services.store, PrefKeys);
  const pillBlocked =
    (services.store.getInt(PrefKeys.PERMISSION_DENY_COUNT) ?? 0) >= 2 && !props.locationActions.hasLocationPermission();
  type PillKind = 'blocked' | 'searching' | 'success' | 'located' | 'invite';
  const pillKind: PillKind = pillBlocked
    ? 'blocked'
    : isPillSearching
      ? 'searching'
      : pillSuccess
        ? 'success'
        : place
          ? 'located'
          : 'invite';
  const pillIcon: Record<Exclude<PillKind, 'searching'>, IconName> = {
    blocked: 'm_gps_off',
    success: 'm_check',
    located: 'm_place',
    invite: 'm_my_location',
  };
  const pillGap = pillKind === 'searching' ? 8 : pillKind === 'success' || pillKind === 'located' ? 4 : 6;

  const showWeather =
    services.config.enableWeather && (home.weatherState.status === 'success' || home.weatherState.status === 'loading');
  const weatherIcon = weather?.weather_icon || Assets.weatherSunClouds;

  const sections =
    feed.status === 'success'
      ? renderableSections(feed.data.sections).filter((s) => !home.dismissedCardIds.has(s.id ?? String(s.statement_id ?? '')))
      : [];

  // HomeScreen.kt: grey surfacePrimary in both modes. Agentic: a fixed green band (+ glow) behind
  // a transparent 52dp bar and a fixed header. Legacy: green bar + glow, green greeting band, and
  // sticky green Photo/Speak/Type tiles. Loading/Error replace the whole feed area.
  return (
    <div className={'fcsdk-screen fcsdk-c-screen fcsdk-c-home' + (isComposerUi ? ' fcsdk-screen--composer fcsdk-c-home--agentic' : '')}>
      {isComposerUi ? (
        <div className="fcsdk-c-home-band" aria-hidden>
          <Sunbeams />
          <img className="fcsdk-c-home-glow" src={Assets.glowYellow} alt="" />
        </div>
      ) : null}

      <div className={'fcsdk-c-home-appbar' + (isComposerUi ? '' : ' fcsdk-c-home-appbar--legacy')}>
        {!isComposerUi ? <img className="fcsdk-c-appbar-glow" src={Assets.glowYellow} alt="" aria-hidden /> : null}
        {services.config.showDrawer ? (
          <ActionButton
            icon="m_menu"
            radius="rounded"
            ariaLabel="menu"
            onClick={() => {
              services.analytics.track(Events.HAMBURGER_MENU_CLICKED, {});
              props.onOpenDrawer();
            }}
          />
        ) : (
          <span className="fcsdk-c-appbar-spacer" aria-hidden />
        )}
        {showWeather ? (
          <button
            type="button"
            className={'fcsdk-c-weather' + (home.weatherState.status === 'loading' ? ' fcsdk-c-weather--loading' : '')}
            onClick={onWeatherClick}
          >
            {home.weatherState.status === 'loading' ? (
              <>
                <CircularProgress size={20} stroke={2} color="#FFFFFF" />
                <span className="fc-t-labelMedium" style={{ marginLeft: 8 }}>
                  {label('fc_v2_app_label_loading', 'Loading...')}
                </span>
              </>
            ) : (
              <>
                <img
                  src={weatherIcon}
                  alt=""
                  style={{ width: 24, height: 24, objectFit: 'contain' }}
                  onError={(e) => {
                    // The served weather SVGs come back as binary/octet-stream without CORS, which
                    // <img> refuses and fetch() cannot read; fall back to the app's own drawable.
                    if (e.currentTarget.src !== Assets.weatherSunClouds) e.currentTarget.src = Assets.weatherSunClouds;
                  }}
                />
                <span className="fc-t-labelMedium" style={{ marginLeft: 8 }}>
                  {weather?.current_temp ?? ''}
                </span>
                <FcIcon name="m_keyboard_arrow_right" size={22} tint="#00C950" style={{ marginLeft: 2 }} />
              </>
            )}
          </button>
        ) : null}
      </div>

      <div className="fcsdk-home-feedwrap">
        {feed.status === 'loading' || feed.status === 'idle' ? (
          <div className="fcsdk-c-center" style={{ paddingBottom: isComposerUi ? composerBottom : 0 }}>
            <LogoSpinner rotating labelStyle="labelLarge" message={label('fc_v2_app_label_getting_todays_advice', "Getting today's advice")} />
          </div>
        ) : feed.status === 'error' ? (
          <div className="fcsdk-c-center" style={{ paddingBottom: isComposerUi ? composerBottom : 0 }}>
            <HomeFeedErrorUI
              onRetry={() => {
                services.analytics.track(Events.CONTENT_TRY_AGAIN_CLICKED, {});
                void homeActions.loadHome(true);
              }}
            />
          </div>
        ) : (
          <>
            {isComposerUi ? (
              <div className="fcsdk-c-home-head" ref={agenticHeadRef}>
                <FcIcon name="logo_mark" size={42} tint="#FFFFFF" />
                <SectionHeader title={label('fc_v2_app_label_for_your_farm_today', 'For your farm today')} />
                <button
                  type="button"
                  className={`fcsdk-c-pill fcsdk-c-pill--${pillKind}`}
                  onClick={() => {
                    if (props.locationState.kind === 'Idle') props.locationActions.triggerFromLocalContext();
                  }}
                >
                  {pillKind === 'searching' ? (
                    <CircularProgress size={18} stroke={2} color="#00C950" />
                  ) : (
                    <FcIcon name={pillIcon[pillKind]} size={22} tint="#00C950" />
                  )}
                  <span className="fc-t-labelMedium fcsdk-c-pill-text" style={{ marginLeft: pillGap }}>
                    {pillKind === 'blocked'
                      ? label('fc_v2_app_label_allow_location_in_settings', 'Allow location in Settings')
                      : pillKind === 'searching'
                        ? label('fc_v2_app_label_getting_your_location', 'Getting your location')
                        : pillKind === 'success'
                          ? label('fc_v2_app_label_location_found', 'Location found')
                          : pillKind === 'located'
                            ? (
                                <>
                                  {place} - <span style={{ color: '#00C950' }}>{label('fc_v2_app_label_change', 'Change')}</span>
                                </>
                              )
                            : label('fc_v2_app_label_set_your_location', 'Set your location')}
                  </span>
                </button>
              </div>
            ) : null}

            <div
              className={'fcsdk-scroll' + (isComposerUi ? ' fcsdk-scroll--headmask' : '')}
              style={
                isComposerUi
                  ? {
                      paddingBottom: composerBottom,
                      paddingTop: Math.max(headHeight, 1),
                      ['--fcsdk-headmask-end' as string]: `${Math.max(headHeight, 1)}px`,
                    }
                  : { paddingBottom: 24 }
              }
            >
              {!isComposerUi ? (
                <>
                  <div className="fcsdk-c-greeting">
                    <span className="fc-t-titleMedium fcsdk-c-wobble">
                      {label(
                        'fc_v2_app_label_get_started_by_clicking_on_photo_speak_or_type_to_ask_your_question',
                        'Tap a button to ask a question',
                      )}
                    </span>
                  </div>
                  <div className="fcsdk-c-tiles">
                    <PrimaryInputButtons
                      onSelect={setOverlay}
                      enableVoice={services.config.enableVoice}
                      enableImages={services.config.enableImages}
                    />
                  </div>
                </>
              ) : null}

              {feed.data.ssfr_enable && services.config.enableSsfr ? (
                <div className="fcsdk-c-feeditem">
                  <SsfrCard
                    onCropClick={(crop) =>
                      props.onOpenChat({
                        source: 'home',
                        question:
                          crop === 'wheat'
                            ? label('fc_v2_app_label_ssfr_wheat_question', 'What is the recommended quantity of fertiliser for wheat?')
                            : label('fc_v2_app_label_ssfr_maize_question', 'What is the recommended quantity of fertiliser for maize?'),
                        isSSFR: true,
                        ssfrCrop: crop,
                      })
                    }
                  />
                </div>
              ) : null}

              {!isComposerUi ? (
                <div className="fcsdk-c-feedheader fc-t-titleMedium">
                  {label('fc_v2_app_label_for_your_farm_today', 'For your farm today')}
                </div>
              ) : null}

              {sections.map((section, i) => {
                const kind = cardKind(section);
                const sectionId = section.id ?? String(section.statement_id ?? i);
                const dismiss = () => homeActions.dismissCard(sectionId);
                return (
                  <div key={sectionId} className="fcsdk-c-feeditem fcsdk-c-feeditem--gap">
                    {kind === 'single' ? (
                      <SingleSelectCard section={section} onSubmit={(opt) => onSingleSelectSubmit(section, opt)} onDismissed={dismiss} />
                    ) : kind === 'multi' ? (
                      <MultiSelectCard section={section} onSubmit={(opts) => onMultiSelectSubmit(section, opts)} onDismissed={dismiss} />
                    ) : (
                      <ContentCard
                        section={section}
                        loading={submittingCardId === sectionId}
                        onTap={() => void onContentCardTap(section)}
                        onVisible={() => {
                          services.analytics.track(Events.CARD_VIEWED, { statement_id: section.statement_id ?? '' });
                          if (section.statement_id != null && !section.is_viewed) void homeActions.markImageViewed(section.statement_id);
                        }}
                      />
                    )}
                  </div>
                );
              })}

              <FeedFooter />
            </div>
          </>
        )}
      </div>
      {/* 2.0.0 floating composer (camera / field / mic|send), replacing BOTH the sticky buttons
          and the text overlay — Compose HomeScreen.kt:947. */}
      {isComposerUi ? (
        <InputComposer
          floating
          showAura
          placeholder={label('fc_v2_app_label_ask_about_your_farm', 'Ask about your farm...')}
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
          photoLabel={label('fc_v2_app_label_photo', 'Photo')}
          voiceLabel={label('fc_v2_app_label_speak', 'Speak')}
          sendLabel={label('fc_v2_app_label_send', 'Send')}
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
          title={label('fc_v2_app_label_terms_of_use', 'Terms of Use')}
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

/**
 * SectionHeader.kt: the title between two LeafDividers — 4dp `fc_leaf` tiles, every other one
 * mirrored, tinted buttonPrimaryAccent — 24dp side padding, 10dp gaps, 18/24 SemiBold white.
 */
function SectionHeader(props: { title: string }) {
  return (
    <div className="fcsdk-c-sectionheader">
      <span className="fcsdk-c-leafdivider" aria-hidden />
      <span className="fc-t-titleMedium fcsdk-c-sectionheader-title">{props.title}</span>
      <span className="fcsdk-c-leafdivider" aria-hidden />
    </div>
  );
}

/** Sunbeams.kt beams: (angle from vertical°, length fraction, alpha). Even = group A, odd = B. */
const BEAMS: Array<[number, number, number]> = [
  [-52, 0.62, 0.07], [-36, 0.95, 0.1], [-22, 0.72, 0.07], [-8, 1.0, 0.11],
  [7, 0.78, 0.07], [21, 1.0, 0.1], [37, 0.68, 0.07], [51, 0.9, 0.08],
];
const BEAM_HEIGHT = 280;

function beamPath(angleDeg: number, len: number): string {
  const a = (angleDeg * Math.PI) / 180;
  const dir = [Math.sin(a), Math.cos(a)];
  const perp = [Math.cos(a), -Math.sin(a)];
  const oy = -40;
  const r0 = 30;
  const r1 = BEAM_HEIGHT * len * 1.35;
  const pt = (r: number, hw: number, side: number) =>
    `${(dir[0] * r + perp[0] * hw * side).toFixed(1)},${(oy + dir[1] * r + perp[1] * hw * side).toFixed(1)}`;
  return `M${pt(r0, 3, -1)} L${pt(r1, 17, -1)} L${pt(r1, 17, 1)} L${pt(r0, 3, 1)} Z`;
}

/**
 * Sunbeams.kt: eight soft cream beams fanning down from 40dp above the top centre, blurred 7dp,
 * faded out by 85% of the 280dp canvas; the fan sways ±1.4° (16s, ease-in-out-sine, reversing) and
 * the two alternating groups breathe out of phase.
 */
function Sunbeams() {
  return (
    <svg className="fcsdk-c-sunbeams" width="100%" height={BEAM_HEIGHT} aria-hidden>
      <defs>
        <linearGradient id="fcsdk-beam-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={BEAM_HEIGHT * 0.85}>
          <stop offset="0" stopColor="rgb(255,246,214)" stopOpacity="1" />
          <stop offset="1" stopColor="rgb(255,246,214)" stopOpacity="0" />
        </linearGradient>
        <filter id="fcsdk-beam-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      <svg x="50%" overflow="visible">
        <g className="fcsdk-c-sunbeams-sway" filter="url(#fcsdk-beam-blur)">
          {[0, 1].map((group) => (
            <g key={group} className={`fcsdk-c-sunbeams-g${group}`}>
              {BEAMS.filter((_, i) => i % 2 === group).map(([angle, len, alpha]) => (
                <path key={angle} d={beamPath(angle, len)} fill="url(#fcsdk-beam-fade)" opacity={alpha} />
              ))}
            </g>
          ))}
        </g>
      </svg>
    </svg>
  );
}
