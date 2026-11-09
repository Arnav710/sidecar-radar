import Link from "next/link";
import type { Conference } from "@/lib/conferences";
import { IconBook, IconCalendar, IconHome, IconUser } from "./Icons";
import { Logo } from "./Logo";

export type ShellTab = "dashboard" | "schedule" | "notebook";

// The frame around every signed-in page: a sidebar on large screens and a
// bottom tab bar on phones. The conference switcher always goes back to the dashboard.
export function AppShell({ conf, active, children }: { conf?: Conference; active?: ShellTab; children: React.ReactNode }) {
  const items: Array<{ tab: ShellTab; label: string; href: string; icon: React.ReactNode }> = [
    { tab: "dashboard", label: "Dashboard", href: "/", icon: <IconHome /> },
    ...(conf
      ? [
          { tab: "schedule" as const, label: "Schedule", href: `/c/${conf.id}/schedule`, icon: <IconCalendar /> },
          { tab: "notebook" as const, label: "Notebook", href: `/c/${conf.id}/notebook`, icon: <IconBook /> },
        ]
      : []),
  ];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_1fr]">
      <aside className="hidden border-r border-line bg-surface lg:flex lg:flex-col" aria-label="Main navigation">
        <div className="px-5 pb-4 pt-5"><Logo /></div>

        {conf && (
          <Link href="/" className="mx-3 rounded-xl border border-line bg-paper px-3 py-2.5 transition-colors hover:border-line-strong" aria-label={`Conference: ${conf.name}. Switch conference`}>
            <span className="eyebrow block">Conference</span>
            <span className="mt-0.5 block truncate text-sm font-semibold">{conf.name}</span>
            <span className="block truncate text-xs text-ink-soft">{conf.city} · Switch</span>
          </Link>
        )}

        <nav className="mt-4 flex flex-col gap-0.5 px-3">
          {items.map((i) => (
            <Link
              key={i.tab}
              href={i.href}
              aria-current={active === i.tab ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active === i.tab ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-paper-2"}`}
            >
              {i.icon}
              {i.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-line p-3">
          <Link href="/onboarding" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-paper-2">
            <IconUser /> My profile
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
          <Logo />
          {conf && <Link href="/" className="max-w-[55%] truncate text-sm font-medium text-ink-soft">{conf.name}</Link>}
        </header>
        <div className="pb-24 lg:pb-12">{children}</div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur lg:hidden" aria-label="Main navigation">
        {items.map((i) => (
          <Link
            key={i.tab}
            href={i.href}
            aria-current={active === i.tab ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${active === i.tab ? "text-accent-ink" : "text-ink-soft"}`}
          >
            {i.icon}
            {i.label}
          </Link>
        ))}
        <Link href="/onboarding" className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium text-ink-soft">
          <IconUser /> Profile
        </Link>
      </nav>
    </div>
  );
}

/** The padded content column used inside the shell. */
export function Page({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <main className={`mx-auto px-4 pt-6 sm:px-8 sm:pt-10 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>{children}</main>;
}
