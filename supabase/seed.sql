-- Demo data: Tidewater Health, a fictional private health group with a surgical hospital in Auckland,
-- a day surgery in Melbourne and a community nursing team in Brisbane. Every name and event is invented.
-- Dates are relative to today, so the attention list always has something to say: a SAC 2 medication
-- error with its HQSC Part A brief overdue and no review started, a Victorian deterioration in recovery
-- with the duty of candour apology and meeting not done, a retained swab (a sentinel event) mid-review,
-- a community pressure injury with open disclosure not started, an incident nobody has rated, an HDC
-- complaint not acknowledged inside 5 working days, another with no decision, a third with no update in
-- over a month, risks past their review date, and actions past due.
-- Safe to run twice: every row has a natural key.

insert into settings (key, value, note) values
  ('hqsc_part_a_wd', '30', 'NZ: working days from notification to the provider to send the HQSC Part A brief (SAC 1 and 2, ARR)'),
  ('hqsc_part_b_wd', '120', 'NZ: working days from notification to the provider to send the HQSC Part B review findings'),
  ('sdc_arrange_bd', '3', 'VIC duty of candour: business days to arrange the meeting with the patient'),
  ('sdc_meeting_bd', '10', 'VIC duty of candour: business days to hold the meeting'),
  ('sdc_report_bd', '50', 'VIC duty of candour: business days to give the final written report (75 for a multi-agency review)'),
  ('hdc_ack_wd', '5', 'NZ HDC Code Right 10(6)(a): working days to acknowledge a complaint in writing'),
  ('hdc_decide_wd', '10', 'NZ HDC Code Right 10(7): working days after acknowledgement to decide'),
  ('hdc_more_time_wd', '20', 'NZ HDC Code Right 10(7)(b)(ii): more time than this must be explained to the consumer'),
  ('au_complaint_ack_wd', '2', 'House rule (AU): working days to acknowledge a complaint'),
  ('au_complaint_close_wd', '30', 'House rule (AU): working days to resolve a complaint'),
  ('rate_within_days', '2', 'House rule: days for a manager to rate a new incident'),
  ('review_start_days', '5', 'House rule: days from rating to starting a formal review of a severity 1 or 2 event'),
  ('review_due_days', '45', 'House rule: default days to complete a formal review'),
  ('disclosure_start_days', '1', 'House rule: days to start open disclosure after moderate or worse harm'),
  ('late_report_hours', '24', 'House rule: an incident reported more than this many hours after it happened is late')
on conflict (key) do nothing;

insert into holidays (on_date, region, name) values
  ('2026-06-01', 'NZ', 'King''s Birthday'), ('2026-07-10', 'NZ', 'Matariki'), ('2026-10-26', 'NZ', 'Labour Day'),
  ('2026-12-25', 'NZ', 'Christmas Day'), ('2026-12-28', 'NZ', 'Boxing Day (observed)'), ('2027-01-01', 'NZ', 'New Year''s Day'),
  ('2027-01-04', 'NZ', 'Day after New Year''s Day (observed)'), ('2027-02-08', 'NZ', 'Waitangi Day (observed)'),
  ('2026-06-08', 'VIC', 'King''s Birthday'), ('2026-11-03', 'VIC', 'Melbourne Cup'), ('2026-10-05', 'QLD', 'King''s Birthday'),
  ('2026-12-25', 'AU', 'Christmas Day'), ('2026-12-28', 'AU', 'Boxing Day (additional day)'), ('2027-01-01', 'AU', 'New Year''s Day'),
  ('2027-01-26', 'AU', 'Australia Day')
on conflict do nothing;

insert into services (code, name, kind, region, beds) values
  ('TW-AKL', 'Tidewater Private Hospital Auckland', 'hospital', 'NZ', 64),
  ('TW-MEL', 'Tidewater Day Surgery Richmond', 'day-surgery', 'VIC', 0),
  ('TW-BNE', 'Tidewater Community Nursing Brisbane', 'community', 'QLD', null)
