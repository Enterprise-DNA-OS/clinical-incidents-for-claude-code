<h1 align="center">Clinical Incidents for Claude Code</h1>

<p align="center">
  <strong>The open-source clinical incident and feedback system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your RiskMan data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=riskman">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/riskman?utm_source=github&utm_medium=readme&utm_campaign=riskman">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-riskman">Instead of RiskMan</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Clinical Incidents for Claude Code does the job you pay RiskMan for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the RiskMan dashboard cannot.

RiskMan has no public price. It is sold by RLDatix on quote to mid-market and enterprise health providers, and RLDatix now offers RiskMan customers migration options: move to RiskMan Cloud, or explore DatixCloudIQ ([rldatix.com](https://www.rldatix.com/en-apac/solution/risk-safety/riskman/), checked 27 October 2026). Whichever way you go, you are moving. Here the database is yours and there is no annual quote.

Want the same thing with a two-minute reporting form for ward staff, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=riskman).

It covers a private hospital, day surgery, aged care home, community team or clinic group in New Zealand or Australia: incidents with their severity rating (SAC, or ISR in Victoria), harm and sentinel event category, open disclosure, formal reviews (RCA, London Protocol, case review), actions, reports to outside bodies, complaints and compliments, and the risk register. Every dated rule is a clock counted in working days for each service's region: the HDC Code of Rights Right 10 complaint timeframes in New Zealand, HQSC Part A and Part B for SAC 1 and 2 events, and the Victorian statutory duty of candour (Health Services Act 1988 (Vic) Part 5A). [docs/compliance.md](docs/compliance.md) has every rule with its source.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/clinical-incidents-for-claude-code.git
cd clinical-incidents-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. Try `/compliance`, `/complaints` and `/insights` next.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Every clock overdue or due in seven days, the law first: HDC Right 10, the duty of candour, HQSC Part A and B, open disclosure, ratings, reviews, actions and risk reviews. Then late reports, incidents with no manager, open sentinel events and extreme risks |
| `/compliance` | Each legal and policy timeframe: overdue, due soon, met late and met, with the worst case and the rule cited from [docs/compliance.md](docs/compliance.md) |
| `/report` | Log a new incident from what the reporter says |
| `/rate` | A manager's rating: severity 1 to 4, harm, sentinel or ARR. Shows every clock that starts |
| `/disclose` | One step of open disclosure or the duty of candour: apology, meeting arranged, held, notes, final report, opted out |
| `/start-review`, `/finish-review` | A formal review with a lead, a due date and findings |
| `/add-action`, `/action-done` | What will change, who owns it, by when, and the evidence it was done |
| `/notify` | Record a report sent outside: HQSC Part A or B, the state health department, a coroner, WorkSafe, the insurer |
| `/close` | Close an incident. Refuses while it is unrated, a clock is open or an action is open; an override needs a reason |
| `/log-feedback` | Log a complaint, compliment or suggestion and show its clocks |
| `/acknowledge`, `/decide`, `/contact`, `/resolve` | Each Right 10 step for a complaint |
| `/risks`, `/add-risk`, `/review-risk` | The risk register, scored likelihood by consequence, with review cycles |
| `/trends` | Incidents per month by category for each service, six months |
| `/draft-acknowledgement` | The written acknowledgement of a complaint, to `drafts/` |
| `/draft-candour-report` | The final written report for a serious event, with the s 128ZC headings |
| `/draft-part-a` | The HQSC Part A brief, pre-filled with no names or NHI |
| `/draft-committee-report` | The monthly clinical governance committee report |
| `/weekly-review` | The Monday review, written to `drafts/` |
| `/insights` | The ten questions below |

The reads: `/incidents`, `/incident`, `/obligations`, `/disclosures`, `/reviews`, `/actions`, `/complaints`, `/complaint`, `/risk`, `/sentinel`, `/services`, `/staff`, `/holidays`, `/activity`. Setup: `/add-service`, `/add-unit`, `/add-staff`, `/add-holiday`, `/assign`, `/close-risk`, `/set`, `/log`. Plus `/import`, `/export`, `/view`, `/documents`, `/new-view` and `/customise`. 54 commands in all.

Names match case-insensitively. A partial name or reference works when it is unique; when it is not, the command lists the candidates and stops.

## The gates

- `/close` refuses an unrated incident outright. It refuses while any clock on the incident is open or any action is open, unless `--override` gives a reason, which goes in the activity log.
- `/rate` refuses a sentinel category without serious harm or death (except suspected suicide in an acute psychiatric unit and release of a child to an unauthorised person).
- `/decide` refuses a complaint that has not been acknowledged, and warns when more than 20 working days are needed and the consumer has not been told why (Right 10(7)(b)(ii)). `/resolve` refuses a complaint with no decision.
- `/action-done` needs the evidence. The activity log is append-only, in the database.
- The working-day clock skips weekends, the public holidays for each service's region and, in New Zealand, 25 December to 2 January.

The software records and checks; the quality team decides. It is not legal or clinical advice, and it sends nothing.

## Instead of RiskMan

RiskMan's reports save as CSV. Export the incident register and the feedback register for each service, add the service, then import, dry run first:

```bash
node scripts/incidents.mjs import riskman incidents.csv --kind=incidents --service=AKL --actor="Your name" --dry-run
node scripts/incidents.mjs import riskman feedback.csv --kind=feedback --service=AKL --actor="Your name" --dry-run
```

The [switching guide](docs/replace-riskman.md) covers the column names it reads, `--map` for your own, and what does and does not come across. Imports are atomic: repeat rows are skipped and one bad row stops the whole file.

## Ten questions answered from your records

`/insights` runs all ten today.

1. Which legal or policy deadlines did we miss or meet late this year, and by how many days?
2. How long does each service take to rate a new incident?
3. Which units report late, more than a day after the event?
4. Which categories are rising: the last two months against the four before?
5. Which complaints are linked to an incident, and was disclosure done before the complaint arrived?
6. Who owns the most overdue actions, and how old is the oldest?
7. Which open risks have had matching incidents in the last 90 days?
8. How many working days does each service take to close a complaint?
9. Which incidents with harm have no review, no action and no disclosure recorded?
10. What share of incidents happen at night, by service and category?

## Your first hour: ten things to ask for

1. What needs my attention today?
2. Which complaints are about to breach Right 10?
3. Is anything under the duty of candour behind?
4. Priya just rang: a patient on Ward 3 fell at 2 am, no injury found. Log it.
5. Rate INC-1006 as SAC 4, near miss, and give it to Michael.
6. Which SAC 2 events have no review started?
7. Draft the acknowledgement for Grace Whitford's complaint.
8. Draft the HQSC Part A brief for the opioid error.
9. Write this month's committee report for Auckland.
10. Which falls happened at night in the last six months, and is the falls risk scored right?

## Architecture

```
clinical-incidents-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/incidents.mjs     the one CLI the commands drive
  scripts/lib/domain.mjs    the rules: every read, write, draft, import and export
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the rules (compliance.md), the migration guide, why no front end
  documents.json            the paperwork npm run docs renders
  views.json                the dashboards npm run view renders
  examples/riskman/         sample RiskMan exports for a test import
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Clinical Incidents for Claude Code for your business, migrates your RiskMan data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=riskman)
- Read more: [enterprisedna.co/omni/instead-of/riskman](https://enterprisedna.co/omni/instead-of/riskman?utm_source=github&utm_medium=readme&utm_campaign=riskman)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
