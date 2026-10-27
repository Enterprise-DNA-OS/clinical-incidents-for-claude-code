-- Clinical Incidents for Claude Code: a health provider's incident and feedback system in plain tables.
-- Services (a hospital, a day surgery, a community team) and their units, the staff who report and review,
-- incidents with their severity rating, harm and sentinel event category, open disclosure and the
-- Victorian statutory duty of candour, reviews (RCA, London Protocol, case review), actions from any of
-- them, notifications to outside bodies (HQSC, the state health department, a coroner), complaints and
-- compliments with the HDC Code of Rights clock, a risk register, public holidays for the working-day
-- clock, and an append-only activity log.
-- Times are wall-clock times at the service (timestamp without time zone); region_now() gives the
-- service's own now, and add_working_days() counts working days the way the rules do.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function region_zone(region text) returns text language sql immutable as $$
  select case region
    when 'NZ' then 'Pacific/Auckland' when 'NSW' then 'Australia/Sydney' when 'ACT' then 'Australia/Sydney'
    when 'VIC' then 'Australia/Melbourne' when 'TAS' then 'Australia/Hobart' when 'QLD' then 'Australia/Brisbane'
    when 'SA' then 'Australia/Adelaide' when 'NT' then 'Australia/Darwin' when 'WA' then 'Australia/Perth'
  end
$$;

create or replace function region_now(region text) returns timestamp language sql stable as $$
  select (now() at time zone region_zone(region))
$$;

-- House rules and the timeframes the rules set, changed with `set`. Sources live in docs/compliance.md.
create table settings (
  key text primary key,
  value text not null,
  note text not null default ''
);

create or replace function setting_num(k text, dflt numeric) returns numeric language sql stable as $$
  select coalesce((select value::numeric from settings where key = k), dflt)
$$;

-- Public holidays for the working-day clock. region 'NZ', an Australian state, or 'AU' for a national day.
create table holidays (
  on_date date not null,
  region text not null check (region = 'AU' or region_zone(region) is not null),
  name text not null,
  primary key (on_date, region)
);

-- A working day: not a Saturday or Sunday, not a public holiday where the service is, and in New Zealand
-- not a day from 25 December to 2 January (the definition HDC applies to Right 10 timeframes).
create or replace function is_working_day(d date, p_region text) returns boolean language sql stable as $$
  select extract(isodow from d) < 6
    and not exists (select 1 from holidays h where h.on_date = d and (h.region = p_region or (h.region = 'AU' and p_region <> 'NZ')))
    and not (p_region = 'NZ' and ((extract(month from d) = 12 and extract(day from d) >= 25) or (extract(month from d) = 1 and extract(day from d) <= 2)))
$$;

-- The date n working days after d (d itself is day 0).
create or replace function add_working_days(d date, n int, p_region text) returns date language plpgsql stable as $$
declare
  cur date := d;
  left_ int := n;
begin
  if d is null or n is null then return null; end if;
  while left_ > 0 loop
    cur := cur + 1;
    if is_working_day(cur, p_region) then left_ := left_ - 1; end if;
  end loop;
  return cur;
end $$;

-- Working days from a to b (0 when b is on or before a).
create or replace function working_days_between(a date, b date, p_region text) returns int language sql stable as $$
  select coalesce((select count(*)::int from generate_series(a + 1, b, interval '1 day') g where is_working_day(g::date, p_region)), 0)
$$;

create table services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{2,12}$'),
  name text not null check (length(trim(name)) > 0),
  kind text not null default 'hospital' check (kind in ('hospital', 'day-surgery', 'aged-care', 'community', 'mental-health', 'disability', 'clinic')),
  region text not null check (region_zone(region) is not null),
  beds int check (beds >= 0),
  external_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id),
  code text not null check (code ~ '^[A-Z0-9-]{2,16}$'),
  name text not null,
  unique (service_id, code)
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{2,12}$'),
  name text not null check (length(trim(name)) > 0),
  role text not null default 'clinician',
  email text,
  active boolean not null default true,
  external_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence incident_no start 1001;