on conflict (code) do nothing;

insert into units (service_id, code, name)
select s.id, u.code, u.name from (values
  ('TW-AKL', 'WARD-2', 'Ward 2 Surgical'), ('TW-AKL', 'WARD-3', 'Ward 3 Orthopaedic'), ('TW-AKL', 'THEATRE', 'Operating theatres'),
  ('TW-MEL', 'THEATRE', 'Theatres'), ('TW-MEL', 'RECOVERY', 'Recovery and discharge lounge'),
  ('TW-BNE', 'HOME', 'Home visiting team')
) as u(svc, code, name) join services s on s.code = u.svc
on conflict (service_id, code) do nothing;

insert into staff (code, name, role, email) values
  ('ANH', 'Aroha Ngata-Hill', 'Quality and risk manager', 'aroha@tidewater.example'),
  ('TBR', 'Tom Bradley', 'Director of nursing, Auckland', 'tom@tidewater.example'),
  ('PKA', 'Priya Kaur', 'Charge nurse, Ward 2', 'priya@tidewater.example'),
  ('MOS', 'Michael O''Sullivan', 'Theatre manager, Auckland', 'michael@tidewater.example'),
  ('LCH', 'Lena Chen', 'Director of clinical services, Richmond', 'lena@tidewater.example'),
  ('DFO', 'Dr Daniel Foster', 'Anaesthetist, Richmond', 'daniel@tidewater.example'),
  ('SWI', 'Sophie Williams', 'Nurse unit manager, Recovery', 'sophie@tidewater.example'),
  ('JMA', 'Jack Mahoney', 'Clinical nurse consultant, Brisbane', 'jack@tidewater.example'),
  ('RTA', 'Rachel Tan', 'Pharmacist', 'rachel@tidewater.example'),
  ('BKE', 'Ben Kereama', 'Consumer liaison', 'ben@tidewater.example')
on conflict (code) do nothing;

-- The events that need a person.
insert into incidents (ref, service_id, unit_id, occurred_at, reported_at, reported_by, category, person_type, person_ref, summary, immediate_action,
  harm, severity, rated_at, rated_by, sentinel_category, always_report, manager_id, status, closed_at, closed_by, close_note)
select x.ref, s.id, u.id, current_date - x.occ + x.occ_t::time, current_date - x.rep + x.rep_t::time, x.by, x.cat, x.ptype, x.pref, x.summary, x.action,
  x.harm, x.sev, case when x.sev is not null then current_date - x.rep + 1 + time '09:00' end, case when x.sev is not null then x.rater end,
  x.sentinel, x.arr, m.id, x.status,
  case when x.status = 'closed' then current_date - 20 + time '16:00' end, case when x.status = 'closed' then 'Aroha Ngata-Hill' end,
  case when x.status = 'closed' then 'Review complete, actions done, Part B sent.' end
