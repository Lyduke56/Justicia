-- ============================================================
-- Justicia — Complete Unified Database Setup
-- File: supabase/complete_setup.sql
-- ============================================================
-- 100% IDEMPOTENT: Safe to run on a brand-new project OR on an existing DB.
-- Paste this entire file into the Supabase SQL Editor and click "Run".
-- ============================================================

-- ─── 1. Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector extension not available; skipping. Enable it in the Supabase Dashboard under Extensions.';
END;
$$;

-- ─── 2. Custom Types / Enums ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('client', 'lawyer', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'legal_source_status') THEN
    CREATE TYPE legal_source_status AS ENUM ('active', 'outdated', 'superseded');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consultation_method') THEN
    CREATE TYPE consultation_method AS ENUM ('video', 'audio');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'consultation_status') THEN
    CREATE TYPE consultation_status AS ENUM (
      'pending',
      'confirmed',
      'awaiting_client_confirmation',
      'declined',
      'completed',
      'cancelled'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
    CREATE TYPE notification_channel AS ENUM ('in_app', 'email');
  END IF;
END;
$$;

-- ─── 3. User Accounts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL UNIQUE,
  full_name           TEXT,
  phone               TEXT,
  role                user_role NOT NULL DEFAULT 'client',
  verification_status verification_status NOT NULL DEFAULT 'pending',
  mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_row" ON public.user_accounts;
CREATE POLICY "users_own_row" ON public.user_accounts
  FOR ALL USING (auth.uid() = id);

-- ─── 4. Auth Sign-up Trigger ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_accounts (id, email, full_name, role, verification_status, mfa_enabled)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(
      CASE WHEN NEW.raw_user_meta_data->>'role' IN ('client', 'lawyer', 'admin')
           THEN (NEW.raw_user_meta_data->>'role')::user_role
           ELSE 'client'::user_role
      END,
      'client'::user_role
    ),
    'pending'::verification_status,
    FALSE
  )
  ON CONFLICT (id) DO UPDATE
    SET
      email      = EXCLUDED.email,
      full_name  = COALESCE(EXCLUDED.full_name, public.user_accounts.full_name),
      role       = COALESCE(EXCLUDED.role, public.user_accounts.role);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: Check if caller is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_accounts
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ─── 5. Lawyer Profiles ───────────────────────────────────────────────────────
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

