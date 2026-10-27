---
description: "Review a risk: rescore it, update its controls, and start its next review cycle."
---

# review-risk

Review a risk: rescore it, update its controls, and start its next review cycle.

Run `node scripts/incidents.mjs review-risk <ref> [--likelihood=<1-5>] [--consequence=<1-5>] [--controls="<controls>"] [--note="<note>"] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
