// The rules of the clinical incident desk. scripts/incidents.mjs is a thin shell over run().
// Every write names an actor and leaves a row in the append-only activity log.
// Times are wall-clock times at the service: "2026-10-21 14:30" means 2.30 pm where the service is.
// The clocks (HQSC, duty of candour, HDC Right 10, house rules) live in v_obligations in the migration.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './db.mjs';
import { parseCsv, pick } from './csv.mjs';

export const today = () => new Date().toISOString().slice(0, 10);

export function date(v, label) {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error(`--${label} must be a date (YYYY-MM-DD)`);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw Error(`--${label} must be a date (YYYY-MM-DD)`);
  return s;
}

// "2026-10-21 14:30" (or with a T) -> "2026-10-21 14:30:00", a wall-clock time at the service.
export function stamp(v, label) {
  const s = String(v ?? '').trim().replace('T', ' ');
  const m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{1,2}):(\d{2})(?::00)?$/);
  if (!m) throw Error(`--${label} must be a date and time like 2026-10-21 14:30`);
  date(m[1], label);
  const h = Number(m[2]);
  if (h > 23 || Number(m[3]) > 59) throw Error(`--${label} has an impossible time`);
  return `${m[1]} ${String(h).padStart(2, '0')}:${m[3]}:00`;
}

function num(v, label, { min = 0, max = Infinity } = {}) {
  const n = Number(v);
  if (v === undefined || v === true || String(v).trim() === '' || !Number.isInteger(n) || n < min || n > max) throw Error(`--${label} must be a whole number from ${min} to ${max}`);
  return n;
}
function need(flags, ...keys) {
  for (const k of keys) if (flags[k] === undefined || flags[k] === true || String(flags[k]).trim() === '') throw Error(`--${k} is required`);
}
function oneOf(v, allowed, label) {
  if (!allowed.includes(v)) throw Error(`--${label} must be one of: ${allowed.join(', ')}`);
  return v;
}
const text = (v) => (v === undefined || v === true ? null : String(v).trim() || null);

export const REGIONS = ['NZ', 'NSW', 'ACT', 'VIC', 'TAS', 'QLD', 'SA', 'NT', 'WA'];
export const CATEGORIES = ['fall', 'medication', 'pressure-injury', 'surgical', 'infection', 'deterioration', 'behaviour', 'restraint', 'blood',
  'identification', 'documentation', 'equipment', 'discharge', 'self-harm', 'other'];
const PERSON_TYPES = ['patient', 'resident', 'client', 'visitor', 'staff'];
const HARMS = ['none', 'near-miss', 'mild', 'moderate', 'severe', 'death'];
const SERVICE_KINDS = ['hospital', 'day-surgery', 'aged-care', 'community', 'mental-health', 'disability', 'clinic'];
const REVIEW_METHODS = ['rca', 'london-protocol', 'alarm', 'case-review', 'after-action', 'other'];
const BODIES = ['hqsc-part-a', 'hqsc-part-b', 'health-department', 'coroner', 'worksafe', 'insurer', 'other'];
const DISCLOSURE_STEPS = { apology: 'apology_at', arranged: 'meeting_arranged_at', meeting: 'meeting_held_at', notes: 'notes_given_at', report: 'final_report_at', 'opted-out': 'opted_out_at' };
const FEEDBACK_KINDS = ['complaint', 'compliment', 'suggestion'];
const VIAS = ['email', 'phone', 'letter', 'in-person', 'web', 'hdc', 'advocate', 'other'];
const FEEDBACK_CATEGORIES = ['care', 'communication', 'access', 'cost', 'staff', 'environment', 'privacy', 'discharge', 'other'];
const RISK_CATEGORIES = ['clinical', 'workforce', 'facility', 'equipment', 'information', 'financial', 'regulatory', 'reputation'];
// Australian sentinel events list, version 2 (ACSQHC).
export const SENTINEL = {
  1: 'Surgery or other invasive procedure performed on the wrong site resulting in serious harm or death',
  2: 'Surgery or other invasive procedure performed on the wrong patient resulting in serious harm or death',
  3: 'Wrong surgical or other invasive procedure performed on a patient resulting in serious harm or death',
  4: 'Unintended retention of a foreign object in a patient after surgery or other invasive procedure resulting in serious harm or death',
  5: 'Haemolytic blood transfusion reaction resulting from ABO incompatibility resulting in serious harm or death',
  6: 'Suspected suicide of a patient in an acute psychiatric unit or acute psychiatric ward',
  7: 'Medication error resulting in serious harm or death',
  8: 'Use of physical or mechanical restraint resulting in serious harm or death',
  9: 'Discharge or release of an infant or child to an unauthorised person',
  10: 'Use of an incorrectly positioned oro- or naso-gastric tube resulting in serious harm or death',
};

async function tx(db, fn) {
  await db.exec('begin');
  try { const r = await fn(); await db.exec('commit'); return r; } catch (e) { await db.exec('rollback'); throw e; }
}
async function log(db, actor, action, ref, detail) {
  await db.query('insert into activity (actor, action, ref, detail) values ($1,$2,$3,$4)', [actor, action, ref, detail]);
}
function actorOf(flags) {
  need(flags, 'actor');
  return String(flags.actor).trim();
}

// Resolve one record from a code, reference, id prefix or name. Exact (case-insensitive) beats
// partial; more than one partial match lists the candidates and fails.
function choose(rows, term, what, label) {
  const t = String(term ?? '').trim().toLowerCase();
  if (!t || t === 'true') throw Error(`Name the ${what.toLowerCase()}`);
  const exact = rows.filter((r) => label(r).some((x) => x && String(x).toLowerCase() === t));
  if (exact.length === 1) return exact[0];
  const partial = exact.length ? exact : rows.filter((r) => label(r).some((x) => x && String(x).toLowerCase().includes(t)));
  if (partial.length === 1) return partial[0];
  if (!partial.length) throw Error(`${what} "${term}" not found`);
  throw Error(`"${term}" is ambiguous: ${partial.map((r) => label(r).filter(Boolean).slice(0, 2).join(' / ')).join('; ')}`);
}
export const service = async (db, term) => choose(await db.query('select * from services order by code'), term, 'Service', (r) => [r.code, r.name, r.id]);
export const person = async (db, term) => choose(await db.query('select * from staff order by code'), term, 'Staff member', (r) => [r.code, r.name, r.id]);
export const incident = async (db, term) => choose(await db.query('select i.*, v.region, v.service, v.country, v.service_now from incidents i join v_incidents v on v.id = i.id order by i.ref'), term, 'Incident', (r) => [r.ref, r.id]);
export const complaint = async (db, term) => choose(await db.query('select c.*, s.region, s.code as service from complaints c join services s on s.id = c.service_id order by c.ref'), term, 'Feedback', (r) => [r.ref, r.from_name, r.id]);
const risk = async (db, term) => choose(await db.query('select * from risks order by ref'), term, 'Risk', (r) => [r.ref, r.title, r.id]);
const action = async (db, term) => choose(await db.query('select * from actions order by ref'), term, 'Action', (r) => [r.ref, r.id]);
const serviceNow = async (db, region) => (await db.query('select region_now($1)::text as now', [region]))[0].now.slice(0, 19);
const serviceToday = async (db, region) => (await serviceNow(db, region)).slice(0, 10);

