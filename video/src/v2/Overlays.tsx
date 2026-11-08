import React from 'react';
import {AbsoluteFill, staticFile} from 'remotion';
import {
  beatInBar, CHAPTERS, CUES, DURATION, freezeAmount, GOLD, letterboxAmount, lineIndexAt, Pal, PAL, paletteAt, rewindAmount,
  rms, SYS, SYS_LINE,
} from './data';
import {clamp01, keyframes, mmss, outCubic, outExpo, rgba, windowed} from './util';

const RED = '#ff3b5c';
const PANEL_X = 1240;
const PANEL_W = 620;
const GRAIN = [0, 1, 2, 3, 4, 5].map((i) => staticFile(`tex/grain${i}.png`));

// ---------- System window primitives ----------
const Corners: React.FC<{accent: string}> = ({accent}) => (
  <>
    {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([cx, cy], i) => (
      <div key={i} style={{
        position: 'absolute', width: 16, height: 16,
        left: cx ? undefined : -6, right: cx ? -6 : undefined, top: cy ? undefined : -6, bottom: cy ? -6 : undefined,
        borderLeft: cx ? undefined : `3px solid ${accent}`, borderRight: cx ? `3px solid ${accent}` : undefined,
        borderTop: cy ? undefined : `3px solid ${accent}`, borderBottom: cy ? `3px solid ${accent}` : undefined,
      }} />
    ))}
  </>
);

const Panel: React.FC<{x: number; y: number; w: number; a: number; accent?: string; pad?: string; children: React.ReactNode}> = ({
  x, y, w, a, accent = SYS, pad = '20px 28px', children,
}) => {
  if (a <= 0.001) return null;
  const e = outCubic(a);
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, transform: `scaleY(${(0.04 + 0.96 * e).toFixed(4)})`, opacity: clamp01(a * 2.5),
      border: `1.5px solid ${rgba(accent, 0.9)}`, borderRadius: 4, background: 'linear-gradient(180deg, rgba(10,18,46,0.9), rgba(5,9,26,0.92))',
      boxShadow: `0 0 28px ${rgba(accent, 0.45)}, inset 0 0 36px ${rgba(accent, 0.14)}`, padding: pad, fontFamily: 'Inter', color: '#e8eeff',
    }}>
      <Corners accent={accent} />
      {children}
    </div>
  );
};

const Header: React.FC<{title: string; accent?: string; icon?: string; divider?: boolean}> = ({title, accent = SYS, icon = '!', divider = true}) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 14, paddingBottom: divider ? 12 : 0, marginBottom: divider ? 14 : 0,
    borderBottom: divider ? `1px solid ${rgba(accent, 0.4)}` : undefined,
  }}>
    <div style={{
      width: 34, height: 34, borderRadius: '50%', border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: 20, color: accent, boxShadow: `0 0 12px ${rgba(accent, 0.6)}`,
    }}>{icon}</div>
    <div style={{fontSize: 22, fontWeight: 700, letterSpacing: '0.32em', color: accent}}>{title}</div>
  </div>
);

const Btn: React.FC<{label: string; on: boolean; pulse: number}> = ({label, on, pulse}) => (
  <div style={{
    padding: '6px 34px', border: `1.5px solid ${on ? SYS : 'rgba(150,170,210,0.4)'}`, background: on ? rgba(SYS, 0.85) : 'transparent',
    color: on ? '#04122a' : '#9fb0d6', fontFamily: 'Bebas Neue', fontSize: 34, letterSpacing: '0.18em',
    boxShadow: on ? `0 0 ${(18 + 30 * pulse).toFixed(1)}px ${rgba(SYS, 0.8)}` : undefined, transform: `scale(${(1 + 0.08 * pulse).toFixed(4)})`,
  }}>{label}</div>
);

const Cursor: React.FC<{t: number}> = ({t}) => (
  <span style={{display: 'inline-block', width: 12, height: 26, marginLeft: 4, verticalAlign: '-4px', background: SYS, opacity: Math.floor(t * 4) % 2 ? 1 : 0}} />
);

