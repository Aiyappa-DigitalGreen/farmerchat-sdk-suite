// Assembles the Vercel site for the widget demo into ./.site (gitignored):
//   /demo/*  the demo pages, /dist/*  the built widget, /api/stage.js  the stage proxy.
// Run `npm run build` in versions/v2/web/widget first. Deploy:
//   node vercel/prepare.mjs && npx vercel --cwd <abs>/versions/v2/web/widget/vercel/.site --prod --yes
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const widget = path.resolve(here, '..');
const site = path.join(here, '.site');
// Clear the previous build but keep .vercel (the link to the farmerchat-widget project);
// wiping it makes the next deploy create a brand-new project.
if (fs.existsSync(site)) for (const f of fs.readdirSync(site)) if (f !== '.vercel') fs.rmSync(path.join(site, f), { recursive: true, force: true });
fs.mkdirSync(path.join(site, 'demo'), { recursive: true });
fs.mkdirSync(path.join(site, 'dist'), { recursive: true });
fs.mkdirSync(path.join(site, 'api'), { recursive: true });
for (const f of fs.readdirSync(path.join(widget, 'demo'))) {
  if (f === 'index.html' || f === 'mobile.html') fs.copyFileSync(path.join(widget, 'demo', f), path.join(site, 'demo', f));
}
for (const f of ['farmerchat-widget.iife.js', 'farmerchat-widget.iife.js.map']) {
  const src = path.join(widget, 'dist', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(site, 'dist', f));
}
// The widget loads its full-screen farmer illustrations from illustrations/ beside the script.
if (fs.existsSync(path.join(widget, 'dist', 'illustrations'))) {
  fs.cpSync(path.join(widget, 'dist', 'illustrations'), path.join(site, 'dist', 'illustrations'), { recursive: true });
}
if (!fs.existsSync(path.join(site, 'dist', 'farmerchat-widget.iife.js'))) throw new Error('Run npm run build first');
for (const f of ['stage.js', '_replay.js']) fs.copyFileSync(path.join(here, 'api', f), path.join(site, 'api', f));
fs.copyFileSync(path.join(here, 'vercel.json'), path.join(site, 'vercel.json'));
fs.writeFileSync(path.join(site, 'package.json'), JSON.stringify({ name: 'farmerchat-widget-demo', private: true, type: 'module' }, null, 2));
console.log('site ready:', site);