from (values
  ('INC-1001', 'TW-AKL', 'WARD-3', 26, '02:40', 26, '03:10', 'Priya Kaur', 'fall', 'patient', 'NHI ZZK4821', 'Patient day 2 after hip replacement got up alone to use the toilet, fell and fractured the left wrist. Bed alarm was not switched on.', 'Wrist X-ray, orthopaedic review, family told the same morning.', 'severe', 2, 'Tom Bradley', null::int, false, 'ANH', 'under-review'),
  ('INC-1002', 'TW-AKL', 'WARD-2', 50, '21:15', 50, '22:05', 'Rachel Tan', 'medication', 'patient', 'NHI ZZM1093', 'Oxycodone 10 mg given instead of 5 mg as charted after a verbal handover. Patient needed naloxone and a night in high dependency.', 'Naloxone given, moved to HDU, observations every 15 minutes.', 'moderate', 2, 'Tom Bradley', null, false, 'TBR', 'reported'),
  ('INC-1003', 'TW-MEL', 'THEATRE', 13, '15:30', 12, '08:20', 'Dr Daniel Foster', 'surgical', 'patient', 'UR 448210', 'Swab found on X-ray two days after laparoscopic hernia repair; count recorded as correct. Patient returned to theatre for removal.', 'Return to theatre, surgeon and anaesthetist told the patient and husband before the procedure.', 'severe', 1, 'Lena Chen', 4, false, 'LCH', 'under-review'),
  ('INC-1004', 'TW-MEL', 'RECOVERY', 6, '11:50', 6, '12:30', 'Sophie Williams', 'deterioration', 'patient', 'UR 451877', 'Oxygen saturation dropped to 84 percent in recovery after sedation for colonoscopy. Call for help was delayed while the nurse was with another patient. Transferred to hospital by ambulance.', 'MET call, airway support, ambulance transfer to the Epworth.', 'moderate', 2, 'Lena Chen', null, false, 'SWI', 'reported'),
  ('INC-1005', 'TW-BNE', 'HOME', 15, '10:00', 14, '16:45', 'Jack Mahoney', 'pressure-injury', 'client', 'CL 20931', 'Stage 3 pressure injury on the sacrum found at a weekly visit. The client''s air mattress had been switched off for a week.', 'Wound care plan, GP told, mattress repaired same day.', 'moderate', 2, 'Jack Mahoney', null, false, 'JMA', 'reported'),
  ('INC-1006', 'TW-AKL', 'THEATRE', 4, '07:55', 4, '08:10', 'Michael O''Sullivan', 'identification', 'patient', 'NHI ZZP7730', 'Two patients with the same surname were called for the same theatre at once. Caught at the sign-in check.', 'Wristbands checked again, list annotated.', 'near-miss', null, null, null, false, null, 'reported'),
  ('INC-1007', 'TW-AKL', 'WARD-2', 9, '14:20', 9, '14:40', 'Priya Kaur', 'equipment', 'staff', null, 'Needlestick from a used insulin pen left on a meal tray.', 'Washed, bloods taken, occupational health told.', 'mild', 3, 'Priya Kaur', null, false, 'PKA', 'reported'),
  ('INC-1008', 'TW-BNE', 'HOME', 3, '09:30', 1, '17:00', 'Jack Mahoney', 'medication', 'client', 'CL 20114', 'Evening insulin missed when the visit was moved and not reassigned. Blood glucose 19 the next morning.', 'GP called, dose given, visit roster fixed.', 'mild', 3, 'Jack Mahoney', null, false, 'JMA', 'reported'),
  ('INC-1009', 'TW-AKL', 'WARD-3', 160, '04:10', 160, '05:00', 'Priya Kaur', 'fall', 'patient', 'NHI ZZA5508', 'Fall on the way to the bathroom at night with a head strike; CT showed a small bleed.', 'CT, neurosurgical advice, family told.', 'severe', 2, 'Tom Bradley', null, false, 'ANH', 'closed')
) as x(ref, svc, unit, occ, occ_t, rep, rep_t, by, cat, ptype, pref, summary, action, harm, sev, rater, sentinel, arr, mgr, status)
join services s on s.code = x.svc
left join units u on u.service_id = s.id and u.code = x.unit
left join staff m on m.code = x.mgr
on conflict (ref) do nothing;

