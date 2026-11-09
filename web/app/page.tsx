import Link from "next/link";
import { AppShell, Page } from "@/components/AppShell";
import { Landing } from "@/components/Landing";
import { dateLabel, untilLabel } from "@/components/format";
import { IconBook, IconCalendar, IconLink, IconPlus } from "@/components/Icons";
import { conferenceStatus, listConferences, type Conference } from "@/lib/conferences";
import { currentUid } from "@/lib/identity";
import { getProfile } from "@/lib/profiles";
import { getSchedule } from "@/lib/schedule";
import { sourceStatus } from "@/lib/sources";

export const dynamic = "force-dynamic";

const SOURCE_INFO = {
  luma: { name: "Luma", about: "Side events and meetups from calendars you follow" },
  slack: { name: "Slack", about: "Announcements from the conference channels" },
  x: { name: "X", about: "Posts about the conference" },
} as const;

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Denver" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

// The home screen: pick a conference. Visitors with no profile go to sign-up first.
export default async function Dashboard() {
  const uid = await currentUid();
  const profile = await getProfile(uid);
  // New visitors see the landing page first; its button leads to sign-up.
  if (!profile) return <Landing />;

  const now = new Date();
  const conferences = listConferences(now);
  const plannedCounts = await Promise.all(
    conferences.map(async (c) => ((await getSchedule(uid, c.id))?.blocks ?? []).filter((b) => b.kind !== "handoff").length),
  );

  return (
    <AppShell active="dashboard">
      <Page wide>
        <p className="eyebrow">Dashboard</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">{greeting()}, {profile.display_name.split(" ")[0]}</h1>
        <p className="mt-2 text-ink-soft">Choose a conference to see your schedule and notebook.</p>

        <h2 className="mt-10 text-lg">Your conferences</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {conferences.map((c, i) => <ConferenceCard key={c.id} conf={c} planned={plannedCounts[i]} now={now} />)}
          <div className="flex flex-col justify-center rounded-[14px] border border-dashed border-line-strong p-5 text-sm text-ink-soft">
            <p className="flex items-center gap-2 font-semibold text-ink-2"><IconPlus size={16} /> Add a conference</p>
            <p className="mt-1.5">Real conferences will come from Luma calendars. For now these are demo entries.</p>
          </div>
        </div>

        <h2 className="mt-12 text-lg">Connections</h2>
        <p className="mt-1 text-sm text-ink-soft">Where Sidecar looks for events beyond the main talk schedule.</p>
        <ul className="card mt-4 divide-y divide-line">
          {sourceStatus().map((s) => (
            <li key={s.source} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{SOURCE_INFO[s.source].name}</p>
                <p className="truncate text-sm text-ink-soft">{SOURCE_INFO[s.source].about}</p>
              </div>
              <span className={`pill shrink-0 ${s.configured ? "bg-good-soft text-good" : ""}`}>
                <IconLink size={13} /> {s.configured ? "Connected" : "Not connected"}
              </span>
            </li>
          ))}
        </ul>
      </Page>
    </AppShell>
  );
}

function ConferenceCard({ conf, planned, now }: { conf: Conference; planned: number; now: Date }) {
  const status = conferenceStatus(conf, now);
  const badge =
    status === "live" ? <span className="pill bg-good-soft text-good"><span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-good" /> Happening now</span>
    : status === "upcoming" ? <span className="pill">Starts in {untilLabel(Date.parse(conf.start) - now.getTime())}</span>
    : <span className="pill">Ended</span>;

  return (
    <article className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg">{conf.name}</h3>
        {badge}
      </div>
      <p className="mt-1.5 text-sm text-ink-soft">{conf.tagline}</p>
      <p className="mt-3 text-sm text-ink-2">{conf.venue} · {conf.city}</p>
      <p className="text-sm text-ink-soft">{dateLabel(conf.start)}{dateLabel(conf.end) !== dateLabel(conf.start) ? ` – ${dateLabel(conf.end)}` : ""}</p>
      <p className="mt-3 text-sm">{planned > 0 ? <span className="font-medium">{planned} {planned === 1 ? "session" : "sessions"} planned</span> : <span className="text-ink-soft">No schedule yet</span>}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/c/${conf.id}/schedule`} className="btn btn-primary"><IconCalendar size={16} /> Open schedule</Link>
        <Link href={`/c/${conf.id}/notebook`} className="btn"><IconBook size={16} /> Notebook</Link>
      </div>
    </article>
  );
}
