import beats from './data/beats.json';
import linesRaw from './data/lines.json';

export type Word = {w: string; s: number; e: number};
export type Line = {section: string; text: string; start: number; end: number; words: Word[]};
export const lines: Line[] = linesRaw as Line[];
export const DURATION = beats.duration as number;

const HZ = beats.energy_hz as number;
function sample(arr: number[], t: number) {
  const x = Math.max(0, Math.min(arr.length - 1.001, t * HZ));
  const i = Math.floor(x), f = x - i;
  return arr[i] * (1 - f) + arr[i + 1] * f;
}
export const rms = (t: number) => sample(beats.rms as number[], t);
export const low = (t: number) => sample(beats.low as number[], t);

const B = beats.beats as number[];
export function lastBeat(t: number) {
  let lo = 0, hi = B.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (B[m] <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}
/** 0..1 decaying pulse since the last beat, weighted by kick energy. */
export function beatPulse(t: number, decay = 9) {
  const i = lastBeat(t); if (i < 0) return 0;
  const dt = t - B[i];
  return Math.exp(-dt * decay) * (0.35 + 0.65 * low(t));
}
export const beatIndex = (t: number) => lastBeat(t);

export type Mode = 'spoken' | 'verse' | 'chorus' | 'final';
export function modeOf(section: string): Mode {
  if (section === 'Intro' || section === 'Bridge' || section === 'Outro') return 'spoken';
  if (section === 'Final Chorus' || section === 'Pre-Chorus') return 'final';
  if (section === 'Chorus') return 'chorus';
  return 'verse';
}

export const palette = {
  bg: '#04030a', violet: '#8b5cf6', electric: '#5ea2ff', gold: '#f4c452', rose: '#ff5c8a', white: '#f5f3ff', dim: '#6b6880',
};
export function sectionColor(section: string): {a: string; b: string} {
  switch (section) {
    case 'Intro': return {a: '#6d6a85', b: '#9b97b8'};
    case 'Pre-Chorus': return {a: palette.violet, b: palette.electric};
    case 'Chorus': return {a: palette.violet, b: palette.electric};
    case 'Verse 2': return {a: palette.electric, b: palette.violet};
    case 'Verse 3': return {a: palette.rose, b: palette.violet};
    case 'Bridge': return {a: '#c0392b', b: palette.gold};
    case 'Final Chorus': return {a: palette.gold, b: palette.violet};
    case 'Outro': return {a: palette.gold, b: palette.white};
    default: return {a: palette.violet, b: palette.white};
  }
}

const ACCENT = /^(arise|shadows?|monarchs?|heart|light|love|system|levels?|hunters?|rulers?|player|quest|jeju|throne|life|alone|dead|gates?|king|death)$/i;
const HER = /^(she|her|she's|she'd|cha|hae-in,?|hae-in)$/i;
export function wordKind(w: string): 'accent' | 'her' | 'plain' {
  const c = w.replace(/^[^\w]+|[^\w]+$/g, '').toLowerCase();
  if (HER.test(c) || HER.test(w.toLowerCase())) return 'her';
  if (ACCENT.test(c) || ACCENT.test(w.toLowerCase())) return 'accent';
  return 'plain';
}

export function currentLineIndex(t: number) {
  // Latest line whose start <= t + 0.12 (slight pre-roll)
  let idx = -1;
  for (let i = 0; i < lines.length; i++) { if (lines[i].start <= t + 0.12) idx = i; else break; }
  return idx;
}
