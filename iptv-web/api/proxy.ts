// Same-origin relay for playlists, provider APIs and streams that the browser
// cannot load itself (no CORS headers, or http:// from an https:// page).
import { createHmac, timingSafeEqual } from 'node:crypto';

// Each file in api/ deploys as its own function, so this check mirrors api/auth.ts instead of importing it.
export function isAuthorized(request: Request): boolean {
  const expected = createHmac('sha256', process.env.SITE_PASSWORD || '456456').update('nepalhub-session-v1').digest();
  const match = /(?:^|;\s*)nh_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie') ?? '');
  return !!match && timingSafeEqual(Buffer.from(match[1], 'hex'), expected);
}

const PASS_REQUEST = ['range', 'user-agent', 'accept', 'accept-language'];
const PASS_RESPONSE = ['content-type', 'content-range', 'accept-ranges', 'last-modified', 'etag'];

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' ||
    /\.(local|internal|localhost)$/.test(h) ||
    /^(0|10|127)\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === '::' ||
    h === '::1' ||
    /^(f[cd][0-9a-f]{2}|fe80):/.test(h) ||
    h.startsWith('::ffff:')
  );
}

const relay = (url: string) => `/api/proxy?mode=stream&url=${encodeURIComponent(url)}`;

/** Points every URI in an HLS manifest back at the proxy, so segments, keys and variants relay too. */
export function rewriteManifest(text: string, baseUrl: string): string {
  const abs = (uri: string) => relay(new URL(uri, baseUrl).href);
  return text
    .split('\n')
    .map((raw) => {
      const line = raw.trim();
      if (!line) return raw;
      if (line.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${abs(uri)}"`);
      return abs(line);
    })
    .join('\n');
}

const fail = (status: number, message: string) =>
  new Response(message, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export async function GET(request: Request): Promise<Response> {
  // Browsers always send this header, so other websites cannot use the deployment as a relay.
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return fail(403, 'Cross-site use of this proxy is not allowed.');
  if (!isAuthorized(request)) return fail(401, 'Enter the site password first.');

  const params = new URL(request.url).searchParams;
  const streamMode = params.get('mode') === 'stream';
  let target: URL;
  try {
    target = new URL(params.get('url') ?? '');
  } catch {
    return fail(400, 'Missing or invalid "url" parameter.');
  }

  const headers = new Headers();
  for (const name of PASS_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let upstream: Response;
  try {
    // Redirects are followed by hand so each hop is checked.
    for (let hop = 0; ; hop++) {
      if (!/^https?:$/.test(target.protocol)) return fail(400, 'Only http and https URLs are supported.');
      if (process.env.VERCEL && isBlockedHost(target.hostname)) return fail(403, 'Private network addresses are not allowed.');
      upstream = await fetch(target, { headers, redirect: 'manual', signal: request.signal });
      const location = upstream.headers.get('location');
      if (upstream.status < 300 || upstream.status >= 400 || !location) break;
      if (hop >= 5) return fail(502, 'Too many redirects.');
      await upstream.body?.cancel();
      target = new URL(location, target);
    }
  } catch (err) {
    return fail(502, `Could not reach the server: ${err instanceof Error ? err.message : 'unknown error'}`);
  }

  const out = new Headers({ 'cache-control': 'no-store' });
  for (const name of PASS_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }

  const type = upstream.headers.get('content-type') ?? '';
  // Logos and posters rarely change, so the browser may keep them.
  if (upstream.ok && type.startsWith('image/')) out.set('cache-control', 'private, max-age=86400');
  if (streamMode && upstream.ok && (/mpegurl/i.test(type) || /\.m3u8$/i.test(target.pathname))) {
    const text = await upstream.text();
    if (text.includes('#EXT-X-') || text.includes('#EXTINF')) {
      out.set('content-type', 'application/vnd.apple.mpegurl');
      return new Response(rewriteManifest(text, target.href), { status: upstream.status, headers: out });
    }
    return new Response(text, { status: upstream.status, headers: out });
  }

  // fetch() already decoded the body, so the upstream length only holds for unencoded responses.
  const length = upstream.headers.get('content-length');
  if (length && !upstream.headers.get('content-encoding')) out.set('content-length', length);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
