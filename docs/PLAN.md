# Sidecar: build plan

**One line:** Ask the talk anything, live. The people stuck on the same thing become your hallway track.

**The core promise: every introduction comes with the conversation already started.** The most valuable part of a conference is talking to people, but many attendees are introverts, don't know how to open, and end up in forgettable "so what do you do?" chats. Sidecar introduces you to people *because* you share a real problem, so you never start from zero: you already know what to talk about, why it matters to both of you, and what each of you can offer. Easier to start, more valuable, more memorable. Every networking feature below (matching, blind profiles, schedule twins, meetups) exists to serve this promise.

> Technical design: [ARCHITECTURE.md](ARCHITECTURE.md).

**Team:** 3 people. **Build:** ~12:15 → 3:15 (3h). **Demo prep:** 3:15 → 5:00. **Hard deadline:** 5:30 PM MT (we target 5:00).

---

## 1. The product, end to end (a complete journey, not a feature)

| Phase | What the attendee does | Role in the demo |
|---|---|---|
| **0. Onboard** | 60-second profile: name, role, years, company type, **"what I'm working on right now"**, **"what I want to get out of this conference"**, open-to-meet toggle | Supporting (10s) |
| **1. Before: My Schedule** | Search talks in plain English ("cutting observability costs"), see "recommended for you" (from the profile), add to My Schedule. Every talk has a QR code / join link | Supporting (10s) |
| **2. During: Live Talk** ⭐ | Scan QR → live captions → **ask anything privately**, answered from what the speaker just said → **"Apply to my work"** on any moment → follow a topic → **"Where to go next"** for your question (a later talk, another conference) | **HERO** |
| **3. Connect** ⭐ | **Blind profiles** of people stuck on the same problem, plus **schedule twins** → mutual "want to meet" → **smart meetup: place + time on the venue map, from both schedules** → both accept → it's on both schedules | **HERO** |
| **4. Across rooms** | "Room B is talking about your topic right now" alerts; answers that cite other talks | Wow moment (10s) |
| **5. After: Takeaway engine** | Not a summary: **GitHub issues drafted for your repo**, **ask the speaker later**, **follow-ups with context**, a **shareable "what I got" page** for your manager | Payoff (15s) |
| **6. Speaker feedback hub** | After the conference: **every question asked, anonymous and clustered**, confusion timeline, audience mix, AI suggestions for next time, answer queued questions | Flash (10s) |
| **Add-ons** | Multi-conference dashboard (Luma etc.), side-event suggestions, personalization upgrades | Only if time (see §9) |

Phases 0–1 are small in the demo, but they're **smart**: they create the personal profile that everything else (schedule, matching, alerts, recap) uses.

---

## 1b. The opening experience, screen by screen

