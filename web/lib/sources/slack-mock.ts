import type { Chatter } from "./chatter";

// Realistic sample Slack messages, timestamped relative to "now", for demos and
// local dev when no real Slack workspace is connected (SLACK_MOCK=1).

const MOCK_MESSAGES = [
  { minutesAgo: 20, text: "OpenTelemetry meetup tonight at 7pm, Publik Space on W Temple. Free pizza and beer, come talk tracing with us!" },
  { minutesAgo: 45, text: "Reminder: GitOps workshop with Kargo and Argo CD starts in Room B at 4pm today" },
  { minutesAgo: 70, text: "anyone know if there's a charger I can borrow near the main stage?" },
  { minutesAgo: 95, text: "Kubernetes contributor meetup tomorrow 9am at the Clark Planetarium, coffee provided" },
  { minutesAgo: 110, text: "note to self check out the eBPF security talk recording later" },
  { minutesAgo: 140, text: "Hallway track: anyone else stuck on tail sampling memory limits? Let's grab coffee and compare notes, 3pm near Room B" },
  { minutesAgo: 170, text: "After-party tonight 8pm at House of Kube, RSVP on Luma if you haven't" },
  { minutesAgo: 200, text: "does anyone have the slides from the platform engineering talk?" },
];

export function fetchSlackMessagesMock(): Chatter[] {
  const now = Date.now();
  return MOCK_MESSAGES.map((m, i) => ({
    source: "slack" as const,
    id: `mock-${i}`,
    text: m.text,
    createdAt: new Date(now - m.minutesAgo * 60_000).toISOString(),
  }));
}
