import { Bookmark, Clapperboard, Film, House, LoaderCircle, Lock, Search, Settings as Cog, Tv, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AddPlaylist } from './components/AddPlaylist';
import { Browse } from './components/Browse';
import { Detail } from './components/Detail';
import { Gate } from './components/Gate';
import { Home } from './components/Home';
import { Library, SearchResults } from './components/Library';
import { LiveTV } from './components/LiveTV';
import { Logo } from './components/Logo';
import { Player } from './components/Player';
import { Profiles } from './components/Profiles';
import { Settings } from './components/Settings';
import { AppContext, type AppCtx, type Tab } from './ctx';
import { checkSession, logout, sharedSession } from './lib/auth';
import { initials } from './lib/format';
import { initialProfiles, prefixFor, shareCode, SHARED, type Profile } from './lib/profiles';
import { canRefresh, DEFAULT_SETTINGS, dropItems, fetchItems, loadCached, saveItems, usePersisted } from './lib/store';
import type { HistoryEntry, Item, Kind, Playlist, Settings as Prefs } from './lib/types';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home', icon: <House size={22} /> },
  { id: 'live', label: 'Live TV', icon: <Tv size={22} /> },
  { id: 'movie', label: 'Movies', icon: <Film size={22} /> },
  { id: 'series', label: 'Series', icon: <Clapperboard size={22} /> },
  { id: 'library', label: 'My list', icon: <Bookmark size={22} /> },
  { id: 'settings', label: 'Settings', icon: <Cog size={22} /> },
];
const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

type Session = { profile: Profile; shared: Playlist[] | null };
const LAST_PROFILE = 'nepalhub.profile';

export default function App() {
  const [access, setAccess] = useState<'checking' | 'locked' | 'open'>('checking');
  const [profiles, setProfiles] = usePersisted<Profile[]>('iptv.profiles', initialProfiles());
  const [session, setSession] = useState<Session | null>(null);

  // A reload returns to the profile that was open in this tab.
  useEffect(() => {
    (async () => {
      if (!(await checkSession())) return setAccess('locked');
      const last = sessionStorage.getItem(LAST_PROFILE);
      if (last === SHARED.id) {
        const shared = await sharedSession();
        if (shared) setSession({ profile: SHARED, shared });
      } else {
        const profile = profiles.find((p) => p.id === last);
        if (profile) setSession({ profile, shared: null });
      }
      setAccess('open');
    })().catch(() => setAccess('locked'));
    // Runs once on load.
  }, []);

  const pick = (next: Session | null) => {
    if (next) sessionStorage.setItem(LAST_PROFILE, next.profile.id);
    else sessionStorage.removeItem(LAST_PROFILE);
    setSession(next);
  };
  const lock = () =>
    logout().then(() => {
      pick(null);
      setAccess('locked');
    });

  if (access === 'checking') {
    return (
      <main className="splash">
        <LoaderCircle className="spin" size={40} />
      </main>
    );
  }
  if (access === 'locked') return <Gate onUnlock={() => setAccess('open')} />;
  if (!session) return <Profiles profiles={profiles} onChange={setProfiles} onPick={(profile, shared) => pick({ profile, shared })} onLock={lock} />;
  return <Main key={session.profile.id} profile={session.profile} shared={session.shared} onLock={lock} onSwitch={() => pick(null)} />;
}

