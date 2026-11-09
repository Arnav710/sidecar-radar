# Ideas: one hero, built from the problem research

> Brainstorm history. The chosen idea (renamed **Sidecar**) and its current design live in [PLAN.md](PLAN.md).

## 1. One thing, or a one-stop shop?
**Neither extreme.** Build **one hero loop that's excellent**, where the "extra" features aren't separate products but **the same data reused**. Then they cost almost nothing to add, and each one makes the hero story stronger instead of diluting it.

- ❌ Suite of 6 half-built features (agenda, chat, matchmaker, notes, map, recap): looks like every other team's, and judges remember none of it.
- ❌ One narrow feature: wins one track at most, and doesn't feel like a product.
- ✅ **One engine, three moments.** One data spine in Elasticsearch, one hero interaction, and two natural outcomes of it. The pitch fits in one sentence.

## 2. What most teams will build (so we avoid it)
1. "Chat with the schedule": RAG over **static talk abstracts** (the sponsor's own example).
2. Tinder-style matchmaking on job title / interests form.
3. Crowd / room-capacity map.
4. Agenda builder / talk recommender.
5. Note-taker / session summarizer.
6. Generic attendee chatbot.

They all work on **static data entered before the event** (abstracts, profiles). Nobody will be working on **what's happening live in the rooms**.

## 3. The insight that makes it different
Two of the biggest problems are treated as separate today:
- **Understanding** what's being said (choice overload, missed talks, limited Q&A, forgetting).
- **Meeting the right people** (the #1 reason to attend; 52% want "people facing the same challenges"; matching on job titles fails).

But **the questions you ask during a talk are the best signal of what you're actually struggling with**. Far better than a job title or a profile form. If someone in the same room got confused at the same moment and asked the same kind of question, *that's* the person facing the same challenge.

**So: the questions become the social graph.**

---

## ⭐ HERO IDEA: "Sidebar" (working name)
*Ask the talk anything, live. Your questions find your people.*

A web app you open in any session (QR code on the room door). The talk is transcribed live into Elasticsearch, second by second.

### Moment 1: Understand (the hero interaction, during the talk)
- **Ask anything, privately, mid-talk:** "What's a sidecar?", "What did she mean by 'cardinality'?", "How is this different from what the last speaker said?"
- Answers are **grounded in the last few minutes of what the speaker actually said** (hybrid search over the live transcript), plus **"this was also covered in Room B at 10:40"** (search across every talk at the conference, live and past).
- Live captions come for free (the transcript is on screen). This helps Deaf/HoH attendees, non-native speakers, and anyone who arrived late. **"Catch me up"** summarizes what you missed.
- Private questions help the ~34% who lack confidence to network and the attendees who never ask in public. Nobody has to raise a hand.

### Moment 2: Connect (the differentiator, right after the talk)
- When the talk ends: *"3 people in this room got stuck on the same thing you did."* Opt-in.
- Matching uses **vector similarity between attendees' questions** (+ which moments they reacted to), not profiles. The opener is built in: *"You both asked how to cut OTel tracing costs at minute 14."*
- Form an instant **huddle**: a "meet at the coffee bar by Hall B in 5 min" card. This is the hallway track, engineered. Not swiping, no Tinder.
- **Across the conference:** save a topic you care about ("eBPF security"), and the moment **any speaker in any room says something about it**, you get a nudge: *"Room C is discussing your topic right now."*

### Moment 3: Remember (falls out of the same data, after)
- Your **personal recap** builds itself from the moments you engaged with: your questions + answers, the transcript snippets you starred, the people you huddled with and what you had in common. Ready-to-send trip report with action items, which solves "prove the trip was worth it" and the forgetting curve.
- **For speakers:** a **confusion timeline**, i.e. a per-minute chart of where the audience got lost and the top questions they didn't get to ask. That's the speaker feedback nobody gets today, and better Q&A during the session (the speaker sees the top clustered questions live).

### Why this wins
- **Different from everyone else:** live, spoken content instead of static abstracts; intent-based matching instead of profile matching.
- **One sentence:** *"Ask the talk anything, live, and the people who asked the same thing become your hallway track."*
- **Hits the top-ranked researched problems:** #1 right people, #2 forgetting/ROI, #3 choice overload (cross-room alerts), #5 missed talks (catch-up), #6 one-way talks/Q&A, plus speaker feedback.
- **Works at any conference** (tech, academic, medical, trade), not just KubeCon.
- **Inclusion is built in, not bolted on:** captions, private questions, structured intros (which closed the gender networking gap in the Minnesota study).
- **Killer live demo:** during our pitch, judges scan a QR code, our *presentation* is the live talk, they ask questions on their phones, and at the end the screen shows *"Kelsey and Saiyam asked about the same thing at minute 2."* (Have seeded fallback data in case Wi-Fi dies.)

### Tracks: each one is real, none is bolted on
| Track | How it's genuinely used |
|---|---|
| **Elasticsearch** (the core) | Live transcript chunks (`semantic_text`, hybrid BM25+vector with RRF) • questions index with embeddings → **kNN people-matching** • **percolator queries** for cross-room "alert me when anyone says X" (stored queries matched against each new transcript chunk: a smart, rare use of ES) • `date_histogram` aggregations for the per-minute confusion timeline and trending topics across rooms |
| **Dash0** | The product's promise is speed, so the SLOs are real: **transcript lag p95 < 3s** and **answer latency p95 < 4s**. Traces span browser → ingest → ES → LLM; RUM on the web app; LLM token/cost tracing. Agent0 finds the issue we inject in the demo |
| **Radar** | 4 services on Kubernetes (web, ingest, ask-api, matcher worker) deployed via Argo. Demo: a bad release breaks the matcher or transcript ingest, and Radar's AI investigation finds the cause |
| **Gitar** | Every feature lands as its own PR. Review rules that fit *this* product: "never log question or transcript text (privacy)", "every ES call must be traced", "matching must stay opt-in" |
| **Merge Forward** | Live captions + private questions + structured intros = inclusion as a side effect of the core design |

### MVP scope for ~4.5 hours (in priority order; stop wherever time runs out)
1. **Ingest:** browser mic → 5–10s audio chunks → transcription (OpenAI credits) → ES `transcripts` index (talk_id, ts, text). Live captions on screen.
2. **Ask:** question → hybrid search (this talk's last N minutes + all talks) → LLM answer with timestamps. Store the question + embedding in `questions`.
3. **Connect:** "End talk" → kNN over questions in that talk → huddle cards with shared-topic openers. Opt-in.
4. **Speaker confusion timeline:** aggregation of questions per minute + top clustered questions.
5. *Stretch:* percolator cross-room alerts → recap/trip report.
- **Cut:** accounts/auth (display name only), multi-day schedules, maps.

---

## Other ideas we considered (ranked)

### B. "Stuck?": problem-first routing
You type the real problem you're stuck on at work ("Prometheus cardinality is exploding"). The system routes you to the talks, booths, speakers and *attendees who've solved it*, i.e. "Stack Overflow for the building." It's intent-based and hits networking + choice + expo problems. **Weakness:** needs many users entering problems (cold start), and the demo is less visceral. *Its best part, intent-based matching, already lives inside the hero.*

### C. "Conference second brain"
After every conversation, speak a 10-second voice memo ("met Priya, platform team at Adobe, ask her about Backstage plugins"). It's stored in ES and later searchable ("who told me about Backstage?"), with follow-up drafts. Solves forgetting people. **Weakness:** it's close to a note-taking app (which you want to avoid), and hard to demo with a "wow".

### D. "Room radar": the live pulse of the whole conference
Live topic trends across every room ("eBPF is hot in Room B right now"), for deciding where to go next. **Weakness:** depends on many rooms being live at once. *It's the hero's cross-room layer, so we get a version of it for free.*

### E. "Confusion radar" for speakers only
The speaker sees a live, anonymous confusion meter and clustered questions. Good and unique, but serves a small audience. *It's Moment 3 of the hero.*

**Takeaway:** B, D and E aren't competitors. Their best parts are already layers of the hero, which is why the hero is a one-stop product without being half-baked: **one live data spine, used three ways.**
