-- ============================================================
-- Justicia — Supabase Initial Schema Migration
-- File: supabase/migrations/0001_init.sql
-- ============================================================
-- Run via: supabase db push   (or paste into Supabase SQL Editor)
-- Idempotent: safe to run multiple times.
-- ============================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ============================================================
-- ENUMS (Idempotent)
-- ============================================================

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

-- ============================================================
-- TABLE: user_accounts
-- Extends Supabase Auth. Role stored here (not just in auth.users.raw_user_meta_data)
-- for auditable, RLS-enforced RBAC.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL UNIQUE,
  role                user_role NOT NULL DEFAULT 'client',
  verification_status verification_status NOT NULL DEFAULT 'pending',
  mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_row" ON public.user_accounts;
CREATE POLICY "users_own_row" ON public.user_accounts
  FOR ALL USING (auth.uid() = id);

-- ============================================================
-- TABLE: lawyer_profiles (Initial stub - expanded in 0003)
-- One-to-one with user_accounts for role = 'lawyer'
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lawyer_profiles (
  lawyer_id             UUID PRIMARY KEY REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  verification_status   verification_status NOT NULL DEFAULT 'pending',
  bio                   TEXT,
  practice_areas        TEXT[],
  hourly_rate           NUMERIC(10,2),
  consultation_fees     JSONB,         -- e.g. { "initial": 500, "follow_up": 300 }
  availability_schedule JSONB,         -- weekly schedule { "monday": [...timeslots] }
  languages             TEXT[],
  location              TEXT,
  credentials           JSONB          -- IBP #, PRC ID, bar roll, certificates (storage refs)
);

ALTER TABLE public.lawyer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lawyers_own_profile" ON public.lawyer_profiles;
CREATE POLICY "lawyers_own_profile" ON public.lawyer_profiles
  FOR ALL USING (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "public_read_verified_profiles" ON public.lawyer_profiles;
CREATE POLICY "public_read_verified_profiles" ON public.lawyer_profiles
  FOR SELECT USING (verification_status = 'verified');

-- ============================================================
-- TABLE: legal_sources
-- Philippine statutes, codal provisions, SC decisions, IRRs.
-- Indexed for RAG retrieval (pgvector embeddings stored separately).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.legal_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  citation    TEXT NOT NULL,          -- e.g. "RA 386", "G.R. No. 12345"
  type        TEXT NOT NULL,          -- 'statute' | 'jurisprudence' | 'administrative'
  status      legal_source_status NOT NULL DEFAULT 'active',
  version     TEXT,
  indexed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_sources" ON public.legal_sources;
CREATE POLICY "authenticated_read_sources" ON public.legal_sources
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- TABLE: conversations
-- AI Legal Assistant conversation threads (per user).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  title      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_conversations" ON public.conversations;
CREATE POLICY "users_own_conversations" ON public.conversations
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TABLE: messages
-- Covers both AI conversation messages AND lawyer-client direct messages.
-- conversation_or_thread_id references either conversations.id or a thread UUID.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_or_thread_id  UUID NOT NULL,
  sender_id                  UUID NOT NULL REFERENCES public.user_accounts(id),
  content                    TEXT NOT NULL,
  attachment_ids             TEXT[],       -- References to Supabase Storage object paths
  sent_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_sender" ON public.messages;
CREATE POLICY "messages_sender" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ============================================================
-- TABLE: consultations
-- Booked video/audio consultations between clients and lawyers.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.consultations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES public.user_accounts(id),
  lawyer_id        UUID NOT NULL REFERENCES public.user_accounts(id),
  scheduled_time   TIMESTAMPTZ NOT NULL,
  method           consultation_method NOT NULL DEFAULT 'video',
  status           consultation_status NOT NULL DEFAULT 'pending',
  concern_summary  TEXT
);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_own_consultations" ON public.consultations;
CREATE POLICY "client_own_consultations" ON public.consultations
  FOR ALL USING (auth.uid() = client_id OR auth.uid() = lawyer_id);

-- ============================================================
-- TABLE: cases
-- Legal cases managed by lawyers on behalf of clients.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES public.user_accounts(id),
  lawyer_id    UUID NOT NULL REFERENCES public.user_accounts(id),
  title        TEXT NOT NULL,
  gr_number    TEXT,                  -- G.R. Number (if applicable)
  text_content TEXT,
  citations    JSONB,                 -- [{ sourceId, citation, excerpt }]
  version_tag  TEXT,
  status       TEXT NOT NULL DEFAULT 'active'
);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_participants" ON public.cases;
CREATE POLICY "case_participants" ON public.cases
  FOR ALL USING (auth.uid() = client_id OR auth.uid() = lawyer_id);

