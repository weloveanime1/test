import { useEffect, useRef, useState } from 'react';

/** Renders long lists a page at a time: attach the returned ref to an element after the list. */
export function usePaged(total: number, page: number, resetKey: unknown) {
  const [limit, setLimit] = useState(page);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => setLimit(page), [resetKey, page]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && setLimit((n) => n + page), { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [total, page, limit >= total]);

  return [limit, sentinel] as const;
}
