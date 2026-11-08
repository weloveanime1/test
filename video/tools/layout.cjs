// Precomputes the v2 typographic layout (chunks -> rows -> word boxes) and story cue times.
// Run from video/: node tools/layout.cjs   (writes src/data/layout.json)
const fs = require('fs');
const path = require('path');
const fontkit = require('fontkit');

const ROOT = path.join(__dirname, '..');
const lines = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/lines.json'), 'utf8'));
const r2 = (x) => Math.round(x * 100) / 100;

// ---------- fonts ----------
function loadFont(file, variation) {
  const base = fontkit.openSync(path.join(ROOT, 'public/fonts', file));
  const os2 = base['OS/2'];
  const typo = Boolean(os2 && os2.fsSelection && os2.fsSelection.useTypoMetrics);
  const upm = base.unitsPerEm;
  const asc = (typo ? os2.typoAscender : base.ascent) / upm;
  const desc = Math.abs(typo ? os2.typoDescender : base.descent) / upm;
  const cap = base.glyphForCodePoint(0x48).bbox.maxY / upm; // height of "H"
  const font = variation ? base.getVariation(variation) : base;
  // Baseline position inside a line-height:1 box (CSS half-leading model).
  const baseline = (1 - (asc + desc)) / 2 + asc;
  return {font, upm, cap, capTop: baseline - cap, typo, asc, desc};
}
const FONTS = {
  anton: loadFont('Anton.ttf'),
  bebas: loadFont('BebasNeue.ttf'),
  cinzel: loadFont('Cinzel.ttf', {wght: 700}),
};
const emWidth = (fm, text, ls) => fm.font.layout(text).advanceWidth / fm.upm + ls * [...text].length;

const STYLES = {
  verse: {fm: FONTS.anton, css: 'Anton', weight: 400, ls: 0, W: 1180, maxF: 290, minF: 72, Hmax: 600, echoW: 0.62},
  chorus: {fm: FONTS.bebas, css: 'Bebas Neue', weight: 400, ls: 0.02, W: 1300, maxF: 380, minF: 86, Hmax: 660, echoW: 0.62},
  echo: {fm: FONTS.bebas, css: 'Bebas Neue', weight: 400, ls: 0.04, W: 980, maxF: 260, minF: 70, Hmax: 520, echoW: 1},
  name: {fm: FONTS.cinzel, css: 'Cinzel', weight: 700, ls: 0.06, W: 1060, maxF: 180, minF: 60, Hmax: 300, echoW: 1},
};

// ---------- words ----------
const FUNC = new Set(['THE', 'A', 'AN', 'TO', 'OF', 'IN', 'ON', 'AT', 'MY', 'YOUR', 'HER', 'HIS', 'I', "I'M", "I'D", "I'VE",
  'AND', 'BUT', 'SO', 'IT', 'IS', 'THAT', 'THIS', 'FOR', 'FROM', 'INTO', 'WITH', 'LIKE', 'BY', 'AS', 'ME', 'WE', 'YOU',
  "YOU'RE", 'UP', 'JUST', 'NOW', 'THEN', 'WHAT', 'WHO', "DON'T", 'BE', 'BEEN', 'GOT', 'ALL', 'NO', 'NOT', 'HOW', 'THEY',
  'SHE', 'HE', 'ARE', 'WAS', 'DO', 'OR', 'IF', "THAT'S", "IT'S", "I'LL", 'YEAH', 'BRO', 'MAN', 'OKAY', 'UH',
  'THROUGH', 'OVER', 'UNDER', 'ABOUT', 'BEHIND', 'BEFORE', 'AFTER', 'ACROSS', 'WITHOUT', 'BETWEEN', 'NEVER', "CAN'T",
  "WON'T", "AIN'T", 'WANNA', 'GONNA', "HERE'S", 'HERE', 'THERE', 'WHEN', 'WHERE']);
const BIND = new Set(['THE', 'A', 'AN', 'MY', 'YOUR', 'HER', 'HIS', 'OF', 'TO', 'IN', 'ON', 'AT', 'FROM', 'INTO', 'WITH',
  'LIKE', 'FOR', 'AND', 'BUT', 'SO', 'THAT', 'THIS', 'I', "I'M", "I'D", "I'VE", "YOU'RE", 'NO', 'EVERY', "I'LL",
  'THROUGH', 'OVER', 'UNDER', 'ABOUT', 'BEHIND', 'BEFORE', 'AFTER', 'ACROSS', 'WITHOUT', 'BETWEEN', 'NOT', 'NEVER', "DON'T",
  "CAN'T", "WON'T", "AIN'T", 'WANNA', 'GONNA', "HERE'S", "THAT'S", "IT'S", "SHE'S", 'WHO', 'WHAT', 'WHERE', 'WHEN', 'HOW', 'IF']);
