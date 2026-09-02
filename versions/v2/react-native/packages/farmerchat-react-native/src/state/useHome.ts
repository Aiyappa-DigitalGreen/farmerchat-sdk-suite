/**
 * useHome — port of `HomeViewModel` + home UDF (docs/01 §3.7: HomeAction /
 * HomeState): feed, weather, cards, dismiss, mark-viewed, crop update,
 * new conversation, audio transcription.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { UiStates, type UiState } from '../core/apiResult';
import { AnalyticsEvents } from '../core/analytics';
import type { FarmerChatSdk } from '../core/sdk';
import { StorageKeys } from '../core/sessionStore';
import type {
  CropResponse,
  GetVoiceResponse,
  HomeUdfResponse,
  ImageStatementResponse,
  ImageViewedResponse,
  NewConversationResponse,
  WeatherResponse,
} from '../core/types';
import { renderableSections } from '../core/types';

export type HomeAction =
  | {
      type: 'LoadHome';
      userDeviceTime: string;
      userId?: string | null;
      skipLoadingCheck?: boolean;
    }
  | { type: 'LoadWeather'; userId: string | null; skipLoadingCheck?: boolean }
  | { type: 'FetchUserProfile'; userId: string }
  | { type: 'UpdateCultivatedCrops'; userId: string; cropIds: number[] }
  | { type: 'NewConversation'; userId: string; contentProviderId?: number | null }
  | {
      type: 'TranscribeAudio';
      conversationId: string;
      /** base64 audio */
      query: string;
      messageReferenceId: string;
      audioFormat: string;
      triggeredType: string;
    }
  | { type: 'MarkImageViewed'; statementId: number; userId: string }
  | { type: 'FetchImageStatement'; statementId: number; triggeredInputType: string }
  | { type: 'ClearTranscriptionState' }
  | { type: 'ConsumeResult' }
  | { type: 'SetLoadingState' };

export interface HomeState {
  homeFeedState: UiState<HomeUdfResponse>;
  weatherState: UiState<WeatherResponse>;
  cropUpdateState: UiState<CropResponse>;
  newConversationState: UiState<NewConversationResponse>;
  voiceTranscribeState: UiState<GetVoiceResponse>;
  imageViewedState: UiState<ImageViewedResponse>;
  imageStatementState: UiState<ImageStatementResponse>;
  dismissedCardIds: Set<string>;
}

const initialHomeState: HomeState = {
  homeFeedState: UiStates.idle(),
  weatherState: UiStates.idle(),
  cropUpdateState: UiStates.idle(),
  newConversationState: UiStates.idle(),
  voiceTranscribeState: UiStates.idle(),
  imageViewedState: UiStates.idle(),
  imageStatementState: UiStates.idle(),
  dismissedCardIds: new Set<string>(),
};

/** Accept transcription only if !error && confidence > 0.7 && text not blank (docs/02). */
export function isTranscriptionAcceptable(response: GetVoiceResponse): boolean {
  return (
    response.error !== true &&
    (response.confidence_score ?? 0) > 0.7 &&
    (response.heard_input_query ?? '').trim().length > 0
  );
}

export interface UseHomeResult {
  state: HomeState;
  onAction: (action: HomeAction) => void;
  dismissCard: (sectionId: string) => void;
}

