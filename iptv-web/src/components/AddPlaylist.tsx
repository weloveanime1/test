import { useState } from 'react';
import { parseM3U } from '../lib/m3u';
import { fetchItems, newId } from '../lib/store';
import type { Item, Playlist } from '../lib/types';
import { normalizeServer } from '../lib/xtream';

type Mode = 'xtream' | 'url' | 'file';

interface Props {
  onAdd: (playlist: Playlist, items: Item[]) => Promise<void> | void;
}

export function AddPlaylist({ onAdd }: Props) {
  const [mode, setMode] = useState<Mode>('url');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (build: () => Promise<{ playlist: Omit<Playlist, 'id' | 'updatedAt' | 'count'>; items?: Item[] }>) => {
    setBusy(true);
    setError('');
    try {
      const { playlist, items: given } = await build();
      const full: Playlist = { ...playlist, id: newId(), updatedAt: Date.now(), count: 0 };
      const items = given ?? (await fetchItems(full));
      await onAdd({ ...full, count: items.length }, items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'xtream') {
        const origin = normalizeServer(server);
        return { playlist: { name: name || new URL(origin).hostname, type: 'xtream', server: origin, username: username.trim(), password } };
      }
      if (mode === 'url') {
        const clean = url.trim();
        return { playlist: { name: name || new URL(clean).hostname, type: 'm3u', url: clean } };
      }
      if (!file) throw new Error('Choose an M3U file first.');
      const items = parseM3U(await file.text());
      if (!items.length) throw new Error('No channels found in that file.');
      return { playlist: { name: name || file.name.replace(/\.m3u8?$/i, ''), type: 'm3u' }, items };
    });
  };

  const demo = () =>
    run(async () => ({ playlist: { name: 'Demo playlist', type: 'm3u', url: new URL('/demo.m3u', location.href).href } }));

  return (
    <form className="add" onSubmit={submit}>
      <div className="tabs">
        {(['url', 'xtream', 'file'] as const).map((m) => (
          <button type="button" key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
            {m === 'url' ? 'M3U link' : m === 'xtream' ? 'Xtream Codes' : 'M3U file'}
          </button>
        ))}
      </div>
      <label>
        <span>
          Playlist name <small>(optional)</small>
        </span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My TV" />
      </label>
      {mode === 'url' && (
        <label>
          Playlist link
          <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/playlist.m3u" />
        </label>
      )}
      {mode === 'xtream' && (
        <>
          <label>
            Server
            <input required value={server} onChange={(e) => setServer(e.target.value)} placeholder="http://provider.example:8080" />
          </label>
          <label>
            Username
            <input required autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label>
            Password
            <input required type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </>
      )}
      {mode === 'file' && (
        <label>
          M3U file
          <input type="file" accept=".m3u,.m3u8,audio/x-mpegurl,text/plain" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="row-gap">
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Loading…' : 'Add playlist'}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={demo}>
          Try the demo playlist
        </button>
      </div>
    </form>
  );
}