const HER = new Set(['SHE', 'HER', "SHE'S", "SHE'D", 'CHA', 'HAE-IN', 'S-RANK', 'SWORDSMAN', 'BLADE']);
const ACCENT = new Set(['ARISE', 'SHADOW', 'SHADOWS', 'MONARCH', 'MONARCHS', 'HEART', 'LIGHT', 'SYSTEM', 'LEVEL', 'LEVELS',
  'HUNTER', 'HUNTERS', 'RULERS', 'PLAYER', 'QUEST', 'JEJU', 'ISLAND', 'THRONE', 'LIFE', 'ALONE', 'DEAD', 'GATES', 'GATE',
  'KING', 'DEATH', 'E-RANK', 'S-RANK', 'DUNGEON', 'LEGION', 'ARMY', 'DARKNESS', 'BERU', 'WAR', 'GODS', 'CLOCK', 'REWIND',
  'TIME', 'MEMORY', 'SAVE', 'FILE', 'LOADING', 'SINGLE', 'MINE', 'SWORDSMAN', 'BLADE', 'GHOST', 'WEAKEST', 'STRONGEST',
  'MONSTER', 'CARNAGE', 'APOCALYPSE', 'NIGHTMARE', 'WEAPON', 'LONELINESS', 'SILENCE', 'EXIST', 'EXISTENCE', 'BROKE', 'ERASE']);

const clean = (raw) => raw.replace(/^[\s\-–—"“”']+/, '').replace(/["“”]/g, '').replace(/[,.;:]+$/, '').trim();
const bare = (up) => up.replace(/[?!]/g, '');
const kindOf = (up) => (HER.has(bare(up)) ? 'her' : ACCENT.has(bare(up)) ? 'accent' : 'plain');
const isFunc = (w) => FUNC.has(bare(w.up));

function lineWords(li, mode) {
  return lines[li].words.map((w, wi) => {
    let s = w.s;
    // The aligner sometimes stretches a line's first word back into the preceding silence.
    if (wi === 0 && mode !== 'chorus' && w.e - w.s > 1.0) s = w.e - 0.4;
    const t = clean(w.w);
    return {raw: w.w, up: t.toUpperCase(), orig: t, s, e: w.e, k: kindOf(t.toUpperCase())};
  }).filter((w) => w.up.length > 0);
}

// ---------- chunking ----------
function splitLine(words) {
  const n = words.length;
  const endsPunct = (i) => /[,.;:?!]["”]?$/.test(words[i].raw) || (i + 1 < n && /^[-–—]/.test(words[i + 1].raw));
  const nameAt = [];
  for (let i = 0; i + 1 < n; i++) if (words[i].up === 'CHA' && words[i + 1].up.startsWith('HAE-IN')) nameAt.push(i);
  const cost = (i, j) => {
    for (const k of nameAt) {
      if ((k >= i && k < j) || (k + 1 >= i && k + 1 < j)) return i === k && j === k + 2 ? 0 : Infinity;
    }
    const m = j - i;
    const dur = words[j - 1].e - words[i].s;
    let c = 0.4;
    c += m === 1 ? 5 : m === 2 ? 1.8 : m <= 6 ? 0 : m === 7 ? 1.2 : 3 + (m - 8) * 2;
    if (j < n && !endsPunct(j - 1)) c += 1.5;
    if (j < n && BIND.has(bare(words[j - 1].up))) c += 2;
    // Tie-breakers: end phrases on content words, start them on function words ("| this darkness").
    if (j < n && isFunc(words[j - 1])) c += 0.6;
    if (j < n && !isFunc(words[j])) c += 0.4;
    if (dur < 0.55) c += 2;
    if (dur > 2.4) c += (dur - 2.4) * 2;
    return c;
  };
  const best = new Array(n + 1).fill(Infinity);
  const prev = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let i = Math.max(0, j - 10); i < j; i++) {
      const c = best[i] + cost(i, j);
      if (c < best[j]) { best[j] = c; prev[j] = i; }
    }
  }
  const out = [];
  for (let j = n; j > 0; j = prev[j]) out.unshift(words.slice(prev[j], j));
  return out;
}