// ---------- story set pieces ----------
const SystemNotice: React.FC<{t: number}> = ({t}) => {
  const {a, b, accept} = CUES.system;
  const vis = windowed(t, a - 0.05, b + 0.1, 0.22, 0.2);
  if (vis <= 0) return null;
  const text = 'You have acquired the qualifications to be a Player. Will you accept?';
  const n = Math.floor(clamp01((t - a - 0.1) / 1.0) * text.length);
  const sel = t > accept + 0.15;
  return (
    <Panel x={PANEL_X} y={330} w={PANEL_W} a={vis}>
      <Header title="NOTIFICATION" />
      <div style={{fontSize: 27, lineHeight: 1.45, minHeight: 80}}>{text.slice(0, n)}<Cursor t={t} /></div>
      <div style={{display: 'flex', justifyContent: 'center', gap: 30, marginTop: 18}}>
        <Btn label="YES" on={sel} pulse={sel ? Math.exp(-(t - accept - 0.15) * 6) : 0} />
        <Btn label="NO" on={false} pulse={0} />
      </div>
    </Panel>
  );
};

const Check: React.FC = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" style={{marginLeft: 10, verticalAlign: '-3px'}}>
    <path d="M4 12.5l5 5L20 6" fill="none" stroke={SYS} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DailyQuest: React.FC<{t: number}> = ({t}) => {
  const q = CUES.quest;
  const vis = windowed(t, q.a - 0.02, q.b + 0.25, 0.2, 0.25);
  if (vis <= 0) return null;
  const cnt = (r: number[], max: number) => Math.round(clamp01((t - r[0]) / Math.max(0.2, r[1] - r[0] + 0.15)) * max);
  const rows: [string, number, number, string][] = [
    ['PUSH-UPS', cnt(q.push, 100), 100, ''], ['SIT-UPS', cnt(q.sit, 100), 100, ''], ['RUNNING', cnt(q.run, 10), 10, ' KM'],
  ];
  const done = t >= q.done;
  const dp = done ? Math.exp(-(t - q.done) * 5) : 0;
  return (
    <Panel x={PANEL_X} y={290} w={PANEL_W} a={vis}>
      <Header title="DAILY QUEST" />
      <div style={{fontSize: 18, color: '#9fb0d6', letterSpacing: '0.12em', marginBottom: 14}}>STRENGTH TRAINING HAS ARRIVED.</div>
      {rows.map(([label, v, max, unit]) => (
        <div key={label} style={{display: 'flex', justifyContent: 'space-between', fontSize: 26, padding: '7px 0', color: v === max ? SYS : '#e8eeff'}}>
          <span style={{letterSpacing: '0.12em'}}>{label}{v === max && <Check />}</span>
          <span style={{fontVariantNumeric: 'tabular-nums'}}>[{v}/{max}{unit}]</span>
        </div>
      ))}
      <div style={{
        marginTop: 14, textAlign: 'center', fontFamily: 'Bebas Neue', fontSize: 40, letterSpacing: '0.2em',
        color: done ? SYS : 'rgba(159,176,214,0.35)', textShadow: done ? `0 0 ${(16 + 30 * dp).toFixed(1)}px ${SYS}` : undefined,
        transform: `scale(${(1 + 0.12 * dp).toFixed(4)})`,
      }}>{done ? 'QUEST COMPLETE' : 'IN PROGRESS'}</div>
    </Panel>
  );
};

const LevelUp: React.FC<{t: number}> = ({t}) => {
  const L = CUES.levelUp;
  const vis = windowed(t, L.a - 0.05, L.b + 0.45, 0.2, 0.25);
  if (vis <= 0) return null;
  const hit = Math.exp(-Math.max(0, t - L.a) * 4);
  const lj = t >= L.lonely ? Math.exp(-(t - L.lonely) * 3) : 0;
  const stat = (label: string, val: string, at: number, color = SYS, jitter = 0) => (
    <div key={label} style={{
      display: 'flex', justifyContent: 'space-between', fontSize: 25, padding: '6px 0', color,
      opacity: clamp01((t - at) / 0.12), transform: `translateX(${(Math.sin(t * 80) * 5 * jitter).toFixed(1)}px)`,
    }}>
      <span style={{letterSpacing: '0.14em'}}>{label}</span><span style={{fontWeight: 700}}>{val}</span>
    </div>
  );
  return (
    <Panel x={PANEL_X} y={300} w={PANEL_W} a={vis}>
      <div style={{
        textAlign: 'center', fontFamily: 'Bebas Neue', fontSize: 96, lineHeight: 1, letterSpacing: '0.12em', color: '#eaf6ff',
        textShadow: `0 0 ${(20 + 40 * hit).toFixed(1)}px ${SYS}`, transform: `scale(${(1 + 0.15 * hit).toFixed(4)})`, marginBottom: 10,
      }}>LEVEL UP!</div>
      {stat('STRENGTH', '+5', L.a + 0.15)}
      {stat('AGILITY', '+5', L.a + 0.35)}
      {stat('SENSE', '+5', L.a + 0.55)}
      {stat('LONELINESS', '+99', L.lonely, RED, lj)}
    </Panel>
  );
};

