# Manual test checklist (backend audit features)

Tick each box as you go. Each line says what to do and what you should see. If a result is
different, note the page URL, the time, the test account and what you saw, and take a screenshot.
For an API call, also copy the `x-request-id` response header (DevTools → Network).

Use **test accounts only**: several steps suspend, terminate or delete the account you test with.

---

## 0. Set up

### Run the database script (once)

- [ ] Open Supabase Dashboard → **SQL Editor** → New query. Paste the whole of
      `supabase/manual/RUN_ALL.sql` and click **Run**.
      Run only `RUN_ALL.sql`. It already contains scripts 001–007 in order, so you do **not**
      also run the numbered files. Those are there to read, or to run one at a time if
      `RUN_ALL.sql` stops with an error. Every statement is safe to run again.
- [ ] The results panel only shows the last query's result. To confirm everything was created,
      run this in a new query. **Every column must be `true`:**

```sql
select
  exists (select 1 from pg_indexes where indexname = 'user_accounts_email_lower_key')          as "001 unique email",
  to_regclass('public.blocked_emails') is not null                                            as "001 blocked emails",
  to_regprocedure('public.email_registration_status(text,text)') is not null                 as "001 email check",
  to_regprocedure('public.hit_rate_limit(text,integer,integer)') is not null                 as "002 rate limits",
  exists (select 1 from pg_policies where policyname = 'user_accounts_select_own_or_admin')    as "003 access rules",
  exists (select 1 from pg_trigger  where tgname = 'trg_guard_lawyer_profile_fields')          as "003 lawyer guard",
  exists (select 1 from pg_constraint where conname = 'lvd_review_status_check')               as "004 documents",
  exists (select 1 from pg_constraint where conname = 'consultations_no_lawyer_overlap')       as "005 no overlaps",
  exists (select 1 from pg_trigger  where tgname = 'trg_guard_consultation')                   as "005 status rules",
  exists (select 1 from pg_indexes where indexname = 'reviews_one_per_consultation')           as "006 reviews",
  exists (select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'profiles'
            and column_name = 'consultation_language')                                        as "007 profile fields";
```

### Prepare the app

- [ ] Restart `npm run dev`, so rate limits use the new database function.
- [ ] Run `npm run audit:rls`. **Expected:** every line says `PASS` and the last line reads
      `33/33 checks passed`. (Before the script ran, 5 checks failed.)
- [ ] (Optional, only to test the deletion purge in section 4) add `CRON_SECRET=<any long random text>`
      to `.env.local`, then restart `npm run dev`.

### Accounts and devices you need

| Name used below | Role | How to get it |
|---|---|---|
| **Admin** | admin | your admin account |
| **Client A**, **Client B** | client | sign up at `/register`. Use real inboxes; Gmail `name+a@gmail.com` and `name+b@gmail.com` count as different emails |
| **Applicant** | client applying as lawyer | a third client account, used in section 6 |
| **Lawyer** | approved lawyer | an approved test lawyer account you can sign in to |

Also have two browsers ready (or a normal and a private window), plus your phone for section 3.

Supabase's built-in email sender only allows a few emails per hour. If confirmation emails stop
arriving, wait a while or set up custom SMTP in Supabase.

---

## 1. Sign-up and one account per email

- [ ] `/register` → fill everything **without** ticking the agreement box → Create.
      **Expected:** "Please agree to the Terms of Service, Privacy Policy and AI Disclaimer to create an account."
- [ ] The agreement line links to **Terms of Service**, **Privacy Policy** and **AI Disclaimer**; each opens.
- [ ] Sign up with the **Admin's** email typed in CAPITALS.
      **Expected:** "This email is already registered. Sign in or reset your password." No email arrives.
- [ ] Repeat with the **Lawyer's** email and with **Client A's** email. **Expected:** same message.
- [ ] Sign up with a brand-new email. **Expected:** you land on "Check your inbox".
- [ ] On that page click **send a new link**. **Expected:** a message saying a new link is on its way, and a second email.
- [ ] Before confirming, sign in at `/login`.
      **Expected:** "Please verify your email before signing in." with a **Resend verification email** link that works.
- [ ] Confirm the email, then sign in. **Expected:** you reach the client dashboard.
- [ ] Sign in with a wrong password 9 times in a row for the same email.
      **Expected:** "Too many attempts. Please wait … and try again."

## 2. Pages and access

