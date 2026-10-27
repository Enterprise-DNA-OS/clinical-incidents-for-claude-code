# Clinical Incidents for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR HOSPITAL, DAY SURGERY OR HEALTH SERVICE]
- **Operator:** [YOUR NAME], [your role: quality and risk manager, director of nursing, consumer liaison]
- **What matters most:** [for example: no complaint breaches Right 10, every SAC 1 and 2 reviewed on time, the committee pack ready on the first Thursday]

Fill this in once. A worker with context knows. A worker without it guesses.

The work is a health provider's incident and feedback system in New Zealand or Australia: services and their units, incidents with severity ratings and harm, open disclosure and the Victorian duty of candour, formal reviews, actions, reports to outside bodies, complaints and compliments, and the risk register.

## Rules

- Read the CLI result before answering. Every answer about an incident, complaint or risk starts with data from `node scripts/incidents.mjs`. Never answer from memory.
- Resolve names and references first. If the CLI says one is ambiguous, list the candidates and ask; never pick the first.
- Times are the service's own clock. Write them as `--at="2026-10-21 14:30"`.
- Never put a patient's, resident's or client's name in an incident summary or a draft for an outside body. Use the record number (NHI, UR) in `--person-ref`. Complaints carry the complainant's name because the reply goes to them.
- Never invent a clinical detail, a rating, a harm level, an apology, a reference number or an outcome. Copy them from the reporter, the manager or the record. Rating is a manager's judgement: ask, never guess.
- An override (`close --override`) needs a reason the operator gives. Never invent the reason.
- Never send, call or delete. Acknowledgements, reports and briefs are drafts in `drafts/`; documents are in `docs-out/`. Recording something as sent (`/notify`, `/acknowledge`, `/disclose`) does not send it; a person does that.
- The rules in `docs/compliance.md` are records checks, not legal or clinical advice. If a rule looks out of date, say so and stop. The operator confirms it, then change the setting and the doc together.
- Every write names `--actor`. That is a label in the activity log, not a verified identity.
- Back up before a schema change. Use a new numbered migration (`/customise`), run `npm test`, and keep real data, exports and credentials out of Git. Health information is sensitive: keep the database where your privacy obligations allow.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| Record that a complaint was acknowledged in writing. | `/acknowledge` |
| Mark an action done, with the evidence that it was done. | `/action-done` |
| Actions from incidents, reviews, complaints and risks: open by default, or one owner, or all. | `/actions` |
| Who did what in the last N days (default 7), from the append-only log. | `/activity` |
| Add an action from an incident, a complaint or a risk, with an owner and a due date. | `/add-action` |
| Add a public holiday so the working-day clock skips it (NZ, a state, or AU for a national day). | `/add-holiday` |
| Add a risk to the register, scored likelihood 1 to 5 by consequence 1 to 5, with controls, an owner and a review cycle. | `/add-risk` |
| Add a service: a hospital, day surgery, aged care home, community team or clinic, with its region (NZ or an Australian state), which sets the rules and the holidays. | `/add-service` |
| Add a staff member who reports, manages or reviews. | `/add-staff` |
| Add a ward, department or team to a service. | `/add-unit` |
| Give an incident a manager. | `/assign` |
| Show what needs a person today: every legal, policy and house clock that is overdue or due in seven days (HDC Right 10, the Victorian duty of candour, HQSC Part A and B, open disclosure, ratings, reviews, actions, risk reviews), then late reports, incidents with no manager, open sentinel events and extreme risks. | `/attention` |
| Close a risk that no longer applies, with the reason. | `/close-risk` |
| Close an incident. It refuses while anything is owed or an action is open; --override records the reason. | `/close` |
| One piece of feedback in full: the record, every Right 10 or house clock, actions and history. | `/complaint` |
| Complaints, compliments and suggestions, with the stage each complaint is at and how many working days it has been open. | `/complaints` |
| Check the records against the rules in docs/compliance.md: for each legal and policy timeframe, how many are overdue, due soon, met late and met, with the worst example and the rule cited. | `/compliance` |
| Record contact with the person who complained: a progress update, or telling them more time is needed and why. | `/contact` |
| Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. | `/customise` |
| Record the Right 10(7) decision: justified, not justified, or more time needed (with the number of working days). Over 20 working days, the consumer must be told why. | `/decide` |
| Record one step of open disclosure or the Victorian duty of candour: apology, meeting arranged, meeting held, notes given, final report given, or the patient opted out (signed statement). | `/disclose` |
| Open disclosure and duty of candour for every incident with moderate harm or worse: which steps are done and which are not. | `/disclosures` |
| Render the paperwork in documents.json as branded HTML in docs-out/: incident reports, complaint acknowledgements, open disclosure meeting records, risk registers and governance summaries. | `/documents` |
| Draft the written acknowledgement of a complaint to drafts/: what they told us, who is looking into it, the timeframes, and (in New Zealand) the advocacy service. | `/draft-acknowledgement` |
| Draft the final written report for a serious event to drafts/: what happened, the apology, how the service responded, what will change, who to contact. Covers the matters the Victorian duty of candour requires. | `/draft-candour-report` |
| Draft the monthly clinical governance committee report to drafts/: incidents by service, every legal and policy timeframe, six-month trends, feedback, top risks, and what needs a decision. | `/draft-committee-report` |
| Draft the HQSC Part A brief for a New Zealand SAC 1 or 2 or ARR event to drafts/, pre-filled from the record with no names or NHI. | `/draft-part-a` |
| Export every table to one JSON file you own. | `/export` |
| Record a review as complete with its findings. | `/finish-review` |
| Public holidays the working-day clock skips. Keep it current each year with /add-holiday. | `/holidays` |
| Bring RiskMan data across from a report saved as CSV: the incident register, then the feedback register, one service at a time. Dry run first. | `/import` |
| One incident in full: the record, its rating, disclosure, review, every clock, actions, outside notifications, linked feedback and its history. | `/incident` |
| List incidents: open by default, or filter by service, status, category or days. | `/incidents` |
| The ten questions RiskMan dashboards do not answer: missed timeframes, rating speed, late reporting by unit, rising categories, disclosure before complaints, overdue owners, risks matching incidents, complaint working days, harm with no follow-up, night incidents. | `/insights` |
| Log a complaint, compliment or suggestion: who from, how it came in, what it is about, and the incident it relates to. Shows every clock that starts. | `/log-feedback` |
| Add a note to an incident, complaint or risk history. | `/log` |
| Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. | `/new-view` |
| Record a report sent outside the service: HQSC Part A or Part B, the state health department, a coroner, WorkSafe, the insurer. | `/notify` |
| Every dated obligation still owed in the next N days (default 30), or every obligation on one record, with its due date and the rule. | `/obligations` |
| A manager rates an incident: severity 1 to 4 (SAC in New Zealand and NSW, ISR in Victoria), the harm, and whether it is a sentinel event or on the HQSC Always Report and Review list. Shows every clock that starts. | `/rate` |
| Log a new incident from what the reporter says: when it happened, where, the category, who was affected (record number only, never a name in the summary), what happened and what was done straight away. | `/report` |
| Record the outcome of a complaint (or close a compliment or suggestion). | `/resolve` |
| Review a risk: rescore it, update its controls, and start its next review cycle. | `/review-risk` |
| Formal reviews (RCA, London Protocol, case review) for severity 1 and 2 and sentinel events: not started, open, overdue, done. | `/reviews` |
| One risk in full, its actions, and the incidents in the last 90 days that match it. | `/risk` |
| The risk register: open risks, scored likelihood by consequence, with the review date and open actions. | `/risks` |
| Sentinel events on the Australian list (version 2), with the category in words. | `/sentinel` |
| The services (hospitals, day surgeries, community teams) with open incidents and open complaints. | `/services` |
| Change a timeframe or house rule (whole numbers of days or working days). Shows what it was. | `/set` |
| Staff who report, manage and review, with their open actions. | `/staff` |
| Start a formal review of an incident (RCA, London Protocol, ALARM, case review, after-action) with a lead and a due date. | `/start-review` |
| Incidents per month by category for each service over six months, with how many caused harm. | `/trends` |
| Render the read-only dashboards in views.json (this week, open incidents, feedback, risks) as branded HTML in views/. | `/view` |
| The Monday review, written to drafts/: the law, national policy, reviews, complaints, overdue actions and timeframes missed, then the whole attention list. | `/weekly-review` |

If an ask fits nothing here, run the CLI directly (`node scripts/incidents.mjs --help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/incidents.mjs` the CLI, `scripts/lib/domain.mjs` the rules. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/compliance.md` every rule with its source. `docs/replace-riskman.md` the guide for moving off RiskMan.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/riskman
