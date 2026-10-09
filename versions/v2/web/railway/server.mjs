/**
 * Production server for the hosted widget demo on Railway (deployed by GitHub → Railway, never
 * by hand; see the repo CLAUDE.md §8). Zero dependencies: Node's http module only.
 *
 *   /                      → 302 /demo/
 *   /demo/*                → widget/demo (index.html, mobile.html)
 *   /dist/*                → widget/dist (farmerchat-widget.iife.js + illustrations/)
 *   /stage/*, /stage-replay/*  → the stage proxy, the SAME handler the Vercel deploy used
 *                            (widget/vercel/api/stage.js), so there is one copy of the logic
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
  '/demo/': path.join(widget, 'demo'),
  '/dist/': path.join(widget, 'dist'),
};
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
    return Promise.resolve(stageHandler(req, res)).catch(() => {
      if (!res.headersSent) { res.writeHead(502, { 'content-type': 'text/plain' }); }
      res.end('Proxy error');
    });
  }
  if (p === '/guide' || p === '/guide/index.html') { res.writeHead(301, { location: '/guide/' }); return res.end(); }
  if (p === '/guide/') return sendFile(res, path.join(here, 'guide', 'index.html'), req.method === 'HEAD');
  if (p === '/' || p === '/demo') { res.writeHead(302, { location: '/demo/' + url.search }); return res.end(); }
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
