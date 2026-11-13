import { describe, expect, it } from 'vitest';
import * as auth from '../api/auth';
import { GET, isBlockedHost, rewriteManifest } from '../api/proxy';
import { kindOf, parseM3U } from '../src/lib/m3u';

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
