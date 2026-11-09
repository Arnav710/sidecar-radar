"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GOALS, LEVELS, PACES, type Goal, type Pace, type Plan, type ProfileInput, type SkillLevel, type SourceSyncResult } from "@sidecar/shared";
import { IconCheck } from "./Icons";
import { Logo } from "./Logo";

const GOAL_LABEL: Record<Goal, string> = {
  solve_problem: "Solve a specific problem",
  learn: "Learn a new area",
  meet_peers: "Meet peers",
  hire: "Hire",
  find_job: "Find a job",
  evaluate_tools: "Evaluate tools",
};
const PACE_LABEL: Record<Pace, string> = { chill: "Chill: lots of free time", balanced: "Balanced", packed: "Packed: see everything" };
const LEVEL_LABEL: Record<SkillLevel, string> = { new: "New to it", comfortable: "Comfortable", advanced: "Advanced" };

/** Sample details, filled in so testing doesn't mean typing the form every time. */
export const SAMPLE_PROFILE: ProfileInput = {
  display_name: "Alex Rivera",
  role: "Platform engineer",
  years: 6,
  company_type: "Mid-size SaaS company",
  working_on: "Cutting tracing costs in our Kubernetes observability stack",
  stuck_on: "Sampling traces without losing the interesting errors",
  want_to_meet: "SREs who have rolled out OpenTelemetry at scale",
  goals: ["solve_problem", "meet_peers"],
  topic_levels: { opentelemetry: "advanced", kubernetes: "comfortable", observability: "advanced" },
  pace: "balanced",
  open_to_meet: true,
};

type StepState = "waiting" | "working" | "done" | "failed";
const STEPS = ["Saving your profile", "Checking Luma, Slack and X for events", "Ranking talks and events for you", "Building your schedule"] as const;

