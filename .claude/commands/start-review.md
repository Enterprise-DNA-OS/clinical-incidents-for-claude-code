---
description: "Start a formal review of an incident (RCA, London Protocol, ALARM, case review, after-action) with a lead and a due date."
---

# start-review

Start a formal review of an incident (RCA, London Protocol, ALARM, case review, after-action) with a lead and a due date.

Run `node scripts/incidents.mjs start-review <ref> --method=<method> --lead=<name> [--due=<YYYY-MM-DD>] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
