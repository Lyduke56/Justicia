-- ============================================================
-- Justicia Legal Platform - Migration 0005
-- Relax or fix the no_double_booking exclusion constraint
-- ============================================================

-- 1. Drop old strict exclusion constraint if present
ALTER TABLE IF EXISTS public.consultations DROP CONSTRAINT IF EXISTS no_double_booking;

-- 2. Optional: Re-create exclusion constraint only for CONFIRMED consultations
-- This allows pending consultations and test bookings to be submitted without hard DB crashes.
-- If btree_gist extension is available:
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS btree_gist;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 3. Create a clean partial unique index so that a lawyer cannot have two CONFIRMED
-- appointments at the exact same scheduled timestamp:
DROP INDEX IF EXISTS idx_consultations_confirmed_schedule;
CREATE UNIQUE INDEX IF NOT EXISTS idx_consultations_confirmed_schedule
ON public.consultations (lawyer_id, scheduled_time)
WHERE status = 'confirmed';

