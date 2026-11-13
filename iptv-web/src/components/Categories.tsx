interface Props {
  groups: [name: string, count: number][];
  total: number;
  value: string;
  onChange: (group: string) => void;
  /** Extra entries shown above the provider categories. */
  pinned?: { id: string; label: string; count: number }[];
}

export function Categories({ groups, total, value, onChange, pinned = [] }: Props) {
  const entry = (id: string, label: string, count: number) => (
    <button key={id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>
      <span>{label}</span>
      <em>{count.toLocaleString()}</em>
    </button>
  );
  return (
    <aside className="cats" aria-label="Categories">
      {entry('', 'All', total)}
      {pinned.map((p) => entry(p.id, p.label, p.count))}
      {groups.map(([name, count]) => entry(name, name, count))}
    </aside>
  );
}

export function groupCounts(items: { group: string }[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.group, (counts.get(it.group) ?? 0) + 1);
  return [...counts];
}