create table incidents (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('INC-' || nextval('incident_no')),
  service_id uuid not null references services(id),
  unit_id uuid references units(id),
  occurred_at timestamp not null,
  reported_at timestamp not null,
  reported_by text not null,
  category text not null check (category in ('fall', 'medication', 'pressure-injury', 'surgical', 'infection', 'deterioration', 'behaviour',
    'restraint', 'blood', 'identification', 'documentation', 'equipment', 'discharge', 'self-harm', 'other')),
  -- Who was affected. person_ref is the record number (NHI, UR or MRN), never a name in this table.
  person_type text not null default 'patient' check (person_type in ('patient', 'resident', 'client', 'visitor', 'staff')),
  person_ref text,
  summary text not null check (length(trim(summary)) > 0),
  immediate_action text,
  -- Harm as the person experienced it, and the severity rating the service gives the event (1 is most severe):
  -- SAC in New Zealand and NSW, ISR in Victoria. Rated by a manager after the report.
  harm text check (harm in ('none', 'near-miss', 'mild', 'moderate', 'severe', 'death')),
  severity int check (severity between 1 and 4),
  rated_at timestamp,
  rated_by text,
  -- Australian sentinel events list, version 2: category 1 to 10, null when not a sentinel event.
  sentinel_category int check (sentinel_category between 1 and 10),
  -- New Zealand: on the HQSC Always Report and Review list.
  always_report boolean not null default false,
  -- Prolonged psychological harm counts for the Victorian duty of candour as well as physical harm.
  psychological_harm boolean not null default false,
  manager_id uuid references staff(id),
  status text not null default 'reported' check (status in ('reported', 'under-review', 'closed')),
  closed_at timestamp,
  closed_by text,
  close_note text,
  external_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reported_at >= occurred_at),
  check ((severity is null) = (rated_at is null)),
  check ((status = 'closed') = (closed_at is not null))
);

-- Open disclosure for one incident. For a Victorian serious adverse patient safety event this is the
-- statutory duty of candour: apology, meeting arranged, meeting held, meeting notes given, final report given.
create table disclosures (
  incident_id uuid primary key references incidents(id),
  lead_id uuid references staff(id),
  apology_at timestamp,
  meeting_arranged_at timestamp,
  meeting_held_at timestamp,
  notes_given_at timestamp,
  final_report_at timestamp,
  opted_out_at timestamp,
  note text,
  updated_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null unique references incidents(id),
  method text not null check (method in ('rca', 'london-protocol', 'alarm', 'case-review', 'after-action', 'other')),
  lead_id uuid references staff(id),
  started_on date not null,
  due_on date not null,
  completed_on date,
  findings text,
  created_at timestamptz not null default now(),
  check (due_on >= started_on),
  check (completed_on is null or findings is not null)
);

create sequence complaint_no start 301;
create table complaints (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('FB-' || nextval('complaint_no')),
  service_id uuid not null references services(id),
  kind text not null default 'complaint' check (kind in ('complaint', 'compliment', 'suggestion')),
  received_on date not null,
  received_via text not null default 'email' check (received_via in ('email', 'phone', 'letter', 'in-person', 'web', 'hdc', 'advocate', 'other')),
  from_name text not null,
  from_contact text,
  about text not null check (length(trim(about)) > 0),
  category text not null default 'care' check (category in ('care', 'communication', 'access', 'cost', 'staff', 'environment', 'privacy', 'discharge', 'other')),
  incident_id uuid references incidents(id),
  -- HDC Code of Rights, Right 10: acknowledged in writing, then a decision (justified, not justified, or more
  -- time), the consumer told when more time is over 20 working days, updates at least monthly, and the outcome.
  acknowledged_on date,
  decided_on date,
  decision text check (decision in ('justified', 'not-justified', 'more-time')),
  more_time_days int check (more_time_days > 0),
  told_more_time_on date,
  last_contact_on date,
  outcome_on date,
  outcome text,
  handled_by uuid references staff(id),
  external_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((decision is null) = (decided_on is null)),
  check (decision <> 'more-time' or more_time_days is not null),
  check ((outcome_on is null) = (outcome is null)),
  check (acknowledged_on is null or acknowledged_on >= received_on)
);

create sequence risk_no start 21;
create table risks (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('RSK-' || nextval('risk_no')),
  service_id uuid references services(id),
  title text not null check (length(trim(title)) > 0),
  category text not null default 'clinical' check (category in ('clinical', 'workforce', 'facility', 'equipment', 'information', 'financial', 'regulatory', 'reputation')),
  likelihood int not null check (likelihood between 1 and 5),
  consequence int not null check (consequence between 1 and 5),
  controls text,
  owner_id uuid references staff(id),
  review_every_days int not null default 90 check (review_every_days between 7 and 730),
  last_reviewed_on date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- What the service will change, from an incident, a review, a complaint or a risk.
create sequence action_no start 501;
create table actions (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('ACT-' || nextval('action_no')),
  incident_id uuid references incidents(id),
  complaint_id uuid references complaints(id),
  risk_id uuid references risks(id),
  description text not null check (length(trim(description)) > 0),
  owner_id uuid not null references staff(id),
  due_on date not null,
  done_on date,
  evidence text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(incident_id, complaint_id, risk_id) <= 1),
  check (done_on is null or evidence is not null)
);

