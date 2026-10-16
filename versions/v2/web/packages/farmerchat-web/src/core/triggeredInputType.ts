/**
 * `triggered_input_type` values the app sends on #27 / #27a, kept React-free so the Node test
 * runner can pin them (`test/triggeredInputType.test.ts`).
 *
 * Every chat send and the app line it mirrors (fc-compose-agentic `ui/chat/`):
 * - typed composer question → "text"      ChatScreen.kt:1779-1811 → ChatViewModel.kt:993-997
 * - tapped follow-up chip   → "follow_up" ChatScreen.kt:959-971   → ChatViewModel.kt:993-997
 * - transcribed voice       → "voice"     ChatViewModel.kt:993-997, :1394
 * - host openChat(question) → "text"      ChatViewModel.kt:235-243 (no override) → :1391-1395
 * - read full advice        → "read_full_advice"  ChatScreen.kt:1538
 * - alignment chip / decline / location re-send → "align_chip_sel"  ChatViewModel.kt:1052, :1118
 */

/** Port of the app's `followUpTriggeredType` (ChatViewModel.kt:993-997). */
export function followUpTriggeredType(opts: { transcriptionId?: string | null; isFollowupPrompt?: boolean }): string {
  if (opts.transcriptionId != null) return 'voice';
  if (opts.isFollowupPrompt === true) return 'follow_up';
  return 'text';
}

/**
 * `triggered_input_type` of the question a chat is OPENED with (host `openChat(question)`, a Home
 * card, a weather CTA, …). Port of the override `when` in the app's `InitializeWithQuestion`
 * handler (ChatViewModel.kt:235-243) falling back to the input type (ChatViewModel.kt:1391-1395).
 * The app's first two branches (`isPush` → "push", `isInApp` → "in-app") come from MoEngage /
 * Plotline campaigns, which the SDK does not carry.
 */
export function initialQueryTriggeredType(opts: {
  isWeatherAdviceCTA?: boolean;
  isSSFR?: boolean;
  channel?: string | null;
  contentCardTriggerType?: string | null;
  transcriptionId?: string | null;
}): string {
  if (opts.isWeatherAdviceCTA) return 'weather';
  if (opts.isSSFR) return 'ssfr';
  if (opts.channel && opts.channel.trim().length > 0) return opts.channel;
  if (opts.contentCardTriggerType && opts.contentCardTriggerType.trim().length > 0) return opts.contentCardTriggerType;
  return opts.transcriptionId != null ? 'voice' : 'text';
}
