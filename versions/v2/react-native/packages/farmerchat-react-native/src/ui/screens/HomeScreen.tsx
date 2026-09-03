/**
 * Home / dashboard (docs/01 §3.7) — 1:1 with the Compose SDK HomeScreen:
 * brand-green surface, HomeAppBar (menu chip + weather pill with yellow glow),
 * centered white greeting, sticky Photo/Speak/Type tiles, SSFR card, daily feed
 * (content / single-select / multi-select cards), input overlays, feed
 * loading/error UI.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnalyticsEvents, ScreenNames } from '../../core/analytics';
import { Labels } from '../../core/labels';
import { StorageKeys } from '../../core/sessionStore';
import type { SectionDto } from '../../core/types';
import { useLabel, useSdk, useTheme } from '../context';
import { useHome } from '../../state/useHome';
import { useEnterName } from '../../state/useEnterName';
import type { UseLocationPromptResult } from '../../state/useLocationPrompt';
import type { WeatherButtonState } from '../components/Buttons';
import {
  ContentCard,
  MultiSelectCard,
  SingleSelectCard,
  SsfrCard,
} from '../components/Cards';
import {
  FeedFooter,
  FeedHeader,
  Glow,
  HomeAppBar,
  HomeFeedErrorUI,
  LogoMark,
  LogoSpinnerVertical,
  SectionHeader,
  SkeletonBlock,
  Toast,
  useToastState,
} from '../components/Chrome';
import { InputComposer, type InputComposerHandle } from '../components/InputComposer';
import { LocationPinGlyph } from '../components/LocationChatBubble';
import { TermsOfUseDialog } from '../components/TermsOfUseDialog';
import { FcIcon } from '../components/Icon';
import {
  PermissionSettingsDialog,
  PhotoInputSheet,
  PrimaryInputButtons,
  TextInputOverlay,
  VoiceInputOverlay,
  type PickedImage,
  type RecordedAudio,
} from '../components/InputOverlays';
import type { ChatRouteParams } from '../navigation/types';
import { radius, spacing, typography } from '../theme';
import { Text } from 'react-native';
import { renderableSections } from '../../core/types';

/**
 * How long an open request waits for the terms URL to arrive from #4 before giving up
 * (Compose `withTimeoutOrNull(5_000)`).
 */
const TERMS_URL_WAIT_MS = 5_000;

/** Compose: the agentic header fades over ~90dp of scroll. */
const AGENTIC_HEADER_FADE_PX = 90;

/** Compose: the gradient band fades out over ~215dp of scroll so it does not linger. */
const GRADIENT_FADE_PX = 215;

/** Compose: the band is ~36.6% of the screen tall, solid green to 58.8% of its height. */
const GRADIENT_BAND_SCREEN_FRACTION = 0.366;
const GRADIENT_SOLID_FRACTION = 0.588;

/** Steps used to fake the vertical gradient's fade-out (see AgenticGradientBand). */
const GRADIENT_FADE_STEPS = 24;

type FeedRow =
  | { rowType: 'greeting' }
  | { rowType: 'inputs' }
  | { rowType: 'ssfr' }
  | { rowType: 'feedHeader' }
  | { rowType: 'section'; section: SectionDto }
  | { rowType: 'footer' };

