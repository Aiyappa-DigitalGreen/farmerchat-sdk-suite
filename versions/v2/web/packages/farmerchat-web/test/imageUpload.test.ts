/**
 * Photo upload sizing / naming, pinned to the app's ImageUtils.kt:194-207, 262-285 and
 * ChatViewModel.kt:1866-1867.
 *
 *     node --import ./test/ts-extension-hook.mjs test/imageUpload.test.ts
 */
import { UPLOAD_JPEG_QUALITY, UPLOAD_MAX_DIMENSION, fitWithin, uploadImageName } from '../src/core/imageUpload.ts';

let passed = 0;
const failures: string[] = [];
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}

check('box is 1000', UPLOAD_MAX_DIMENSION, 1000);
check('quality is 80', UPLOAD_JPEG_QUALITY, 0.8);
check('small image untouched', fitWithin(640, 480), { width: 640, height: 480 });
check('exactly 1000 untouched', fitWithin(1000, 1000), { width: 1000, height: 1000 });
check('never scales up', fitWithin(10, 10), { width: 10, height: 10 });
check('landscape 4000x3000', fitWithin(4000, 3000), { width: 1000, height: 750 });
check('portrait 3024x4032', fitWithin(3024, 4032), { width: 750, height: 1000 });
check('truncates like Kotlin toInt()', fitWithin(3001, 1999), { width: 1000, height: 666 });
check('one side over', fitWithin(1200, 900), { width: 1000, height: 750 });
check('image_name shape', uploadImageName('3f2a'), 'image_3f2a.jpg');

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} imageUpload test(s) failed`);
}
console.log(`imageUpload: ${passed} assertions passed`);
