#!/usr/bin/env node
// npm test: a temporary database, the demo health group, every command exercised, then cleaned up.
// Set TEST_DATABASE_URL to run the same checks against an empty Postgres database instead of PGlite.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { run, reads, commands, QUESTIONS, stamp, date, looseDate } from './lib/domain.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'incidents-test-'));
process.env.DATA_DIR = path.join(root, 'db');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
process.env.OUTPUT_DIR = path.join(root, 'out');

let db;
let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); checks++; };
const fails = async (fn, re, msg) => { await assert.rejects(fn, re, msg); checks++; };
const call = (cmd, args = [], f = {}) => run(db, cmd, args, f);
const A = { actor: 'Test' };
const one = async (sql, p = []) => (await db.query(sql, p))[0];
const standing = async (ref, obligation) => (await one(`select standing from v_obligation_status where ref = $1 and obligation = $2`, [ref, obligation]))?.standing;

try {
  db = await getDb();
  await migrate(db);
  eq((await migrate(db)).ran.length, 0, 'migrate twice is a no-op');
  await seed(db);
  const once = (await one('select count(*)::int as n from incidents')).n;
  await seed(db);
  eq((await one('select count(*)::int as n from incidents')).n, once, 'seed is idempotent (incidents)');
  eq((await one('select count(*)::int as n from complaints')).n, 8, 'seed is idempotent (feedback)');
  eq((await one('select count(*)::int as n from activity')).n, 1, 'seed activity written once');
  eq(once, 45, 'nine handwritten incidents and 36 everyday ones');

  // The working-day clock.
  eq((await one(`select add_working_days('2026-12-22', 5, 'NZ')::text as d`)).d, '2027-01-07', 'NZ skips 25 December to 2 January and the observed 4 January');
  eq((await one(`select add_working_days('2026-10-23', 1, 'NZ')::text as d`)).d, '2026-10-27', 'NZ skips the weekend and Labour Day');
  eq((await one(`select add_working_days('2026-10-30', 2, 'VIC')::text as d`)).d, '2026-11-04', 'VIC skips Melbourne Cup');
  eq((await one(`select add_working_days('2026-10-30', 2, 'QLD')::text as d`)).d, '2026-11-03', 'QLD works Melbourne Cup day');
  eq((await one(`select add_working_days('2026-12-24', 1, 'NSW')::text as d`)).d, '2026-12-29', 'national holidays apply to every state');
  eq((await one(`select working_days_between('2026-10-23', '2026-10-30', 'NZ') as n`)).n, 4, 'working days between');

  // Every read runs.
  for (const cmd of Object.keys(reads)) {
    const a = { incident: ['INC-1003'], complaint: ['FB-303'], risk: ['RSK-21'] }[cmd] || [];
    ok(await call(cmd, a, {}), `read ${cmd}`);
  }
  eq(QUESTIONS.length, 10, 'ten questions');
  const ins = await call('insights');
  ok(ins.every((q) => Array.isArray(q.rows)), 'every question returns rows');
  ok(ins.filter((q) => q.rows.length).length >= 9, `the demo answers at least nine of the ten (${ins.filter((q) => q.rows.length).length})`);

  // The demo says what it should.
  const att = await call('attention');
  for (const [ref, item] of [['FB-301', 'Complaint acknowledged in writing'], ['FB-302', 'Decision made (justified, not justified, or more time)'],
    ['FB-303', 'Progress update (at least monthly while open)'], ['INC-1004', 'Duty of candour: apology given'], ['INC-1002', 'HQSC Part A brief sent'],
    ['INC-1006', 'Severity rated'], ['INC-1003', 'Sentinel event'], ['INC-1005', 'Open disclosure started']]) {
    ok(att.some((r) => r.ref === ref && r.item === item), `attention: ${ref} ${item}`);
  }
  eq(att[0].kind, 'law', 'the law comes first');
  ok(!att.some((r) => r.ref === 'INC-1009'), 'a closed, complete incident says nothing');
  eq(await standing('INC-1009', 'HQSC Part A brief sent'), 'met');
  eq(await standing('FB-303', 'Consumer told more than 20 working days are needed, with reasons'), 'met');
  const comp = await call('compliance');
  ok(comp.every((r) => r.kind === 'law' || r.kind === 'policy'), 'compliance is the law and policy only');
  ok(comp.find((r) => r.obligation === 'Duty of candour: apology given').overdue === 1);
  eq((await one(`select sdc_applies from v_incidents where ref = 'INC-1005'`)).sdc_applies, false, 'the duty of candour is Victorian');
  eq((await one(`select hqsc_applies from v_incidents where ref = 'INC-1003'`)).hqsc_applies, false, 'HQSC is New Zealand');

  // Parsing is strict.
  eq(stamp('2026-10-21 9:05', 'x'), '2026-10-21 09:05:00');
  assert.throws(() => stamp('2026-10-21', 'x'), /date and time/); checks++;
  assert.throws(() => date('2026-02-30', 'x'), /date/); checks++;
  eq(looseDate('05/09/2026', 'x').d, '2026-09-05', 'day first');
  eq(looseDate('21-Oct-2026', 'x').d, '2026-10-21');
  eq(looseDate('19/09/2026 10:15 PM', 'x').t, '22:15');

  // An incident from report to close.
  await fails(() => call('report', [], { ...A, service: 'TW-AKL', category: 'fall', summary: 'x' }), /--at is required/);
  await fails(() => call('report', [], { ...A, service: 'TW-AKL', category: 'slip', summary: 'x', at: '2026-10-20 10:00' }), /category/);
  await fails(() => call('report', [], { ...A, service: 'TW-AKL', category: 'fall', summary: 'x', at: '2026-10-20 10:00', reported: '2026-10-19 10:00' }), /before/);
  await fails(() => call('report', [], { ...A, service: 'TW-AKL', category: 'fall', summary: 'x', at: '2026-10-20 10:00', unit: 'NOPE' }), /not found/);
  const melNow = (await one(`select region_now('VIC')::date - 1 as d`)).d;
  const day = (typeof melNow === 'string' ? melNow : melNow.toISOString()).slice(0, 10);
  const rep = await call('report', [], { ...A, service: 'TW-MEL', unit: 'RECOVERY', category: 'medication', person: 'patient', 'person-ref': 'UR 1', summary: 'Wrong antiemetic given in recovery.', at: `${day} 10:00` });
  ok(/^INC-\d+$/.test(rep.reported), 'report gives a reference');
  const ref = rep.reported;
  eq(await standing(ref, 'Severity rated'), 'due soon', 'a new report owes a rating');
  await fails(() => call('rate', [ref], { ...A, severity: '5', harm: 'mild' }), /severity/);
  await fails(() => call('rate', [ref], { ...A, severity: '1', harm: 'mild', sentinel: '7' }), /serious harm/);
  const rated = await call('rate', [ref], { ...A, severity: '2', harm: 'moderate', manager: 'Sophie' });
  ok(rated.now_owed.some((o) => o.obligation === 'Duty of candour: apology given'), 'a Victorian ISR 2 owes the duty of candour');
  eq(await standing(ref, 'Severity rated'), 'met');
  await call('disclose', [ref], { ...A, step: 'apology', lead: 'LCH', note: 'Apologised at the bedside.' });
  await fails(() => call('disclose', [ref], { ...A, step: 'hug' }), /--step/);
  eq(await standing(ref, 'Duty of candour: apology given'), 'met');
  await call('disclose', [ref], { ...A, step: 'arranged' });
  await call('disclose', [ref], { ...A, step: 'meeting' });
  await call('disclose', [ref], { ...A, step: 'notes' });
  await call('start-review', [ref], { ...A, method: 'case-review', lead: 'LCH' });
  eq((await one('select status from incidents where ref = $1', [ref])).status, 'under-review');
  await fails(() => call('start-review', [ref], { ...A, method: 'rca', lead: 'LCH' }), /duplicate|unique/);
  const act = await call('add-action', [ref], { ...A, description: 'Separate look-alike antiemetics in the recovery cupboard', owner: 'SWI', due: '2027-01-15' });
  await fails(() => call('close', [ref], A), /cannot close/, 'close refuses with gaps');
  await call('finish-review', [ref], { ...A, findings: 'Look-alike packs stored side by side.' });
  await fails(() => call('finish-review', [ref], { ...A, findings: 'again' }), /no open review/);
  await fails(() => call('action-done', [act.action], A), /--evidence/);
  await call('action-done', [act.action], { ...A, evidence: 'Photo of the new shelf labels.' });
  await fails(() => call('action-done', [act.action], { ...A, evidence: 'again' }), /was done/);
  await call('disclose', [ref], { ...A, step: 'report' });
  const closed = await call('close', [ref], { ...A, note: 'All steps done.' });
  eq(closed.gaps.length, 0, 'closes clean');
  await fails(() => call('close', [ref], A), /already closed/);
  await call('close', ['INC-1006'], { ...A, override: 'Near miss logged for trend only' }).then(() => { throw Error('should refuse: not rated'); }, (e) => ok(/not rated/.test(e.message)));
  await call('rate', ['INC-1006'], { ...A, severity: '4', harm: 'near-miss', manager: 'MOS' });
  ok((await call('close', ['INC-1006'], { ...A, override: 'Near miss logged for trend only' })).closed, 'override closes with the reason');
  await call('assign', ['INC-1007'], { ...A, manager: 'Tom' });
  eq((await one(`select manager from v_incidents where ref = 'INC-1007'`)).manager, 'Tom Bradley');

  // HQSC.
  await fails(() => call('draft-part-a', ['INC-1003']), /not a New Zealand/);
  const pa = await call('draft-part-a', ['INC-1002']);
  ok(existsSync(path.join(process.env.OUTPUT_DIR, pa.draft)), 'Part A draft written');
  ok(!readFileSync(path.join(process.env.OUTPUT_DIR, pa.draft), 'utf8').includes('ZZM1093'), 'Part A draft carries no NHI');
  await call('notify', ['INC-1002'], { ...A, to: 'hqsc-part-a', reference: 'HQSC A-2026-0999' });
  eq(await standing('INC-1002', 'HQSC Part A brief sent'), 'met late');
  await fails(() => call('notify', ['INC-1002'], { ...A, to: 'hqsc-part-a' }), /duplicate|unique/);
  await fails(() => call('notify', ['INC-1002'], { ...A, to: 'the-press' }), /--to/);

  // HDC Right 10.
  const fb = await call('log-feedback', [], { ...A, service: 'TW-AKL', from: 'Test Person', about: 'Noise at night.', via: 'phone', category: 'environment' });
  ok(fb.now_owed.some((o) => o.rule === 'HDC Code of Rights, Right 10(6)(a)'), 'a New Zealand complaint owes a written acknowledgement');
  await fails(() => call('decide', [fb.logged], { ...A, decision: 'justified' }), /not been acknowledged/);
  const ack = await call('draft-acknowledgement', [fb.logged]);
  ok(readFileSync(path.join(process.env.OUTPUT_DIR, ack.draft), 'utf8').includes('0800 555 050'), 'acknowledgement names the advocacy service');
  await call('acknowledge', [fb.logged], A);
  await fails(() => call('acknowledge', [fb.logged], A), /was acknowledged/);
  const dec = await call('decide', [fb.logged], { ...A, decision: 'more-time', days: '25' });
  ok(dec.warning, 'more than 20 working days warns');
  ok((await call('obligations', [fb.logged], {})).some((o) => o.obligation.startsWith('Consumer told')), 'the more-time notice is owed');
  await call('contact', [fb.logged], { ...A, note: 'Phoned with reasons for the extra time.', 'told-more-time': true });
  eq(await standing(fb.logged, 'Consumer told more than 20 working days are needed, with reasons'), 'met');
  await call('resolve', [fb.logged], { ...A, outcome: 'Night noise checks added.', decision: 'justified' });
  await fails(() => call('resolve', [fb.logged], { ...A, outcome: 'again' }), /was resolved/);
  await fails(() => call('resolve', ['FB-306'], { ...A, outcome: 'x' }), /no decision/);
  const comp2 = await call('log-feedback', [], { ...A, kind: 'compliment', service: 'TW-BNE', from: 'A Client', about: 'Lovely nurse.', category: 'staff' });
  eq(comp2.now_owed.length, 0, 'a compliment owes nothing');
  await call('add-action', ['FB-302'], { ...A, description: 'Bed alarm on for every falls-risk patient', owner: 'PKA', due: '2027-01-01' });

  // Candour report and committee pack.
  const cr = await call('draft-candour-report', ['INC-1003']);
  ok(readFileSync(path.join(process.env.OUTPUT_DIR, cr.draft), 'utf8').includes('Part 5A'), 'candour report cites the Act');
  ok((await call('draft-committee-report', [], {})).draft, 'committee report');
  ok((await call('weekly-review')).attention_items > 5, 'weekly review');

  // Risks.
  const rk = await call('add-risk', [], { ...A, service: 'TW-MEL', title: 'Look-alike antiemetics in recovery', likelihood: '3', consequence: '3', owner: 'SWI' });
  await fails(() => call('add-risk', [], { ...A, title: 'x', likelihood: '6', consequence: '1', owner: 'SWI' }), /likelihood/);
  eq((await call('review-risk', [rk.risk], { ...A, likelihood: '2' })).score, 6);
  eq(await standing('RSK-22', 'Risk reviewed: Opioid dosing errors after verbal handover'), 'overdue');
  await call('review-risk', ['RSK-22'], { ...A, note: 'Controls checked' });
  eq(await standing('RSK-22', 'Risk reviewed: Opioid dosing errors after verbal handover'), 'open', 'reviewing moves the next review out');
  await call('close-risk', [rk.risk], { ...A, reason: 'Cupboard redesigned' });
  eq((await one('select status from risks where ref = $1', [rk.risk])).status, 'closed');

  // Setup, settings and notes.
  await call('add-service', [], { ...A, code: 'TW-HAM', name: 'Tidewater Hamilton', kind: 'day-surgery', region: 'nz' });
  await fails(() => call('add-service', [], { ...A, code: 'TW-X', name: 'x', region: 'UK' }), /region/);
  await call('add-unit', [], { ...A, service: 'TW-HAM', code: 'DSU', name: 'Day surgery unit' });
  await call('add-staff', [], { ...A, code: 'NEW', name: 'New Starter', role: 'Nurse' });
  await call('add-holiday', [], { ...A, date: '2027-03-22', region: 'NZ', name: 'Wellington Anniversary' });
  await fails(() => call('set', ['hdc_ack_wd', 'five'], A), /whole numbers/);
  await fails(() => call('set', ['nope', '1'], A), /Unknown setting/);
  eq((await call('set', ['au_complaint_ack_wd', '3'], A)).was, '2');
  await call('log', ['RSK-21'], { ...A, note: 'Discussed at the committee.' });
  await fails(() => call('log', ['XYZ'], { ...A, note: 'x' }), /Name an incident/);
  await fails(() => call('report', [], { service: 'TW-AKL' }), /--actor/, 'every write needs an actor');
  await fails(() => call('incident', ['INC-11']), /ambiguous/, 'ambiguous refs list and stop');
  await fails(() => call('nope'), /Unknown command/);

  // The database holds the line.
  await fails(() => db.query(`update activity set actor = 'x'`), /append-only/, 'the activity log is append-only');
  await fails(() => db.query(`update incidents set severity = null where ref = 'INC-1008'`), /check/, 'a rating has a time');
  await fails(() => db.query(`update incidents set status = 'closed' where ref = 'INC-1008'`), /check/, 'closed needs a closing time');
  await fails(() => db.query(`update actions set done_on = current_date where ref = 'ACT-505'`), /check/, 'done needs evidence');
  await fails(() => db.query(`update complaints set decision = 'more-time', decided_on = current_date, more_time_days = null where ref = 'FB-306'`), /check/, 'more time says how much');

  // Import and export.
  const ex = path.join(REPO_ROOT, 'examples', 'riskman');
  const dry = await call('import', ['riskman', path.join(ex, 'incident-register.csv')], { ...A, kind: 'incidents', service: 'TW-HAM', 'dry-run': true });
  eq(dry.added, 4); ok(dry.dry_run);
  eq((await one(`select count(*)::int as n from incidents where external_id like 'riskman:%'`)).n, 0, 'dry run keeps nothing');
  eq((await call('import', ['riskman', path.join(ex, 'incident-register.csv')], { ...A, kind: 'incidents', service: 'TW-HAM' })).added, 4);
  eq((await call('import', ['riskman', path.join(ex, 'incident-register.csv')], { ...A, kind: 'incidents', service: 'TW-HAM' })).skipped, 4, 'import twice skips');
  const imp = await one(`select category, harm, severity, status, reported_at::text as r from incidents where external_id = 'riskman:TW-HAM:48230'`);
  eq(imp.category, 'deterioration'); eq(imp.harm, 'moderate'); eq(imp.severity, 2); eq(imp.status, 'reported');
  ok(imp.r.startsWith('2026-09-21'), 'reported date kept');
  eq((await one(`select category from incidents where external_id = 'riskman:TW-HAM:48244'`)).category, 'other', 'unknown types go to other');
  ok((await one(`select summary from incidents where external_id = 'riskman:TW-HAM:48244'`)).summary.includes('[RiskMan type: Hazard]'), 'the original type is kept');
  eq((await call('import', ['riskman', path.join(ex, 'feedback-register.csv')], { ...A, kind: 'feedback', service: 'TW-HAM' })).added, 3);
  eq((await one(`select kind from complaints where external_id = 'riskman:TW-HAM:F-9002'`)).kind, 'compliment');
  const bad = path.join(root, 'bad.csv');
  writeFileSync(bad, 'Incident Number,Incident Date\n1,not a date\n');
  await fails(() => call('import', ['riskman', bad], { ...A, kind: 'incidents', service: 'TW-HAM' }), /row 2.*Nothing was imported/);
  const mapped = path.join(root, 'mapped.csv');
  writeFileSync(mapped, 'Ref,When,What\n77,2026-10-01,Bed rail left down\n');
  writeFileSync(path.join(root, 'map.json'), JSON.stringify({ id: 'Ref', occurred: 'When', summary: 'What' }));
  eq((await call('import', ['riskman', mapped], { ...A, kind: 'incidents', service: 'TW-HAM', map: path.join(root, 'map.json') })).added, 1, '--map names your own columns');
  const exp = await call('export', [], {});
  ok(existsSync(exp.file) && exp.rows.incidents > 45, 'export writes every table');
  ok(commands.length >= 45, `${commands.length} commands`);

  // Every CLI command has a slash command, and every slash command runs a real CLI command.
  const cmdDir = path.join(REPO_ROOT, '.claude', 'commands');
  const slash = readdirSync(cmdDir).filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => f.replace(/\.md$/, ''));
  for (const c of commands) ok(slash.includes(c), `slash command for ${c}`);
  for (const s of slash) {
    const body = readFileSync(path.join(cmdDir, `${s}.md`), 'utf8');
    ok(/^---\ndescription: /.test(body), `${s} has a description`);
    const m = body.match(/node scripts\/incidents\.mjs ([a-z-]+)/);
    if (m) ok(commands.includes(m[1]), `${s} runs ${m[1]}`);
  }

  // Views and documents render, escaped.
  await db.query(`update services set name = '<b>Tidewater</b> & Co' where code = 'TW-AKL'`);
  await db.close(); db = null;
  for (const [script, args] of [['view.mjs', []], ['docs.mjs', []]]) {
    const r = spawnSync(process.execPath, [path.join('scripts', script), ...args], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
    eq(r.status, 0, `${script}: ${r.stderr}`);
  }
  const viewsDir = path.join(process.env.OUTPUT_DIR, 'views');
  eq(readdirSync(viewsDir).filter((f) => f.endsWith('.html')).length, 4, 'four views rendered');
  const docDir = path.join(process.env.OUTPUT_DIR, 'docs-out');
  const allDocs = readdirSync(docDir, { recursive: true }).filter((f) => String(f).endsWith('.html'));
  ok(allDocs.length >= 10, `documents rendered (${allDocs.length})`);
  for (const d of ['incident-report', 'complaint-acknowledgement', 'candour-meeting-record', 'risk-register', 'governance-summary']) ok(existsSync(path.join(docDir, d)), `document ${d}`);
  const html = allDocs.map((f) => readFileSync(path.join(docDir, String(f)), 'utf8')).join('');
  ok(html.includes('&lt;b&gt;Tidewater&lt;/b&gt; &amp; Co') && !html.includes('<b>Tidewater</b>'), 'HTML is escaped');

  // The CLI shell.
  const cli = spawnSync(process.execPath, ['scripts/incidents.mjs', 'attention', '--json'], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  eq(cli.status, 0, cli.stderr);
  ok(Array.isArray(JSON.parse(cli.stdout)));
  const badFlag = spawnSync(process.execPath, ['scripts/incidents.mjs', 'attention', '--nope'], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  eq(badFlag.status, 1); ok(/Unknown option --nope/.test(badFlag.stderr));
  const amb = spawnSync(process.execPath, ['scripts/incidents.mjs', 'incident', 'INC-11'], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  eq(amb.status, 1); ok(/ambiguous/.test(amb.stderr), 'ambiguous refs list and stop');
  const help = spawnSync(process.execPath, ['scripts/incidents.mjs', '--help'], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  ok(help.stdout.includes('attention'), 'help lists the commands');

  console.log(`PASS: ${checks} checks, ${commands.length} commands`);
} finally {
  await db?.close();
  rmSync(root, { recursive: true, force: true });
}
