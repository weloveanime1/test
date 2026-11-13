// Shared playlists. The site owner lists them in the ADMIN_PLAYLISTS environment variable;
// visitors who know the admin password get them in the "shared" profile.
import { createHmac, timingSafeEqual } from 'node:crypto';

const sitePassword = () => process.env.SITE_PASSWORD || '456456';
// Set ADMIN_PASSWORD in the hosting dashboard to change it without editing code.
const adminPassword = () => process.env.ADMIN_PASSWORD || 'Weloveanime@';

const token = (secret: string, purpose: string) => createHmac('sha256', secret).update(purpose).digest('hex');
const adminToken = () => token(adminPassword(), 'nepalhub-admin-v1');

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const cookieOf = (request: Request, name: string) => new RegExp(`(?:^|;\\s*)${name}=([a-f0-9]+)`).exec(request.headers.get('cookie') ?? '')?.[1] ?? '';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

const setCookie = (request: Request, value: string, maxAge: number) => {
  const https = request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https:');
  return `nh_admin=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${https ? '; Secure' : ''}`;
};

/** Reads the share code the app generates: a JSON list of playlists. */
export function sharedPlaylists(raw = process.env.ADMIN_PLAYLISTS): unknown[] {
  let list: unknown;
  try {
    list = JSON.parse(raw || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  const text = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return list.flatMap((entry, i): unknown[] => {
    const p = (entry ?? {}) as Record<string, unknown>;
    const base = { id: `shared-${text(p.id) ?? i}`, name: text(p.name) ?? `Playlist ${i + 1}`, updatedAt: 0, count: 0 };
    if (p.type === 'xtream' && text(p.server)) return [{ ...base, type: 'xtream', server: text(p.server), username: text(p.username) ?? '', password: text(p.password) ?? '' }];
    if (text(p.url)) return [{ ...base, type: 'm3u', url: text(p.url) }];
    return [];
  });
}

// The site password comes first: the admin password alone opens nothing.
const siteOk = (request: Request) => same(cookieOf(request, 'nh_session'), token(sitePassword(), 'nepalhub-session-v1'));

export function GET(request: Request): Response {
  if (!siteOk(request) || !same(cookieOf(request, 'nh_admin'), adminToken())) return json(401, { ok: false });
  return json(200, { ok: true, playlists: sharedPlaylists() });
}

export async function POST(request: Request): Promise<Response> {
  if (!siteOk(request)) return json(401, { ok: false });
  let given = '';
  try {
    given = String(((await request.json()) as { password?: unknown }).password ?? '');
  } catch {
    // Treated as a wrong password below.
  }
  if (!same(given, adminPassword())) {
    // Slows down guessing.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return json(401, { ok: false });
  }
  return json(200, { ok: true, playlists: sharedPlaylists() }, { 'set-cookie': setCookie(request, adminToken(), 60 * 60 * 24 * 30) });
}

export function DELETE(request: Request): Response {
  return json(200, { ok: true }, { 'set-cookie': setCookie(request, '', 0) });
}