export function useHome(sdk: FarmerChatSdk): UseHomeResult {
  const [state, setState] = useState<HomeState>(initialHomeState);
  const mounted = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const patch = useCallback((partial: Partial<HomeState>) => {
    if (!mounted.current) return;
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const loadHome = useCallback(
    async (userDeviceTime: string, userId: string | null, skipLoadingCheck: boolean) => {
      if (!skipLoadingCheck && stateRef.current.homeFeedState.kind === 'loading') return;
      patch({ homeFeedState: UiStates.loading() });
      const result = await sdk.api.getDailyFeed(userDeviceTime, userId);
      if (!mounted.current) return;
      if (result.ok) {
        const data: HomeUdfResponse = result.data ?? { sections: [] }; // 204 → empty
        sdk.store.setJson(StorageKeys.CACHED_HOME_FEED_RESPONSE, data);
        patch({ homeFeedState: UiStates.success(data) });
        // App parity (HomeScreen.kt:792): plotline_widget sections are excluded from
        // card-shown analytics and counts.
        sdk.analytics.track(AnalyticsEvents.DASHBOARD_VIEWED, {
          section_count: renderableSections(data.sections).length,
        });
        for (const section of renderableSections(data.sections)) {
          sdk.analytics.track(AnalyticsEvents.CARD_SHOWN, {
            section_id: section.id,
            section_type: section.type ?? 'unknown',
            statement_id: section.statement_id ?? null,
          });
        }
      } else {
        // fall back to cache when offline (app shows cached feed if present)
        const cached = sdk.store.getJson<HomeUdfResponse>(
          StorageKeys.CACHED_HOME_FEED_RESPONSE,
        );
        if (cached && (result.isNetworkError || result.isTimeout)) {
          patch({ homeFeedState: UiStates.success(cached) });
        } else {
          patch({
            homeFeedState: UiStates.error(
              result.message ?? 'Could not load your feed',
              result.code,
              result.isNetworkError || result.isTimeout,
            ),
          });
        }
      }
    },
    [patch, sdk],
  );

  const loadWeather = useCallback(
    async (userId: string | null, skipLoadingCheck: boolean) => {
      if (!sdk.config.enableWeather) return;
      if (!skipLoadingCheck && stateRef.current.weatherState.kind === 'loading') return;
      // Guests pass userId=null (docs/01 §3.7 lifecycle) — weather needs a user.
      if (!userId) {
        patch({ weatherState: UiStates.idle() });
        return;
      }
      patch({ weatherState: UiStates.loading() });
      const result = await sdk.api.getWeatherForecastLite(userId);
      if (!mounted.current) return;
      patch({
        weatherState: UiStates.fromResult(result, 'Could not load weather'),
      });
    },
    [patch, sdk],
  );

  const updateCultivatedCrops = useCallback(
    async (userId: string, cropIds: number[]) => {
      patch({ cropUpdateState: UiStates.loading() });
      const result = await sdk.api.updateCropDetails({
        user_id: userId,
        crop_details: cropIds.map((id) => ({ crop_id: id })),
      });
      if (!mounted.current) return;
      if (result.ok) {
        sdk.store.setJson(StorageKeys.CULTIVATED_CROPS, cropIds);
      }
      patch({
        cropUpdateState: UiStates.fromResult(result, 'Could not save your crops'),
      });
    },
    [patch, sdk],
  );

  const newConversation = useCallback(
    async (userId: string, contentProviderId?: number | null) => {
      patch({ newConversationState: UiStates.loading() });
      const result = await sdk.api.newConversation({
        user_id: userId,
        content_provider_id: contentProviderId ?? null,
      });
      if (!mounted.current) return;
      if (result.ok) {
        sdk.store.set(StorageKeys.NEW_CONVERSATION_ID, result.data.conversation_id);
      }
      patch({
        newConversationState: UiStates.fromResult(
          result,
          'Could not start a conversation',
        ),
      });
    },
    [patch, sdk],
  );

  const transcribeAudio = useCallback(
    async (
      conversationId: string,
      query: string,
      messageReferenceId: string,
      audioFormat: string,
      triggeredType: string,
    ) => {
      patch({ voiceTranscribeState: UiStates.loading() });
      const result = await sdk.api.transcribeAudio({
        conversation_id: conversationId,
        query,
        message_reference_id: messageReferenceId,
        input_audio_encoding_format: audioFormat,
        triggered_input_type: triggeredType,
        editable_transcription: 'True',
      });
      if (!mounted.current) return;
      if (result.ok && isTranscriptionAcceptable(result.data)) {
        sdk.analytics.track(AnalyticsEvents.TRANSCRIPTION_SUCCESS, {
          confidence: result.data.confidence_score ?? 0,
        });
        patch({ voiceTranscribeState: UiStates.success(result.data) });
      } else {
        sdk.analytics.track(AnalyticsEvents.TRANSCRIPTION_FAILED, {
          confidence: result.ok ? result.data.confidence_score ?? 0 : null,
        });
        patch({
          voiceTranscribeState: UiStates.error(
            result.ok
              ? sdk.labels.getLabel(
                  'transcription_failed',
                  "We couldn't hear that clearly. Please try again.",
                )
              : result.message ?? 'Transcription failed',
            result.ok ? null : result.code,
            !result.ok && (result.isNetworkError || result.isTimeout),
          ),
        });
      }
    },
    [patch, sdk],
  );

  const markImageViewed = useCallback(
    async (statementId: number, userId: string) => {
      const result = await sdk.api.markImageViewed({
        statement_id: statementId,
        user_id: userId,
        status: 'viewed',
      });
      if (!mounted.current) return;
      if (result.ok) {
        sdk.analytics.track(AnalyticsEvents.CARD_VIEWED, { statement_id: statementId });
      }
      patch({
        imageViewedState: UiStates.fromResult(result, 'Could not mark card viewed'),
      });
    },
    [patch, sdk],
  );

  const fetchImageStatement = useCallback(
    async (statementId: number, triggeredInputType: string) => {
      patch({ imageStatementState: UiStates.loading() });
      const result = await sdk.api.getImageStatement({
        statement_id: statementId,
        triggered_input_type: triggeredInputType,
      });
      if (!mounted.current) return;
      patch({
        imageStatementState: UiStates.fromResult(result, 'Could not open this card'),
      });
    },
    [patch, sdk],
  );

  const fetchUserProfile = useCallback(
    async (userId: string) => {
      const result = await sdk.api.viewUserProfile(userId);
      if (!mounted.current) return;
      if (result.ok) {
        const first = result.data.userProfile?.first_name ?? '';
        const last = result.data.userProfile?.last_name ?? '';
        const full = `${first} ${last}`.trim();
        if (full) sdk.store.set(StorageKeys.USER_NAME, full);
      }
    },
    [sdk],
  );

  const onAction = useCallback(
    (action: HomeAction) => {
      switch (action.type) {
        case 'LoadHome':
          void loadHome(
            action.userDeviceTime,
            action.userId ?? null,
            action.skipLoadingCheck ?? false,
          );
          break;
        case 'LoadWeather':
          void loadWeather(action.userId, action.skipLoadingCheck ?? false);
          break;
        case 'FetchUserProfile':
          void fetchUserProfile(action.userId);
          break;
        case 'UpdateCultivatedCrops':
          void updateCultivatedCrops(action.userId, action.cropIds);
          break;
        case 'NewConversation':
          void newConversation(action.userId, action.contentProviderId);
          break;
        case 'TranscribeAudio':
          void transcribeAudio(
            action.conversationId,
            action.query,
            action.messageReferenceId,
            action.audioFormat,
            action.triggeredType,
          );
          break;
        case 'MarkImageViewed':
          void markImageViewed(action.statementId, action.userId);
          break;
        case 'FetchImageStatement':
          void fetchImageStatement(action.statementId, action.triggeredInputType);
          break;
        case 'ClearTranscriptionState':
          patch({ voiceTranscribeState: UiStates.idle() });
          break;
        case 'ConsumeResult':
          patch({
            imageStatementState: UiStates.idle(),
            cropUpdateState: UiStates.idle(),
          });
          break;
        case 'SetLoadingState':
          patch({ homeFeedState: UiStates.loading() });
          break;
      }
    },
    [
      fetchImageStatement,
      fetchUserProfile,
      loadHome,
      loadWeather,
      markImageViewed,
      newConversation,
      patch,
      transcribeAudio,
      updateCultivatedCrops,
    ],
  );

  const dismissCard = useCallback(
    (sectionId: string) => {
      setState((prev) => {
        const next = new Set(prev.dismissedCardIds);
        next.add(sectionId);
        return { ...prev, dismissedCardIds: next };
      });
    },
    [sdk],
  );

  return { state, onAction, dismissCard };
}
