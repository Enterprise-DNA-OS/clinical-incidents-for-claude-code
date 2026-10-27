---
description: "Close a risk that no longer applies, with the reason."
---

# close-risk

Close a risk that no longer applies, with the reason.

Run `node scripts/incidents.mjs close-risk <ref> --reason="<why>" --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
