---
description: "Record one step of open disclosure or the Victorian duty of candour: apology, meeting arranged, meeting held, notes given, final report given, or the patient opted out (signed statement)."
---

# disclose

Record one step of open disclosure or the Victorian duty of candour: apology, meeting arranged, meeting held, notes given, final report given, or the patient opted out (signed statement).

Run `node scripts/incidents.mjs disclose <ref> --step=apology|arranged|meeting|notes|report|opted-out [--at="<YYYY-MM-DD HH:MM>"] [--lead=<name>] [--note="<what was said>"] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

Say which step is next and its due date.
