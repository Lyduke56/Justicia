#!/usr/bin/env node
/**
 * Lawyers approved before verification documents were required: sends each one an in-app
 * notification asking them to upload the missing required documents within 30 days (they stay
 * approved meanwhile). Run after supabase/manual/004_lawyer_verification_documents.sql.
 *
 * Run:    node scripts/notify-missing-documents.js            (dry run: lists who would be asked)
 *         node scripts/notify-missing-documents.js --confirm  (sends the notifications)
 *
 * Safe to run again: lawyers who already have this notification are skipped.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { serviceClient } = require('./lib/env.cjs');

const REQUIRED = {
  bar_admission: 'proof of bar admission',
  ibp_membership: 'IBP membership',
  government_id: 'a government-issued ID',
};
const confirm = process.argv.includes('--confirm');

(async () => {
  const db = serviceClient();
  const { data: lawyers, error } = await db.from('lawyer_profiles').select('user_id, full_name').eq('verification_status', 'approved');
  if (error) throw new Error(error.message);
  const { data: docs, error: docError } = await db
    .from('lawyer_verification_documents')
    .select('lawyer_id, doc_type, superseded_at, review_status');
  if (docError) throw new Error(`${docError.message} (run supabase/manual/004 first)`);
  const { data: already } = await db.from('notifications').select('user_id').eq('type', 'lawyer_documents_requested');
  const notified = new Set((already ?? []).map((n) => n.user_id));
  const { data: accounts } = await db.from('profiles').select('user_id');
  const hasProfile = new Set((accounts ?? []).map((a) => a.user_id));

  let count = 0;
  for (const lawyer of lawyers) {
    const current = docs.filter((d) => d.lawyer_id === lawyer.user_id && !d.superseded_at && d.review_status !== 'rejected');
    const missing = Object.keys(REQUIRED).filter((t) => !current.some((d) => d.doc_type === t));
    if (missing.length === 0) continue;
    if (notified.has(lawyer.user_id)) {
      console.log(`ALREADY ASKED ${lawyer.full_name}`);
      continue;
    }
    if (!hasProfile.has(lawyer.user_id)) {
      console.log(`SKIP ${lawyer.full_name} (no account profile; cannot receive notifications)`);
      continue;
    }
    const list = missing.map((t) => REQUIRED[t]).join(', ');
    if (!confirm) {
      console.log(`WOULD ASK ${lawyer.full_name}: ${list}`);
      continue;
    }
    const { error: insertError } = await db.from('notifications').insert({
      user_id: lawyer.user_id,
      type: 'lawyer_documents_requested',
      title: 'Please upload your verification documents',
      body: `Justicia now keeps proof documents on file for every verified lawyer. Please upload ${list} on your Application Status page within 30 days. Your profile stays live meanwhile.`,
      metadata: { missing, link: '/lawyer/verification' },
      data: { missing, link: '/lawyer/verification' },
      channel: 'in_app',
      is_read: false,
    });
    if (insertError) console.warn(`Could not notify ${lawyer.full_name}: ${insertError.message}`);
    else {
      count++;
      console.log(`ASKED ${lawyer.full_name}: ${list}`);
    }
  }
  console.log(confirm ? `\n${count} lawyer(s) notified.` : '\nDry run only. Re-run with --confirm to send the notifications.');
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
