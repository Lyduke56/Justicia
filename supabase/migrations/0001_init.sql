-- ============================================================
-- Justicia — Supabase Initial Schema Migration
-- File: supabase/migrations/0001_init.sql
-- ============================================================
-- Run via: supabase db push   (or paste into Supabase SQL Editor)
-- ============================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('client', 'lawyer', 'admin');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE legal_source_status AS ENUM ('active', 'outdated', 'superseded');
CREATE TYPE consultation_method AS ENUM ('video', 'audio');
CREATE TYPE consultation_status AS ENUM (
  'pending',
  'confirmed',
  'awaiting_client_confirmation',
  'declined',
  'completed',
  'cancelled'
);
CREATE TYPE notification_channel AS ENUM ('in_app', 'email');

-- ============================================================
-- TABLE: user_accounts
-- Extends Supabase Auth. Role stored here (not just in auth.users.raw_user_meta_data)
-- for auditable, RLS-enforced RBAC.
-- ============================================================

CREATE TABLE public.user_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL UNIQUE,
  role                user_role NOT NULL DEFAULT 'client',
  verification_status verification_status NOT NULL DEFAULT 'pending',
  mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
-- TODO: RLS policy — users can read/update their own row
-- TODO: RLS policy — admins can read/update all rows
-- Example (permissive dev policy — replace with restrictive policies before production):
CREATE POLICY "users_own_row" ON public.user_accounts
  FOR ALL USING (auth.uid() = id);

-- ============================================================
-- TABLE: lawyer_profiles
-- One-to-one with user_accounts for role = 'lawyer'
-- ============================================================

