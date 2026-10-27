---
description: "Change a timeframe or house rule (whole numbers of days or working days). Shows what it was."
---

# set

Change a timeframe or house rule (whole numbers of days or working days). Shows what it was.

Run `node scripts/incidents.mjs set <key> <value> --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Run with no arguments to see the keys. A legal timeframe changes only when the operator confirms the rule changed; update docs/compliance.md in the same step.
