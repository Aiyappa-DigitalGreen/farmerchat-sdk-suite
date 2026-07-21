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
    return (
      this.forcedLocale ??
      this.store.getString(StorageKeys.SELECTED_LANGUAGE_CODE) ??
      'en'
    );
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
