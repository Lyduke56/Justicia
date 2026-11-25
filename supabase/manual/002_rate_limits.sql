-- ============================================================================
-- 002 · Shared rate-limit counters
--
-- App code: src/lib/security/rateLimit.ts. Until this script runs, each server
-- instance keeps its own in-memory counter (weaker on Vercel, where requests
-- spread across instances). Keys arrive already hashed; no IPs or emails stored.
-- ============================================================================

create table if not exists public.rate_limit_hits (
  key           text        not null,
  window_start  timestamptz not null,
  hits          integer     not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

-- Counts one hit in the current fixed window and says whether it is still allowed.
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits   integer;
begin
  insert into public.rate_limit_hits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  -- Occasional cleanup of old windows.
  if random() < 0.01 then
    delete from public.rate_limit_hits where window_start < now() - interval '2 days';
  end if;

  return jsonb_build_object(
    'allowed', v_hits <= p_limit,
    'retry_after', greatest(1, ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds) - now())))::int)
  );
end;
$$;
revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- Check: the first call is allowed, the third with limit 2 is not.
select public.hit_rate_limit('manual-check', 2, 60) as first_call;
select public.hit_rate_limit('manual-check', 2, 60);
select public.hit_rate_limit('manual-check', 2, 60) as third_call_should_not_be_allowed;
delete from public.rate_limit_hits where key = 'manual-check';
