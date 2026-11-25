'use server';

/**
 * Lawyer verification documents (proof of bar admission, IBP membership, government ID, MCLE).
 *
 * Files live in the private `lawyer-credentials` bucket under a path the server picks
 * ({lawyerId}/v{version}/{uuid}.{ext}); public.lawyer_verification_documents holds one row per
 * upload with its checksum, size, type, version and review status. Nothing here trusts the
 * uploader's file name or MIME type: the content is checked against the extension.
 *
 * Replacing a document that was already submitted keeps the old row (superseded_at is set), so
 * earlier evidence is never destroyed. Drafts that were never submitted are simply replaced.
 */
import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { guardMessage, requireRole, requireUser, UUID_RE } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/notifications';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { FILE_CONTENT_MISMATCH, contentMatchesExtension, extensionOf, mimeForExtension } from '@/lib/security/fileType';
import {
  VERIFICATION_DOCUMENTS,
  VERIFICATION_FILE_EXTENSIONS,
  VERIFICATION_MAX_BYTES,
  applicantCanEdit,
  isDocumentType,
} from '@/lib/lawyer/verification';
import {
  DOC_COLUMNS,
  VERIFICATION_BUCKET,
  currentSubmissionVersion,
  loadCurrentDocuments,
  schemaMessage,
  toDocumentView,
  type DocRow,
  type VerificationDocumentView,
} from '@/lib/lawyer/documentsServer';

export type { VerificationDocumentView } from '@/lib/lawyer/documentsServer';

const BUCKET = VERIFICATION_BUCKET;
const SIGNED_URL_SECONDS = 5 * 60;

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };
const toView = toDocumentView;

/** The signed-in applicant: a lawyer (or a client who is applying), never an admin. */
async function requireApplicant() {
  const ctx = await requireRole('client', 'lawyer');
  const { data: profile } = await ctx.db
    .from('lawyer_profiles')
    .select('user_id, verification_status')
    .eq('user_id', ctx.user.id)
    .maybeSingle();
  return { ...ctx, profile: profile as { user_id: string; verification_status: string } | null };
}

function revalidateDocs(lawyerId: string) {
  revalidatePath('/lawyer/register');
  revalidatePath('/lawyer/verification');
  revalidatePath(`/admin/lawyers/${lawyerId}`);
  revalidatePath('/admin/lawyers/verification-queue');
}

// ─── Applicant ───────────────────────────────────────────────────────────────

export async function getMyVerificationDocumentsAction(): Promise<
  Result<{ documents: VerificationDocumentView[]; editable: boolean; status: string | null }>
> {
  try {
    const ctx = await requireApplicant();
    if (!ctx.profile) return { success: true, documents: [], editable: true, status: null };
    const rows = await loadCurrentDocuments(ctx.db, ctx.user.id);
    const status = ctx.profile.verification_status;
    return {
      success: true,
      documents: rows.map((r) => toView(r, true)),
      editable: applicantCanEdit(status) || (status === 'approved' && rows.length < VERIFICATION_DOCUMENTS.length),
      status,
    };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Could not load your documents.') };
  }
}

/**
 * Uploads (or replaces) one document. FormData: docType, file.
 * Allowed while the application is a draft, needs more information or was rejected; approved
 * lawyers who registered before documents were required may also add missing ones.
 */
