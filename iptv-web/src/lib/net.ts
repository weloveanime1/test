export const proxied = (url: string, stream = false) =>
  `/api/proxy?${stream ? 'mode=stream&' : ''}url=${encodeURIComponent(url)}`;

/** An https page may not load http resources, so those always go through the proxy. */
export const needsProxy = (url: string) => location.protocol === 'https:' && /^http:/i.test(url);

export interface LoadOptions {
  /** Cancels the download. */
  signal?: AbortSignal;
  /** Called as data arrives, with the bytes received so far. */
  onBytes?: (bytes: number) => void;
}

class HttpError extends Error {}
// A provider that sends nothing for this long is treated as not answering.
const STALL_MS = 90_000;

/** Reads a response as text, reporting progress and giving up when the server goes silent. */
async function readText(url: string, { signal, onBytes }: LoadOptions): Promise<{ res: Response; text: string }> {
  const stall = new AbortController();
  let timer = window.setTimeout(() => stall.abort(), STALL_MS);
  const touch = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => stall.abort(), STALL_MS);
  };
  try {
    const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, stall.signal]) : stall.signal });
    if (!res.body) return { res, text: await res.text() };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      touch();
      bytes += value.length;
      onBytes?.(bytes);
      text += decoder.decode(value, { stream: true });
    }
    return { res, text: text + decoder.decode() };
  } catch (err) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (stall.signal.aborted) throw new HttpError('The provider took too long to answer. Try again in a moment.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const isCancel = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';

/** Loads directly when the server allows it and falls back to the proxy otherwise. */
export async function fetchText(url: string, options: LoadOptions = {}): Promise<string> {
  if (!needsProxy(url)) {
    try {
      const { res, text } = await readText(url, options);
      if (res.ok) return text;
      throw new HttpError(`The server answered with an error (${res.status}).`);
    } catch (err) {
      if (err instanceof HttpError || isCancel(err)) throw err;
      // Blocked by CORS or unreachable from the browser: retry through the proxy.
    }
  }
  let result: { res: Response; text: string };
  try {
    result = await readText(proxied(url), options);
  } catch (err) {
    if (err instanceof HttpError || isCancel(err)) throw err;
    throw new Error('Network error: could not reach the server.');
  }
  const { res, text } = result;
  if (res.status === 401) throw new Error('Your session has expired. Reload the page and enter the access password again.');
  if (res.status === 404 && (res.headers.get('content-type') ?? '').includes('html')) {
    throw new Error('This server blocks direct browser access and no proxy is deployed with the app.');
  }
  if (!res.ok) throw new Error(text.slice(0, 200).trim() || `The provider answered with an error (${res.status}). Check the link, username and password.`);
  return text;
}

export async function fetchJson<T = unknown>(url: string, options: LoadOptions = {}): Promise<T> {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('The server sent an unexpected response.');
  }
}

/** Logos and posters on http:// would be blocked on an https:// page, so those are relayed. */
export const img = (url: string) => (needsProxy(url) ? proxied(url) : url);
