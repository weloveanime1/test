import { Crown, Lock, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { sharedLogin, sharedSession } from '../lib/auth';
import { initials } from '../lib/format';
import { COLORS, removeProfileData, SHARED, type Profile } from '../lib/profiles';
import { newId } from '../lib/store';
import type { Playlist } from '../lib/types';
import { Logo } from './Logo';

interface Props {
  profiles: Profile[];
  onChange: (profiles: Profile[]) => void;
  onPick: (profile: Profile, shared: Playlist[] | null) => void;
  onLock: () => void;
}

/** "Who's watching?" Each profile has its own playlists, favourites and history. */
export function Profiles({ profiles, onChange, onPick, onLock }: Props) {
  const [managing, setManaging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    const profile: Profile = {
      id: profiles.some((p) => p.id === 'main') ? newId() : 'main',
      name: clean,
      color: COLORS[profiles.length % COLORS.length],
    };
    onChange([...profiles, profile]);
    onPick(profile, null);
  };

  const remove = (profile: Profile) => {
    if (!confirm(`Delete the profile “${profile.name}” with its playlists, favourites and history?`)) return;
    removeProfileData(profile.id);
    onChange(profiles.filter((p) => p.id !== profile.id));
  };

  const openShared = async () => {
    setBusy(true);
    const playlists = await sharedSession().catch(() => null);
    setBusy(false);
    if (playlists) onPick(SHARED, playlists);
    else setAsking(true);
  };

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const playlists = await sharedLogin(password);
      if (playlists) return onPick(SHARED, playlists);
      setError('Wrong password. Ask the site owner for it.');
      setPassword('');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="profiles">
      <Logo size={44} wordmark />
      <h1>Who’s watching?</h1>
      <div className="profile-grid">
        <button className="profile" onClick={openShared} disabled={busy}>
          <span className="avatar" style={{ background: `linear-gradient(140deg, ${SHARED.color}, #b45309)` }}>
            <Crown size={46} />
            <i>
              <Lock size={13} />
            </i>
          </span>
          <b>{SHARED.name}</b>
          <small>Shared channels · password</small>
        </button>

        {profiles.map((p) => (
          <div className="profile-wrap" key={p.id}>
            <button className="profile" onClick={() => onPick(p, null)}>
              <span className="avatar" style={{ background: `linear-gradient(140deg, ${p.color}, color-mix(in srgb, ${p.color} 45%, #000))` }}>
                {initials(p.name)}
              </span>
              <b>{p.name}</b>
              <small>Own playlists</small>
            </button>
            {managing && (
              <button className="profile-del" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}>
                <X size={16} />
              </button>
            )}
          </div>
        ))}

        {adding ? (
          <form className="profile new" onSubmit={add}>
            <span className="avatar ghost">
              <Plus size={40} />
            </span>
            <input autoFocus maxLength={20} placeholder="Profile name" aria-label="Profile name" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn primary small" type="submit" disabled={!name.trim()}>
              Create
            </button>
          </form>
        ) : (
          <button className="profile" onClick={() => setAdding(true)}>
            <span className="avatar ghost">
              <Plus size={40} />
            </span>
            <b>Add profile</b>
            <small>Use your own M3U or Xtream</small>
          </button>
        )}
      </div>

      <div className="row-gap">
        {profiles.length > 0 && (
          <button className="btn small" onClick={() => setManaging((v) => !v)}>
            {managing ? 'Done' : 'Manage profiles'}
          </button>
        )}
        <button className="btn small" onClick={onLock}>
          <Lock size={15} /> Lock site
        </button>
      </div>

      {asking && (
        <div className="modal-back" onClick={() => setAsking(false)}>
          <form className="gate-card" onSubmit={unlock} onClick={(e) => e.stopPropagation()}>
            <span className="avatar small" style={{ background: `linear-gradient(140deg, ${SHARED.color}, #b45309)` }}>
              <Crown size={28} />
            </span>
            <h2>{SHARED.name}</h2>
            <p>These channels are shared by the site owner. Enter the password you were given.</p>
            <label className="gate-input">
              <Lock size={18} />
              <input type="password" autoFocus autoComplete="off" placeholder="Shared password" aria-label="Shared password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn primary" type="submit" disabled={busy || !password}>
              {busy ? 'Checking…' : 'Open'}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
