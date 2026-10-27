---
description: "Add a ward, department or team to a service."
---

# add-unit

Add a ward, department or team to a service.

Run `node scripts/incidents.mjs add-unit --service=<service> --code=<CODE> --name="<name>" --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
