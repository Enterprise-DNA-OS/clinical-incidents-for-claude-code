---
description: "Actions from incidents, reviews, complaints and risks: open by default, or one owner, or all."
---

# actions

Actions from incidents, reviews, complaints and risks: open by default, or one owner, or all.

Run `node scripts/incidents.mjs actions [--owner=<name>] [--all]`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Overdue first, by owner.
