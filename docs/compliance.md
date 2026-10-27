# The rules this system checks

`/compliance` and `/attention` check the records against these rules. Each one has its source, what it means in the data, and where the check lives. Timeframes are settings (`node scripts/incidents.mjs set <key> <value>`), so when a rule changes you change one number and this page in the same step.

Nothing here is legal advice. It records the rules the operator has told the system to enforce, with sources, and checks the data against them. Confirm each rule against the current source before you rely on it, and again whenever the source is revised.

Three kinds, shown in every list:

- **law**: a statute or a code with the force of law.
- **policy**: a national policy or framework the service has signed up to or is assessed against.
- **house**: your own rule. Change these freely.

## Working days

Every working-day and business-day count skips Saturdays, Sundays and the public holidays in the `holidays` table for the service's region (an Australian state's holidays plus the national ones). In New Zealand it also skips 25 December to 2 January, the definition HDC applies to Right 10 timeframes. Keep the holidays table current each year (`/add-holiday`); the demo holds late 2026 and early 2027.

Source: HDC, *Fact Sheet 3: Timeframes for responding to complaints under Right 10 of the Code* ([hdc.org.nz](https://www.hdc.org.nz/media/agwpy53y/factsheet3-timeframesforrespondingtocomplaintsunderright10.pdf)).

## New Zealand: complaints under the HDC Code of Rights, Right 10

The Code of Health and Disability Services Consumers' Rights is a regulation under the Health and Disability Commissioner Act 1994. Right 10 sets the complaint timeframes for every health and disability provider.

| Rule | In the data | Setting |
|---|---|---|
| Right 10(6)(a): acknowledge the complaint in writing within 5 working days of receipt, unless it is resolved to the consumer's satisfaction in that time | `acknowledged_on` (or `outcome_on` inside the window) by the due date | `hdc_ack_wd` = 5 |
| Right 10(7): within 10 working days of the written acknowledgement, decide whether the complaint is justified, not justified, or more time is needed | `decided_on` by the due date | `hdc_decide_wd` = 10 |
| Right 10(7)(b)(ii): if more than 20 working days are needed, tell the consumer, with reasons, inside those 10 working days | `told_more_time_on` when `more_time_days` is over 20 | `hdc_more_time_wd` = 20 |
| Right 10(4): progress updates at intervals of not more than one month while the complaint is open | the latest contact plus one month | (one month) |

Source: HDC Fact Sheet 3 (above), which works an example: received Tuesday 1 October, acknowledged Tuesday 8 October, decision due Tuesday 22 October, next contact due by 8 November.

The acknowledgement draft (`/draft-acknowledgement`) names the Nationwide Health and Disability Advocacy Service (0800 555 050, advocacy@advocacy.org.nz).

## New Zealand: adverse events reported to HQSC

*Healing, learning and improving from harm: National adverse events policy 2023* (Te Tāhū Hauora Health Quality & Safety Commission), in force from 1 July 2023. SAC 1 and 2 events and events on the Always Report and Review (ARR) list are reported to HQSC.

| Rule | In the data | Setting |
|---|---|---|
| Part A (the brief) within 30 working days of the event being notified to the provider | a `notifications` row with body `hqsc-part-a` | `hqsc_part_a_wd` = 30 |
| Part B (review findings) within 120 working days of notification | a `notifications` row with body `hqsc-part-b` | `hqsc_part_b_wd` = 120 |

Sources: HQSC policy page ([hqsc.govt.nz](https://www.hqsc.govt.nz/our-work/system-safety/healing-learning-and-improving-from-harm/)); providers applying the 2023 policy state these timeframes, for example Mercy Hospital's *Incident and Adverse Events Policy* ([mercyhospital.org.nz](https://www.mercyhospital.org.nz/assets/Policies/Incident-and-Adverse-Events-Policy-v2.pdf)) and Te Whatu Ora's National Immunisation Programme adverse event process, which cites the policy's user guide. The 2017 policy used 15 and 70 working days; if your service still runs on it, change the two settings. Confirm against the current policy user guide.

`/draft-part-a` pre-fills the brief from the record with no names or NHI.

## Victoria: the statutory duty of candour

Health Services Act 1988 (Vic) Part 5A, in force since 30 November 2022, and the *Victorian Duty of Candour Guidelines* (Safer Care Victoria). It applies to public health services and to private hospitals and day procedure centres. A serious adverse patient safety event (SAPSE) is one that, in a registered practitioner's reasonable opinion, caused or is likely to cause moderate or severe harm or prolonged psychological harm: the equivalent of ISR 1 or 2.

The system treats an incident as a SAPSE when the service is in Victoria, the person is a patient, resident or client, and the rating is 1 or 2, or the harm is moderate or worse, or prolonged psychological harm is ticked.

| Rule | In the data | Setting |
|---|---|---|
| A genuine apology (the Guidelines set 24 hours) | `disclosures.apology_at` by the next day | (1 day) |
| Arrange a meeting with the patient within 3 business days of identifying the SAPSE | `meeting_arranged_at` | `sdc_arrange_bd` = 3 |
| Hold the meeting within 10 business days | `meeting_held_at` | `sdc_meeting_bd` = 10 |
| Give the final written report within 50 business days (75 for a multi-agency review), covering the matters in s 128ZC: a written account of the facts, an apology, the service's response, and the steps taken to prevent a recurrence | `final_report_at` | `sdc_report_bd` = 50 |
| The patient may opt out by signed statement, and may later ask for the information anyway | `opted_out_at` stops the clocks | |

Sources: Safer Care Victoria duty of candour resources and report templates ([safercare.vic.gov.au](https://www.safercare.vic.gov.au)); Landers & Rogers, *Open disclosure to patients under Victoria duty of candour laws* ([landers.com.au](https://landers.com.au/legal-insights-news/open-disclosure-to-patients-under-victoria-duty-of-candour-laws)). The clocks count from the date the incident was reported; if your service identifies SAPSEs later (at rating), record the report time accordingly. Confirm against the current Guidelines.

`/draft-candour-report` drafts the final written report with the s 128ZC headings.

## Open disclosure everywhere else

- **Australia:** the *Australian Open Disclosure Framework* (ACSQHC) and NSQHS Standards action 1.12 (open disclosure). There is no fixed national timeframe; the house rule `disclosure_start_days` (1) checks it starts promptly after moderate harm or worse.
- **New Zealand:** HDC Code of Rights, Right 6 (the right to be fully informed) and HDC's guidance on open disclosure policies. Same house timeframe.

## Australia: sentinel events

The *Australian sentinel events list, version 2* (ACSQHC, December 2018; specifications updated May 2025) has ten categories, stored as `sentinel_category` 1 to 10 and printed in words by `/sentinel`. States and territories set how and when a sentinel event is reported, so the attention list flags every open sentinel event without a due date: tell the state health department as its policy requires and record it with `/notify --to=health-department`. Rating a sentinel event needs serious harm or death (except category 6, suspected suicide in an acute psychiatric unit, and 9, release of a child to an unauthorised person).

Source: ACSQHC sentinel events page ([safetyandquality.gov.au](https://www.safetyandquality.gov.au/data-and-measurement/safety-and-quality-measures/sentinel-events)).

## Australia: complaints

NSQHS Standards action 1.14 requires a complaints management system; it sets no national timeframes. The house rules `au_complaint_ack_wd` (2 working days) and `au_complaint_close_wd` (30) are yours to set. If your state's health complaints body or your contract sets others, put them here.

## House rules in the demo

| Setting | Default | What it checks |
|---|---|---|
| `rate_within_days` | 2 | every incident rated by a manager |
| `review_start_days` | 5 | severity 1 and 2, and sentinel events, get a formal review started |
| `review_due_days` | 45 | default due date for a review |
| `disclosure_start_days` | 1 | open disclosure starts after moderate harm or worse |
| `late_report_hours` | 24 | an incident reported later than this is flagged |
| `au_complaint_ack_wd`, `au_complaint_close_wd` | 2, 30 | Australian complaint timeframes |

## Not checked (add them with `/customise`)

Aged care serious incident reporting (SIRS), NDIS reportable incidents, WorkSafe notifiable events, coroner referrals and state-specific rules for public health services all have their own timeframes. They are not seeded because they depend on what your service is registered as. Tell Claude Code the rule and its source, and it adds the setting, the check and a line here.
