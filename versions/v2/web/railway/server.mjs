/**
 * Production server for the hosted widget demo on Railway (deployed by GitHub → Railway, never
 * by hand; see the repo CLAUDE.md §8). Zero dependencies: Node's http module only.
 *
 *   /                      → the showcase landing page (railway/home/index.html)
 *   /app/*                 → demo-app/dist: the web SDK as a full-page app (npm + React host)
 *   /demo/*                → widget/demo (index.html, mobile.html): the one-script-tag widget
 *   /dist/*                → widget/dist (farmerchat-widget.iife.js + illustrations/)
 *   /stage/*, /stage-replay/*  → the stage proxy, the SAME handler the Vercel deploy used
 *                            (widget/vercel/api/stage.js), so there is one copy of the logic.
 *                            The OTP endpoints are refused here: this proxy is public, and it must
 *                            not become a way to send login codes to arbitrary phone numbers.
 *   /guide/                → the SDK integration guide (railway/guide/index.html)
 *   /healthz               → 200 "ok"
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import stageHandler from '../widget/vercel/api/stage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const widget = path.resolve(here, '../widget');
const ROOTS = {
  '/app/': path.resolve(here, '../demo-app/dist'),
  '/demo/': path.join(widget, 'demo'),
  '/dist/': path.join(widget, 'dist'),
};
// generate_otp, verify_otp, verify_otp_less_android_sdk_token (docs/02 #17, #19, #21).
const OTP_PATHS = /\/api\/user\/(generate_otp|verify_otp)/;
const SERVED_DEMO = new Set(['index.html', 'mobile.html']);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json', '.json': 'application/json', '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

function sendFile(res, file, head) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'content-length': st.size,
      // The widget script and its illustrations are embedded by other sites.
      'access-control-allow-origin': '*',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    });
    if (head) return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  if (p === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (p.startsWith('/stage/') || p.startsWith('/stage-replay/')) {
    if (OTP_PATHS.test(p)) { res.writeHead(403, { 'content-type': 'text/plain' }); return res.end('Phone login is disabled on this demo'); }
    return Promise.resolve(stageHandler(req, res)).catch(() => {
      if (!res.headersSent) { res.writeHead(502, { 'content-type': 'text/plain' }); }
      res.end('Proxy error');
    });
  }
  if (p === '/guide' || p === '/guide/index.html') { res.writeHead(301, { location: '/guide/' }); return res.end(); }
  if (p === '/guide/') return sendFile(res, path.join(here, 'guide', 'index.html'), req.method === 'HEAD');
  if (p === '/' || p === '/index.html') return sendFile(res, path.join(here, 'home', 'index.html'), req.method === 'HEAD');
  if (p === '/demo' || p === '/app') { res.writeHead(301, { location: p + '/' + url.search }); return res.end(); }
  for (const [prefix, root] of Object.entries(ROOTS)) {
    if (!p.startsWith(prefix)) continue;
    let rel = p.slice(prefix.length) || 'index.html';
    if (prefix === '/demo/' && !SERVED_DEMO.has(rel)) break; // only the two public demo pages
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep)) break; // path traversal guard
    return sendFile(res, file, req.method === 'HEAD');
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
});

const port = Number(process.env.PORT || 8080);
server.listen(port, '0.0.0.0', () => console.log(`farmerchat widget demo on :${port}`));
