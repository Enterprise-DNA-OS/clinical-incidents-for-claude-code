---
description: "Close an incident. It refuses while anything is owed or an action is open; --override records the reason."
---

# close

Close an incident. It refuses while anything is owed or an action is open; --override records the reason.

Run `node scripts/incidents.mjs close <ref> [--note="<note>"] [--override="<reason>"] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Never override without the operator naming the reason.
