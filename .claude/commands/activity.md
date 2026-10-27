---
description: "Who did what in the last N days (default 7), from the append-only log."
---

# activity

Who did what in the last N days (default 7), from the append-only log.

Run `node scripts/incidents.mjs activity [--days=<n>]`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