export async function uploadVerificationDocumentAction(formData: FormData): Promise<Result<{ document: VerificationDocumentView }>> {
  let uploadedPath: string | null = null;
  let db: SupabaseClient | null = null;
  try {
    const docType = formData.get('docType');
    const file = formData.get('file');
    if (!isDocumentType(docType)) return { success: false, error: 'Choose which document this is.' };
    if (!(file instanceof File) || file.size === 0) return { success: false, error: 'Choose a file to upload.' };
    if (file.size > VERIFICATION_MAX_BYTES) return { success: false, error: 'Each document must be 8 MB or smaller.' };
    const ext = extensionOf(file.name);
    if (!(VERIFICATION_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
      return { success: false, error: 'Upload a PDF, PNG or JPG file.' };
    }

    const ctx = await requireApplicant();
    db = ctx.db;
    const limited = await checkRateLimit('upload', ctx.user.id);
    if (limited) return { success: false, error: limited };
    if (!ctx.profile) {
      return { success: false, error: 'Save your credentials first, then upload your documents.' };
    }
    const status = ctx.profile.verification_status;
    const current = await loadCurrentDocuments(ctx.db, ctx.user.id);
    const existing = current.find((d) => d.doc_type === docType) ?? null;
    const legacyApproved = status === 'approved' && !existing;
    if (!applicantCanEdit(status) && !legacyApproved) {
      return {
        success: false,
        error: status === 'pending'
          ? 'Your application is under review, so its documents are locked.'
          : 'Documents can no longer be changed for this application.',
      };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!contentMatchesExtension(bytes.subarray(0, 512), ext)) return { success: false, error: FILE_CONTENT_MISMATCH };
    const checksum = createHash('sha256').update(bytes).digest('hex');
    if (existing?.checksum_sha256 === checksum) {
      return { success: true, document: toView(existing, true) };
    }

    const version = await currentSubmissionVersion(ctx.db, ctx.user.id);
    const path = `${ctx.user.id}/v${version}/${randomUUID()}.${ext === 'jpeg' ? 'jpg' : ext}`;
    const mimeType = mimeForExtension(ext);
    const { error: uploadError } = await ctx.db.storage.from(BUCKET).upload(path, bytes, { contentType: mimeType, upsert: false });
    if (uploadError) {
      console.error('[uploadVerificationDocument] storage:', uploadError.message);
      return { success: false, error: 'The file could not be uploaded. Please try again.' };
    }
    uploadedPath = path;

    const { data: inserted, error: insertError } = await ctx.db
      .from('lawyer_verification_documents')
      .insert({
        lawyer_id: ctx.user.id,
        doc_type: docType,
        storage_path: path,
        uploaded_at: new Date().toISOString(),
        original_filename: file.name.replace(/[\u0000-\u001f]/g, '').slice(0, 180) || `document.${ext}`,
        mime_type: mimeType,
        size_bytes: file.size,
        checksum_sha256: checksum,
        submission_version: version,
        review_status: 'uploaded',
        uploaded_by: ctx.user.id,
      })
      .select(DOC_COLUMNS)
      .single();
    if (insertError || !inserted) {
      await ctx.db.storage.from(BUCKET).remove([path]);
      uploadedPath = null;
      return { success: false, error: schemaMessage(insertError) ?? 'The document could not be saved. Please try again.' };
    }
    uploadedPath = null;

    // Replace the previous file of this type: drafts are removed, submitted evidence is kept.
    if (existing) {
      if (existing.review_status === 'uploaded') {
        await ctx.db.from('lawyer_verification_documents').delete().eq('id', existing.id);
        await ctx.db.storage.from(BUCKET).remove([existing.storage_path]);
      } else {
        await ctx.db.from('lawyer_verification_documents').update({ superseded_at: new Date().toISOString() }).eq('id', existing.id);
      }
    }

    await writeAuditLog({
      actorId: ctx.user.id,
      action: existing ? 'lawyer.document.replaced' : 'lawyer.document.uploaded',
      targetType: 'lawyer_profile',
      targetId: ctx.user.id,
      details: { document_id: (inserted as DocRow).id, doc_type: docType, version, size_bytes: file.size, checksum },
    });
    revalidateDocs(ctx.user.id);
    return { success: true, document: toView(inserted as DocRow, true) };
  } catch (err) {
    if (uploadedPath && db) await db.storage.from(BUCKET).remove([uploadedPath]).catch(() => undefined);
    return { success: false, error: guardMessage(err, 'The document could not be uploaded. Please try again.') };
  }
}

/** Removes a document that has not been submitted yet. Submitted documents are kept as evidence. */
export async function deleteVerificationDocumentAction(documentId: string): Promise<Result> {
  try {
    if (!UUID_RE.test(documentId ?? '')) return { success: false, error: 'Document not found.' };
    const ctx = await requireApplicant();
    if (!ctx.profile || !applicantCanEdit(ctx.profile.verification_status)) {
      return { success: false, error: 'Documents can’t be removed while your application is under review.' };
    }
    const { data: row } = await ctx.db
      .from('lawyer_verification_documents')
      .select(DOC_COLUMNS)
      .eq('id', documentId)
      .eq('lawyer_id', ctx.user.id)
      .is('superseded_at', null)
      .maybeSingle();
    if (!row) return { success: false, error: 'Document not found.' };
    if ((row as DocRow).review_status !== 'uploaded') {
      return { success: false, error: 'This document was already submitted. Upload a replacement instead of removing it.' };
    }
    await ctx.db.from('lawyer_verification_documents').delete().eq('id', documentId);
    await ctx.db.storage.from(BUCKET).remove([(row as DocRow).storage_path]);
    await writeAuditLog({
      actorId: ctx.user.id,
      action: 'lawyer.document.removed',
      targetType: 'lawyer_profile',
      targetId: ctx.user.id,
      details: { document_id: documentId, doc_type: (row as DocRow).doc_type },
    });
    revalidateDocs(ctx.user.id);
    return { success: true };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'The document could not be removed.') };
  }
}

/** A 5-minute link to one of the applicant's own documents. */
export async function getMyVerificationDocumentUrlAction(documentId: string): Promise<Result<{ url: string }>> {
  try {
    if (!UUID_RE.test(documentId ?? '')) return { success: false, error: 'Document not found.' };
    const ctx = await requireUser();
    const { data: row } = await ctx.db
      .from('lawyer_verification_documents')
      .select('storage_path')
      .eq('id', documentId)
      .eq('lawyer_id', ctx.user.id)
      .maybeSingle();
    if (!row) return { success: false, error: 'Document not found.' };
    const { data, error } = await ctx.db.storage.from(BUCKET).createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);
    if (error || !data?.signedUrl) return { success: false, error: 'The file is missing or could not be opened.' };
    return { success: true, url: data.signedUrl };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'The file could not be opened.') };
  }
}

