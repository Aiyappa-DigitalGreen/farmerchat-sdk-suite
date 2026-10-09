/**
 * Hosted twin of demo/stage-proxy.mjs for the Vercel demo: the browser cannot call the stage
 * backend directly (its CORS preflight rejects Build-Version / Device-Info / X-Request-ID /
 * API-Key), and the guest key must never ship in a page. vercel.json rewrites /stage/<path> here.
 *
 * - Forwards ONLY to the fixed stage host; the path is checked so it cannot escape it.
 * - Adds API-Key from the FC_GUEST_API_KEY env var on the two guest endpoints only.
 * - Streams the response through (the agentic endpoint is text/event-stream).
 */
const UPSTREAM = 'https://farmerchat.farmstack.co/mobile-app-stage/';
const GUEST_PATHS = /\/(initialize_user|send_tokens)\/?$/;
const HOP = new Set(['host', 'connection', 'content-length', 'origin', 'referer', 'accept-encoding',
  'transfer-encoding', 'keep-alive', 'upgrade', 'x-forwarded-for', 'x-forwarded-host',
  'x-forwarded-proto', 'x-real-ip', 'forwarded']);

function cors(req) {
  return {
    'access-control-allow-origin': req.headers.origin || '*',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': req.headers['access-control-request-headers'] || '*',
    'access-control-expose-headers': '*',
    'access-control-max-age': '600',
  };
}

/** The upstream path: from the original URL when Vercel keeps it, else the rewrite's ?p=. */
function upstreamPath(req) {
  const url = new URL(req.url, 'http://x');
  let path;
  if (url.pathname.startsWith('/stage/')) path = url.pathname.slice('/stage/'.length);
  else {
    path = url.searchParams.get('p') || '';
    // Every FarmerChat endpoint ends in '/', and a rewrite capture can drop it.
    if (path && !path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) path += '/';
  }
  url.searchParams.delete('p');
  if (path.includes('..') || path.startsWith('/') || /^[a-z]+:/i.test(path)) return null;
  const target = new URL(path, UPSTREAM);
  url.searchParams.forEach((v, k) => target.searchParams.append(k, v));
  return target.href.startsWith(UPSTREAM) ? target : null;
}

async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors(req));
    return res.end();
  }
  const target = upstreamPath(req);
  if (!target) {
    res.writeHead(400, { ...cors(req), 'content-type': 'text/plain' });
    return res.end('Bad path');
  }
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k) && v != null) headers[k] = Array.isArray(v) ? v.join(', ') : v;
  const key = process.env.FC_GUEST_API_KEY;
  if (key && !headers['api-key'] && GUEST_PATHS.test(target.pathname)) headers['api-key'] = key;

  let up;
  try {
    up = await fetch(target, { method: req.method, headers, body: await readBody(req), redirect: 'manual' });
  } catch (e) {
    res.writeHead(502, { ...cors(req), 'content-type': 'text/plain' });
    return res.end('Upstream unreachable');
  }
  const out = { ...cors(req) };
  up.headers.forEach((v, k) => {
    if (!/^(content-encoding|content-length|transfer-encoding|connection|access-control-.*)$/i.test(k)) out[k] = v;
  });
  res.writeHead(up.status, out);
  if (!up.body) return res.end();
  try {
    for await (const chunk of up.body) res.write(chunk);
  } catch (e) {
    // Upstream dropped mid-stream: end what we have (the SDK treats it as an interrupted answer).
  }
  res.end();
}
