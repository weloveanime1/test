# Nepalhub

A private IPTV player that runs in the browser, inspired by [IPVIO Stream](https://github.com/Emrodev/IPVIO-Stream) (an Android TV app). It ships no channels: you add your own playlist, and you should only use sources you are allowed to access.

## Features

- **Password gate**: the site and its stream relay are locked until the access password is entered
- Playlists from an **M3U link**, an **M3U file** or an **Xtream Codes** login; several playlists side by side
- **Home** with a rotating showcase, shortcuts, continue watching, recently watched, new and top rated rows
- **Live TV** with categories, favourites, now/next programme info and a preview pane (guide data needs Xtream)
- **Movies and Series** with categories, sorting and filtering; detail pages with plot, cast, trailer link, seasons and episodes
- **Search** across channels, movies and series
- **Player** with its own controls: seek bar, 10 second skip, volume, quality, audio track, subtitles, speed, picture fit, picture-in-picture, fullscreen, channel/episode list, next episode, automatic reconnect for live streams and resume for movies and episodes
- My list (favourites and history), accent colours, backup and restore
- Works on desktop and phones; everything you add is stored only in your browser

Player keyboard shortcuts: `Space` play/pause, `←` `→` skip 10 seconds, `↑` `↓` volume, `M` mute, `F` fullscreen, `PageUp` `PageDown` previous/next channel or episode, `Esc` close.

## Access password

The default password is `456456`. To change it, add an environment variable named `SITE_PASSWORD` in Vercel (**Settings → Environment Variables**) and redeploy.

The default is written in this repository, so anyone who can read the repository can read it. Set `SITE_PASSWORD` if the repository is public. A short numeric password also only keeps casual visitors out; use a longer one if it matters.

## Run locally

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # unit tests
pnpm build      # production build in dist/
```

## Deploy for free on Vercel

1. In Vercel choose **Add New → Project** and import this repository.
2. Set **Root Directory** to `iptv-web` and the preset to **Vite**; keep the other defaults.
3. Deploy. Later pushes to the main branch redeploy on their own.

No database or paid add-on is needed. The password check and the stream relay are Vercel functions (`api/auth.ts`, `api/proxy.ts`), so the app needs Vercel; a plain static host cannot unlock it.

## How streams reach the browser

Browsers are stricter than TV apps: a website served over `https://` may not load `http://` streams or images, and may not read from servers that do not allow cross-site requests. Most IPTV providers hit one of these limits.

The app therefore tries each playlist and stream directly first, and falls back to `api/proxy.ts`, which relays the request from the same address as the site. Direct streams cost nothing. Relayed streams count against the Vercel free plan's monthly data allowance (100 GB on Hobby at the time of writing), which is fine for personal use and not for a public service. Vercel's Hobby plan is for personal, non-commercial use.

The relay only answers visitors who entered the password, and refuses requests from other websites and requests to private network addresses.

## Limits of a browser player

- Browsers cannot decode everything a TV box can. MKV/AVI files, HEVC video and AC3/DTS audio often fail; the player then offers the stream link to copy into an app such as VLC.
- Relayed streams that are one endless connection (raw MPEG-TS) are cut when the function's time limit is reached. HLS streams, which Xtream live channels use here, are not affected.
- Not included from the original app: Stalker portals, recording, catch-up, reminders, profiles, parental controls, intro skipping and ratings from IMDb/TMDB.