-- Reports sent to bodies outside the service, with their reference.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id),
  body text not null check (body in ('hqsc-part-a', 'hqsc-part-b', 'health-department', 'coroner', 'worksafe', 'insurer', 'other')),
  sent_at timestamp not null,
  reference text,
  note text,
  created_at timestamptz not null default now(),
  unique (incident_id, body)
);

-- Every write names a person. Rows are never updated or deleted.
create table activity (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  ref text,
  detail text
);

create or replace function activity_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'activity is append-only';
end $$;
create trigger activity_no_change before update or delete on activity for each row execute function activity_append_only();

create trigger services_touch before update on services for each row execute function touch_updated_at();
create trigger staff_touch before update on staff for each row execute function touch_updated_at();
create trigger incidents_touch before update on incidents for each row execute function touch_updated_at();
create trigger disclosures_touch before update on disclosures for each row execute function touch_updated_at();
create trigger complaints_touch before update on complaints for each row execute function touch_updated_at();
create trigger risks_touch before update on risks for each row execute function touch_updated_at();

create index incidents_service on incidents (service_id, occurred_at);
create index actions_open on actions (due_on) where done_on is null;
create index complaints_open on complaints (received_on) where outcome_on is null;

-- ------------------------------------------------------------------ views

create view v_incidents as
select i.id, i.ref, s.code as service, s.name as service_name, s.kind as service_kind, s.region,
  case when s.region = 'NZ' then 'NZ' else 'AU' end as country,
  u.name as unit, i.occurred_at, i.reported_at, i.reported_by, i.category, i.person_type, i.person_ref, i.summary,
  i.harm, i.severity,
  case when i.severity is null then 'not rated' else (case when s.region = 'VIC' then 'ISR ' else 'SAC ' end) || i.severity end as rating,
  i.rated_at, i.sentinel_category, i.always_report, i.psychological_harm,
  m.name as manager, i.status, i.closed_at, i.service_id,
  region_now(s.region) as service_now,
  (region_now(s.region)::date - i.reported_at::date) as days_open,
  -- Victorian statutory duty of candour: a serious adverse patient safety event, the equivalent of ISR 1 or 2.
  (s.region = 'VIC' and (i.severity <= 2 or i.harm in ('moderate', 'severe', 'death') or i.psychological_harm) and i.person_type in ('patient', 'resident', 'client')) as sdc_applies,
  -- New Zealand: SAC 1 and 2 events and Always Report and Review events go to HQSC.
  (s.region = 'NZ' and (i.severity <= 2 or i.always_report)) as hqsc_applies
from incidents i
join services s on s.id = i.service_id
left join units u on u.id = i.unit_id
left join staff m on m.id = i.manager_id;

-- Every dated obligation, one row each, with when it is due, when it was met, and the rule behind it.
-- kind: law (a statute or a code with force), policy (a national policy or framework), house (your own rule).
create view v_obligations as
with i as (select * from v_incidents)
-- HQSC Part A and Part B (New Zealand).
select i.ref, i.service, i.region, 'policy' as kind, 'HQSC Part A brief sent' as obligation,
  add_working_days(i.reported_at::date, setting_num('hqsc_part_a_wd', 30)::int, i.region) as due_on,
  (select n.sent_at::date from notifications n where n.incident_id = i.id and n.body = 'hqsc-part-a') as met_on,
  'National Adverse Events Policy 2023 (HQSC)' as rule, i.service_now::date as today
from i where i.hqsc_applies
union all
select i.ref, i.service, i.region, 'policy', 'HQSC Part B review findings sent',
  add_working_days(i.reported_at::date, setting_num('hqsc_part_b_wd', 120)::int, i.region),
  (select n.sent_at::date from notifications n where n.incident_id = i.id and n.body = 'hqsc-part-b'),
  'National Adverse Events Policy 2023 (HQSC)', i.service_now::date
from i where i.hqsc_applies
-- Victorian statutory duty of candour.
union all
select i.ref, i.service, i.region, 'law', 'Duty of candour: apology given',
  (i.reported_at + interval '1 day')::date, d.apology_at::date,
  'Health Services Act 1988 (Vic) Part 5A; Duty of Candour Guidelines', i.service_now::date
from i left join disclosures d on d.incident_id = i.id where i.sdc_applies and d.opted_out_at is null
union all
select i.ref, i.service, i.region, 'law', 'Duty of candour: meeting arranged',
  add_working_days(i.reported_at::date, setting_num('sdc_arrange_bd', 3)::int, i.region), d.meeting_arranged_at::date,
  'Health Services Act 1988 (Vic) Part 5A; Duty of Candour Guidelines', i.service_now::date
