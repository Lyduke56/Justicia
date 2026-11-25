#!/usr/bin/env node
/**
 * One-time: copies each account's role (public.user_accounts.role) and deletion status into
 * Supabase Auth app_metadata, which only the server can write. The proxy reads the role from
 * there instead of user_metadata (which users can edit). Safe to run again.
 *
 * Run: node scripts/backfill-role-claims.js
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { serviceClient, listAllAuthUsers } = require('./lib/env.cjs');

const ROLES = ['client', 'lawyer', 'admin'];

(async () => {
  const db = serviceClient();
  const users = await listAllAuthUsers(db);
  const { data: accounts, error } = await db.from('user_accounts').select('id, role');
  if (error) throw new Error(error.message);
  const { data: profiles } = await db.from('profiles').select('user_id, role, account_status');
  const roleOf = new Map(accounts.map((a) => [a.id, a.role]));
  const profileOf = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  let updated = 0;
  let unchanged = 0;
  for (const user of users) {
    const role = ROLES.includes(roleOf.get(user.id)) ? roleOf.get(user.id) : ROLES.includes(profileOf.get(user.id)?.role) ? profileOf.get(user.id).role : 'client';
    const pending = profileOf.get(user.id)?.account_status === 'pending_deletion';
    const current = user.app_metadata ?? {};
    const status = pending ? 'pending_deletion' : 'active';
    if (current.role === role && (current.account_status ?? 'active') === status) {
      unchanged++;
      continue;
    }
    const { error: updateError } = await db.auth.admin.updateUserById(user.id, {
      app_metadata: { ...current, role, account_status: status },
    });
    if (updateError) {
      console.warn(`Could not update ${user.id}: ${updateError.message}`);
      continue;
    }
    updated++;
  }
  console.log(`Role claims: ${updated} updated, ${unchanged} already correct, ${users.length} users in total.`);
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
