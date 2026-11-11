-- ============================================================
-- Justicia — Migration 0006
-- Client consultation booking hardening
-- ============================================================
-- Idempotent: safe to run repeatedly in the Supabase SQL Editor.
--
-- The booking server action (bookConsultationAction) already rejects
-- overlapping slots, but two clients submitting the same slot at the same
-- moment could both pass that check. This index makes the database the final
-- guard: a lawyer can hold only ONE active booking per start time.
-- The action maps the resulting unique violation (23505) to a friendly
-- "slot was just reserved" message.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_consultations_lawyer_active_start
  ON public.consultations (lawyer_id, scheduled_start)
  WHERE scheduled_start IS NOT NULL
    AND status IN ('pending', 'confirmed', 'awaiting_client_confirmation');

-- Speeds up the client's "My Consultations" list and conflict checks.
CREATE INDEX IF NOT EXISTS idx_consultations_client_start
  ON public.consultations (client_id, scheduled_start);

CREATE INDEX IF NOT EXISTS idx_consultations_lawyer_time
  ON public.consultations (lawyer_id, scheduled_time);

-- Speeds up "which documents can this lawyer see" lookups.
CREATE INDEX IF NOT EXISTS idx_document_access_grants_active
  ON public.document_access_grants (grantee_id, document_id)
  WHERE revoked_at IS NULL;