function Main({ profile, shared, onLock, onSwitch }: Session & { onLock: () => void; onSwitch: () => void }) {
  const prefix = prefixFor(profile.id);
  const [local, setPlaylists] = usePersisted<Playlist[]>(`${prefix}playlists`, []);
  const [activeId, setActiveId] = usePersisted<string | null>(`${prefix}active`, null);
  const [favMap, setFavMap] = usePersisted<Record<string, Item>>(`${prefix}favs`, {});
  const [allHistory, setAllHistory] = usePersisted<HistoryEntry[]>(`${prefix}history`, []);
  const [stored, setSettings] = usePersisted<Prefs>(`${prefix}settings`, DEFAULT_SETTINGS);
  // The shared profile lists the owner's playlists first; a local copy of one already shared is hidden.
  const playlists = useMemo(() => (shared ? [...shared, ...local.filter((l) => !shared.some((s) => s.id === `shared-${l.id}`))] : local), [shared, local]);
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...stored }), [stored]);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('home');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<Item | null>(null);
  const [playing, setPlaying] = useState<{ item: Item; queue: Item[] } | null>(null);

  const active = playlists.find((p) => p.id === activeId) ?? playlists[0] ?? null;
  const pid = active?.id;

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', settings.accent);
  }, [settings.accent]);

  // Channel lists come from the browser cache; a playlist restored from a backup is fetched again.
  useEffect(() => {
    if (!active) return setItems([]);
    let gone = false;
    setLoading(true);
    (async () => {
      let list = await loadCached(active.id);
      if (!list && canRefresh(active)) {
        list = await fetchItems(active);
        await saveItems(active.id, list);
      }
      if (!gone) setItems(list ?? []);
    })()
      .catch((err) => !gone && setNotice(message(err, 'The playlist could not be loaded.')))
      .finally(() => !gone && setLoading(false));
    return () => {
      gone = true;
    };
    // Only switching playlists should reload.
  }, [pid]);

  const byKind = useMemo(() => {
    const out: Record<Kind, Item[]> = { live: [], movie: [], series: [] };
    for (const it of items) out[it.kind].push(it);
    return out;
  }, [items]);

  const favs = useMemo(
    () =>
      Object.entries(favMap)
        .filter(([k]) => k.startsWith(`${pid}|`))
        .map(([, item]) => item),
    [favMap, pid],
  );
  const history = useMemo(() => allHistory.filter((e) => e.playlistId === pid), [allHistory, pid]);
  const progress = useMemo(() => new Map(history.map((e) => [e.item.id, e.duration > 0 ? e.position / e.duration : 0])), [history]);

  const record = useCallback(
    (item: Item, position: number, duration: number) => {
      if (!pid) return;
      const entry: HistoryEntry = { key: `${pid}|${item.id}`, playlistId: pid, item, position, duration, at: Date.now() };
      setAllHistory((h) => [entry, ...h.filter((e) => e.key !== entry.key)].slice(0, 80));
    },
    [pid, setAllHistory],
  );

  const ctx = useMemo<AppCtx | null>(() => {
    if (!active) return null;
    const play: AppCtx['play'] = (item, queue = []) => {
      if (item.kind === 'live') record(item, 0, 0);
      setPlaying({ item, queue: queue.some((q) => q.id === item.id) ? queue : [] });
    };
    return {
      playlist: active,
      byKind,
      favs,
      history,
      isFav: (item) => `${active.id}|${item.id}` in favMap,
      toggleFav: (item) =>
        setFavMap((f) => {
          const next = { ...f };
          const key = `${active.id}|${item.id}`;
          if (key in next) delete next[key];
          else next[key] = item;
          return next;
        }),
      progressOf: (item) => progress.get(item.id) ?? 0,
      play,
      open: (item, queue) => {
        if (item.kind === 'live') play(item, queue);
        // An episode from history plays on its own; its neighbours are only known on the series page.
        else if (item.id.startsWith('episode:')) play(item);
        else setDetail(item);
      },
      go: (next) => {
        setTab(next);
        setDetail(null);
        setQuery('');
      },
    };
  }, [active, byKind, favs, history, favMap, progress, record, setFavMap]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !playing && setDetail(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing]);

  const addPlaylist = async (playlist: Playlist, list: Item[]) => {
    await saveItems(playlist.id, list);
    setPlaylists((all) => [...all, playlist]);
    setActiveId(playlist.id);
    setTab('home');
    setDetail(null);
  };

  const refresh = async (playlist: Playlist) => {
    setBusy(true);
    setNotice('');
    try {
      const list = await fetchItems(playlist);
      await saveItems(playlist.id, list);
      setPlaylists((all) => all.map((p) => (p.id === playlist.id ? { ...p, count: list.length, updatedAt: Date.now() } : p)));
      if (playlist.id === pid) setItems(list);
      setNotice(`“${playlist.name}” updated: ${list.length.toLocaleString()} titles.`);
    } catch (err) {
      setNotice(message(err, 'Update failed.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = (playlist: Playlist) => {
    if (!confirm(`Remove “${playlist.name}” and its favourites and history?`)) return;
    const mine = (key: string) => key.startsWith(`${playlist.id}|`);
    dropItems(playlist.id);
    setPlaylists((all) => all.filter((p) => p.id !== playlist.id));
    setFavMap((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !mine(k))));
    setAllHistory((h) => h.filter((e) => !mine(e.key)));
  };

  const exportBackup = () => {
    const data = { app: 'nepalhub', version: 1, playlists, activeId, favs: favMap, history: allHistory, settings };
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    link.download = `nepalhub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importBackup = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data?.app !== 'nepalhub' || !Array.isArray(data.playlists)) throw new Error('This is not a Nepalhub backup file.');
      setPlaylists(data.playlists);
      setActiveId(data.activeId ?? null);
      setFavMap(data.favs ?? {});
      setAllHistory(Array.isArray(data.history) ? data.history : []);
      setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      setNotice('Backup restored.');
    } catch (err) {
      setNotice(message(err, 'The backup could not be read.'));
    }
  };

  if (!active || !ctx) {
    return (
      <main className="welcome">
        <Logo size={52} wordmark />
        <h1>{shared ? 'No shared playlist yet' : `Welcome, ${profile.name}`}</h1>
        <p>
          {shared
            ? 'The site owner has not shared a playlist yet. If that is you: add one here, then open Settings and follow “Share with everyone”.'
            : 'Add a playlist you are allowed to use and everything appears here. It stays in this profile.'}
        </p>
        <AddPlaylist onAdd={addPlaylist} />
        <button className="link" onClick={onSwitch}>
          Switch profile
        </button>
        <small>Playlists, logins, favourites and history are stored only in this browser.</small>
      </main>
    );
  }

  const current = playing?.item;
  const saved = current && history.find((e) => e.item.id === current.id);
  const startAt = saved && saved.duration > 0 && saved.position < saved.duration * 0.95 ? saved.position : 0;
  const searching = query.trim().length >= 2;

  return (
    <AppContext.Provider value={ctx}>
      <div className="shell">
        <nav className="rail" aria-label="Main">
          <button className="rail-logo" onClick={() => ctx.go('home')} aria-label="Nepalhub home">
            <Logo size={38} />
          </button>
          {TABS.map((t) => (
            <button key={t.id} className={`rail-btn ${tab === t.id && !searching ? 'on' : ''} ${t.id === 'settings' ? 'last' : ''}`} onClick={() => ctx.go(t.id)} title={t.label}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="main">
          <header className="topbar">
            <label className="field search">
              <Search size={18} />
              <input type="search" placeholder="Search channels, movies, series…" value={query} onChange={(e) => setQuery(e.target.value)} onFocus={() => setDetail(null)} />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={16} />
                </button>
              )}
            </label>
            <button className="chip" onClick={() => ctx.go('settings')} title="Manage playlists">
              <i /> {active.name}
            </button>
            <button className="avatar-btn" style={{ background: profile.color }} onClick={onSwitch} title={`${profile.name} · switch profile`} aria-label="Switch profile">
              {initials(profile.name)}
            </button>
            <button className="icon-btn" onClick={onLock} title="Lock this site" aria-label="Lock this site">
              <Lock size={18} />
            </button>
          </header>

          <div className="view">
            {loading && items.length === 0 ? (
              <div className="splash">
                <LoaderCircle className="spin" size={40} />
                <p>Loading playlist…</p>
              </div>
            ) : searching ? (
              <SearchResults query={query.trim()} />
            ) : (
              <>
                {tab === 'home' && <Home />}
                {tab === 'live' && <LiveTV key={active.id} />}
                {tab === 'movie' && <Browse key={`${active.id}-movie`} title="Movies" noun="movie" items={byKind.movie} />}
                {tab === 'series' && <Browse key={`${active.id}-series`} title="Series" noun="series" items={byKind.series} />}
                {tab === 'library' && <Library />}
                {tab === 'settings' && (
                  <Settings
                    playlists={playlists}
                    activeId={active.id}
                    busy={busy}
                    notice={notice}
                    settings={settings}
                    onSettings={setSettings}
                    onUse={setActiveId}
                    onRefresh={refresh}
                    onRemove={remove}
                    onAdd={addPlaylist}
                    onExport={exportBackup}
                    onImport={importBackup}
                    onClearHistory={() => setAllHistory([])}
                    onLock={onLock}
                    onSwitch={onSwitch}
                    profileName={profile.name}
                    shareCode={shared ? shareCode(playlists) : undefined}
                  />
                )}
              </>
            )}
            {detail && <Detail key={detail.id} item={detail} onClose={() => setDetail(null)} />}
          </div>
        </div>

        {playing && (
          <Player
            playlist={active}
            item={playing.item}
            queue={playing.queue}
            startAt={startAt}
            autoplayNext={settings.autoplayNext}
            onClose={() => setPlaying(null)}
            onProgress={record}
            onPlay={(item) => ctx.play(item, playing.queue)}
          />
        )}
      </div>
    </AppContext.Provider>
  );
}