### Screen 1: "Tell Sidecar about you" (≈60 seconds)
| Field | Why it matters |
|---|---|
| Name, role, years of experience, company type/size | Blind-profile card + matching |
| **GitHub username (optional)** → we read public repos, languages, topics, READMEs and write a 2-line "what you build" summary you can edit | Instant, real personalization with no typing |
| **"What are you working on / stuck on right now?"** (free text) | The strongest signal for talks *and* people |
| **Why are you here?** pick 1–2: *Solve a specific problem · Learn a new area · Meet peers · Hire · Find a job · Evaluate tools* | Changes how the schedule is ranked (below) |
| **Level** per topic chip (e.g. Kubernetes: advanced, eBPF: new to it) | Avoids too-basic / too-advanced talks |
| **Pace:** Chill · Balanced · Packed | How many slots to leave open (veterans' advice: leave ~50% free) |
| Open to meet people? (on/off) | Privacy |

### Screen 2: "Your day, planned" (the smart scheduler)
One tap, **Plan my day**, builds a full schedule. Every pick shows *why*:
> **10:30 · OTel at Scale (Room B)** ✅
> *Matches what you're stuck on: "cutting tracing costs" · Advanced, your level · 14 people with similar problems are going*
> ↔ 2 alternatives in this slot · ✕ remove

What makes it smart (not just "search and add"):
1. **Relevance to *you*:** each talk's abstract is matched by meaning against your "working on" + GitHub summary + goals.
2. **Goal-aware ranking:**
   - *Solve a problem*: talks closest to your problem, even if the title doesn't say it.
   - *Learn*: beginner/intro talks in your "new to it" topics.
   - *Meet peers / Hire / Job*: favors talks where **many people like you** are going (from the schedule graph), plus hallway breaks after them.
   - *Evaluate tools*: favors sponsor/vendor talks and adds booth time.
3. **Level fit:** down-ranks talks below or far above your level.
4. **Variety:** doesn't stack four talks on the same topic (each pick lowers the score of very similar talks).
5. **Pace:** leaves open blocks for the hallway track, labeled ("☕ Free: 3 of your matches are free now too").
6. **Clashes resolved for you:** two great talks at the same time → it picks one for you live, and the other gets **"📼 Catch it in Sidecar"**. Because every room is transcribed, you can read and *ask that talk questions* later. This ties the scheduler to the hero feature.
7. **Social proof from the schedule graph:** "14 people with similar problems are going", "People like you also added…".
8. **Re-plans as you go:** the afternoon re-ranks from what you asked and starred this morning.

### Screen 3: Talk page (from schedule or QR)
Title, room, time, speaker, level, **"Why this is for you"**, **"Who's going: 6 people share your problem (blind)"**, and a **Join live** button that opens the Live Talk page (the hero).

### Build scope for the scheduler (Person B builds the ranking query ~45 min, Person C builds the screens ~45 min)
- **Must:** onboarding form (GitHub optional), Plan my day with "why" lines, swap alternatives, clash → "Catch it in Sidecar", talk page.
- **Stretch:** re-plan as you go, booth time for *Evaluate tools*.

---

## 1c. Personalization in Elasticsearch (more than just questions)

Everything you do updates **one interest profile** per person, and every ranking reads from it.

### Signals we collect
| Signal | Strength | Source |
|---|---|---|
| "Working on / stuck on" text + GitHub summary | Strong (explicit) | Onboarding |
| Goals, levels, pace | Strong (explicit) | Onboarding |
| Talks added / removed / swapped | Medium (removal = negative) | Scheduler |
| Talk pages opened, dwell time in a live talk | Weak → medium | Activity |
| ⭐ starred moments (the transcript text) | Strong | Live Talk |
| Applied/experience questions (+ extracted topic and problem) | Strongest | Live Talk |
| Topics followed, alerts opened vs ignored | Medium | Cross-room |
| Matches accepted / ignored | Medium (who you actually want to meet) | Connect |

### How it's stored (`profiles` index)
- `working_on`, `github_summary`, `goals_text`: **`semantic_text`** (meaning-based, embeddings handled by ES)
- `interest_topics`: `{topic: weight}`, recomputed from the `activity` index with a **terms aggregation, newer actions weighted higher**. Example: starred 3 eBPF moments today → eBPF weight goes up.
- `negative_topics`: from removed talks and ignored alerts
- `levels`, `goals`, `pace`

### How ES uses it (the "smart use of search" the judges score)
1. **Talk ranking = hybrid search + boosts:** a semantic query on talk abstracts using your profile text, **combined (RRF) with** keyword search on your top interest topics, then **`function_score`** boosts for level fit and goal type and a penalty for negative topics. Filtered by time slot.
2. **"People like you also added…":** a **`significant_terms` aggregation** over the schedules of your closest matches finds talks *unusually* popular among people like you (not just popular overall). Real collaborative filtering, natively in ES.
3. **"More like this":** a `more_like_this` query on the moments you starred finds related moments in *other* talks ("📼 Catch it in Sidecar" picks).
4. **Matching** reuses the same profile fields (see 2a).
5. **Recap** ties takeaways back to `working_on`.

**The one-line pitch:** *Every tap teaches Sidecar what you care about, and every screen (your schedule, your alerts, your matches, your recap) gets smarter from it.*

---

## 1c+. The conversation kit (what every match reveals)
When a match is mutual, both people get the same **conversation kit**, so starting is effortless:
- **Why you two:** "You're both trying to cut tracing costs without losing error traces."
- **Your opener:** one natural first line ("I saw you asked about tail sampling too. Did you try it in the collector yet?")
- **Two follow-up questions** drawn from what each of you asked and starred
- **What each of you brings:** "They've migrated 150 services to OTel; you've tuned collector memory" (from profiles and "working on")
- **Where and when:** the smart meetup suggestion (§1d-C)
- **After:** one tap, "Was this worth it?", which feeds matching quality and the recap

## 1c++. "I'm lost" and "Got it": one-tap signals during a talk
Typing a question is effort. A single tap is not.
- **"I'm lost"** (one tap) timestamps the moment you got confused. You instantly get **"Explain the last 30 seconds"**, simplified to *your* level (from your profile). No typing, no raising your hand.
- **"Got it"** (one tap) marks a moment that clicked. It's the positive signal speakers rarely get.
- Both are stored as `signals` (talk, offset in seconds, type, anonymous user hash).
- **For the speaker:** the per-minute **confusion map** (lost vs. got-it vs. questions over the talk's timeline, with the transcript at each spike) is the backbone of the AI speaker report (§1d-E).
- **For matching:** a weak signal only. Being lost at the same moment isn't enough to meet, but it adds to a match that already shares a real problem.

## 1d. Features that fix the researched problems (v2)

Each feature maps to a problem in [research/all-conferences-problems.md](research/all-conferences-problems.md). "Star" and "catch me up" stay as small helpers, not headline features.

### A. "Apply to my work": turn a talk moment into action in *your* repo
**Problem:** only 10–20% of conference learning reaches the workplace, and ~70% is forgotten within a day.
- Tap **Apply to my work** on any moment (or on an answer). Sidecar combines what the speaker said + your GitHub summary + your "working on" text, and returns **what it means for you, specifically**:
  > *"The speaker kept 100% of error traces with tail sampling. Your repo `payments-api` uses head sampling at 10% in `otel-collector.yaml`. Suggested change: add a `tail_sampling` processor with an error policy. [Draft GitHub issue]"*
- **Draft GitHub issue** (title, context, the speaker's quote and timestamp, suggested steps) → one click opens it in your repo (prefilled `issues/new?title=&body=` link, so no write access is needed).
- This is the cloud-native crowd's version of "takeaways": not notes, but **tickets**.
- *Scope: one LLM call + a GitHub link. Reading actual repo files is a stretch; v1 uses the onboarding GitHub summary.*

### B. Ask the speaker later
**Problem:** Q&A time is "very limited" (CHI '25), and many people never ask in public.
- Any question the talk didn't answer can be **sent to the speaker** (anonymous by default). It lands in the Speaker feedback hub (E). When the speaker answers, every attendee who asked something similar gets it.

### C. Schedule twins + smart meetups on a venue map
**Problem:** networking is the #1 goal and the worst served; matching on job titles fails; people don't know where or when to meet.
- **Schedule twins:** "You and a platform engineer from e-commerce picked 4 of the same 6 talks (2 of them niche). You're both free at 11:30. Want to catch up?" Same blind card and mutual-reveal flow as "Same problem" matches.
- **Venue map:** a simple floor plan (SVG) with rooms, coffee bars, lounges, a quiet room and the expo hall.
- **Smart meetup suggestion** once a match is mutual:
  1. **When:** the first gap where *both* schedules are free (≥15 min).
  2. **Where:** the meeting spot closest to *both* people's next rooms, so neither walks across the venue. Skips spots that are crowded right now (from live check-in counts).
  3. Shown on the map with a pin and both walking routes: *"11:35, Coffee bar Hall B: 2 min from your next talk, 3 min from theirs."*
  4. Both accept → it's added to **both schedules** as a meetup block, with the opener.
- **ES:** meeting spots and rooms are stored with `geo_point` coordinates (on a local grid mapped to fake lat/lon), and candidates are sorted with `geo_distance` from the midpoint of the two next rooms. This uses the **geo** feature Elastic listed on the resources page.
- **Before the huddle:** "3 things to talk about with them" (shared problem, overlapping talks, what they're working on). This helps the ~34% who lack networking confidence.

### D. "Where to go next" for every question
**Problem:** choice overload, and questions that one talk can't fully answer.
- When you ask, Sidecar also searches **upcoming talks in this conference** (`start_time > now`) and an **`events` index of other conferences**:
  > *"Your question about eBPF security is the main topic of 'eBPF in Production' tomorrow at 10:00, Room D. [Add to schedule]"*
  > *"Going deeper? KubeCon EU (Amsterdam, March) has 3 talks on this."*
- One extra query on each ask (hybrid search on the question text, filtered by future time). Unanswered questions also feed the recap's **"still open → go here"** list.

### E. Speaker feedback hub (anonymous)
**Problem:** speakers get almost no feedback ("a letter into the void"); attendees rarely give honest feedback in person.
- After the talk (and at the end of the conference), each speaker gets a private page:
  - **Every question asked during their talk**, anonymized and **clustered by theme** ("12 questions about sampling, 5 about cost")
  - **Confusion map**: "I'm lost" taps, "Got it" taps and questions per minute, with the transcript at each spike ("minute 14: 9 questions right after you said 'tail-based sampling'")
  - **Audience mix** (aggregated only): roles, levels, why they came ("60% advanced, mostly here to solve a problem")
  - **Anonymous feedback**: a 2-tap rating + an optional comment from attendees
  - **AI suggestions for next time**: "Define tail sampling before minute 14", "Many beginners attended; add a 1-slide primer"
  - **Answer queued questions** (from B), which go back to the askers
- **ES:** `terms` + `date_histogram` aggregations over `questions`, filtered to the talk. Clustering = the topic field from the question classifier.
- **Privacy:** never show who asked; hide any cluster with fewer than 3 people.

### F. The recap becomes a "what I got" page (not a boring export)
**Problem:** people must prove the trip was worth it, and only ~12% of connections get a meaningful follow-up.
- A **shareable page** (a link, not a file) your manager can open: talks attended → **GitHub issues created** (from A) → people met and why → questions still open and where they'll be answered (from D).
- **Follow-ups with context:** for each person you met, a drafted message that references your actual shared problem, plus a "remind me in 3 days" option.
- **Memory nudges:** a 3-bullet "remember this" for the next morning and a week later, built from your saved moments and applied items (spaced recall against the forgetting curve). *Stretch.*

### Priority inside v2 (if time is tight)
1. **C** (schedule twins + map meetup), the best networking demo
2. **E** (speaker hub), cheap since it's aggregations, and memorable
3. **A** (apply to my work + GitHub issue), the strongest "wow" for this audience
4. **D** (where to go next), one extra query
5. **B** (ask the speaker later)
6. **F** (what-I-got page)

---

## 2. Design decisions (the open questions, answered)

### 2a. Is "asked the same question" enough reason to meet? No, so we don't match on that alone
"What is cardinality?" from two people is **not** a reason to network. So:

**Step 1: classify every question** (one cheap LLM call when it's asked):
- `definition`: "what is X?" → answered, **not used for matching**
- `applied`: "how do I do X in my setup?" / "how does this compare to Y?" → **used for matching**
- `experience`: "has anyone run this at scale?" → **strong matching signal**

The LLM also extracts the **topic** and the **underlying problem** ("reducing LLM latency", "tracing cost").

**Step 2: match score** (computed when the talk ends, and again whenever a new question comes in):
```
score = 0.45 × similarity(my applied/experience questions, theirs)     ← same problem, same moment
      + 0.25 × similarity(my "working on", their "working on")         ← same real-world context
      + 0.15 × shared moments (both ⭐ starred or asked within the same ~2 min, across talks)
      + 0.15 × schedule overlap, rarity-weighted                       ← same interests, before any talk
```
- **Schedule overlap is weighted by rarity:** sharing a niche talk only 40 people picked counts far more than sharing the keynote everyone picked (an IDF-style weight: `log(total attendees / attendees on that talk)`, summed over shared talks). In ES this is a `terms` query on `schedule.talk_ids` plus a per-talk count aggregation.
- **Two-layer graph:**
  1. **Before the event (from schedules):** a faint "interest" graph exists from minute one. That solves the cold start: you can see "12 people share 3+ niche talks with you" and "who's going to this talk," and a blind card can say *"You're both going to 'eBPF Deep Dive' and 'OTel at Scale'."*
  2. **During talks (from questions):** shared *problems* add **strong, bright edges** on top. Schedule = what you're curious about; questions = what you're actually stuck on.
- Before the talk, the Live Talk page shows **"5 people here also picked your 2 other niche talks"**: an icebreaker before the talk even starts.
- A match card is shown when **score ≥ threshold** and **either** ≥1 shared applied/experience question **or** a strong schedule overlap (≥3 rare shared talks) + similar "working on". Schedule-only matches are labeled **"Same interests"**; question-based ones are **"Same problem"** (ranked higher). Matches get stronger across the day.
- Two match types shown on the card:
  - **"Same problem"**: peers stuck on the same thing → swap notes.
  - **"Been there"**: their profile/"working on" says they've *done* what you're asking about → they can help.

### 2b. Blind profiles: yes, this is a great addition
It fixes three things at once: privacy, the pressure of cold intros (34% lack networking confidence), and wasted meetings.

**Card (blind):**
> 🔒 **Platform engineer · 6 yrs · fintech, 500–1000 people**
> Also stuck on: *reducing tracing costs* (asked at 14:02 in "OTel at Scale")
> Working on: *migrating 200 services to OpenTelemetry*
> Match: **Same problem** · 2 shared moments
> **[Want to meet]**

- No name, no photo, no exact company, until **both** tap "want to meet". Then reveal name + LinkedIn + a **suggested opener** ("You both asked how to sample traces without losing errors") + **where** to meet ("Coffee bar, Hall B, in 10 min", from the talk's room).
- Nobody sees your exact question text unless you allow it. They see the **topic** ("reducing tracing costs").

### 2c. Cross-room: how it actually works
**Every talk at the conference writes into one shared Elasticsearch index** (`transcripts`: talk_id, room, timestamp, text). Three things use that:

1. **Answers cite other rooms.** When you ask a question, we search *this talk's last few minutes first*, then *every other talk*. The answer can say: *"The speaker just said X. Also, in 'eBPF Deep Dive' (Room B, 10:40), they explained Y."*
2. **"Follow a topic" = Elasticsearch percolator.** When you follow "LLM latency", we store it as a *saved query*. Every new transcript chunk from *any* room is checked against all saved queries (`percolate`). On a hit → *"🔔 Room B is talking about LLM latency right now"*, with the snippet and a button to jump in.
3. **Your interests follow you.** Questions from talk 1 and talk 3 add up, so matches get better over the day.

**In the demo:** a second "room" is running with a pre-recorded talk replayed through the same ingest pipeline (a `replay` script feeding transcript chunks with real timing). Mid-demo, the alert fires from Room B. That makes it look and work like a real multi-room conference.

### 2d. Who transcribes?
**One device per room** (the speaker's or room laptop) captures audio and streams the transcript. Attendees' phones just **read** captions and **ask**. Cheap, simple, and it scales.
- Primary: OpenAI transcription on 5-second audio chunks (we have $50 credits/person).
- Fallback: browser Web Speech API (Chrome), plus the replay script for demo safety.

### 2e. Personalization and the "value" recap: how we track it
Every action is an event in an `activity` index: `{user, talk, type, ts, payload}`.

| Event | Captured when |
|---|---|
| `joined_talk` / `left_talk` | QR scan / page leave (gives dwell time) |
| `asked` (+ type, topic, answer) | Every question |
| `starred_moment` (+ last 30s of transcript) | ⭐ button |
| `followed_topic`, `alert_opened` | Topic follows/alerts |
| `match_shown`, `want_to_meet`, `met` | Connect flow |

**The recap is just a query plus one LLM call:**
- **Talks attended** (dwell time)
- **Your takeaways**: built from your ⭐ moments + your applied questions and their answers, **tied to your "working on" field** ("Relevant to your OTel migration: …")
- **People you met and why** (the shared problem), with **follow-up message drafts**
- **Still open**: questions you asked that the talk didn't answer → suggested talks tomorrow / people to ask
- **Value stats**: "7 questions answered · 12 moments saved · 3 people met · 2 cross-room alerts"
- **Export** as a trip report (Markdown) to send to your manager. That solves "prove the trip was worth it."

Personalization loop: the **interest profile** (profile + questions + stars) also re-ranks **"recommended talks"** in My Schedule. The more you use it, the better your schedule gets.

### 2f. Speaker view: keep it, but small
It's one aggregation (`date_histogram` of questions per minute + top clustered topics), so it's cheap. In the demo it's a **5–10 second flash**: "and the speaker sees exactly where the room got lost."

---

## 3. 3-minute demo storyline

| Time | Beat | On screen |
|---|---|---|
| 0:00–0:20 | **Hook.** "Networking is the #1 reason people go to conferences, and the worst served: tools match you on job titles. And you forget ~70% of a talk within a day." | Title + 2 stats |
| 0:20–0:35 | **Before.** My profile → search "cut observability costs" → add to schedule | Schedule page |
| 0:35–1:20 | **During (hero).** "Scan this QR, *this pitch is the talk*." Judges' phones show live captions. I ask "how do I sample traces without losing errors?" → answer quotes what I said 20s ago, with timestamp. 🔔 **Alert:** "Room B is talking about OTel cost right now" | Live talk page + a judge's phone |
| 1:20–2:00 | **Connect (hero).** The graph starts as faint **"same interests"** links from everyone's schedules, then **bright "same problem" edges light up live** as the judges' questions come in, forming clusters in real time. Tap a node → **blind profile** → "want to meet" → mutual → reveal + opener + "coffee bar, Hall B" | Graph + card |
| 2:00–2:20 | **After.** My Recap: takeaways tied to my work, people met, open questions, export. 5s speaker confusion timeline | Recap + timeline |
| 2:20–3:00 | **Under the hood.** ES (hybrid search, percolator, semantic matching, aggregations) · Dash0 SLO dashboard + "Agent0 found the bug we shipped at 2 PM" · Radar AI investigation · Gitar PRs with our review rules | 4 quick screenshots |

**Safety:** seeded data (fake attendees, questions, a second room replay) means the demo works even if no judge scans.

---

## 4. Architecture

```
[Room laptop: mic] → ingest-svc → OpenAI transcribe → ES: transcripts ──┐
                                                    └→ percolate → alerts (SSE)
[Attendee web app] ⇄ api-svc ⇄ ES: talks, profiles, questions, activity, follows
                         └→ OpenAI (answer, classify question, recap)
matcher-worker: on talk end / new question → scores → ES: matches
All on Kubernetes (Radar cluster, Argo deploys) · OTel → Dash0 · PRs → Gitar
```

**Stack (suggested, keep it boring):** Next.js (web, RUM) + one Node/TS or Python FastAPI `api` + `ingest` + `matcher` as small separate deployments (3 backend services = a better Radar/Dash0 story). Elastic Serverless (Elasticsearch project) with **`semantic_text`** (built-in embeddings, no vector code). OpenAI `gpt-4o-mini` + transcription model. Live updates via SSE or polling (no websockets needed).

**ES indices:** `talks` (catalog, semantic_text on title/abstract) · `transcripts` (talk_id, room, ts, text: semantic_text) · `questions` (user, talk, ts, text, type, topic, problem: semantic_text) · `profiles` (role, yrs, company_type, working_on: semantic_text, goals) · `venue_spots` (rooms, coffee bars, lounges: `geo_point`, live crowd count) · `meetups` · `events` (other conferences and side events, for §1d-D and §9) · `follows` (percolator field) · `activity` · `matches`.

**Seed data:** ~30 conference-style talks (titles/abstracts/rooms/times), ~25 fake attendees with profiles + questions, 1 pre-recorded talk transcript for Room B replay.

---

## 5. Who does what (3 people, parallel from minute 1)

| | **Person A: Live talk** | **Person B: Data & intelligence** | **Person C: Platform & product shell** |
|---|---|---|---|
| 12:15–12:45 | Talk page skeleton, mic capture → 5s chunks | ES project, indices + mappings, seed scripts (talks, attendees) | Repo, Gitar app + `.gitar/review/` rules + CI, Radar env + starter repo + Argo, Dash0 + OTel in all services |
| 12:45–1:45 | Ingest svc → transcription → `transcripts`; live captions (SSE); ask box; ⭐ star | `ask` API (hybrid search: this talk → all talks, LLM answer with timestamps); question classifier; schedule search + recommend | Onboarding/profile page; My Schedule page + QR per talk; deploy all services to k8s |
| 1:45–2:45 | Follow-topic UI + alert toasts; Room B **replay script** | Percolator alerts; **matcher** (score formula) → `matches`; recap query + LLM | **Connect page**: live graph (react-force-graph / d3) + blind profile cards + mutual reveal |
| 2:45–3:15 | Speaker timeline view; polish live page | Recap page data + export; activity events everywhere | Integration, deploy, Dash0 dashboard + **SLOs**, Radar check |
| 3:15–5:00 | **All:** find a *real* issue in the running app (or run an investigation after a release; Radar's rules say don't break things on purpose) with Agent0 + Radar → fix through a Gitar-reviewed PR · rehearse demo ×3 · README (setup, architecture, AI disclosure, per-track section) · screenshots · submit by 5:00 | | |

**Rules for the team:**
- **Every feature = its own branch + PR through Gitar.** No direct pushes to main. (The Gitar track scores this.)
- **OTel from the first commit**, not added at the end. (The Dash0 track scores this.)
- **Deploy to the Radar cluster by ~1:45**, not at 4. (The Radar track needs real usage.)
- Never log question or transcript text (privacy; becomes a Gitar review rule).
- Keep a `DEMO_NOTES.md` with screenshots of every sponsor-tool moment as it happens.

## 6. Open questions for the team (decide by ~12:30)
1. **Stack:** Next.js + Node/TS services, or Next.js + Python FastAPI? (Pick whatever the team is fastest in.)
2. **Who is Person A / B / C?**
3. **Seed talks:** use a real public schedule (e.g. KubeCon NA abstracts) or write ~30 realistic fake ones? Real is more convincing; check the license/terms first.
4. **Transcription:** OpenAI chunked transcription (better quality) vs browser Web Speech API (zero cost, Chrome only)? Plan: OpenAI primary, Web Speech fallback.
5. **Cluster:** Radar-provided namespace (join code at the Radar table) or our own? Plan: Radar's.
6. **GitHub onboarding:** keep it (great for personalization) or cut to free text if behind?
7. **Demo:** who presents, who drives the laptop, who watches the judges' phones?

## 7. Decisions log
| Time | Decision |
|---|---|
| 11:40 | Theme is *conferences in general*. KubeCon is the setting and the demo example |
| 11:55 | Hero = live "ask the talk" + matching on what people are stuck on. Name: **Sidecar** |
| 12:05 | Matching is never on definition questions alone; blind profiles with mutual reveal |
| 12:10 | Schedule overlap (rarity-weighted) = a faint "same interests" graph layer |
| 12:15 | Scheduler is smart (goal/level/pace-aware, explains every pick) but small in the demo |
| 12:40 | v2 features added (§1d): apply-to-my-work + GitHub issue, ask the speaker later, schedule twins + venue-map meetups, where-to-go-next, speaker feedback hub, what-I-got page. Multi-conference dashboard and side events are add-ons (§9) |

## 8. Cut list (if behind at 2:45, cut from the bottom)
1. Speaker timeline → static screenshot
2. Recap export → on-screen only
3. "Been there" match type → "Same problem" only
4. Cross-room answer citations → keep alerts only
5. **Never cut:** live captions, ask, blind-profile matching, graph, one cross-room alert

## 9. Add-ons (only if time; not the focus)
Small, nice-to-have extras. Build none of these until the core flow and v2 priorities 1–3 work end to end.

| Add-on | What it is | How (keep it cheap) |
|---|---|---|
| **Multi-conference dashboard** | A simple page listing upcoming conferences (KubeCon EU, local CNCF meetups and others) with "topics that match you" badges | Seed an `events` index from a static JSON of public event listings (Luma public event pages, CNCF calendar). No scraping behind logins; check each site's terms. The same index powers §1d-D "another conference covers this" |
| **Side-event suggestions** | "There's a networking event tonight you might like" (meetups, after-parties, community huddles) | Same `events` index, ranked against your profile. Luma: only public events, imported via static JSON or its public pages/API where allowed. Slack: only channels the team owns, with permission; otherwise seed sample data |
| **Personalization upgrades** | Learn more from behavior: dwell time, ignored alerts, rejected matches, `significant_terms` "people like you", re-planning the afternoon live | Already designed in §1c; turn on piece by piece |
| **Memory nudges** | Next-morning and one-week "remember this" digests | A scheduled job + one LLM call per user |
