---
description: "Record a report sent outside the service: HQSC Part A or Part B, the state health department, a coroner, WorkSafe, the insurer."
---

# notify

Record a report sent outside the service: HQSC Part A or Part B, the state health department, a coroner, WorkSafe, the insurer.

Run `node scripts/incidents.mjs notify <ref> --to=hqsc-part-a|hqsc-part-b|health-department|coroner|worksafe|insurer|other [--reference=<their ref>] [--at="<YYYY-MM-DD HH:MM>"] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

This records that a person sent it. Nothing is sent from here.
