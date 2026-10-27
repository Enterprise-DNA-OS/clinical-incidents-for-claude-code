---
description: "Log a complaint, compliment or suggestion: who from, how it came in, what it is about, and the incident it relates to. Shows every clock that starts."
---

# log-feedback

Log a complaint, compliment or suggestion: who from, how it came in, what it is about, and the incident it relates to. Shows every clock that starts.

Run `node scripts/incidents.mjs log-feedback --service=<service> --from="<name>" --about="<what they said>" [--kind=complaint|compliment|suggestion] [--via=<email|phone|letter|in-person|web|hdc|advocate>] [--contact="<contact>"] [--category=<category>] [--incident=<ref>] [--handler=<name>] [--date=<YYYY-MM-DD>] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

For a New Zealand complaint, say the written acknowledgement is due in 5 working days and offer `/draft-acknowledgement`.
