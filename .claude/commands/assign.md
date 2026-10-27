---
description: "Give an incident a manager."
---

# assign

Give an incident a manager.

Run `node scripts/incidents.mjs assign <ref> --manager=<name> --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
