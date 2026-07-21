/**
 * Server-driven i18n labels (endpoint #3), matching the app's LabelManager:
 * resolve `${baseKey}_${langCode}` → `${baseKey}_en` → englishFallback → raw key,
 * with `{name}` / `{{name}}` template substitution
 * (docs/02 "Server-driven labels").
 */

import { SessionStore, PrefKeys } from './storage';

export type LabelParams = Record<string, string | number>;

export interface LabelManagerOptions {
  /** C5 — highest-precedence host overrides, keyed by label base key. */
  stringOverrides?: Record<string, string>;
  /** C5 — force a language code regardless of device/onboarding. */
  forcedLocale?: string;
}

export class LabelManager {
  private labels: Record<string, string> = {};
  private langCode = 'en';
  private listeners = new Set<() => void>();
  private stringOverrides: Record<string, string>;
  private forcedLocale?: string;

  constructor(private store: SessionStore, options: LabelManagerOptions = {}) {
    const saved = store.getJson<Record<string, string>>(PrefKeys.LANGUAGE_LABELS);
    if (saved) this.labels = saved;
    const code = store.getString(PrefKeys.SELECTED_LANGUAGE_CODE);
    if (code) this.langCode = code;
    this.stringOverrides = options.stringOverrides ?? {};
    this.forcedLocale = options.forcedLocale;
    // A forced locale wins over any stored/device language.
    if (this.forcedLocale) this.langCode = this.forcedLocale;
  }

  get languageCode(): string {
    return this.langCode;
  }

  setLanguageCode(code: string): void {
    // A forced locale (C5) is never overridden by onboarding language selection.
    if (this.forcedLocale) return;
    this.langCode = code;
    this.store.setString(PrefKeys.SELECTED_LANGUAGE_CODE, code);
    this.emit();
  }

  setLabels(labels: Record<string, string>): void {
    this.labels = labels;
    this.store.setJson(PrefKeys.LANGUAGE_LABELS, labels);
    this.store.setBool(PrefKeys.LANGUAGE_LABELS_LOADED, true);
    this.emit();
  }

  hasLabels(): boolean {
    return Object.keys(this.labels).length > 0;
  }

  /**
   * Resolution order (docs/07 C5):
   * host override → `${baseKey}_${lang}` → `${baseKey}_en` → englishFallback → baseKey.
   */
  getLabel(baseKey: string, englishFallback: string, params?: LabelParams): string {
    const override = this.stringOverrides[baseKey];
    const localized = this.labels[`${baseKey}_${this.langCode}`];
    const english = this.labels[`${baseKey}_en`];
    const raw = override ?? localized ?? english ?? englishFallback ?? baseKey;
    return params ? applyTemplate(raw, params) : raw;
  }

  /** Subscribe to label/language changes (React hooks re-render on this). */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch {
        // never break on listener errors
      }
    }
  }
}

/** Supports both `{name}` and `{{name}}` placeholder styles. */
export function applyTemplate(template: string, params: LabelParams): string {
  let out = template;
  for (const [key, value] of Object.entries(params)) {
    out = out.split(`{{${key}}}`).join(String(value));
    out = out.split(`{${key}}`).join(String(value));
  }
  return out;
}
