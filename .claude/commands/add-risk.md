---
description: "Add a risk to the register, scored likelihood 1 to 5 by consequence 1 to 5, with controls, an owner and a review cycle."
---

# add-risk

Add a risk to the register, scored likelihood 1 to 5 by consequence 1 to 5, with controls, an owner and a review cycle.

Run `node scripts/incidents.mjs add-risk --title="<risk>" --likelihood=<1-5> --consequence=<1-5> --owner=<name> [--service=<service>] [--category=<category>] [--controls="<controls>"] [--every=<days>] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.
