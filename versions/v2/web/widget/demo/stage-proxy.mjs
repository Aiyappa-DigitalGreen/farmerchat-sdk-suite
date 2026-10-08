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
//
// Every agentic chat stream is logged event by event with its arrival time, so you can see what
// the server actually streamed (status / tool_call / text_delta / done / metadata).
//
//   REPLAY_SSE=docs/captures/agentic_stream_prose_20260903.sse node demo/stage-proxy.mjs
//
// REPLAY_SSE answers ONLY the agentic chat endpoint from a captured stream, paced like a real one
// (tool events dwell longer), while everything else still goes to the real backend. Use it to
// check the streaming UI (loader text, typing, pause hint) when the backend is not streaming.
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const UPSTREAM = new URL(process.env.UPSTREAM || 'https://farmerchat.farmstack.co/mobile-app-stage/');
const PORT = Number(process.env.PORT || 8898);
const GUEST_KEY = process.env.FC_GUEST_API_KEY || '';
const GUEST_PATHS = /\/(initialize_user|send_tokens)\/?$/;
const AGENTIC_PATH = /get_answer_for_text_query_agentic\/?$/;
const REPLAY = process.env.REPLAY_SSE ? fs.readFileSync(process.env.REPLAY_SSE, 'utf8') : null;

/** Splits a captured SSE file into its blank-line separated events. */
const sseEvents = (text) => text.split(/\r?\n\r?\n/).filter((e) => e.trim().length > 0);

function replay(req, res) {
  req.resume();
  res.writeHead(200, { ...cors(req), 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const events = sseEvents(REPLAY);
  let i = 0;
  const next = () => {
    if (i >= events.length) return res.end();
    const ev = events[i++];
    const name = (ev.match(/^event: *(\S+)/m) || [])[1] || '?';
    res.write(ev + '\n\n');
    console.log('  replay', name);
    // Long enough on tool events to read the loader label; deltas arrive like typing.
    setTimeout(next, /tool|status/.test(name) ? 1500 : name === 'text_delta' ? 350 : 200);
  };
  setTimeout(next, 800);
}

/** Logs each SSE event name of a live agentic stream with its arrival time. */
function logStream(up, started) {
  let buf = '';
  up.on('data', (c) => {
    buf += c;
    let m;
    while ((m = buf.match(/^event: *(\S+)/m))) {
      console.log(`  +${Date.now() - started}ms`, m[1]);
      buf = buf.slice(m.index + m[0].length);
    }
  });
}

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
    if (REPLAY && req.method === 'POST' && AGENTIC_PATH.test(target.pathname)) {
      console.log('REPLAY', target.pathname);
      replay(req, res);
      return;
    }
    const started = Date.now();
    const headers = { ...req.headers, host: target.host };
    delete headers.origin;
    delete headers.referer;
    if (GUEST_KEY && !headers['api-key'] && GUEST_PATHS.test(target.pathname)) headers['api-key'] = GUEST_KEY;

    const upstream = https.request(target, { method: req.method, headers }, (up) => {
      const out = { ...up.headers, ...cors(req) };
      delete out['access-control-allow-credentials'];
      res.writeHead(up.statusCode || 502, out);
      // Log status, and the start of the body for errors, so a failing flow is diagnosable.
      if ((up.statusCode || 0) >= 400) {
        let body = '';
        up.on('data', (c) => { if (body.length < 300) body += c; });
        up.on('end', () => console.log(up.statusCode, req.method, target.pathname, body.replace(/\s+/g, ' ').slice(0, 300)));
      } else {
        console.log(up.statusCode, req.method, target.pathname);
        if (AGENTIC_PATH.test(target.pathname)) logStream(up, started);
      }
      up.pipe(res);
    });
    upstream.on('error', (e) => {
      console.log('upstream error', target.pathname, e.code || e.message);
      // Mid-stream drop (e.g. a reset during an SSE answer): headers are already out, so just
      // cut the response — writing a 502 now would throw and kill the proxy.
      if (res.headersSent) return res.destroy();
      res.writeHead(502, cors(req));
      res.end(String(e));
    });
    // The browser gave up (tab closed, request aborted): stop the upstream call too.
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
  })
  .listen(PORT, () => console.log(`stage proxy → ${UPSTREAM.href} on http://localhost:${PORT}/`));
