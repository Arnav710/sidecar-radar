# Sidecar: build plan

**One line:** Ask the talk anything. Your questions find the right talks, the right recordings and the right people, and Sidecar books the meeting.

**The core promise: every introduction comes with the conversation already started.** The most valuable part of a conference is talking to people, but many attendees are introverts, don't know how to open, and end up in forgettable "so what do you do?" chats. Sidecar introduces you to people *because* you share a real problem, so you never start from zero: you already know what to talk about, why it matters to both of you, and what each of you can offer.

> Technical design: [ARCHITECTURE.md](ARCHITECTURE.md).

**Team:** 3 people.

---

## 1. The hero loop (what the demo is about)

One loop, end to end. Everything else in the app supports it. **Build this first, even if it's ugly; polish comes after it works.**

| Step | What happens | Who sees it |
|---|---|---|
| **1. Join a talk** | Scan the room's QR code. Display name, an optional "what I'm working on right now" line, and an open-to-meet toggle. No account. | Attendee |
| **2. Live** | Live captions of what the speaker is saying. **Ask privately** at any moment. One tap **"I'm lost"** or **"Got it"**. | Attendee |
| **3. The answer points somewhere useful** | The answer quotes what the speaker just said (with its timestamp), then points to a **past session recording** that goes deeper and a **future session** at this conference (one tap: add to schedule). This is "where to go next" for every question. | Attendee |
| **4. Match** | Your applied questions plus your schedule find people stuck on the same problem. You see a **blind card**: the shared problem, the talks you both picked, why you matched. No names. | Attendee |
| **5. Mutual accept** | Both people get a notification. If both tap "want to meet", names are revealed together with the **conversation kit** (§3). | Both attendees |
| **6. Book the meeting** | Sidecar finds the **first free slot in both schedules** and the **closest meeting spot** to both people's next rooms, shown on the venue map: *"11:35, Coffee bar Hall B: 2 min from your next talk, 3 min from theirs."* Both accept → it's on both schedules. | Both attendees |
| **7. Speaker report** | The **confusion timeline** (lost / got-it taps and questions per minute, with the transcript at each spike), questions clustered by theme, and an AI report on what to explain better next time. | Speaker |

**Supporting features** (shown briefly so it feels like a complete product, built only after the loop works):
- Search talks in plain English, "recommended for you" from your questions, add to My Schedule.
- "Explain the last 30 seconds" when you tap I'm lost.
- Cross-room alerts: "Room B is talking about your topic right now" (Elasticsearch percolator).
- Personal recap: talks attended, answers, people met and why.

---

## 2. Design decisions

### 2a. Which questions count for matching
Every question gets one cheap LLM call that classifies it and extracts a **topic** and the **underlying problem**:
- `definition` ("what is X?"): answered, **not used for matching**
- `applied` ("how do I do X in my setup?"): **used for matching**
- `experience` ("has anyone run this at scale?"): **strong matching signal**

Two people asking "what is cardinality?" is not a reason to meet. Two people asking how to sample traces without losing errors is.

### 2b. Match score (kept simple so we can explain every number)
```
score = 0.6 × similarity(my applied/experience questions, theirs)
      + 0.3 × schedule overlap, rarity-weighted
      + 0.1 × similarity(my "working on", theirs)    (only when both filled it in)
```
- **Questions weigh most** because a question is live evidence of what someone is stuck on today.
- **Rarity-weighted overlap:** sharing a niche talk counts far more than sharing the keynote: `log(total attendees / attendees on that talk)`, summed over shared talks. In ES: a `terms` query on schedule talk ids plus a per-talk count aggregation.
- "I'm lost" at the same moment is a weak bonus only; it never creates a match on its own.
- A card is shown when the score passes a threshold **and** there's at least one shared applied/experience question, or strong schedule overlap. Labels: **"Same problem"** (from questions, ranked first) and **"Same interests"** (schedule only, called *schedule twins*).

### 2c. Blind profiles and privacy
- **Blind card:** the shared problem ("reducing tracing costs"), the talks you both picked, and the "working on" line. **Never the exact question text.**
- After mutual accept: display names and the conversation kit.
- Matching is opt-in (the open-to-meet toggle).
- No GitHub scraping, no LinkedIn, no dwell-time tracking.
- We never log transcript or question text.
- Seeded demo attendees are clearly labelled as demo data.