from i left join disclosures d on d.incident_id = i.id where i.sdc_applies and d.opted_out_at is null
union all
select i.ref, i.service, i.region, 'law', 'Duty of candour: meeting held',
  add_working_days(i.reported_at::date, setting_num('sdc_meeting_bd', 10)::int, i.region), d.meeting_held_at::date,
  'Health Services Act 1988 (Vic) Part 5A; Duty of Candour Guidelines', i.service_now::date
from i left join disclosures d on d.incident_id = i.id where i.sdc_applies and d.opted_out_at is null
union all
select i.ref, i.service, i.region, 'law', 'Duty of candour: final written report given',
  add_working_days(i.reported_at::date, setting_num('sdc_report_bd', 50)::int, i.region), d.final_report_at::date,
  'Health Services Act 1988 (Vic) s 128ZC; Duty of Candour Guidelines', i.service_now::date
from i left join disclosures d on d.incident_id = i.id where i.sdc_applies and d.opted_out_at is null
-- Open disclosure everywhere else: harm of moderate or worse starts the process (house timeframe).
union all
select i.ref, i.service, i.region, 'policy', 'Open disclosure started',
  (i.reported_at::date + setting_num('disclosure_start_days', 1)::int), coalesce(d.apology_at, d.meeting_held_at)::date,
  case when i.country = 'NZ' then 'HDC Code of Rights, Right 6; HDC guidance on open disclosure' else 'Australian Open Disclosure Framework; NSQHS Action 1.12' end, i.service_now::date
from i left join disclosures d on d.incident_id = i.id
where not i.sdc_applies and i.harm in ('moderate', 'severe', 'death') and i.person_type in ('patient', 'resident', 'client') and d.opted_out_at is null
-- Rating and review (house timeframes).
union all
select i.ref, i.service, i.region, 'house', 'Severity rated', (i.reported_at::date + setting_num('rate_within_days', 2)::int), i.rated_at::date,
  'House rule: every incident rated by a manager', i.service_now::date
from i
union all
select i.ref, i.service, i.region, 'house', 'Review started', (i.rated_at::date + setting_num('review_start_days', 5)::int), r.started_on,
  'House rule: SAC or ISR 1 and 2, and sentinel events, get a formal review', i.service_now::date
from i left join reviews r on r.incident_id = i.id where i.severity <= 2 or i.sentinel_category is not null
union all
select i.ref, i.service, i.region, 'house', 'Review completed', r.due_on, r.completed_on, 'House rule: the review''s own due date', i.service_now::date
from i join reviews r on r.incident_id = i.id
-- HDC Code of Rights, Right 10 (New Zealand complaints).
union all
select c.ref, s.code, s.region, 'law', 'Complaint acknowledged in writing',
  add_working_days(c.received_on, setting_num('hdc_ack_wd', 5)::int, s.region), coalesce(c.acknowledged_on, case when c.outcome_on <= add_working_days(c.received_on, setting_num('hdc_ack_wd', 5)::int, s.region) then c.outcome_on end),
  'HDC Code of Rights, Right 10(6)(a)', region_now(s.region)::date
from complaints c join services s on s.id = c.service_id where c.kind = 'complaint' and s.region = 'NZ'
union all
select c.ref, s.code, s.region, 'law', 'Decision made (justified, not justified, or more time)',
  add_working_days(c.acknowledged_on, setting_num('hdc_decide_wd', 10)::int, s.region), c.decided_on,
  'HDC Code of Rights, Right 10(7)', region_now(s.region)::date
from complaints c join services s on s.id = c.service_id where c.kind = 'complaint' and s.region = 'NZ' and c.acknowledged_on is not null
union all
select c.ref, s.code, s.region, 'law', 'Consumer told more than 20 working days are needed, with reasons',
  add_working_days(c.acknowledged_on, setting_num('hdc_decide_wd', 10)::int, s.region), c.told_more_time_on,
  'HDC Code of Rights, Right 10(7)(b)(ii)', region_now(s.region)::date
from complaints c join services s on s.id = c.service_id
where c.kind = 'complaint' and s.region = 'NZ' and c.decision = 'more-time' and c.more_time_days > setting_num('hdc_more_time_wd', 20)
union all
select c.ref, s.code, s.region, 'law', 'Progress update (at least monthly while open)',
  (greatest(c.acknowledged_on, c.decided_on, c.last_contact_on, c.told_more_time_on) + interval '1 month')::date, null::date,
  'HDC Code of Rights, Right 10(4)', region_now(s.region)::date
