# Review rules for this repo (conference app)

When reviewing a PR, check these project-specific rules and flag any violation:

1. **Time zones:** every session start/end time must carry a time zone (store ISO 8601 with offset, or UTC plus a named zone). Flag naive datetimes.
2. **No double-booking:** the same room or the same speaker must never be scheduled for two overlapping sessions. Flag schedule data or logic that allows it.
3. **Accessibility metadata:** every session record must include accessibility fields (for example captions, step-free access, quiet room). Flag new data or UI that omits them.
4. **API and frontend stay consistent:** if an API response shape changes, the frontend code and types that use it must change in the same PR.
5. **Secrets:** never commit API keys, tokens or `.env` files. Config comes from environment variables, with only a `.env.example` committed.
6. **Elasticsearch is the only data store** for talks, speakers and attendees. Flag any other database.
7. **Readable code:** prefer simple code with short comments on the non-obvious parts. Flag clever or unexplained code.
8. **Privacy:** never log, trace or send to telemetry the text of questions, transcripts, profile fields or GitHub data. Log IDs and counts only.
9. **Traced calls only:** every Elasticsearch and OpenAI call goes through `web/lib/es.ts` / `web/lib/ai.ts` (or the worker's equivalents) so it gets a span. Flag direct client use elsewhere.
10. **Opt-in matching:** blind profile fields only until a match is `mutual`. Flag any API that returns names, photos or exact companies earlier.
11. **Speaker anonymity:** speaker views must never show a question cluster or signal bucket from fewer than 3 people, and never show who asked.
12. **Types in sync:** API responses use types from `shared/types.ts`; when `shared/types.ts` or the ES mappings in `scripts/es-setup.ts` change, both sides must change in the same PR.
13. **Accessible UI:** every interactive element has an accessible label; captions must stay readable (contrast, adjustable size).

## Added from the review fixes (Nov 9)

14. **Anonymous ids:** never read or write personal data (profiles, schedules, notes, folders) under the shared id `anonymous`. Use `isAnonymous()` from `web/lib/identity.ts` and refuse. Flag any path that skips it.
15. **Server enforces no double-booking:** `parseBlocks` (and any schedule write) must reject overlapping talks, events or held handoffs. Open handoff slots may sit under other blocks. Flag client-only checks.
16. **Accessibility survives edits:** when a plan block or alternative is built, copied, swapped or saved, its `accessibility` must carry through. Flag helpers that rebuild blocks field by field and drop it.
17. **Unknown is not "no":** accessibility facts are `true` only when stated, otherwise `null`. Flag any code that writes `false` from missing text.
18. **Errors are not "empty":** a failed read must never look like "no data". Only a real 404 may mean "none"; other failures must surface (e.g. 502) so a client never overwrites saved data.
19. **Batch model calls:** long inputs go to the model in batches, and no input is silently dropped. Flag `slice(0, N)` that discards the rest.
20. **Pass dates to the model:** time-relative words ("tonight", "tomorrow") need the message's posted date in the prompt. Flag prompts that resolve them against today.
21. **Scope by conference:** notes, saved talks, folders and exports must filter by `conference_id` when a conference is shown. Flag cross-conference leaks.
22. **Folder creation is race-safe:** deterministic folder ids from owner + lowercased name with `op_type: create`. Return the folder actually used so the UI never claims a folder it did not use.
23. **Explicit prefixes win:** `note:`, `todo:`, `jot down` always save a note, even when they end in `?`. Bare words (`remember`, `save`) do not. Flag classifier changes that break this.
24. **One mapping, two paths:** auto-save and manual save of the same card must use the same folder mapping (`folderFor`). Flag duplicated mappings.
25. **Only cards for real matches:** a stored match must produce a card so it can become mutual. Never store another person's own problem as a shared one.
