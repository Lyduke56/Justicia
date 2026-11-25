-- ============================================================================
-- 001 · One account per email (any role, any status) + blocked emails
--
-- Run in: Supabase Dashboard → SQL Editor. Safe to run more than once.
-- App code: src/lib/auth/email.ts (works before this script, but without the
-- database guarantee and without seeing auth.users directly).
-- ============================================================================

-- 0. Pre-check: both queries must return no rows, otherwise the unique indexes
--    below cannot be created. (Checked 2026-11-25: no duplicates.)
select lower(email) as email, count(*) from public.user_accounts where email is not null group by 1 having count(*) > 1;
select lower(email) as email, count(*) from public.profiles      where email is not null group by 1 having count(*) > 1;

-- 1. The database refuses a second account row with the same address, whatever its letter case.
create unique index if not exists user_accounts_email_lower_key on public.user_accounts (lower(email));
create unique index if not exists profiles_email_lower_key      on public.profiles (lower(email));

-- 2. Emails that can never register again: accounts deleted after a suspension or termination.
--    Only a SHA-256 hash is stored (see emailHash() in src/lib/auth/email.ts), never the address.
create table if not exists public.blocked_emails (
  email_hash  text primary key,
  reason      text not null,
  account_id  uuid,
  created_at  timestamptz not null default now()
);
alter table public.blocked_emails enable row level security;
-- No policies on purpose: only the server (service role, which bypasses RLS) can read or write it.
revoke all on public.blocked_emails from anon, authenticated;

-- 3. One call that also sees auth.users (which the API cannot query).
create or replace function public.email_registration_status(p_email text, p_email_hash text)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when exists (select 1 from public.blocked_emails b where b.email_hash = p_email_hash) then 'blocked'
    when exists (select 1 from auth.users u where lower(u.email) = lower(trim(p_email)))
      or exists (select 1 from public.user_accounts a where lower(a.email) = lower(trim(p_email)))
      or exists (select 1 from public.profiles p where lower(p.email) = lower(trim(p_email)))
    then 'in_use'
    else 'available'
  end;
$$;
revoke all on function public.email_registration_status(text, text) from public, anon, authenticated;
grant execute on function public.email_registration_status(text, text) to service_role;

-- Check: expect two rows (both indexes) and 'in_use' for an address that exists.
select indexname from pg_indexes where indexname in ('user_accounts_email_lower_key', 'profiles_email_lower_key');
select public.email_registration_status('admin@justicia.ph', 'x') as admin_email_status;