const sections = [];
lines.forEach((l, i) => {
  const last = sections[sections.length - 1];
  if (!last || last.label !== l.section) {
    const n = sections.filter((s) => s.label === l.section).length;
    sections.push({label: l.section, key: n ? `${l.section} ${n + 1}` : l.section, lines: []});
  }
  sections[sections.length - 1].lines.push(i);
});
const modeOf = (label) => (['Intro', 'Bridge', 'Outro'].includes(label) ? 'spoken' : label.startsWith('Verse') ? 'verse' : 'chorus');

const raw = [];
for (const sec of sections) {
  const mode = modeOf(sec.label);
  sec.mode = mode;
  for (const li of sec.lines) {
    const ws = lineWords(li, mode);
    if (!ws.length) continue;
    if (mode === 'spoken') {
      const whisper = ws.length === 1 && bare(ws[0].up) === 'ARISE';
      raw.push({sec, line: li, style: whisper ? 'whisper' : 'spoken', groups: [{words: ws, echo: false, free: false}]});
      continue;
    }
    const dur = ws[ws.length - 1].e - ws[0].s;
    const text = ws.map((w) => bare(w.up)).join(' ');
    const isNameLine = ws.length === 2 && ws[0].up === 'CHA';
    const last = raw[raw.length - 1];
    if (ws.length <= 3 && dur < 1.2 && !isNameLine) {
      const mainCount = last ? last.groups.filter((g) => !g.echo).reduce((a, g) => a + g.words.length, 0) : 99;
      if (last && last.sec === sec && last.tinyText === text) {
        last.groups.push({words: ws, echo: last.style !== 'chorus' || text !== 'ARISE', free: false});
      } else if (text === 'ARISE') {
        raw.push({sec, line: li, style: 'chorus', tinyText: text, groups: [{words: ws, echo: false, free: false}]});
      } else if (last && last.sec === sec && last.style === 'chorus' && mainCount <= 6 && ws[0].s - lastEnd(last) < 0.8) {
        last.groups.push({words: ws, echo: true, free: false});
        last.tinyText = text;
      } else {
        raw.push({sec, line: li, style: 'echo', tinyText: text, groups: [{words: ws, echo: true, free: false}]});
      }
      continue;
    }
    for (const piece of splitLine(ws)) {
      const isName = piece.length === 2 && piece[0].up === 'CHA';
      raw.push({sec, line: li, style: isName ? 'name' : mode, groups: [{words: piece, echo: false, free: !isName}]});
    }
  }
}
function lastEnd(ch) {
  const g = ch.groups[ch.groups.length - 1];
  return g.words[g.words.length - 1].e;
}

// ---------- block layout ----------
function scoreRows(rows, cfg, units) {
  const fm = cfg.fm;
  let fsz = rows.map((r, i) => Math.min(cfg.maxF, (r.echo ? cfg.W * cfg.echoW : cfg.W) / units[i]));
  const gapOf = (a, b) => 0.2 * fm.cap * Math.min(a, b);
  let H0 = 0;
  fsz.forEach((f, i) => { H0 += f * fm.cap + (i ? gapOf(fsz[i - 1], f) : 0); });
  const scale = Math.min(1, cfg.Hmax / H0);
  fsz = fsz.map((f) => f * scale);
  let cost = (1 - scale) * 8;
  const main = rows.map((r, i) => ({r, f: fsz[i]})).filter((o) => !o.r.echo);
  const fMin = Math.min(...main.map((o) => o.f));
  const fMax = Math.max(...main.map((o) => o.f));
  if (fMin < cfg.minF) cost += (cfg.minF - fMin) / 8;
  cost += Math.max(0, 160 - fMin) / 25; // readability: long single rows get tiny
  if (fMax / fMin > 3) cost += (fMax / fMin - 3) * 2;
  if (main.length >= 2) {
    const heroes = main.filter((o) => o.f >= 0.95 * fMax);
    if (heroes.every((o) => o.r.words.every(isFunc))) cost += 4;
    if (heroes.some((o) => o.r.words.some((w) => w.k !== 'plain' || (w.up.length >= 6 && !isFunc(w))))) cost -= 1.2;
  }
  main.forEach((o) => { if (o.r.words.length === 1 && isFunc(o.r.words[0])) cost += 3; });
  rows.forEach((r, i) => {
    if (i < rows.length - 1 && !r.echo && !rows[i + 1].echo && BIND.has(bare(r.words[r.words.length - 1].up))) cost += 1;
  });
  const n = main.reduce((a, o) => a + o.r.words.length, 0);
  const ideal = n <= 2 ? 1 : n <= 4 ? 2 : 3;
  cost += Math.abs(main.length - ideal) * 0.8;
  cost -= main.reduce((a, o) => a + o.f, 0) / main.length / 400;
  return {cost, fsz};
}

