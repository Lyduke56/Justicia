-- ============================================================
-- Justicia — Lawyer Unavailability
-- File: supabase/migrations/0008_lawyer_unavailability.sql
-- ============================================================
-- Days / time ranges a lawyer has blocked off. Clients cannot book a
-- consultation that overlaps one of these entries.
--   • start_minutes / end_minutes NULL  → the whole day is unavailable
--   • otherwise minutes from midnight, Asia/Manila (e.g. 780 = 1:00 PM)
-- Idempotent. Run via the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lawyer_unavailability (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id         UUID NOT NULL REFERENCES public.lawyer_profiles(user_id) ON DELETE CASCADE,
  unavailable_date  DATE NOT NULL,
  start_minutes     INTEGER CHECK (start_minutes BETWEEN 0 AND 1440),
  end_minutes       INTEGER CHECK (end_minutes BETWEEN 0 AND 1440),
  reason            TEXT CHECK (char_length(reason) <= 300),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lawyer_unavailability_range_chk CHECK (
    (start_minutes IS NULL AND end_minutes IS NULL)
    OR (start_minutes IS NOT NULL AND end_minutes IS NOT NULL AND end_minutes > start_minutes)
  )
);

CREATE INDEX IF NOT EXISTS idx_lawyer_unavailability_lawyer_date
  ON public.lawyer_unavailability (lawyer_id, unavailable_date);

ALTER TABLE public.lawyer_unavailability ENABLE ROW LEVEL SECURITY;

-- Anyone may read blocked times (needed to grey out slots when booking).
DROP POLICY IF EXISTS "lu_public_read" ON public.lawyer_unavailability;
CREATE POLICY "lu_public_read" ON public.lawyer_unavailability
  FOR SELECT USING (TRUE);

-- Lawyers manage their own entries.
DROP POLICY IF EXISTS "lu_lawyer_own" ON public.lawyer_unavailability;
CREATE POLICY "lu_lawyer_own" ON public.lawyer_unavailability
  FOR ALL USING (auth.uid() = lawyer_id) WITH CHECK (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "lu_admin" ON public.lawyer_unavailability;
CREATE POLICY "lu_admin" ON public.lawyer_unavailability
  FOR ALL USING (public.is_admin());
