---
description: "Record a review as complete with its findings."
---

# finish-review

Record a review as complete with its findings.

Run `node scripts/incidents.mjs finish-review <ref> --findings="<findings>" --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Then add an action for each recommendation (`/add-action`).
