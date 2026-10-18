-- ============================================================
-- Justicia — Auth Improvements Migration
-- File: supabase/migrations/0002_auth_improvements.sql
-- ============================================================
-- Idempotent: safe to run multiple times.
-- Run via: supabase db push  (or paste into Supabase SQL Editor)
-- ============================================================

-- ─── 1. Add full_name to user_accounts ───────────────────────────────────────
ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS full_name TEXT;

-- ─── 2. Add phone / address columns (optional extras stored from register) ────
ALTER TABLE public.user_accounts
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- ─── 3. DB Trigger: auto-create user_accounts row when auth.users row is inserted
--    This fires on email/password signup AND social OAuth.
--    Uses raw_user_meta_data set during supabase.auth.signUp({ options: { data: {...} } })
-- ────────────────────────────────────────────────────────────────────────────

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

-- Drop trigger if it already exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 4. Back-fill full_name for any existing user_accounts rows that are null ─
UPDATE public.user_accounts ua
SET full_name = au.raw_user_meta_data->>'full_name'
FROM auth.users au
WHERE ua.id = au.id
  AND ua.full_name IS NULL
  AND au.raw_user_meta_data->>'full_name' IS NOT NULL;

-- ─── 5. legal_sources: add content + embedding columns for RAG pipeline ───────
--    Requires pgvector extension to be enabled first.
--    We add content here; embedding is added conditionally below.
ALTER TABLE public.legal_sources
  ADD COLUMN IF NOT EXISTS content TEXT;

-- Enable pgvector if not already enabled
-- NOTE: This will fail if the extension is not available in your Supabase plan.
-- If it fails, enable it manually in: Dashboard → Database → Extensions → vector
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgvector extension not available; skipping. Enable it in the Supabase Dashboard under Extensions.';
END;
$$;

-- Add embedding column only if pgvector is now available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    -- Add embedding column (1536 dims for text-embedding-004)
    ALTER TABLE public.legal_sources
      ADD COLUMN IF NOT EXISTS embedding vector(768);

    -- Create IVFFlat index for cosine similarity search
    -- NOTE: requires at least ~100 rows before it helps; safe to create now
    CREATE INDEX IF NOT EXISTS idx_legal_sources_embedding
      ON public.legal_sources
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 10);

    RAISE NOTICE 'pgvector enabled and embedding column added to legal_sources.';
  ELSE
    RAISE NOTICE 'pgvector not enabled; skipping embedding column. Enable and re-run this migration.';
  END IF;
END;
$$;

-- ─── 6. messages table: add role + citations columns for AI chat ──────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('user', 'assistant', 'system'));

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS citations JSONB;

-- ─── 7. RLS: add SELECT policy for messages so users can read their own ────────
--    (The existing policy only covers INSERT; users couldn't read their messages)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'messages' AND policyname = 'messages_participant_read'
  ) THEN
    CREATE POLICY "messages_participant_read" ON public.messages
      FOR SELECT USING (
        auth.uid() = sender_id
        OR conversation_or_thread_id IN (
          SELECT id FROM public.conversations WHERE user_id = auth.uid()
        )
      );
  END IF;
END;
$$;

-- ─── 8. reports: add INSERT policy so authenticated users can submit reports ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reports' AND policyname = 'reporter_insert'
  ) THEN
    CREATE POLICY "reporter_insert" ON public.reports
      FOR INSERT WITH CHECK (auth.uid() = reporter_id);
  END IF;
END;
$$;

-- ─── Done ─────────────────────────────────────────────────────────────────────
-- Summary of changes:
--   • user_accounts: + full_name TEXT, + phone TEXT
--   • auth.users trigger: auto-creates/upserts user_accounts row on signup
--   • legal_sources: + content TEXT, + embedding vector(768) [if pgvector available]
--   • messages: + role TEXT, + citations JSONB
--   • New RLS SELECT policy on messages
-- ============================================================
