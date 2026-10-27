---
description: "List incidents: open by default, or filter by service, status, category or days."
---

# incidents

List incidents: open by default, or filter by service, status, category or days.

Run `node scripts/incidents.mjs incidents [--service=<service>] [--status=reported|under-review|closed|open] [--category=<category>] [--days=<n>] [--all]`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Severity 1 and 2 and sentinel events first.