function draftFile(name, body) {
  const dir = path.join(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  writeFileSync(file, body);
  return path.relative(process.env.OUTPUT_DIR || REPO_ROOT, file).replace(/\\/g, '/');
}

const RANK = { law: 0, policy: 1, house: 2 };

export const reads = {
  // What needs a person today, worst first: the law, then national policy, then house rules, then the quiet ones.
  async attention(db) {
    const due = await db.query(`select ref, service, kind, obligation, due_on::text as due_on, standing, days_over, rule from v_obligation_status
      where standing in ('overdue', 'due soon') order by case standing when 'overdue' then 0 else 1 end, case kind when 'law' then 0 when 'policy' then 1 else 2 end, due_on`);
    const extra = await db.query(`
      select 'house' as kind, ref, service, 'Reported late' as obligation, to_char(reported_at - occurred_at, 'DD"d" HH24"h"') || ' after it happened' as detail
        from v_incidents where status <> 'closed' and reported_at - occurred_at > make_interval(hours => setting_num('late_report_hours', 24)::int)
      union all
      select 'house', ref, service, 'No manager assigned', category || ', ' || rating from v_incidents where status <> 'closed' and manager is null
      union all
      select 'policy', ref, service, 'Sentinel event', 'Category ' || sentinel_category || ': tell the state health department as its policy requires'
        from v_incidents where sentinel_category is not null and status <> 'closed'
      union all
      select 'house', ref, coalesce(service, '-'), 'Extreme risk', title || ' (score ' || score || ')' from v_risks where status = 'open' and level = 'extreme'
      order by 1, 2`);
    return [
      ...due.map((r) => ({ item: `${r.obligation}`, ref: r.ref, service: r.service, kind: r.kind, standing: r.standing === 'overdue' ? `${r.days_over} days over` : `due ${r.due_on}`, rule: r.rule })),
      ...extra.sort((a, b) => RANK[a.kind] - RANK[b.kind]).map((r) => ({ item: r.obligation, ref: r.ref, service: r.service, kind: r.kind, standing: r.detail, rule: '' })),
    ];
  },

  // Every legal and policy clock with a count of what is overdue, due soon, met late and met.
  async compliance(db) {
    return db.query(`select kind, obligation, rule,
        count(*) filter (where standing = 'overdue')::int as overdue, count(*) filter (where standing = 'due soon')::int as due_soon,
        count(*) filter (where standing = 'met late')::int as met_late, count(*) filter (where standing = 'met')::int as met,
        (array_agg(ref || ' ' || days_over || 'd' order by days_over desc) filter (where standing = 'overdue'))[1] as worst
      from v_obligation_status where kind in ('law', 'policy')
      group by kind, obligation, rule
      order by kind, overdue desc, obligation`);
  },

  async obligations(db, args, f) {
    const cols = `ref, service, kind, obligation, due_on::text as due_on, met_on::text as met_on, standing, rule`;
    if (args[0]) return db.query(`select ${cols} from v_obligation_status where ref = upper($1) order by due_on`, [String(args[0])]);
    const days = f.days ? num(f.days, 'days', { min: 0, max: 365 }) : 30;
    return db.query(`select ${cols} from v_obligation_status where met_on is null and due_on <= today + $1::int order by due_on, ref`, [days]);
  },

  async incidents(db, args, f) {
    const where = [];
    const params = [];
    if (f.service) { params.push((await service(db, f.service)).id); where.push(`service_id = $${params.length}`); }
    const status = f.status ? oneOf(String(f.status), ['reported', 'under-review', 'closed', 'open'], 'status') : f.all ? null : 'open';
    if (status === 'open') where.push(`status <> 'closed'`);
    else if (status) { params.push(status); where.push(`status = $${params.length}`); }
    if (f.category) { params.push(oneOf(String(f.category), CATEGORIES, 'category')); where.push(`category = $${params.length}`); }
    if (f.days) { params.push(num(f.days, 'days', { min: 1, max: 3650 })); where.push(`occurred_at > service_now - make_interval(days => $${params.length})`); }
    return db.query(`select ref, service, unit, to_char(occurred_at, 'YYYY-MM-DD HH24:MI') as occurred, category, harm, rating,
        case when sentinel_category is not null then 'sentinel ' || sentinel_category else '' end as sentinel, manager, status, days_open
      from v_incidents ${where.length ? 'where ' + where.join(' and ') : ''} order by occurred_at desc limit 200`, params);
  },

  async incident(db, args) {
    const i = await incident(db, args[0]);
    const [detail] = await db.query('select * from v_incidents where id = $1', [i.id]);
    return {
      incident: { ...detail, sentinel: detail.sentinel_category ? SENTINEL[detail.sentinel_category] : null },
      disclosure: (await db.query(`select d.*, l.name as lead from disclosures d left join staff l on l.id = d.lead_id where incident_id = $1`, [i.id]))[0] || null,
      review: (await db.query(`select r.method, l.name as lead, r.started_on, r.due_on, r.completed_on, r.findings from reviews r left join staff l on l.id = r.lead_id where incident_id = $1`, [i.id]))[0] || null,
      obligations: await db.query(`select obligation, due_on::text as due_on, met_on::text as met_on, standing, rule from v_obligation_status where ref = $1 order by due_on`, [i.ref]),
      actions: await db.query(`select ref, description, owner, due_on, done_on, standing from v_actions where from_ref = $1 order by due_on`, [i.ref]),
      notifications: await db.query(`select body, to_char(sent_at, 'YYYY-MM-DD HH24:MI') as sent, reference from notifications where incident_id = $1 order by sent_at`, [i.id]),
      feedback: await db.query(`select ref, from_name, received_on, stage from v_complaints where incident = $1`, [i.ref]),
      history: await db.query(`select to_char(at, 'YYYY-MM-DD HH24:MI') as at, actor, action, detail from activity where ref = $1 order by at`, [i.ref]),
    };
  },

  async disclosures(db) {
    return db.query(`select i.ref, i.service, i.harm, i.rating, case when i.sdc_applies then 'duty of candour' else 'open disclosure' end as basis, l.name as lead,
        to_char(d.apology_at, 'YYYY-MM-DD') as apology, to_char(d.meeting_arranged_at, 'YYYY-MM-DD') as arranged, to_char(d.meeting_held_at, 'YYYY-MM-DD') as meeting,
        to_char(d.notes_given_at, 'YYYY-MM-DD') as notes, to_char(d.final_report_at, 'YYYY-MM-DD') as report, to_char(d.opted_out_at, 'YYYY-MM-DD') as opted_out
      from v_incidents i left join disclosures d on d.incident_id = i.id left join staff l on l.id = d.lead_id
      where (i.sdc_applies or i.harm in ('moderate', 'severe', 'death')) and i.person_type <> 'staff' and i.person_type <> 'visitor'
      order by i.status = 'closed', i.reported_at desc`);
  },

  async reviews(db) {
    return db.query(`select ref, service, rating, method, lead, started_on, due_on, completed_on, standing from (
        select i.ref, i.service, i.rating, r.method, l.name as lead, r.started_on, r.due_on, r.completed_on, i.reported_at,
          case when r.id is null then 'not started' when r.completed_on is not null then 'done' when r.due_on < i.service_now::date then 'overdue' else 'open' end as standing
        from v_incidents i left join reviews r on r.incident_id = i.id left join staff l on l.id = r.lead_id
        where i.severity <= 2 or i.sentinel_category is not null or r.id is not null) x
      order by standing = 'done', reported_at`);
  },

  async actions(db, args, f) {
    const params = [];
    let where = `standing <> 'done'`;
    if (f.all) where = 'true';
    if (f.owner) { params.push((await person(db, f.owner)).name); where += ` and owner = $1`; }
    return db.query(`select ref, from_ref, description, owner, due_on, done_on, standing from v_actions where ${where} order by done_on nulls first, due_on`, params);
  },

  async complaints(db, args, f) {
    return db.query(`select ref, service, kind, received_on, from_name, category, stage, working_days_open, handled_by, incident
      from v_complaints where ${f.all ? 'true' : `stage not in ('closed', 'logged') or received_on > current_date - 30`}
      order by stage = 'closed', stage = 'logged', received_on`);
  },

  async complaint(db, args) {
    const c = await complaint(db, args[0]);
    return {
      feedback: (await db.query('select * from v_complaints where id = $1', [c.id]))[0],
      obligations: await db.query(`select obligation, due_on::text as due_on, met_on::text as met_on, standing, rule from v_obligation_status where ref = $1 order by due_on`, [c.ref]),
      actions: await db.query(`select ref, description, owner, due_on, done_on, standing from v_actions where from_ref = $1`, [c.ref]),
      history: await db.query(`select to_char(at, 'YYYY-MM-DD HH24:MI') as at, actor, action, detail from activity where ref = $1 order by at`, [c.ref]),
    };
  },

  async risks(db, args, f) {
    return db.query(`select ref, service, title, likelihood as l, consequence as c, score, level, owner, last_reviewed_on, review_due, open_actions
      from v_risks where ${f.all ? 'true' : `status = 'open'`} order by score desc, review_due`);
  },

  async risk(db, args) {
    const r = await risk(db, args[0]);
    return {
      risk: (await db.query('select * from v_risks where id = $1', [r.id]))[0],
      actions: await db.query(`select ref, description, owner, due_on, done_on, standing from v_actions where from_ref = $1`, [r.ref]),
      incidents_90_days: await db.query(`select ref, category, harm, rating from v_incidents where service_id is not distinct from coalesce($1, service_id)
        and category = any($2) and occurred_at > service_now - interval '90 days' order by occurred_at desc limit 20`,
        [r.service_id, r.title.toLowerCase().includes('fall') ? ['fall'] : r.title.toLowerCase().match(/opioid|dos|medic/) ? ['medication'] : ['__none__']]),
    };
  },

  // Incidents per month by category for each service, the last six months.
  async trends(db, args, f) {
    const params = [];
    let where = `occurred_at >= date_trunc('month', service_now) - interval '5 months'`;
    if (f.service) { params.push((await service(db, f.service)).id); where += ` and service_id = $1`; }
    return db.query(`select service, category, ${[5, 4, 3, 2, 1, 0].map((m) => `count(*) filter (where date_trunc('month', occurred_at) = date_trunc('month', service_now) - interval '${m} months')::int as "${m === 0 ? 'this month' : `m-${m}`}"`).join(', ')},
        count(*) filter (where harm in ('moderate', 'severe', 'death'))::int as with_harm
      from v_incidents where ${where} group by service, category order by service, count(*) desc`, params);
  },

  async sentinel(db) {
    const rows = await db.query(`select ref, service, to_char(occurred_at, 'YYYY-MM-DD') as occurred, sentinel_category, status from v_incidents where sentinel_category is not null order by occurred_at desc`);
    return rows.map((r) => ({ ...r, sentinel: SENTINEL[r.sentinel_category] }));
  },

  async services(db) {
    return db.query(`select s.code, s.name, s.kind, s.region, s.beds,
        (select count(*)::int from incidents i where i.service_id = s.id and i.status <> 'closed') as open_incidents,
        (select count(*)::int from complaints c where c.service_id = s.id and c.kind = 'complaint' and c.outcome_on is null) as open_complaints
      from services s order by s.code`);
  },

  async staff(db) {
    return db.query(`select code, name, role, email, active,
        (select count(*)::int from actions a where a.owner_id = st.id and a.done_on is null) as open_actions
      from staff st order by active desc, name`);
  },

  async holidays(db, args, f) {
    return db.query(`select on_date::text as on_date, region, name from holidays where on_date >= current_date - ${f.all ? 3650 : 30} order by on_date, region`);
  },

  async activity(db, args, f) {
    const n = f.days ? num(f.days, 'days', { min: 1, max: 365 }) : 7;
    return db.query(`select to_char(at, 'YYYY-MM-DD HH24:MI') as at, actor, action, ref, detail from activity where at > now() - make_interval(days => $1) order by at desc limit 200`, [n]);
  },

  async insights(db) {
    const out = [];
    for (const q of QUESTIONS) out.push({ question: q.question, rows: await db.query(q.sql) });
    return out;
  },
};

// Ten questions the vendor's dashboard does not answer. Each runs today against the records.
export const QUESTIONS = [
  { question: 'Which legal or policy deadlines did we miss or meet late this year, and by how many days?', sql: `select ref, service, obligation, due_on, met_on,
      coalesce(met_on, today) - due_on as days_late from v_obligation_status where kind in ('law', 'policy') and standing in ('overdue', 'met late')
      and due_on >= date_trunc('year', today) order by days_late desc` },
  { question: 'How long does each service take to rate a new incident, on average, over 90 days?', sql: `select service, count(*)::int as rated,
      round(avg(extract(epoch from rated_at - reported_at) / 3600))::int as avg_hours, max(round(extract(epoch from rated_at - reported_at) / 3600))::int as worst_hours
    from v_incidents where rated_at is not null and reported_at > service_now - interval '90 days' group by service order by avg_hours desc` },
  { question: 'Which units report late (more than a day after the event), over 90 days?', sql: `select service, unit, count(*) filter (where reported_at - occurred_at > interval '24 hours')::int as late,
      count(*)::int as reports, round(100.0 * count(*) filter (where reported_at - occurred_at > interval '24 hours') / count(*))::int as late_pct
    from v_incidents where occurred_at > service_now - interval '90 days' group by service, unit having count(*) filter (where reported_at - occurred_at > interval '24 hours') > 0 order by late_pct desc` },
  { question: 'Which categories are rising: this month and last against the four months before?', sql: `select service, category,
      count(*) filter (where occurred_at >= date_trunc('month', service_now) - interval '1 month')::int as last_2_months,
      round(count(*) filter (where occurred_at < date_trunc('month', service_now) - interval '1 month' and occurred_at >= date_trunc('month', service_now) - interval '5 months') / 2.0, 1) as avg_2_months_before
    from v_incidents where occurred_at >= date_trunc('month', service_now) - interval '5 months' group by service, category
    having count(*) filter (where occurred_at >= date_trunc('month', service_now) - interval '1 month') > count(*) filter (where occurred_at < date_trunc('month', service_now) - interval '1 month' and occurred_at >= date_trunc('month', service_now) - interval '5 months') / 2.0
    order by service, category` },
  { question: 'Which complaints are linked to an incident, and was disclosure done before the complaint arrived?', sql: `select c.ref, c.service, c.incident, c.received_on,
      to_char(coalesce(d.apology_at, d.meeting_held_at), 'YYYY-MM-DD') as disclosed_on,
      case when coalesce(d.apology_at, d.meeting_held_at)::date <= c.received_on then 'yes' else 'no' end as disclosed_first
    from v_complaints c join incidents i on i.ref = c.incident left join disclosures d on d.incident_id = i.id order by c.received_on desc` },
  { question: 'Who owns the most overdue actions, and how old is the oldest?', sql: `select owner, count(*)::int as overdue, current_date - min(due_on) as oldest_days
    from v_actions where standing = 'overdue' group by owner order by overdue desc, oldest_days desc` },
  { question: 'Which open risks have had incidents in the last 90 days that match them?', sql: `select r.ref, r.title, r.score, count(i.id)::int as matching_incidents
    from v_risks r join risks rr on rr.id = r.id join v_incidents i on (rr.service_id is null or i.service_id = rr.service_id)
      and ((r.title ilike '%fall%' and i.category = 'fall') or (r.title ~* 'opioid|dosing|medication' and i.category = 'medication') or (r.title ilike '%pressure%' and i.category = 'pressure-injury')
        or (r.title ilike '%transfer%' and i.category = 'deterioration') or (r.title ilike '%retained%' and i.category = 'surgical') or (r.title ilike '%visit%' and i.category = 'medication' and i.service_kind = 'community'))
      and i.occurred_at > i.service_now - interval '90 days'
    where r.status = 'open' group by r.ref, r.title, r.score order by matching_incidents desc` },
  { question: 'How many working days does each service take to close a complaint?', sql: `select service, count(*)::int as closed, round(avg(working_days_open))::int as avg_working_days, max(working_days_open) as longest
    from v_complaints where kind = 'complaint' and outcome_on is not null group by service order by avg_working_days desc` },
  { question: 'Which incidents with harm have no review, no action and no disclosure recorded?', sql: `select i.ref, i.service, i.category, i.harm, i.rating from v_incidents i
    where i.harm in ('moderate', 'severe', 'death') and not exists (select 1 from reviews r where r.incident_id = i.id)
      and not exists (select 1 from actions a where a.incident_id = i.id) and not exists (select 1 from disclosures d where d.incident_id = i.id)` },
  { question: 'What share of incidents happen at night (10 pm to 6 am), by service and category?', sql: `select service, category,
      count(*) filter (where extract(hour from occurred_at) >= 22 or extract(hour from occurred_at) < 6)::int as at_night, count(*)::int as total
    from v_incidents where occurred_at > service_now - interval '180 days' group by service, category
    having count(*) filter (where extract(hour from occurred_at) >= 22 or extract(hour from occurred_at) < 6) > 0 order by at_night desc` },
];

// ------------------------------------------------------------------ writes

const writes = {
  async 'add-service'(db, args, f) {
    const actor = actorOf(f);
    need(f, 'code', 'name', 'region');
    const code = String(f.code).toUpperCase();
    await db.query('insert into services (code, name, kind, region, beds) values ($1,$2,$3,$4,$5)',
      [code, f.name, oneOf(f.kind || 'hospital', SERVICE_KINDS, 'kind'), oneOf(String(f.region).toUpperCase(), REGIONS, 'region'), f.beds ? num(f.beds, 'beds', { max: 5000 }) : null]);
    await log(db, actor, 'add-service', code, f.name);
    return { added: code };
  },

  async 'add-unit'(db, args, f) {
    const actor = actorOf(f);
    need(f, 'service', 'code', 'name');
    const s = await service(db, f.service);
    await db.query('insert into units (service_id, code, name) values ($1,$2,$3)', [s.id, String(f.code).toUpperCase(), f.name]);
    await log(db, actor, 'add-unit', s.code, `${String(f.code).toUpperCase()} ${f.name}`);
    return { service: s.code, unit: String(f.code).toUpperCase() };
  },

  async 'add-staff'(db, args, f) {
    const actor = actorOf(f);
    need(f, 'code', 'name');
    const code = String(f.code).toUpperCase();
    await db.query('insert into staff (code, name, role, email) values ($1,$2,$3,$4)', [code, f.name, text(f.role) || 'clinician', text(f.email)]);
    await log(db, actor, 'add-staff', code, f.name);
    return { added: code };
  },

  async 'add-holiday'(db, args, f) {
    const actor = actorOf(f);
    need(f, 'date', 'region', 'name');
    const region = String(f.region).toUpperCase();
    if (region !== 'AU') oneOf(region, REGIONS, 'region');
    await db.query('insert into holidays (on_date, region, name) values ($1,$2,$3) on conflict (on_date, region) do update set name = excluded.name', [date(f.date, 'date'), region, f.name]);
    await log(db, actor, 'add-holiday', region, `${f.date} ${f.name}`);
    return { holiday: f.date, region };
  },

  // A new incident report. The reporter's words go in --summary; a manager rates it next.
  async report(db, args, f) {
    const actor = actorOf(f);
    need(f, 'service', 'category', 'summary', 'at');
    const s = await service(db, f.service);
    const occurred = stamp(f.at, 'at');
    const reported = f.reported ? stamp(f.reported, 'reported') : await serviceNow(db, s.region);
    if (reported < occurred) throw Error('--reported is before --at');
    let unitId = null;
    if (f.unit) {
      const u = await db.query('select id from units where service_id = $1 and (code = upper($2) or lower(name) = lower($2))', [s.id, f.unit]);
      if (u.length !== 1) throw Error(`Unit "${f.unit}" not found at ${s.code}. Add it with add-unit.`);
      unitId = u[0].id;
    }
    return tx(db, async () => {
      const [row] = await db.query(`insert into incidents (service_id, unit_id, occurred_at, reported_at, reported_by, category, person_type, person_ref, summary, immediate_action, harm)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning ref`,
      [s.id, unitId, occurred, reported.slice(0, 19), text(f.by) || actor, oneOf(String(f.category), CATEGORIES, 'category'),
        oneOf(f.person || 'patient', PERSON_TYPES, 'person'), text(f['person-ref']), f.summary, text(f.action), f.harm ? oneOf(String(f.harm), HARMS, 'harm') : null]);
      await log(db, actor, 'report', row.ref, `${s.code} ${f.category}: ${String(f.summary).slice(0, 120)}`);
      return { reported: row.ref, service: s.code, next: `A manager rates it: rate ${row.ref} --severity=<1-4> --harm=<harm>` };
    });
  },

  // The manager's rating: severity 1 to 4 (SAC, or ISR in Victoria), harm, and the sentinel or ARR flag.
  async rate(db, args, f) {
    const actor = actorOf(f);
    need(f, 'severity', 'harm');
    const i = await incident(db, args[0]);
    const severity = num(f.severity, 'severity', { min: 1, max: 4 });
    const harm = oneOf(String(f.harm), HARMS, 'harm');
    const sentinel = f.sentinel ? num(f.sentinel, 'sentinel', { min: 1, max: 10 }) : null;
    if (sentinel && !['severe', 'death'].includes(harm) && sentinel !== 6 && sentinel !== 9) throw Error(`Sentinel category ${sentinel} needs serious harm or death: ${SENTINEL[sentinel]}`);
    const now = await serviceNow(db, i.region);
    return tx(db, async () => {
      await db.query(`update incidents set severity = $2, harm = $3, sentinel_category = $4, always_report = $5, psychological_harm = $6, rated_at = $7, rated_by = $8,
          manager_id = coalesce($9, manager_id) where id = $1`,
      [i.id, severity, harm, sentinel, Boolean(f.arr), Boolean(f.psychological), now, actor, f.manager ? (await person(db, f.manager)).id : null]);
      await log(db, actor, 'rate', i.ref, `severity ${severity}, ${harm}${sentinel ? `, sentinel ${sentinel}` : ''}${f.arr ? ', ARR' : ''}`);
      const owed = await db.query(`select obligation, due_on::text as due_on, rule from v_obligation_status where ref = $1 and met_on is null order by due_on`, [i.ref]);
      return { rated: i.ref, severity, harm, sentinel: sentinel ? SENTINEL[sentinel] : null, now_owed: owed };
    });
  },

  async assign(db, args, f) {
    const actor = actorOf(f);
    need(f, 'manager');
    const i = await incident(db, args[0]);
    const m = await person(db, f.manager);
    await tx(db, async () => {
      await db.query('update incidents set manager_id = $2 where id = $1', [i.id, m.id]);
      await log(db, actor, 'assign', i.ref, m.name);
    });
    return { incident: i.ref, manager: m.name };
  },

  // One step of open disclosure or the duty of candour: apology, arranged, meeting, notes, report, opted-out.
  async disclose(db, args, f) {
    const actor = actorOf(f);
    need(f, 'step');
    const i = await incident(db, args[0]);
    const col = DISCLOSURE_STEPS[f.step];
    if (!col) throw Error(`--step must be one of: ${Object.keys(DISCLOSURE_STEPS).join(', ')}`);
    const when = f.at ? stamp(f.at, 'at') : (await serviceNow(db, i.region)).slice(0, 19);
    return tx(db, async () => {
      await db.query(`insert into disclosures (incident_id, lead_id, ${col}, note) values ($1,$2,$3,$4)
        on conflict (incident_id) do update set ${col} = excluded.${col}, lead_id = coalesce(excluded.lead_id, disclosures.lead_id),
          note = coalesce(disclosures.note || E'\\n', '') || coalesce(excluded.note, '')`,
      [i.id, f.lead ? (await person(db, f.lead)).id : null, when, text(f.note)]);
      await log(db, actor, 'disclose', i.ref, `${f.step} ${when.slice(0, 16)}${f.note ? `: ${f.note}` : ''}`);
      return { incident: i.ref, step: f.step, at: when.slice(0, 16) };
    });
  },

  async 'start-review'(db, args, f) {
    const actor = actorOf(f);
    need(f, 'method', 'lead');
    const i = await incident(db, args[0]);
    const started = f.date ? date(f.date, 'date') : await serviceToday(db, i.region);
    const days = (await db.query(`select setting_num('review_due_days', 45)::int as d`))[0].d;
    const due = f.due ? date(f.due, 'due') : new Date(Date.parse(`${started}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
    return tx(db, async () => {
      await db.query('insert into reviews (incident_id, method, lead_id, started_on, due_on) values ($1,$2,$3,$4,$5)',
        [i.id, oneOf(String(f.method), REVIEW_METHODS, 'method'), (await person(db, f.lead)).id, started, due]);
      await db.query(`update incidents set status = 'under-review' where id = $1 and status = 'reported'`, [i.id]);
      await log(db, actor, 'start-review', i.ref, `${f.method}, due ${due}`);
      return { incident: i.ref, method: f.method, due_on: due };
    });
  },

  async 'finish-review'(db, args, f) {
    const actor = actorOf(f);
    need(f, 'findings');
    const i = await incident(db, args[0]);
    const done = f.date ? date(f.date, 'date') : await serviceToday(db, i.region);
    return tx(db, async () => {
      const r = await db.query('update reviews set completed_on = $2, findings = $3 where incident_id = $1 and completed_on is null returning id', [i.id, done, f.findings]);
      if (!r.length) throw Error(`${i.ref} has no open review. Start one with start-review.`);
      await log(db, actor, 'finish-review', i.ref, String(f.findings).slice(0, 200));
      return { incident: i.ref, completed_on: done, next: 'Add an action for each recommendation (add-action), then send any Part B or final report.' };
    });
  },

  async 'add-action'(db, args, f) {
    const actor = actorOf(f);
    need(f, 'description', 'owner', 'due');
    const ref = String(args[0] ?? '').toUpperCase();
    const link = { incident_id: null, complaint_id: null, risk_id: null };
    if (ref.startsWith('INC-')) link.incident_id = (await incident(db, ref)).id;
    else if (ref.startsWith('FB-')) link.complaint_id = (await complaint(db, ref)).id;
    else if (ref.startsWith('RSK-')) link.risk_id = (await risk(db, ref)).id;
    else if (ref) throw Error('Link the action to an incident (INC-), feedback (FB-) or risk (RSK-), or leave it unlinked');
    return tx(db, async () => {
      const [row] = await db.query('insert into actions (incident_id, complaint_id, risk_id, description, owner_id, due_on) values ($1,$2,$3,$4,$5,$6) returning ref',
        [link.incident_id, link.complaint_id, link.risk_id, f.description, (await person(db, f.owner)).id, date(f.due, 'due')]);
      await log(db, actor, 'add-action', ref || row.ref, `${row.ref}: ${f.description}`);
      return { action: row.ref, from: ref || null, due_on: f.due };
    });
  },

  async 'action-done'(db, args, f) {
    const actor = actorOf(f);
    need(f, 'evidence');
    const a = await action(db, args[0]);
    if (a.done_on) throw Error(`${a.ref} was done on ${String(a.done_on).slice(0, 10)}`);
    return tx(db, async () => {
      await db.query('update actions set done_on = $2, evidence = $3 where id = $1', [a.id, f.date ? date(f.date, 'date') : today(), f.evidence]);
      await log(db, actor, 'action-done', a.ref, f.evidence);
      return { action: a.ref, done: true };
    });
  },

  // A report sent outside: HQSC Part A or B, the state health department, a coroner, WorkSafe, the insurer.
  async notify(db, args, f) {
    const actor = actorOf(f);
    need(f, 'to');
    const i = await incident(db, args[0]);
    const body = oneOf(String(f.to), BODIES, 'to');
    const sent = f.at ? stamp(f.at, 'at') : (await serviceNow(db, i.region)).slice(0, 19);
    return tx(db, async () => {
      await db.query('insert into notifications (incident_id, body, sent_at, reference, note) values ($1,$2,$3,$4,$5)', [i.id, body, sent, text(f.reference), text(f.note)]);
      await log(db, actor, 'notify', i.ref, `${body}${f.reference ? ` ${f.reference}` : ''}`);
      return { incident: i.ref, notified: body, sent: sent.slice(0, 16) };
    });
  },

  // Closing needs a rating, then checks the record is complete; --override names the reason when it is not.
  async close(db, args, f) {
    const actor = actorOf(f);
    const i = await incident(db, args[0]);
    if (i.status === 'closed') throw Error(`${i.ref} is already closed`);
    if (i.severity === null) throw Error(`${i.ref} cannot close: not rated. Rate it first (rate ${i.ref} --severity=<1-4> --harm=<harm>)`);
    const gaps = [];
    const open = await db.query(`select obligation from v_obligation_status where ref = $1 and met_on is null and obligation <> 'Severity rated'`, [i.ref]);
    gaps.push(...open.map((o) => `${o.obligation} not recorded`));
    const acts = await db.query('select ref from actions where incident_id = $1 and done_on is null', [i.id]);
    if (acts.length) gaps.push(`actions open: ${acts.map((a) => a.ref).join(', ')}`);
    if (gaps.length && !text(f.override)) throw Error(`${i.ref} cannot close: ${gaps.join('; ')}. Finish them or add --override="<reason>"`);
    const now = (await serviceNow(db, i.region)).slice(0, 19);
    return tx(db, async () => {
      await db.query(`update incidents set status = 'closed', closed_at = $2, closed_by = $3, close_note = $4 where id = $1`, [i.id, now, actor, text(f.note) || text(f.override)]);
      await log(db, actor, 'close', i.ref, gaps.length ? `closed with gaps (${gaps.join('; ')}): ${f.override}` : text(f.note) || 'closed');
      return { closed: i.ref, gaps };
    });
  },

  async 'log-feedback'(db, args, f) {
    const actor = actorOf(f);
    need(f, 'service', 'from', 'about');
    const s = await service(db, f.service);
    const received = f.date ? date(f.date, 'date') : await serviceToday(db, s.region);
    return tx(db, async () => {
      const [row] = await db.query(`insert into complaints (service_id, kind, received_on, received_via, from_name, from_contact, about, category, incident_id, handled_by)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning ref`,
      [s.id, oneOf(f.kind || 'complaint', FEEDBACK_KINDS, 'kind'), received, oneOf(f.via || 'email', VIAS, 'via'), f.from, text(f.contact), f.about,
        oneOf(f.category || 'care', FEEDBACK_CATEGORIES, 'category'), f.incident ? (await incident(db, f.incident)).id : null, f.handler ? (await person(db, f.handler)).id : null]);
      await log(db, actor, 'log-feedback', row.ref, `${f.kind || 'complaint'} from ${f.from}: ${String(f.about).slice(0, 120)}`);
      const owed = await db.query(`select obligation, due_on::text as due_on, rule from v_obligation_status where ref = $1 and met_on is null order by due_on`, [row.ref]);
      return { logged: row.ref, received_on: received, now_owed: owed };
    });
  },

  async acknowledge(db, args, f) {
    const actor = actorOf(f);
    const c = await complaint(db, args[0]);
    if (c.acknowledged_on) throw Error(`${c.ref} was acknowledged on ${String(c.acknowledged_on).slice(0, 10)}`);
    const on = f.date ? date(f.date, 'date') : await serviceToday(db, c.region);
    return tx(db, async () => {
      await db.query('update complaints set acknowledged_on = $2, last_contact_on = $2 where id = $1', [c.id, on]);
      await log(db, actor, 'acknowledge', c.ref, `acknowledged in writing ${on}`);
      return { feedback: c.ref, acknowledged_on: on };
    });
  },

  // Right 10(7): justified, not justified, or more time (with --days; over 20 working days, tell them why).
  async decide(db, args, f) {
    const actor = actorOf(f);
    need(f, 'decision');
    const c = await complaint(db, args[0]);
    if (!c.acknowledged_on) throw Error(`${c.ref} has not been acknowledged. Acknowledge it first.`);
    const decision = oneOf(String(f.decision), ['justified', 'not-justified', 'more-time'], 'decision');
    const days = decision === 'more-time' ? num(f.days, 'days', { min: 1, max: 260 }) : null;
    const on = f.date ? date(f.date, 'date') : await serviceToday(db, c.region);
    return tx(db, async () => {
      await db.query('update complaints set decision = $2, decided_on = $3, more_time_days = $4, told_more_time_on = $5, last_contact_on = $3 where id = $1',
        [c.id, decision, on, days, f.told ? on : null]);
      await log(db, actor, 'decide', c.ref, `${decision}${days ? `, ${days} more working days${f.told ? ', consumer told with reasons' : ''}` : ''}`);
      const warn = days && days > 20 && !f.told ? 'More than 20 working days: tell the consumer with reasons inside the 10 working days, then run contact --told-more-time.' : null;
      return { feedback: c.ref, decision, more_time_days: days, warning: warn };
    });
  },

  // Any contact with the person: a progress update (Right 10(4)), or telling them more time is needed.
  async contact(db, args, f) {
    const actor = actorOf(f);
    need(f, 'note');
    const c = await complaint(db, args[0]);
    const on = f.date ? date(f.date, 'date') : await serviceToday(db, c.region);
    return tx(db, async () => {
      await db.query(`update complaints set last_contact_on = $2, told_more_time_on = case when $3 then coalesce(told_more_time_on, $2) else told_more_time_on end where id = $1`,
        [c.id, on, Boolean(f['told-more-time'])]);
      await log(db, actor, 'contact', c.ref, f.note);
      return { feedback: c.ref, contact_on: on };
    });
  },

  async resolve(db, args, f) {
    const actor = actorOf(f);
    need(f, 'outcome');
    const c = await complaint(db, args[0]);
    if (c.outcome_on) throw Error(`${c.ref} was resolved on ${String(c.outcome_on).slice(0, 10)}`);
    if (c.kind === 'complaint' && !c.decided_on) {
      if (!f.decision) throw Error(`${c.ref} has no decision. Add --decision=justified|not-justified`);
    }
    const on = f.date ? date(f.date, 'date') : await serviceToday(db, c.region);
    return tx(db, async () => {
      if (f.decision) await db.query('update complaints set decision = $2, decided_on = coalesce(decided_on, $3) where id = $1', [c.id, oneOf(String(f.decision), ['justified', 'not-justified'], 'decision'), on]);
      await db.query('update complaints set outcome_on = $2, outcome = $3, last_contact_on = $2 where id = $1', [c.id, on, f.outcome]);
      await log(db, actor, 'resolve', c.ref, f.outcome);
      return { feedback: c.ref, resolved_on: on };
    });
  },

  async 'add-risk'(db, args, f) {
    const actor = actorOf(f);
    need(f, 'title', 'likelihood', 'consequence', 'owner');
    const s = f.service ? await service(db, f.service) : null;
    return tx(db, async () => {
      const [row] = await db.query(`insert into risks (service_id, title, category, likelihood, consequence, controls, owner_id, review_every_days, last_reviewed_on)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning ref`,
      [s?.id ?? null, f.title, oneOf(f.category || 'clinical', RISK_CATEGORIES, 'category'), num(f.likelihood, 'likelihood', { min: 1, max: 5 }),
        num(f.consequence, 'consequence', { min: 1, max: 5 }), text(f.controls), (await person(db, f.owner)).id, f.every ? num(f.every, 'every', { min: 7, max: 730 }) : 90, today()]);
      await log(db, actor, 'add-risk', row.ref, f.title);
      return { risk: row.ref };
    });
  },

  async 'review-risk'(db, args, f) {
    const actor = actorOf(f);
    const r = await risk(db, args[0]);
    const l = f.likelihood ? num(f.likelihood, 'likelihood', { min: 1, max: 5 }) : r.likelihood;
    const c = f.consequence ? num(f.consequence, 'consequence', { min: 1, max: 5 }) : r.consequence;
    return tx(db, async () => {
      await db.query('update risks set likelihood = $2, consequence = $3, controls = coalesce($4, controls), last_reviewed_on = $5 where id = $1', [r.id, l, c, text(f.controls), f.date ? date(f.date, 'date') : today()]);
      await log(db, actor, 'review-risk', r.ref, `score ${r.likelihood * r.consequence} -> ${l * c}${f.note ? `: ${f.note}` : ''}`);
      return { risk: r.ref, score: l * c, was: r.likelihood * r.consequence };
    });
  },

  async 'close-risk'(db, args, f) {
    const actor = actorOf(f);
    need(f, 'reason');
    const r = await risk(db, args[0]);
    return tx(db, async () => {
      await db.query(`update risks set status = 'closed' where id = $1`, [r.id]);
      await log(db, actor, 'close-risk', r.ref, f.reason);
      return { closed: r.ref };
    });
  },

  async set(db, args, f) {
    const actor = actorOf(f);
    const [key, value] = args;
    if (!key || value === undefined) throw Error('Usage: set <key> <value>');
    const [row] = await db.query('select * from settings where key = $1', [key]);
    if (!row) throw Error(`Unknown setting "${key}". Known: ${(await db.query('select key from settings order by key')).map((r) => r.key).join(', ')}`);
    if (!/^\d+$/.test(String(value))) throw Error('Settings are whole numbers of days, hours or working days');
    await tx(db, async () => {
      await db.query('update settings set value = $2 where key = $1', [key, String(value)]);
      await log(db, actor, 'set', key, `${row.value} -> ${value}`);
    });
    return { setting: key, was: row.value, now: String(value), note: row.note };
  },

  async log(db, args, f) {
    const actor = actorOf(f);
    need(f, 'note');
    const ref = String(args[0] ?? '').toUpperCase();
    if (ref.startsWith('INC-')) await incident(db, ref);
    else if (ref.startsWith('FB-')) await complaint(db, ref);
    else if (ref.startsWith('RSK-')) await risk(db, ref);
    else throw Error('Name an incident (INC-), feedback (FB-) or risk (RSK-)');
    await log(db, actor, 'note', ref, f.note);
    return { ref, noted: true };
  },
};

// ------------------------------------------------------------------ drafts (written to drafts/, never sent)

const drafts = {
  // HDC Right 10(6): the written acknowledgement, with the complaints process and the advocacy service.
  async 'draft-acknowledgement'(db, args) {
    const c = await complaint(db, args[0]);
    const [v] = await db.query('select * from v_complaints where id = $1', [c.id]);
    const [s] = await db.query('select * from services where id = $1', [c.service_id]);
    const nz = s.region === 'NZ';
    const lines = [`# Acknowledgement: ${c.ref}`, '', `To: ${c.from_name}${c.from_contact ? ` (${c.from_contact})` : ''}`, `From: ${s.name}`, '',
      `Dear ${c.from_name.split(' (')[0]},`, '',
      `Thank you for contacting us on ${String(v.received_on).slice(0, 10)} about: ${c.about}`, '',
      `We have received your complaint and ${v.handled_by || '[name]'} is looking into it.`,
      nz ? 'We will let you know within 10 working days whether we consider your complaint justified, or whether we need more time to look into it, and we will keep you updated at least once a month until it is resolved.'
        : 'We will keep you updated as we look into it and tell you what we find and what we will do.',
      nz ? 'You can contact the Nationwide Health and Disability Advocacy Service for free, independent support on 0800 555 050 or advocacy@advocacy.org.nz, and you can complain to the Health and Disability Commissioner at any time.' : '[The state health complaints body and its contact details.]',
      '', '[Our complaints process, in two or three lines.]', '', 'Yours sincerely,', v.handled_by || '[name]', ''];
    const file = draftFile(`acknowledgement-${c.ref}.md`, lines.join('\n'));
    return { draft: file, feedback: c.ref, note: 'Draft only. A person sends it, then runs acknowledge.' };
  },

  // Victorian duty of candour final written report: the matters s 128ZC requires, filled from the record.
  async 'draft-candour-report'(db, args) {
    const i = await incident(db, args[0]);
    const r = await reads.incident(db, [i.ref]);
    const d = r.disclosure || {};
    const lines = [`# Final written report: ${i.ref}`, '', `Service: ${r.incident.service_name}`, `Patient record: ${r.incident.person_ref || '[record number]'}`, '',
      '## What happened', '', r.incident.summary, '', `Immediate care: ${i.immediate_action || '[what was done straight away]'}`, '',
      '## Our apology', '', `[A genuine apology, in the words given at the meeting${d.meeting_held_at ? ` on ${String(d.meeting_held_at).slice(0, 10)}` : ''}.]`, '',
      '## How we responded', '', r.review ? `We reviewed the event using ${r.review.method}${r.review.completed_on ? `, completed ${String(r.review.completed_on).slice(0, 10)}` : ' (in progress)'}.` : '[How the event was reviewed.]',
      r.review?.findings ? `\n${r.review.findings}` : '', '',
      '## What we are changing so it does not happen again', '', ...(r.actions.length ? r.actions.map((a) => `- ${a.description} (${a.owner}, by ${String(a.due_on).slice(0, 10)})`) : ['- [Each change, who owns it, by when.]']), '',
      '## Who to contact', '', '[Name and phone of the person who will answer questions.]', '',
      r.incident.sdc_applies ? 'This report is given under the statutory duty of candour (Health Services Act 1988 (Vic) Part 5A).' : '', ''];
    const file = draftFile(`candour-report-${i.ref}.md`, lines.join('\n'));
    return { draft: file, incident: i.ref, note: 'Draft only. Clinical lead and the quality manager check every line, then a person gives it to the patient and runs disclose --step=report.' };
  },

  // The HQSC Part A brief, pre-filled from the record, for New Zealand SAC 1 and 2 and ARR events.
  async 'draft-part-a'(db, args) {
    const i = await incident(db, args[0]);
    const [v] = await db.query('select * from v_incidents where id = $1', [i.id]);
    if (!v.hqsc_applies) throw Error(`${i.ref} is not a New Zealand SAC 1 or 2 or ARR event`);
    const lines = [`# HQSC Part A brief (draft): ${i.ref}`, '', '| Field | From the record |', '|---|---|',
      `| Provider | ${v.service_name} |`, `| Date of event | ${String(v.occurred_at).slice(0, 10)} |`, `| Date notified to provider | ${String(v.reported_at).slice(0, 10)} |`,
      `| SAC rating | ${v.severity}${v.always_report ? ' (Always Report and Review)' : ''} |`, `| Category | ${v.category} |`, `| Harm | ${v.harm} |`,
      `| What happened (no names) | ${v.summary} |`, `| Review method | ${(await db.query('select method from reviews where incident_id = $1', [i.id]))[0]?.method || '[not started]'} |`, '',
      'Copy into the current HQSC Part A form. Check the form for any field not listed here. Never include a name or an NHI number.', ''];
    const file = draftFile(`hqsc-part-a-${i.ref}.md`, lines.join('\n'));
    return { draft: file, incident: i.ref, note: 'Draft only. Once sent, run notify --to=hqsc-part-a --reference=<ref>.' };
  },

  // The monthly clinical governance committee report.
  async 'draft-committee-report'(db, args, f) {
    const params = [];
    let where = '';
    if (f.service) { params.push((await service(db, f.service)).id); where = 'and service_id = $1'; }
    const counts = await db.query(`select service, count(*)::int as reported, count(*) filter (where harm in ('moderate', 'severe', 'death'))::int as with_harm,
        count(*) filter (where severity <= 2)::int as severity_1_2, count(*) filter (where sentinel_category is not null)::int as sentinel
      from v_incidents where occurred_at > service_now - interval '1 month' ${where} group by service order by service`, params);
    const comp = await reads.compliance(db);
    const att = await reads.attention(db);
    const trends = await reads.trends(db, [], f);
    const fb = await db.query(`select service, kind, count(*)::int as n from v_complaints where received_on > current_date - 30 group by service, kind order by service, kind`);
    const risksTop = await reads.risks(db, [], {});
    const lines = [`# Clinical governance report, ${today()}`, '', '## Incidents in the last month', '', '| Service | Reported | With harm | Severity 1-2 | Sentinel |', '|---|---|---|---|---|',
      ...counts.map((r) => `| ${r.service} | ${r.reported} | ${r.with_harm} | ${r.severity_1_2} | ${r.sentinel} |`), '',
      '## Legal and policy timeframes', '', '| Rule | Overdue | Due soon | Met late | Met |', '|---|---|---|---|---|',
      ...comp.map((r) => `| ${r.obligation} (${r.rule}) | ${r.overdue} | ${r.due_soon} | ${r.met_late} | ${r.met} |`), '',
      '## Trends, six months', '', '| Service | Category | Months (oldest to this month) | With harm |', '|---|---|---|---|',
      ...trends.map((t) => `| ${t.service} | ${t.category} | ${['m-5', 'm-4', 'm-3', 'm-2', 'm-1', 'this month'].map((k) => t[k]).join(' ')} | ${t.with_harm} |`), '',
      '## Feedback in the last 30 days', '', ...fb.map((r) => `- ${r.service}: ${r.n} ${r.kind}${r.n === 1 ? '' : 's'}`), '',
      '## Highest risks', '', ...risksTop.slice(0, 5).map((r) => `- ${r.ref} ${r.title}: ${r.level} (${r.score}), review due ${String(r.review_due).slice(0, 10)}`), '',
      '## Needs a decision', '', ...att.filter((a) => a.kind !== 'house').slice(0, 10).map((a) => `- ${a.ref} ${a.item}: ${a.standing}`), ''];
    const file = draftFile(`committee-report-${today()}.md`, lines.join('\n'));
    return { draft: file, services: counts.length };
  },

  async 'weekly-review'(db) {
    const att = await reads.attention(db);
    const comp = await reads.compliance(db);
    const cmp = await reads.complaints(db, [], {});
    const acts = await reads.actions(db, [], {});
    const rev = await reads.reviews(db);
    const by = (k) => att.filter((r) => r.kind === k);
    const lines = [`# Monday review, ${today()}`, '',
      `- The law: ${by('law').map((r) => `${r.ref} ${r.item} (${r.standing})`).join('; ') || 'nothing overdue or due this week'}.`,
      `- National policy: ${by('policy').map((r) => `${r.ref} ${r.item} (${r.standing})`).join('; ') || 'nothing overdue or due this week'}.`,
      `- Reviews: ${rev.filter((r) => r.standing === 'not started').length} not started, ${rev.filter((r) => r.standing === 'overdue').length} overdue, ${rev.filter((r) => r.standing === 'open').length} open.`,
      `- Complaints open: ${cmp.filter((c) => c.kind === 'complaint' && c.stage !== 'closed').map((c) => `${c.ref} ${c.stage} (${c.working_days_open} working days)`).join(', ') || 'none'}.`,
      `- Actions overdue: ${acts.filter((a) => a.standing === 'overdue').map((a) => `${a.ref} ${a.owner}`).join(', ') || 'none'}.`,
      `- Timeframes met late or missed: ${comp.reduce((n, r) => n + r.overdue + r.met_late, 0)} across ${comp.filter((r) => r.overdue + r.met_late).length} rules.`, '',
      '## Everything on the attention list', '', '| Item | Ref | Service | Standing | Rule |', '|---|---|---|---|---|',
      ...att.map((r) => `| ${r.item} | ${r.ref} | ${r.service} | ${r.standing} | ${r.rule} |`), ''];
    const file = draftFile(`weekly-review-${today()}.md`, lines.join('\n'));
    return { draft: file, attention_items: att.length };
  },
};

// ------------------------------------------------------------------ import and export

// RiskMan reports are built by each site, so column names vary. These are the usual ones; --map=<file.json>
// names your own (for example {"summary": "Brief Description of Incident"}).
const MAPS = {
  incidents: { id: ['Incident Number', 'Incident No', 'Incident ID', 'ID', 'Reference'], occurred: ['Incident Date', 'Date of Incident', 'Date Occurred', 'Event Date'],
    occurred_time: ['Incident Time', 'Time of Incident', 'Time'], reported: ['Date Reported', 'Reported Date', 'Notification Date', 'Date Notified', 'Entered Date'],
    unit: ['Department', 'Unit', 'Ward', 'Location'], category: ['Incident Type', 'Incident Category', 'Category', 'Type', 'Classification'],
    person: ['Person Type', 'Person Involved', 'Affected Person Type'], summary: ['Brief Description', 'Description', 'Summary', 'Incident Description', 'Details'],
    harm: ['Outcome', 'Harm', 'Consequence', 'Level of Harm'], severity: ['SAC', 'ISR', 'Severity', 'Risk Rating', 'Severity Rating'], reporter: ['Reported By', 'Notifier', 'Reporter'],
    status: ['Status', 'Incident Status'] },
  feedback: { id: ['Feedback Number', 'Feedback ID', 'Complaint Number', 'ID', 'Reference'], received: ['Date Received', 'Received Date', 'Feedback Date', 'Date'],
    kind: ['Feedback Type', 'Type'], from: ['Complainant', 'Name', 'Feedback From', 'Contact Name'], about: ['Details', 'Description', 'Summary', 'Feedback Details'],
    acknowledged: ['Date Acknowledged', 'Acknowledged Date', 'Acknowledgement Date'], closed: ['Date Closed', 'Closed Date', 'Date Resolved'], outcome: ['Outcome', 'Resolution'] },
};
function mapper(kind, mapFile) {
  const base = MAPS[kind];
  if (!base) throw Error(`--kind must be one of: ${Object.keys(MAPS).join(', ')}`);
  const extra = mapFile ? JSON.parse(readFileSync(path.resolve(mapFile), 'utf8')) : {};
  return (row, field) => pick(row, ...(extra[field] ? [extra[field]] : []), ...(base[field] || []));
}
// "21/10/2026", "2026-10-21", "21/10/2026 14:30", "21-Oct-2026" -> YYYY-MM-DD (and HH:MM when present).
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function looseDate(v, label) {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return { d: date(`${m[1]}-${m[2]}-${m[3]}`, label), t: m[4] ? `${m[4].padStart(2, '0')}:${m[5]}` : null };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?)?/);
  if (m) {
    let t = null;
    if (m[4]) { let h = Number(m[4]); if (m[6]) h = (h % 12) + (/p/i.test(m[6]) ? 12 : 0); t = `${String(h).padStart(2, '0')}:${m[5]}`; }
    return { d: date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, label), t };
  }
  m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ](\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return { d: date(`${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`, label), t: null };
  throw Error(`--${label}: "${s}" is not a date`);
}
// RiskMan's incident types are each site's own list; match on words, keep the original in the summary.
function categoryOf(v) {
  const s = String(v || '').toLowerCase();
  const rules = [['fall', /fall|slip|trip/], ['medication', /medic|drug|dose|prescri|pharm/], ['pressure-injury', /pressure|skin integrity|wound/], ['surgical', /surg|theatre|procedur|retained/],
    ['infection', /infect/], ['deterioration', /deterior|clinical care|resuscit|met call/], ['behaviour', /behav|aggress|violen/], ['restraint', /restrain|seclusion/],
    ['blood', /blood|transfus/], ['identification', /identif|wrong patient/], ['documentation', /document|record|consent/], ['equipment', /equip|device|needle|sharps/],
    ['discharge', /discharge|transfer of care/], ['self-harm', /self.?harm|suicid/]];
  return (rules.find(([, re]) => re.test(s)) || ['other'])[0];
}
function harmOf(v) {
  const s = String(v || '').toLowerCase();
  if (!s) return null;
  if (/death|died/.test(s)) return 'death';
  if (/severe|major|serious|permanent/.test(s)) return 'severe';
  if (/moderate|temporary/.test(s)) return 'moderate';
  if (/near|no harm.*reach|did not reach/.test(s)) return 'near-miss';
  if (/minor|mild|minimal/.test(s)) return 'mild';
  if (/none|no harm|nil/.test(s)) return 'none';
  return null;
}