from complaints c join services s on s.id = c.service_id
where c.kind = 'complaint' and s.region = 'NZ' and c.outcome_on is null and c.acknowledged_on is not null
-- Australian complaints: the service's own timeframes under its complaints system.
union all
select c.ref, s.code, s.region, 'house', 'Complaint acknowledged',
  add_working_days(c.received_on, setting_num('au_complaint_ack_wd', 2)::int, s.region), c.acknowledged_on,
  'House rule under NSQHS Standard 1.14 (complaints management)', region_now(s.region)::date
from complaints c join services s on s.id = c.service_id where c.kind = 'complaint' and s.region <> 'NZ'
union all
select c.ref, s.code, s.region, 'house', 'Complaint resolved',
  add_working_days(c.received_on, setting_num('au_complaint_close_wd', 30)::int, s.region), c.outcome_on,
  'House rule under NSQHS Standard 1.14 (complaints management)', region_now(s.region)::date
from complaints c join services s on s.id = c.service_id where c.kind = 'complaint' and s.region <> 'NZ'
-- Actions and risk reviews.
union all
select a.ref, coalesce(s.code, '-'), coalesce(s.region, 'NZ'), 'house', 'Action done: ' || a.description, a.due_on, a.done_on, 'House rule: the action''s own due date',
  region_now(coalesce(s.region, 'NZ'))::date
from actions a
left join incidents ii on ii.id = a.incident_id
left join complaints cc on cc.id = a.complaint_id
left join risks rr on rr.id = a.risk_id
left join services s on s.id = coalesce(ii.service_id, cc.service_id, rr.service_id)
union all
select r.ref, coalesce(s.code, '-'), coalesce(s.region, 'NZ'), 'house', 'Risk reviewed: ' || r.title, r.last_reviewed_on + r.review_every_days, null::date,
  'House rule: the risk''s own review cycle', region_now(coalesce(s.region, 'NZ'))::date
from risks r left join services s on s.id = r.service_id where r.status = 'open';

create view v_obligation_status as
select o.*,
  case when o.met_on is not null and o.met_on <= o.due_on then 'met'
       when o.met_on is not null then 'met late'
       when o.due_on < o.today then 'overdue'
       when o.due_on <= o.today + 7 then 'due soon'
       else 'open' end as standing,
  case when o.met_on is null and o.due_on < o.today then o.today - o.due_on end as days_over
from v_obligations o;

create view v_complaints as
select c.id, c.ref, s.code as service, s.region, c.kind, c.received_on, c.received_via, c.from_name, c.about, c.category,
  c.acknowledged_on, c.decision, c.decided_on, c.more_time_days, c.told_more_time_on, c.last_contact_on, c.outcome_on, c.outcome,
  h.name as handled_by, i.ref as incident,
  case when c.kind <> 'complaint' then 'logged'
       when c.outcome_on is not null then 'closed'
       when c.acknowledged_on is null then 'not acknowledged'
       when c.decided_on is null then 'acknowledged'
       else 'decided, outcome to give' end as stage,
  working_days_between(c.received_on, coalesce(c.outcome_on, region_now(s.region)::date), s.region) as working_days_open,
  c.service_id
from complaints c
join services s on s.id = c.service_id
left join staff h on h.id = c.handled_by
left join incidents i on i.id = c.incident_id;

create view v_risks as
select r.id, r.ref, s.code as service, r.title, r.category, r.likelihood, r.consequence, r.likelihood * r.consequence as score,
  case when r.likelihood * r.consequence >= 15 then 'extreme' when r.likelihood * r.consequence >= 10 then 'high'
       when r.likelihood * r.consequence >= 5 then 'medium' else 'low' end as level,
  r.controls, o.name as owner, r.last_reviewed_on, r.last_reviewed_on + r.review_every_days as review_due,
  (select count(*)::int from actions a where a.risk_id = r.id and a.done_on is null) as open_actions,
  r.status
from risks r left join services s on s.id = r.service_id left join staff o on o.id = r.owner_id;

create view v_actions as
select a.id, a.ref, coalesce(i.ref, c.ref, r.ref) as from_ref, a.description, o.name as owner, a.due_on, a.done_on, a.evidence,
  case when a.done_on is not null then 'done' when a.due_on < current_date then 'overdue' else 'open' end as standing
from actions a
join staff o on o.id = a.owner_id
left join incidents i on i.id = a.incident_id
left join complaints c on c.id = a.complaint_id
left join risks r on r.id = a.risk_id;
