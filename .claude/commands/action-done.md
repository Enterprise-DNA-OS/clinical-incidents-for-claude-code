---
description: "Mark an action done, with the evidence that it was done."
---

# action-done

Mark an action done, with the evidence that it was done.

Run `node scripts/incidents.mjs action-done <ACT- ref> --evidence="<what shows it is done>" --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

No evidence, not done.