export function OnboardingFlow({ initial, isEdit, conference, topics }: { initial: ProfileInput; isEdit: boolean; conference: string; topics: string[] }) {
  const router = useRouter();
  const [p, setP] = useState<ProfileInput>(initial);
  const [phase, setPhase] = useState<"form" | "building">("form");
  const [steps, setSteps] = useState<StepState[]>(STEPS.map(() => "waiting"));
  const [sources, setSources] = useState<SourceSyncResult[]>([]);
  const [error, setError] = useState("");

  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => setP((prev) => ({ ...prev, [key]: value }));
  const toggleGoal = (g: Goal) => set("goals", p.goals.includes(g) ? p.goals.filter((x) => x !== g) : [...p.goals, g]);
  const toggleTopic = (t: string) => {
    const next = { ...p.topic_levels };
    if (next[t]) delete next[t];
    else next[t] = "comfortable";
    set("topic_levels", next);
  };

  const mark = (i: number, s: StepState) => setSteps((prev) => prev.map((x, j) => (j === i ? s : x)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPhase("building");
    setSteps(STEPS.map(() => "waiting"));
    let step = 0;
    try {
      mark(0, "working");
      const saved = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
      if (!saved.ok) throw new Error(((await saved.json()) as { error?: string }).error ?? "Could not save your profile.");
      mark(0, "done");

      // Someone editing their profile keeps their schedule; use "Rebuild" on the schedule page to refresh it.
      if (isEdit) return router.push(`/c/${conference}/schedule`);

      step = 1;
      mark(1, "working");
      const sync = await fetch("/api/sources", { method: "POST" });
      if (sync.ok) setSources(((await sync.json()) as { results: SourceSyncResult[] }).results);
      mark(1, "done"); // a source being offline never stops the schedule

      step = 2;
      mark(2, "working");
      const planRes = await fetch(`/api/schedule/plan?conf=${conference}`);
      if (!planRes.ok) throw new Error("Could not build your schedule.");
      const plan = (await planRes.json()) as Plan;
      mark(2, "done");

      step = 3;
      mark(3, "working");
      const put = await fetch(`/api/schedule?conf=${conference}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ blocks: plan.blocks }) });
      if (!put.ok) throw new Error("Could not save your schedule.");
      mark(3, "done");
      router.push(`/c/${conference}/schedule`);
    } catch (err) {
      mark(step, "failed");
      setError((err as Error).message);
    }
  }

  if (phase === "building") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
        <Logo />
        <h1 className="mt-8 text-2xl">{isEdit ? "Saving your changes" : "Building your schedule"}</h1>
        <p className="mt-1 text-sm text-ink-soft">This takes a few seconds.</p>
        <ol className="mt-6 space-y-3" aria-live="polite">
          {(isEdit ? STEPS.slice(0, 1) : STEPS).map((label, i) => (
            <li key={label} className="flex items-start gap-3">
              <StepDot state={steps[i]} />
              <div className="min-w-0">
                <p className={`text-sm font-medium ${steps[i] === "waiting" ? "text-ink-soft" : ""}`}>{label}</p>
                {i === 1 && sources.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {sources.map((s) => (
                      <li key={s.source} className="chip">
                        <span className={`h-1.5 w-1.5 rounded-full ${s.status === "ok" ? "bg-good" : s.status === "error" ? "bg-bad" : "bg-line-strong"}`} />
                        {s.source === "x" ? "X" : s.source[0].toUpperCase() + s.source.slice(1)}:{" "}
                        {s.status === "ok" ? `${s.found} event${s.found === 1 ? "" : "s"}` : s.status === "skipped" ? "not connected" : "unavailable"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
        {error && (
          <div role="alert" className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm">
            <p className="font-medium text-bad">{error}</p>
            <button type="button" className="btn mt-3" onClick={() => setPhase("form")}>Back to the form</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[26rem_1fr]">
      {/* Same dark panel as the landing page, so "Get started" doesn't flash to white. */}
      <aside className="flex flex-col justify-between bg-ink px-6 pb-6 pt-8 text-paper [background-image:radial-gradient(rgba(255,246,230,0.07)_1px,transparent_1px)] [background-size:22px_22px] lg:sticky lg:top-0 lg:h-dvh lg:px-10 lg:py-12">
        <div>
          <Logo dark />
          <h1 className="mt-10 text-3xl leading-tight sm:text-4xl">{isEdit ? "Your profile" : "Make the conference yours"}</h1>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-paper/75">
            A minute of details lets Sidecar plan your day, answer questions in your terms, and introduce you to people stuck on the same thing.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-paper/85">
            {["A schedule picked for you, with the reason for every pick", "Answers pitched at your level", "Open slots kept free for meeting people"].map((t) => (
              <li key={t} className="flex gap-2.5"><IconCheck className="mt-0.5 shrink-0 text-lime" size={16} />{t}</li>
            ))}
          </ul>
        </div>
        <p className="mt-10 hidden text-xs text-paper/50 lg:block">Your details are only used to plan your day. They are never shown to other attendees by name.</p>
      </aside>

      <form onSubmit={submit} className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-16 pt-6 sm:px-8 lg:py-12">
        {!isEdit && (
          <p className="rounded-xl border border-line bg-accent-soft px-4 py-2.5 text-sm text-accent-ink">
            Sample details are filled in so you can try this quickly. Change anything you like.
          </p>
        )}

        <section className="card space-y-4 p-5">
          <h2 className="text-base">About you</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="display_name" className="label">Name</label>
              <input id="display_name" required maxLength={80} placeholder="Alex Rivera" className="input" value={p.display_name} onChange={(e) => set("display_name", e.target.value)} />
            </div>
            <div>
              <label htmlFor="role" className="label">Role</label>
              <input id="role" maxLength={80} placeholder="Platform engineer" className="input" value={p.role} onChange={(e) => set("role", e.target.value)} />
            </div>
            <div>
              <label htmlFor="years" className="label">Years of experience</label>
              <input id="years" type="number" min={0} max={60} className="input" value={p.years} onChange={(e) => set("years", Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor="company_type" className="label">Company</label>
              <input id="company_type" maxLength={80} placeholder="Startup, enterprise, student…" className="input" value={p.company_type} onChange={(e) => set("company_type", e.target.value)} />
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="text-base">What you are here for</h2>
          <div>
            <label htmlFor="working_on" className="label">What are you working on right now?</label>
            <textarea id="working_on" rows={2} maxLength={600} placeholder="The project or problem on your plate this month" className="input" value={p.working_on} onChange={(e) => set("working_on", e.target.value)} />
          </div>
          <div>
            <label htmlFor="stuck_on" className="label">What are you stuck on?</label>
            <textarea id="stuck_on" rows={2} maxLength={600} placeholder="The thing you would love an answer to" className="input" value={p.stuck_on} onChange={(e) => set("stuck_on", e.target.value)} />
          </div>
          <div>
            <label htmlFor="want_to_meet" className="label">Who do you want to meet?</label>
            <textarea id="want_to_meet" rows={2} maxLength={600} placeholder="The kind of people who would be worth a conversation" className="input" value={p.want_to_meet} onChange={(e) => set("want_to_meet", e.target.value)} />
          </div>
          <fieldset>
            <legend className="label">Your goals (pick at least one)</legend>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => <Toggle key={g} on={p.goals.includes(g)} onClick={() => toggleGoal(g)}>{GOAL_LABEL[g]}</Toggle>)}
            </div>
          </fieldset>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="text-base">Topics and your level</h2>
          <fieldset>
            <legend className="label">Pick the topics you care about</legend>
            <div className="flex flex-wrap gap-2">
              {topics.map((t) => <Toggle key={t} on={Boolean(p.topic_levels[t])} onClick={() => toggleTopic(t)}>{t}</Toggle>)}
            </div>
          </fieldset>
          {Object.keys(p.topic_levels).length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(p.topic_levels).map(([t, level]) => (
                <div key={t}>
                  <label htmlFor={`level-${t}`} className="label">{t}: your level</label>
                  <select id={`level-${t}`} className="input" value={level} onChange={(e) => set("topic_levels", { ...p.topic_levels, [t]: e.target.value as SkillLevel })}>
                    {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="text-base">Your day</h2>
          <div>
            <label htmlFor="pace" className="label">Pace</label>
            <select id="pace" className="input" value={p.pace} onChange={(e) => set("pace", e.target.value as Pace)}>
              {PACES.map((x) => <option key={x} value={x}>{PACE_LABEL[x]}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4 accent-accent" checked={p.open_to_meet} onChange={(e) => set("open_to_meet", e.target.checked)} />
            I am open to meeting people
          </label>
        </section>

        <div className="flex items-center gap-4">
          <button type="submit" className="btn btn-primary px-5 py-2.5" disabled={p.goals.length === 0 || !p.display_name.trim()}>
            {isEdit ? "Save changes" : "Build my schedule"}
          </button>
          {p.goals.length === 0 && <p className="text-sm text-ink-soft">Pick at least one goal.</p>}
        </div>
      </form>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${on ? "border-accent bg-accent-soft text-accent-ink" : "border-line-strong bg-surface text-ink-2 hover:bg-paper"}`}
    >
      {children}
    </button>
  );
}

function StepDot({ state }: { state: StepState }) {
  if (state === "done") return <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-good text-white"><IconCheck size={13} /></span>;
  if (state === "failed") return <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-bad text-xs font-bold text-white">!</span>;
  if (state === "working") return <span className="mt-0.5 h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-label="In progress" />;
  return <span className="mt-0.5 h-5 w-5 rounded-full border-2 border-line-strong" />;
}
