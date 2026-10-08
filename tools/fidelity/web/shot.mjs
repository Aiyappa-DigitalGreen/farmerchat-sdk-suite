// node shot.mjs <name> [--fresh] [--js "<code run before capture>"] [--wait ms]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const args = process.argv.slice(2);
const name = args[0];
const fresh = args.includes('--fresh');
const js = args.includes('--js') ? args[args.indexOf('--js') + 1] : null;
const wait = args.includes('--wait') ? Number(args[args.indexOf('--wait') + 1]) : 6000;
const url = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:5182/demo/fidelity.html';
const dir = new URL('.', import.meta.url).pathname;
if (fresh) fs.rmSync(dir + 'chrome-profile', { recursive: true, force: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true, userDataDir: dir + 'chrome-profile',
  args: ['--lang=en-IN', '--hide-scrollbars', '--font-render-hinting=none'],
});
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
await page.setViewport({ width: 411, height: 914, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(url, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 2500));
if (js) { await page.evaluate(js); }
await new Promise((r) => setTimeout(r, wait));
fs.mkdirSync(dir + 'web', { recursive: true });
await page.screenshot({ path: `${dir}web/${name}.png` });
const rows = await page.evaluate(() => {
  const out = [];
  const s = 2.625;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode.textContent.trim();
    const el = walker.currentNode.parentElement;
    if (!t || seen.has(el) || el.closest('script,style')) continue;
    seen.add(el);
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(el);
    out.push(`text="${t.slice(0, 60)}" @[${Math.round(r.left * s)},${Math.round(r.top * s)}][${Math.round(r.right * s)},${Math.round(r.bottom * s)}] ${cs.fontSize} ${cs.fontWeight} ${cs.color}`);
  }
  return out;
});
fs.writeFileSync(`${dir}web/${name}.txt`, rows.join('\n') + '\n');
console.log(rows.join('\n'));
await browser.close();
