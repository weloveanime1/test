// Site access password. Unlocking sets a cookie that api/proxy.ts also requires,
// so nobody can use the deployment to relay streams without the password.
import { createHmac, timingSafeEqual } from 'node:crypto';

// Set SITE_PASSWORD in the hosting dashboard to change the password without editing code.
const password = () => process.env.SITE_PASSWORD || '456456';
const sessionToken = () => createHmac('sha256', password()).update('nepalhub-session-v1').digest('hex');

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

const cookie = (request: Request, value: string, maxAge: number) => {
  const https = request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https:');
  return `nh_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${https ? '; Secure' : ''}`;
};

export function GET(request: Request): Response {
  const match = /(?:^|;\s*)nh_session=([a-f0-9]+)/.exec(request.headers.get('cookie') ?? '');
  return match && same(match[1], sessionToken()) ? json(200, { ok: true }) : json(401, { ok: false });
}

export async function POST(request: Request): Promise<Response> {
  let given = '';
  try {
    given = String(((await request.json()) as { password?: unknown }).password ?? '');
  } catch {
    // Treated as a wrong password below.
  }
  if (!same(given, password())) {
    // Slows down guessing.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return json(401, { ok: false });
  }
  return json(200, { ok: true }, { 'set-cookie': cookie(request, sessionToken(), 60 * 60 * 24 * 30) });
}

export function DELETE(request: Request): Response {
  return json(200, { ok: true }, { 'set-cookie': cookie(request, '', 0) });
}
