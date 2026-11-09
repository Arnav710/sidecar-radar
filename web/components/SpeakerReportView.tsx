import type { SpeakerReport } from "@sidecar/shared";
import { roomLabel, timeLabel } from "./format";

// The speaker's view of their own talk. Everything on this page is a count:
// no names, no ids, no question text, and nothing from fewer than
// `min_people` people (review rule 11). The withheld minutes are still drawn,
// greyed out, so the speaker can see that the gap is a privacy floor rather
// than silence from the room.

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="sticker flex min-w-0 flex-col gap-1 p-4" style={tone ? { background: tone } : undefined}>
      <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">{label}</span>
      <span className="font-display text-3xl font-extrabold tabular-nums">{value}</span>
    </div>
  );
}

export function SpeakerReportView({ report }: { report: SpeakerReport }) {
  const { talk, timeline, clusters, spikes, totals } = report;
  const peak = Math.max(1, ...timeline.map((b) => b.lost + b.got_it + b.questions));
  const thin = timeline.filter((b) => b.withheld).length;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-soft">Speaker hub · only you have this link</p>
        <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl">{talk.title}</h1>
        <p className="text-ink-soft">
          {talk.speaker} · {roomLabel(talk.room_id)} · {timeLabel(talk.start)}–{timeLabel(talk.end)}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="People" value={report.people} />
        <Stat label="Questions" value={totals.questions} tone="var(--color-sky)" />
        <Stat label="I'm lost" value={totals.lost} tone="var(--color-tangerine)" />
        <Stat label="Got it" value={totals.got_it} tone="var(--color-lime)" />
      </section>

      {report.summary ? (
        <section className="sticker flex flex-col gap-3 bg-sun/40 p-6">
          <h2 className="font-display text-2xl font-extrabold">What your room is telling you</h2>
          {report.summary.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="whitespace-pre-line">
              {para}
            </p>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl font-extrabold">Confusion timeline</h2>
          <p className="text-sm text-ink-soft">
            Minute by minute into the talk. Taller means more people reacting. A minute with fewer than{" "}
            {report.min_people} people behind it is withheld, so nobody can be picked out of a quiet room.
          </p>
        </div>

        {timeline.length === 0 ? (
          <p className="sticker p-6 text-ink-soft">
            Nothing yet. As soon as people start asking questions or tapping “I’m lost”, this fills in.
          </p>
        ) : (
          <div className="sticker overflow-x-auto p-4">
            <table className="w-full min-w-[30rem] border-collapse">
              <caption className="pb-3 text-left font-mono text-xs uppercase tracking-wider text-ink-soft">
                Reactions per minute
              </caption>
              <thead>
                <tr className="text-left font-mono text-xs uppercase tracking-wider text-ink-soft">
                  <th scope="col" className="w-16 pb-2">
                    Min
                  </th>
                  <th scope="col" className="pb-2">
                    Reactions
                  </th>
                  <th scope="col" className="w-40 pb-2">
                    Counts
                  </th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((b) => {
                  const total = b.lost + b.got_it + b.questions;
                  return (
                    <tr key={b.minute} className="border-t border-ink/15">
                      <td className="py-2 font-mono tabular-nums">{b.minute}</td>
                      <td className="py-2">
                        {b.withheld ? (
                          <span className="font-mono text-xs text-ink-soft">withheld · under {report.min_people} people</span>
                        ) : (
                          <span className="flex h-5 items-stretch gap-[2px]" aria-hidden="true">
                            <span style={{ width: `${(b.lost / peak) * 100}%`, background: "var(--color-tangerine)" }} />
                            <span style={{ width: `${(b.questions / peak) * 100}%`, background: "var(--color-sky)" }} />
                            <span style={{ width: `${(b.got_it / peak) * 100}%`, background: "var(--color-lime)" }} />
                          </span>
                        )}
                      </td>
                      <td className="py-2 font-mono text-xs tabular-nums">
                        {b.withheld ? "—" : `${b.lost} lost · ${b.questions} asked · ${b.got_it} got it`}
                        <span className="sr-only">{b.withheld ? "" : `, ${total} reactions in total`}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 flex flex-wrap gap-3 font-mono text-xs text-ink-soft">
              <span className="chip" style={{ background: "var(--color-tangerine)", color: "white" }}>
                I&apos;m lost
              </span>
              <span className="chip" style={{ background: "var(--color-sky)" }}>
                questions
              </span>
              <span className="chip" style={{ background: "var(--color-lime)" }}>
                got it
              </span>
              {thin > 0 ? <span className="self-center">{thin} minute(s) withheld for privacy</span> : null}
            </p>
          </div>
        )}
      </section>

      {spikes.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-2xl font-extrabold">The moments people lost you</h2>
            <p className="text-sm text-ink-soft">What you were saying when the “I’m lost” taps came in.</p>
          </div>
          <div className="flex flex-col gap-3">
            {spikes.map((s) => (
              <article key={s.minute} className="sticker flex flex-col gap-2 p-5">
                <p className="font-display text-lg font-bold">
                  Minute {s.minute} · {s.lost} taps
                </p>
                {s.said.length ? (
                  <blockquote className="border-l-4 border-tangerine pl-3 text-ink-soft">
                    {s.said.join(" ")}
                  </blockquote>
                ) : (
                  <p className="text-sm text-ink-soft">No transcript was captured for that minute.</p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl font-extrabold">What they asked about</h2>
          <p className="text-sm text-ink-soft">
            Themes, never the questions themselves. A theme appears once {report.min_people} different people have
            asked about it.
          </p>
        </div>
        {clusters.length === 0 ? (
          <p className="sticker p-6 text-ink-soft">
            No theme has reached {report.min_people} people yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {clusters.map((c) => (
              <li key={c.topic} className="sticker flex items-center justify-between gap-4 p-4">
                <span className="font-display text-lg font-bold">{c.topic}</span>
                <span className="font-mono text-xs tabular-nums text-ink-soft">
                  {c.questions} questions · {c.people} people
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
