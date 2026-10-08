/**
 * The answer-generation tips carousel content — port of android core
 * `labels/AnswerGenerationTips.kt` (itself the app's `ChatLoadingContent.answerGenerationTips()`).
 *
 * Server-driven, discovered by convention: any label pair
 * `fc_v2_app_label_tips_<name>_title_<lang>` + `fc_v2_app_label_tips_<name>_statement_<lang>`
 * becomes a tip, resolved in the farmer's language with an English fallback. A blank label counts
 * as missing. With no discoverable tip, the app's three built-in tips are used.
 */
import type { LabelManager } from './labels';

export interface TipData {
  title: string;
  body: string;
}

const PREFIX = 'fc_v2_app_label_tips_';
const TITLE_KEY = /^fc_v2_app_label_tips_(.+)_title_([a-z]{2,3})$/;

const FALLBACK_TIPS: Array<[string, string, string, string]> = [
  ['fc_v2_app_label_tips_did_you_know', 'Did you know?',
    'fc_v2_app_label_tips_you_can_ask_followup_questions_to_get_more_details', 'You can ask follow-up questions to get more details'],
  ['fc_v2_app_label_tips_quick_tip', 'Quick tip',
    'fc_v2_app_label_tips_ask_specific_crops', 'Try asking about specific crops or problems'],
  ['fc_v2_app_label_tips_try_this', 'Try this',
    'fc_v2_app_label_tips_upload_photos_for_plant_disease_identification', 'Upload photos for plant disease identification'],
];

export function answerGenerationTips(labels: LabelManager): TipData[] {
  const lang = labels.languageCode || 'en';
  const names = Array.from(
    new Set(
      labels
        .labelKeys()
        .map((k) => TITLE_KEY.exec(k)?.[1])
        .filter((n): n is string => !!n),
    ),
  ).sort();
  const pick = (base: string): string | null => {
    const v = labels.rawLabel(`${base}_${lang}`);
    if (v && v.trim()) return v;
    const en = labels.rawLabel(`${base}_en`);
    return en && en.trim() ? en : null;
  };
  const dynamic = names
    .map((name) => {
      const title = pick(`${PREFIX}${name}_title`);
      const body = pick(`${PREFIX}${name}_statement`);
      return title && body ? { title, body } : null;
    })
    .filter((t): t is TipData => t !== null);
  if (dynamic.length > 0) return dynamic;
  return FALLBACK_TIPS.map(([tk, td, sk, sd]) => ({ title: labels.getLabel(tk, td), body: labels.getLabel(sk, sd) }));
}
