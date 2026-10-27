---
description: "A manager rates an incident: severity 1 to 4 (SAC in New Zealand and NSW, ISR in Victoria), the harm, and whether it is a sentinel event or on the HQSC Always Report and Review list. Shows every clock that starts."
---

# rate

A manager rates an incident: severity 1 to 4 (SAC in New Zealand and NSW, ISR in Victoria), the harm, and whether it is a sentinel event or on the HQSC Always Report and Review list. Shows every clock that starts.

Run `node scripts/incidents.mjs rate <ref> --severity=<1-4> --harm=<none|near-miss|mild|moderate|severe|death> [--sentinel=<1-10>] [--arr] [--psychological] [--manager=<name>] --actor="<name>"`. Add `--json` when you need every field. Resolve the service, staff member or record by name first; if the CLI says a name is ambiguous, list the candidates and ask. Replace every angle-bracket value with a fact from the records or the operator. Never run a placeholder.

List what is now owed and by when.
