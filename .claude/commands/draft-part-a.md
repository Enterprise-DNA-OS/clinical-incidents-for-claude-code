---
description: "Draft the HQSC Part A brief for a New Zealand SAC 1 or 2 or ARR event to drafts/, pre-filled from the record with no names or NHI."
---

# draft-part-a

Draft the HQSC Part A brief for a New Zealand SAC 1 or 2 or ARR event to drafts/, pre-filled from the record with no names or NHI.

Run `node scripts/incidents.mjs draft-part-a <ref>`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Draft only. Once sent, run `/notify` with --to=hqsc-part-a and the HQSC reference.