const LocationStamp: React.FC<{t: number}> = ({t}) => {
  const a = CUES.jeju;
  const vis = windowed(t, a - 0.1, a + 4.6, 0.3, 0.5);
  if (vis <= 0) return null;
  const title = 'JEJU ISLAND';
  const n = Math.floor(clamp01((t - a) / 0.6) * title.length);
  return (
    <div style={{position: 'absolute', left: 96, bottom: 150, opacity: vis, fontFamily: 'Inter', color: '#fff'}}>
      <div style={{position: 'absolute', left: -24, top: 4, width: 4, height: 128 * outCubic(clamp01((t - a) / 0.4)), background: RED, boxShadow: `0 0 14px ${RED}`}} />
      <div style={{fontSize: 15, fontWeight: 700, letterSpacing: '0.5em', color: RED}}>LOCATION</div>
      <div style={{fontFamily: 'Bebas Neue', fontSize: 76, letterSpacing: '0.08em', lineHeight: 1.05, minHeight: 80}}>{title.slice(0, n)}</div>
      <div style={{fontSize: 17, letterSpacing: '0.32em', color: '#c9cbe0', opacity: clamp01((t - a - 0.6) / 0.4)}}>S-RANK RAID · ANT NEST</div>
    </div>
  );
};

const RewindFx: React.FC<{t: number}> = ({t}) => {
  const vis = rewindAmount(t);
  if (vis <= 0) return null;
  const blink = Math.floor(t * 5) % 2 === 0 ? 1 : 0.35;
  return (
    <AbsoluteFill style={{opacity: vis}}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, right: 0, top: ((t * (900 + i * 370) + i * 300) % 1300) - 100, height: 6 + (i % 3) * 14,
          background: `rgba(255,255,255,${0.06 + 0.05 * (i % 2)})`,
        }} />
      ))}
      <div style={{position: 'absolute', top: 120, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18, opacity: blink}}>
        <svg width={70} height={40}><polygon points="34,0 0,20 34,40" fill="#fff" /><polygon points="70,0 36,20 70,40" fill="#fff" /></svg>
        <div style={{fontFamily: 'Bebas Neue', fontSize: 64, letterSpacing: '0.2em', color: '#fff', textShadow: '-3px 0 0 rgba(255,40,90,0.8), 3px 0 0 rgba(40,210,255,0.8)'}}>REWIND</div>
      </div>
    </AbsoluteFill>
  );
};

const SaveFile: React.FC<{t: number}> = ({t}) => {
  const L = CUES.loading;
  const vis = windowed(t, CUES.save - 0.1, CUES.restored - 0.15, 0.3, 0.2);
  if (vis <= 0) return null;
  const prog = keyframes(t, [
    [L.a, 0], [L.a + 0.5, 0.18], [L.every, 0.3], [L.every + 0.4, 0.5], [L.single, 0.56], [L.single + 0.4, 0.78], [L.life, 0.84], [L.life + 0.55, 1],
  ]);
  const status = prog >= 1 ? 'LOAD COMPLETE' : t >= L.a ? 'LOADING' : 'READY';
  return (
    <Panel x={960 - 380} y={770} w={760} a={vis} accent={GOLD}>
      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 18, letterSpacing: '0.3em', color: GOLD, fontWeight: 700}}>
        <span>SAVE FILE 01</span><span>JEJU ISLAND</span>
      </div>
      <div style={{fontSize: 20, marginTop: 8, letterSpacing: '0.12em', color: '#efe7cf'}}>MEMORY · CHA HAE-IN</div>
      <div style={{marginTop: 14, height: 10, background: 'rgba(246,201,91,0.15)', borderRadius: 2, overflow: 'hidden'}}>
        <div style={{width: `${(prog * 100).toFixed(2)}%`, height: '100%', background: `linear-gradient(90deg, #b9832a, ${GOLD}, #fff4d0)`, boxShadow: `0 0 16px ${GOLD}`}} />
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 17, letterSpacing: '0.25em', color: '#efe7cf', fontVariantNumeric: 'tabular-nums'}}>
        <span>{status}</span><span>{Math.round(prog * 100)}%</span>
      </div>
    </Panel>
  );
};