- [ ] Signed out, open `/terms`, `/privacy` and `/ai-disclaimer`. **Expected:** all three load.
- [ ] Signed out, open `/client/dashboard?demo=client`. **Expected:** you go to the sign-in page (demo mode is off).
- [ ] As **Client A**, open `/admin/dashboard`. **Expected:** you are sent back to `/client/dashboard`.
- [ ] As **Client A**, open `/api/payments`. **Expected:** `{"error":"Forbidden"}`, never a success message.
- [ ] Open `/api/health`. **Expected:** JSON with `"database":"ok"` (`"status":"degraded"` is normal if `CRON_SECRET` isn't set).

## 3. Client settings (`/client/settings`) as Client A

### Notifications
- [ ] Four switches: **Consultation updates**, **Payments**, **New messages**, **Reminders**.
      Email and SMS still say "Coming soon".
- [ ] Turn **New messages** off. **Expected:** "Saved". Have the **Lawyer** send Client A a message.
      **Expected:** no new-message alert in Client A's bell.
- [ ] Turn it back on. **Expected:** the alert appears in the bell; history is kept, not deleted.
- [ ] Reminders (needs a confirmed consultation that starts within 24 hours): open the bell.
      **Expected:** "Consultation tomorrow". Within 1 hour: "Consultation in 1 hour". Within 15 minutes: "Consultation starting soon".
      With **Reminders** off, none of these show.

### Messaging privacy
- [ ] Client A turns on **Hide read receipts**. The Lawyer sends a message and Client A opens it.
      **Expected:** the Lawyer does not see "Seen", and Client A doesn't see "Seen" under their own messages either.
- [ ] With **Hide read receipts** off on both sides, "Seen" appears again for new messages.
- [ ] Client A turns on **Hide when I'm typing** and types in a conversation.
      **Expected:** the Lawyer doesn't see "typing…", and Client A doesn't see the Lawyer typing.

### Sign out everywhere
- [ ] Sign in as Client A on your laptop **and** your phone.
- [ ] On the laptop click **Sign out all**. **Expected:** the laptop goes to the sign-in page.
- [ ] On the phone, tap anything or refresh. **Expected:** the phone is signed out too. An open portal tab leaves on its own within a moment.

### Terms and policies
- [ ] An account created before 25 Nov 2026 shows "Please review and accept the current versions." → click **Accept**.
      **Expected:** "You accepted the current versions on <today>."
- [ ] A newly signed-up account already shows the acceptance date.

### Download my data
- [ ] Click **Download**. **Expected:** a file `justicia-my-data-<date>.json` downloads. Open it:
      it has your email, profile, consultations, messages, payments and reviews.
- [ ] Click **Download** again the same day.
      **Expected:** "You already downloaded your data in the last 24 hours. Please try again tomorrow."

## 4. Delete my account (Client B)

- [ ] Give Client B an upcoming consultation, then Settings → **Delete my account** → **Delete**.
      Enter the password, type `DELETE` and confirm.
      **Expected:** "You have 1 upcoming consultation. Cancel it, or wait until it is finished, before deleting your account."
- [ ] Cancel that consultation.
- [ ] Type `delete` in lowercase. **Expected:** the button stays disabled.
- [ ] Enter a wrong password with `DELETE`. **Expected:** "Your password is incorrect."
- [ ] Enter the right password with `DELETE`.
      **Expected:** you are signed out on every device, and an email says the account is scheduled for deletion.
- [ ] Sign in as Client B again. **Expected:** the "Your account is scheduled for deletion" page with a date 7 days ahead.
- [ ] Type `/client/dashboard` in the address bar. **Expected:** you are sent back to the restore page.
- [ ] Click **Restore my account**. **Expected:** the dashboard; settings, consultations and messages are all still there.
- [ ] (Optional) delete again and choose **Keep it deleted and sign out**. **Expected:** you are signed out.

### Optional: the purge after 7 days
This permanently erases the test account, so only do it with an account you don't need.
- [ ] Delete a test account as above. In the SQL editor, move its request back 8 days:
      `update profiles set deletion_requested_at = now() - interval '8 days' where email = '<test email>';`
- [ ] Run `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/purge-deleted-accounts`.
      **Expected:** `{"ok":true,"purged":1,"failed":0}`.
- [ ] Sign in with that account. **Expected:** sign-in is refused.
- [ ] Sign up again with the same email. **Expected:** it is accepted, because the email is free again.
- [ ] Repeat with an account that was suspended at some point. A suspended user can't sign in, so the Admin suspends it,
      then reinstates it; the user then deletes it, and you run the purge. Signing up again with its email should show
      "This email cannot be used to create a Justicia account…"

## 5. Client profile (`/client/profile`) as Client A

- [ ] **Add a photo** (PNG, JPG or WebP, up to 4 MB). **Expected:** it shows in the circle. **Remove photo** removes it.
- [ ] Rename a `.txt` file to `.png` and upload it.
      **Expected:** "This file's contents don't match its type. Please upload the original file (not renamed)."
- [ ] **Edit profile** → fill **City / Province**, **Preferred Consultation Language**, **Preferred Contact Method** and
      **Best Time to Reach You** → Save.
      **Expected:** they show as cards, and **Profile Completeness** goes up.
- [ ] **Member Since** shows the sign-up date, with consultations completed and lawyers consulted.
- [ ] As the **Lawyer** (who has a consultation with Client A), open Consultations → Client A's card.
      **Expected:** a line such as "Cebu City | Prefers phone call, evenings (5 pm – 9 pm), in Cebuano".

## 6. Lawyer application and documents (Applicant)

- [ ] As the Applicant, open `/lawyer/register` → fill Credentials → **Save & Continue**.
      **Expected:** a **Documents** step listing 3 required items (*) and MCLE (optional).
- [ ] Click **Save & Continue** with nothing uploaded.
      **Expected:** "Before submitting, please upload Proof of bar admission, IBP membership, Government-issued ID."
- [ ] Upload a renamed file (e.g. `.txt` → `.pdf`). **Expected:** the "contents don't match" error.
- [ ] Upload a file over 8 MB. **Expected:** "Each document must be 8 MB or smaller."
- [ ] Upload a real PDF or JPG for each required item. **Expected:** each shows "Uploaded".
      **View** opens the file in a new tab; **Remove** and **Replace** work.
- [ ] Continue → Profile → Review. **Expected:** "All 3 required documents uploaded" → **Submit Application**.
- [ ] Application Status page. **Expected:** "Under Review", documents listed as "Under review", no Upload, Replace or Remove buttons,
      and "Your documents are locked while your application is under review."
- [ ] As the **Admin**, open `/lawyer/register` and click Save & Continue.
      **Expected:** "Administrator accounts cannot apply as lawyers. Use a separate account."

## 7. Admin: verification (Admin)

- [ ] **Verification queue**: the Applicant shows **Reject**, **Request info** and **Approve**; approved lawyers show none of these.
- [ ] **Open full dossier** → **Verification Documents** shows each file. **Open file** opens it in a new tab.
- [ ] **Audit log**: an entry for the document view (`lawyer.document.viewed`).
- [ ] **Reject** one document with a note.
- [ ] Click **Approve lawyer** now. **Expected:** "Exception reason (required)", naming the rejected document; the button
      stays disabled until you type 10 characters. Click **Cancel** (an exception approval is tested below).
- [ ] Click **Request information** with a message.
- [ ] As the Applicant, the status page shows that document as "Needs a new file" with the note. Replace it and resubmit.
- [ ] As the Admin, the dossier shows **Earlier versions (1)** under that document; the old file still opens.
- [ ] **Approve lawyer**. **Expected:** the documents become "Accepted", and the lawyer appears in Find a Lawyer.
- [ ] Open an **approved** lawyer's dossier.
      **Expected:** only **Request re-verification** and **Revoke verification**; no Approve or Reject.
- [ ] Approval with an exception (use a **test** application only): on a pending test application, reject one
      document, click **Approve lawyer**, type a reason and approve.
      **Expected:** the lawyer is approved, and the audit log entry for the approval shows your exception reason.
- [ ] **Revoke verification** on a test lawyer. **Expected:** they leave Find a Lawyer, and their status page shows your reason.
- [ ] Two tabs on the same pending dossier: approve in tab 1, then **Reject application** in tab 2.
      **Expected:** an error saying the lawyer is already verified or the application changed; nothing is overwritten.
- [ ] Lawyers approved before documents were required: run `node scripts/notify-missing-documents.js`
      (it only lists them), then add `--confirm` to send.
      **Expected:** each gets a bell notification, and `/lawyer/verification` shows "You are a verified Justicia lawyer" with an upload panel.

## 8. Admin: account standing

- [ ] **User accounts** → open Client A → **Account standing** → **Suspend** → **3 days** → reason → **Suspend account**.
      **Expected:** "The account is suspended for 3 days."
- [ ] Client A's open tab leaves to the sign-in page. Signing in shows "This account is suspended until <date> (PHT)…"
      followed by the support email.
- [ ] Any consultation of Client A inside those 3 days is cancelled, and the other person is notified.
- [ ] **Extend** works while suspended.
- [ ] **Reinstate** with a reason. **Expected:** Client A can sign in again.
- [ ] **Terminate** with a wrong admin password. **Expected:** "Your password is incorrect…", and nothing changes.
- [ ] Your own account and other admin accounts show no suspend controls.
- [ ] In the same modal, try to change **your own** role.
      **Expected:** "You cannot change your own role. Ask another administrator."
- [ ] **Audit log** shows suspended, reinstated and terminated entries, each with your name and the reason.

## 9. Bookings, payments, reviews, messages

- [ ] Book a consultation and double-click **Confirm** fast. **Expected:** only one booking is created.
- [ ] Client A and Client B book the **same lawyer, same slot** at the same moment (two browsers).
      **Expected:** one succeeds; the other sees "…slot was just reserved by another client…".
- [ ] Book a slot that overlaps your own existing booking.
      **Expected:** "You already have another consultation scheduled at this time…"
- [ ] Proof of payment: a renamed file is refused, a real screenshot is accepted.
      The Lawyer confirms it → the audit log shows `payment.confirmed`.
- [ ] Approve or cancel a consultation, then check the **Audit log**. **Expected:** `consultation.status_changed` entries.
- [ ] Rate a completed consultation, then try to rate it again. **Expected:** the second rating is refused.
- [ ] In Messages, replies, pins and "Seen" now load (they were blocked before this work).
- [ ] Attaching a renamed file is refused; a voice note still sends.

## 10. Before release

- [ ] `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` all pass (GitHub Actions runs the same).
- [ ] `npm run audit:rls` passes against the live database.
- [ ] In Vercel, `CRON_SECRET` is set (see `OPERATIONS.md`). After deploying, `/api/health` shows `"cron":"configured"`.
