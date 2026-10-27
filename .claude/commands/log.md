---
description: "Add a note to an incident, complaint or risk history."
---

# log

Add a note to an incident, complaint or risk history.

Run `node scripts/incidents.mjs log <INC-|FB-|RSK- ref> --note="<note>" --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