const Restored: React.FC<{t: number}> = ({t}) => {
  const a = CUES.restored;
  const vis = windowed(t, a + 0.15, a + 2.6, 0.2, 0.3);
  if (vis <= 0) return null;
  return (
    <Panel x={960 - 330} y={84} w={660} a={vis} accent={GOLD} pad="12px 22px">
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <Header title="SYSTEM RESTORED" accent={GOLD} divider={false} />
        <div style={{fontSize: 14, letterSpacing: '0.3em', color: '#efe7cf'}}>WELCOME BACK</div>
      </div>
    </Panel>
  );
};

// ---------- HUD ----------
const Bar: React.FC<{label: string; color: string; v: number}> = ({label, color, v}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 6}}>
    <span style={{fontSize: 11, width: 22, letterSpacing: '0.1em', color: '#9fb0d6', fontWeight: 700}}>{label}</span>
    <div style={{flex: 1, height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden'}}>
      <div style={{width: `${(v * 100).toFixed(1)}%`, height: '100%', background: color, boxShadow: `0 0 8px ${color}`}} />
    </div>
  </div>
);

const RankBadge: React.FC<{rank: string; accent: string; hit: number}> = ({rank, accent, hit}) => {
  const s = rank === 'S';
  return (
    <div style={{filter: `drop-shadow(0 0 ${(8 + 24 * hit).toFixed(1)}px ${s ? GOLD : accent})`, transform: `scale(${(1 + 0.25 * hit).toFixed(4)})`}}>
      <div style={{
        width: 66, height: 74, clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)',
        background: s ? `linear-gradient(160deg, #fff1c4, ${GOLD} 45%, #8a5a12)` : 'linear-gradient(160deg, #8fa3c7, #3c4a66)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{fontFamily: 'Bebas Neue', fontSize: 50, color: s ? '#2a1600' : '#0b1222', marginTop: 4}}>{rank}</span>
      </div>
    </div>
  );
};

const Hud: React.FC<{t: number}> = ({t}) => {
  const on1 = windowed(t, CUES.system.a, CUES.systemGone, 0.35, 0.01);
  const on2 = windowed(t, CUES.restored + 0.5, 1e9, 0.5, 1);
  const g = t - CUES.systemGone;
  const glitching = g >= 0 && g < 0.6;
  // "no System" — the HUD flickers out and stays gone until the bridge reloads the save.
  const vis = (glitching ? (Math.sin(g * 90) > 0 ? 1 : 0.15) * (1 - g / 0.6) : Math.max(on1, on2)) * (1 - letterboxAmount(t));
  if (vis <= 0.01) return null;
  const final = t >= CUES.restored;
  const accent = final ? GOLD : SYS;
  const li = lineIndexAt(t);
  const level = final ? 'MAX' : String(Math.min(99, Math.max(1, 1 + (li - SYS_LINE) * 2))).padStart(2, '0');
  const rank = t >= CUES.rankUp ? 'S' : 'E';
  const rk = t >= CUES.rankUp ? Math.exp(-(t - CUES.rankUp) * 4) : 0;
  return (
    <div style={{
      position: 'absolute', left: 64 + (glitching ? Math.sin(t * 173) * 14 : 0), top: 54, width: 410, opacity: vis,
      fontFamily: 'Inter', color: '#e8eeff', filter: glitching ? 'hue-rotate(90deg)' : undefined,
    }}>
      <div style={{
        border: `1.5px solid ${rgba(accent, 0.8)}`, borderRadius: 4, background: 'rgba(6,12,32,0.72)', padding: '14px 18px',
        boxShadow: `0 0 22px ${rgba(accent, 0.35)}`, display: 'flex', gap: 18, alignItems: 'center',
      }}>
        <RankBadge rank={rank} accent={accent} hit={rk} />
        <div style={{flex: 1}}>
          <div style={{fontSize: 13, letterSpacing: '0.38em', color: accent, fontWeight: 700}}>PLAYER</div>
          <div style={{fontSize: 22, fontWeight: 700, letterSpacing: '0.06em', marginTop: 2}}>SUNG JINWOO</div>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2}}>
            <span style={{fontFamily: 'Bebas Neue', fontSize: 36, letterSpacing: '0.08em'}}>LV. {level}</span>
            <span style={{fontSize: 12, letterSpacing: '0.3em', color: '#9fb0d6'}}>{final ? 'SHADOW MONARCH' : 'JOB: NONE'}</span>
          </div>
          <Bar label="HP" color="#ff4d6d" v={0.92} />
          <Bar label="MP" color={accent} v={0.55 + 0.4 * rms(t)} />
        </div>
      </div>
    </div>
  );
};

