import { Readable } from 'node:stream';
import react from '@vitejs/plugin-react';
import type { Connect, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { GET } from './api/proxy.ts';

// Serves the Vercel function locally so dev and preview behave like production.
const proxyHandler: Connect.NextHandleFunction = async (req, res, next) => {
  if (!req.url?.startsWith('/api/proxy')) return next();
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const abort = new AbortController();
  res.on('close', () => abort.abort());
  try {
    const r = await GET(new Request(`http://${req.headers.host}${req.url}`, { headers, signal: abort.signal }));
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

const localProxy = (): Plugin => ({
  name: 'local-api-proxy',
  configureServer: (server) => void server.middlewares.use(proxyHandler),
  configurePreviewServer: (server) => void server.middlewares.use(proxyHandler),
});

export default defineConfig({
  plugins: [react(), localProxy()],
  test: { include: ['tests/**/*.test.ts'] },
});