-- ─── 6. Lawyer Child Tables ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lawyer_practice_areas_detail (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id   UUID NOT NULL REFERENCES public.lawyer_profiles(user_id) ON DELETE CASCADE,
  area        TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.lawyer_services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id   UUID NOT NULL REFERENCES public.lawyer_profiles(user_id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.lawyer_verification_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id     UUID NOT NULL REFERENCES public.lawyer_profiles(user_id) ON DELETE CASCADE,
  doc_type      TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 7. Notifications (Guaranteed is_read column) ─────────────────────────────
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

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.user_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'info';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─── 8. Favorites, Audit Log & Dev Outbox ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lawyer_favorites (
  client_id   UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  lawyer_id   UUID NOT NULL REFERENCES public.lawyer_profiles(user_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, lawyer_id)
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.user_accounts(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_outbox_dev (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "to"       TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',
  error      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 9. Core Justicia Platform Tables ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legal_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  citation    TEXT NOT NULL,
  type        TEXT NOT NULL,
  status      legal_source_status NOT NULL DEFAULT 'active',
  version     TEXT,
  content     TEXT,
  indexed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_sources ADD COLUMN IF NOT EXISTS content TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER TABLE public.legal_sources ADD COLUMN IF NOT EXISTS embedding vector(768);
    CREATE INDEX IF NOT EXISTS idx_legal_sources_embedding
      ON public.legal_sources USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  title      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_or_thread_id  UUID NOT NULL,
  sender_id                  UUID NOT NULL REFERENCES public.user_accounts(id),
  content                    TEXT NOT NULL,
  attachment_ids             TEXT[],
  role                       TEXT CHECK (role IN ('user', 'assistant', 'system')),
  citations                  JSONB,
  sent_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('user', 'assistant', 'system'));
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS citations JSONB;

CREATE TABLE IF NOT EXISTS public.consultations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES public.user_accounts(id),
  lawyer_id        UUID NOT NULL REFERENCES public.user_accounts(id),
  scheduled_time   TIMESTAMPTZ NOT NULL,
  method           consultation_method NOT NULL DEFAULT 'video',
  status           consultation_status NOT NULL DEFAULT 'pending',
  concern_summary  TEXT
);

CREATE TABLE IF NOT EXISTS public.cases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES public.user_accounts(id),
  lawyer_id    UUID NOT NULL REFERENCES public.user_accounts(id),
  title        TEXT NOT NULL,
  gr_number    TEXT,
  text_content TEXT,
  citations    JSONB,
  version_tag  TEXT,
  status       TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS public.documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES public.user_accounts(id),
  case_id          UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  filename         TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  visibility_scope TEXT NOT NULL DEFAULT 'private',
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_access_grants (
  document_id  UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  grantee_id   UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'read',
  PRIMARY KEY (document_id, grantee_id)
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES public.user_accounts(id),
  lawyer_id  UUID NOT NULL REFERENCES public.user_accounts(id),
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      UUID NOT NULL REFERENCES public.user_accounts(id),
  target_type      TEXT NOT NULL,
  target_id        UUID NOT NULL,
  reason           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open',
  resolution_notes TEXT
);

CREATE TABLE IF NOT EXISTS public.payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id   UUID NOT NULL REFERENCES public.consultations(id),
  payer_id          UUID NOT NULL REFERENCES public.user_accounts(id),
  payee_id          UUID NOT NULL REFERENCES public.user_accounts(id),
  amount            NUMERIC(12,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  masked_card_last4 TEXT
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id      UUID NOT NULL REFERENCES public.user_accounts(id),
  category          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open',
  assigned_admin_id UUID REFERENCES public.user_accounts(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES public.user_accounts(id),
  actor_role  user_role NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   UUID NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 10. Triggers ─────────────────────────────────────────────────────────────
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

-- ─── 11. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_accounts_role ON public.user_accounts(role);
CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_status_visible ON public.lawyer_profiles(verification_status, is_visible);
CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_chapter ON public.lawyer_profiles(ibp_chapter);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_lawyer_favorites_client ON public.lawyer_favorites(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON public.messages(conversation_or_thread_id);
CREATE INDEX IF NOT EXISTS idx_consultations_client_id ON public.consultations(client_id);
CREATE INDEX IF NOT EXISTS idx_consultations_lawyer_id ON public.consultations(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON public.consultations(status);
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON public.documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents(case_id);

-- ─── 12. Row Level Security (RLS) ─────────────────────────────────────────────
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
ALTER TABLE public.legal_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_entries ENABLE ROW LEVEL SECURITY;

-- Lawyer Profiles Policies
DROP POLICY IF EXISTS "lawyer_profiles_public_select" ON public.lawyer_profiles;
CREATE POLICY "lawyer_profiles_public_select" ON public.lawyer_profiles
  FOR SELECT USING (verification_status = 'approved' AND is_visible = TRUE);

DROP POLICY IF EXISTS "lawyer_profiles_own_all" ON public.lawyer_profiles;
CREATE POLICY "lawyer_profiles_own_all" ON public.lawyer_profiles
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "lawyer_profiles_admin_all" ON public.lawyer_profiles;
CREATE POLICY "lawyer_profiles_admin_all" ON public.lawyer_profiles
  FOR ALL USING (public.is_admin());

-- Lawyer Practice Areas Detail Policies
DROP POLICY IF EXISTS "lpad_public_select" ON public.lawyer_practice_areas_detail;
CREATE POLICY "lpad_public_select" ON public.lawyer_practice_areas_detail
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lawyer_profiles lp
      WHERE lp.user_id = lawyer_id AND lp.verification_status = 'approved' AND lp.is_visible = TRUE)
  );

DROP POLICY IF EXISTS "lpad_own_all" ON public.lawyer_practice_areas_detail;
CREATE POLICY "lpad_own_all" ON public.lawyer_practice_areas_detail
  FOR ALL USING (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "lpad_admin" ON public.lawyer_practice_areas_detail;
CREATE POLICY "lpad_admin" ON public.lawyer_practice_areas_detail
  FOR ALL USING (public.is_admin());

-- Lawyer Experience Policies
DROP POLICY IF EXISTS "lexp_public_select" ON public.lawyer_experience;
CREATE POLICY "lexp_public_select" ON public.lawyer_experience
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lawyer_profiles lp
      WHERE lp.user_id = lawyer_id AND lp.verification_status = 'approved' AND lp.is_visible = TRUE)
  );

DROP POLICY IF EXISTS "lexp_own_all" ON public.lawyer_experience;
CREATE POLICY "lexp_own_all" ON public.lawyer_experience
  FOR ALL USING (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "lexp_admin" ON public.lawyer_experience;
CREATE POLICY "lexp_admin" ON public.lawyer_experience
  FOR ALL USING (public.is_admin());

-- Lawyer Services Policies
DROP POLICY IF EXISTS "lserv_public_select" ON public.lawyer_services;
CREATE POLICY "lserv_public_select" ON public.lawyer_services
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lawyer_profiles lp
      WHERE lp.user_id = lawyer_id AND lp.verification_status = 'approved' AND lp.is_visible = TRUE)
  );

DROP POLICY IF EXISTS "lserv_own_all" ON public.lawyer_services;
CREATE POLICY "lserv_own_all" ON public.lawyer_services
  FOR ALL USING (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "lserv_admin" ON public.lawyer_services;
CREATE POLICY "lserv_admin" ON public.lawyer_services
  FOR ALL USING (public.is_admin());

-- Lawyer Education Policies
DROP POLICY IF EXISTS "ledu_public_select" ON public.lawyer_education;
CREATE POLICY "ledu_public_select" ON public.lawyer_education
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lawyer_profiles lp
      WHERE lp.user_id = lawyer_id AND lp.verification_status = 'approved' AND lp.is_visible = TRUE)
  );

DROP POLICY IF EXISTS "ledu_own_all" ON public.lawyer_education;
CREATE POLICY "ledu_own_all" ON public.lawyer_education
  FOR ALL USING (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "ledu_admin" ON public.lawyer_education;
CREATE POLICY "ledu_admin" ON public.lawyer_education
  FOR ALL USING (public.is_admin());

-- Lawyer Case Summaries Policies
DROP POLICY IF EXISTS "lcase_public_select" ON public.lawyer_case_summaries;
CREATE POLICY "lcase_public_select" ON public.lawyer_case_summaries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lawyer_profiles lp
      WHERE lp.user_id = lawyer_id AND lp.verification_status = 'approved' AND lp.is_visible = TRUE)
  );

DROP POLICY IF EXISTS "lcase_own_all" ON public.lawyer_case_summaries;
CREATE POLICY "lcase_own_all" ON public.lawyer_case_summaries
  FOR ALL USING (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "lcase_admin" ON public.lawyer_case_summaries;
CREATE POLICY "lcase_admin" ON public.lawyer_case_summaries
  FOR ALL USING (public.is_admin());

-- Lawyer Verification Documents Policies
DROP POLICY IF EXISTS "lvd_own" ON public.lawyer_verification_documents;
CREATE POLICY "lvd_own" ON public.lawyer_verification_documents
  FOR ALL USING (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "lvd_admin" ON public.lawyer_verification_documents;
CREATE POLICY "lvd_admin" ON public.lawyer_verification_documents
  FOR ALL USING (public.is_admin());

-- Notifications Policies
DROP POLICY IF EXISTS "notif_own" ON public.notifications;
CREATE POLICY "notif_own" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_service" ON public.notifications;
CREATE POLICY "notif_service" ON public.notifications
  FOR INSERT WITH CHECK (TRUE);

-- Lawyer Favorites Policies
DROP POLICY IF EXISTS "fav_own" ON public.lawyer_favorites;
CREATE POLICY "fav_own" ON public.lawyer_favorites
  FOR ALL USING (auth.uid() = client_id);

-- Audit Log Policies
DROP POLICY IF EXISTS "audit_admin_read" ON public.audit_log;
CREATE POLICY "audit_admin_read" ON public.audit_log
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "audit_insert" ON public.audit_log;
CREATE POLICY "audit_insert" ON public.audit_log
  FOR INSERT WITH CHECK (TRUE);

-- Dev Email Outbox Policies
DROP POLICY IF EXISTS "email_dev_admin" ON public.email_outbox_dev;
CREATE POLICY "email_dev_admin" ON public.email_outbox_dev
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "email_dev_insert" ON public.email_outbox_dev;
CREATE POLICY "email_dev_insert" ON public.email_outbox_dev
  FOR INSERT WITH CHECK (TRUE);

-- Other Core Tables Policies
DROP POLICY IF EXISTS "authenticated_read_sources" ON public.legal_sources;
CREATE POLICY "authenticated_read_sources" ON public.legal_sources
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users_own_conversations" ON public.conversations;
CREATE POLICY "users_own_conversations" ON public.conversations
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "messages_sender" ON public.messages;
CREATE POLICY "messages_sender" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_participant_read" ON public.messages;
CREATE POLICY "messages_participant_read" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id
    OR conversation_or_thread_id IN (
      SELECT id FROM public.conversations WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "client_own_consultations" ON public.consultations;
CREATE POLICY "client_own_consultations" ON public.consultations
  FOR ALL USING (auth.uid() = client_id OR auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "case_participants" ON public.cases;
CREATE POLICY "case_participants" ON public.cases
  FOR ALL USING (auth.uid() = client_id OR auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "document_owner" ON public.documents;
CREATE POLICY "document_owner" ON public.documents
  FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "grantee_read" ON public.document_access_grants;
CREATE POLICY "grantee_read" ON public.document_access_grants
  FOR SELECT USING (auth.uid() = grantee_id);

DROP POLICY IF EXISTS "authenticated_read_reviews" ON public.reviews;
CREATE POLICY "authenticated_read_reviews" ON public.reviews
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "client_own_reviews" ON public.reviews;
CREATE POLICY "client_own_reviews" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "reporter_own_reports" ON public.reports;
CREATE POLICY "reporter_own_reports" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reporter_insert" ON public.reports;
CREATE POLICY "reporter_insert" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "payment_participants" ON public.payments;
CREATE POLICY "payment_participants" ON public.payments
  FOR SELECT USING (auth.uid() = payer_id OR auth.uid() = payee_id);

DROP POLICY IF EXISTS "submitter_own_tickets" ON public.support_tickets;
CREATE POLICY "submitter_own_tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = submitter_id);

DROP POLICY IF EXISTS "submitter_insert" ON public.support_tickets;
CREATE POLICY "submitter_insert" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = submitter_id);

DROP POLICY IF EXISTS "admin_read_audit_log" ON public.audit_log_entries;
CREATE POLICY "admin_read_audit_log" ON public.audit_log_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_accounts
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
