# Review rules for this repo (conference app)

When reviewing a PR, check these project-specific rules and flag any violation:

1. **Time zones:** every session start/end time must carry a time zone (store ISO 8601 with offset, or UTC plus a named zone). Flag naive datetimes.
2. **No double-booking:** the same room or the same speaker must never be scheduled for two overlapping sessions. Flag schedule data or logic that allows it.
3. **Accessibility metadata:** every session record must include accessibility fields (for example captions, step-free access, quiet room). Flag new data or UI that omits them.
4. **API and frontend stay consistent:** if an API response shape changes, the frontend code and types that use it must change in the same PR.
5. **Secrets:** never commit API keys, tokens or `.env` files. Config comes from environment variables, with only a `.env.example` committed.
6. **Elasticsearch is the only data store** for talks, speakers and attendees. Flag any other database.
7. **Readable code:** prefer simple code with short comments on the non-obvious parts. Flag clever or unexplained code.
