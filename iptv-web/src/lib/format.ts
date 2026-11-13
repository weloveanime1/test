export const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** Player timestamp: 1:02:03 or 4:05. */
export function stamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

/** Runtime label: 1h 41m or 23 min. */
export function runtime(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function initials(name: string): string {
  return name
    .replace(/^[A-Z]{2,3}\s*[:|-]\s*/, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

/** Every word of the query must appear in the name. */
export function matcher(query: string): (name: string) => boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return (name) => {
    const n = name.toLowerCase();
    return words.every((w) => n.includes(w));
  };
}