const ChapterCard: React.FC<{t: number}> = ({t}) => {
  for (const s of CUES.sections) {
    const ch = CHAPTERS[s.key];
    if (!ch) continue;
    const a = s.start - 0.2;
    const vis = windowed(t, a, a + 2.8, 0.5, 0.6);
    if (vis <= 0) continue;
    const pal = PAL[s.key];
    const lp = outCubic(clamp01((t - a) / 0.9));
    return (
      <div style={{position: 'absolute', top: 104, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: vis}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <div style={{width: 120 * lp, height: 1.5, background: `linear-gradient(90deg, transparent, ${pal.a})`}} />
          <div style={{fontFamily: 'Inter', fontWeight: 700, fontSize: 15, letterSpacing: '0.55em', paddingLeft: '0.55em', color: pal.a}}>{ch[0]}</div>
          <div style={{width: 120 * lp, height: 1.5, background: `linear-gradient(90deg, ${pal.a}, transparent)`}} />
        </div>
        <div style={{
          fontFamily: 'Cinzel', fontWeight: 600, fontSize: 36, letterSpacing: `${(0.12 + 0.08 * (1 - lp)).toFixed(3)}em`, color: '#f4f2ff',
          marginTop: 8, textShadow: `0 0 18px ${rgba(pal.a, 0.6)}`,
        }}>{ch[1]}</div>
      </div>
    );
  }
  return null;
};

const TitleTag: React.FC<{t: number; pal: Pal}> = ({t, pal}) => (
  <div style={{position: 'absolute', right: 64, top: 58, textAlign: 'right', opacity: clamp01((t - 0.5) / 1) * (1 - letterboxAmount(t))}}>
    <div style={{fontFamily: 'Bebas Neue', fontSize: 38, letterSpacing: '0.14em', color: '#f4f2ff', textShadow: `0 0 16px ${rgba(pal.a, 0.8)}`}}>ARISE, MY HEART</div>
    <div style={{fontFamily: 'Inter', fontSize: 13, letterSpacing: '0.38em', color: '#a9acc9', marginTop: 2}}>SUNG JINWOO × CHA HAE-IN</div>
  </div>
);

const BottomBar: React.FC<{t: number; pal: Pal}> = ({t, pal}) => {
  const [ra, rb] = CUES.rewind;
  // The timecode itself rewinds with the lyric.
  const shown = t > ra && t < rb ? ra - (t - ra) * 6 : t;
  const bi = beatInBar(t);
  return (
    <>
      <div style={{position: 'absolute', left: 64, right: 64, bottom: 46, height: 2, background: 'rgba(255,255,255,0.1)'}}>
        <div style={{width: `${(clamp01(shown / DURATION) * 100).toFixed(3)}%`, height: '100%', background: `linear-gradient(90deg, ${pal.b}, ${pal.a})`, boxShadow: `0 0 10px ${pal.a}`}} />
      </div>
      <div style={{position: 'absolute', left: 64, bottom: 18, fontFamily: 'Inter', fontSize: 13, letterSpacing: '0.24em', color: '#8d8fb0', fontVariantNumeric: 'tabular-nums'}}>
        {mmss(shown)} / {mmss(DURATION)}
      </div>
      <div style={{position: 'absolute', right: 64, bottom: 62, display: 'flex', gap: 8}}>
        {[0, 1, 2, 3].map((k) => (
          <div key={k} style={{width: 30, height: 5, borderRadius: 3, background: k === bi ? pal.a : 'rgba(255,255,255,0.14)', boxShadow: k === bi ? `0 0 12px ${pal.a}` : undefined}} />
        ))}
      </div>
    </>
  );
};

const Letterbox: React.FC<{t: number}> = ({t}) => {
  const a = letterboxAmount(t);
  if (a <= 0.001) return null;
  const h = 96 * outCubic(a);
  return (
    <>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: h, background: '#000'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: h, background: '#000'}} />
    </>
  );
};