function layoutBlock(ch) {
  const cfg = STYLES[ch.style];
  const fm = cfg.fm;
  const space = emWidth(fm, ' ', cfg.ls);
  const wEm = (w) => emWidth(fm, w.up, cfg.ls);
  let combos = [[]];
  for (const g of ch.groups) {
    const opts = [];
    if (!g.free) {
      opts.push(g.echo ? [g.words] : g.words.length === 1 ? [g.words] : [g.words]);
    } else {
      const m = g.words.length;
      for (let mask = 0; mask < 1 << (m - 1); mask++) {
        const rows = [];
        let cur = [g.words[0]];
        for (let i = 1; i < m; i++) {
          if (mask & (1 << (i - 1))) { rows.push(cur); cur = []; }
          cur.push(g.words[i]);
        }
        rows.push(cur);
        if (rows.length <= 4) opts.push(rows);
      }
    }
    const next = [];
    for (const c of combos) for (const o of opts) next.push([...c, ...o.map((r) => ({words: r, echo: g.echo}))]);
    combos = next;
  }
  let best = null;
  for (const rows of combos) {
    const units = rows.map((r) => r.words.reduce((a, w) => a + wEm(w), 0) + space * (r.words.length - 1));
    const sc = scoreRows(rows, cfg, units);
    if (!best || sc.cost < best.cost) best = {...sc, rows, units};
  }
  const widths = best.rows.map((r, i) => best.fsz[i] * best.units[i]);
  const W = Math.max(...widths);
  const rows = [];
  let y = 0;
  best.rows.forEach((r, i) => {
    const f = best.fsz[i];
    if (i) y += 0.2 * fm.cap * Math.min(best.fsz[i - 1], f);
    let x = (W - widths[i]) / 2;
    const words = r.words.map((w) => {
      const ww = wEm(w) * f;
      const o = {t: w.up, x: r2(x), w: r2(ww), s: r2(w.s), e: r2(w.e), k: w.k};
      x += ww + space * f;
      return o;
    });
    rows.push({y: r2(y), f: r2(f), h: r2(f * fm.cap), echo: r.echo, words});
    y += f * fm.cap;
  });
  return {W: r2(W), H: r2(y), rows, font: cfg.css, weight: cfg.weight, ls: cfg.ls, capTop: r2(fm.capTop * 1e4) / 1e4};
}

const ENTER_PRE = {verse: 0.1, chorus: 0.14, name: 0.12, echo: 0.06, spoken: 0.25, whisper: 0.1};
const HOLD = {verse: 0.55, chorus: 1.2, name: 0.6, echo: 0.35, spoken: 1.6, whisper: 1.2};

const chunks = raw.map((ch, id) => {
  const words = ch.groups.flatMap((g) => g.words);
  const base = {
    id, key: ch.sec.key, section: ch.sec.label, style: ch.style, line: ch.line,
    start: r2(words[0].s), end: r2(Math.max(...words.map((w) => w.e))),
    text: ch.groups.map((g) => g.words.map((w) => w.up).join(' ')).join(' / '),
  };
  if (ch.style === 'spoken' || ch.style === 'whisper') {
    return {...base, words: words.map((w) => ({t: w.orig, x: 0, w: 0, s: r2(w.s), e: r2(w.e), k: w.k}))};
  }
  return {...base, ...layoutBlock(ch)};
});

chunks.forEach((c, i) => {
  c.enter = r2(c.start - ENTER_PRE[c.style]);
  // Whispers float behind everything, so they never cut the main lyric layer short.
  const next = chunks.slice(i + 1).find((n) => (c.style === 'whisper') === (n.style === 'whisper'));
  let exit = c.end + HOLD[c.style];
  if (next) exit = Math.min(exit, next.start - (c.style === 'spoken' ? 0.5 : 0.04));
  const lastStart = Math.max(...(c.rows ? c.rows.flatMap((r) => r.words) : c.words).map((w) => w.s));
  c.exit = r2(Math.max(exit, lastStart + 0.18));
});

