/**
 * Assembles the hosted site for Vercel into versions/v2/vercel-out (gitignored), the static twin of
 * web/railway/server.mjs. Vercel builds it from GitHub (project root = versions/v2, see
 * ../vercel.json); never deploy by hand (repo CLAUDE.md §8). Run after `npm run build`.
 *
 *   /, /guide/      → railway/guide/index.html (the SDK integration guide)
 *   /showcase/      → railway/home/index.html
 *   /app/*          → demo-app/dist
 *   /demo/          → widget/demo index.html + mobile.html only
 *   /dist/*         → widget/dist: the iife script, its map, illustrations/
 *   /stage/*, /stage-replay/*, /healthz → ../api/ functions (rewrites in ../vercel.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../vercel-out');
const widget = path.join(here, 'widget');

fs.rmSync(out, { recursive: true, force: true });
const copy = (from, to) => {
  if (!fs.existsSync(from)) throw new Error(`missing ${from}: run npm run build first`);
  fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true });
  fs.cpSync(from, path.join(out, to), { recursive: true });
};

copy(path.join(here, 'railway/guide/index.html'), 'index.html');
copy(path.join(here, 'railway/guide/index.html'), 'guide/index.html');
copy(path.join(here, 'railway/home/index.html'), 'showcase/index.html');
copy(path.join(here, 'demo-app/dist'), 'app');
for (const f of ['index.html', 'mobile.html']) copy(path.join(widget, 'demo', f), `demo/${f}`);
copy(path.join(widget, 'dist/farmerchat-widget.iife.js'), 'dist/farmerchat-widget.iife.js');
if (fs.existsSync(path.join(widget, 'dist/farmerchat-widget.iife.js.map'))) {
  copy(path.join(widget, 'dist/farmerchat-widget.iife.js.map'), 'dist/farmerchat-widget.iife.js.map');
}
copy(path.join(widget, 'dist/illustrations'), 'dist/illustrations');
console.log('vercel site ready:', out);