-- ============================================================
-- TABLE: documents
-- User-uploaded legal documents. Actual files in Supabase Storage "documents" bucket.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES public.user_accounts(id),
  case_id          UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  filename         TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  visibility_scope TEXT NOT NULL DEFAULT 'private',  -- 'private' | 'case' | 'public'
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_owner" ON public.documents;
CREATE POLICY "document_owner" ON public.documents
  FOR ALL USING (auth.uid() = owner_id);

-- ============================================================
-- TABLE: document_access_grants
-- Controls which other users can access a document (and at what level).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_access_grants (
  document_id  UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  grantee_id   UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'read',  -- 'read' | 'edit' | 'admin'
  PRIMARY KEY (document_id, grantee_id)
);

ALTER TABLE public.document_access_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grantee_read" ON public.document_access_grants;
CREATE POLICY "grantee_read" ON public.document_access_grants
  FOR SELECT USING (auth.uid() = grantee_id);

-- ============================================================
-- TABLE: reviews
-- Client reviews of lawyers after completed consultations.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES public.user_accounts(id),
  lawyer_id  UUID NOT NULL REFERENCES public.user_accounts(id),
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_reviews" ON public.reviews;
CREATE POLICY "authenticated_read_reviews" ON public.reviews
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "client_own_reviews" ON public.reviews;
CREATE POLICY "client_own_reviews" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = client_id);

-- ============================================================
-- TABLE: reports
-- User-submitted reports for moderation (users, reviews, messages).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      UUID NOT NULL REFERENCES public.user_accounts(id),
  target_type      TEXT NOT NULL,    -- 'user' | 'review' | 'message' | 'consultation'
  target_id        UUID NOT NULL,
  reason           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'under_review' | 'resolved' | 'dismissed'
  resolution_notes TEXT
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reporter_own_reports" ON public.reports;
CREATE POLICY "reporter_own_reports" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reporter_insert" ON public.reports;
CREATE POLICY "reporter_insert" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ============================================================
-- TABLE: payments
-- Payment records for consultation fees.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id   UUID NOT NULL REFERENCES public.consultations(id),
  payer_id          UUID NOT NULL REFERENCES public.user_accounts(id),
  payee_id          UUID NOT NULL REFERENCES public.user_accounts(id),
  amount            NUMERIC(12,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'completed' | 'failed' | 'refunded'
  masked_card_last4 TEXT
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_participants" ON public.payments;
CREATE POLICY "payment_participants" ON public.payments
  FOR SELECT USING (auth.uid() = payer_id OR auth.uid() = payee_id);

-- ============================================================
-- TABLE: notifications
-- In-app and email notifications.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'info',
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  metadata    JSONB,
  channel     notification_channel NOT NULL DEFAULT 'in_app',
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_notifications" ON public.notifications;
CREATE POLICY "own_notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TABLE: support_tickets
-- User-submitted support requests.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id      UUID NOT NULL REFERENCES public.user_accounts(id),
  category          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open',
  assigned_admin_id UUID REFERENCES public.user_accounts(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submitter_own_tickets" ON public.support_tickets;
CREATE POLICY "submitter_own_tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = submitter_id);

DROP POLICY IF EXISTS "submitter_insert" ON public.support_tickets;
CREATE POLICY "submitter_insert" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = submitter_id);

-- ============================================================
-- TABLE: audit_log_entries
-- Immutable audit trail of sensitive actions across the platform.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES public.user_accounts(id),
  actor_role  user_role NOT NULL,
  action      TEXT NOT NULL,        -- e.g. 'lawyer.verify', 'user.role_change', 'report.resolve'
  target_type TEXT NOT NULL,        -- e.g. 'user' | 'lawyer' | 'consultation' | 'payment'
  target_id   UUID NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_audit_log" ON public.audit_log_entries;
CREATE POLICY "admin_read_audit_log" ON public.audit_log_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_accounts
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- INDEXES (performance)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_accounts_role ON public.user_accounts(role);
CREATE INDEX IF NOT EXISTS idx_lawyer_profiles_verification ON public.lawyer_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON public.messages(conversation_or_thread_id);
CREATE INDEX IF NOT EXISTS idx_consultations_client_id ON public.consultations(client_id);
CREATE INDEX IF NOT EXISTS idx_consultations_lawyer_id ON public.consultations(lawyer_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON public.consultations(status);
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON public.documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents(case_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON public.audit_log_entries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log_entries(actor_id);