export function HomeScreen(props: {
  onOpenDrawer: () => void;
  onNavigateToChat: (params: ChatRouteParams) => void;
  locationPrompt: UseLocationPromptResult;
  onNavigateToError: (isNetworkError: boolean, fromScreen: string, retry: () => void) => void;
  /**
   * 2.0.0: something outside Home asked for the in-app Terms-of-Use dialog. In the app this
   * arrives as a Plotline card CTA (`open_terms_of_use=true`) via
   * `PlotlineHomeEvents.openTermsOfUse`; the SDK carries no Plotline, so the host raises it
   * through `FarmerChat.openScreen('termsofuse')` (see AppNavGraph). Set back to false through
   * [onTermsOfUseRequestConsumed] once the request has been acted on, so a later terms fetch can
   * never re-open the dialog unprompted.
   */
  openTermsOfUseRequested?: boolean;
  /**
   * Called once [openTermsOfUseRequested] has been handled (dialog opened, or the terms URL
   * failed to arrive and the error toast was shown).
   */
  onTermsOfUseRequestConsumed?: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const sdk = useSdk();
  const label = useLabel();
  const insets = useSafeAreaInsets();
  const { state, onAction, dismissCard } = useHome(sdk);
  const profile = useEnterName(sdk); // vmProfile — gender/livestock updates
  const { toast, showToast } = useToastState();

  const [textInputVisible, setTextInputVisible] = useState(false);
  const [voiceInputVisible, setVoiceInputVisible] = useState(false);
  const [photoInputVisible, setPhotoInputVisible] = useState(false);
  const [permissionDialog, setPermissionDialog] = useState<'camera' | 'microphone' | null>(null);
  const pendingVoice = useRef<RecordedAudio | null>(null);
  const viewedStatements = useRef(new Set<number>());
  const pendingCard = useRef<SectionDto | null>(null);

  const userId = sdk.session.userId;

  // 2.0.0 composer / agentic Home. The app gates this on two independent Firebase Remote Config
  // flags (`getComposerUiEnabled()` for the input surface, `getAgenticChatEnabled()` for the
  // visual theme + card-tap API routing). The SDK carries no Remote Config and exposes exactly
  // one host-set switch, so both collapse onto `enableAgenticChat` — the same collapse the
  // Compose SDK makes (HomeScreen.kt:159). With it off, the 1.0.0 green surface + sticky
  // Photo/Speak/Type tiles + text overlay are untouched (root CLAUDE.md §3).
  const isComposerUi = sdk.config.enableAgenticChat;
  const composerRef = useRef<InputComposerHandle>(null);
  // Single attached image per query — the composer renders the thumbnail, this screen owns it.
  const [attachedImage, setAttachedImage] = useState<PickedImage | null>(null);
  // Drives the header pin/fade and the gradient band's scroll fade. Written imperatively from
  // onScroll so scrolling never re-renders the feed.
  const scrollY = useRef(new Animated.Value(0)).current;
  const onFeedScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.setValue(event.nativeEvent.contentOffset.y);
    },
    [scrollY],
  );

  // ---- terms-of-use dialog (2.0.0) ----
  const [showTermsOfUseDialog, setShowTermsOfUseDialog] = useState(false);
  const termsUrlRef = useRef<string | null>(null);
  termsUrlRef.current = state.farmerchatTermsOfUse;

  // --- lifecycle: NewConversation, FetchUserProfile, LoadHome + LoadWeather ---
  useEffect(() => {
    sdk.analytics.trackScreenView(ScreenNames.HOME);
    sdk.analytics.track(AnalyticsEvents.DASHBOARD_VIEWED, {});
    if (userId) {
      onAction({ type: 'NewConversation', userId });
      onAction({ type: 'FetchUserProfile', userId });
    }
    onAction({
      type: 'LoadHome',
      userDeviceTime: new Date().toISOString(),
      userId: sdk.session.isAuthenticated ? userId : null,
    });
    onAction({ type: 'LoadWeather', userId });
    // App parity (HomeScreen.kt:349): fetch the legal links on EVERY Home entry, not lazily
    // when the dialog is asked for — farmerchatTermsOfUse has to already be in state by the
    // time an open request arrives. Best-effort; a failure only leaves it null.
    onAction({ type: 'FetchPrivacyPolicy' });
    if (userId && !sdk.store.getBoolean(StorageKeys.BUILD_VERSION_API_CALLED)) {
      void sdk.api.updateBuildVersion({ user_id: userId }).then((result) => {
        if (result.ok) sdk.store.set(StorageKeys.BUILD_VERSION_API_CALLED, true);
      });
    }
    return () => sdk.analytics.trackScreenExit(ScreenNames.HOME);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // widget location refresh → reload home
  useEffect(() => {
    return props.locationPrompt.addEventListener((event) => {
      if (event.kind === 'LocationUpdatedFromWidget') {
        showToast(label(Labels.LOCATION_UPDATED, 'Location updated'), 'success');
        onAction({
          type: 'LoadHome',
          userDeviceTime: new Date().toISOString(),
          userId: sdk.session.isAuthenticated ? userId : null,
          skipLoadingCheck: true,
        });
        onAction({ type: 'LoadWeather', userId, skipLoadingCheck: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- voice transcription result → navigate to Chat --------------------------
  useEffect(() => {
    const t = state.voiceTranscribeState;
    if (t.kind === 'success') {
      const audio = pendingVoice.current;
      pendingVoice.current = null;
      onAction({ type: 'ClearTranscriptionState' });
      props.onNavigateToChat({
        source: 'home',
        question: t.data.heard_input_query ?? '',
        transcriptionId: t.data.transcription_id ?? undefined,
        audioUri: audio?.uri,
      });
    } else if (t.kind === 'error') {
      onAction({ type: 'ClearTranscriptionState' });
      pendingVoice.current = null;
      showToast(t.message, 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.voiceTranscribeState.kind]);

  // --- content-card tap → FetchImageStatement → Chat --------------------------
  useEffect(() => {
    const s = state.imageStatementState;
    if (s.kind === 'success' && pendingCard.current) {
      const section = pendingCard.current;
      pendingCard.current = null;
      onAction({ type: 'ConsumeResult' });
      props.onNavigateToChat({
        source: 'home',
        // App parity: question_text first, then title.
        question: section.question_text ?? section.title ?? '',
        preGeneratedAnswer: s.data.short_answer ?? undefined,
        // App parity: #26 follow-ups are objects — sort by sequence, map to strings.
        follow_up_questions: (s.data.follow_up_questions ?? [])
          .slice()
          .sort((a, b) =>
            typeof a === 'object' && a && typeof b === 'object' && b ? (a.sequence ?? 0) - (b.sequence ?? 0) : 0,
          )
          .map((q) => (typeof q === 'string' ? q : q?.question ?? ''))
          .filter((q) => q.length > 0),
        homeStatementId: s.data.message_id ?? String(section.statement_id ?? ''),
        imageUri: section.image_url ?? undefined,
      });
    } else if (s.kind === 'error' && pendingCard.current) {
      pendingCard.current = null;
      onAction({ type: 'ConsumeResult' });
      showToast(s.message, 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.imageStatementState.kind]);

  // --- terms-of-use open request (2.0.0) ---------------------------------------
  // The terms URL is fetched on Home entry, so an open request can arrive before the fetch
  // completes. Wait briefly for a non-blank URL, then open — otherwise toast and consume the
  // request so it never opens "unprompted" on a later fetch (avoids a stale re-open). Port of
  // the Compose `withTimeoutOrNull(5_000) { snapshotFlow { ... }.first { !it.isNullOrBlank() } }`.
  useEffect(() => {
    if (props.openTermsOfUseRequested !== true) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    const tick = (): void => {
      if (cancelled) return;
      const url = termsUrlRef.current;
      if (url !== null && url.trim().length > 0) {
        props.onTermsOfUseRequestConsumed?.();
        sdk.analytics.track(AnalyticsEvents.TERMS_OF_USE_OPENED, { url });
        setShowTermsOfUseDialog(true);
        return;
      }
      if (Date.now() - startedAt >= TERMS_URL_WAIT_MS) {
        props.onTermsOfUseRequestConsumed?.();
        showToast(
          label(Labels.UNABLE_TO_LOAD_LEGAL_LINKS, 'Unable to load Terms of Use'),
          'error',
        );
        return;
      }
      timer = setTimeout(tick, 200);
    };
    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.openTermsOfUseRequested]);

  // --- weather ------------------------------------------------------------------
  const goToWeatherChat = useCallback(() => {
    props.onNavigateToChat({
      source: 'home',
      question: label(Labels.WHAT_IS_THE_PRESENT_WEATHER, 'What is the present weather?'),
      isWeatherAdviceCTA: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  const onWeatherClick = useCallback(() => {
    sdk.analytics.track(AnalyticsEvents.WEATHER_FORECAST_VIEWED, {});
    if (props.locationPrompt.hasKnownLocation()) {
      goToWeatherChat();
    } else {
      props.locationPrompt.triggerFromWeather(goToWeatherChat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goToWeatherChat]);

  // --- inputs ---------------------------------------------------------------------
  const onSendText = useCallback((text: string) => {
    setTextInputVisible(false);
    props.onNavigateToChat({ source: 'home', question: text });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onVoiceRecorded = useCallback(
    (audio: RecordedAudio) => {
      setVoiceInputVisible(false);
      const conversationId =
        state.newConversationState.kind === 'success'
          ? state.newConversationState.data.conversation_id
          : sdk.store.getString(StorageKeys.NEW_CONVERSATION_ID);
      if (!conversationId) {
        showToast(label(Labels.SOMETHING_WENT_WRONG, 'Something went wrong. Please try again.'), 'error');
        return;
      }
      pendingVoice.current = audio;
      onAction({
        type: 'TranscribeAudio',
        conversationId,
        query: audio.base64,
        messageReferenceId: `home-${Date.now()}`,
        audioFormat: audio.format,
        triggeredType: 'voice',
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.newConversationState],
  );

  const onPhotoPicked = useCallback((image: PickedImage) => {
    setPhotoInputVisible(false);
    props.onNavigateToChat({ source: 'home', question: '', imageUri: image.uri });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Composer send — port of Compose's `sendMessage(text, imageUri)` (HomeScreen.kt:995). An
   * attached image routes the query through image analysis on Chat; otherwise a non-blank
   * question opens Chat as a plain text query.
   */
  const sendFromComposer = useCallback(
    (text: string) => {
      const image = attachedImage;
      composerRef.current?.clear();
      setAttachedImage(null);
      if (image) {
        props.onNavigateToChat({ source: 'home', question: text, imageUri: image.uri });
      } else if (text.trim().length > 0) {
        props.onNavigateToChat({ source: 'home', question: text.trim() });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attachedImage],
  );

  // --- mark viewed (≥50% visible) ---------------------------------------------------
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const uid = sdk.session.userId;
      if (!uid) return;
      for (const token of viewableItems) {
        const row = token.item as FeedRow;
        if (
          row.rowType === 'section' &&
          typeof row.section.statement_id === 'number' &&
          row.section.is_viewed !== true &&
          !viewedStatements.current.has(row.section.statement_id)
        ) {
          viewedStatements.current.add(row.section.statement_id);
          onAction({ type: 'MarkImageViewed', statementId: row.section.statement_id, userId: uid });
        }
      }
    },
  );
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 });

  // --- feed rows ----------------------------------------------------------------------
  const feed = state.homeFeedState.kind === 'success' ? state.homeFeedState.data : null;
  const rows = useMemo<FeedRow[]>(() => {
    // App parity (HomeScreen.kt:759): agentic mode has nothing sticky — Compose keeps the
    // `stickyHeader` slot and renders `Spacer(0.dp)` because its DSL entry is keyed. RN has no
    // such constraint, and a zero-height cell in `stickyHeaderIndices` is NOT a no-op (it is
    // still measured and pinned, and it sits on the same viewability path that drives
    // MarkImageViewed), so the row is dropped instead. `stickyIndex` then comes back -1 and
    // `stickyHeaderIndices` is left undefined.
    const out: FeedRow[] = isComposerUi
      ? [{ rowType: 'greeting' }]
      : [{ rowType: 'greeting' }, { rowType: 'inputs' }];
    if (sdk.config.enableSsfr && feed?.ssfr_enable === true) out.push({ rowType: 'ssfr' });
    // App parity (HomeScreen.kt:807): agentic mode already shows "For your farm today" as the
    // top-of-feed SectionHeader under the app bar, so the in-feed FeedHeader is skipped to
    // avoid a duplicate title.
    if (!isComposerUi) out.push({ rowType: 'feedHeader' });
    for (const section of renderableSections(feed?.sections)) {
      if (state.dismissedCardIds.has(section.id)) continue;
      out.push({ rowType: 'section', section });
    }
    out.push({ rowType: 'footer' });
    return out;
  }, [feed, state.dismissedCardIds, isComposerUi]);

  const stickyIndex = rows.findIndex((r) => r.rowType === 'inputs');

  const renderSection = (section: SectionDto): React.ReactElement => {
    const selectionType = (section.selection_type ?? '').toLowerCase();
    const type = (section.type ?? '').toLowerCase();
    const hasOptions = (section.options?.length ?? 0) > 0;
    const submitLabel = label(Labels.CONFIRM, 'Confirm');
    const savingLabel = label(Labels.SAVING, 'Saving');
    const successMessage = label(
      Labels.THANK_YOU_YOUR_ANSWER_HELPS_US_GIVE_MORE_ACCURATE_ADVICE,
      'Thank you. Your answer helps us give more accurate advice.',
    );

    if ((type === 'question' || hasOptions) && selectionType === 'single') {
      return (
        <SingleSelectCard
          section={section}
          submitLabel={submitLabel}
          savingLabel={savingLabel}
          successMessage={successMessage}
          onDismissed={() => dismissCard(section.id)}
          onSubmit={(option) => {
            sdk.analytics.track(AnalyticsEvents.QUESTION_CARD_DATA_SUBMITTED, {
              section_id: section.id,
              option: option.text,
            });
            if (userId) {
              profile.dispatch({
                type: 'UpdateUserName',
                body: { user_id: userId, gender: option.id || option.text },
                screenName: ScreenNames.HOME,
              });
              sdk.store.set(StorageKeys.USER_GENDER, option.text);
            }
          }}
        />
      );
    }
    if ((type === 'question' || hasOptions) && selectionType) {
      return (
        <MultiSelectCard
          section={section}
          submitLabel={submitLabel}
          savingLabel={savingLabel}
          successMessage={successMessage}
          onDismissed={() => dismissCard(section.id)}
          onSubmit={(options) => {
            sdk.analytics.track(AnalyticsEvents.QUESTION_CARD_DATA_SUBMITTED, {
              section_id: section.id,
              options: options.map((o) => o.text),
            });
            if (userId) {
              const statementType = (section.statement_type ?? section.type ?? '').toLowerCase();
              if (
                statementType.includes('livestock') ||
                options.some((o) => o.id.toLowerCase().includes('livestock'))
              ) {
                profile.dispatch({
                  type: 'UpdateUserName',
                  body: {
                    user_id: userId,
                    live_stock_details: options.map((o) => ({ count: 1, name: o.text })),
                  },
                  screenName: ScreenNames.HOME,
                });
              } else {
                const cropIds = options
                  .map((o) => Number(o.id))
                  .filter((n) => Number.isFinite(n));
                onAction({ type: 'UpdateCultivatedCrops', userId, cropIds });
              }
            }
          }}
        />
      );
    }
    return (
      <ContentCard
        section={section}
        ctaLabel={label(Labels.START_CHAT, 'Start chat')}
        isButtonLoading={
          pendingCard.current?.id === section.id &&
          state.imageStatementState.kind === 'loading'
        }
        onTap={() => {
          sdk.analytics.track(AnalyticsEvents.CARD_CLICKED, {
            section_id: section.id,
            statement_id: section.statement_id ?? null,
          });
          // App parity (HomeScreen.kt:833): with agentic chat on, the card tap SKIPS the
          // pre-generated-answer API (#13 FetchImageStatement) and sends the card question
          // into chat as a normal text query, for both image and statement cards.
          //
          // SDK deviation (same as Compose): the app also forwards the card image url so chat
          // can show it as a display-only banner on the user bubble. ChatRouteParams has no
          // display-only image field — its `imageUri` routes the query through image analysis,
          // which is exactly what this path must avoid — so the banner is dropped, as is the
          // app's `cardTriggerType`.
          if (isComposerUi) {
            const question = section.question_text ?? section.title ?? '';
            if (question.trim().length > 0) {
              props.onNavigateToChat({
                source: 'home',
                question,
                homeStatementId:
                  section.statement_id != null ? String(section.statement_id) : section.id,
              });
            }
            return;
          }
          if (typeof section.statement_id === 'number') {
            pendingCard.current = section;
            onAction({
              type: 'FetchImageStatement',
              statementId: section.statement_id,
              // App parity (HomeScreen.kt:580-584): image_card / text_card by section type.
              triggeredInputType:
                section.type === 'image' ? 'image_card' : section.type === 'statement' ? 'text_card' : 'card',
            });
          } else {
            props.onNavigateToChat({
              source: 'home',
              question: section.title ?? section.question_text ?? '',
            });
          }
        }}
      />
    );
  };

  const renderRow = ({ item }: { item: FeedRow }): React.ReactElement | null => {
    switch (item.rowType) {
      case 'greeting':
        // App parity (HomeScreen.kt:668): agentic mode replaces the greeting with a centred
        // logo mark + leaf-flanked "For your farm today" + the location pill (Figma 1.2 Home).
        // It is the list's FIRST item so its buttons stay tappable, but it is PINNED and FADED
        // as the list scrolls so cards rise and draw over it instead of it scrolling away.
        //
        // SDK deviation from Compose: Compose forces later cards on top with `zIndex(-1f)`;
        // in RN later FlatList cells are later siblings and already paint above, so no zIndex
        // is needed. Compose also pins the app bar inside this block — here the app bar sits
        // above the list (it must survive the loading and error branches, which render no list
        // at all), so it is already fixed and only this block is pinned.
        if (isComposerUi) {
          return (
            <Animated.View
              style={[
                styles.agenticHeader,
                {
                  opacity: scrollY.interpolate({
                    inputRange: [0, AGENTIC_HEADER_FADE_PX],
                    outputRange: [1, 0],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    {
                      translateY: scrollY.interpolate({
                        inputRange: [0, AGENTIC_HEADER_FADE_PX],
                        outputRange: [0, AGENTIC_HEADER_FADE_PX],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            >
              <LogoMark size={42} color={theme.brand.foregroundPrimary} />
              <SectionHeader
                title={label(Labels.FOR_YOUR_FARM_TODAY, 'For your farm today')}
                titleColor={theme.brand.foregroundPrimary}
                verticalPadding={0}
              />
              <HomeLocationPill locationPrompt={props.locationPrompt} />
            </Animated.View>
          );
        }
        return (
          <View style={styles.greeting}>
            {feed ? (
              // The feed has loaded: show its greeting, or the label the app uses.
              // `greeting` is ABSENT from the response whenever the feed is empty (no resolved
              // location), so keying the skeleton off it alone shimmers forever. App parity:
              // fc-compose HomeScreen.kt:892 reads this label and never renders the API greeting.
              <Text
                style={[
                  typography.displaySmall,
                  { color: theme.brand.foregroundPrimary, textAlign: 'center' },
                ]}
              >
                {feed.greeting?.trim() ||
                  label(
                    Labels.GET_STARTED_BY_CLICKING_ON_PHOTO_SPEAK_OR_TYPE_TO_ASK_YOUR_QUESTION,
                    'Ask by Voice, Photo or Text',
                  )}
              </Text>
            ) : (
              // Still loading — skeleton is correct here.
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <SkeletonBlock width="70%" height={28} color="rgba(255,255,255,0.18)" />
                <SkeletonBlock width="45%" height={28} color="rgba(255,255,255,0.18)" />
              </View>
            )}
          </View>
        );
      case 'inputs':
        // Legacy path only — the agentic feed does not emit this row at all (see `rows`).
        return (
          <PrimaryInputButtons
            variant="home"
            showPhoto={sdk.config.enableImages}
            showSpeak={sdk.config.enableVoice}
            onPhoto={() => {
              sdk.analytics.track(AnalyticsEvents.IMAGE_OPTION_DIALOG_CLICK_EVENT, {
                screen_name: ScreenNames.HOME,
              });
              setPhotoInputVisible(true);
            }}
            onSpeak={() => {
              sdk.analytics.track(AnalyticsEvents.MICROPHONE_CLICK_EVENT, {
                screen_name: ScreenNames.HOME,
              });
              setVoiceInputVisible(true);
            }}
            onType={() => {
              sdk.analytics.track(AnalyticsEvents.CHAT_ICON_CLICKED, {
                screen_name: ScreenNames.HOME,
              });
              setTextInputVisible(true);
            }}
          />
        );
      case 'ssfr':
        return (
          <SsfrCard
            title={label(Labels.SSFR_ADVISORY, 'SSFR Advisory')}
            subtitle={label(
              Labels.SSFR_ADVISORY_DESCRIPTION,
              'Access site specific fertilizer recommendations',
            )}
            wheatLabel={label(Labels.SSFR_WHEAT, 'Wheat')}
            maizeLabel={label(Labels.SSFR_MAIZE, 'Maize')}
            onCropPress={(crop) => {
              sdk.analytics.track(AnalyticsEvents.CARD_CLICKED, { card_type: 'ssfr', crop });
              props.onNavigateToChat({
                source: 'home',
                question:
                  crop === 'wheat'
                    ? label(
                        Labels.SSFR_WHEAT_QUESTION,
                        'Give me fertilizer recommendation for my wheat farm',
                      )
                    : label(
                        Labels.SSFR_MAIZE_QUESTION,
                        'Give me fertilizer recommendation for my maize farm',
                      ),
                isSSFR: true,
                ssfrCrop: crop,
              });
            }}
          />
        );
      case 'feedHeader':
        return <FeedHeader title={label(Labels.FOR_YOUR_FARM_TODAY, 'For your farm today')} />;
      case 'section':
        return renderSection(item.section);
      case 'footer':
        return (
          <FeedFooter
            text={label(
              Labels.HAVE_A_GREAT_DAY_COME_BACK_TOMORROW,
              'Have a great day,\ncome back tomorrow',
            )}
          />
        );
      default:
        return null;
    }
  };

  const weather = state.weatherState.kind === 'success' ? state.weatherState.data : null;
  const weatherLoading = state.weatherState.kind === 'loading';
  const isWidgetGpsLoading = props.locationPrompt.state.kind === 'FetchingLocation';
  // App parity: current_temp is a String, rendered verbatim (was Math.round of a number).
  const weatherText = weather?.current_temp ? `${weather.current_temp}°` : '';

  return (
    <View
      style={[
        styles.container,
        {
          // App parity (HomeScreen.kt:534): in agentic mode the app surface is the grey
          // reading surface and the green lives only in the gradient band below, which bleeds
          // down behind the header and first card. Non-agentic keeps the v1 green base.
          backgroundColor: isComposerUi
            ? theme.content.surfacePrimary
            : theme.brand.surfacePrimary,
        },
      ]}
    >
      {isComposerUi ? <AgenticGradientBand scrollY={scrollY} /> : null}
      <HomeAppBar
        showBackground={!isComposerUi}
        showMenu={sdk.config.showDrawer}
        onMenuPress={() => {
          sdk.analytics.track(AnalyticsEvents.HAMBURGER_MENU_CLICKED, {});
          props.onOpenDrawer();
        }}
        showWeather={
          sdk.config.enableWeather && (weather !== null || weatherLoading)
        }
        weatherState={(weatherLoading ? 'Loading' : 'Default') as WeatherButtonState}
        weatherText={weatherText}
        weatherIconUrl={weather?.weather_icon}
        weatherLoadingLabel={label(Labels.LOADING, 'Loading...')}
        onWeatherPress={onWeatherClick}
      />

      {state.homeFeedState.kind === 'loading' ||
      state.homeFeedState.kind === 'idle' ||
      isWidgetGpsLoading ? (
        <View style={styles.center}>
          <LogoSpinnerVertical
            message={
              isWidgetGpsLoading
                ? label(Labels.GETTING_YOUR_LOCATION, 'Getting your location…')
                : label(Labels.GETTING_TODAYS_ADVICE, "Getting today's advice")
            }
          />
        </View>
      ) : state.homeFeedState.kind === 'error' ? (
        <View style={styles.center}>
          <HomeFeedErrorUI
            title={label(Labels.CANT_LOAD_RIGHT_NOW, "Can't load right now")}
            retryLabel={label(Labels.TRY_AGAIN, 'Try again')}
            onRetry={() => {
              sdk.analytics.track(AnalyticsEvents.CONTENT_TRY_AGAIN_CLICKED, {});
              onAction({
                type: 'LoadHome',
                userDeviceTime: new Date().toISOString(),
                userId: sdk.session.isAuthenticated ? userId : null,
                skipLoadingCheck: true,
              });
            }}
          />
        </View>
      ) : (
        <FlatList
          data={rows}
          renderItem={renderRow}
          keyExtractor={(row, index) =>
            row.rowType === 'section' ? `s-${row.section.id}` : `${row.rowType}-${index}`
          }
          stickyHeaderIndices={stickyIndex >= 0 ? [stickyIndex] : undefined}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig.current}
          onScroll={isComposerUi ? onFeedScroll : undefined}
          scrollEventThrottle={16}
          // The composer is a flow element below this list (see InputComposer's header) and it
          // consumes the bottom safe-area inset itself, so reserving it here too would double
          // the gap — unlike Compose, where the composer overlays the list and
          // composerBarHeight(floating = true) has to be reserved as contentPadding.
          contentContainerStyle={{ paddingBottom: isComposerUi ? 0 : insets.bottom }}
        />
      )}

      {/* App parity (HomeScreen.kt:947): persistent floating composer (camera / text field /
          mic|send) replacing BOTH the sticky PrimaryInputButtons and the text overlay. It
          consumes the nav + IME insets itself, so it takes no extra padding here.

          SDK deviation from Compose: no idle "aura" — Compose strokes the idle field with a
          rotating multi-colour sweep gradient, and this package has no gradient/shader
          primitive (see InputComposer's header), so `showAura` does not exist as a prop. */}
      {isComposerUi ? (
        <InputComposer
          ref={composerRef}
          floating
          isAnchored
          surfaceColor={theme.brand.surfacePrimary}
          placeholder={label(Labels.ASK_ABOUT_YOUR_FARM, 'Ask about your farm...')}
          showPhoto={sdk.config.enableImages}
          showVoice={sdk.config.enableVoice}
          attachedImageUri={attachedImage?.uri ?? null}
          onRemoveAttachedImage={() => setAttachedImage(null)}
          onPhotoPress={() => {
            // Camera is only offered when no image is attached; same guard and same
            // CHAT_ICON_CLICKED (Image) event as the legacy Photo button.
            if (!attachedImage) {
              sdk.analytics.track(AnalyticsEvents.CHAT_ICON_CLICKED, {
                screen_name: ScreenNames.HOME,
                Icon: 'Image',
              });
              setPhotoInputVisible(true);
            }
          }}
          onVoicePress={() => {
            sdk.analytics.track(AnalyticsEvents.MICROPHONE_CLICK_EVENT, {
              screen_name: ScreenNames.HOME,
            });
            setVoiceInputVisible(true);
          }}
          // Tapping the field to type is the composer's equivalent of the legacy Type button,
          // so CHAT_ICON_CLICKED (Text) fires on focus gain — a reliable tap signal, since the
          // field's own gesture would starve a parent press handler.
          onFocusChange={(focused) => {
            if (focused) {
              sdk.analytics.track(AnalyticsEvents.CHAT_ICON_CLICKED, {
                screen_name: ScreenNames.HOME,
                Icon: 'Text',
              });
            }
          }}
          onSend={sendFromComposer}
        />
      ) : null}

      {!isComposerUi ? (
        <TextInputOverlay
          visible={textInputVisible}
          placeholder={label(Labels.ASK_ABOUT_YOUR_FARM, 'Ask about your farm...')}
          sendLabel={label(Labels.SEND, 'Send')}
          onSend={onSendText}
          onClose={() => setTextInputVisible(false)}
          onPhoto={() => {
            setTextInputVisible(false);
            setPhotoInputVisible(true);
          }}
          onVoice={() => {
            setTextInputVisible(false);
            setVoiceInputVisible(true);
          }}
        />
      ) : null}
      <VoiceInputOverlay
        visible={voiceInputVisible}
        onSend={onVoiceRecorded}
        onClose={() => setVoiceInputVisible(false)}
        onPermissionPermanentlyDenied={() => setPermissionDialog('microphone')}
      />
      <PhotoInputSheet
        visible={photoInputVisible}
        // Composer UI: a picked photo becomes the composer's single attachment, so the farmer
        // can type a question alongside it. The legacy sheet has nowhere to hold one, so it
        // navigates straight into Chat, exactly as in 1.0.0.
        onPicked={
          isComposerUi
            ? (image) => {
                setPhotoInputVisible(false);
                setAttachedImage(image);
                composerRef.current?.focus();
              }
            : onPhotoPicked
        }
        onClose={() => setPhotoInputVisible(false)}
        onPermissionPermanentlyDenied={() => setPermissionDialog('camera')}
      />
      <PermissionSettingsDialog
        visible={permissionDialog !== null}
        permission={permissionDialog ?? 'camera'}
        onDismiss={() => setPermissionDialog(null)}
      />
      {state.voiceTranscribeState.kind === 'loading' ? (
        <View style={[styles.transcribing, { backgroundColor: theme.content.scrim }]}>
          <LogoSpinnerVertical message={label(Labels.PROCESSING, 'Processing...')} />
        </View>
      ) : null}
      {/* 2.0.0 in-app Terms-of-Use dialog. Guarded on a non-blank URL by the effect above; the
          check here keeps it correct even if state is refetched to null while it is open. */}
      {showTermsOfUseDialog &&
      state.farmerchatTermsOfUse !== null &&
      state.farmerchatTermsOfUse.trim().length > 0 ? (
        <TermsOfUseDialog
          visible
          url={state.farmerchatTermsOfUse}
          title={label(Labels.TERMS_OF_USE, 'Terms of Use')}
          onDismiss={() => setShowTermsOfUseDialog(false)}
          onAcceptAndContinue={() => {
            // accept_terms (#7) — best-effort in useHome; the dialog closes either way. The
            // app also tracks a Plotline ToS event here; the SDK emits no Plotline-named event
            // (root CLAUDE.md §2 forbids new event names), so only TERMS_OF_USE_OPENED above
            // reaches the host.
            if (userId) onAction({ type: 'AcceptTerms', userId });
            setShowTermsOfUseDialog(false);
          }}
        />
      ) : null}
      <Toast toast={toast} />
    </View>
  );
}

/**
 * The fixed green→transparent band behind the agentic Home header (Figma 1.2 Home). Solid
 * brand green to ~58.8% of a band ~36.6% of the screen tall, transparent by its bottom. It
 * sits BEHIND the list and fades out over ~215dp of scroll so it does not linger once scrolled.
 * The yellow glow sits top-centre.
 *
 * SDK deviations from the Compose reference (both deliberate):
 *  - **Stepped fade, not a shader.** Compose paints `Brush.verticalGradient`. This package has
 *    no gradient primitive in its dependency set (no react-native-svg, no
 *    expo-linear-gradient — the same constraint documented in InputComposer's header), so the
 *    fade is 24 stacked one-pixel-per-step rows of decreasing alpha over the same span. At this
 *    size the banding is not perceptible, and unlike the composer's rotating sweep aura a
 *    vertical ramp is faithfully steppable.
 *  - **No Sunbeams.** Compose sways blurred rays inside the band via `BlurMaskFilter` into
 *    cached offscreen bitmaps. RN has no blur/offscreen-render primitive here, so the beams are
 *    SKIPPED rather than approximated; the yellow glow raster is kept.
 */
function AgenticGradientBand(props: { scrollY: Animated.Value }): React.ReactElement {
  const theme = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  const bandHeight = Math.round(screenHeight * GRADIENT_BAND_SCREEN_FRACTION);
  const solidHeight = Math.round(bandHeight * GRADIENT_SOLID_FRACTION);
  const fadeHeight = Math.max(bandHeight - solidHeight, 0);
  const stepHeight = fadeHeight / GRADIENT_FADE_STEPS;
  const green = theme.brand.surfacePrimary;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.gradientBand,
        {
          height: bandHeight,
          opacity: props.scrollY.interpolate({
            inputRange: [0, GRADIENT_FADE_PX],
            outputRange: [1, 0],
            extrapolate: 'clamp',
          }),
        },
      ]}
    >
      <View style={{ height: solidHeight, backgroundColor: green }} />
      {Array.from({ length: GRADIENT_FADE_STEPS }, (_, index) => (
        <View
          key={index}
          style={{
            height: stepHeight,
            backgroundColor: green,
            opacity: 1 - (index + 1) / GRADIENT_FADE_STEPS,
          }}
        />
      ))}
      <Glow
        type="yellow"
        height={148}
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
      />
    </Animated.View>
  );
}

/**
 * Location 2.0 pill — port of Compose's `HomeLocationPill` + `LocationButton` (HomeScreen.kt:1085
 * / LocationButton.kt). Real acquisition, driven by the shared location-prompt state machine.
 *
 * SDK deviations from the Compose reference (all because the RN core lacks the Android-only
 * hooks the Compose pill leans on — recorded in docs/04):
 *  - **No `LocalContext` trigger source.** `useLocationPrompt` exposes `'weather' | 'widget'`
 *    only, so the pill drives the WIDGET flow — which is the silent one (no interstitial), the
 *    behaviour this pill wants. It therefore also reacts to a widget-driven refresh raised
 *    elsewhere; the weather flow stays visually separate because its state carries
 *    `source === 'weather'`.
 *  - **No Blocked state.** There is no location permission deny-count key in the RN store
 *    (`sessionStore.ts` has camera/mic counts only), and inventing one is out of bounds
 *    (root CLAUDE.md §2). A blocked permission surfaces through the shared prompt host's
 *    Recovery / GPS-error path instead, so the pill stays on Invite.
 *  - **Place name from the stored geography keys.** Android reads `APPROX_LOCATION_NAME`, which
 *    core writes from the #16 `display_address`. The RN store has no such key, so the name comes
 *    from `USER_DISTRICT → USER_STATE → USER_COUNTRY_NAME`, all of which #16 already fills.
 *  - **No haptics and no width-morph spring.** RN has no `performHapticFeedback` in this
 *    dependency set; the label swap crossfades instead of morphing the pill's width.
 */
function HomeLocationPill(props: {
  locationPrompt: UseLocationPromptResult;
}): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();
  const sdk = useSdk();
  const { locationPrompt } = props;

  const [showSuccess, setShowSuccess] = useState(false);
  useEffect(
    () =>
      locationPrompt.addEventListener((event) => {
        if (event.kind !== 'LocationUpdatedFromWidget') return;
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2_000);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const isThisFlow = locationPrompt.source === 'widget';
  // Only show the spinner once acquisition has actually started — not while the OS permission
  // dialog is still up, which reads as "started too early".
  const isSearching =
    isThisFlow &&
    (locationPrompt.state.kind === 'FetchingLocation' ||
      locationPrompt.state.kind === 'RequestEnableGps');
  const placeName = (
    sdk.store.getString(StorageKeys.USER_DISTRICT) ??
    sdk.store.getString(StorageKeys.USER_STATE) ??
    sdk.store.getString(StorageKeys.USER_COUNTRY_NAME) ??
    ''
  ).trim();
  const hasExactLocation = locationPrompt.hasKnownLocation();

  const pillState: 'Invite' | 'Searching' | 'Success' | 'Located' = isSearching
    ? 'Searching'
    : showSuccess
      ? 'Success'
      : hasExactLocation && placeName.length > 0
        ? 'Located'
        : 'Invite';

  const brand = theme.brand;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (pillState === 'Searching') return; // dead tap mid-search, as in Compose
        locationPrompt.triggerFromWidget();
      }}
      style={({ pressed }) => [
        styles.locationPill,
        {
          // Figma: the pill is the brand secondary surface at 72% only while inviting; once
          // acquisition starts (and after), it solidifies to 100%.
          backgroundColor: brand.surfaceSecondary,
          opacity: (pillState === 'Invite' ? 0.72 : 1) * (pressed ? 0.85 : 1),
          height: pillState === 'Invite' || pillState === 'Searching' ? 42 : 40,
        },
      ]}
    >
      {pillState === 'Searching' ? (
        <ActivityIndicator size="small" color={brand.foregroundSecondary} />
      ) : pillState === 'Success' ? (
        <FcIcon name="check" size={22} tint={brand.foregroundSecondary} />
      ) : (
        <LocationPinGlyph size={22} color={brand.foregroundSecondary} holeColor={brand.surfaceSecondary} />
      )}
      <Text
        numberOfLines={1}
        style={[typography.labelMedium, { color: brand.foregroundPrimary }]}
      >
        {pillState === 'Searching'
          ? label(Labels.GETTING_YOUR_LOCATION, 'Getting your location')
          : pillState === 'Success'
            ? label(Labels.LOCATION_FOUND, 'Location found')
            : pillState === 'Located'
              ? `${placeName} - `
              : label(Labels.SET_YOUR_LOCATION, 'Set your location')}
        {pillState === 'Located' ? (
          <Text style={[typography.labelMedium, { color: brand.foregroundSecondary }]}>
            {label(Labels.CHANGE, 'Change')}
          </Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradientBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  agenticHeader: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    paddingTop: 2,
    paddingBottom: 16,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.rounded,
    paddingLeft: 14,
    paddingRight: 22,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  greeting: { paddingHorizontal: 24, paddingVertical: 20 },
  transcribing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
