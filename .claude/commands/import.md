---
description: "Bring RiskMan data across from a report saved as CSV: the incident register, then the feedback register, one service at a time. Dry run first."
---

# import

Bring RiskMan data across from a report saved as CSV: the incident register, then the feedback register, one service at a time. Dry run first.

Run `node scripts/incidents.mjs import riskman <file.csv> --kind=incidents|feedback --service=<service> [--map=<map.json>] [--dry-run] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Read `docs/replace-riskman.md` first. Always run with --dry-run and show the counts before the real import.
