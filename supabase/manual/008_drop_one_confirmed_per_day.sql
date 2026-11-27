-- ============================================================================
-- 008 · Let a lawyer hold more than one confirmed consultation per day.
--
-- Migration 0005 created idx_consultations_confirmed_schedule, a unique index on
-- (lawyer_id, scheduled_time) for confirmed rows. scheduled_time is a DATE, so the
-- index allowed only ONE confirmed consultation per lawyer per calendar day.
-- Confirming a second payment the same day failed with 23505, which
-- reviewPaymentAction shows as "You already have another confirmed consultation
-- at this time."
--
-- Real double booking is still blocked by:
--   - consultations_no_lawyer_overlap / consultations_no_client_overlap (005): no overlapping times
--   - uq_consultations_lawyer_active_start (0006): no two active bookings with the same start
--
-- Depends on 005. Safe to run more than once.
-- ============================================================================

drop index if exists public.idx_consultations_confirmed_schedule;

-- Check: should return no rows.
select indexname from pg_indexes where indexname = 'idx_consultations_confirmed_schedule';
