# StreamDeck IPTV

A free IPTV player that runs in the browser, inspired by [IPVIO Stream](https://github.com/Emrodev/IPVIO-Stream) (an Android TV app). It ships no channels: you add your own playlist, and you should only use sources you are allowed to access.

## Features

- Playlists from an **M3U link**, an **M3U file** or an **Xtream Codes** login; several playlists side by side
- Live TV, Movies and Series sections with categories and search
- Series pages with seasons and episodes (Xtream)
- Now/next programme info for live channels (Xtream)
- Favourites, recently watched channels, and "continue watching" with resume
- Plays HLS, MPEG-TS and MP4 streams; channel up/down with PageUp/PageDown
- Works on desktop and phones; everything you add is stored only in your browser

## Run locally

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # unit tests
pnpm build      # production build in dist/
```

## Deploy for free on Vercel

1. Push this repository to GitHub.
2. In Vercel choose **Add New → Project** and import the repository.
3. Set **Root Directory** to `iptv-web`. Vercel detects Vite on its own; keep the defaults.
4. Deploy.

No environment variables, database or paid add-on is needed. The static site also runs on Netlify, Cloudflare Pages or GitHub Pages, but the proxy described below is written for Vercel, so on those hosts only providers that allow direct browser access will work.

## How streams reach the browser

Browsers are stricter than TV apps: a website served over `https://` may not load `http://` streams, and may not read from servers that do not allow cross-site requests. Most IPTV providers hit one of these limits.

The app therefore tries each playlist and stream directly first, and falls back to `api/proxy.ts`, a small Vercel function that relays the request from the same address as the site. Direct streams cost nothing. Relayed streams count against the Vercel free plan's monthly data allowance (100 GB on Hobby at the time of writing), which is fine for personal use and not for a public service. Vercel's Hobby plan is for personal, non-commercial use.

The proxy refuses requests from other websites and requests to private network addresses.

## Limits of a browser player

- Browsers cannot decode everything a TV box can. MKV/AVI files, HEVC video and AC3/DTS audio often fail; the player then offers the stream link to copy into an app such as VLC.
- Relayed streams that are one endless connection (raw MPEG-TS) are cut when the function's time limit is reached. HLS streams, which Xtream live channels use here, are not affected.
- Not included from the original app: Stalker portals, recording, catch-up, profiles and parental controls.
