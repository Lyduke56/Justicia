#!/usr/bin/env node
/**
 * Live database access audit (Row Level Security and Storage policies).
 *
 * Creates throwaway accounts (two clients, two lawyers) and a little data, signs in as each one
 * with the PUBLIC anon key (exactly what a browser can do), and tries things that must be refused:
 * reading other people's data, changing roles or account status, writing protected records.
 * Prints PASS/FAIL per check, then deletes everything it created.
 *
 * Run: node scripts/rls-audit.js          (exit code 1 when any check fails)
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { serviceClient, loadEnv } = require('./lib/env.cjs');

loadEnv();
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = serviceClient();
const run = randomUUID().slice(0, 8);
const PASSWORD = `Audit-${randomUUID()}`;
const created = { users: [], consultations: [], documents: [], storage: [] };
const results = [];

function anonClient() {
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function makeUser(label, role) {
  const email = `rls-audit-${run}-${label}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `RLS Audit ${label}` },
    app_metadata: { role },
  });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  const id = data.user.id;
  created.users.push(id);
  await admin.from('user_accounts').upsert({ id, email, full_name: `RLS Audit ${label}`, role, verification_status: 'pending', mfa_enabled: false }, { onConflict: 'id' });
  await admin.from('user_accounts').update({ role }).eq('id', id);
  const { error: profileError } = await admin.from('profiles').upsert({ user_id: id, email, full_name: `RLS Audit ${label}`, role }, { onConflict: 'user_id' });
  if (profileError) throw new Error(`profile ${label}: ${profileError.message}`);
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw new Error(`signIn ${label}: ${signInError.message}`);
  return { id, email, client };
}

/** A query result counts as "refused" when it errors or returns no rows. */
function refusedRead(res) {
  return !!res.error || !res.data || (Array.isArray(res.data) && res.data.length === 0);
}

