import { Check, Copy, Download, Lock, RefreshCw, Trash2, Upload, Users } from 'lucide-react';
import { useRef, useState } from 'react';
import { plural } from '../lib/format';
import { ACCENTS, canRefresh } from '../lib/store';
import type { Item, Playlist, Settings as Prefs } from '../lib/types';
import { AddPlaylist } from './AddPlaylist';

interface Props {
  playlists: Playlist[];
  activeId: string;
  busy: boolean;
  notice: string;
  settings: Prefs;
  onSettings: (settings: Prefs) => void;
  onUse: (id: string) => void;
  onRefresh: (playlist: Playlist) => void;
  onRemove: (playlist: Playlist) => void;
  onAdd: (playlist: Playlist, items: Item[]) => Promise<void> | void;
  onExport: () => void;
  onImport: (file: File) => void;
  onClearHistory: () => void;
  onLock: () => void;
  onSwitch: () => void;
  profileName: string;
  /** Present in the shared profile: the value that publishes its playlists to everyone. */
  shareCode?: string;
}

export function Settings(p: Props) {
  const file = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    await navigator.clipboard?.writeText(p.shareCode ?? '').catch(() => {});
    setCopied(true);
  };

  return (
    <div className="page padded settings">
      <header className="pane-head">
        <h1>Settings</h1>
      </header>
      {p.notice && <p className="notice">{p.notice}</p>}

      <section className="panel">
        <h2>Playlists</h2>
        <ul className="playlists">
          {p.playlists.map((pl) => (
            <li key={pl.id} className={pl.id === p.activeId ? 'on' : ''}>
              <div>
                <b>{pl.name}</b>
                <small>
                  {pl.type === 'xtream' ? 'Xtream Codes' : pl.url ? 'M3U link' : 'M3U file'}
                  {pl.id.startsWith('shared-') ? ' · shared by the site owner' : ` · ${plural(pl.count, 'title')} · updated ${new Date(pl.updatedAt).toLocaleDateString()}`}
                </small>
              </div>
              {pl.id === p.activeId ? (
                <span className="pill">Active</span>
              ) : (
                <button className="btn small" onClick={() => p.onUse(pl.id)}>
                  Use
                </button>
              )}
              {canRefresh(pl) && (
                <button className="btn small" disabled={p.busy} onClick={() => p.onRefresh(pl)}>
                  <RefreshCw size={15} /> Update
                </button>
              )}
              {!pl.id.startsWith('shared-') && (
                <button className="btn small danger" onClick={() => p.onRemove(pl)} aria-label={`Remove ${pl.name}`}>
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
        <h3>Add a playlist</h3>
        <AddPlaylist onAdd={p.onAdd} />
      </section>

      {p.shareCode !== undefined && (
        <section className="panel">
          <h2>Share with everyone</h2>
          <p className="muted">
            For the site owner. Playlists added in this profile are only on this device until you publish them. To publish: copy the code, open your project on Vercel, go to
            Settings → Environment Variables, add a variable named <code>ADMIN_PLAYLISTS</code> with the code as its value, then redeploy. Everyone who has the shared password
            then sees these playlists. Playlists added from a file cannot be shared.
          </p>
          <button className="btn small" onClick={copyCode}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Code copied' : 'Copy share code'}
          </button>
        </section>
      )}

      <section className="panel">
        <h2>Appearance</h2>
        <div className="setting">
          <div>
            <b>Accent colour</b>
            <small>Used for buttons, highlights and progress bars.</small>
          </div>
          <div className="swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                className={p.settings.accent === a.value ? 'on' : ''}
                style={{ background: a.value }}
                title={a.name}
                aria-label={a.name}
                onClick={() => p.onSettings({ ...p.settings, accent: a.value })}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Playback</h2>
        <label className="setting">
          <div>
            <b>Play the next episode automatically</b>
            <small>When an episode ends, the following one starts.</small>
          </div>
          <input type="checkbox" className="switch" checked={p.settings.autoplayNext} onChange={(e) => p.onSettings({ ...p.settings, autoplayNext: e.target.checked })} />
        </label>
        <div className="setting">
          <div>
            <b>Watch history</b>
            <small>Clears “Continue watching” and recently watched channels for every playlist.</small>
          </div>
          <button className="btn small" onClick={p.onClearHistory}>
            Clear history
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Backup and access</h2>
        <div className="setting">
          <div>
            <b>Backup</b>
            <small>Saves playlists, favourites, history and settings to a file. The file contains your playlist logins, so keep it private.</small>
          </div>
          <div className="row-gap">
            <button className="btn small" onClick={p.onExport}>
              <Download size={15} /> Export
            </button>
            <button className="btn small" onClick={() => file.current?.click()}>
              <Upload size={15} /> Import
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) p.onImport(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>
        <div className="setting">
          <div>
            <b>Profile: {p.profileName}</b>
            <small>Each profile has its own playlists, favourites and history.</small>
          </div>
          <button className="btn small" onClick={p.onSwitch}>
            <Users size={15} /> Switch profile
          </button>
        </div>
        <div className="setting">
          <div>
            <b>Lock this site</b>
            <small>Signs this browser out. The access password is needed to get back in.</small>
          </div>
          <button className="btn small" onClick={p.onLock}>
            <Lock size={15} /> Lock
          </button>
        </div>
      </section>
      <p className="muted">Playlists, logins, favourites and history are stored only in this browser.</p>
    </div>
  );
}