-- Four months of everyday reports for the trends, most of them rated and closed.
insert into incidents (ref, service_id, unit_id, occurred_at, reported_at, reported_by, category, person_type, summary, harm, severity, rated_at, rated_by, manager_id, status, closed_at, closed_by)
select 'INC-' || (1100 + g), s.id, u.id,
  current_date - (8 + (g * 37) % 115) + time '08:00' + ((g * 53) % 600) * interval '1 minute',
  current_date - (8 + (g * 37) % 115) + time '08:00' + ((g * 53) % 600) * interval '1 minute' + case when g % 7 = 0 then interval '30 hours' else interval '45 minutes' end,
  (array['Priya Kaur', 'Sophie Williams', 'Jack Mahoney', 'Michael O''Sullivan', 'Rachel Tan'])[1 + g % 5],
  (array['fall', 'medication', 'fall', 'pressure-injury', 'behaviour', 'medication', 'documentation', 'equipment', 'infection', 'fall', 'discharge', 'medication'])[1 + g % 12],
  case when g % 9 = 0 then 'visitor' else 'patient' end,
  (array['Unwitnessed fall, no injury found on review.', 'Dose given late after a missed handover.', 'Fall from chair while reaching for a phone, bruised elbow.', 'Stage 1 pressure area on a heel found at the skin check.',
    'Verbal aggression towards a nurse during visiting hours.', 'Wrong time on the drug chart, caught at the double check.', 'Consent form missing a signature at sign-in.',
    'Infusion pump alarm failed during a check; pump tagged out.', 'Wound swab positive after day surgery; antibiotics started.', 'Slid from bed to floor during a transfer, no injury.',
    'Discharge summary sent to the wrong GP practice.', 'Patient''s own medicines not reconciled at admission.'])[1 + g % 12],
  case when g % 12 in (2, 8) then 'mild' when g % 12 in (5, 6) then 'near-miss' else 'none' end,
  case when g % 12 in (2, 8) then 3 else 4 end,
  current_date - (7 + (g * 37) % 115) + time '10:00', 'Aroha Ngata-Hill',
  (select id from staff where code = (array['PKA', 'SWI', 'JMA'])[1 + g % 3]),
  case when (8 + (g * 37) % 115) > 20 then 'closed' else 'reported' end,
  case when (8 + (g * 37) % 115) > 20 then current_date - (2 + (g * 37) % 115) + time '15:00' end,
  case when (8 + (g * 37) % 115) > 20 then 'Aroha Ngata-Hill' end
from generate_series(1, 36) g
join services s on s.code = (array['TW-AKL', 'TW-MEL', 'TW-BNE'])[1 + g % 3]
left join units u on u.service_id = s.id and u.code = (array['WARD-2', 'RECOVERY', 'HOME'])[1 + g % 3]
on conflict (ref) do nothing;

select setval('incident_no', greatest((select max(substr(ref, 5)::int) from incidents where ref ~ '^INC-\d+$'), 1001));

insert into disclosures (incident_id, lead_id, apology_at, meeting_arranged_at, meeting_held_at, notes_given_at, final_report_at, note)
select i.id, l.id, current_date - x.apol + time '10:00', current_date - x.arr + time '15:00', current_date - x.held + time '11:00', current_date - x.notes + time '09:00', null::timestamp, x.note
from (values
  ('INC-1003', 'LCH', 12, 10, null::int, null::int, 'Patient and husband met with the surgeon on day 1. Formal meeting booked; the family asked for it to be in person.'),
  ('INC-1001', 'TBR', 25, 24, 20, 18, 'Daughter attended. Notes sent by email.'),
  ('INC-1009', 'TBR', 159, 157, 150, 148, 'Wife and son attended.')
) as x(ref, lead, apol, arr, held, notes, note)
join incidents i on i.ref = x.ref join staff l on l.code = x.lead
on conflict (incident_id) do nothing;
update disclosures set final_report_at = current_date - 60 + time '12:00'
where incident_id = (select id from incidents where ref = 'INC-1009') and final_report_at is null;

insert into reviews (incident_id, method, lead_id, started_on, due_on, completed_on, findings)
select i.id, x.method, l.id, current_date - x.started, current_date - x.started + x.days, case when x.done is not null then current_date - x.done end, x.findings
from (values
  ('INC-1001', 'rca', 'ANH', 22, 45, null::int, null::text),
  ('INC-1003', 'london-protocol', 'LCH', 9, 40, null, null),
  ('INC-1009', 'rca', 'ANH', 155, 45, 112, 'Night staffing on Ward 3 was one nurse short; no falls risk reassessment after a change in sedation. Bed alarms not in use on the ward at night.')
) as x(ref, method, lead, started, days, done, findings)
join incidents i on i.ref = x.ref join staff l on l.code = x.lead
on conflict (incident_id) do nothing;

