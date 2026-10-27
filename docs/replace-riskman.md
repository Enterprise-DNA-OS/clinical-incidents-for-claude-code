# Moving off RiskMan

You can run this beside RiskMan for a month, then switch. Your history comes across from RiskMan's own reports saved as CSV.

## 1. Export from RiskMan

RiskMan's reports are set up by each site, so there is no single export file. Build (or ask your RiskMan administrator for) two reports and save each as CSV:

- **The incident register:** one row per incident with its number, incident date and time, date reported, department or unit, incident type, person type, brief description, outcome or harm, SAC or ISR rating, who reported it and its status.
- **The feedback register:** one row per piece of feedback with its number, date received, feedback type (complaint, compliment, suggestion), the complainant's name, the details, date acknowledged, date closed and outcome.

Run one export per service (hospital, day surgery, community team), because each service has its own region and its own rules.

Never put a patient's name in the export. The import keeps the person type and the description; record numbers (NHI, UR) can be added later.

## 2. Try it on the examples

```bash
node scripts/incidents.mjs import riskman examples/riskman/incident-register.csv --kind=incidents --service=TW-AKL --dry-run --actor="Your name"
```

## 3. Set up your services, then import

```bash
node scripts/incidents.mjs add-service --code=AKL --name="Your Hospital Auckland" --kind=hospital --region=NZ --actor="Your name"
node scripts/incidents.mjs import riskman incidents-akl.csv --kind=incidents --service=AKL --dry-run --actor="Your name"
node scripts/incidents.mjs import riskman incidents-akl.csv --kind=incidents --service=AKL --actor="Your name"
node scripts/incidents.mjs import riskman feedback-akl.csv --kind=feedback --service=AKL --actor="Your name"
```

Every import is one transaction: if any row fails, nothing is kept and the row number is named. Running it twice skips what is already there.

## What the import looks for

| Field | Column names it accepts |
|---|---|
| Reference | Incident Number, Incident No, Incident ID, ID, Reference |
| When it happened | Incident Date, Date of Incident, Date Occurred, Event Date (plus Incident Time, Time of Incident, Time) |
| When it was reported | Date Reported, Reported Date, Notification Date, Date Notified, Entered Date |
| Unit | Department, Unit, Ward, Location (new units are created) |
| Category | Incident Type, Incident Category, Category, Type, Classification |
| Person | Person Type, Person Involved, Affected Person Type |
| What happened | Brief Description, Description, Summary, Incident Description, Details |
| Harm | Outcome, Harm, Consequence, Level of Harm |
| Rating | SAC, ISR, Severity, Risk Rating, Severity Rating (the first digit 1 to 4) |
| Reporter, status | Reported By, Notifier, Reporter; Status, Incident Status |

Feedback: Feedback Number, Date Received, Feedback Type, Complainant, Details, Date Acknowledged, Date Closed, Outcome (and the usual alternatives).

Dates may be `21/10/2026`, `2026-10-21`, `21-Oct-2026`, with or without a time.

If your columns are named differently, write a small map file and pass `--map=map.json`:

```json
{ "id": "Incident No.", "summary": "Brief Description of Incident", "severity": "SAC Score" }
```

## What maps, and what does not carry over

| RiskMan | Here |
|---|---|
| Incident types (your site's own list) | One of 15 categories, matched on words (falls, medication, pressure injury, surgical, deterioration...). Anything unmatched goes to `other` with the original type kept in the summary, so you can sort it. |
| Outcome or harm wording | none, near-miss, mild, moderate, severe, death, matched on words. Unmatched is left blank to rate. |
| SAC or ISR | severity 1 to 4, rated at the reported time by "RiskMan import". |
| Closed status | closed at the reported time. |
| Feedback type | complaint, compliment or suggestion. |
| Closed complaints | outcome kept; set to not justified until you change it, because exports rarely say. |

Not carried over: attachments, the investigation forms and their custom fields, the full action history, user accounts and RiskMan's own audit trail. Keep the RiskMan export files as your record of history before the switch. Enterprise DNA maps the extra fields (investigation forms, actions, the risk register) as part of a customised version.

## After the import

1. `node scripts/incidents.mjs incidents --category=other` and fix the categories.
2. `node scripts/incidents.mjs attention`: open incidents from RiskMan now have their clocks. Rate and assign anything still open.
3. Add next year's public holidays (`/add-holiday`).
