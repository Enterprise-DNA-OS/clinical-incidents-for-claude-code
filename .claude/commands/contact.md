---
description: "Record contact with the person who complained: a progress update, or telling them more time is needed and why."
---

# contact

Record contact with the person who complained: a progress update, or telling them more time is needed and why.

Run `node scripts/incidents.mjs contact <ref> --note="<what was said>" [--told-more-time] [--date=<YYYY-MM-DD>] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
