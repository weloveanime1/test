import layoutRaw from '../data/layout.json';
import featuresRaw from '../data/features.json';
import beatsRaw from '../data/beats.json';
import linesRaw from '../data/lines.json';
import {clamp01, lastAtOrBefore, mixHex, windowed} from './util';

export type Kind = 'plain' | 'accent' | 'her';
export type Style = 'verse' | 'chorus' | 'name' | 'echo' | 'spoken' | 'whisper';
export type WordBox = {t: string; x: number; w: number; s: number; e: number; k: Kind};
export type Row = {y: number; f: number; h: number; echo: boolean; words: WordBox[]};
export type Chunk = {
  id: number; key: string; section: string; style: Style; line: number;
  start: number; end: number; enter: number; exit: number; text: string;
  W?: number; H?: number; rows?: Row[]; font?: string; weight?: number; ls?: number; capTop?: number;
  words?: WordBox[];
};
type Span = {a: number; b: number};
type Cues = {
  system: Span & {accept: number};
  quest: Span & {push: number[]; sit: number[]; run: number[]; done: number};
  rankUp: number;
  levelUp: Span & {lonely: number};
  sheEnters: number; slash: number; jeju: number; beru: number;
  freeze: number[]; rewind: number[]; systemGone: number; rainV3: number;
  metBefore: Span; erase: Span; save: number;
  loading: Span & {every: number; single: number; life: number};
  restored: number; impacts: number[]; verseStarts: number[]; outroEnd: number;
  sections: {key: string; label: string; mode: string; start: number}[];
};

export const CHUNKS = layoutRaw.chunks as unknown as Chunk[];
export const CUES = layoutRaw.cues as unknown as Cues;
export const DURATION = beatsRaw.duration as number;
const LINE_STARTS = (linesRaw as {start: number}[]).map((l) => l.start);
export const lineIndexAt = (t: number) => lastAtOrBefore(LINE_STARTS, t + 0.05);
export const SYS_LINE = LINE_STARTS.findIndex((s) => Math.abs(s - CUES.system.a) < 0.01);

// ---------- audio-reactive signals ----------
const HZ = beatsRaw.energy_hz as number;
function sample(arr: number[], t: number) {
  const x = Math.max(0, Math.min(arr.length - 1.001, t * HZ));
  const i = Math.floor(x);
  const f = x - i;
  return arr[i] * (1 - f) + arr[i + 1] * f;
}
export const rms = (t: number) => sample(beatsRaw.rms as number[], t);
export const low = (t: number) => sample(beatsRaw.low as number[], t);

const kickT = featuresRaw.kicks.map((k) => k.t);
const kickS = featuresRaw.kicks.map((k) => k.s);
const snareT = featuresRaw.snares.map((k) => k.t);
const snareS = featuresRaw.snares.map((k) => k.s);
function pulse(T: number[], S: number[], t: number, decay: number, minS: number) {
  let i = lastAtOrBefore(T, t);
  while (i >= 0 && S[i] < minS) i--;
  return i < 0 ? 0 : S[i] * Math.exp(-(t - T[i]) * decay);
}
export const kick = (t: number, decay = 9) => pulse(kickT, kickS, t, decay, 0.35);
export const snare = (t: number, decay = 14) => pulse(snareT, snareS, t, decay, 0.45);
const BEATS = beatsRaw.beats as number[];
const DOWN = featuresRaw.downbeats as number[];
export const downbeat = (t: number, decay = 5) => {
  const i = lastAtOrBefore(DOWN, t);
  return i < 0 ? 0 : Math.exp(-(t - DOWN[i]) * decay);
};
export const beatInBar = (t: number) => {
  const i = lastAtOrBefore(BEATS, t);
  return i < 0 ? -1 : (((i - featuresRaw.downbeatPhase) % 4) + 4) % 4;
};

