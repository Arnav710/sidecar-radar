import Link from "next/link";

/** Wordmark: a speech-bubble "sidecar" riding next to the name. */
export function Logo({ dark = false }: { dark?: boolean }) {
  const ink = dark ? "var(--color-paper)" : "var(--color-ink)";
  return (
    <Link href="/" className="group inline-flex items-center gap-2" aria-label="Sidecar home">
      <svg width="38" height="30" viewBox="0 0 38 30" aria-hidden="true" className="transition-transform group-hover:-rotate-6">
        <rect x="2" y="2" width="26" height="18" rx="9" fill="var(--color-lime)" stroke={ink} strokeWidth="2.5" />
        <path d="M10 19 L8 25 L15 19.5" fill="var(--color-lime)" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="31" cy="22" r="5" fill="var(--color-tangerine)" stroke={ink} strokeWidth="2.5" />
        <circle cx="10" cy="11" r="1.8" fill={ink} />
        <circle cx="15" cy="11" r="1.8" fill={ink} />
        <circle cx="20" cy="11" r="1.8" fill={ink} />
      </svg>
      <span className="font-display text-2xl font-extrabold tracking-tight" style={{ color: ink }}>
        sidecar
      </span>
    </Link>
  );
}
