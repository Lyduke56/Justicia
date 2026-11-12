-- Persist one verified review per completed consultation. Legacy rows are retained
-- for audit, but unlinked rows are excluded from public review lists.
BEGIN;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS consultation_id UUID REFERENCES public.consultations(id);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS counsel_reply TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS counsel_replied_at TIMESTAMPTZ;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS reviews_consultation_unique ON public.reviews(consultation_id);

-- Match the consultation's lawyer reference. Some deployed schemas still point
-- reviews at lawyer_profiles_legacy, which rejects reviews for current lawyers.
-- NOT VALID preserves historical rows while enforcing the FK on new writes.
DO $$
DECLARE
  target_table regclass;
  target_column name;
  old_constraint record;
BEGIN
  SELECT c.confrelid::regclass, target.attname INTO target_table, target_column
  FROM pg_constraint c
  JOIN pg_attribute source ON source.attrelid = c.conrelid AND source.attnum = c.conkey[1]
  JOIN pg_attribute target ON target.attrelid = c.confrelid AND target.attnum = c.confkey[1]
  WHERE c.conrelid = 'public.consultations'::regclass AND c.contype = 'f'
    AND source.attname = 'lawyer_id' AND array_length(c.conkey, 1) = 1;
  IF target_table IS NULL THEN
    RAISE EXCEPTION 'Consultations must have a lawyer foreign key before migrating reviews';
  END IF;
  FOR old_constraint IN
    SELECT c.conname FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'public.reviews'::regclass AND c.contype = 'f'
      AND a.attname = 'lawyer_id' AND array_length(c.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE public.reviews DROP CONSTRAINT %I', old_constraint.conname);
  END LOOP;
  EXECUTE format('ALTER TABLE public.reviews ADD CONSTRAINT reviews_lawyer_id_fkey FOREIGN KEY (lawyer_id) REFERENCES %s(%I) NOT VALID', target_table, target_column);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_consultation_review()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  caller_is_admin boolean := false;
BEGIN
  IF auth.role() = 'authenticated' AND to_regprocedure('public.is_admin()') IS NOT NULL THEN
    EXECUTE 'SELECT public.is_admin()' INTO caller_is_admin;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF auth.role() = 'authenticated' AND NEW.client_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Clients may only submit their own consultation reviews';
    END IF;
    IF NEW.consultation_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.consultations c
      WHERE c.id = NEW.consultation_id AND c.client_id = NEW.client_id
        AND c.lawyer_id = NEW.lawyer_id AND c.status = 'completed'
    ) THEN
      RAISE EXCEPTION 'A review requires a matching completed consultation';
    END IF;
  ELSIF NEW.consultation_id IS DISTINCT FROM OLD.consultation_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.lawyer_id IS DISTINCT FROM OLD.lawyer_id
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.comment IS DISTINCT FROM OLD.comment THEN
    RAISE EXCEPTION 'Submitted consultation reviews cannot be reassigned or changed';
  END IF;
  IF TG_OP = 'UPDATE' AND auth.role() = 'authenticated' AND NOT caller_is_admin THEN
    IF OLD.lawyer_id IS DISTINCT FROM auth.uid() OR NEW.is_hidden IS DISTINCT FROM OLD.is_hidden THEN
      RAISE EXCEPTION 'Only the reviewed lawyer may reply; moderation requires an administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_consultation_review ON public.reviews;
CREATE TRIGGER validate_consultation_review BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_consultation_review();

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_read_reviews ON public.reviews;
DROP POLICY IF EXISTS public_read_reviews ON public.reviews;
DROP POLICY IF EXISTS client_own_reviews ON public.reviews;
DROP POLICY IF EXISTS allow_insert_reviews ON public.reviews;
DROP POLICY IF EXISTS allow_update_reviews ON public.reviews;
DROP POLICY IF EXISTS completed_consultation_review_insert ON public.reviews;
DROP POLICY IF EXISTS counsel_reply_update ON public.reviews;
CREATE POLICY public_read_reviews ON public.reviews FOR SELECT USING (consultation_id IS NOT NULL AND NOT is_hidden);
CREATE POLICY completed_consultation_review_insert ON public.reviews FOR INSERT TO authenticated
WITH CHECK (client_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.consultations c WHERE c.id = consultation_id
    AND c.client_id = auth.uid() AND c.lawyer_id = reviews.lawyer_id AND c.status = 'completed'
));
CREATE POLICY counsel_reply_update ON public.reviews FOR UPDATE TO authenticated
USING (lawyer_id = auth.uid() AND consultation_id IS NOT NULL)
WITH CHECK (lawyer_id = auth.uid() AND consultation_id IS NOT NULL);
REVOKE INSERT, UPDATE, DELETE ON public.reviews FROM anon, authenticated;
GRANT INSERT (consultation_id, client_id, lawyer_id, rating, comment) ON public.reviews TO authenticated;
GRANT UPDATE (counsel_reply, counsel_replied_at, is_hidden) ON public.reviews TO authenticated;
-- Deletion remains limited by any existing administrator-only RLS policy.
GRANT DELETE ON public.reviews TO authenticated;
-- Repair the deployed rating-summary trigger for the current lawyer profile key.
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS rating_avg NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.lawyer_profiles ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.refresh_lawyer_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_lawyer uuid := COALESCE(NEW.lawyer_id, OLD.lawyer_id);
BEGIN
  UPDATE public.lawyer_profiles lp
  SET rating_avg = COALESCE((SELECT round(avg(r.rating)::numeric, 2) FROM public.reviews r
        WHERE r.lawyer_id = target_lawyer AND NOT r.is_hidden AND r.consultation_id IS NOT NULL), 0),
      rating_count = (SELECT count(*) FROM public.reviews r
        WHERE r.lawyer_id = target_lawyer AND NOT r.is_hidden AND r.consultation_id IS NOT NULL)
  WHERE lp.user_id = target_lawyer;
  RETURN NULL;
END;
$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.reviews'::regclass
    AND tgfoid = 'public.refresh_lawyer_rating()'::regprocedure AND NOT tgisinternal) THEN
    CREATE TRIGGER reviews_refresh_rating AFTER INSERT OR UPDATE OR DELETE ON public.reviews
      FOR EACH ROW EXECUTE FUNCTION public.refresh_lawyer_rating();
  END IF;
END;
$$;
COMMIT;