### 2d. Booking the meeting
1. **When:** the first gap of at least 15 minutes where both schedules are free, from now, within conference hours. All times stored in UTC, shown in venue local time (America/Denver).
2. **Where:** the meeting spot closest to the midpoint of both people's next rooms. Spots and rooms are stored with `geo_point` on a local grid, sorted with `geo_distance`.
3. Shown on the venue map with a pin. Both accept → a meetup block on both schedules.

### 2e. Live transcription
- **One device per room** (the speaker or room laptop) records ~5-second audio chunks and uploads them.
- Each chunk goes to OpenAI transcription, then into the `transcripts` index with its offset.
- Attendee phones poll for new caption lines.
- **Honest target:** caption lag p95 under 12 seconds (5 s chunk + transcription + indexing). A 3-second target is not reachable with 5-second chunks and would burn red during the demo.
- **Fallbacks:** browser Web Speech API on the room laptop, and `replay-room.ts` playing a recorded transcript into Room B (also used for the cross-room alert in the demo).
- We only transcribe talks whose speaker presses Start (our own demo talks). We never record real KubeCon talks.

### 2f. Answers and "where to go next"
1. Hybrid search over this talk's transcript, boosting the last ~5 minutes; then across all transcripts.
2. Search the talks catalog for **past sessions with a public recording** (`video_url`, e.g. the CNCF YouTube channel) and **upcoming sessions** (`start > now`).
3. One LLM call writes the answer, citing the transcript timestamp, the recording and the upcoming talk.

Answers link to a recording, not to an exact minute inside it: we don't have transcripts of past recordings.

### 2g. Speaker report
- Lost / got-it taps and questions per minute: a `histogram` aggregation on `offset_s`.
- Clusters: the topic field from the question classifier, `terms` aggregation.
- The transcript at each spike: "minute 14: 9 questions right after you said 'tail-based sampling'."
- One LLM call writes "what landed / where people got lost / what to change next time".
- **Privacy:** never show who asked; hide any cluster or bucket with fewer than 3 people.

### 2h. Notifications
In-app only. Pages poll for match requests, accepts and meetup cards. No websockets or push notifications needed.

---

## 3. The conversation kit (what every mutual match reveals)

When a match is mutual, both people get the same kit, so starting is effortless:
- **Why you two:** "You're both trying to cut tracing costs without losing error traces."
- **Your opener:** one natural first line ("I saw you asked about tail sampling too. Did you try it in the collector yet?")
- **Two follow-up questions** drawn from what each of you asked
- **What each of you brings,** from the "working on" lines
- **Where and when:** the booked meetup (§2d)

This is the promise in practice: the conversation is already started. It also helps the 34% of attendees who cite lack of confidence as the main reason they don't network more.

---

## 4. How each sponsor track is used

| Track | How it's genuinely used |
|---|---|
| **Elasticsearch** (the core) | The only data store. Hybrid search (BM25 + `semantic_text`, merged with RRF) over live transcripts and talks; semantic similarity between questions for matching; rarity-weighted schedule overlap; `geo_distance` for meeting spots; `histogram` / `terms` aggregations for the speaker report; percolator for cross-room alerts. |
| **Dash0** | OpenTelemetry traces from browser → web → worker → OpenAI → ES; structured logs with trace IDs; custom metrics; RUM on the frontend. SLOs: **caption lag p95 < 12 s**, **answer latency p95 < 6 s**, API availability 99%. Agent0 or the MCP server used on a real problem found during the day. |
| **Radar** | Web and worker deployed through Radar's starter (git push → Argo CD) on cluster `sidecar`. Radar's MCP used to ship and check every rollout. Checks before and after. An AI investigation on a real issue, or an all-clear investigation after a release, which also counts. **We don't break things on purpose.** |
| **Gitar** | Every feature lands as its own PR. Project-specific review rules in `.gitar/review/` (privacy, traced calls, opt-in matching, speaker anonymity, time zones, types in sync, accessible UI). Repository rule for mapping/type drift. Auto-apply fixing a real CI failure. |
| **Merge Forward** | Live captions, private questions, one-tap "I'm lost" with a simplified explanation, and blind opt-in introductions that come with a conversation kit. |

---

## 5. Demo storyline (3 minutes)

Setup is shown as already done; we don't rebuild it live.

