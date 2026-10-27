---
description: "Every dated obligation still owed in the next N days (default 30), or every obligation on one record, with its due date and the rule."
---

# obligations

Every dated obligation still owed in the next N days (default 30), or every obligation on one record, with its due date and the rule.

Run `node scripts/incidents.mjs obligations [<ref>] [--days=<n>]`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Group by record. Say which ones are the law.
