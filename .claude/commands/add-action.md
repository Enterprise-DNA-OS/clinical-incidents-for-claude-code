---
description: "Add an action from an incident, a complaint or a risk, with an owner and a due date."
---

# add-action

Add an action from an incident, a complaint or a risk, with an owner and a due date.

Run `node scripts/incidents.mjs add-action <INC-|FB-|RSK- ref> --description="<what will change>" --owner=<name> --due=<YYYY-MM-DD> --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
