# What people actually complain about at conferences (KubeCon + tech conferences)

Researched 2026-11-09 from Reddit (r/kubernetes, r/devops, r/MachineLearning and others, mostly via mirrors), Hacker News, Slashdot, attendee blogs/recaps, and event-industry surveys. Grouped by theme and ranked by how often and how loudly it came up, and by how much KubeCon attendees/judges would feel it.

## Tier 1: loudest, most repeated, very KubeCon-specific

### 1. "I can't pick, I can't be everywhere": schedule overload
- KubeCon runs **12–22 parallel tracks**. Attendees say even *choosing* talks is a challenge.
- Titles/abstracts are vague. Keynotes drift to irrelevant (people skip them more each day). Vendor-flavored talks slip through despite CFP rules.
- Veterans' advice: shortlist only **10–15 talks for the whole conference** and decide day by day, based on what you're working on.
- Strong **"AI fatigue"** in 2024–25: people struggle to find the non-AI-hype content they came for.
- **Underlying need:** "Tell me which 10 talks matter *for my actual work*, and filter out the fluff."

### 2. Rooms full / missed talks / recordings arrive late
- "All of the talks I really wanted to see were completely overflowing," even when arriving early. Overflow rooms aren't useful, and "full" notices are wrong.
- In the virtual era people loved that recordings were up minutes after a talk. In person, YouTube uploads come weeks later.
- **Underlying need:** "I missed it (full room, clash, hallway chat). Give me the gist *now*."

### 3. Forgetting who you met and what you talked about
- Very common Reddit thread: **the name isn't the problem, the conversation is.** You forget what you discussed and why it mattered.
- "Notes get lost, cards pile up, follow-ups fall through." It falls apart by the third conference.
- Capture has to take **under ~10 seconds** or people skip it. The advice is to follow up within 24 hours with something specific.
- **Underlying need:** a frictionless "who I met + what we said + next step" memory that you can search later.

### 4. Hallway track is the real value, but it's hard to break into
- HN/blogs: the hallway track is "by far the most valuable" part, and that's also the case for KubeCon veterans (project pavilion, tours).
- But it favors **well-connected insiders**. Introverts and first-timers don't know who to talk to. "Most networking advice is built for extroverts."
- **Underlying need:** "Find the 3 people here working on the same problem as me, with a reason to say hi."

## Tier 2: frequent, painful, but more logistical

