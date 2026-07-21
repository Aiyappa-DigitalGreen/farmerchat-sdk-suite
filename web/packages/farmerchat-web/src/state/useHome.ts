/**
 * HomeViewModel port — home/udf HomeAction / HomeState (docs/01 §3.7).
 */

import { useCallback, useRef, useState } from 'react';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import type {
  CropResponse,
  GetVoiceResponse,
  HomeUdfResponse,
  ImageStatementResponse,
  ImageViewedResponse,
  NewConversationResponse,
  WeatherResponse,
} from '../core/types';
import { UiState, idle, loading, success } from './uiState';
import { toUiState, userDeviceTime } from './helpers';
import { Events } from '../core/analytics';

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

const initialState: HomeState = {
  homeFeedState: idle(),
  weatherState: idle(),
  cropUpdateState: idle(),
  newConversationState: idle(),
  voiceTranscribeState: idle(),
  imageViewedState: idle(),
  imageStatementState: idle(),
  dismissedCardIds: new Set<string>(),
};

export interface HomeActions {
  loadHome: (skipLoadingCheck?: boolean) => Promise<void>;
  loadWeather: (skipLoadingCheck?: boolean) => Promise<void>;
  newConversation: (contentProviderId?: number | string | null) => Promise<string | null>;
  updateCultivatedCrops: (cropIds: Array<number | string>) => Promise<void>;
  transcribeAudio: (base64Audio: string, audioFormat: string, triggeredType: string) => Promise<GetVoiceResponse | null>;
  markImageViewed: (statementId: number) => Promise<void>;
  fetchImageStatement: (statementId: number, triggeredInputType: string) => Promise<ImageStatementResponse | null>;
  dismissCard: (sectionId: string) => void;
  clearTranscriptionState: () => void;
  consumeResult: () => void;
}

export function useHome(services: SdkServices): [HomeState, HomeActions] {
  const [state, setState] = useState<HomeState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const { api, session, store, analytics } = services;

  const patch = useCallback((p: Partial<HomeState>) => setState((s) => ({ ...s, ...p })), []);

  const loadHome = useCallback(
    async (skipLoadingCheck = false) => {
      if (!skipLoadingCheck && stateRef.current.homeFeedState.status === 'loading') return;
      patch({ homeFeedState: loading() });
      // Guests pass userId=null (docs/01 §3.7 lifecycle).
      const userId = session.isAuthenticated() ? session.userId : null;
      const res = await api.getDailyFeed(userDeviceTime(), userId);
      if (res.ok) {
        const data: HomeUdfResponse = res.data ?? { greeting: null, sections: [], ssfr_enable: false };
        store.setJson(PrefKeys.CACHED_HOME_FEED_RESPONSE, data);
        patch({ homeFeedState: success(data) });
        analytics.track(Events.DASHBOARD_VIEWED, { section_count: data.sections?.length ?? 0 });
      } else {
        patch({ homeFeedState: toUiState(res) });
      }
    },
    [analytics, api, patch, session, store],
  );

  const loadWeather = useCallback(
    async (skipLoadingCheck = false) => {
      if (!skipLoadingCheck && stateRef.current.weatherState.status === 'loading') return;
      patch({ weatherState: loading() });
      const res = await api.getWeather(session.userId ?? '');
      patch({ weatherState: toUiState(res) });
    },
    [api, patch, session],
  );

  const newConversation = useCallback(
    async (contentProviderId?: number | string | null): Promise<string | null> => {
      patch({ newConversationState: loading() });
      const res = await api.newConversation({
        user_id: session.userId ?? '',
        content_provider_id: contentProviderId ?? null,
      });
      patch({ newConversationState: toUiState(res) });
      if (res.ok && res.data.conversation_id) {
        store.setString(PrefKeys.NEW_CONVERSATION_ID, res.data.conversation_id);
        return res.data.conversation_id;
      }
      return null;
    },
    [api, patch, session, store],
  );

  const updateCultivatedCrops = useCallback(
    async (cropIds: Array<number | string>) => {
      patch({ cropUpdateState: loading() });
      const res = await api.updateCropDetails({
        user_id: session.userId ?? '',
        crop_details: cropIds.map((id) => ({ crop_id: id })),
      });
      patch({ cropUpdateState: toUiState(res) });
    },
    [api, patch, session],
  );

  const transcribeAudio = useCallback(
    async (base64Audio: string, audioFormat: string, triggeredType: string): Promise<GetVoiceResponse | null> => {
      patch({ voiceTranscribeState: loading() });
      const conversationId = store.getString(PrefKeys.NEW_CONVERSATION_ID) ?? '';
      const res = await api.transcribeAudio({
        conversation_id: conversationId,
        query: base64Audio,
        message_reference_id: `web_${Date.now()}`,
        input_audio_encoding_format: audioFormat,
        triggered_input_type: triggeredType,
        editable_transcription: 'True',
      });
      patch({ voiceTranscribeState: toUiState(res) });
      if (res.ok) {
        const accepted =
          !res.data.error &&
          (res.data.confidence_score ?? 0) > 0.7 &&
          (res.data.heard_input_query ?? '').trim().length > 0;
        analytics.track(accepted ? Events.TRANSCRIPTION_SUCCESS : Events.TRANSCRIPTION_FAILED, {
          confidence_score: res.data.confidence_score ?? 0,
        });
        return accepted ? res.data : null;
      }
      analytics.track(Events.TRANSCRIPTION_FAILED, { error: res.message });
      return null;
    },
    [analytics, api, patch, store],
  );

  const markImageViewed = useCallback(
    async (statementId: number) => {
      const res = await api.markImageViewed({ statement_id: statementId, user_id: session.userId ?? '', status: 'viewed' });
      patch({ imageViewedState: toUiState(res) });
    },
    [api, patch, session],
  );

  const fetchImageStatement = useCallback(
    async (statementId: number, triggeredInputType: string): Promise<ImageStatementResponse | null> => {
      patch({ imageStatementState: loading() });
      const res = await api.getImageStatement({ statement_id: statementId, triggered_input_type: triggeredInputType });
      patch({ imageStatementState: toUiState(res) });
      return res.ok ? res.data : null;
    },
    [api, patch],
  );

  const dismissCard = useCallback((sectionId: string) => {
    setState((s) => {
      const next = new Set(s.dismissedCardIds);
      next.add(sectionId);
      return { ...s, dismissedCardIds: next };
    });
  }, []);

  const clearTranscriptionState = useCallback(() => {
    patch({ voiceTranscribeState: idle() });
  }, [patch]);

  const consumeResult = useCallback(() => {
    patch({ cropUpdateState: idle(), imageStatementState: idle(), imageViewedState: idle() });
  }, [patch]);

  return [
    state,
    {
      loadHome,
      loadWeather,
      newConversation,
      updateCultivatedCrops,
      transcribeAudio,
      markImageViewed,
      fetchImageStatement,
      dismissCard,
      clearTranscriptionState,
      consumeResult,
    },
  ];
}
