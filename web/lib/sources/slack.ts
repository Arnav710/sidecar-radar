import type { Chatter } from "./chatter";

// Slack: read recent messages from the conference's channels with a bot token.
// Needs SLACK_BOT_TOKEN (a bot with the channels:history scope, added to those
// channels) and SLACK_CHANNEL_IDS (comma separated, like C0123456789).
// There is also a Slack MCP server (https://mcp.slack.com/mcp) for use from a
// coding agent; the app itself talks to Slack's Web API directly.

export const slackConfigured = () => Boolean(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_IDS?.trim());

interface SlackMessage {
  ts: string;
  text?: string;
  subtype?: string;
  bot_id?: string;
}

export async function fetchSlackMessages(): Promise<Chatter[]> {
  const channels = (process.env.SLACK_CHANNEL_IDS ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  const out: Chatter[] = [];

  for (const channel of channels) {
    const res = await fetch(`https://slack.com/api/conversations.history?channel=${encodeURIComponent(channel)}&limit=100`, {
      headers: { authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as { ok: boolean; error?: string; messages?: SlackMessage[] };
    if (!body.ok) throw new Error(`Slack said: ${body.error ?? res.status}.`);

    for (const msg of body.messages ?? []) {
      // Skip joins, bot posts and empty messages.
      if (msg.subtype || msg.bot_id || !msg.text?.trim()) continue;
      out.push({
        source: "slack",
        id: `${channel}-${msg.ts}`,
        text: msg.text,
        createdAt: new Date(Number(msg.ts) * 1000).toISOString(),
      });
    }
  }
  return out;
}
