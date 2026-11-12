# Justicia — Supabase Configuration Guide

## Database Migrations

Run the initial schema migration:

```bash
# If using Supabase CLI
supabase db push

# Or paste supabase/migrations/0001_init.sql directly into the Supabase Dashboard SQL Editor
```

---

## Storage Buckets

### `documents` bucket

Create this bucket in the Supabase Dashboard → Storage → New Bucket:

| Setting | Value |
|---|---|
| **Bucket name** | `documents` |
| **Public** | ❌ No (private) |
| **Allowed MIME types** | `application/pdf, image/*, application/msword, application/vnd.openxmlformats-officedocument.*` |
| **Max file size** | `50 MB` |

#### Storage RLS Policies

Access to files in the `documents` bucket is governed by the `document_access_grants` table.

Create the following Storage policies in the Supabase Dashboard → Storage → Policies:

```sql
-- Allow document owners to upload/read/delete their own files
-- Path pattern: {userId}/{filename}
CREATE POLICY "owner_access" ON storage.objects
  FOR ALL USING (
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow grantees to read files they have been granted access to
-- TODO: Implement via a custom RLS function that checks document_access_grants
CREATE POLICY "grantee_read" ON storage.objects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.document_access_grants dag
      JOIN public.documents d ON d.id = dag.document_id
      WHERE dag.grantee_id = auth.uid()
        AND d.filename = storage.filename(name)
    )
  );
```

---

## Supabase Auth Configuration

In the Supabase Dashboard → Authentication → Settings:

1. **Email confirmations**: Enable (users must verify email before accessing the platform)
2. **Minimum password length**: 8 characters
3. **MFA**: Enable TOTP (for `mfa_enabled` flag in `user_accounts`)

### Auth Hook — Sync user to user_accounts table

After a user signs up via Supabase Auth, create a trigger or use an Edge Function to
insert a corresponding row into `public.user_accounts`:

```sql
-- Auto-insert into user_accounts after new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_accounts (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')::user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## pgvector (AI RAG Pipeline)

When the AI Legal Assistant RAG pipeline is ready:

1. Enable the `vector` extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
2. Add embedding column to `legal_sources`:
   ```sql
   ALTER TABLE public.legal_sources ADD COLUMN embedding vector(1536);
   CREATE INDEX idx_legal_sources_embedding ON public.legal_sources USING ivfflat (embedding vector_cosine_ops);
   ```
3. Create a similarity search function:
   ```sql
   CREATE OR REPLACE FUNCTION match_legal_sources(
     query_embedding vector(1536),
     match_count INT DEFAULT 5,
     filter_status legal_source_status DEFAULT 'active'
   )
   RETURNS TABLE(id UUID, title TEXT, citation TEXT, excerpt TEXT, similarity FLOAT)
   LANGUAGE plpgsql AS $$
   BEGIN
     RETURN QUERY
     SELECT ls.id, ls.title, ls.citation, substring(ls.text_content, 1, 500) AS excerpt,
            1 - (ls.embedding <=> query_embedding) AS similarity
     FROM public.legal_sources ls
     WHERE ls.status = filter_status
     ORDER BY ls.embedding <=> query_embedding
     LIMIT match_count;
   END;
   $$;
   ```

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Find your Supabase URL and keys in: Dashboard → Project Settings → API


## Verified consultation reviews

For an existing database, run [0007_verified_consultation_reviews.sql](./migrations/0007_verified_consultation_reviews.sql) in the Supabase SQL Editor after earlier migrations. Fresh installs using [complete_setup.sql](./complete_setup.sql) already include this change. Do not rerun older migrations after 0007; they can restore obsolete policies or attempt to insert demo reviews.

This migration adds a unique consultation link, checks completed consultations and participant IDs, and limits client inserts and lawyer replies. Existing unlinked reviews are preserved for audit but excluded from public review lists. They are not automatically assigned to consultations. Reviews display the client's account name when available, otherwise Verified Client.

The app requires a reachable NEXT_PUBLIC_SUPABASE_URL and the matching server-only SUPABASE_SERVICE_ROLE_KEY. Browser storage is no longer used for reviews or the rated status. Never put the service key in a public environment variable.

Validation: sign in as a client with a confirmed consultation whose scheduled time has started, end the consultation, submit a rating, then refresh. Verify the rating appears on the lawyer profile and the consultation remains rated. Check another browser session for the same account, and the lawyer's review dashboard. Pending consultations must not allow reviews; a second review of the same consultation must be rejected. Simulate a failed save and confirm the modal stays open with an error.

The migration also preserves hidden-review filtering, aligns the review lawyer foreign key with consultations, and repairs the deployed rating-summary trigger to use lawyer_profiles.user_id. It adds rating_avg and rating_count if missing.

Verified on 2026-11-09: a signed-in client completed a temporary consultation, received the rating modal, submitted four stars, refreshed, and still saw Rated 4 / 5. The public lawyer profile showed the saved feedback and no Write a Review button. The database contained exactly one matching review. The temporary review and consultation were removed afterward. Transactional SQL checks also verified replies, duplicate rejection, immutable ratings, and the completed-only rule, then rolled back test records.

Run automated action checks with `node --test tests/review-actions.test.cjs` (stateful database double; nine cases) and type checks with `npm run typecheck`.