const TitleCard: React.FC<{t: number}> = ({t}) => {
  const a = CUES.outroEnd + 0.4;
  if (t < a) return null;
  const o = outCubic(clamp01((t - a) / 1.6));
  const out = clamp01((t - (DURATION + 0.2)) / 1.4);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', background: `rgba(3,2,8,${(0.55 * o + 0.45 * out).toFixed(3)})`}}>
      <div style={{opacity: o * (1 - out), display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{fontFamily: 'Inter', fontWeight: 600, fontSize: 16, letterSpacing: '0.6em', paddingLeft: '0.6em', color: rgba(GOLD, 0.8), marginBottom: 18}}>
          A SOLO LEVELING LOVE STORY
        </div>
        <div style={{
          fontFamily: 'Bebas Neue', fontSize: 200, lineHeight: 0.95, letterSpacing: `${(0.06 + 0.06 * (1 - o)).toFixed(3)}em`,
          background: 'linear-gradient(180deg, #fff7dc, #f6c95b 55%, #a8741f)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
          color: 'transparent', filter: 'drop-shadow(0 0 30px rgba(246,201,91,0.45))',
        }}>ARISE, MY HEART</div>
        <div style={{width: 520 * o, height: 1.5, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, margin: '22px 0'}} />
        <div style={{fontFamily: 'Cinzel', fontWeight: 600, fontSize: 40, letterSpacing: '0.22em', color: '#f4f2ff'}}>
          Sung Jinwoo <span style={{fontFamily: 'Inter', fontWeight: 300}}>×</span> Cha Hae-In
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Overlays: React.FC<{t: number}> = ({t}) => {
  const pal = paletteAt(t);
  const fz = freezeAmount(t);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: `radial-gradient(ellipse at center, transparent ${(45 - 20 * fz).toFixed(1)}%, rgba(0,0,0,${(0.72 + 0.2 * fz).toFixed(2)}) 100%)`}} />
      <AbsoluteFill style={{backgroundImage: `url(${GRAIN[Math.floor(t * 24) % 6]})`, backgroundSize: '512px 512px', opacity: 0.07, mixBlendMode: 'overlay'}} />
      <ChapterCard t={t} />
      <Hud t={t} />
      <TitleTag t={t} pal={pal} />
      <BottomBar t={t} pal={pal} />
      <SystemNotice t={t} />
      <DailyQuest t={t} />
      <LevelUp t={t} />
      <LocationStamp t={t} />
      <RewindFx t={t} />
      <SaveFile t={t} />
      <Restored t={t} />
      <Letterbox t={t} />
      <TitleCard t={t} />
    </AbsoluteFill>
  );
};

/** Diagonal sword slash on "swordsman". */
export const Slash: React.FC<{t: number}> = ({t}) => {
  const p = (t - CUES.slash + 0.04) / 0.32;
  if (p < 0 || p > 1) return null;
  const grow = outExpo(clamp01(p / 0.3));
  const fade = 1 - clamp01((p - 0.3) / 0.7);
  return (
    <div style={{position: 'absolute', left: -240, top: 536, width: 2400, height: 8, transform: 'rotate(-24deg)', opacity: fade}}>
      <div style={{
        width: '100%', height: '100%', transform: `scaleX(${grow.toFixed(4)})`, transformOrigin: '0% 50%', borderRadius: 4,
        background: 'linear-gradient(90deg, transparent, #fff 20%, #fff7d6 70%, transparent)', boxShadow: `0 0 30px ${GOLD}, 0 0 60px ${GOLD}`,
      }} />
    </div>
  );
};

export const Flash: React.FC<{t: number}> = ({t}) => {
  let w = 0;
  for (const a of CUES.impacts) if (t >= a) w = Math.max(w, 0.85 * Math.exp(-(t - a) * 7));
  for (const a of CUES.verseStarts) if (t >= a) w = Math.max(w, 0.3 * Math.exp(-(t - a) * 8));
  if (t >= CUES.slash) w = Math.max(w, 0.35 * Math.exp(-(t - CUES.slash) * 10));
  const r = t >= CUES.beru ? 0.5 * Math.exp(-(t - CUES.beru) * 4) : 0;
  return (
    <>
      {w > 0.01 && <AbsoluteFill style={{background: '#fff', opacity: w}} />}
      {r > 0.01 && <AbsoluteFill style={{background: 'radial-gradient(circle, transparent 30%, rgba(255,20,50,0.9) 100%)', opacity: r}} />}
    </>
  );
};
