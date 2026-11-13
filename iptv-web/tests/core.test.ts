import { describe, expect, it } from 'vitest';
import * as admin from '../api/admin';
import * as auth from '../api/auth';
import { GET, isBlockedHost, rewriteManifest } from '../api/proxy';
import { kindOf, parseM3U } from '../src/lib/m3u';
import { sourcesFor } from '../src/lib/sources';
import type { Item, Playlist } from '../src/lib/types';
import { xtreamFromLink } from '../src/lib/xtream';

describe('parseM3U', () => {
  it('reads names, groups, logos and URLs', () => {
    const items = parseM3U(
      [
        '#EXTM3U',
        '#EXTINF:-1 tvg-id="one" tvg-logo="http://img/1.png" group-title="News, World",Channel One, HD',
        'http://host/live/u/p/1.ts',
        '',
        '#EXTINF:-1,Plain',
        '#EXTGRP:Sports',
        'http://host/plain.m3u8',
        '#EXTINF:0 tvg-name="Fallback" group-title="Films"',
        'http://host/movie/u/p/9.mkv',
      ].join('\r\n'),
    );
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ name: 'Channel One, HD', group: 'News, World', logo: 'http://img/1.png', kind: 'live' });
    expect(items[1]).toMatchObject({ name: 'Plain', group: 'Sports', url: 'http://host/plain.m3u8' });
    expect(items[2]).toMatchObject({ name: 'Fallback', group: 'Films', kind: 'movie' });
  });

  it('classifies URLs', () => {
    expect(kindOf('http://h/series/u/p/3.mp4')).toBe('series');
    expect(kindOf('http://h/a/film.MP4?token=1')).toBe('movie');
    expect(kindOf('http://h/u/p/55')).toBe('live');
  });
});

describe('proxy', () => {
  it('rewrites manifest URIs to absolute proxied URLs', () => {
    const out = rewriteManifest(
      ['#EXTM3U', '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"', '#EXTINF:4,', 'seg/1.ts?t=a&b=c', 'http://cdn.example/2.ts'].join('\n'),
      'http://origin.example/live/index.m3u8',
    );
    const lines = out.split('\n');
    expect(lines[1]).toBe(`#EXT-X-KEY:METHOD=AES-128,URI="/api/proxy?mode=stream&url=${encodeURIComponent('http://origin.example/live/key.bin')}"`);
    expect(lines[3]).toBe(`/api/proxy?mode=stream&url=${encodeURIComponent('http://origin.example/live/seg/1.ts?t=a&b=c')}`);
    expect(lines[4]).toBe(`/api/proxy?mode=stream&url=${encodeURIComponent('http://cdn.example/2.ts')}`);
  });

  it('blocks private hosts and cross-site callers', async () => {
    for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.0.1', '172.20.0.1', '169.254.169.254', '[::1]', 'db.internal']) {
      expect(isBlockedHost(h), h).toBe(true);
    }
    expect(isBlockedHost('example.com')).toBe(false);
    expect(isBlockedHost('172.32.0.1')).toBe(false);

    const cross = await GET(new Request('http://app/api/proxy?url=http://example.com', { headers: { 'sec-fetch-site': 'cross-site' } }));
    expect(cross.status).toBe(403);
  });

  it('only serves visitors who entered the site password', async () => {
    const login = (password: string) => auth.POST(new Request('http://app/api/auth', { method: 'POST', body: JSON.stringify({ password }) }));
    expect((await GET(new Request('http://app/api/proxy?url=http://example.com'))).status).toBe(401);
    expect((await login('000000')).status).toBe(401);

    const ok = await login('456456');
    expect(ok.status).toBe(200);
    const cookie = ok.headers.get('set-cookie')!.split(';')[0];
    expect(ok.headers.get('set-cookie')).toContain('HttpOnly');
    expect(auth.GET(new Request('http://app/api/auth', { headers: { cookie } })).status).toBe(200);
    expect(auth.GET(new Request('http://app/api/auth', { headers: { cookie: 'nh_session=' + 'a'.repeat(64) } })).status).toBe(401);

    // With a valid session the proxy gets as far as validating the target.
    const signed = (url: string) => GET(new Request(url, { headers: { cookie } }));
    expect((await signed('http://app/api/proxy?url=ftp://example.com/x')).status).toBe(400);
    expect((await signed('http://app/api/proxy')).status).toBe(400);
  });
});

