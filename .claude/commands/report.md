---
description: "Log a new incident from what the reporter says: when it happened, where, the category, who was affected (record number only, never a name in the summary), what happened and what was done straight away."
---

# report

Log a new incident from what the reporter says: when it happened, where, the category, who was affected (record number only, never a name in the summary), what happened and what was done straight away.

Run `node scripts/incidents.mjs report --service=<service> [--unit=<unit>] --at="<YYYY-MM-DD HH:MM>" --category=<category> [--person=patient|resident|client|visitor|staff] [--person-ref="<NHI or UR>"] --summary="<what happened>" [--action="<immediate action>"] [--harm=<harm>] [--by="<reporter>"] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Read the summary back and ask the manager to rate it (`/rate`).
