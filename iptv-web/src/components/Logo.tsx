export function Logo({ size = 36, wordmark = false }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="var(--accent)" />
        <path d="M10 46 24 24l8 11 6-8 16 19z" fill="#fff" opacity=".28" />
        <path d="M26 21v22l19-11z" fill="#fff" />
      </svg>
      {wordmark && (
        <b>
          Nepal<i>hub</i>
        </b>
      )}
    </span>
  );
}
