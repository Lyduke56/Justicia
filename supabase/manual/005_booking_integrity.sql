-- ============================================================================
-- 005 · Booking integrity: no overlapping bookings, eligibility on insert,
--       allowed status changes, and an audit entry for every status change.
--
-- Depends on 003 (public.is_browser_request). Safe to run more than once.
-- ============================================================================

-- 0. Pre-check: both must return no rows, or step 2 fails. (Checked 2026-11-25: none.)
select a.id, b.id as overlaps_with, a.lawyer_id
from public.consultations a
join public.consultations b
  on a.lawyer_id = b.lawyer_id and a.id < b.id
 and tstzrange(a.scheduled_start, a.scheduled_end, '[)') && tstzrange(b.scheduled_start, b.scheduled_end, '[)')
where a.status in ('pending', 'awaiting_client_confirmation', 'confirmed')
  and b.status in ('pending', 'awaiting_client_confirmation', 'confirmed')
  and a.scheduled_start is not null and a.scheduled_end is not null
  and b.scheduled_start is not null and b.scheduled_end is not null;
select a.id, b.id as overlaps_with, a.client_id
from public.consultations a
join public.consultations b
  on a.client_id = b.client_id and a.id < b.id
 and tstzrange(a.scheduled_start, a.scheduled_end, '[)') && tstzrange(b.scheduled_start, b.scheduled_end, '[)')
where a.status in ('pending', 'awaiting_client_confirmation', 'confirmed')
  and b.status in ('pending', 'awaiting_client_confirmation', 'confirmed')
  and a.scheduled_start is not null and a.scheduled_end is not null
  and b.scheduled_start is not null and b.scheduled_end is not null;

-- 1. Range types over uuid need btree_gist.
create extension if not exists btree_gist with schema extensions;

-- 2. A lawyer (and a client) can never hold two active bookings whose times overlap, even when
--    two requests arrive at the same moment. bookConsultationAction already turns the resulting
--    error (23P01) into "this slot was just reserved".
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'consultations_no_lawyer_overlap') then
    alter table public.consultations
      add constraint consultations_no_lawyer_overlap
      exclude using gist (lawyer_id with =, tstzrange(scheduled_start, scheduled_end, '[)') with &&)
      where (status in ('pending', 'awaiting_client_confirmation', 'confirmed')
             and scheduled_start is not null and scheduled_end is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'consultations_no_client_overlap') then
    alter table public.consultations
      add constraint consultations_no_client_overlap
      exclude using gist (client_id with =, tstzrange(scheduled_start, scheduled_end, '[)') with &&)
      where (status in ('pending', 'awaiting_client_confirmation', 'confirmed')
             and scheduled_start is not null and scheduled_end is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'consultations_time_order') then
    alter table public.consultations
      add constraint consultations_time_order
      check (scheduled_start is null or scheduled_end is null or scheduled_end > scheduled_start) not valid;
  end if;
end $$;

-- 3. Reads a JSON text column without failing on bad JSON.
create or replace function public.safe_jsonb(p text)
returns jsonb
language plpgsql
immutable
as $$
begin
  return p::jsonb;
exception when others then
  return null;
end;
$$;

-- 4. Eligibility, allowed status changes and the status-change audit trail.
--    Allowed (matches src/app/actions/consultationActions.ts):
--      pending                      → awaiting_client_confirmation | declined | cancelled
--      awaiting_client_confirmation → confirmed | cancelled
--      confirmed                    → completed | cancelled
--      declined, cancelled, completed are final.
--    Requests from the SQL editor (no JWT role) are allowed, for audited manual corrections.
create or replace function public.guard_consultation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   text := coalesce(auth.role(), '');
  v_allowed  boolean;
  v_actor    uuid;
  v_meta     jsonb;
begin
  if tg_op = 'INSERT' then
    if v_caller <> '' and new.status <> 'pending' then
      raise exception 'New consultations start as pending.' using errcode = '23514';
    end if;
    if v_caller <> '' then
      if not exists (
        select 1 from public.lawyer_profiles lp
        where lp.user_id = new.lawyer_id and lp.verification_status = 'approved'
      ) or exists (
        select 1 from public.profiles p where p.user_id = new.lawyer_id and p.account_status <> 'active'
      ) then
        raise exception 'This attorney is not accepting bookings.' using errcode = 'P0001';
      end if;
      if exists (select 1 from public.profiles p where p.user_id = new.client_id and p.account_status <> 'active') then
        raise exception 'This account cannot book consultations.' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  v_allowed := case old.status
    when 'pending' then new.status in ('awaiting_client_confirmation', 'declined', 'cancelled')
    when 'awaiting_client_confirmation' then new.status in ('confirmed', 'cancelled')
    when 'confirmed' then new.status in ('completed', 'cancelled')
    else false
  end;
  if not v_allowed and v_caller <> '' then
    raise exception 'A consultation cannot change from % to %.', old.status, new.status using errcode = '23514';
  end if;

  v_meta := public.safe_jsonb(new.concern_summary);
  v_actor := case
    when auth.uid() is not null then auth.uid()
    when new.status = 'cancelled' then new.cancelled_by
    when new.status in ('awaiting_client_confirmation', 'declined', 'confirmed') then new.lawyer_id
    else null
  end;
  if v_actor is not null and not exists (select 1 from public.user_accounts where id = v_actor) then
    v_actor := null;
  end if;

  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (
    v_actor,
    'consultation.status_changed',
    'consultation',
    new.id::text,
    jsonb_build_object(
      'from', old.status,
      'to', new.status,
      'reason', coalesce(v_meta ->> 'cancellationReason', v_meta ->> 'declineReason'),
      'source', case when v_caller = '' then 'manual_correction' else v_caller end
    )
  );
  return new;
end;
$$;
drop trigger if exists trg_guard_consultation on public.consultations;
create trigger trg_guard_consultation
  before insert or update on public.consultations
  for each row execute function public.guard_consultation();

-- Check: expect three constraints and the trigger.
select conname from pg_constraint where conname in ('consultations_no_lawyer_overlap', 'consultations_no_client_overlap', 'consultations_time_order');
select tgname from pg_trigger where tgname = 'trg_guard_consultation';
