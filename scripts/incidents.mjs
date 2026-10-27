#!/usr/bin/env node
// The one CLI for the clinical incident desk. Human tables by default, --json for machines.
//   node scripts/incidents.mjs --help
import { getDb } from './lib/db.mjs';
import { run, commands } from './lib/domain.mjs';
import { table, price as money } from './lib/format.mjs';

const args = [];
const flags = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) { args.push(a); continue; }
  const i = a.indexOf('=');
  const key = a.slice(2, i < 0 ? undefined : i);
  if (Object.hasOwn(flags, key)) { console.error(`Duplicate --${key}`); process.exit(1); }
  flags[key] = i < 0 ? true : a.slice(i + 1);
}
const command = args.shift();

const ALLOWED = ['json', 'help', 'actor', 'days', 'service', 'status', 'all', 'category', 'code', 'name', 'kind', 'region', 'beds', 'role', 'email',
  'date', 'at', 'summary', 'by', 'unit', 'person', 'person-ref', 'action', 'harm', 'reported', 'severity', 'sentinel', 'arr', 'psychological', 'manager',
  'step', 'lead', 'note', 'method', 'due', 'findings', 'description', 'owner', 'evidence', 'to', 'reference', 'override', 'from', 'via', 'contact', 'about',
  'incident', 'handler', 'decision', 'told', 'told-more-time', 'outcome', 'title', 'likelihood', 'consequence', 'controls', 'every', 'reason', 'map', 'dry-run', 'out'];

// *_cents columns print as money in the row's currency; everything else as written.
function cell(v, key, row) {
  if (v === null || v === undefined) return '';
  if (key.endsWith('_cents')) return money(v, row.currency || 'NZD');
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (v instanceof Date) return v.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s) ? s.slice(0, 16) : s;
}
function human(value) {
  if (Array.isArray(value)) {
    if (!value.length) return '  (none)';
    if (value[0]?.question) return value.map((x, i) => `${i + 1}. ${x.question}\n${human(x.rows)}`).join('\n\n');
    const keys = Object.keys(value[0]).filter((k) => k !== 'currency' || !Object.keys(value[0]).some((x) => x.endsWith('_cents')));
    return table(value, keys.map((key) => ({ key, label: key.replace(/_cents$/, ''), align: key.endsWith('_cents') ? 'right' : 'left', width: 70, format: (v, row) => cell(v, key, row) })));
  }
  if (value && typeof value === 'object' && Object.values(value).some(Array.isArray)) {
    return Object.entries(value).map(([k, v]) => Array.isArray(v) ? `\n${k[0].toUpperCase()}${k.slice(1)}\n${human(v)}` : v && typeof v === 'object'
      ? Object.entries(v).filter(([kk, x]) => x !== null && x !== '' && !/(^id$|_id$|created_at|updated_at|external_id)/.test(kk)).map(([kk, x]) => `  ${kk}: ${cell(x, kk, v)}`).join('\n')
      : `  ${k}: ${cell(v, k, value)}`).join('\n');
  }
  return Object.entries(value || {}).map(([k, v]) => `  ${k}: ${cell(v, k, value)}`).join('\n');
}

if (!command || flags.help) {
  console.log(`Clinical incident desk. Commands: ${commands.join(', ')}.
Options use --key=value. Every write needs --actor="<your name>". Times are the service's own clock: --at="2026-10-21 14:30". See docs/cli.md.`);
} else {
  let db;
  try {
    for (const key of Object.keys(flags)) if (!ALLOWED.includes(key)) throw Error(`Unknown option --${key}`);
    db = await getDb();
    const result = await run(db, command, args, flags);
    console.log(flags.json ? JSON.stringify(result, null, 2) : human(result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await db?.close();
  }
}
