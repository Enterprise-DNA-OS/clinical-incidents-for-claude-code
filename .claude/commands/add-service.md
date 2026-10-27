---
description: "Add a service: a hospital, day surgery, aged care home, community team or clinic, with its region (NZ or an Australian state), which sets the rules and the holidays."
---

# add-service

Add a service: a hospital, day surgery, aged care home, community team or clinic, with its region (NZ or an Australian state), which sets the rules and the holidays.

Run `node scripts/incidents.mjs add-service --code=<CODE> --name="<name>" --kind=<kind> --region=<NZ|VIC|NSW|...> [--beds=<n>] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
