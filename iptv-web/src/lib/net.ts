export const proxied = (url: string, stream = false) =>
  `/api/proxy?${stream ? 'mode=stream&' : ''}url=${encodeURIComponent(url)}`;

/** An https page may not load http resources, so those always go through the proxy. */
export const needsProxy = (url: string) => location.protocol === 'https:' && /^http:/i.test(url);

class HttpError extends Error {}

/** Loads directly when the server allows it and falls back to the proxy otherwise. */
export async function fetchText(url: string): Promise<string> {
  if (!needsProxy(url)) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      throw new HttpError(`The server answered with an error (${res.status}).`);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      // Blocked by CORS or unreachable from the browser: retry through the proxy.
    }
  }
  let res: Response;
  try {
    res = await fetch(proxied(url));
  } catch {
    throw new Error('Network error: could not reach the server.');
  }
  if (res.status === 404 && (res.headers.get('content-type') ?? '').includes('html')) {
    throw new Error('This server blocks direct browser access and no proxy is deployed with the app.');
  }
  if (!res.ok) throw new Error((await res.text()).slice(0, 200) || `The server answered with an error (${res.status}).`);
  return res.text();
}

export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const text = await fetchText(url);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('The server sent an unexpected response.');
  }
}

/** Logos and posters on http:// would be blocked on an https:// page, so those are relayed. */
export const img = (url: string) => (needsProxy(url) ? proxied(url) : url);