CREATE TABLE public.lawyer_profiles (
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
-- TODO: RLS policy — lawyers can update their own profile
-- TODO: RLS policy — clients/public can read verified lawyer profiles
CREATE POLICY "lawyers_own_profile" ON public.lawyer_profiles
  FOR ALL USING (auth.uid() = lawyer_id);
CREATE POLICY "public_read_verified_profiles" ON public.lawyer_profiles
  FOR SELECT USING (verification_status = 'verified');

-- ============================================================
-- TABLE: legal_sources
-- Philippine statutes, codal provisions, SC decisions, IRRs.
-- Indexed for RAG retrieval (pgvector embeddings stored separately).
-- ============================================================

CREATE TABLE public.legal_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  citation    TEXT NOT NULL,          -- e.g. "RA 386", "G.R. No. 12345"
  type        TEXT NOT NULL,          -- 'statute' | 'jurisprudence' | 'administrative'
  status      legal_source_status NOT NULL DEFAULT 'active',
  version     TEXT,
  indexed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_sources ENABLE ROW LEVEL SECURITY;
-- TODO: RLS policy — all authenticated users can read active sources
-- TODO: RLS policy — only admins can insert/update/delete
CREATE POLICY "authenticated_read_sources" ON public.legal_sources
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- TABLE: conversations
-- AI Legal Assistant conversation threads (per user).
-- ============================================================

CREATE TABLE public.conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  title      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
-- TODO: RLS policy — users can only access their own conversations
CREATE POLICY "users_own_conversations" ON public.conversations
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TABLE: messages
-- Covers both AI conversation messages AND lawyer-client direct messages.
-- conversation_or_thread_id references either conversations.id or a thread UUID.
-- ============================================================

CREATE TABLE public.messages (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_or_thread_id  UUID NOT NULL,
  sender_id                  UUID NOT NULL REFERENCES public.user_accounts(id),
  content                    TEXT NOT NULL,
  attachment_ids             TEXT[],       -- References to Supabase Storage object paths
  sent_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
-- TODO: RLS policy — users can only read messages in conversations/threads they are part of
-- TODO: RLS policy — users can only insert messages as themselves (sender_id = auth.uid())
CREATE POLICY "messages_sender" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ============================================================
-- TABLE: consultations
-- Booked video/audio consultations between clients and lawyers.
-- ============================================================

CREATE TABLE public.consultations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES public.user_accounts(id),
  lawyer_id        UUID NOT NULL REFERENCES public.user_accounts(id),
  scheduled_time   TIMESTAMPTZ NOT NULL,
  method           consultation_method NOT NULL DEFAULT 'video',
  status           consultation_status NOT NULL DEFAULT 'pending',
  concern_summary  TEXT
);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
-- TODO: RLS policy — clients see their own consultations
-- TODO: RLS policy — lawyers see consultations assigned to them
-- TODO: RLS policy — admins see all
CREATE POLICY "client_own_consultations" ON public.consultations
  FOR ALL USING (auth.uid() = client_id OR auth.uid() = lawyer_id);

-- ============================================================
-- TABLE: cases
-- Legal cases managed by lawyers on behalf of clients.
-- ============================================================

CREATE TABLE public.cases (
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
-- TODO: RLS policy — clients and their assigned lawyers can access their shared cases
CREATE POLICY "case_participants" ON public.cases
  FOR ALL USING (auth.uid() = client_id OR auth.uid() = lawyer_id);

-- ============================================================
-- TABLE: documents
-- User-uploaded legal documents. Actual files in Supabase Storage "documents" bucket.
-- ============================================================

CREATE TABLE public.documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES public.user_accounts(id),
  case_id          UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  filename         TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  visibility_scope TEXT NOT NULL DEFAULT 'private',  -- 'private' | 'case' | 'public'
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
-- TODO: RLS policy — owners always have access
-- TODO: RLS policy — granted users can access based on document_access_grants
CREATE POLICY "document_owner" ON public.documents
  FOR ALL USING (auth.uid() = owner_id);

-- ============================================================
-- TABLE: document_access_grants
-- Controls which other users can access a document (and at what level).
-- ============================================================

CREATE TABLE public.document_access_grants (
  document_id  UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  grantee_id   UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'read',  -- 'read' | 'edit' | 'admin'
  PRIMARY KEY (document_id, grantee_id)
);

ALTER TABLE public.document_access_grants ENABLE ROW LEVEL SECURITY;
-- TODO: RLS policy — document owners can manage grants
-- TODO: RLS policy — grantees can read their own grants
CREATE POLICY "grantee_read" ON public.document_access_grants
  FOR SELECT USING (auth.uid() = grantee_id);

-- ============================================================
-- TABLE: reviews
-- Client reviews of lawyers after completed consultations.
-- ============================================================

CREATE TABLE public.reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES public.user_accounts(id),
  lawyer_id  UUID NOT NULL REFERENCES public.user_accounts(id),
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
-- TODO: RLS policy — client can insert/update their own reviews
-- TODO: RLS policy — all authenticated users can read reviews (public ratings)
CREATE POLICY "authenticated_read_reviews" ON public.reviews
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "client_own_reviews" ON public.reviews
  FOR INSERT WITH CHECK (auth.uid() = client_id);

-- ============================================================
-- TABLE: reports
-- User-submitted reports for moderation (users, reviews, messages).
-- ============================================================

CREATE TABLE public.reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      UUID NOT NULL REFERENCES public.user_accounts(id),
  target_type      TEXT NOT NULL,    -- 'user' | 'review' | 'message' | 'consultation'
  target_id        UUID NOT NULL,
  reason           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'under_review' | 'resolved' | 'dismissed'
  resolution_notes TEXT
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
-- TODO: RLS policy — reporters can see their own reports
-- TODO: RLS policy — admins can see and update all reports
CREATE POLICY "reporter_own_reports" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "reporter_insert" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ============================================================
-- TABLE: payments
-- Payment records for consultation fees.
-- ============================================================

CREATE TABLE public.payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id   UUID NOT NULL REFERENCES public.consultations(id),
  payer_id          UUID NOT NULL REFERENCES public.user_accounts(id),
  payee_id          UUID NOT NULL REFERENCES public.user_accounts(id),
  amount            NUMERIC(12,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'completed' | 'failed' | 'refunded'
  masked_card_last4 TEXT
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
-- TODO: RLS policy — payer and payee can see their own payment records
-- TODO: RLS policy — admins can see all payments
CREATE POLICY "payment_participants" ON public.payments
  FOR SELECT USING (auth.uid() = payer_id OR auth.uid() = payee_id);

-- ============================================================
-- TABLE: notifications
-- In-app and email notifications.
-- ============================================================

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  channel     notification_channel NOT NULL DEFAULT 'in_app',
  read_status BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
-- TODO: RLS policy — users can only see their own notifications
CREATE POLICY "own_notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TABLE: support_tickets
-- User-submitted support requests.
-- ============================================================

CREATE TABLE public.support_tickets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id      UUID NOT NULL REFERENCES public.user_accounts(id),
  category          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open',
  assigned_admin_id UUID REFERENCES public.user_accounts(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
-- TODO: RLS policy — submitters can see their own tickets
-- TODO: RLS policy — admins can see and update all tickets
CREATE POLICY "submitter_own_tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = submitter_id);
CREATE POLICY "submitter_insert" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = submitter_id);

-- ============================================================
-- TABLE: audit_log_entries
-- Immutable audit trail of sensitive actions across the platform.
-- IMPORTANT: No UPDATE or DELETE RLS policies — this table is append-only.
-- ============================================================

CREATE TABLE public.audit_log_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES public.user_accounts(id),
  actor_role  user_role NOT NULL,
  action      TEXT NOT NULL,        -- e.g. 'lawyer.verify', 'user.role_change', 'report.resolve'
  target_type TEXT NOT NULL,        -- e.g. 'user' | 'lawyer' | 'consultation' | 'payment'
  target_id   UUID NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log_entries ENABLE ROW LEVEL SECURITY;
-- TODO: RLS policy — only admins can read audit logs
-- TODO: RLS policy — only system/service role can insert (use service role key in API routes)
-- TODO: REVOKE DELETE, UPDATE on audit_log_entries from all roles (immutability guarantee)
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

CREATE INDEX idx_user_accounts_role ON public.user_accounts(role);
CREATE INDEX idx_lawyer_profiles_verification ON public.lawyer_profiles(verification_status);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_messages_thread_id ON public.messages(conversation_or_thread_id);
CREATE INDEX idx_consultations_client_id ON public.consultations(client_id);
CREATE INDEX idx_consultations_lawyer_id ON public.consultations(lawyer_id);
CREATE INDEX idx_consultations_status ON public.consultations(status);
CREATE INDEX idx_documents_owner_id ON public.documents(owner_id);
CREATE INDEX idx_documents_case_id ON public.documents(case_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id, read_status);
CREATE INDEX idx_audit_log_timestamp ON public.audit_log_entries(timestamp DESC);
CREATE INDEX idx_audit_log_actor ON public.audit_log_entries(actor_id);

-- ============================================================
-- NOTE: pgvector extension for RAG embeddings
-- Uncomment when enabling the AI retrieval pipeline:
-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE public.legal_sources ADD COLUMN embedding vector(1536);
-- CREATE INDEX idx_legal_sources_embedding ON public.legal_sources USING ivfflat (embedding vector_cosine_ops);
-- ============================================================
