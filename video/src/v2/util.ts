export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const outExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
export const outCubic = (p: number) => 1 - Math.pow(1 - p, 3);
export const inCubic = (p: number) => p * p * p;

/** 0 before a, ramps to 1 over fadeIn, holds, then ramps to 0 over fadeOut starting at b. */
export const windowed = (t: number, a: number, b: number, fadeIn = 0.25, fadeOut = 0.25) =>
  clamp01((t - a) / fadeIn) * (1 - clamp01((t - b) / fadeOut));

/** Piecewise-linear lookup over [time, value] keys sorted by time. */
export function keyframes(t: number, keys: [number, number][]) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return t1 > t0 ? v0 + ((v1 - v0) * (t - t0)) / (t1 - t0) : v1;
    }
  }
  return keys[keys.length - 1][1];
}

export function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
};
export function mixHex(a: string, b: string, p: number) {
  const A = hexRgb(a);
  const B = hexRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * p).toString(16).padStart(2, '0')).join('');
}

/** Deterministic PRNG so every frame agrees on particle layouts. */
export function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lastAtOrBefore(arr: number[], t: number) {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] <= t) {
      ans = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return ans;
}

export const mmss = (s: number) =>
  `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
