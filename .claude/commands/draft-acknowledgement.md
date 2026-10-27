---
description: "Draft the written acknowledgement of a complaint to drafts/: what they told us, who is looking into it, the timeframes, and (in New Zealand) the advocacy service."
---

# draft-acknowledgement

Draft the written acknowledgement of a complaint to drafts/: what they told us, who is looking into it, the timeframes, and (in New Zealand) the advocacy service.

Run `node scripts/incidents.mjs draft-acknowledgement <ref>`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Draft only. A person sends it, then runs `/acknowledge`.
