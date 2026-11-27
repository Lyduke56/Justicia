# Manual database scripts (live Supabase project)

These scripts change the **live** database. Run them in **Supabase Dashboard → SQL Editor**, in
order. Every script is safe to run more than once and ends with check queries whose expected
results are written above them.

**Run only `RUN_ALL.sql`.** It is scripts 001–007 joined in order, so do not also run the numbered
files. They are there to read, or to run one at a time if `RUN_ALL.sql` stops with an error, so
you can see which step failed. `TESTING.md` (repo root) has a query that confirms every part was
created, and the manual test checklist.

| # | Script | What it does | Needed for |
|---|---|---|---|
| 001 | `001_email_uniqueness.sql` | Unique `lower(email)` on `user_accounts` and `profiles`; `blocked_emails` table; `email_registration_status()` | One account per email; deleted-after-suspension emails stay blocked |
| 002 | `002_rate_limits.sql` | `rate_limit_hits` table and `hit_rate_limit()` | Rate limits shared by all Vercel instances |
| 003 | `003_access_rules.sql` | Fixes the RLS leaks found by `scripts/rls-audit.js`; guard trigger on `lawyer_profiles` | **Security fixes; run first if you run only one** |
| 004 | `004_lawyer_verification_documents.sql` | Columns for file name, type, size, checksum, version and review status | Lawyer document uploads and submissions |
| 005 | `005_booking_integrity.sql` | No overlapping bookings, booking eligibility, allowed status changes, audit entry per status change | Booking integrity |
| 006 | `006_reviews_integrity.sql` | One review per consultation; reviews can't be edited or deleted from the browser | Review integrity |
| 007 | `007_profile_fields.sql` | `city_province`, `consultation_language`, `contact_method`, `contact_time` on `profiles` | Client profile fields |
| 008 | `008_drop_one_confirmed_per_day.sql` | Drops the old index that allowed only one confirmed consultation per lawyer per day (not in `RUN_ALL.sql`; run it on its own) | Confirming a second paid booking on the same day |

## Order matters

`005` and `006` use `public.is_browser_request()` from `003`. Run `003` before them.

## After running

1. Re-run the access audit; every check should pass:
   `npm run audit:rls`
2. Ask lawyers approved before documents were required to upload them:
   `node scripts/notify-missing-documents.js` (dry run) then `--confirm`.
3. Restart `npm run dev` (and redeploy on Vercel) so the app starts using the new rate-limit
   function instead of its in-memory fallback.
4. Work through the checklist in `TESTING.md`.

## Until these scripts are run

The app keeps working. Without them:

- emails are still checked by the app, but the database does not enforce uniqueness;
- rate limits are counted per server instance only;
- the RLS leaks listed in `003` remain open;
- lawyers **cannot upload verification documents or submit applications** (`004` adds the
  columns the uploads need; the app shows a message pointing here);
- the overlap and status rules are enforced by the app only;
- client profile fields (city, consultation language, contact method, contact time) cannot be saved.
