# Justicia operations guide

Written for whoever on the team is on call. Keep it short and current.

## Deploy checklist (Vercel)

1. Run the database scripts first: `supabase/manual/RUN_ALL.sql` (see `supabase/manual/README.md`).
2. Vercel → Project → Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (the production URL, used in email links)
   - `CRON_SECRET`: a long random string. Vercel sends it to `/api/cron/purge-deleted-accounts`
     (daily at 02:00 PHT, see `vercel.json`). Without it the purge job refuses every call.
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `GEMINI_API_KEY` as before.
   - Optional: `NEXT_PUBLIC_SUPPORT_EMAIL` (defaults to support@justicia.ph), `REALTIME_TOPIC_SECRET`.
   - Never set `JUSTICIA_DEMO` in production (demo portals are ignored in production builds anyway).
3. After deploying: open `/api/health` (expects `"status": "ok"`), then run `npm run audit:rls`
   from a machine with `.env.local`.

## Backups and recovery

- **What is backed up:** check Supabase Dashboard → Database → Backups for the plan's daily backup
  retention and whether point-in-time recovery is on. The free plan has no downloadable backups,
  so before the system holds real client data, upgrade or schedule your own dump.
- **Own dump (weekly, and before any manual SQL):** from a trusted machine with the database
  password: `supabase db dump --db-url "$DATABASE_URL" -f backup-YYYY-MM-DD.sql` (schema + data:
  add `--data-only` for a second file). Store dumps encrypted, outside the repository.
- **Recovery targets:** recovery point objective 24 hours (daily backup), recovery time objective
  4 hours.
- **Restore test (each term):** restore the latest dump into a scratch Supabase project, sign in
  with a seeded account, open a consultation and a document, then delete the scratch project.

## Incident procedures

Write down what happened, when, who acted, and what changed, in the security audit log or the
team channel, as you go.

### Accidental deletion of data
1. Stop: no further writes to the affected table (pause the related feature if needed).
2. Find the last good backup or dump; restore it into a **scratch** project, not production.
3. Copy back only the affected rows (by id) with SQL, then compare counts.

### Compromised admin account
1. Another admin opens Admin → Users, sets the account's role to client (or terminates it).
2. In Supabase Dashboard → Authentication → Users, ban the user and sign them out.
3. Review the Security Audit Log for the account's recent actions (role changes, suspensions,
   verification decisions, document views) and undo them.
4. Rotate `SUPABASE_SERVICE_ROLE_KEY` if there is any chance it leaked, update Vercel, redeploy.

### Payment reconciliation failure
1. Compare `payments` (status, paid_at) with the lawyers' payment channels for the affected period.
2. The audit log has `payment.proof_submitted`, `payment.confirmed`, `payment.rejected` per
   consultation. Fix the ledger row by hand and record why in the audit log.

### Leaked document access
1. Revoke grants: set `revoked_at` on the `document_access_grants` rows concerned.
2. Signed links expire after 2 minutes (case documents), 5 minutes (lawyer verification files) or
   10 minutes (report evidence). Who opened what is in the audit log: `document.accessed`
   (someone else's case document) and `lawyer.document.viewed` (verification files).
3. Tell the affected users. Under RA 10173, notify the National Privacy Commission within 72 hours
   if personal data was likely exposed.

### Database corruption
1. Put the site in maintenance (Vercel → disable the production deployment or redirect).
2. Restore the latest backup into a scratch project, verify it, then point production at it or
   restore in place.

### Failed migration
1. Every script in `supabase/manual/` runs as one transaction in the SQL editor; a failure leaves
   the database as it was. Read the error, fix the script (or the data it complains about), and
   run it again.
2. If a script succeeded but broke a feature, revert the app first (Vercel → promote the previous
   deployment), then write a follow-up script; do not edit history.

## Routine checks

- Weekly: `npm run audit:rls` passes; `/api/health` is ok; the purge job's Vercel log shows
  `"failed": 0`.
- Before each release: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
  (the same checks GitHub Actions runs).