// ---------- story cues ----------
const L = (re) => {
  const i = lines.findIndex((l) => re.test(l.text));
  if (i < 0) throw new Error(`cue line not found: ${re}`);
  return i;
};
const Wd = (li, re, nth = 0) => {
  const ws = lines[li].words.filter((w) => re.test(clean(w.w)));
  if (!ws[nth]) throw new Error(`cue word not found: ${re} in ${lines[li].text}`);
  return ws[nth];
};
const secStart = (key) => Math.min(...chunks.filter((c) => c.key === key).map((c) => c.start));
const sys = L(/^System popped up/);
const quest = L(/^Hundred push-ups/);
const lvl = L(/^Level up your body/);
const ld = L(/^And I'm loading it/);
const erase = L(/^Erase my name/);
const met = L(/^"Have we met before/);

const cues = {
  system: {a: lines[sys].start, b: lines[sys].end, accept: Wd(sys, /^accept/i).s},
  quest: {
    a: lines[quest].start, b: lines[quest].end,
    push: [Wd(quest, /^hundred$/i, 0).s, Wd(quest, /^push-ups$/i).e],
    sit: [Wd(quest, /^hundred$/i, 1).s, Wd(quest, /^sit-ups$/i).e],
    run: [Wd(quest, /^ten$/i).s, Wd(quest, /^running$/i).e],
    done: Wd(quest, /^through$/i).s,
  },
  rankUp: lines[L(/^Went from punching bag/)].start,
  levelUp: {a: lines[lvl].start, b: lines[lvl].end, lonely: Wd(lvl, /^loneliness$/i).s},
  sheEnters: Wd(L(/^Then she walked/), /^she$/i).s,
  slash: Wd(L(/^S-rank, swordsman/), /^swordsman$/i).s,
  jeju: lines[L(/^Jeju Island/)].start,
  beru: lines[L(/^Beru screaming/)].start,
  freeze: [Wd(L(/^Eye to eye/), /^quiet$/i).s, r2(Wd(L(/^Like somebody paused/), /^it$/i).e + 0.15)],
  rewind: [Wd(L(/^Trade what I got/), /^clock$/i).s, r2(Wd(L(/^Rewind my whole/), /^back$/i).e + 0.2)],
  systemGone: Wd(L(/^Nobody knows my name/), /^System$/i).s,
  rainV3: lines[L(/^Then she stops/)].start,
  metBefore: {a: lines[met].start, b: lines[met].end},
  erase: {a: lines[erase].start, b: lines[erase].end},
  save: Wd(L(/That's a save file/), /^save$/i).s,
  loading: {a: Wd(ld, /^loading$/i).s, every: Wd(ld, /^Every$/i).s, single: Wd(ld, /^Single$/i).s, life: Wd(ld, /^Life$/i).s, b: lines[ld].end},
  restored: r2(secStart('Final Chorus')),
  impacts: ['Pre-Chorus', 'Chorus', 'Chorus 2', 'Final Chorus'].map((k) => r2(secStart(k))),
  verseStarts: ['Verse 1', 'Verse 2', 'Verse 3'].map((k) => r2(secStart(k))),
  outroEnd: lines[lines.length - 1].end,
  sections: sections.map((s) => ({key: s.key, label: s.label, mode: s.mode, start: r2(secStart(s.key))})),
};

fs.writeFileSync(path.join(ROOT, 'src/data/layout.json'), JSON.stringify({chunks, cues}));
const fm = Object.fromEntries(Object.entries(FONTS).map(([k, v]) => [k, {cap: r2(v.cap * 1e3) / 1e3, capTop: r2(v.capTop * 1e3) / 1e3, typo: v.typo, asc: r2(v.asc * 1e3) / 1e3, desc: r2(v.desc * 1e3) / 1e3}]));
console.log('fonts', JSON.stringify(fm));
console.log('chunks', chunks.length, 'styles', JSON.stringify(chunks.reduce((a, c) => ({...a, [c.style]: (a[c.style] || 0) + 1}), {})));
const fmtRows = (c) => (c.rows ? c.rows.map((r) => `${r.echo ? '~' : ''}${r.words.map((w) => w.t).join(' ')}(${Math.round(r.f)})`).join(' | ') : c.text);
const show = process.argv.includes('--all');
for (const c of chunks) {
  const main = (c.rows || []).filter((r) => !r.echo);
  const fs2 = main.map((r) => r.f);
  const flags = [];
  if (main.length && Math.min(...fs2) < 130) flags.push('small');
  if (main.some((r) => r.words.length === 1 && FUNC.has(bare(r.words[0].t)))) flags.push('func-row');
  if (main.length && Math.max(...fs2) / Math.min(...fs2) > 2.8) flags.push('ratio');
  if (c.exit - c.start < 0.5) flags.push('short');
  if (show || flags.length) console.log(`${String(c.id).padStart(3)} ${c.start.toFixed(2)} ${c.style.padEnd(6)} ${fmtRows(c)} ${flags.join(',')}`);
}
if (process.argv.includes('--cues')) console.log('cues', JSON.stringify(cues));
