/**
 * Home / dashboard (docs/01 §3.7) — 1:1 with the Compose SDK HomeScreen:
 * brand-green surface, HomeAppBar (menu chip + weather pill with yellow glow),
 * centered white greeting, sticky Photo/Speak/Type tiles, SSFR card, daily feed
 * (content / single-select / multi-select cards), input overlays, feed
 * loading/error UI.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
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
  HomeAppBar,
  HomeFeedErrorUI,
  LogoSpinnerVertical,
  SkeletonBlock,
  Toast,
  useToastState,
} from '../components/Chrome';
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
import { spacing, typography } from '../theme';
import { Text } from 'react-native';

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
        question: section.title ?? section.question_text ?? '',
        preGeneratedAnswer: s.data.short_answer ?? undefined,
        follow_up_questions: s.data.follow_up_questions ?? undefined,
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
    const out: FeedRow[] = [{ rowType: 'greeting' }, { rowType: 'inputs' }];
    if (sdk.config.enableSsfr && feed?.ssfr_enable === true) out.push({ rowType: 'ssfr' });
    out.push({ rowType: 'feedHeader' });
    for (const section of feed?.sections ?? []) {
      if (state.dismissedCardIds.has(section.id)) continue;
      if ((section.type ?? '').includes('plotline')) continue; // campaign surfaces omitted (docs/03)
      out.push({ rowType: 'section', section });
    }
    out.push({ rowType: 'footer' });
    return out;
  }, [feed, state.dismissedCardIds]);

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
          if (typeof section.statement_id === 'number') {
            pendingCard.current = section;
            onAction({
              type: 'FetchImageStatement',
              statementId: section.statement_id,
              triggeredInputType: 'card',
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
        return (
          <View style={styles.greeting}>
            {feed && feed.greeting ? (
              <Text
                style={[
                  typography.displaySmall,
                  { color: theme.brand.foregroundPrimary, textAlign: 'center' },
                ]}
              >
                {feed.greeting}
              </Text>
            ) : (
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <SkeletonBlock width="70%" height={28} color="rgba(255,255,255,0.18)" />
                <SkeletonBlock width="45%" height={28} color="rgba(255,255,255,0.18)" />
              </View>
            )}
          </View>
        );
      case 'inputs':
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
  const weatherText =
    weather?.current_temp !== null && weather?.current_temp !== undefined
      ? `${Math.round(weather.current_temp)}°`
      : '';

  return (
    <View style={[styles.container, { backgroundColor: theme.brand.surfacePrimary }]}>
      <HomeAppBar
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
          contentContainerStyle={{ paddingBottom: insets.bottom }}
        />
      )}

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
      <VoiceInputOverlay
        visible={voiceInputVisible}
        onSend={onVoiceRecorded}
        onClose={() => setVoiceInputVisible(false)}
        onPermissionPermanentlyDenied={() => setPermissionDialog('microphone')}
      />
      <PhotoInputSheet
        visible={photoInputVisible}
        onPicked={onPhotoPicked}
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
      <Toast toast={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  greeting: { paddingHorizontal: 24, paddingVertical: 20 },
  transcribing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
