-- ============================================================
-- Justicia Legal Platform - Migration 0006
-- Enhance reviews table: public read, counsel reply, seed reviews
-- ============================================================

-- 1. Ensure table exists
CREATE TABLE IF NOT EXISTS public.reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES public.user_accounts(id),
  lawyer_id  UUID NOT NULL REFERENCES public.user_accounts(id),
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add optional reply and helpful tracking columns
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS counsel_reply TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS counsel_replied_at TIMESTAMPTZ;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0;

-- 3. Row Level Security policies
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all reviews (anon & authenticated visitors)
DROP POLICY IF EXISTS "authenticated_read_reviews" ON public.reviews;
DROP POLICY IF EXISTS "public_read_reviews" ON public.reviews;
CREATE POLICY "public_read_reviews" ON public.reviews
  FOR SELECT USING (true);

-- Allow authenticated users and intake service to insert reviews
DROP POLICY IF EXISTS "client_own_reviews" ON public.reviews;
DROP POLICY IF EXISTS "allow_insert_reviews" ON public.reviews;
CREATE POLICY "allow_insert_reviews" ON public.reviews
  FOR INSERT WITH CHECK (true);

-- Allow counsel to update review with response
DROP POLICY IF EXISTS "allow_update_reviews" ON public.reviews;
CREATE POLICY "allow_update_reviews" ON public.reviews
  FOR UPDATE USING (true);

-- 4. Seed sample client users for review foreign keys
INSERT INTO public.user_accounts (id, email, full_name, role)
VALUES
  ('33333333-3333-4333-8333-000000000001', 'maria.garcia@justicia.ph', 'Maria Victoria Garcia', 'client'),
  ('33333333-3333-4333-8333-000000000002', 'ramon.dejesus@justicia.ph', 'Ramon De Jesus', 'client'),
  ('33333333-3333-4333-8333-000000000003', 'elena.santos@justicia.ph', 'Elena Santos', 'client'),
  ('33333333-3333-4333-8333-000000000004', 'dennis.tan@justicia.ph', 'Dennis Tan', 'client')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name;

-- 5. Seed initial realistic verified reviews for Atty. Maria Clara Santos (lawyer 1) & others
INSERT INTO public.reviews (id, client_id, lawyer_id, rating, comment, counsel_reply, created_at)
VALUES
  (
    '44444444-4444-4444-8444-000000000001',
    '33333333-3333-4333-8333-000000000001',
    '22222222-2222-4222-8222-000000000001',
    5,
    'Atty. is exceptionally thorough, patient, and knowledgeable about Philippine legal proceedings. Provided actionable advice right during our very first video consultation.',
    'Maraming salamat po, Ms. Garcia! Glad we could establish a clear path forward for your case.',
    NOW() - INTERVAL '12 days'
  ),
  (
    '44444444-4444-4444-8444-000000000002',
    '33333333-3333-4333-8333-000000000002',
    '22222222-2222-4222-8222-000000000001',
    5,
    'Highly recommended counsel. Handled our dispute settlement with utmost professionalism and attention to detail. Very fair professional fee.',
    'Thank you Mr. De Jesus. Always a pleasure helping protect your rights.',
    NOW() - INTERVAL '24 days'
  ),
  (
    '44444444-4444-4444-8444-000000000003',
    '33333333-3333-4333-8333-000000000003',
    '22222222-2222-4222-8222-000000000001',
    4,
    'Very helpful legal guidance regarding estate settlement. Straightforward advice and explained technical legal terms in simple terms we could easily understand.',
    NULL,
    NOW() - INTERVAL '38 days'
  ),
  (
    '44444444-4444-4444-8444-000000000004',
    '33333333-3333-4333-8333-000000000004',
    '22222222-2222-4222-8222-000000000002',
    5,
    'Superb labor law advice regarding my employment separation and NLRC procedure. Explained our labor code protections with clarity.',
    'Salamat Dennis. Praying for your favorable resolution.',
    NOW() - INTERVAL '15 days'
  )
ON CONFLICT (id) DO NOTHING;