1. **Hook.** Quote the stat exactly as the source states it: 52% of attendees say meeting professionals who face similar challenges is the most important factor (MPI). Then: "Job titles don't tell you who to meet. The question you just asked does."
2. **Our pitch is the talk.** Judges scan the QR code; live captions of what we're saying appear on their phones.
3. **A judge asks a question.** The answer quotes what we said seconds ago, links a past recording that goes deeper and an upcoming talk (added to their schedule in one tap).
4. **The match.** A blind card: shared problem, shared talks, why. A teammate's phone, playing the other attendee, gets the notification. Both accept. Names and the conversation kit appear, then the **meetup on the venue map**: first shared free slot plus the nearest spot.
5. **Speaker report.** The confusion timeline and clustered questions from this very session.
6. **Everything else, quickly.** The cross-room alert from Room B, search and schedule, the recap.
7. **Under the hood.** The ES queries behind the match; the Dash0 trace of one question across both services and the SLO dashboard; Radar's timeline and investigation; Gitar PRs with a real review catch.

**Safety net:** clearly labelled seeded attendees and questions, the Room B replay, and a backup screen recording.

---

## 6. Who does what

| Person A: Live talk | Person B: Data and intelligence | Person C: Platform and product shell |
|---|---|---|
| Room page with audio capture, transcription, captions, ask box, I'm lost / Got it, explain-the-last-30-seconds, Room B replay, speaker report view | ES mappings and seed data (talks with recordings, venue, demo attendees), ask API with where-to-go-next, question classifier, matcher, meetup finder, conversation kit, speaker report data | Scaffold and deploy through Radar, OTel and RUM into Dash0, CI and Gitar, join page, schedule page, blind cards and notifications, venue map, Dash0 dashboard and SLOs |

**All together at the end:** README (setup, architecture, AI disclosure, per-track section), `EVIDENCE.md` screenshots, demo rehearsal, backup recording, submit.

**Rules for the team:**
- **Every feature = its own branch + PR through Gitar.** No direct pushes to main (the deploy bot's `deploy:` commits are the only exception).
- **OTel from the first commit**, not added at the end.
- **Deploy to the Radar cluster early**, so Radar is used all day.
- Never log question or transcript text.
- Record every sponsor-tool moment in `EVIDENCE.md` as it happens.

---

## 7. Build order (by priority; stop wherever time runs out)

1. Scaffold deployed through Radar, OpenTelemetry wired, CI and Gitar rules in place.
2. ES mappings and seed data: talks (past with recordings, upcoming), venue, demo attendees with schedules and questions.
3. Live transcription → captions.
4. Ask: grounded answer + past recording + upcoming talk.
5. Question classifier and matcher; blind cards; mutual accept with notifications.
6. Meetup booking (shared free slot + nearest spot on the venue map) and the conversation kit.
7. I'm lost / Got it taps and the speaker report.
8. Supporting features: explain-the-last-30-seconds, cross-room alerts with the Room B replay, search and recommendations, recap.

## 8. Cut list (cut from the top)

1. Recap
2. Cross-room alerts
3. Explain-the-last-30-seconds
4. "Same interests" (schedule-only) matches → "Same problem" only
5. Venue map drawing → the meetup card text only (keep the geo query)
6. **Never cut:** live captions, ask with useful pointers, blind match with mutual accept, meetup booking, speaker report

## 9. Later, not today

Good ideas from earlier versions that don't serve the hero loop. Build none of them today.
- "Apply to my work" with a drafted GitHub issue
- Ask the speaker later (queued questions the speaker answers after the talk)
- Shareable "what I got" page for your manager
- Smart day planner with goal / level / pace ranking
- Multi-conference dashboard and side-event suggestions
- Behavior-based personalization (dwell time, ignored alerts, `significant_terms` "people like you")
- Memory nudges

## 10. Open questions for the team

1. **Seed talks:** real public KubeCon schedule and CNCF YouTube recordings, or ~30 realistic talks we write? Real is more convincing; check terms first.
2. **Venue map:** a real public floor plan, or our own simple map stated openly?
3. **Demo roles:** who presents, who drives the laptop, who holds the "other attendee" phone?

## 11. Decisions log

- Theme is conferences in general; KubeCon is the setting and the demo example. Name: **Sidecar**.
- Hero = one loop: ask → useful pointers (past recording, upcoming talk) → match on questions + schedule → mutual accept with a conversation kit → booked meetup → speaker report.
- Matching never uses definition questions alone; blind profiles with mutual reveal.
- Schedule overlap is rarity-weighted (schedule twins).
- Live transcription is in scope, with Web Speech and replay fallbacks.
- Two services (web + worker), Elastic Cloud outside the cluster.
- No GitHub scraping or LinkedIn; earlier v2 extras moved to "Later, not today".
- Honest SLOs: caption lag p95 < 12 s, answer p95 < 6 s.
- No breaking things on purpose for the Radar or Dash0 stories.