async function main() {
  console.log(`Run ${run}: creating throwaway accounts…`);
  const A = await makeUser('client-a', 'client');
  const B = await makeUser('client-b', 'client');
  const L1 = await makeUser('lawyer-1', 'lawyer');
  const L2 = await makeUser('lawyer-2', 'lawyer');
  for (const [L, name] of [[L1, 'One'], [L2, 'Two']]) {
    const { error } = await admin.from('lawyer_profiles').upsert({
      user_id: L.id, full_name: `Atty. Audit ${name}`, roll_number: `AUD-${run}-${name}`, verification_status: 'approved',
      is_visible: false, is_available: true, about: 'RLS audit fixture', practice_areas: ['Civil Law'],
    }, { onConflict: 'user_id' });
    if (error) throw new Error(`lawyer_profiles: ${error.message}`);
  }

  // Fixtures: a pending consultation A↔L1 far in the future, a private document of A shared with
  // L1 and then revoked, a message in the consultation, a notification for A.
  const start = new Date(Date.now() + 400 * 86400000);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 3600000);
  const { data: consult, error: cErr } = await admin.from('consultations').insert({
    client_id: A.id, lawyer_id: L1.id, scheduled_start: start.toISOString(), scheduled_end: end.toISOString(),
    scheduled_time: start.toISOString().slice(0, 10), method: 'video', status: 'pending',
    concern_summary: JSON.stringify({ subject: 'RLS audit', description: 'fixture' }),
  }).select('id').single();
  if (cErr) throw new Error(`consultation: ${cErr.message}`);
  created.consultations.push(consult.id);

  const storagePath = `${A.id}/rls-audit-${run}.txt`;
  const up = await admin.storage.from('case-documents').upload(storagePath, Buffer.from('rls audit'), { contentType: 'text/plain' });
  if (!up.error) created.storage.push(['case-documents', storagePath]);
  const { data: doc, error: dErr } = await admin.from('documents').insert({
    owner_id: A.id, filename: 'rls-audit.txt', storage_path: storagePath, mime_type: 'text/plain', size_bytes: 9, visibility_scope: 'private',
  }).select('id').single();
  if (dErr) throw new Error(`document: ${dErr.message}`);
  created.documents.push(doc.id);
  await admin.from('document_access_grants').insert({ document_id: doc.id, grantee_id: L1.id, granted_by: A.id, level: 'view', revoked_at: new Date().toISOString() });
  await admin.from('messages').insert({ conversation_or_thread_id: consult.id, sender_id: A.id, role: 'user', content: 'rls audit message', attachment_ids: [] });
  await admin.from('notifications').insert({ user_id: A.id, type: 'rls_audit', title: 'audit', body: 'audit', channel: 'in_app', is_read: false });

  const credPath = `${L1.id}/rls-audit-${run}.pdf`;
  const credUp = await admin.storage.from('lawyer-credentials').upload(credPath, Buffer.from('%PDF-1.4 audit'), { contentType: 'application/pdf' });
  if (!credUp.error) created.storage.push(['lawyer-credentials', credPath]);

  console.log('\nChecks (each one must be refused):');

  // 1–4. Other clients' data
  record('client B cannot read client A\'s consultation', refusedRead(await B.client.from('consultations').select('id').eq('id', consult.id)));
  record('client B cannot read client A\'s documents', refusedRead(await B.client.from('documents').select('id').eq('owner_id', A.id)));
  record('client B cannot read messages of A\'s consultation', refusedRead(await B.client.from('messages').select('id').eq('conversation_or_thread_id', consult.id)));
  record('client B cannot read client A\'s notifications', refusedRead(await B.client.from('notifications').select('id').eq('user_id', A.id)));
  record('client B cannot read client A\'s account row', refusedRead(await B.client.from('user_accounts').select('id, email, phone').eq('id', A.id)));
  record('client B cannot read client A\'s profile email/phone', refusedRead(await B.client.from('profiles').select('email, phone').eq('user_id', A.id)));

  // 5–6. Lawyers editing each other
  await L2.client.from('lawyer_profiles').update({ about: 'hijacked' }).eq('user_id', L1.id);
  const { data: l1After } = await admin.from('lawyer_profiles').select('about').eq('user_id', L1.id).single();
  record('lawyer 2 cannot edit lawyer 1\'s profile', l1After?.about !== 'hijacked');
  const unav = await L2.client.from('lawyer_unavailability').insert({ lawyer_id: L1.id, unavailable_date: start.toISOString().slice(0, 10), start_minutes: 0, end_minutes: 60, reason: 'audit' }).select('id');
  if (!unav.error && unav.data?.length) await admin.from('lawyer_unavailability').delete().eq('id', unav.data[0].id);
  record('lawyer 2 cannot add unavailability for lawyer 1', !!unav.error || !unav.data?.length, unav.error?.code ?? '');

  // 7. Own role / status
  await A.client.from('user_accounts').update({ role: 'admin' }).eq('id', A.id);
  await A.client.from('profiles').update({ role: 'admin', account_status: 'active' }).eq('user_id', A.id);
  const { data: aAcc } = await admin.from('user_accounts').select('role').eq('id', A.id).single();
  const { data: aProf } = await admin.from('profiles').select('role').eq('user_id', A.id).single();
  record('client cannot make themselves admin (user_accounts.role)', aAcc?.role === 'client', `role=${aAcc?.role}`);
  record('client cannot make themselves admin (profiles.role)', aProf?.role === 'client', `role=${aProf?.role}`);
  await admin.from('profiles').update({ account_status: 'suspended' }).eq('user_id', B.id);
  await B.client.from('profiles').update({ account_status: 'active' }).eq('user_id', B.id);
  const { data: bProf } = await admin.from('profiles').select('account_status').eq('user_id', B.id).single();
  record('suspended user cannot lift their own account_status', bProf?.account_status === 'suspended', `status=${bProf?.account_status}`);
  await admin.from('profiles').update({ account_status: 'active' }).eq('user_id', B.id);
  const meta = await A.client.auth.updateUser({ data: { role: 'admin' } });
  const { data: aUser } = await admin.auth.admin.getUserById(A.id);
  record('editing user_metadata.role does not change app_metadata.role', aUser?.user?.app_metadata?.role === 'client', meta.error ? 'update refused' : 'metadata edited, claim unchanged');

  // 7b. Verification and identity fields are server-controlled
  await admin.from('lawyer_profiles').update({ verification_status: 'pending', is_visible: false }).eq('user_id', L2.id);
  await L2.client.from('lawyer_profiles').update({ verification_status: 'approved' }).eq('user_id', L2.id);
  await L2.client.from('lawyer_profiles').update({ is_visible: true }).eq('user_id', L2.id);
  const { data: l2After } = await admin.from('lawyer_profiles').select('verification_status, is_visible').eq('user_id', L2.id).single();
  record('pending lawyer cannot approve themselves', l2After?.verification_status === 'pending', `status=${l2After?.verification_status}`);
  record('pending lawyer cannot list themselves in Find a Lawyer', l2After?.is_visible === false, `visible=${l2After?.is_visible}`);
  await A.client.from('user_accounts').update({ email: `taken-${run}@example.com`, verification_status: 'approved' }).eq('id', A.id);
  const { data: aAcc2 } = await admin.from('user_accounts').select('email, verification_status').eq('id', A.id).single();
  record('user cannot change their own account email or verification directly', aAcc2?.email === A.email && aAcc2?.verification_status === 'pending', `email changed=${aAcc2?.email !== A.email}, verification=${aAcc2?.verification_status}`);
  await A.client.from('profiles').update({ email: `taken-${run}@example.com` }).eq('user_id', A.id);
  const { data: aProf2 } = await admin.from('profiles').select('email').eq('user_id', A.id).single();
  record('user cannot change their own profile email directly', aProf2?.email === A.email);

  // 8. Admin-only operations
  const mod = await A.client.from('moderation_actions').insert({ report_id: randomUUID(), admin_id: A.id, action: 'no_action', rationale: 'audit' }).select('id');
  record('client cannot record moderation actions', !!mod.error || !mod.data?.length, mod.error?.code ?? '');
  await A.client.from('profiles').update({ account_status: 'suspended' }).eq('user_id', B.id);
  const { data: bProf2 } = await admin.from('profiles').select('account_status').eq('user_id', B.id).single();
  record('client cannot suspend another account', bProf2?.account_status === 'active', `status=${bProf2?.account_status}`);
  const audit = await A.client.from('audit_log').insert({ actor_id: A.id, action: 'audit.fake', target_type: 'x', target_id: 'x' }).select('id');
  if (!audit.error && audit.data?.length) await admin.from('audit_log').delete().eq('id', audit.data[0].id);
  record('client cannot write the audit log', !!audit.error || !audit.data?.length, audit.error?.code ?? '');
  const auditRead = await A.client.from('audit_log').select('id').limit(1);
  record('client cannot read the audit log', refusedRead(auditRead));

  // 9. Consultation participants only
  record('lawyer 2 cannot read a consultation they are not part of', refusedRead(await L2.client.from('consultations').select('id').eq('id', consult.id)));

  // 10. Consultation status and payments are server-controlled
  await A.client.from('consultations').update({ status: 'confirmed' }).eq('id', consult.id);
  const { data: cAfter } = await admin.from('consultations').select('status').eq('id', consult.id).single();
  record('client cannot confirm their own consultation directly', cAfter?.status === 'pending', `status=${cAfter?.status}`);
  const pay = await A.client.from('payments').insert({ consultation_id: consult.id, payer_id: A.id, payee_id: L1.id, amount: 1, status: 'paid' }).select('id');
  if (!pay.error && pay.data?.length) await admin.from('payments').delete().eq('id', pay.data[0].id);
  record('client cannot record a payment as paid', !!pay.error || !pay.data?.length, pay.error?.code ?? '');

  // 11. Reviews only for completed consultations
  const review = await A.client.from('reviews').insert({ consultation_id: consult.id, client_id: A.id, lawyer_id: L1.id, rating: 5, comment: 'audit' }).select('id');
  if (!review.error && review.data?.length) await admin.from('reviews').delete().eq('id', review.data[0].id);
  record('client cannot review a consultation that is not completed', !!review.error || !review.data?.length, review.error?.code ?? '');

  // 12. Revoked document grants
  record('lawyer cannot read a document after its grant is revoked', refusedRead(await L1.client.from('documents').select('id').eq('id', doc.id)));

  // 13. Notifications can't be planted for others
  const notif = await A.client.from('notifications').insert({ user_id: B.id, type: 'spam', title: 'x', body: 'x', channel: 'in_app', is_read: false }).select('id');
  if (!notif.error && notif.data?.length) await admin.from('notifications').delete().eq('id', notif.data[0].id);
  record('client cannot create notifications for another user', !!notif.error || !notif.data?.length, notif.error?.code ?? '');

  // 14. Storage
  const dl = await B.client.storage.from('case-documents').download(storagePath);
  record('client B cannot download client A\'s file', !!dl.error || !dl.data);
  const list = await B.client.storage.from('case-documents').list(A.id);
  record('client B cannot list client A\'s folder', !!list.error || !list.data?.length);
  const cred = await L2.client.storage.from('lawyer-credentials').download(credPath);
  record('lawyer 2 cannot download lawyer 1\'s credential file', !!cred.error || !cred.data);
  const credA = await A.client.storage.from('lawyer-credentials').list(L1.id);
  record('client cannot list a lawyer\'s credential folder', !!credA.error || !credA.data?.length);

  // 15. Signed-out visitors
  const anon = anonClient();
  const anonWrites = await Promise.all([
    anon.from('consultations').insert({ client_id: A.id, lawyer_id: L1.id, method: 'video', status: 'pending' }).select('id'),
    anon.from('reviews').insert({ consultation_id: consult.id, client_id: A.id, lawyer_id: L1.id, rating: 1 }).select('id'),
    anon.from('notifications').insert({ user_id: A.id, type: 'spam', title: 'x', body: 'x' }).select('id'),
    anon.from('reports').insert({ reporter_id: A.id, target_type: 'user', target_id: B.id, category: 'spam', reason: 'x' }).select('id'),
  ]);
  record('signed-out visitors cannot write protected records', anonWrites.every((r) => !!r.error || !r.data?.length));
  record('signed-out visitors cannot read account emails', refusedRead(await anon.from('user_accounts').select('email').limit(1)) && refusedRead(await anon.from('profiles').select('email').limit(1)));
  record('signed-out visitors cannot read consultations', refusedRead(await anon.from('consultations').select('id').limit(1)));
}

