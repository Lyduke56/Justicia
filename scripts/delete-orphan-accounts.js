#!/usr/bin/env node
/**
 * Lists (and with --confirm deletes) account rows that have no Supabase Auth user behind them:
 * public.user_accounts rows whose auth user was deleted, plus their lawyer_profiles and profiles
 * rows. Such accounts can never sign in.
 *
 * Run:    node scripts/delete-orphan-accounts.js            (dry run: prints what would go)
 *         node scripts/delete-orphan-accounts.js --confirm  (deletes)
 *
 * Rows that are still referenced by consultations, reviews, messages or payments are skipped.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { serviceClient, listAllAuthUsers } = require('./lib/env.cjs');

const confirm = process.argv.includes('--confirm');

async function count(db, table, column, id) {
  const { count: n, error } = await db.from(table).select(column, { count: 'exact', head: true }).eq(column, id);
  if (error) return 0;
  return n ?? 0;
}

(async () => {
  const db = serviceClient();
  const authIds = new Set((await listAllAuthUsers(db)).map((u) => u.id));
  const { data: accounts, error } = await db.from('user_accounts').select('id, email, role, full_name');
  if (error) throw new Error(error.message);
  const orphans = accounts.filter((a) => !authIds.has(a.id));
  if (orphans.length === 0) {
    console.log('No orphaned accounts.');
    return;
  }

  for (const o of orphans) {
    const blockers = [];
    for (const [table, column] of [
      ['consultations', 'client_id'], ['consultations', 'lawyer_id'], ['reviews', 'lawyer_id'], ['reviews', 'client_id'],
      ['messages', 'sender_id'], ['payments', 'payer_id'], ['payments', 'payee_id'],
    ]) {
      const n = await count(db, table, column, o.id);
      if (n) blockers.push(`${table}.${column}=${n}`);
    }
    const label = `${o.role} ${o.full_name || ''} <${o.email}>`;
    if (blockers.length) {
      console.log(`SKIP   ${label} (still referenced: ${blockers.join(', ')})`);
      continue;
    }
    if (!confirm) {
      console.log(`WOULD DELETE ${label}`);
      continue;
    }
    for (const [table, column] of [
      ['lawyer_education', 'lawyer_id'], ['lawyer_experience', 'lawyer_id'], ['lawyer_services', 'lawyer_id'],
      ['lawyer_case_summaries', 'lawyer_id'], ['lawyer_practice_areas_detail', 'lawyer_id'], ['lawyer_unavailability', 'lawyer_id'],
      ['lawyer_favorites', 'lawyer_id'], ['lawyer_verification_documents', 'lawyer_id'], ['lawyer_profiles', 'user_id'],
      ['notifications', 'user_id'], ['profiles', 'user_id'], ['user_accounts', 'id'],
    ]) {
      const { error: delError } = await db.from(table).delete().eq(column, o.id);
      if (delError && !/does not exist|could not find/i.test(delError.message)) {
        console.warn(`  ${table}: ${delError.message}`);
      }
    }
    console.log(`DELETED ${label}`);
  }
  if (!confirm) console.log('\nDry run only. Re-run with --confirm to delete the rows marked WOULD DELETE.');
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