// ---------- sections & palette ----------
export type Pal = {a: string; b: string; bg: string};
export const GOLD = '#f6c95b';
export const SYS = '#5ec8ff';
export const PAL: Record<string, Pal> = {
  'Intro': {a: '#9fb0d6', b: '#5b6b91', bg: '#05060c'},
  'Pre-Chorus': {a: '#a78bfa', b: '#60a5fa', bg: '#07051a'},
  'Verse 1': {a: '#60a5fa', b: '#7c3aed', bg: '#040814'},
  'Chorus': {a: '#a78bfa', b: '#38bdf8', bg: '#08051c'},
  'Verse 2': {a: '#38bdf8', b: '#f5c451', bg: '#050a18'},
  'Chorus 2': {a: '#c4b5fd', b: '#f5c451', bg: '#0a061c'},
  'Verse 3': {a: '#fb7185', b: '#8b5cf6', bg: '#12030a'},
  'Bridge': {a: '#f43f5e', b: '#f5c451', bg: '#0a0205'},
  'Final Chorus': {a: '#fbbf24', b: '#a78bfa', bg: '#100817'},
  'Outro': {a: '#fde68a', b: '#c7d2fe', bg: '#07060a'},
};
const SECTIONS = CUES.sections;
export const sectionIndexAt = (t: number) => {
  let i = 0;
  SECTIONS.forEach((s, k) => { if (s.start - 0.3 <= t) i = k; });
  return i;
};
export function paletteAt(t: number): Pal {
  const i = sectionIndexAt(t);
  const cur = PAL[SECTIONS[i].key];
  if (i === 0) return cur;
  const prev = PAL[SECTIONS[i - 1].key];
  const p = clamp01((t - (SECTIONS[i].start - 0.3)) / 0.8);
  return {a: mixHex(prev.a, cur.a, p), b: mixHex(prev.b, cur.b, p), bg: mixHex(prev.bg, cur.bg, p)};
}
const isChorusKey = (k: string) => k === 'Pre-Chorus' || k.startsWith('Chorus') || k === 'Final Chorus';
const sectionEnd = (i: number) => (i + 1 < SECTIONS.length ? SECTIONS[i + 1].start - 0.2 : DURATION);
export function chorusAmount(t: number) {
  let amt = 0;
  SECTIONS.forEach((s, i) => {
    if (isChorusKey(s.key)) amt = Math.max(amt, windowed(t, s.start - 0.1, sectionEnd(i), 0.35, 0.8));
  });
  return amt;
}
const startOf = (key: string) => SECTIONS.find((s) => s.key === key)!.start;

// ---------- story timing ----------
/** Background clock: frozen while "the war went quiet", running backwards during the rewind. */
export function bgTime(t: number) {
  const spans = [
    {a: CUES.freeze[0], b: CUES.freeze[1], v: 0},
    {a: CUES.rewind[0], b: CUES.rewind[1], v: -4},
  ];
  let T = t;
  for (const s of spans) T += Math.max(0, Math.min(t, s.b) - s.a) * (s.v - 1);
  return T;
}
export const freezeAmount = (t: number) => windowed(t, CUES.freeze[0], CUES.freeze[1], 0.12, 0.3);
export const rewindAmount = (t: number) => windowed(t, CUES.rewind[0], CUES.rewind[1], 0.1, 0.2);
export const rainAmount = (t: number) =>
  Math.max(
    0.75 * windowed(t, -1, CUES.impacts[0] - 0.15, 1, 0.3),
    0.6 * windowed(t, CUES.rainV3, CUES.restored - 0.2, 1.2, 0.4),
    0.8 * windowed(t, startOf('Outro') - 0.6, 1e9, 1.2, 1),
  );
export const letterboxAmount = (t: number) =>
  Math.max(
    windowed(t, -1, CUES.impacts[0] - 0.05, 0.5, 0.25),
    windowed(t, startOf('Bridge') - 0.5, CUES.restored - 0.05, 0.6, 0.25),
    windowed(t, startOf('Outro') - 0.5, 1e9, 0.8, 1),
  );
export const panelShift = (t: number) =>
  Math.max(
    windowed(t, CUES.system.a - 0.15, CUES.quest.b + 0.2, 0.3, 0.35),
    windowed(t, CUES.levelUp.a - 0.15, CUES.levelUp.b + 0.45, 0.3, 0.35),
  );
export const impactPulse = (t: number, decay = 6) =>
  CUES.impacts.reduce((v, a) => (t >= a ? Math.max(v, Math.exp(-(t - a) * decay)) : v), 0);
export const isInvert = (t: number) => CUES.impacts.some((a) => t >= a && t < a + 0.07);
export const CHAPTERS: Record<string, [string, string]> = {
  'Verse 1': ['CHAPTER I', 'The Weakest Hunter'],
  'Verse 2': ['CHAPTER II', 'Jeju Island'],
  'Verse 3': ['CHAPTER III', 'The Final War'],
  'Bridge': ['CHAPTER IV', 'Save File'],
  'Outro': ['EPILOGUE', 'Every Single Life'],
};
