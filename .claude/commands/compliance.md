---
description: "Check the records against the rules in docs/compliance.md: for each legal and policy timeframe, how many are overdue, due soon, met late and met, with the worst example and the rule cited."
---

# compliance

Check the records against the rules in docs/compliance.md: for each legal and policy timeframe, how many are overdue, due soon, met late and met, with the worst example and the rule cited.

Run `node scripts/incidents.mjs compliance`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Show the table, breached first. For each breach, name the record and draft the fix the operator can approve. If a rule in docs/compliance.md looks out of date, say so and stop: the operator confirms the rule, then you update the doc, the setting and the check together. Nothing here is legal advice.
