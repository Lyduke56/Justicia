-- ============================================================================
-- 006 · Reviews: one per consultation, references and rating cannot change,
--       replies only by the reviewed lawyer, hiding only by admins, no deletes
--       from the browser. (Reviews on unfinished consultations are already refused
--       by the existing trigger from 0007; confirmed by scripts/rls-audit.js.)
--
-- Depends on 003 (public.is_browser_request). Safe to run more than once.
-- ============================================================================

-- Pre-check: must return no rows. (Checked 2026-11-25: there are no reviews yet.)
select consultation_id, count(*) from public.reviews where consultation_id is not null group by 1 having count(*) > 1;

create unique index if not exists reviews_one_per_consultation
  on public.reviews (consultation_id)
  where consultation_id is not null;

create or replace function public.guard_review()
returns trigger
language plpgsql
as $$
begin
  if not public.is_browser_request() or public.is_admin() then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Reviews cannot be deleted.' using errcode = '42501';
  end if;
  if new.consultation_id is distinct from old.consultation_id
     or new.client_id is distinct from old.client_id
     or new.lawyer_id is distinct from old.lawyer_id
     or new.rating is distinct from old.rating
     or new.comment is distinct from old.comment
     or new.created_at is distinct from old.created_at
  then
    raise exception 'A review cannot be edited after it is posted.' using errcode = '42501';
  end if;
  if (new.counsel_reply is distinct from old.counsel_reply or new.counsel_replied_at is distinct from old.counsel_replied_at)
     and auth.uid() is distinct from old.lawyer_id
  then
    raise exception 'Only the reviewed lawyer can reply.' using errcode = '42501';
  end if;
  if new.is_hidden is distinct from old.is_hidden then
    raise exception 'Only administrators can hide reviews.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_review on public.reviews;
create trigger trg_guard_review
  before update or delete on public.reviews
  for each row execute function public.guard_review();

-- Check
select indexname from pg_indexes where indexname = 'reviews_one_per_consultation';
select tgname from pg_trigger where tgname = 'trg_guard_review';
