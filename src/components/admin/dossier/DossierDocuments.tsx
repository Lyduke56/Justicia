'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  getAdminVerificationDocumentUrlAction,
  getAdminVerificationDocumentsAction,
  reviewVerificationDocumentAction,
  type VerificationDocumentView,
} from '@/app/actions/lawyerVerificationDocs';
import { VERIFICATION_DOCUMENTS, type DocumentReviewStatus } from '@/lib/lawyer/verification';
import { RISE } from '@/components/lawyer/motion';
import { CAPS } from '../verification/ApplicationDossier';
import { SubmissionOverlay, useSubmission } from '@/components/shared/feedback';
import { useScreenLoading } from '@/components/shared/loading';

/**
 * The lawyer's proof documents inside the admin dossier: one cell per checklist item with the
 * current file, its review status and earlier versions. Files open through 5-minute signed links
 * (each opening is audited). While the application is pending, each document can be accepted, or
 * rejected with a note the lawyer sees.
 */

const STATUS_PILL: Record<DocumentReviewStatus, { label: string; tone: string }> = {
  uploaded: { label: 'Not submitted', tone: 'neutral' },
  under_review: { label: 'Under review', tone: 'pending' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function SmallButton({ children, tone = 'plain', ...rest }: { children: React.ReactNode; tone?: 'plain' | 'danger' | 'primary'; disabled?: boolean; onClick: () => void }) {
  const look =
    tone === 'primary'
      ? 'neu-btn-espresso bg-[#4A2E25] text-[#F3E6D6]'
      : tone === 'danger'
        ? 'neu-raised-sm bg-[#E5D8CB] text-[#9A3B2E] hover:text-[#7E2A20]'
        : 'neu-raised-sm bg-[#E5D8CB] text-[#341512] hover:text-[#A8742E]';
  return (
    <button
      type="button"
      className={`inline-flex h-8 items-center rounded-[10px] px-3 font-inter text-[11.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${look}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function DossierDocuments({ lawyerId, applicationStatus }: { lawyerId: string; applicationStatus: string }) {
  const [state, setState] = useState<{ phase: 'loading' | 'ready' | 'failed'; docs: VerificationDocumentView[]; error?: string }>({
    phase: 'loading',
    docs: [],
  });
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  // The dossier's loading screen waits for the documents.
  useScreenLoading(state.phase === 'loading');
  // Accepting or rejecting a document shows the submission card: loader, then check / X.
  const submission = useSubmission();
  const [verdict, setVerdict] = useState<{ decision: 'accepted' | 'rejected'; label: string }>({ decision: 'accepted', label: 'Document' });
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await getAdminVerificationDocumentsAction(lawyerId);
      return res.success
        ? { phase: 'ready' as const, docs: res.documents }
        : { phase: 'failed' as const, docs: [], error: res.error };
    } catch {
      return { phase: 'failed' as const, docs: [], error: 'Documents could not be loaded.' };
    }
  }, [lawyerId]);

  const load = async () => {
    setState((s) => ({ ...s, phase: 'loading' }));
    setState(await fetchDocs());
  };

  useEffect(() => {
    let cancelled = false;
    void fetchDocs().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchDocs]);

  const open = async (doc: VerificationDocumentView) => {
    setRowError((e) => ({ ...e, [doc.id]: '' }));
    // Open the tab synchronously (popup blockers), then point it at the short-lived link.
    const tab = window.open('', '_blank');
    setBusy(doc.id);
    try {
      const res = await getAdminVerificationDocumentUrlAction(doc.id);
      if (res.success) {
        if (tab) {
          tab.opener = null;
          tab.location.href = res.url;
        } else window.location.assign(res.url);
      } else {
        tab?.close();
        setRowError((e) => ({ ...e, [doc.id]: res.error }));
      }
    } catch {
      tab?.close();
      setRowError((e) => ({ ...e, [doc.id]: 'The file could not be opened. Please try again.' }));
    } finally {
      setBusy(null);
    }
  };

  const review = async (doc: VerificationDocumentView, decision: 'accepted' | 'rejected', note?: string) => {
    setBusy(doc.id);
    setRowError((e) => ({ ...e, [doc.id]: '' }));
    setVerdict({ decision, label: VERIFICATION_DOCUMENTS.find((d) => d.type === doc.docType)?.label ?? 'Document' });
    const result = await submission.run(async () => {
      try {
        const res = await reviewVerificationDocumentAction(doc.id, decision, note);
        if (!res.success) return { ok: false, error: res.error };
        setRejecting(null);
        setState((s) => ({ ...s, docs: s.docs.map((d) => (d.id === doc.id ? res.document : d)) }));
        return { ok: true };
      } catch {
        return { ok: false, error: 'The review could not be saved.' };
      }
    });
    if (result && !result.ok) setRowError((e) => ({ ...e, [doc.id]: result.error }));
    setBusy(null);
  };

  if (state.phase === 'loading') {
    return (
      <motion.p variants={RISE} role="status" className="font-inter text-[12.5px] text-[#7D6855]">
        Loading documents…
      </motion.p>
    );
  }
  if (state.phase === 'failed') {
    return (
      <motion.div variants={RISE} className="admin-dossier-note admin-dossier-note-danger flex flex-wrap items-center justify-between gap-3 rounded-[14px] px-4 py-3">
        <p className="font-inter text-[12.5px] text-[#3E2A1E]">{state.error ?? 'Documents could not be loaded.'}</p>
        <SmallButton onClick={() => void load()}>Retry</SmallButton>
      </motion.div>
    );
  }

  const canReview = applicationStatus === 'pending';
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {VERIFICATION_DOCUMENTS.map((req) => {
        const versions = state.docs.filter((d) => d.docType === req.type);
        const current = versions.find((d) => !d.superseded) ?? null;
        const older = versions.filter((d) => d.superseded);
        const pill = current ? STATUS_PILL[current.reviewStatus] : null;
        return (
          <motion.div variants={RISE} key={req.type} className="admin-dossier-cell flex min-w-0 flex-col gap-2.5 rounded-[16px] px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-[9.5px] text-[#8A6A4C] ${CAPS}`}>{req.required ? 'Required' : 'Optional'}</p>
                <p className="mt-1 font-lora text-[14.5px] font-semibold leading-snug text-[#341512]">{req.label}</p>
              </div>
              {pill ? (
                <span className={`admin-pill admin-pill-${pill.tone} shrink-0`}>{pill.label}</span>
              ) : (
                <span className={`admin-pill admin-pill-${req.required ? 'danger' : 'neutral'} shrink-0`}>Not uploaded</span>
              )}
            </div>

            {current ? (
              <>
                <p className="font-inter text-[12px] leading-relaxed text-[#5C4535] [overflow-wrap:anywhere]">
                  {current.fileName}
                  <span className="text-[#7D6855]">
                    {' · '}
                    {[formatSize(current.sizeBytes), `uploaded ${formatDate(current.uploadedAt)}`, `version ${current.version}`].filter(Boolean).join(' · ')}
                  </span>
                </p>
                {current.reviewStatus === 'rejected' && current.reviewNote && (
                  <p className="font-inter text-[11.5px] text-[#9A3B2E]">Rejected: {current.reviewNote}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <SmallButton disabled={busy === current.id} onClick={() => void open(current)}>
                    {busy === current.id ? 'Opening…' : 'Open file'}
                  </SmallButton>
                  {canReview && current.reviewStatus !== 'accepted' && (
                    <SmallButton tone="primary" disabled={busy === current.id} onClick={() => void review(current, 'accepted')}>
                      Accept
                    </SmallButton>
                  )}
                  {canReview && current.reviewStatus !== 'rejected' && rejecting?.id !== current.id && (
                    <SmallButton tone="danger" disabled={busy === current.id} onClick={() => setRejecting({ id: current.id, note: '' })}>
                      Reject
                    </SmallButton>
                  )}
                </div>
                {rejecting?.id === current.id && (
                  <div className="flex flex-col gap-2">
                    <textarea
                      rows={2}
                      value={rejecting.note}
                      onChange={(e) => setRejecting({ id: current.id, note: e.target.value })}
                      placeholder="What should the lawyer fix? e.g. The ID photo is blurry."
                      className="lawyer-field w-full resize-y rounded-[10px] px-3 py-2 font-inter text-[12px] text-[#341512] placeholder:text-[#9E8E7D] focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <SmallButton tone="danger" disabled={busy === current.id || rejecting.note.trim().length < 5} onClick={() => void review(current, 'rejected', rejecting.note)}>
                        Reject document
                      </SmallButton>
                      <SmallButton onClick={() => setRejecting(null)}>Cancel</SmallButton>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="font-inter text-[12px] text-[#7D6855]">
                {req.required ? 'The lawyer has not uploaded this document.' : 'Not provided.'}
              </p>
            )}

            {rowError[current?.id ?? ''] && (
              <p role="alert" className="font-inter text-[11.5px] text-[#9A3B2E]">
                {rowError[current!.id]}
              </p>
            )}

            {older.length > 0 && (
              <details className="font-inter text-[11.5px] text-[#5C4535]">
                <summary className="cursor-pointer select-none font-semibold text-[#80501F]">
                  Earlier versions ({older.length})
                </summary>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {older.map((doc) => (
                    <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="[overflow-wrap:anywhere]">
                        v{doc.version} · {doc.fileName} · {formatDate(doc.uploadedAt)} · {STATUS_PILL[doc.reviewStatus].label}
                      </span>
                      <SmallButton disabled={busy === doc.id} onClick={() => void open(doc)}>
                        Open
                      </SmallButton>
                      {rowError[doc.id] && <span className="w-full text-[#9A3B2E]">{rowError[doc.id]}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </motion.div>
        );
      })}

      <SubmissionOverlay
        submission={submission}
        processing={{ title: verdict.decision === 'accepted' ? 'Accepting the document' : 'Rejecting the document', message: verdict.label }}
        success={
          verdict.decision === 'accepted'
            ? { title: 'Document accepted', message: `${verdict.label} is marked as verified.` }
            : { title: 'Document rejected', message: 'The applicant will be asked to upload a new file.' }
        }
        failure={{ title: 'The review was not saved' }}
      />
    </div>
  );
}