insert into notifications (incident_id, body, sent_at, reference)
select i.id, x.body, current_date - x.ago + time '12:00', x.reference
from (values ('INC-1009', 'hqsc-part-a', 140, 'HQSC A-2026-0412'), ('INC-1009', 'hqsc-part-b', 70, 'HQSC B-2026-0412')) as x(ref, body, ago, reference)
join incidents i on i.ref = x.ref
on conflict (incident_id, body) do nothing;

insert into complaints (ref, service_id, kind, received_on, received_via, from_name, from_contact, about, category, incident_id,
  acknowledged_on, decided_on, decision, more_time_days, told_more_time_on, last_contact_on, outcome_on, outcome, handled_by)
select x.ref, s.id, x.kind, current_date - x.rec, x.via, x.from_name, x.contact, x.about, x.cat, i.id,
  current_date - x.ack, current_date - x.dec, x.decision, x.more, current_date - x.told, current_date - x.contact_ago, current_date - x.out, x.outcome, h.id
from (values
  ('FB-301', 'TW-AKL', 'complaint', 9, 'email', 'Grace Whitford', 'grace.w@example.com', 'Waited four hours for pain relief after knee surgery; call bell answered slowly overnight.', 'care', null::text, null::int, null::int, null::text, null::int, null::int, null::int, null::int, null::text, 'BKE'),
  ('FB-302', 'TW-AKL', 'complaint', 21, 'letter', 'Hemi Rāwiri', 'PO Box 4471, Auckland', 'My mother fell on Ward 3 and broke her wrist. Nobody had switched on the bed alarm we were promised.', 'care', 'INC-1001', 18, null, null, null, null, 18, null, null, 'ANH'),
  ('FB-303', 'TW-AKL', 'complaint', 70, 'hdc', 'Margaret Lowe (through HDC)', 'HDC ref 26/04117', 'Surgical site infection after a hysterectomy was not picked up at the follow-up call.', 'care', null, 66, 55, 'more-time', 30, 55, 44, null, null, 'ANH'),
  ('FB-304', 'TW-AKL', 'complaint', 45, 'phone', 'Peter Sandhu', '021 555 0193', 'Charged for a private room that was not provided.', 'cost', null, 43, 38, 'justified', null, null, 38, 36, 'Refund of the room fee and an apology; billing checklist updated.', 'BKE'),
  ('FB-305', 'TW-MEL', 'complaint', 4, 'web', 'Alison Burke', 'alison.burke@example.com', 'Discharge instructions after my colonoscopy were not explained and I was sent home alone after sedation.', 'discharge', null, null, null, null, null, null, null, null, null, 'SWI'),
  ('FB-306', 'TW-BNE', 'complaint', 38, 'phone', 'Craig Donnelly', '0400 555 211', 'Nurse visits for my father keep changing time without notice.', 'access', null, 37, null, null, null, null, 25, null, null, 'JMA'),
  ('FB-307', 'TW-AKL', 'compliment', 6, 'email', 'Sarah Kim', 'sarah.kim@example.com', 'Ward 2 nurses were wonderful with my son after his appendix surgery.', 'staff', null, null, null, null, null, null, null, null, null, 'BKE'),
  ('FB-308', 'TW-MEL', 'suggestion', 11, 'in-person', 'Ray Patel', null, 'A phone charger in the discharge lounge would help people waiting for a lift.', 'environment', null, null, null, null, null, null, null, null, null, 'SWI')
) as x(ref, svc, kind, rec, via, from_name, contact, about, cat, inc, ack, dec, decision, more, told, contact_ago, out, outcome, handler)
join services s on s.code = x.svc
left join incidents i on i.ref = x.inc
left join staff h on h.code = x.handler
on conflict (ref) do nothing;

