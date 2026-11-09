import { GOALS, LEVELS, PACES, type Goal, type Pace, type Profile, type ProfileInput, type SkillLevel } from "@sidecar/shared";
import { es, INDEX } from "./es";

// Profile storage and validation. Profile text is personal, so nothing in this
// file logs field values (Gitar rule 8): errors only say which field was wrong.

const MAX_TEXT = 600;
const MAX_TOPICS = 20;

type Parsed = { ok: true; value: ProfileInput } | { ok: false; error: string };

function text(v: unknown, max = MAX_TEXT): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Check a request body and turn it into a clean ProfileInput. */
export function parseProfileInput(body: unknown): Parsed {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Send a JSON object." };
  const b = body as Record<string, unknown>;

  const display_name = text(b.display_name, 80);
  if (!display_name) return { ok: false, error: "display_name is required." };

  const years = Number(b.years);
  if (!Number.isFinite(years) || years < 0 || years > 60) return { ok: false, error: "years must be a number from 0 to 60." };

  const goals = (Array.isArray(b.goals) ? b.goals : []).filter((g): g is Goal => (GOALS as readonly string[]).includes(g as string));
  if (goals.length === 0) return { ok: false, error: "Pick at least one goal." };

  const pace = (PACES as readonly string[]).includes(b.pace as string) ? (b.pace as Pace) : "balanced";

  const topic_levels: Record<string, SkillLevel> = {};
  if (typeof b.topic_levels === "object" && b.topic_levels !== null) {
    for (const [topic, level] of Object.entries(b.topic_levels as Record<string, unknown>).slice(0, MAX_TOPICS)) {
      const key = topic.trim().toLowerCase().slice(0, 40);
      if (key && (LEVELS as readonly string[]).includes(level as string)) topic_levels[key] = level as SkillLevel;
    }
  }

  return {
    ok: true,
    value: {
      display_name,
      role: text(b.role, 80),
      years: Math.round(years),
      company_type: text(b.company_type, 80),
      working_on: text(b.working_on),
      stuck_on: text(b.stuck_on),
      want_to_meet: text(b.want_to_meet),
      goals,
      topic_levels,
      pace,
      open_to_meet: b.open_to_meet !== false,
    },
  };
}

/** The saved profile for this browser, or null if they haven't made one (or ES isn't set up). */
export async function getProfile(uid: string): Promise<Profile | null> {
  if (!process.env.ES_URL) return null;
  try {
    const res = await es().get<Profile>({ index: INDEX.profiles, id: uid });
    return res._source ?? null;
  } catch {
    return null;
  }
}

export async function saveProfile(uid: string, input: ProfileInput): Promise<Profile> {
  const profile: Profile = { ...input, uid, updated_at: new Date().toISOString() };
  await es().index({ index: INDEX.profiles, id: uid, document: profile, refresh: "wait_for" });
  return profile;
}

/** A short description of the attendee for AI prompts, so answers fit them. Never logged. */
export function whoIs(p: Profile | null): string {
  if (!p) return "a conference attendee";
  const levels = Object.entries(p.topic_levels).map(([t, l]) => `${t}: ${l}`).join(", ");
  return [
    p.role && `${p.role}, ${p.years} years of experience`,
    p.working_on && `working on: ${p.working_on}`,
    p.stuck_on && `stuck on: ${p.stuck_on}`,
    levels && `levels: ${levels}`,
  ].filter(Boolean).join("; ") || "a conference attendee";
}

/** One block of text describing what this person wants, used to search talks and events by meaning. */
export function profileQueryText(p: Pick<Profile, "working_on" | "stuck_on" | "want_to_meet" | "topic_levels">): string {
  return [p.working_on, p.stuck_on, p.want_to_meet, Object.keys(p.topic_levels).join(" ")].filter(Boolean).join(". ");
}
