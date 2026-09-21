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
