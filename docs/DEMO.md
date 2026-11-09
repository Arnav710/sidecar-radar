# Sidecar demo (3 minutes)

## Before you go on stage (5 minutes earlier)

1. `npm run reset-live && npm run seed` (clears every test user, question, match and the pitch transcript; resets talk times to "now", keeps room keys, reloads the 14 demo attendees and the venue).
2. **Laptop A, the room laptop (Chrome):** open the room link for `sidecar-live-pitch`:
   `python3 -c "import json;k=json.load(open('.room-keys.json'));print('https://sidecar.cnh.radarhq.io/talk/sidecar-live-pitch/room?key='+k['sidecar-live-pitch'])"`
   Click **Start captioning**, allow the mic. Its big QR code is on screen.
3. **Laptop B, the projector:** open `/talk/sidecar-live-pitch/graph` in one tab, `/connect` in another.
4. **Phone 1 (presenter) and Phone 2 (teammate, "the other attendee"):** both open `/talk/sidecar-live-pitch`. Each sets a display name at `/onboarding` (e.g. "Priya", "Sam").
5. Backup: `npm run replay` streams a recorded talk into Room B if the mic fails; the screen recording is the last resort.

## The script (3 minutes, the question is the hero)

**Screen setup:** one laptop on the projector with **two browser windows side by side**: left = *you* (normal Chrome window), right = *your teammate* (an **incognito** window, so it's a different person). Both open `/talk/sidecar-live-pitch`. Phones work too, but side-by-side windows let the judges see both devices at once.

**Do this 2 minutes before you start:** in the right (teammate) window, ask *"Our tracing bill exploded, how can we sample in the collector without losing errors?"* So your teammate "already asked during the talk". It's real, not seeded.

| Time | Say | Do / show |
|---|---|---|
| 0:00–0:20 | "The best part of a conference is the people. 52% of attendees say the most valuable thing is meeting people facing *similar challenges*, and nobody tells you who they are. Job titles don't. **The question you just asked does.**" | Title slide |
| 0:20–0:45 | "Scan this. **This pitch is now a live talk.**" Teammate speaks two sentences about tracing costs. | Room laptop QR + live captions appearing in both windows. |
| 0:45–1:20 | "I'm lost, so I'll ask privately." Left window asks *"How do I stop paying for healthy traces but keep the failing ones?"* | The answer **quotes what was just said with its timestamp**, then **"Already covered in another session"** (OpenTelemetry at Scale, Room B, at 1:20) and **"Coming up at this KubeCon"** (Tail Sampling Deep Dive). |
| 1:20–1:50 | "And look: someone here is stuck on the same thing." | Left window pops up **"🔥 Someone here is stuck on the same thing"** → tap → **blind card** (role, shared problem, no name) → **Want to meet**. Right window pops up **"👋 Someone wants to meet you"** → **Say yes**. Both: **"🎉 It's mutual"**. |
| 1:50–2:15 | "Now the conversation is already started, and it's booked." | `/connect`: names + **conversation kit** (opener, follow-ups), the **meetup** (first free slot in both schedules + nearest uncrowded spot, on the venue map), and **your hallway graph** with you in orange. |
| 2:15–2:35 | "And the speaker finally gets feedback." | Room laptop → **📊 Speaker report**: confusion spike at minute 2, the themes the room asked about, the AI "what to change next time". |
| 2:35–3:00 | "Under the hood…" | **Elasticsearch:** hybrid BM25 + semantic with RRF over the live transcript; matching is one `linear` retriever (0.6 / 0.3 / 0.1), rarity from IDF, meetup spot by `geo_distance`, speaker themes with k-anonymity. **Dash0:** the trace of that question across web → worker → Elasticsearch → OpenAI, plus SLOs. **Radar:** rollout + investigation. **Gitar:** real catches. |

## Lines worth having ready
- **Why matching on questions works:** "Two people who ask 'what is eBPF' shouldn't meet. Two people asking how to keep error traces while cutting cost should. We classify every question and only match on applied and experience ones."
- **Privacy:** "Blind until both say yes, never your raw question, and speaker views drop any minute with fewer than 3 people."
- **Is the data real?** "The live talk, captions, questions, matches and meetups are real and stored in Elastic Cloud right now. The other talks and the 14 people on the graph are labelled demo data so the room isn't empty before you scan."
