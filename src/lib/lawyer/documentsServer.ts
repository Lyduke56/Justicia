/**
 * Server-only helpers for lawyer verification documents (not Server Actions).
 * See src/app/actions/lawyerVerificationDocs.ts for the actions that use them.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { GuardError } from '@/lib/auth/guards';
import { documentLabel, type DocumentReviewStatus } from '@/lib/lawyer/verification';

export const VERIFICATION_BUCKET = 'lawyer-credentials';

export const DOC_COLUMNS =
  'id, lawyer_id, doc_type, storage_path, uploaded_at, original_filename, mime_type, size_bytes, checksum_sha256, submission_version, review_status, review_note, reviewed_at, superseded_at';

export interface DocRow {
  id: string;
  lawyer_id: string;
  doc_type: string;
  storage_path: string;
  uploaded_at: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  checksum_sha256: string | null;
  submission_version: number | null;
  review_status: DocumentReviewStatus | null;
  review_note: string | null;
  reviewed_at: string | null;
  superseded_at: string | null;
}

export interface VerificationDocumentView {
  id: string;
  docType: string;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  uploadedAt: string;
  version: number;
  reviewStatus: DocumentReviewStatus;
  /** Shown to the applicant only when the document was rejected. */
  reviewNote: string | null;
  reviewedAt: string | null;
  /** Older versions replaced by a newer upload. */
  superseded: boolean;
}

/** The 004 columns are missing: explain instead of failing silently. */
export function schemaMessage(error: { message?: string; code?: string } | null): string | null {
  if (!error) return null;
  if (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    /column .* does not exist|could not find the .* column/i.test(error.message ?? '')
  ) {
    return 'Document uploads need a database update (supabase/manual/004_lawyer_verification_documents.sql). Please contact the Justicia team.';
  }
  return null;
}

export function toDocumentView(row: DocRow, forApplicant: boolean): VerificationDocumentView {
  const status = (row.review_status ?? 'uploaded') as DocumentReviewStatus;
  return {
    id: row.id,
    docType: row.doc_type,
    label: documentLabel(row.doc_type),
    fileName: row.original_filename ?? 'document',
    mimeType: row.mime_type ?? 'application/octet-stream',
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
    version: row.submission_version ?? 1,
    reviewStatus: status,
    reviewNote: forApplicant ? (status === 'rejected' ? row.review_note : null) : row.review_note,
    reviewedAt: row.reviewed_at,
    superseded: !!row.superseded_at,
  };
}

/** Current (not superseded) documents of a lawyer, newest per type. */
export async function loadCurrentDocuments(db: SupabaseClient, lawyerId: string): Promise<DocRow[]> {
  const { data, error } = await db
    .from('lawyer_verification_documents')
    .select(DOC_COLUMNS)
    .eq('lawyer_id', lawyerId)
    .is('superseded_at', null)
    .order('uploaded_at', { ascending: false });
  if (error) throw new GuardError(schemaMessage(error) ?? 'Could not load the verification documents.', 404);
  const seen = new Set<string>();
  return ((data ?? []) as DocRow[]).filter((row) => (seen.has(row.doc_type) ? false : (seen.add(row.doc_type), true)));
}

/** Submission number the next upload belongs to: 1 + earlier submissions. */
export async function currentSubmissionVersion(db: SupabaseClient, lawyerId: string): Promise<number> {
  const { count } = await db
    .from('audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'lawyer.submitted')
    .eq('target_id', lawyerId);
  return (count ?? 0) + 1;
}
