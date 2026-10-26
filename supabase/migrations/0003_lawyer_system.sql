-- ============================================================
-- Justicia — Lawyer System Migration
-- File: supabase/migrations/0003_lawyer_system.sql
-- ============================================================
-- Idempotent where possible. Run via Supabase SQL Editor.
-- ============================================================

-- ─── Prerequisites: Extensions, Types & user_accounts table ──────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('client', 'lawyer', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_accounts (
  id                  UUID PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,
  full_name           TEXT,
  role                user_role NOT NULL DEFAULT 'client',
  verification_status verification_status NOT NULL DEFAULT 'pending',
  mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_row" ON public.user_accounts;
CREATE POLICY "users_own_row" ON public.user_accounts
  FOR ALL USING (auth.uid() = id);

-- ─── 0. Helper: is caller an admin? ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_accounts
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ─── 1. Profiles table (new schema — renames old stub) ────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lawyer_profiles'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lawyer_profiles' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.lawyer_profiles RENAME TO lawyer_profiles_legacy;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.lawyer_profiles (
  user_id               UUID PRIMARY KEY REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  full_name             TEXT NOT NULL,
  roll_number           TEXT NOT NULL UNIQUE,
  ibp_chapter           TEXT,
  about                 TEXT,
  practice_areas        TEXT[],
  languages             TEXT[],
  experience_years      INTEGER,
  photo_url             TEXT,
  is_available          BOOLEAN NOT NULL DEFAULT TRUE,
  is_visible            BOOLEAN NOT NULL DEFAULT TRUE,
  bar_passer_year       INTEGER,
  fee_initial_30min     NUMERIC(10,2),
  fee_standard_60min    NUMERIC(10,2),
  fee_extended_120min   NUMERIC(10,2),
  verification_status   TEXT NOT NULL DEFAULT 'draft'
    CHECK (verification_status IN ('draft','pending','approved','rejected','needs_resubmission')),
  admin_notes           TEXT,
  rejection_reason      TEXT,
  submitted_at          TIMESTAMPTZ,
  reviewed_by           UUID REFERENCES public.user_accounts(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure all columns exist even if table already existed
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS roll_number TEXT;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS ibp_chapter TEXT;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS about TEXT;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS practice_areas TEXT[];
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS languages TEXT[];
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS bar_passer_year INTEGER;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS fee_initial_30min NUMERIC(10,2);
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS fee_standard_60min NUMERIC(10,2);
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS fee_extended_120min NUMERIC(10,2);
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.user_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─── 2. Practice Areas Detail ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lawyer_practice_areas_detail (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id   UUID NOT NULL REFERENCES public.lawyer_profiles(user_id) ON DELETE CASCADE,
  area        TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. Experience ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lawyer_experience (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id    UUID NOT NULL REFERENCES public.lawyer_profiles(user_id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  organization TEXT,
  years        TEXT,
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 4. Services ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lawyer_services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id   UUID NOT NULL REFERENCES public.lawyer_profiles(user_id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 5. Education ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lawyer_education (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id   UUID NOT NULL REFERENCES public.lawyer_profiles(user_id) ON DELETE CASCADE,
  degree      TEXT NOT NULL,
  school      TEXT,
  start_year  INTEGER,
  end_year    INTEGER,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 6. Case Summaries (anonymized) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lawyer_case_summaries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id          UUID NOT NULL REFERENCES public.lawyer_profiles(user_id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  practice_area      TEXT,
  year               INTEGER,
  anonymized_summary TEXT NOT NULL,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 7. Verification Documents ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lawyer_verification_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id     UUID NOT NULL REFERENCES public.lawyer_profiles(user_id) ON DELETE CASCADE,
  doc_type      TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 8. Notifications (ensure table and all columns exist) ────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'info',
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  metadata    JSONB,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migrate legacy read_status to is_read if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'read_status'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE public.notifications RENAME COLUMN read_status TO is_read;
  END IF;
END;
$$;

-- Safely ensure every expected column exists regardless of pre-existing schema
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.user_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'info';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─── 9. Lawyer Favorites ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lawyer_favorites (
  client_id   UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  lawyer_id   UUID NOT NULL REFERENCES public.lawyer_profiles(user_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, lawyer_id)
);

-- ─── 10. Audit Log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.user_accounts(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 11. Email Outbox Dev ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_outbox_dev (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "to"       TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 12. Triggers ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lawyer_profiles_updated_at ON public.lawyer_profiles;
CREATE TRIGGER trg_lawyer_profiles_updated_at
  BEFORE UPDATE ON public.lawyer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_role_self_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF auth.uid() = OLD.id THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You cannot change your own role.';
    END IF;
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      RAISE EXCEPTION 'You cannot change your own verification status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_change ON public.user_accounts;
CREATE TRIGGER trg_prevent_role_self_change
  BEFORE UPDATE ON public.user_accounts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_change();

CREATE OR REPLACE FUNCTION public.handle_lawyer_credential_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.verification_status = 'approved'
     AND (NEW.roll_number IS DISTINCT FROM OLD.roll_number
          OR NEW.full_name IS DISTINCT FROM OLD.full_name)
  THEN
    NEW.verification_status = 'pending';
    NEW.submitted_at = now();
    NEW.reviewed_by = NULL;
    NEW.reviewed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lawyer_credential_edit ON public.lawyer_profiles;
CREATE TRIGGER trg_lawyer_credential_edit
  BEFORE UPDATE ON public.lawyer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_lawyer_credential_edit();

-- ─── 13. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_status_visible ON public.lawyer_profiles(verification_status, is_visible);
CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_chapter ON public.lawyer_profiles(ibp_chapter);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_lawyer_favorites_client ON public.lawyer_favorites(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

-- ─── 14. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.lawyer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_practice_areas_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_case_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox_dev ENABLE ROW LEVEL SECURITY;

-- lawyer_profiles policies
DROP POLICY IF EXISTS "lp_public_read_approved" ON public.lawyer_profiles;
CREATE POLICY "lp_public_read_approved" ON public.lawyer_profiles
  FOR SELECT USING (verification_status = 'approved' AND is_visible = TRUE);

DROP POLICY IF EXISTS "lp_lawyer_own_read" ON public.lawyer_profiles;
CREATE POLICY "lp_lawyer_own_read" ON public.lawyer_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "lp_lawyer_own_insert" ON public.lawyer_profiles;
CREATE POLICY "lp_lawyer_own_insert" ON public.lawyer_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lp_lawyer_own_update" ON public.lawyer_profiles;
CREATE POLICY "lp_lawyer_own_update" ON public.lawyer_profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND verification_status NOT IN ('approved', 'pending')
        OR (verification_status IN ('needs_resubmission', 'rejected', 'draft'))
  );

DROP POLICY IF EXISTS "lp_admin_all" ON public.lawyer_profiles;
CREATE POLICY "lp_admin_all" ON public.lawyer_profiles
  FOR ALL USING (public.is_admin());

-- Child table helper macro (practice_areas_detail)
DROP POLICY IF EXISTS "lpad_public_read" ON public.lawyer_practice_areas_detail;
CREATE POLICY "lpad_public_read" ON public.lawyer_practice_areas_detail
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lawyer_profiles lp
      WHERE lp.user_id = lawyer_id AND lp.verification_status = 'approved' AND lp.is_visible = TRUE)
  );
DROP POLICY IF EXISTS "lpad_lawyer_own" ON public.lawyer_practice_areas_detail;
CREATE POLICY "lpad_lawyer_own" ON public.lawyer_practice_areas_detail
  FOR ALL USING (auth.uid() = lawyer_id);
DROP POLICY IF EXISTS "lpad_admin" ON public.lawyer_practice_areas_detail;
CREATE POLICY "lpad_admin" ON public.lawyer_practice_areas_detail
  FOR ALL USING (public.is_admin());

-- experience
DROP POLICY IF EXISTS "le_public_read" ON public.lawyer_experience;
CREATE POLICY "le_public_read" ON public.lawyer_experience
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lawyer_profiles lp
      WHERE lp.user_id = lawyer_id AND lp.verification_status = 'approved' AND lp.is_visible = TRUE)
  );
DROP POLICY IF EXISTS "le_lawyer_own" ON public.lawyer_experience;
CREATE POLICY "le_lawyer_own" ON public.lawyer_experience FOR ALL USING (auth.uid() = lawyer_id);
DROP POLICY IF EXISTS "le_admin" ON public.lawyer_experience;
CREATE POLICY "le_admin" ON public.lawyer_experience FOR ALL USING (public.is_admin());

-- services
DROP POLICY IF EXISTS "ls_public_read" ON public.lawyer_services;
CREATE POLICY "ls_public_read" ON public.lawyer_services
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lawyer_profiles lp
      WHERE lp.user_id = lawyer_id AND lp.verification_status = 'approved' AND lp.is_visible = TRUE)
  );
DROP POLICY IF EXISTS "ls_lawyer_own" ON public.lawyer_services;
CREATE POLICY "ls_lawyer_own" ON public.lawyer_services FOR ALL USING (auth.uid() = lawyer_id);
DROP POLICY IF EXISTS "ls_admin" ON public.lawyer_services;
CREATE POLICY "ls_admin" ON public.lawyer_services FOR ALL USING (public.is_admin());

-- education
DROP POLICY IF EXISTS "leds_public_read" ON public.lawyer_education;
CREATE POLICY "leds_public_read" ON public.lawyer_education
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lawyer_profiles lp
      WHERE lp.user_id = lawyer_id AND lp.verification_status = 'approved' AND lp.is_visible = TRUE)
  );
DROP POLICY IF EXISTS "leds_lawyer_own" ON public.lawyer_education;
CREATE POLICY "leds_lawyer_own" ON public.lawyer_education FOR ALL USING (auth.uid() = lawyer_id);
DROP POLICY IF EXISTS "leds_admin" ON public.lawyer_education;
CREATE POLICY "leds_admin" ON public.lawyer_education FOR ALL USING (public.is_admin());

-- case_summaries
DROP POLICY IF EXISTS "lcs_public_read" ON public.lawyer_case_summaries;
CREATE POLICY "lcs_public_read" ON public.lawyer_case_summaries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lawyer_profiles lp
      WHERE lp.user_id = lawyer_id AND lp.verification_status = 'approved' AND lp.is_visible = TRUE)
  );
DROP POLICY IF EXISTS "lcs_lawyer_own" ON public.lawyer_case_summaries;
CREATE POLICY "lcs_lawyer_own" ON public.lawyer_case_summaries FOR ALL USING (auth.uid() = lawyer_id);
DROP POLICY IF EXISTS "lcs_admin" ON public.lawyer_case_summaries;
CREATE POLICY "lcs_admin" ON public.lawyer_case_summaries FOR ALL USING (public.is_admin());

-- verification_documents: PRIVATE
DROP POLICY IF EXISTS "lvd_owner" ON public.lawyer_verification_documents;
CREATE POLICY "lvd_owner" ON public.lawyer_verification_documents
  FOR ALL USING (auth.uid() = lawyer_id);
DROP POLICY IF EXISTS "lvd_admin" ON public.lawyer_verification_documents;
CREATE POLICY "lvd_admin" ON public.lawyer_verification_documents
  FOR ALL USING (public.is_admin());

-- notifications
DROP POLICY IF EXISTS "notif_own" ON public.notifications;
CREATE POLICY "notif_own" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_service" ON public.notifications;
CREATE POLICY "notif_service" ON public.notifications
  FOR INSERT WITH CHECK (TRUE); -- service role inserts notifications

-- lawyer_favorites
DROP POLICY IF EXISTS "fav_own" ON public.lawyer_favorites;
CREATE POLICY "fav_own" ON public.lawyer_favorites
  FOR ALL USING (auth.uid() = client_id);

-- audit_log: append-only, admins read
DROP POLICY IF EXISTS "audit_admin_read" ON public.audit_log;
CREATE POLICY "audit_admin_read" ON public.audit_log
  FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "audit_insert" ON public.audit_log;
CREATE POLICY "audit_insert" ON public.audit_log
  FOR INSERT WITH CHECK (TRUE);

-- email_outbox_dev
DROP POLICY IF EXISTS "email_dev_admin" ON public.email_outbox_dev;
CREATE POLICY "email_dev_admin" ON public.email_outbox_dev
  FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "email_dev_insert" ON public.email_outbox_dev;
CREATE POLICY "email_dev_insert" ON public.email_outbox_dev
  FOR INSERT WITH CHECK (TRUE);
