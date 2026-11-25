/**
 * Lawyer verification rules shared by the server actions and the screens (safe for both).
 *
 *  - Which proof documents an application needs.
 *  - Which status changes are allowed, and who may make them:
 *      draft              → pending                                  (lawyer submits)
 *      pending            → approved | rejected | needs_resubmission (admin review)
 *      needs_resubmission → pending (lawyer resubmits) | rejected (admin closes it)
 *      rejected           → pending                                  (lawyer applies again)
 *      approved           → rejected (admin revokes verification)
 *                         | needs_resubmission (admin asks for re-verification)
 *    Approved applications can never be rejected or sent back through the pending-review
 *    actions; post-approval changes use their own, separately audited actions.
 */

export type LawyerStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'needs_resubmission';
export type ReviewDecision = 'approved' | 'rejected' | 'needs_resubmission';
export type PostApprovalAction = 'revoke' | 'reverify';

export type DocumentType = 'bar_admission' | 'ibp_membership' | 'government_id' | 'mcle_compliance';
export type DocumentReviewStatus = 'uploaded' | 'under_review' | 'accepted' | 'rejected';

export interface DocumentRequirement {
  type: DocumentType;
  label: string;
  description: string;
  required: boolean;
}

export const VERIFICATION_DOCUMENTS: readonly DocumentRequirement[] = [
  {
    type: 'bar_admission',
    label: 'Proof of bar admission',
    description: 'Supreme Court Certificate of Admission to the Bar, or proof of your Roll of Attorneys signing.',
    required: true,
  },
  {
    type: 'ibp_membership',
    label: 'IBP membership',
    description: 'Your IBP ID, or the official receipt for this year’s IBP dues.',
    required: true,
  },
  {
    type: 'government_id',
    label: 'Government-issued ID',
    description: 'A valid photo ID showing your full name (passport, driver’s license, UMID or PhilSys ID).',
    required: true,
  },
  {
    type: 'mcle_compliance',
    label: 'MCLE compliance (optional)',
    description: 'Certificate of MCLE compliance or exemption, if you have one.',
    required: false,
  },
];

export const REQUIRED_DOCUMENT_TYPES: readonly DocumentType[] = VERIFICATION_DOCUMENTS.filter((d) => d.required).map((d) => d.type);

export const VERIFICATION_FILE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'] as const;
export const VERIFICATION_ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';
/** Per file; stays under the 10 MB Server Action body limit and the bucket's 10 MB limit. */
export const VERIFICATION_MAX_BYTES = 8 * 1024 * 1024;

export function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === 'string' && VERIFICATION_DOCUMENTS.some((d) => d.type === value);
}

export function documentLabel(type: string): string {
  return VERIFICATION_DOCUMENTS.find((d) => d.type === type)?.label ?? 'Document';
}

/** Decisions an admin may take on an application in this status (the pending-review actions). */
export function allowedReviewDecisions(status: string): ReviewDecision[] {
  if (status === 'pending') return ['approved', 'needs_resubmission', 'rejected'];
  if (status === 'needs_resubmission') return ['rejected'];
  return [];
}

/** Separate actions an admin may take once a lawyer is verified. */
export function allowedPostApprovalActions(status: string): PostApprovalAction[] {
  return status === 'approved' ? ['revoke', 'reverify'] : [];
}

/** Whether the applicant may change their documents and details in this status. */
export function applicantCanEdit(status: string | null | undefined): boolean {
  return !status || status === 'draft' || status === 'needs_resubmission' || status === 'rejected';
}

/** Whether the applicant may submit (or resubmit) for review from this status. */
export function applicantCanSubmit(status: string | null | undefined): boolean {
  return applicantCanEdit(status);
}

export interface DocumentSummary {
  docType: string;
  reviewStatus: DocumentReviewStatus;
}

/** Required document types that are missing or were rejected (among the current documents). */
export function documentGaps(docs: DocumentSummary[]): { missing: DocumentType[]; rejected: DocumentType[] } {
  const missing: DocumentType[] = [];
  const rejected: DocumentType[] = [];
  for (const type of REQUIRED_DOCUMENT_TYPES) {
    const doc = docs.find((d) => d.docType === type);
    if (!doc) missing.push(type);
    else if (doc.reviewStatus === 'rejected') rejected.push(type);
  }
  return { missing, rejected };
}

/** User-facing summary of what still blocks submission (empty string when ready). */
export function documentGapMessage(docs: DocumentSummary[]): string {
  const { missing, rejected } = documentGaps(docs);
  const parts: string[] = [];
  if (missing.length) parts.push(`upload ${missing.map(documentLabel).join(', ')}`);
  if (rejected.length) parts.push(`replace the rejected ${rejected.map(documentLabel).join(', ')}`);
  return parts.length ? `Before submitting, please ${parts.join(' and ')}.` : '';
}
