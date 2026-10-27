---
description: "Add a public holiday so the working-day clock skips it (NZ, a state, or AU for a national day)."
---

# add-holiday

Add a public holiday so the working-day clock skips it (NZ, a state, or AU for a national day).

Run `node scripts/incidents.mjs add-holiday --date=<YYYY-MM-DD> --region=<NZ|VIC|...|AU> --name="<name>" --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
