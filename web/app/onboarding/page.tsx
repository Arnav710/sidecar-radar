import { OnboardingFlow, SAMPLE_PROFILE } from "@/components/OnboardingFlow";
import { DEFAULT_CONFERENCE_ID } from "@/lib/conferences";
import { currentUid } from "@/lib/identity";
import { getProfile } from "@/lib/profiles";
import { TOPIC_WORDS } from "@/lib/sources/classify";

export const dynamic = "force-dynamic";

// Sign-up. New visitors get sample details filled in so testing is quick; people
// with a profile see their own, to edit.
export default async function Onboarding() {
  const existing = await getProfile(await currentUid());
  return <OnboardingFlow initial={existing ?? SAMPLE_PROFILE} isEdit={Boolean(existing)} conference={DEFAULT_CONFERENCE_ID} topics={TOPIC_WORDS} />;
}