async function importRiskman(db, args, f) {
  const actor = actorOf(f);
  const [source, file] = args;
  if (source !== 'riskman') throw Error('Usage: import riskman <file.csv> --kind=incidents|feedback --service=<service>');
  if (!file || !existsSync(file)) throw Error(`File not found: ${file}`);
  need(f, 'kind', 'service');
  const kind = String(f.kind);
  const get = mapper(kind, f.map);
  const s = await service(db, f.service);
  const rows = parseCsv(readFileSync(file, 'utf8'));
  const counts = { rows: rows.length, added: 0, skipped: 0 };
  await db.exec('begin');
  try {
    for (const [n, r] of rows.entries()) {
      const at = `row ${n + 2}`;
      try {
        const id = get(r, 'id');
        if (!id) throw Error('no reference number');
        const ext = `riskman:${s.code}:${id}`;
        const table = kind === 'incidents' ? 'incidents' : 'complaints';
        if ((await db.query(`select 1 from ${table} where external_id = $1`, [ext])).length) { counts.skipped++; continue; }
        if (kind === 'incidents') {
          const occ = looseDate(get(r, 'occurred'), `incident date (${at})`);
          const time = occ.t || (get(r, 'occurred_time') ? stamp(`${occ.d} ${get(r, 'occurred_time').slice(0, 5)}`, `time (${at})`).slice(11, 16) : '00:00');
          const rep = get(r, 'reported') ? looseDate(get(r, 'reported'), `reported date (${at})`) : occ;
          const occurred = `${occ.d} ${time}:00`;
          let reported = `${rep.d} ${rep.t || time}:00`;
          if (reported < occurred) reported = occurred;
          let unitId = null;
          if (get(r, 'unit')) {
            const code = get(r, 'unit').toUpperCase().replace(/[^A-Z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 16).replace(/^-|-$/g, '') || 'UNIT';
            const [u] = await db.query(`insert into units (service_id, code, name) values ($1,$2,$3) on conflict (service_id, code) do update set name = units.name returning id`,
              [s.id, code.length < 2 ? `${code}-U` : code, get(r, 'unit')]);
            unitId = u.id;
          }
          const sevRaw = String(get(r, 'severity') || '').match(/[1-4]/);
          const status = /closed|complete|finali/i.test(get(r, 'status')) ? 'closed' : 'reported';
          const typeText = get(r, 'category');
          await db.query(`insert into incidents (service_id, unit_id, occurred_at, reported_at, reported_by, category, person_type, summary, harm, severity, rated_at, rated_by, status, closed_at, closed_by, external_id)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [s.id, unitId, occurred, reported, get(r, 'reporter') || 'RiskMan import', categoryOf(typeText),
            /staff|employee|worker/i.test(get(r, 'person')) ? 'staff' : /visitor/i.test(get(r, 'person')) ? 'visitor' : /resident/i.test(get(r, 'person')) ? 'resident' : /client|consumer/i.test(get(r, 'person')) ? 'client' : 'patient',
            `${get(r, 'summary') || '(no description in the export)'}${typeText && categoryOf(typeText) === 'other' ? ` [RiskMan type: ${typeText}]` : ''}`,
            harmOf(get(r, 'harm')), sevRaw ? Number(sevRaw[0]) : null, sevRaw ? reported : null, sevRaw ? 'RiskMan import' : null,
            status, status === 'closed' ? reported : null, status === 'closed' ? 'RiskMan import' : null, ext]);
        } else if (kind === 'feedback') {
          const rec = looseDate(get(r, 'received'), `date received (${at})`).d;
          const kindText = String(get(r, 'kind') || 'complaint').toLowerCase();
          const fk = /compliment/.test(kindText) ? 'compliment' : /suggest/.test(kindText) ? 'suggestion' : 'complaint';
          const ack = get(r, 'acknowledged') ? looseDate(get(r, 'acknowledged'), `acknowledged (${at})`).d : null;
          const closed = get(r, 'closed') ? looseDate(get(r, 'closed'), `closed (${at})`).d : null;
          await db.query(`insert into complaints (service_id, kind, received_on, from_name, about, acknowledged_on, decided_on, decision, outcome_on, outcome, last_contact_on, external_id)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [s.id, fk, rec, get(r, 'from') || '(name not in the export)', get(r, 'about') || '(no details in the export)', ack && ack >= rec ? ack : null,
            closed, closed ? 'not-justified' : null, closed, closed ? (get(r, 'outcome') || 'Closed in RiskMan; outcome not in the export') : null, closed || ack, ext]);
        } else throw Error(`--kind must be one of: ${Object.keys(MAPS).join(', ')}`);
        counts.added++;
      } catch (e) {
        throw Error(`${at}: ${e.message}. Nothing was imported.`);
      }
    }
    if (f['dry-run']) { await db.exec('rollback'); return { ...counts, dry_run: true, next: 'Run again without --dry-run to keep it' }; }
    await log(db, actor, 'import', `riskman-${kind}`, `${path.basename(file)} into ${s.code}: ${counts.added} added, ${counts.skipped} already here`);
    await db.exec('commit');
    return { ...counts, next: kind === 'incidents' ? 'Check the categories (incidents --category=other) and rate anything the export left unrated.' : 'Check closed complaints: RiskMan exports rarely say justified or not, so each is set to not-justified until you change it.' };
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}

async function exportAll(db, args, f) {
  const tables = ['settings', 'holidays', 'services', 'units', 'staff', 'incidents', 'disclosures', 'reviews', 'notifications', 'complaints', 'risks', 'actions', 'activity'];
  const out = { exported_at: new Date().toISOString(), tables: {} };
  for (const t of tables) out.tables[t] = await db.query(`select * from ${t}`);
  const file = path.resolve(f.out || path.join(process.env.OUTPUT_DIR || REPO_ROOT, 'exports', `incidents-${today()}.json`));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(out, null, 2), { mode: 0o600 });
  return { file, rows: Object.fromEntries(tables.map((t) => [t, out.tables[t].length])) };
}

const all = { ...reads, ...writes, ...drafts, import: importRiskman, export: exportAll };
export const commands = Object.keys(all).sort();

export async function run(db, command, args = [], flags = {}) {
  const fn = all[command];
  if (!fn) throw Error(`Unknown command "${command}". Commands: ${commands.join(', ')}`);
  return fn(db, args, flags);
}
