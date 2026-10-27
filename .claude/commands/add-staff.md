---
description: "Add a staff member who reports, manages or reviews."
---

# add-staff

Add a staff member who reports, manages or reviews.

Run `node scripts/incidents.mjs add-staff --code=<CODE> --name="<name>" [--role="<role>"] [--email=<email>] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
