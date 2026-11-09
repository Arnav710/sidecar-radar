import Link from "next/link";
import { Logo } from "@/components/Logo";
import { EMPTY_PROFILE, ProfileForm } from "@/components/ProfileForm";
import { currentUid } from "@/lib/identity";
import { getProfile } from "@/lib/profiles";
import { TOPIC_WORDS } from "@/lib/sources/classify";

export const dynamic = "force-dynamic";

export default async function Onboarding() {
  const existing = await getProfile(await currentUid());
  const initial = existing ?? EMPTY_PROFILE;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label="Sidecar home"><Logo /></Link>
      </header>
      <h1 className="mt-8 text-4xl font-extrabold sm:text-5xl">
        Tell Sidecar <span className="marker">about you</span>
      </h1>
      <p className="mt-3 max-w-xl text-lg text-ink-soft">
        About a minute. We use it to plan your day and to introduce you to people stuck on the same thing. Nothing here is shown to other attendees by name.
      </p>
      <div className="mt-8">
        <ProfileForm initial={initial} topics={TOPIC_WORDS} afterSave="/" />
      </div>
    </main>
  );
}
