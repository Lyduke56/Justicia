'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { NeuAlert, Spinner } from '@/components/shared/neu';
import { ScreenLoader } from '@/components/shared/loading';
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

  if (phase === 'loading') return <ScreenLoader variant="panel" srLabel="Loading your documents" />;
  if (phase === 'failed') {
    return (
      <NeuAlert
        tone="error"
        title="We couldn't load your documents"
        action={
          <button type="button" onClick={() => void load()} className="font-inter text-xs font-semibold text-[#946525] underline underline-offset-2 hover:text-[#C58B3C] cursor-pointer">
            Retry
          </button>
        }
      >
        {loadError}
      </NeuAlert>
    );
  }

  return (
    <div className="space-y-4">
      {intro && <p className="font-inter text-[12.5px] leading-relaxed text-[#5C4535]">{intro}</p>}
      {!editable && (
        <NeuAlert tone="info">Your documents are locked while your application is under review.</NeuAlert>
      )}
      <ul className="space-y-3.5">
        {VERIFICATION_DOCUMENTS.map((req, i) => {
          const doc = docs.find((d) => d.docType === req.type) ?? null;
          const status = doc ? STATUS[doc.reviewStatus] : null;
          const busy = busyType === req.type;
          return (
            <motion.li
              key={req.type}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="neu-raised-highlight rounded-[20px] p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                      doc ? 'bg-[#C58B3C] text-white' : 'neu-pressed text-[#9A8270]'
                    }`}
                    aria-hidden="true"
                  >
                    {doc ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5" /></svg>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="font-lora text-[14px] font-semibold text-[#34150F]">
                      {req.label}
                      {req.required && <span className="text-[#C58B3C]" aria-label="required"> *</span>}
                    </p>
                    <p className="mt-0.5 font-inter text-[12px] leading-relaxed text-[#7D6855]">{req.description}</p>
                  </div>
                </div>
                {status ? (
                  <span className={`shrink-0 inline-flex rounded-full border px-2.5 py-0.5 font-inter text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                ) : (
                  <span className="shrink-0 inline-flex rounded-full border border-[#D8CAAD] bg-[#EFE5D8] px-2.5 py-0.5 font-inter text-[11px] font-semibold text-[#A69584]">
                    {req.required ? 'Missing' : 'Optional'}
                  </span>
                )}
              </div>
              {doc && (
                <p className="neu-recessed rounded-xl px-3.5 py-2 font-inter text-[12px] text-[#5C4535] [overflow-wrap:anywhere]">
                  {doc.fileName}
                  <span className="text-[#A69584]"> · {formatSize(doc.sizeBytes)}</span>
                </p>
              )}
              {doc?.reviewStatus === 'rejected' && doc.reviewNote && (
                <p className="font-inter text-[12px] text-[#B42318]">Reviewer’s note: {doc.reviewNote}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-0.5">
                {editable && (
                  <>
                    <input
                      ref={(el) => {
                        inputs.current[req.type] = el;
                      }}
                      id={`doc-${req.type}`}
                      type="file"
                      accept={VERIFICATION_ACCEPT}
                      className="peer sr-only"
                      disabled={busy}
                      onChange={(e) => void upload(req.type, e.target.files?.[0])}
                    />
                    <label
                      htmlFor={`doc-${req.type}`}
                      className={`inline-flex h-9 items-center gap-2 rounded-xl px-4 font-lora text-xs font-bold transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] peer-focus-visible:ring-2 peer-focus-visible:ring-[#C58B3C]/60 ${
                        busy ? 'opacity-60 pointer-events-none' : ''
                      } ${doc ? 'neu-raised-sm text-[#341512] hover:text-[#A8742E]' : 'neu-btn-caramel text-[#341512]'}`}
                    >
                      {busy && <Spinner className="h-3.5 w-3.5" />}
                      {busy ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
                    </label>
                  </>
                )}
                {doc && (
                  <button type="button" onClick={() => void view(doc)} className="font-inter text-xs font-semibold text-[#946525] underline underline-offset-2 hover:text-[#C58B3C] cursor-pointer">
                    View
                  </button>
                )}
                {doc && editable && doc.reviewStatus === 'uploaded' && (
                  <button type="button" disabled={busy} onClick={() => void remove(doc)} className="font-inter text-xs text-[#7D6855] hover:text-[#B42318] disabled:opacity-50 cursor-pointer">
                    Remove
                  </button>
                )}
              </div>
              {errors[req.type] && <p role="alert" className="font-inter text-xs font-medium text-[#B42318]">{errors[req.type]}</p>}
            </motion.li>
          );
        })}
      </ul>
      <p className="font-inter text-[11px] text-[#A69584]">PDF, PNG or JPG, up to 8 MB each. Files are stored privately and only the Justicia review team can open them.</p>
    </div>
  );
}
