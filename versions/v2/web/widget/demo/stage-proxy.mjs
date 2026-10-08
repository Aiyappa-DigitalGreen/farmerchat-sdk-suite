// Local CORS proxy for testing the widget against a REAL FarmerChat backend from a browser.
//
// The backend's CORS preflight allows only a fixed header list, which excludes the SDK's
// Build-Version / Device-Info / X-Request-ID / X-Timeout / API-Key headers, so a browser
// cannot call it directly. This forwards everything verbatim (SSE streams included) and
// answers preflight itself. Dev/test only: never deploy it.
//
//   FC_GUEST_API_KEY=<key> node demo/stage-proxy.mjs          # → http://localhost:8898/
//   UPSTREAM=https://…/ node demo/stage-proxy.mjs              # another backend
//
// FC_GUEST_API_KEY, when set, is added as `API-Key` on guest calls (initialize_user,
// send_tokens) that arrive without one, so no key is ever written into a page.
import http from 'node:http';
import https from 'node:https';

const UPSTREAM = new URL(process.env.UPSTREAM || 'https://farmerchat.farmstack.co/mobile-app-stage/');
const PORT = Number(process.env.PORT || 8898);
const GUEST_KEY = process.env.FC_GUEST_API_KEY || '';
const GUEST_PATHS = /\/(initialize_user|send_tokens)\/?$/;

const cors = (req) => ({
  'access-control-allow-origin': req.headers.origin || '*',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': req.headers['access-control-request-headers'] || '*',
  'access-control-expose-headers': '*',
  'access-control-max-age': '600',
});

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors(req));
      res.end();
      return;
    }
    const target = new URL(req.url.replace(/^\//, ''), UPSTREAM);
    const headers = { ...req.headers, host: target.host };
    delete headers.origin;
    delete headers.referer;
    if (GUEST_KEY && !headers['api-key'] && GUEST_PATHS.test(target.pathname)) headers['api-key'] = GUEST_KEY;

    const upstream = https.request(target, { method: req.method, headers }, (up) => {
      const out = { ...up.headers, ...cors(req) };
      delete out['access-control-allow-credentials'];
      res.writeHead(up.statusCode || 502, out);
      up.pipe(res);
    });
    upstream.on('error', (e) => {
      res.writeHead(502, cors(req));
      res.end(String(e));
    });
    req.pipe(upstream);
    console.log(req.method, target.pathname);
  })
  .listen(PORT, () => console.log(`stage proxy → ${UPSTREAM.href} on http://localhost:${PORT}/`));
