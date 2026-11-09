import { NextResponse } from "next/server";
import { UID_COOKIE } from "@/lib/identity";
import { chooseTalk } from "@/lib/schedule";
import { getTalk } from "@/lib/talks";

export const dynamic = "force-dynamic";

/**
 * What a talk's QR code opens. It adds the talk to the attendee's schedule
 * (replacing anything it overlaps) and goes straight into the session.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const talk = await getTalk(id);
  if (!talk) return NextResponse.redirect(new URL("/", req.url));

  // Someone scanning before they ever opened the app has no id yet: make one here,
  // so the schedule is saved under it rather than under "anonymous".
  const existing = req.headers.get("cookie")?.match(new RegExp(`${UID_COOKIE}=([^;]+)`))?.[1];
  const uid = existing ?? crypto.randomUUID();
  try {
    await chooseTalk(uid, talk.conference_id, talk);
  } catch {
    // Still let them into the talk if the schedule could not be saved.
  }

  const res = NextResponse.redirect(new URL(`/talk/${talk.id}`, req.url));
  if (!existing) {
    res.cookies.set(UID_COOKIE, uid, { httpOnly: true, sameSite: "lax", secure: new URL(req.url).protocol === "https:", maxAge: 60 * 60 * 24 * 30, path: "/" });
  }
  return res;
}
