/**
 * Headless CHAT_ONLY bootstrap — port of Android `FarmerChatGraph.ensureChatOnlySession()` +
 * `ensureLabelsLoaded()`.
 *
 * CHAT_ONLY skips onboarding after the first launch, which is where guest init (#1) and the label fetch (#3) normally
 * run, so they run here instead, before the splash routes into the chat:
 *   1. guest init (#1) when there is no session, with the same coordinates onboarding would use
 *      (geolocate, else the device-locale fallback);
 *   2. labels (#3) for the stored / configured language (else `en`), matched against the
 *      supported-languages list (#2), then the preferred language (#4).
 * The conversation (#15) is created lazily by `useChat.ensureConversationId()` before the first
 * send, so it is not created eagerly here.
 *
 * Runs only when the splash goes straight to chat (LANGUAGE_DONE already set, or the host
 * configured the language); a first launch without either shows the language screen instead,
 * which does this work itself ({@link chatOnlyNeedsLanguage}).
 *
 * Everything is best-effort and idempotent: a failure leaves the chat to recover (the 401 path
 * re-inits a guest; labels fall back to English). `LANGUAGE_DONE` is deliberately NOT set, as on
 * Android, so a host that later switches to FULL_JOURNEY still sees the language screen.
 */

import type { SdkServices } from './services';
import { PrefKeys } from './storage';
import type { SessionStore } from './storage';
import type { SupportedLanguage } from './types';
import { isResolved, resolveCountryCode, resolveFallbackCoordinates } from './fallbackLocation';

/**
 * A CHAT_ONLY journey opening fresh is the app's "Home entry", and the app starts a NEW
 * conversation on every Home entry. Port of Android `FarmerChatGraph.beginChatOnlyJourney` (and
 * RN `FarmerChatSdk.beginChatOnlyJourney`): drop the stored conversation id unless the journey is
 * opening a specific history conversation (pending `chat` target), which keeps its own id. The
 * first send then creates a new conversation (`useChat.ensureConversationId`).
 *
 * Called once per journey start — the SDK splash — not per screen. The widget keeps its panel
 * mounted when closed, so reopening the panel is not a new journey; a page load / SDK boot is.
 */
/**
 * Whether the host configured the language itself (`languageCode`, or the forced `locale`). Then a
 * CHAT_ONLY first launch skips the language screen and the headless bootstrap uses that language.
 */
export function hostConfiguredLanguage(config: { languageCode?: string; locale?: string }): boolean {
  return !!(config.locale?.trim() || config.languageCode?.trim());
}

/**
 * CHAT_ONLY first launch (decided 2026-10-09): the farmer picks a language once on the existing
 * language onboarding screen, then lands in chat. Skipped once LANGUAGE_DONE is set, or when the
 * host configured the language.
 */
export function chatOnlyNeedsLanguage(
  store: SessionStore,
  config: { languageCode?: string; locale?: string },
): boolean {
  return !store.getBool(PrefKeys.LANGUAGE_DONE, false) && !hostConfiguredLanguage(config);
}

export function beginChatOnlyJourney(
  store: SessionStore,
  pending: { type: string } | null,
): void {
  if (pending?.type !== 'chat') store.remove(PrefKeys.NEW_CONVERSATION_ID);
}

export async function ensureChatOnlySession(services: SdkServices): Promise<void> {
  const { api, session, store, labels, config } = services;

  if (!session.hasSession) {
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      let accuracy: number | null = null;
      if (config.geoApiKey) {
        const geo = await api.geolocate();
        if (geo.ok && geo.data.location) {
          lat = geo.data.location.lat;
          lng = geo.data.location.lng;
          accuracy = geo.data.accuracy ?? null;
        }
      }
      if (lat === null || lng === null) {
        const fallback = resolveFallbackCoordinates(config);
        if (isResolved(fallback.lat, fallback.lng)) {
          lat = fallback.lat;
          lng = fallback.lng;
          accuracy = 0;
        }
      }
      await session.ensureGuestSession({ lat, long: lng, accuracy });
    } catch {
      // Best-effort: the chat's own calls recover a session on 401.
    }
  }

  if (labels.hasLabels()) return;
  try {
    const code = (
      store.getString(PrefKeys.SELECTED_LANGUAGE_CODE)?.trim() ||
      config.locale ||
      config.languageCode ||
      'en'
    )
      .trim()
      .toLowerCase();
    const country = resolveCountryCode(
      null,
      store.getString(PrefKeys.USER_COUNTRY_CODE),
      config.defaultCountryCode,
    );
    const regionState = store.getString(PrefKeys.USER_STATE)?.trim() || config.defaultStateCode;

    const groups = await api.getSupportedLanguages(country, regionState);
    if (!groups.ok) return;
    const all: SupportedLanguage[] = groups.data.flatMap((g) => [
      ...(g.priority_view ?? []),
      ...(g.expanded_view ?? []),
    ]);
    const match =
      all.find((l) => (l.code ?? '').toLowerCase() === code) ??
      all.find((l) => (l.code ?? '').toLowerCase() === 'en');
    if (!match) return;

    const res = await api.getLabels(match.id);
    if (res.ok) {
      labels.setLabels(res.data);
      if (match.code) labels.setLanguageCode(match.code);
      store.setInt(PrefKeys.SELECTED_LANGUAGE_ID, match.id);
      store.setBool(PrefKeys.STREAMING_REQUIRED, match.streaming_required ?? true);
      const displayName = match.display_name ?? match.name;
      if (displayName) store.setString(PrefKeys.SELECTED_LANGUAGE_DISPLAY_NAME, displayName);
    }

    const userId = session.userId?.trim();
    if (userId) {
      await api.setPreferredLanguage({ user_id: userId, language_id: match.id });
    }
  } catch {
    // Best-effort: labels fall back to the English strings.
  }
}
