/**
 * Settings → Language Save (app SettingsViewModel.selectLanguage :149-156 / submitLanguage :207-300).
 * A row tap never touches labels (the hook only moves the radio); Save loads them.
 *
 *     node --import ./test/ts-extension-hook.mjs test/languageSave.test.ts
 */
import { saveLanguageSelection, type LanguageSaveDeps } from '../src/core/languageSave.ts';

let passed = 0;
const failures: string[] = [];
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}
    expected: ${b}
    actual:   ${a}`);
}
function fail(message: string) {
  return { ok: false as const, message, apiName: 'x', isTimeout: false, isNetworkError: false };
}
function fakeDeps(opts: { labelsOk: boolean; setOk: boolean }) {
  const log: string[] = [];
  const deps: LanguageSaveDeps = {
    userId: 'u-1',
    getLabels: async (id) => {
      log.push(`getLabels ${id}`);
      return opts.labelsOk ? { ok: true, data: { home_hi: 'होम' }, status: 200 } : fail('labels down');
    },
    setPreferredLanguage: async (body) => {
      log.push(`setPreferred ${body.user_id} ${body.language_id}`);
      return opts.setOk ? { ok: true, data: {}, status: 200 } : fail('Could not save');
    },
    labels: {
      setLabels: (m) => log.push(`setLabels ${Object.keys(m).join(',')}`),
      setLanguageCode: (c) => log.push(`setLanguageCode ${c}`),
    },
    store: {
      setInt: (k, v) => log.push(`setInt ${k}=${v}`),
      setBool: (k, v) => log.push(`setBool ${k}=${v}`),
      setString: (k, v) => log.push(`setString ${k}=${v}`),
    },
  };
  return { deps, log };
}
const hindi = { languageId: 2, languageCode: 'hi', displayName: 'हिंदी', streamingRequired: false };

const ok = fakeDeps({ labelsOk: true, setOk: true });
check('save ok', await saveLanguageSelection(ok.deps, hindi), { ok: true });
check('save: labels first, then the code', ok.log, [
  'getLabels 2',
  'setPreferred u-1 2',
  'setLabels home_hi',
  'setInt SELECTED_LANGUAGE_ID=2',
  'setBool is_streaming_required=false',
  'setLanguageCode hi',
  'setString SELECTED_LANGUAGE_DISPLAY_NAME=हिंदी',
]);

const refused = fakeDeps({ labelsOk: true, setOk: false });
check('set_preferred fails → error', await saveLanguageSelection(refused.deps, hindi), { ok: false, message: 'Could not save' });
// As the app: the fetched map is stored anyway; the language id/code/prefs stay the old ones.
check('set_preferred fails → labels stored, no prefs, no code', refused.log, ['getLabels 2', 'setPreferred u-1 2', 'setLabels home_hi']);

const noLabels = fakeDeps({ labelsOk: false, setOk: true });
check('labels fail, save ok', await saveLanguageSelection(noLabels.deps, hindi), { ok: true });
check('labels fail → old map kept, language saved', noLabels.log.includes('setLabels home_hi'), false);
check('labels fail → code still saved', noLabels.log.includes('setLanguageCode hi'), true);
if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} languageSave test(s) failed`);
}
console.log(`languageSave: ${passed} assertions passed`);