### 5. Overwhelm (first-timers especially)
- r/kubernetes: "This will be my first KubeCon, and honestly it feels a bit overwhelming." "Am I doing KubeCon wrong?" (Is focusing on talks and quiet time wasting the company's money?)
- CNCF itself acknowledged attendees "felt overwhelmed or unhappy." A top request was help getting competent in cloud native fast.

### 6. Proving ROI to your manager / the post-conference write-up
- People need to justify the trip beforehand and write a 1–3 page trip report after (takeaways, action items). Most draft it on the flight home from scattered notes.
- **Underlying need:** "Turn what I saw and who I met into a report and team action items."

### 7. Vendor/badge-scan spam
- Booths scan badges without consent, and the spam starts the week after. Some vendors won't talk unless scanned.
- People want to engage with booths selectively without becoming a lead.

### 8. Event tech that fails
- Conference apps that crash or need login on overloaded Wi-Fi, and features nobody can find. Registration systems break (KubeCon EU 2024 locked attendees out on day one).
- Wi-Fi overload is a classic (DHCP runs out of addresses).

## Tier 3: real but harder to solve with software today
- Lines (food, coffee, swag, registration), walking distances, temperature.
- Cost and expense (Contributor Summit pricing debates).
- Safety and harassment at some events (e.g. GHC 2023 crowding). Generic "Attendee" badges with no context.

## The pattern

Most rants boil down to one gap: **conferences are a flood of information and people, and attendees have no memory or filter for it.**
- **Before:** *What should I go to?* (#1, #5)
- **During:** *I missed it, catch me up; who should I meet?* (#2, #4)
- **After:** *What did I learn, who did I meet, what do I do now?* (#3, #6)

That's a search-and-retrieval problem at its core, which is exactly what Elasticsearch is for, and it's one KubeCon judges have personally felt.

---

# Round 2: deeper dig (read in full: two HN threads, an r/kubernetes first-timer thread, a "don't do this at KubeCon" post by a 2x KubeCon speaker, recent KubeCon EU 2025 / NA 2025 recaps)

Note: reddit.com blocks both the search tool and the in-app browser, so Reddit content comes via mirror/archive sites. The richest raw rants were on Hacker News.

## Scale check (why this is getting worse)
- KubeCon EU London 2025: **~12,500 attendees, 325 sessions, 665 speakers**. KubeCon NA Atlanta 2025: **9,000+** over 4 days.
- Attendees: "multiple interesting sessions at the same time, sometimes five or more." Picking sessions was "the most challenging part of the event."
- Atlanta 2025: you "couldn't go five minutes without hearing someone talk about AI" (exciting or exhausting depending on who you asked). Also wonky Wi-Fi and cancelled flights, and one attendee "didn't meet as many people as they had hoped."

## New / sharpened problems

### A. "Should I go to this talk, or watch it on YouTube later?" (new, very KubeCon)
- Veterans say most talks are recorded, so hand-pick a few and spend the rest of the time with people. HN: skip most talks, maybe 1–2 a day.
- But first-timers literally ask "how do I pick which talks to attend versus just watching them later?" Nobody helps with that decision.
- What's actually worth seeing live is the stuff that *isn't* recorded or replicable: Q&A with the speaker, the unconference/maintainer sessions, the project pavilion, side events.
- **The insight: the scarce thing at KubeCon isn't content, it's live access to people.**

### B. Networking with zero context
- HN, paraphrased: talks end, the speaker is mobbed by 10 people, and everyone else drifts around. It's like a dating site with no bios: no starting point for a conversation. Every chat goes profession → company → awkward silence.
- An r/kubernetes first-timer wants "networking without it feeling forced or salesy."
- Veteran answers: ask "what are you working on / what brought you here," and go to the project pavilion and smaller side events.
- **Underlying need:** "Show me who here is working on the problem I have, and give us an opener."

### C. Coming home with "just stickers and no real takeaways"
- Near-verbatim fear from the r/kubernetes first-timer thread (KubeCon Amsterdam 2026): worried about ending up with a pile of stickers and no actionable ideas, and being worn out.
- HN: "I have to *prove* I took something away to justify the expense to my company." People take heavy notes specifically to re-present the talk at work. Others say whoever goes must do a summary session for the team with takeaways and what to adopt next.
- **Underlying need:** turn what I saw and heard into a team-ready report and action items, tied to *my* stack.

### D. Burnout / energy is the real limit
- KubeCon is a "firehose": 25,000–40,000 steps a day, "day 2 exhaustion is very real," "trying to do everything and end up enjoying nothing." Advice: leave 50% of the schedule open, pick only 1–2 evening events.
- **Underlying need:** a plan that's deliberately *less*, not more, so you protect energy for what matters most to you.

### E. Side events and after-hours are where networking happens, but they're scattered
- "Most of it happens at after-hours events" (a KubeCon Amsterdam attendee on HN). Cloud Native Rejekts, the Maintainer Summit and co-located days are "less crowded, rich in honest conversations." Dozens of parties and meetups each night, spread across Luma, Slack, LinkedIn and vendor sites.
- **Underlying need:** one place to find *which* side events match me, without FOMO-driven overbooking.

### F. Talk quality / level mismatch
- A packed 100-person hall with slides of 16 lines of 8-point code, so the attendee walked out. Talks are "above or below my skill level," "hastily put together," "annoying sales pitches." "Conference talks are 90% worthless to me" (HN).
- What people value more: **open sessions / unconferences** (circles of chairs, anyone proposes a topic), and lunch with strangers.
- **Underlying need:** know a talk's real depth and level before walking in, and know whether it's a pitch.

### G. Expo floor
- Worth it to "talk to engineers (not just marketers)" and see real demos. The pain is finding *which* of hundreds of booths are relevant to what you run, without getting badge-scanned into spam.

## Updated ranking (pain × frequency × KubeCon-relevance × how much software can help today)

| # | Problem | Signal strength | Software-solvable today? |
|---|---|---|---|
| 1 | Choosing what's worth doing **live** vs later (talks, booths, side events), personalized to my work | Very high (every source) | Yes, a search/recommendation problem |
| 2 | Networking without context ("no bios"), finding people on the same problem | Very high | Yes, matching on what people work on |
| 3 | No takeaways / proving ROI / the trip report | High (HN, Reddit, toolkits) | Yes, capture → summarize → report |
| 4 | Forgetting who you met and what you said | High (Reddit) | Yes, if capture takes <10s |
| 5 | Missed talks / full rooms / recordings weeks later | High | Partly (summaries need the content) |
| 6 | Burnout / overplanning | Medium-high | Partly (plan *less*) |
| 7 | Side events scattered | Medium | Yes, but data is scattered too |
| 8 | Talk level/pitch mismatch | Medium | Yes, via abstract analysis |
| 9 | Badge spam, Wi-Fi, lines, registration | Medium | Mostly not |

## The sharpened pattern
Round 1 said attendees have no memory or filter. Round 2 adds: **what people actually want from KubeCon is people and live moments, not content**, but every tool they have (Sched, the app) is a list of content. Veterans have learned to skip talks and chase conversations. First-timers don't know how, and everyone goes home struggling to show what they got out of it.

## Sources
- [HN: What's the point of tech conferences?](https://news.ycombinator.com/item?id=35684599)
- [HN: End of the conference era?](https://news.ycombinator.com/item?id=16173031)
- [r/kubernetes first-timer thread, KubeCon Amsterdam (mirror)](https://yomotherboard.com/question/tips-for-making-the-most-of-your-first-kubecon-experience/)
- [Diana Todea: Top 10 things not to do at KubeCon](https://medium.com/@dianatodea/top-10-things-not-to-do-at-kubecon-if-you-want-to-actually-enjoy-it-1b9e63c2bec5)
- [CNCF KubeCon EU 2025 transparency report](https://www.cncf.io/wp-content/uploads/2025/06/KubeCon_EU_25_TransparencyReport.pdf)
- [Redpill Linpro: KubeCon EU 2025 travel blog](https://careers.redpill-linpro.com/posts/travel-blog-kubecon-cloudnativecon-europe-2025)
- [Abdel Sghiouar: Guide to KubeCon London 2025](https://boredabdel.medium.com/your-guide-to-kubecon-london-in-2025-a1fc7c873df1)
- [Devoteam: KubeCon London 2025](https://www.devoteam.com/en-nl/expert-view/kubecon-london-2025-highlights/)
- [MetalBear: KubeCon Atlanta takeaways](https://metalbear.com/blog/kubecon-atlanta-takeaways/)
- [Backstage: BackstageCon / KubeCon NA 2025](https://backstage.io/blog/2025/11/25/backstagecon-kubecon-25-atlanta/)
- [Crisci Solutions: KubeCon NA 2025](https://www.crisci-solutions.co.uk/blog/kubecon-atlanta-2025/)
- [Skift: Overwhelmed attendees crave personalized recommendations](https://skift.com/2019/03/06/overwhelmed-conference-attendees-crave-personalized-recommendations/)
- [Pete Warden: My conference wishlist](https://petewarden.com/2007/10/05/my-conference-w/)
- [Eric Holscher: Questions after talks at conferences](https://ericholscher.com/blog/2016/nov/12/questions-at-conferences/)

## Sources (round 1)
- [KubeCon "AI fatigue" (ITPro)](https://www.itpro.com/technology/artificial-intelligence/kubecon-groans-point-to-growing-ai-fatigue)
- [CNCF on registration failure / AI keynote (The Register via CNCF)](https://cncf.io/news/2024/03/22/the-register-cncf-boss-talks-irrational-exuberance-in-an-ai-heavy-kubecon-keynote)
- [KubeCon 2019: 12–22 tracks (Niteo)](https://blog.niteo.co/kubecon-2019/)
- [KubeCon 2017: overflowing talks (Lee Briggs)](https://leebriggs.co.uk/blog/2017/03/30/kubecon-day-3.html)
- [Thoughts on KubeCon 2021: recordings minutes later (StormForge)](https://stormforge.io/blog/thoughts-kubecon-2021)
- [The good, the bad and the ugly: KubeCon EU 2019](https://medium.com/polarsquad/the-good-the-bad-and-the-ugly-kubecon-europe-2019-be959ee8106e)
- [KubeCon NA 2018 recap: badges, small rooms (Chris Short)](https://chrisshort.net/kubecon-cloudnativecon-na-2018)
- [r/kubernetes: "Am I doing KubeCon wrong?"](https://redlib.hyperreal.coffee/r/kubernetes/comments/1jpu0o9/am_i_doing_kubecon_wrong/ml6o0i7/?context=3)
- [r/kubernetes first-timer overwhelmed (snapshot)](https://reddit.sentinel-team.org/posts/1qum232/snapshots/2026-02-04T05%3A30%3A42.193926Z)
- [Reddit: forgetting conversations after conferences (snapshot)](https://reddit.sentinel-team.org/posts/1tgrxga/snapshots/2026-05-20T21%3A16%3A21.161297Z)
- [Reddit: networking advice is built for extroverts (snapshot)](https://reddit.sentinel-team.org/posts/1r2zqeo/snapshots/2026-02-12T23%3A30%3A15.787296Z)
- [r/MachineLearning: tips for networking as an introvert](https://libreddit.winscloud.net/r/MachineLearning/comments/1nrptrp/d_tips_for_networking_at_a_conference)
- [HN: "Conferences are generally a waste of time"](https://home5.southeastasia.cloudapp.azure.com/item?id=1840492)
- [Slashdot: Are tech conferences overrated?](https://it.slashdot.org/story/18/06/02/2038208/are-tech-conferences-overrated)
- [Hallway track (hamatti)](https://notes.hamatti.org/Communities/Hallway-track)
- [Vendor tactics: scanning without consent (Security Boulevard)](https://securityboulevard.com/2025/04/vendor-sales-tactics-the-good-the-bad-and-the-bathroom)
- [Post-conference inbox (SC World)](https://www.scworld.com/news/how-to-manage-your-security-post-conference-inbox)
- [Spam after DevSummit (Esri community)](https://community.esri.com/thread/230513-spam-emails-after-devsummit)
- [Stateshift: KubeCon badge scanning critique](https://blog.stateshift.com/?p=3234)
- [Conference Wi-Fi problem (Joel Spolsky)](https://www.joelonsoftware.com/2009/10/08/the-wifi-at-conferences-problem/)
- [Event app adoption/frustrations (Successful Meetings)](https://www.successfulmeetings.com/News/Research-Whitepapers/Most-Event-Planners-Still-Lack-Mobile-Apps-Survey-Shows)
- [Registration & check-in pain (etouches survey)](https://www.meetings-conventions.com/News/Meetings-Technology/Technology-challenges-meeting-Event-Planners-Etouches-Survey)
- [Trip report / justification toolkit (AAOE)](https://s4.goeshow.com/aaoe/annual/2022/justification_toolkit.cfm)
- [Convince your boss (GTM Now)](https://gtmnow.com/convince-boss-send-conference/)
