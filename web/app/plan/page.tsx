import { redirect } from "next/navigation";
import { DEFAULT_CONFERENCE_ID } from "@/lib/conferences";

// Old address for the schedule; kept so earlier links still work.
export default function PlanRedirect() {
  redirect(`/c/${DEFAULT_CONFERENCE_ID}/schedule`);
}