async function cleanup() {
  for (const [bucket, path] of created.storage) await admin.storage.from(bucket).remove([path]).catch(() => undefined);
  for (const id of created.documents) {
    await admin.from('document_access_grants').delete().eq('document_id', id);
    await admin.from('documents').delete().eq('id', id);
  }
  for (const id of created.consultations) {
    await admin.from('messages').delete().eq('conversation_or_thread_id', id);
    await admin.from('payments').delete().eq('consultation_id', id);
    await admin.from('reviews').delete().eq('consultation_id', id);
    await admin.from('consultations').delete().eq('id', id);
  }
  for (const id of created.users) {
    for (const [table, column] of [
      ['notifications', 'user_id'], ['lawyer_unavailability', 'lawyer_id'], ['lawyer_profiles', 'user_id'], ['consent_records', 'user_id'],
      ['audit_log', 'actor_id'], ['audit_log', 'target_id'], ['profiles', 'user_id'],
    ]) await admin.from(table).delete().eq(column, id);
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
    // Deleting the auth user does not remove its user_accounts row.
    await admin.from('user_accounts').delete().eq('id', id);
  }
}

main()
  .catch((err) => {
    console.error(`\nAudit could not finish: ${err.message || err}`);
    results.push({ name: 'setup', pass: false });
  })
  .finally(async () => {
    await cleanup();
    const failed = results.filter((r) => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
    process.exit(failed.length ? 1 : 0);
  });
