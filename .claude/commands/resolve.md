---
description: "Record the outcome of a complaint (or close a compliment or suggestion)."
---

# resolve

Record the outcome of a complaint (or close a compliment or suggestion).

Run `node scripts/incidents.mjs resolve <ref> --outcome="<what was decided and done>" [--decision=justified|not-justified] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
