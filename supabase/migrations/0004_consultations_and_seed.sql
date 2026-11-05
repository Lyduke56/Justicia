-- ============================================================
-- Justicia — Consultation Booking, Payments & Lawyer Seed
-- File: supabase/migrations/0004_consultations_and_seed.sql
-- ============================================================
-- 100% IDEMPOTENT: Safe to run repeatedly in Supabase SQL Editor.
-- ============================================================

-- ─── 1. Prerequisites: Extensions & Types ────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('client', 'lawyer', 'admin');
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
END;
$$;

-- ─── 2. User Accounts Table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_accounts (
  id                  UUID PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,
  full_name           TEXT,
  phone               TEXT,
  role                user_role NOT NULL DEFAULT 'client',
  mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_accounts_read_all" ON public.user_accounts;
CREATE POLICY "user_accounts_read_all" ON public.user_accounts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_own_row" ON public.user_accounts;
CREATE POLICY "users_own_row" ON public.user_accounts
  FOR ALL USING (auth.uid() = id);

-- ─── 3. Lawyer Profiles Table ────────────────────────────────────────────────
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
  verification_status   TEXT NOT NULL DEFAULT 'draft',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lawyer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lawyer_profiles_read_public" ON public.lawyer_profiles;
CREATE POLICY "lawyer_profiles_read_public" ON public.lawyer_profiles
  FOR SELECT USING (true);

-- ─── 4. Consultations Table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consultations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  lawyer_id        UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  scheduled_time   TIMESTAMPTZ NOT NULL,
  method           consultation_method NOT NULL DEFAULT 'video',
  status           consultation_status NOT NULL DEFAULT 'pending',
  concern_summary  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consultations_participants_all" ON public.consultations;
CREATE POLICY "consultations_participants_all" ON public.consultations
  FOR ALL USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR auth.role() = 'service_role');

