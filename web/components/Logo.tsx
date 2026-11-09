import Link from "next/link";

/** Wordmark: a small rounded mark and the name. Pass `dark` on dark backgrounds. */
export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2" aria-label="Sidecar home">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect width="26" height="26" rx="7" fill="var(--color-accent)" />
        <path d="M7 9.5h9a3 3 0 0 1 0 6H9.5" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="19.5" cy="17.5" r="1.6" fill="white" />
      </svg>
      <span className={`text-[1.0625rem] font-semibold tracking-tight ${dark ? "text-white" : "text-ink"}`}>Sidecar</span>
    </Link>
  );
}
