-- ============================================================================
-- 003 · Access-rule (RLS) fixes found by scripts/rls-audit.js on 2026-11-25
--
-- Failures this fixes:
--   1. Anyone, even signed out, could read every user_accounts row (emails, phones, roles).
--   2. A client could insert a payments row marked "paid".
--   3. A pending lawyer could set their own verification_status to 'approved' and list
--      themselves in Find a Lawyer, straight from the browser.
--   4. Signed-out visitors could read pending lawyer applications (lawyer_profiles).
--
-- The app's server code uses the service-role key (which bypasses RLS) for all writes, so
-- removing browser write access does not break any feature. Re-run scripts/rls-audit.js after.
-- Safe to run more than once.
-- ============================================================================

-- Helper: true when the request comes from a browser session (anon key or a signed-in user's JWT)
-- rather than the server (service role) or the SQL editor.
create or replace function public.is_browser_request()
returns boolean
language sql
stable
as $$
  select coalesce(auth.role(), '') in ('anon', 'authenticated');
$$;

-- ─── 1. user_accounts: each user reads only their own row; admins read all ──
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'user_accounts' loop
    execute format('drop policy %I on public.user_accounts', r.policyname);
  end loop;
end $$;
alter table public.user_accounts enable row level security;
create policy user_accounts_select_own_or_admin on public.user_accounts
  for select to authenticated
  using (auth.uid() = id or public.is_admin());
-- No insert/update/delete policies: account rows are written by the server and the sign-up trigger.

-- ─── 2. payments: participants and admins may read; nobody writes from the browser ──
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'payments' loop
    execute format('drop policy %I on public.payments', r.policyname);
  end loop;
end $$;
alter table public.payments enable row level security;
create policy payments_select_participants on public.payments
  for select to authenticated
  using (payer_id = auth.uid() or payee_id = auth.uid() or public.is_admin());

-- ─── 3. lawyer_profiles: public sees approved + listed lawyers; owners and admins see their rows ──
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'lawyer_profiles' loop
    execute format('drop policy %I on public.lawyer_profiles', r.policyname);
  end loop;
end $$;
alter table public.lawyer_profiles enable row level security;
create policy lawyer_profiles_public_read on public.lawyer_profiles
  for select to anon, authenticated
  using (verification_status = 'approved' and is_visible = true);
create policy lawyer_profiles_own_read on public.lawyer_profiles
  for select to authenticated
  using (auth.uid() = user_id);
create policy lawyer_profiles_admin_read on public.lawyer_profiles
  for select to authenticated
  using (public.is_admin());
-- Profile edits, registration and verification decisions all go through the server.

-- Defence in depth: even if a write policy is added later, a browser session can never change
-- verification fields, ratings or its own listing before approval.
create or replace function public.guard_lawyer_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_browser_request() or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.verification_status := 'draft';
    new.is_visible := false;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.admin_notes := null;
    new.rejection_reason := null;
    new.rating_avg := null;
    new.rating_count := 0;
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.admin_notes is distinct from old.admin_notes
     or new.rejection_reason is distinct from old.rejection_reason
     or new.submitted_at is distinct from old.submitted_at
     or new.rating_avg is distinct from old.rating_avg
     or new.rating_count is distinct from old.rating_count
     or (new.is_visible is distinct from old.is_visible and old.verification_status <> 'approved')
  then
    raise exception 'Verification fields can only be changed by Justicia.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_lawyer_profile_fields on public.lawyer_profiles;
create trigger trg_guard_lawyer_profile_fields
  before insert or update on public.lawyer_profiles
  for each row execute function public.guard_lawyer_profile_fields();

-- Check: expect the policies listed below and no others on these three tables.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('user_accounts', 'payments', 'lawyer_profiles')
order by tablename, policyname;
