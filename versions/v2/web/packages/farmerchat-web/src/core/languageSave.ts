/**
 * Settings → Language "Save" (app SettingsViewModel.submitLanguage, :207-300). Kept out of the
 * hook so the tap/Save split is unit-testable: a row tap changes nothing but the radio
 * (selectLanguage :149-156, "Labels API and prefs are only updated on Save"); Save fetches the
 * labels (:213-214) alongside set_preferred_language and only then switches the language.
 */
import type { ApiResult } from './http';
import { PrefKeys } from './storage';

export interface LanguageSelection {
  languageId: number;
  languageCode: string | null;
  displayName: string | null;
  streamingRequired: boolean;
}

export interface LanguageSaveDeps {
  userId: string;
  getLabels(languageId: number): Promise<ApiResult<Record<string, string>>>;
  setPreferredLanguage(body: { user_id: string; language_id: number }): Promise<ApiResult<unknown>>;
  labels: { setLabels(map: Record<string, string>): void; setLanguageCode(code: string): void };
  store: {
    setInt(key: string, value: number): void;
    setBool(key: string, value: boolean): void;
    setString(key: string, value: string): void;
  };
}

export type LanguageSaveResult = { ok: true } | { ok: false; message: string };

export async function saveLanguageSelection(
  deps: LanguageSaveDeps,
  sel: LanguageSelection,
): Promise<LanguageSaveResult> {
  const [labelsRes, res] = await Promise.all([
    deps.getLabels(sel.languageId),
    deps.setPreferredLanguage({ user_id: deps.userId, language_id: sel.languageId }),
  ]);
  // App fetchLanguageLabelsForId (:162-190) runs independently of set_preferred_language and
  // stores the map whenever IT succeeds — even if the save itself then fails. Applied before the
  // code so the first render in the new language already has its map. A failed labels call keeps
  // the old map (the app only clears its fetching flags).
  if (labelsRes.ok) deps.labels.setLabels(labelsRes.data);
  if (!res.ok) return { ok: false, message: res.message };
  deps.store.setInt(PrefKeys.SELECTED_LANGUAGE_ID, sel.languageId);
  deps.store.setBool(PrefKeys.STREAMING_REQUIRED, sel.streamingRequired);
  if (sel.languageCode) deps.labels.setLanguageCode(sel.languageCode);
  // The drawer's "Language: X" line reads the saved display name.
  if (sel.displayName) deps.store.setString(PrefKeys.SELECTED_LANGUAGE_DISPLAY_NAME, sel.displayName);
  return { ok: true };
}
