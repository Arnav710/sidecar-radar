"use client";

import { useState } from "react";
import { GOALS, LEVELS, PACES, type Goal, type Pace, type ProfileInput, type SkillLevel } from "@sidecar/shared";

const GOAL_LABEL: Record<Goal, string> = {
  solve_problem: "Solve a specific problem",
  learn: "Learn a new area",
  meet_peers: "Meet peers",
  hire: "Hire",
  find_job: "Find a job",
  evaluate_tools: "Evaluate tools",
};
const PACE_LABEL: Record<Pace, string> = { chill: "Chill (lots of free time)", balanced: "Balanced", packed: "Packed" };
const LEVEL_LABEL: Record<SkillLevel, string> = { new: "New to it", comfortable: "Comfortable", advanced: "Advanced" };

export const EMPTY_PROFILE: ProfileInput = {
  display_name: "", role: "", years: 3, company_type: "", working_on: "", stuck_on: "", want_to_meet: "",
  goals: [], topic_levels: {}, pace: "balanced", open_to_meet: true,
};

const field = "mt-1 w-full rounded-xl border-[2.5px] border-ink bg-white px-3 py-2 text-base";
const label = "block font-display text-sm font-bold";

export function ProfileForm({ initial, topics, afterSave }: { initial: ProfileInput; topics: string[]; afterSave: string }) {
  const [p, setP] = useState<ProfileInput>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => setP((prev) => ({ ...prev, [key]: value }));

  const toggleGoal = (g: Goal) => set("goals", p.goals.includes(g) ? p.goals.filter((x) => x !== g) : [...p.goals, g]);

  /** Click a topic to add it, click again to remove it. */
  const toggleTopic = (t: string) => {
    const next = { ...p.topic_levels };
    if (next[t]) delete next[t];
    else next[t] = "comfortable";
    set("topic_levels", next);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setMessage("");
    try {
      const res = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not save.");
      setState("saved");
    } catch (err) {
      setState("error");
      setMessage((err as Error).message);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="sticker space-y-4 p-5">
        <h2 className="text-xl font-extrabold">About you</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="display_name" className={label}>Name</label>
            <input id="display_name" required maxLength={80} className={field} value={p.display_name} onChange={(e) => set("display_name", e.target.value)} />
          </div>
          <div>
            <label htmlFor="role" className={label}>Role</label>
            <input id="role" maxLength={80} placeholder="Platform engineer" className={field} value={p.role} onChange={(e) => set("role", e.target.value)} />
          </div>
          <div>
            <label htmlFor="years" className={label}>Years of experience</label>
            <input id="years" type="number" min={0} max={60} className={field} value={p.years} onChange={(e) => set("years", Number(e.target.value))} />
          </div>
          <div>
            <label htmlFor="company_type" className={label}>Company</label>
            <input id="company_type" maxLength={80} placeholder="Startup, enterprise, student…" className={field} value={p.company_type} onChange={(e) => set("company_type", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="sticker space-y-4 bg-paper-2 p-5">
        <h2 className="text-xl font-extrabold">What you are here for</h2>
        <div>
          <label htmlFor="working_on" className={label}>What are you working on right now?</label>
          <textarea id="working_on" rows={2} maxLength={600} className={field} value={p.working_on} onChange={(e) => set("working_on", e.target.value)} />
        </div>
        <div>
          <label htmlFor="stuck_on" className={label}>What are you stuck on?</label>
          <textarea id="stuck_on" rows={2} maxLength={600} className={field} value={p.stuck_on} onChange={(e) => set("stuck_on", e.target.value)} />
        </div>
        <div>
          <label htmlFor="want_to_meet" className={label}>What kind of people do you want to meet?</label>
          <textarea id="want_to_meet" rows={2} maxLength={600} className={field} value={p.want_to_meet} onChange={(e) => set("want_to_meet", e.target.value)} />
        </div>
        <fieldset>
          <legend className={label}>Your goals for this conference (pick at least one)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <label key={g} className={`chip cursor-pointer text-sm ${p.goals.includes(g) ? "bg-lime" : "bg-white"}`}>
                <input type="checkbox" className="sr-only" checked={p.goals.includes(g)} onChange={() => toggleGoal(g)} />
                {GOAL_LABEL[g]}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="sticker space-y-4 p-5">
        <h2 className="text-xl font-extrabold">Topics and level</h2>
        <fieldset>
          <legend className={label}>Pick the topics you care about</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {topics.map((t) => (
              <label key={t} className={`chip cursor-pointer text-sm ${p.topic_levels[t] ? "bg-sky" : "bg-white"}`}>
                <input type="checkbox" className="sr-only" checked={Boolean(p.topic_levels[t])} onChange={() => toggleTopic(t)} />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
        {Object.keys(p.topic_levels).length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(p.topic_levels).map(([t, level]) => (
              <div key={t}>
                <label htmlFor={`level-${t}`} className={label}>{t}: your level</label>
                <select id={`level-${t}`} className={field} value={level} onChange={(e) => set("topic_levels", { ...p.topic_levels, [t]: e.target.value as SkillLevel })}>
                  {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="sticker space-y-4 p-5">
        <h2 className="text-xl font-extrabold">Your day</h2>
        <div>
          <label htmlFor="pace" className={label}>Pace</label>
          <select id="pace" className={field} value={p.pace} onChange={(e) => set("pace", e.target.value as Pace)}>
            {PACES.map((x) => <option key={x} value={x}>{PACE_LABEL[x]}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-3 font-display font-bold">
          <input type="checkbox" className="h-5 w-5 accent-tangerine" checked={p.open_to_meet} onChange={(e) => set("open_to_meet", e.target.checked)} />
          I am open to meeting people
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn bg-tangerine text-white" disabled={state === "saving" || p.goals.length === 0}>
          {state === "saving" ? "Saving…" : "Save my profile"}
        </button>
        {state === "saved" && (
          <p role="status" className="font-display font-bold">
            Saved. <a className="underline" href={afterSave}>Continue →</a>
          </p>
        )}
        {state === "error" && <p role="alert" className="font-bold text-tangerine">{message}</p>}
      </div>
    </form>
  );
}