// ─── Admin ───────────────────────────────────────────────────────────────────

/** Every document of a lawyer, newest first, including replaced versions. */
export async function getAdminVerificationDocumentsAction(
  lawyerId: string
): Promise<Result<{ documents: VerificationDocumentView[] }>> {
  try {
    if (!UUID_RE.test(lawyerId ?? '')) return { success: false, error: 'Lawyer not found.' };
    const ctx = await requireRole('admin');
    const { data, error } = await ctx.db
      .from('lawyer_verification_documents')
      .select(DOC_COLUMNS)
      .eq('lawyer_id', lawyerId)
      .order('uploaded_at', { ascending: false });
    if (error) return { success: false, error: schemaMessage(error) ?? 'Documents could not be loaded.' };
    return { success: true, documents: ((data ?? []) as DocRow[]).map((r) => toView(r, false)) };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'Documents could not be loaded.') };
  }
}

/** A 5-minute link for an administrator; every opening is written to the audit log. */
export async function getAdminVerificationDocumentUrlAction(documentId: string): Promise<Result<{ url: string }>> {
  try {
    if (!UUID_RE.test(documentId ?? '')) return { success: false, error: 'Document not found.' };
    const ctx = await requireRole('admin');
    const { data: row } = await ctx.db
      .from('lawyer_verification_documents')
      .select('lawyer_id, doc_type, storage_path')
      .eq('id', documentId)
      .maybeSingle();
    if (!row) return { success: false, error: 'This document record no longer exists.' };
    const { data, error } = await ctx.db.storage.from(BUCKET).createSignedUrl(row.storage_path, SIGNED_URL_SECONDS);
    if (error || !data?.signedUrl) {
      return { success: false, error: 'The uploaded file is missing from storage. Ask the lawyer to upload it again.' };
    }
    await writeAuditLog({
      actorId: ctx.user.id,
      action: 'lawyer.document.viewed',
      targetType: 'lawyer_profile',
      targetId: row.lawyer_id,
      details: { document_id: documentId, doc_type: row.doc_type },
    });
    return { success: true, url: data.signedUrl };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'The file could not be opened.') };
  }
}

/** Accepts or rejects one document of an application that is under review. */
export async function reviewVerificationDocumentAction(
  documentId: string,
  decision: 'accepted' | 'rejected',
  note?: string
): Promise<Result<{ document: VerificationDocumentView }>> {
  try {
    if (!UUID_RE.test(documentId ?? '')) return { success: false, error: 'Document not found.' };
    if (decision !== 'accepted' && decision !== 'rejected') return { success: false, error: 'Choose accept or reject.' };
    const reason = typeof note === 'string' ? note.trim() : '';
    if (decision === 'rejected' && (reason.length < 5 || reason.length > 500)) {
      return { success: false, error: 'Tell the lawyer what is wrong with this document (5 to 500 characters).' };
    }
    const ctx = await requireRole('admin');
    const { data: row } = await ctx.db
      .from('lawyer_verification_documents')
      .select(DOC_COLUMNS)
      .eq('id', documentId)
      .is('superseded_at', null)
      .maybeSingle();
    if (!row) return { success: false, error: 'This document was replaced or removed. Refresh the dossier.' };
    const doc = row as DocRow;
    const { data: profile } = await ctx.db.from('lawyer_profiles').select('verification_status').eq('user_id', doc.lawyer_id).maybeSingle();
    if (profile?.verification_status !== 'pending') {
      return { success: false, error: 'Documents can only be reviewed while the application is pending. Refresh the dossier.' };
    }
    const nowIso = new Date().toISOString();
    const { data: updated, error } = await ctx.db
      .from('lawyer_verification_documents')
      .update({ review_status: decision, review_note: decision === 'rejected' ? reason : null, reviewed_by: ctx.user.id, reviewed_at: nowIso })
      .eq('id', documentId)
      .is('superseded_at', null)
      .select(DOC_COLUMNS)
      .single();
    if (error || !updated) return { success: false, error: 'The review could not be saved. Refresh and try again.' };
    await writeAuditLog({
      actorId: ctx.user.id,
      action: decision === 'accepted' ? 'lawyer.document.accepted' : 'lawyer.document.rejected',
      targetType: 'lawyer_profile',
      targetId: doc.lawyer_id,
      details: { document_id: documentId, doc_type: doc.doc_type, ...(reason ? { reason } : {}) },
    });
    revalidateDocs(doc.lawyer_id);
    return { success: true, document: toView(updated as DocRow, false) };
  } catch (err) {
    return { success: false, error: guardMessage(err, 'The review could not be saved.') };
  }
}