-- ─── 5. Payments Table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id   UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  payer_id          UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  payee_id          UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  amount            NUMERIC(12,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  masked_card_last4 TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_participants_all" ON public.payments;
CREATE POLICY "payments_participants_all" ON public.payments
  FOR ALL USING (auth.uid() = payer_id OR auth.uid() = payee_id OR auth.role() = 'service_role');

-- ─── 6. Documents Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  case_id          UUID,
  filename         TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  visibility_scope TEXT NOT NULL DEFAULT 'private',
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_owner_all" ON public.documents;
CREATE POLICY "documents_owner_all" ON public.documents
  FOR ALL USING (auth.uid() = owner_id OR auth.role() = 'service_role');

-- ─── 7. Notifications Table ──────────────────────────────────────────────────
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

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_recipient_all" ON public.notifications;
CREATE POLICY "notifications_recipient_all" ON public.notifications
  FOR ALL USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- ─── 8. Conversations & Messages Tables ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_user_all" ON public.conversations;
CREATE POLICY "conversations_user_all" ON public.conversations
  FOR ALL USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.messages (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_or_thread_id  UUID NOT NULL,
  sender_id                  UUID NOT NULL REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  content                    TEXT NOT NULL,
  role                       TEXT DEFAULT 'user',
  attachment_ids             TEXT[],
  citations                  JSONB,
  sent_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_all_access" ON public.messages;
CREATE POLICY "messages_all_access" ON public.messages
  FOR ALL USING (auth.uid() = sender_id OR auth.role() = 'service_role');

-- ─── 9. Seed Directory Lawyers ───────────────────────────────────────────────
INSERT INTO public.user_accounts (id, email, full_name, role)
VALUES
  ('22222222-2222-4222-8222-000000000001', 'atty.santos@justicia.ph', 'Atty. Maria Clara Santos', 'lawyer'),
  ('22222222-2222-4222-8222-000000000002', 'atty.delacruz@justicia.ph', 'Atty. Juan Carlos Dela Cruz', 'lawyer'),
  ('22222222-2222-4222-8222-000000000003', 'atty.deleon@justicia.ph', 'Atty. Jose Maria De Leon', 'lawyer'),
  ('22222222-2222-4222-8222-000000000004', 'atty.reyes@justicia.ph', 'Atty. Clara Isabella Reyes', 'lawyer'),
  ('22222222-2222-4222-8222-000000000005', 'atty.tan@justicia.ph', 'Atty. Roberto Emilio Tan', 'lawyer'),
  ('22222222-2222-4222-8222-000000000006', 'atty.bautista@justicia.ph', 'Atty. Ramon Manuel Bautista', 'lawyer'),
  ('22222222-2222-4222-8222-000000000007', 'atty.valdez@justicia.ph', 'Atty. Katrina Isabel Valdez', 'lawyer'),
  ('22222222-2222-4222-8222-000000000008', 'atty.lim@justicia.ph', 'Atty. Gerardo Patrick Lim', 'lawyer')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

INSERT INTO public.lawyer_profiles (
  user_id, full_name, roll_number, ibp_chapter, about, practice_areas, languages,
  experience_years, fee_initial_30min, fee_standard_60min, fee_extended_120min,
  bar_passer_year, verification_status, is_visible, is_available
)
VALUES
  (
    '22222222-2222-4222-8222-000000000001',
    'Atty. Maria Clara Santos',
    '54821',
    'Pasig-San Juan-Mandaluyong',
    'Specializing in Family Law, Estate Planning, and Civil Litigation with over a decade of practice before the trial and appellate courts.',
    ARRAY['Family Law', 'Estate Planning', 'Civil Litigation', 'Civil Law'],
    ARRAY['Filipino', 'English'],
    18, 1500, 2500, 4500, 2008, 'approved', true, true
  ),
  (
    '22222222-2222-4222-8222-000000000002',
    'Atty. Juan Carlos Dela Cruz',
    '59144',
    'NCR — Quezon City',
    'Senior labor litigator with extensive experience in NLRC arbitrations, collective bargaining agreements, and wrongful termination defense.',
    ARRAY['Labor & Employment', 'Civil Law', 'Commercial Law'],
    ARRAY['Tagalog', 'English', 'Ilocano'],
    16, 1200, 2200, 4000, 2010, 'approved', true, true
  ),
  (
    '22222222-2222-4222-8222-000000000003',
    'Atty. Jose Maria De Leon',
    '61209',
    'Cebu City Chapter',
    'Cebu-based maritime and commercial law practitioner assisting local enterprises and seafarers with labor standards and maritime arbitration.',
    ARRAY['Labor & Employment', 'Maritime Law', 'Commercial Law', 'Civil Law'],
    ARRAY['Cebuano', 'Filipino', 'English'],
    13, 1200, 2200, 4000, 2013, 'approved', true, true
  ),
  (
    '22222222-2222-4222-8222-000000000004',
    'Atty. Clara Isabella Reyes',
    '52188',
    'Cebu',
    'Advising private individuals and developers on Land Registration Act compliance, Torrens title verification, and complex probate settlements in the Visayas.',
    ARRAY['Real Estate', 'Civil Law', 'Estate Planning'],
    ARRAY['Cebuano', 'English', 'Tagalog'],
    15, 2000, 3500, 6000, 2011, 'approved', true, true
  ),
  (
    '22222222-2222-4222-8222-000000000005',
    'Atty. Roberto Emilio Tan',
    '63412',
    'NCR — Manila',
    'Focused on tech startups, SEC registration compliance, trademark filings with the Intellectual Property Office, and BIR tax audits.',
    ARRAY['Corporate Law', 'Tax Law', 'Intellectual Property'],
    ARRAY['Tagalog', 'English', 'Mandarin'],
    11, 1200, 2200, 4000, 2015, 'approved', true, true
  ),
  (
    '22222222-2222-4222-8222-000000000006',
    'Atty. Ramon Manuel Bautista',
    '65890',
    'Quezon City Chapter',
    'Trial criminal defense counsel handling bail hearings, preliminary investigations, and white-collar defense.',
    ARRAY['Criminal Law', 'Civil Litigation', 'Litigation'],
    ARRAY['Filipino', 'English'],
    9, 1000, 1800, 3500, 2017, 'approved', true, true
  ),
  (
    '22222222-2222-4222-8222-000000000007',
    'Atty. Katrina Isabel Valdez',
    '68923',
    'Makati City Chapter',
    'Specialist in labor relations, employment contracts, and workplace dispute mediation.',
    ARRAY['Labor & Employment', 'Corporate Law', 'Civil Law'],
    ARRAY['English', 'Filipino'],
    8, 1000, 1800, 3200, 2018, 'approved', true, true
  ),
  (
    '22222222-2222-4222-8222-000000000008',
    'Atty. Gerardo Patrick Lim',
    '51092',
    'Davao City Chapter',
    'Agrarian reform, land title disputes, and ancestral domain legal assistance across Mindanao.',
    ARRAY['Real Estate', 'Agrarian Reform', 'Civil Law'],
    ARRAY['Cebuano', 'Filipino', 'English'],
    14, 1500, 2500, 4500, 2012, 'approved', true, true
  )
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  verification_status = 'approved',
  is_visible = true,
  is_available = true;