describe('xtreamFromLink', () => {
  it('reads the login out of a get.php playlist link', () => {
    expect(xtreamFromLink('http://tv.example:8080/get.php?username=bob&password=s3cret&type=m3u_plus&output=ts')).toEqual({ server: 'http://tv.example:8080', username: 'bob', password: 's3cret' });
    expect(xtreamFromLink('https://example.com/lists/tv.m3u')).toBeNull();
    expect(xtreamFromLink('http://tv.example/get.php?username=bob')).toBeNull();
    expect(xtreamFromLink('not a link')).toBeNull();
  });
});

describe('sourcesFor', () => {
  const xtream: Playlist = { id: 'x', name: 'X', type: 'xtream', server: 'http://host:8080', username: 'u', password: 'p', updatedAt: 0, count: 0 };
  const m3u: Playlist = { id: 'm', name: 'M', type: 'm3u', updatedAt: 0, count: 0 };
  const item = (extra: Partial<Item>): Item => ({ id: 'i', kind: 'live', name: 'N', group: 'G', ...extra });
  const plan = (pl: Playlist, extra: Partial<Item>) => sourcesFor(pl, item(extra)).map((s) => `${s.engine} ${s.url}`);

  it('offers Xtream channels as HLS, then MPEG-TS', () => {
    expect(plan(xtream, { streamId: 7 })).toEqual(['hls http://host:8080/live/u/p/7.m3u8', 'mpegts http://host:8080/live/u/p/7.ts']);
  });

  it('keeps the file format of movies', () => {
    expect(plan(xtream, { kind: 'movie', streamId: 9, ext: 'mkv' })).toEqual(['native http://host:8080/movie/u/p/9.mkv']);
  });

  it('plans playlist links by their address', () => {
    expect(plan(m3u, { url: 'http://h/a/index.m3u8?t=1' })).toEqual(['hls http://h/a/index.m3u8?t=1']);
    expect(plan(m3u, { url: 'http://h/live/u/p/5.ts' })).toEqual(['mpegts http://h/live/u/p/5.ts', 'hls http://h/live/u/p/5.m3u8']);
    expect(plan(m3u, { url: 'http://h/u/p/5' })).toEqual(['mpegts http://h/u/p/5', 'hls http://h/u/p/5']);
    expect(plan(m3u, { kind: 'movie', url: 'http://h/film.avi' })).toEqual(['native http://h/film.avi']);
  });
});

describe('shared playlists', () => {
  const post = (password: string, cookie = '') => admin.POST(new Request('http://app/api/admin', { method: 'POST', headers: { cookie }, body: JSON.stringify({ password }) }));

  it('needs the site password and the admin password', async () => {
    const site = (await auth.POST(new Request('http://app/api/auth', { method: 'POST', body: JSON.stringify({ password: '456456' }) }))).headers.get('set-cookie')!.split(';')[0];
    expect((await post('Weloveanime@')).status).toBe(401);
    expect((await post('456456', site)).status).toBe(401);
    expect(admin.GET(new Request('http://app/api/admin', { headers: { cookie: site } })).status).toBe(401);

    const ok = await post('Weloveanime@', site);
    expect(ok.status).toBe(200);
    const both = `${site}; ${ok.headers.get('set-cookie')!.split(';')[0]}`;
    expect(admin.GET(new Request('http://app/api/admin', { headers: { cookie: both } })).status).toBe(200);
  });

  it('reads the share code and ignores anything malformed', () => {
    const code = JSON.stringify([{ id: 'a1', name: 'TV', type: 'xtream', server: 'http://h', username: 'u', password: 'p' }, { name: 'List', type: 'm3u', url: 'http://h/l.m3u' }, { name: 'broken' }, 5]);
    expect(admin.sharedPlaylists(code)).toEqual([
      { id: 'shared-a1', name: 'TV', type: 'xtream', server: 'http://h', username: 'u', password: 'p', updatedAt: 0, count: 0 },
      { id: 'shared-1', name: 'List', type: 'm3u', url: 'http://h/l.m3u', updatedAt: 0, count: 0 },
    ]);
    expect(admin.sharedPlaylists('not json')).toEqual([]);
    expect(admin.sharedPlaylists(undefined)).toEqual([]);
  });
});
