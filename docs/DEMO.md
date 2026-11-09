# Sidecar demo (3 minutes)

## Before you go on stage (5 minutes earlier)

1. `npm run seed` (resets talk times to "now", keeps room keys, loads the 14 demo attendees and the venue).
2. **Laptop A, the room laptop (Chrome):** open the room link for `sidecar-live-pitch`:
   `python3 -c "import json;k=json.load(open('.room-keys.json'));print('https://sidecar.cnh.radarhq.io/talk/sidecar-live-pitch/room?key='+k['sidecar-live-pitch'])"`
   Click **Start captioning**, allow the mic. Its big QR code is on screen.
3. **Laptop B, the projector:** open `/talk/sidecar-live-pitch/graph` in one tab, `/connect` in another.
4. **Phone 1 (presenter) and Phone 2 (teammate, "the other attendee"):** both open `/talk/sidecar-live-pitch`. Each sets a display name at `/onboarding` (e.g. "Priya", "Sam").
5. Backup: `npm run replay` streams a recorded talk into Room B if the mic fails; the screen recording is the last resort.

## The script

| Time | Say | Do / show |
|---|---|---|
| 0:00–0:20 | "The best part of a conference is the people. But 52% of attendees say the most valuable thing is meeting people facing *similar challenges*, and nobody shows you who they are. Job titles don't tell you who to meet. **The question you just asked does.**" | Title slide |
| 0:20–0:40 | "Scan this. **This pitch is now a live talk.**" | Room laptop QR. Judges' phones show live captions of what you're saying. |
| 0:40–1:10 | "Say I'm lost on sampling…" Ask on Phone 1: *"How do I keep error traces when we sample?"* | The answer quotes what was said seconds ago with a timestamp chip, plus **where to go next** (Tail Sampling Deep Dive). Tap **I'm lost**: the last 30 seconds re-explained. |
| 1:10–1:40 | "Here's the hallway track for this room." | Projector: the **people graph**. Bold orange lines = same problem, dashed = same interests. Phone 2 asks a similar question in different words: a new bold edge appears live. |
| 1:40–2:10 | "Names stay hidden until both say yes." | Phone 1 `/connect`: **Matched from what you asked**, your graph with you in orange, and a blind card: *"Also stuck on: keeping error traces while cutting tracing costs"*. Both phones tap **Want to meet** → 🎉 mutual, names + **conversation kit** (why you two, opener, follow-ups). |
| 2:10–2:30 | "And it books the meeting." | Meetup card: **first free slot in both schedules + nearest uncrowded spot**, on the venue map. Both accept → on both schedules. |
| 2:30–3:00 | "Under the hood…" | **Elasticsearch:** hybrid search + RRF over the live transcript; matching is one `linear` retriever (0.6 / 0.3 / 0.1); rarity from IDF; meetup spot from `geo_distance`. **Dash0:** one question's trace across web → worker → Elasticsearch → OpenAI, and the SLO dashboard. **Radar:** the rollout timeline and investigation. **Gitar:** PRs with real catches (room keys in git, raw questions leaking into match cards, a race in mutual accept). |

## Lines worth having ready
- **Why matching on questions works:** "Two people who ask 'what is eBPF' shouldn't meet. Two people asking how to keep error traces while cutting cost should. We classify every question and only match on applied and experience ones."
- **Privacy:** "Blind until both say yes, never your raw question, and speaker views drop any minute with fewer than 3 people."
- **Is the data real?** "The live talk, captions, questions, matches and meetups are real and stored in Elastic Cloud right now. The other talks and the 14 people on the graph are labelled demo data so the room isn't empty before you scan."
