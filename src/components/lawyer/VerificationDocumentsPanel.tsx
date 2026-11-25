'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteVerificationDocumentAction,
  getMyVerificationDocumentUrlAction,
  getMyVerificationDocumentsAction,
  uploadVerificationDocumentAction,
  type VerificationDocumentView,
} from '@/app/actions/lawyerVerificationDocs';
import {
  VERIFICATION_ACCEPT,
  VERIFICATION_DOCUMENTS,
  VERIFICATION_MAX_BYTES,
  type DocumentReviewStatus,
  type DocumentType,
} from '@/lib/lawyer/verification';

/**
 * The applicant's verification documents: one card per checklist item with upload, replace,
 * view and (for files not yet submitted) remove. Read-only while the application is under review.
 * Styled like the registration form it sits in.
 */

const STATUS: Record<DocumentReviewStatus, { label: string; className: string }> = {
  uploaded: { label: 'Uploaded', className: 'bg-[#E8DCCB] text-[#5C4535] border-[#D8CAAD]' },
  under_review: { label: 'Under review', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  accepted: { label: 'Accepted', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  rejected: { label: 'Needs a new file', className: 'bg-red-100 text-red-800 border-red-300' },
};

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VerificationDocumentsPanel({
  onDocumentsChange,
  intro,
}: {
  onDocumentsChange?: (docs: VerificationDocumentView[]) => void;
  intro?: string;
}) {
  const [docs, setDocs] = useState<VerificationDocumentView[]>([]);
  const [editable, setEditable] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [loadError, setLoadError] = useState('');
  const [busyType, setBusyType] = useState<DocumentType | null>(null);
  const [errors, setErrors] = useState<Partial<Record<DocumentType, string>>>({});
  const inputs = useRef<Partial<Record<DocumentType, HTMLInputElement | null>>>({});
  const onChangeRef = useRef(onDocumentsChange);
  useEffect(() => {
    onChangeRef.current = onDocumentsChange;
  }, [onDocumentsChange]);

  const apply = useCallback((next: VerificationDocumentView[]) => {
    setDocs(next);
    onChangeRef.current?.(next);
  }, []);

  const settle = useCallback(
    (res: Awaited<ReturnType<typeof getMyVerificationDocumentsAction>> | null) => {
      if (!res || !res.success) {
        setLoadError(res?.error ?? 'Your documents could not be loaded.');
        setPhase('failed');
        return;
      }
      setEditable(res.editable);
      apply(res.documents);
      setPhase('ready');
    },
    [apply]
  );

  const load = async () => {
    setPhase('loading');
    settle(await getMyVerificationDocumentsAction().catch(() => null));
  };

  useEffect(() => {
    let cancelled = false;
    void getMyVerificationDocumentsAction()
      .catch(() => null)
      .then((res) => {
        if (!cancelled) settle(res);
      });
    return () => {
      cancelled = true;
    };
  }, [settle]);

  const upload = async (type: DocumentType, file: File | undefined) => {
    if (!file) return;
    setErrors((e) => ({ ...e, [type]: '' }));
    if (file.size > VERIFICATION_MAX_BYTES) {
      setErrors((e) => ({ ...e, [type]: 'Each document must be 8 MB or smaller.' }));
      return;
    }
    setBusyType(type);
    try {
      const fd = new FormData();
      fd.set('docType', type);
      fd.set('file', file);
      const res = await uploadVerificationDocumentAction(fd);
      if (!res.success) {
        setErrors((e) => ({ ...e, [type]: res.error }));
        return;
      }
      apply([...docs.filter((d) => d.docType !== type), res.document]);
    } catch {
      setErrors((e) => ({ ...e, [type]: 'The upload failed. Check your connection and try again.' }));
    } finally {
      setBusyType(null);
      const input = inputs.current[type];
      if (input) input.value = '';
    }
  };

  const remove = async (doc: VerificationDocumentView) => {
    const type = doc.docType as DocumentType;
    setBusyType(type);
    setErrors((e) => ({ ...e, [type]: '' }));
    try {
      const res = await deleteVerificationDocumentAction(doc.id);
      if (!res.success) setErrors((e) => ({ ...e, [type]: res.error }));
      else apply(docs.filter((d) => d.id !== doc.id));
    } finally {
      setBusyType(null);
    }
  };

  const view = async (doc: VerificationDocumentView) => {
    const tab = window.open('', '_blank');
    const res = await getMyVerificationDocumentUrlAction(doc.id).catch(() => null);
    if (res?.success && tab) {
      tab.opener = null;
      tab.location.href = res.url;
    } else {
      tab?.close();
      setErrors((e) => ({ ...e, [doc.docType as DocumentType]: res && !res.success ? res.error : 'The file could not be opened.' }));
    }
  };

  if (phase === 'loading') return <p role="status" className="text-xs text-[#7D6855]">Loading your documents…</p>;
  if (phase === 'failed') {
    return (
      <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between gap-3">
        <span>{loadError}</span>
        <button type="button" onClick={() => void load()} className="text-xs font-semibold underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {intro && <p className="text-xs text-[#7D6855]">{intro}</p>}
      {!editable && (
        <p className="text-xs text-[#7D6855]">Your documents are locked while your application is under review.</p>
      )}
      {VERIFICATION_DOCUMENTS.map((req) => {
        const doc = docs.find((d) => d.docType === req.type) ?? null;
        const status = doc ? STATUS[doc.reviewStatus] : null;
        const busy = busyType === req.type;
        return (
          <div key={req.type} className="p-4 rounded-xl bg-[#F5EDE2] border border-[#E8DCCB] space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#34150F]">
                  {req.label}
                  {req.required && <span className="text-[#C58B3C]"> *</span>}
                </p>
                <p className="text-xs text-[#7D6855] mt-0.5">{req.description}</p>
              </div>
              {status ? (
                <span className={`shrink-0 inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${status.className}`}>{status.label}</span>
              ) : (
                <span className="shrink-0 inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-[#EFE5D8] text-[#A69584] border-[#D8CAAD]">
                  {req.required ? 'Missing' : 'Optional'}
                </span>
              )}
            </div>
            {doc && (
              <p className="text-xs text-[#5C4535] [overflow-wrap:anywhere]">
                {doc.fileName}
                <span className="text-[#A69584]"> · {formatSize(doc.sizeBytes)}</span>
              </p>
            )}
            {doc?.reviewStatus === 'rejected' && doc.reviewNote && (
              <p className="text-xs text-red-700">Reviewer’s note: {doc.reviewNote}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {editable && (
                <>
                  <input
                    ref={(el) => {
                      inputs.current[req.type] = el;
                    }}
                    id={`doc-${req.type}`}
                    type="file"
                    accept={VERIFICATION_ACCEPT}
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => void upload(req.type, e.target.files?.[0])}
                  />
                  <label
                    htmlFor={`doc-${req.type}`}
                    className={`inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      busy ? 'opacity-60 pointer-events-none' : ''
                    } ${doc ? 'border border-[#D8CAAD] text-[#5C4535] hover:bg-[#E5D7C5]' : 'bg-[#C58B3C] text-white hover:bg-[#B07A2E]'}`}
                  >
                    {busy ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
                  </label>
                </>
              )}
              {doc && (
                <button type="button" onClick={() => void view(doc)} className="text-xs font-semibold text-[#946525] underline underline-offset-2">
                  View
                </button>
              )}
              {doc && editable && doc.reviewStatus === 'uploaded' && (
                <button type="button" disabled={busy} onClick={() => void remove(doc)} className="text-xs text-[#7D6855] hover:text-red-700 disabled:opacity-50">
                  Remove
                </button>
              )}
            </div>
            {errors[req.type] && <p role="alert" className="text-xs text-red-600">{errors[req.type]}</p>}
          </div>
        );
      })}
      <p className="text-[11px] text-[#A69584]">PDF, PNG or JPG, up to 8 MB each. Files are stored privately and only the Justicia review team can open them.</p>
    </div>
  );
}
