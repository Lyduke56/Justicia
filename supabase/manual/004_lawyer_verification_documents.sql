-- ============================================================================
-- 004 · Lawyer verification documents (proof uploads, review status, versions)
--
-- App code: src/lib/lawyer/verificationDocuments.ts and
-- src/app/actions/lawyerVerificationDocs.ts. Files go to the private
-- `lawyer-credentials` bucket; this table holds one row per uploaded file.
-- REQUIRED before lawyers can upload documents or submit applications.
-- ============================================================================

alter table public.lawyer_verification_documents
  add column if not exists original_filename   text,
  add column if not exists mime_type           text,
  add column if not exists size_bytes          bigint,
  add column if not exists checksum_sha256     text,
  add column if not exists submission_version  integer not null default 1,
  add column if not exists review_status       text    not null default 'uploaded',
  add column if not exists review_note         text,
  add column if not exists reviewed_by         uuid references public.user_accounts(id),
  add column if not exists reviewed_at         timestamptz,
  add column if not exists superseded_at       timestamptz,
  add column if not exists uploaded_by         uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lvd_review_status_check') then
    alter table public.lawyer_verification_documents
      add constraint lvd_review_status_check
      check (review_status in ('uploaded', 'under_review', 'accepted', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lvd_size_check') then
    alter table public.lawyer_verification_documents
      add constraint lvd_size_check check (size_bytes is null or (size_bytes > 0 and size_bytes <= 10485760));
  end if;
end $$;

create index if not exists lvd_lawyer_current_idx
  on public.lawyer_verification_documents (lawyer_id, doc_type)
  where superseded_at is null;

-- Access: the lawyer reads their own documents, admins read all. Uploads, replacements and
-- review decisions go through the server (service role), which logs every view.
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'lawyer_verification_documents' loop
    execute format('drop policy %I on public.lawyer_verification_documents', r.policyname);
  end loop;
end $$;
alter table public.lawyer_verification_documents enable row level security;
create policy lvd_select_own on public.lawyer_verification_documents
  for select to authenticated using (lawyer_id = auth.uid());
create policy lvd_select_admin on public.lawyer_verification_documents
  for select to authenticated using (public.is_admin());

-- The bucket must stay private (files are opened only through 5-minute signed links).
update storage.buckets set public = false where id = 'lawyer-credentials';

-- Check: expect the new columns and public = false.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'lawyer_verification_documents'
order by ordinal_position;
select id, public from storage.buckets where id = 'lawyer-credentials';
