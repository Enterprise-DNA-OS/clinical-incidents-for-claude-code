#!/usr/bin/env node
// Loads the fictional health group in supabase/seed.sql. Safe to run twice.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';

export async function seed(db) {
  await db.exec('begin');
  try {
    await db.exec(readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8'));
    await db.exec('commit');
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const db = await getDb();
  try {
    await migrate(db);
    await seed(db);
    console.log('seed: Tidewater Health demo loaded');
  } finally {
    await db.close();
  }
}
