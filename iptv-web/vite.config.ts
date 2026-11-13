import { Readable } from 'node:stream';
import react from '@vitejs/plugin-react';
import type { Connect, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import * as admin from './api/admin.ts';
import * as auth from './api/auth.ts';
import * as proxy from './api/proxy.ts';

type Handler = (request: Request) => Response | Promise<Response>;
const routes: Record<string, Record<string, Handler | unknown>> = { '/api/admin': admin, '/api/auth': auth, '/api/proxy': proxy };

// Serves the Vercel functions locally so dev and preview behave like production.
const apiHandler: Connect.NextHandleFunction = async (req, res, next) => {
  const handler = routes[(req.url ?? '').split('?')[0]]?.[req.method ?? 'GET'];
  if (typeof handler !== 'function') return next();
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const abort = new AbortController();
  res.on('close', () => abort.abort());
  try {
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const chunks: Buffer[] = [];
    if (hasBody) for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = hasBody ? Buffer.concat(chunks) : undefined;
    const r = await (handler as Handler)(
      new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body, signal: abort.signal }),
    );
    res.statusCode = r.status;
    r.headers.forEach((v, k) => res.setHeader(k, v));
    if (!r.body) return void res.end();
    Readable.fromWeb(r.body as never)
      .on('error', () => res.destroy())
      .pipe(res);
  } catch {
    if (!res.headersSent) res.statusCode = 502;
    res.end();
  }
};

const localApi = (): Plugin => ({
  name: 'local-api',
  configureServer: (server) => void server.middlewares.use(apiHandler),
  configurePreviewServer: (server) => void server.middlewares.use(apiHandler),
});

export default defineConfig({
  plugins: [react(), localApi()],
  test: { include: ['tests/**/*.test.ts'] },
});