insert into risks (ref, service_id, title, category, likelihood, consequence, controls, owner_id, review_every_days, last_reviewed_on)
select x.ref, s.id, x.title, x.cat, x.l, x.c, x.controls, o.id, x.every, current_date - x.reviewed
from (values
  ('RSK-21', 'TW-AKL', 'Falls with harm on the orthopaedic ward at night', 'clinical', 4, 4, 'Falls risk assessment on admission; bed alarms; intentional rounding hourly.', 'TBR', 90, 30),
  ('RSK-22', 'TW-AKL', 'Opioid dosing errors after verbal handover', 'clinical', 3, 4, 'Charted doses only; double check for controlled drugs.', 'RTA', 90, 120),
  ('RSK-23', 'TW-MEL', 'Unplanned transfer from the day surgery after sedation', 'clinical', 2, 5, 'ASA screening at booking; recovery ratio 1 nurse to 2 patients.', 'LCH', 90, 64),
  ('RSK-24', 'TW-MEL', 'Retained items after laparoscopic surgery', 'clinical', 2, 5, 'Count sheet; two-person count at closure.', 'LCH', 60, 13),
  ('RSK-25', 'TW-BNE', 'Missed home visits when the roster changes', 'workforce', 3, 3, 'Daily roster check by the coordinator.', 'JMA', 60, 75),
  ('RSK-26', null, 'Incident data held in a system we do not control', 'information', 2, 3, 'Monthly export of the incident register.', 'ANH', 180, 20)
) as x(ref, svc, title, cat, l, c, controls, owner, every, reviewed)
left join services s on s.code = x.svc
join staff o on o.code = x.owner
on conflict (ref) do nothing;

insert into actions (ref, incident_id, complaint_id, risk_id, description, owner_id, due_on, done_on, evidence)
select x.ref, i.id, c.id, r.id, x.descr, o.id, current_date + x.due, case when x.done is not null then current_date - x.done end, x.evidence
from (values
  ('ACT-501', 'INC-1009', null::text, null::text, 'Bed alarms on for every Ward 3 patient with a falls score over 12 at night', 'TBR', -100, 104, 'Audit of 40 night shifts: alarms on for 38.'),
  ('ACT-502', 'INC-1009', null, null, 'Falls reassessment whenever sedation changes', 'PKA', -95, 96, 'Nursing care plan template updated.'),
  ('ACT-503', 'INC-1001', null, null, 'Audit bed alarm use on Ward 3 nights for four weeks', 'PKA', -3, null, null),
  ('ACT-504', 'INC-1002', null, null, 'Stop verbal dose handovers for controlled drugs; charted dose only', 'RTA', -14, null, null),
  ('ACT-505', 'INC-1003', null, null, 'Add an X-ray-detectable swab count check to the laparoscopic checklist', 'LCH', 20, null, null),
  ('ACT-506', null, 'FB-304', null, 'Billing checks room type against the ward record before invoicing', 'BKE', -30, 31, 'Checklist live in billing.'),
  ('ACT-507', null, null, 'RSK-22', 'Run the controlled drug double-check refresher for all Ward 2 nurses', 'RTA', -7, null, null),
  ('ACT-508', null, null, 'RSK-25', 'Coordinator signs off every roster change against the client list', 'JMA', 5, null, null),
  ('ACT-509', 'INC-1005', null, null, 'Check air mattress power at every visit and record it', 'JMA', 2, null, null)
) as x(ref, inc, cmp, rsk, descr, owner, due, done, evidence)
left join incidents i on i.ref = x.inc
left join complaints c on c.ref = x.cmp
left join risks r on r.ref = x.rsk
join staff o on o.code = x.owner
on conflict (ref) do nothing;

select setval('complaint_no', greatest((select max(substr(ref, 4)::int) from complaints where ref ~ '^FB-\d+$'), 301));
select setval('risk_no', greatest((select max(substr(ref, 5)::int) from risks where ref ~ '^RSK-\d+$'), 21));
select setval('action_no', greatest((select max(substr(ref, 5)::int) from actions where ref ~ '^ACT-\d+$'), 501));

insert into activity (actor, action, ref, detail)
select 'Seed', 'seed', 'demo', 'Tidewater Health demo data loaded'
where not exists (select 1 from activity where action = 'seed');
