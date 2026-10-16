/**
 * LabelManager — server-driven i18n (endpoint #3).
 * Resolution order (docs/02 §Server-driven labels):
 *   `${baseKey}_${langCode}` → `${baseKey}_en` → englishFallback → raw key.
 * Supports `{name}` and `{{name}}` template substitution.
 */
import { SessionStore, StorageKeys } from './sessionStore';

export type LabelParams = Record<string, string | number>;

type Listener = () => void;

export interface LabelManagerOptions {
  /** Host label overrides (C5) — highest precedence, keyed by base label key. */
  overrides?: Record<string, string>;
  /** Forced locale (C5) — overrides the stored/device language for resolution. */
  forcedLocale?: string | null;
}

export class LabelManager {
  private labels: Record<string, string> = {};
  private listeners = new Set<Listener>();
  private readonly overrides: Record<string, string>;
  private readonly forcedLocale: string | null;

  constructor(
    private readonly store: SessionStore,
    options: LabelManagerOptions = {},
  ) {
    this.overrides = options.overrides ?? {};
    this.forcedLocale = options.forcedLocale ?? null;
  }

  /** Load labels persisted from a previous session. */
  restoreFromStore(): void {
    const cached = this.store.getJson<Record<string, string>>(
      StorageKeys.LANGUAGE_LABELS_JSON,
    );
    if (cached) {
      this.labels = cached;
      this.emit();
    }
  }

  /** Replace the label map (after endpoint #3 succeeds) and persist it. */
  setLabels(labels: Record<string, string>): void {
    this.labels = labels;
    this.store.setJson(StorageKeys.LANGUAGE_LABELS_JSON, labels);
    this.store.set(StorageKeys.LANGUAGE_LABELS_LOADED, true);
    this.emit();
  }

  get isLoaded(): boolean {
    return Object.keys(this.labels).length > 0;
  }

  private get languageCode(): string {
    // Forced locale (C5) wins over the stored/onboarding language.
    const code = this.forcedLocale ?? this.store.getString(StorageKeys.SELECTED_LANGUAGE_CODE) ?? 'en';
    // App parity (LabelManager.kt): normalize before building `${key}_${lang}`.
    const normalized = code.trim().toLowerCase();
    return normalized === '' ? 'en' : normalized;
  }

  /** Teardown (`FarmerChat.shutdown` / re-initialize): drop every subscriber. */
  dispose(): void {
    this.listeners.clear();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const l of Array.from(this.listeners)) l();
  }

  /**
   * The answer-generation tip cards — port of the Android core `AnswerGenerationTips.discover`
   * (itself the app's `ChatLoadingContent.kt answerGenerationTips()`). Any served label pair
   * `fc_v2_app_label_tips_<name>_title_<lang>` / `..._<name>_statement_<lang>` is a tip, resolved
   * in the farmer's language with an English fallback, name-sorted. With none discovered, the
   * app's three built-in tips. Never empty.
   */
  answerGenerationTips(): { title: string; body: string }[] {
    const prefix = 'fc_v2_app_label_tips_';
    const titleKey = /^fc_v2_app_label_tips_(.+)_title_([a-z]{2,3})$/;
    const lang = this.languageCode || 'en';
    const names = Array.from(
      new Set(
        Object.keys(this.labels)
          .map((k) => titleKey.exec(k)?.[1])
          .filter((n): n is string => !!n),
      ),
    ).sort();
    const pick = (base: string): string | null => {
      const v = this.labels[`${base}_${lang}`];
      if (v && v.trim()) return v;
      const en = this.labels[`${base}_en`];
      return en && en.trim() ? en : null;
    };
    const dynamic: { title: string; body: string }[] = [];
    for (const name of names) {
      const title = pick(`${prefix}${name}_title`);
      const body = pick(`${prefix}${name}_statement`);
      if (title && body) dynamic.push({ title, body });
    }
    if (dynamic.length > 0) return dynamic;
    return [
      ['fc_v2_app_label_tips_did_you_know', 'Did you know?',
        'fc_v2_app_label_tips_you_can_ask_followup_questions_to_get_more_details',
        'You can ask follow-up questions to get more details'],
      ['fc_v2_app_label_tips_quick_tip', 'Quick tip',
        'fc_v2_app_label_tips_ask_specific_crops', 'Try asking about specific crops or problems'],
      ['fc_v2_app_label_tips_try_this', 'Try this',
        'fc_v2_app_label_tips_upload_photos_for_plant_disease_identification',
        'Upload photos for plant disease identification'],
    ].map(([tk, td, bk, bd]) => ({ title: this.getLabel(tk, td), body: this.getLabel(bk, bd) }));
  }

  getLabel(baseKey: string, englishFallback: string, params?: LabelParams): string {
    const lang = this.languageCode;
    // Resolution order (C5): host override → server ${key}_${lang} →
    // server ${key}_en → built-in English → raw key.
    const resolved =
      this.overrides[baseKey] ??
      this.labels[`${baseKey}_${lang}`] ??
      this.labels[`${baseKey}_en`] ??
      this.labels[baseKey] ??
      englishFallback ??
      baseKey;
    return params ? applyTemplate(resolved, params) : resolved;
  }
}

/** `{name}` / `{{name}}` substitution. Double-brace form replaced first. */
export function applyTemplate(text: string, params: LabelParams): string {
  let out = text;
  for (const [key, value] of Object.entries(params)) {
    out = out
      .split(`{{${key}}}`)
      .join(String(value))
      .split(`{${key}}`)
      .join(String(value));
  }
  return out;
}
