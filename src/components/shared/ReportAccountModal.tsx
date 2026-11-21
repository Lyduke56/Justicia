'use client';

/**
 * "Report" dialog opened from a Messages conversation (clients report lawyers, lawyers report
 * clients). The report — reason, details, evidence files and optionally the conversation — goes
 * to the admin Reports tab. The reported person is not told who reported them.
 */
import React, { useEffect, useRef, useState } from 'react';
import { submitAccountReportAction } from '@/app/actions/reportActions';
import {
  REPORT_DETAILS_MAX,
  REPORT_DETAILS_MIN,
  REPORT_FILE_EXTENSIONS,
  REPORT_MAX_FILES,
  REPORT_MAX_FILE_BYTES,
  REPORT_MAX_TOTAL_BYTES,
  REPORT_REASONS,
} from '@/lib/moderation/constants';

interface ReportAccountModalProps {
  threadId: string;
  /** Name of the person being reported. */
  targetName: string;
  /** Role of the person being reported, for wording. */
  targetRole: 'lawyer' | 'client';
  onClose: () => void;
}

const ACCEPT = REPORT_FILE_EXTENSIONS.map((e) => `.${e}`).join(',');
const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function ReportAccountModal({ threadId, targetName, targetRole, onClose }: ReportAccountModalProps) {
  const [reasonKey, setReasonKey] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [includeConversation, setIncludeConversation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    setError(null);
    const next = [...files];
    for (const file of Array.from(list)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!(REPORT_FILE_EXTENSIONS as readonly string[]).includes(ext)) {
        setError(`“${file.name}” is not supported. Attach PNG, JPG, WEBP or PDF files.`);
        continue;
      }
      if (file.size > REPORT_MAX_FILE_BYTES) {
        setError(`“${file.name}” is larger than 5 MB.`);
        continue;
      }
      if (next.length >= REPORT_MAX_FILES) {
        setError(`You can attach up to ${REPORT_MAX_FILES} files.`);
        break;
      }
      if (!next.some((f) => f.name === file.name && f.size === file.size)) next.push(file);
    }
    if (next.reduce((sum, f) => sum + f.size, 0) > REPORT_MAX_TOTAL_BYTES) {
      setError('The attached files must be 8 MB or less in total.');
      return;
    }
    setFiles(next);
  };

  const trimmed = details.trim();
  const valid = !!reasonKey && trimmed.length >= REPORT_DETAILS_MIN && trimmed.length <= REPORT_DETAILS_MAX;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('threadId', threadId);
      fd.append('reasonKey', reasonKey!);
      fd.append('details', trimmed);
      fd.append('includeConversation', includeConversation ? 'true' : 'false');
      files.forEach((f) => fd.append('files', f));
      const res = await submitAccountReportAction(fd);
      if (!('success' in res) || !res.success) {
        setError(('error' in res && res.error) || 'We could not send your report.');
        return;
      }
      setDone(true);
    } catch {
      setError('We could not send your report. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-account-title"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="neu-raised bg-[#E5D8CB] w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-[24px] p-5 sm:p-7 space-y-5 neu-scrollbar-discrete"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-inter text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B9833C]">Report {targetRole === 'lawyer' ? 'attorney' : 'client'}</p>
            <h2 id="report-account-title" className="font-lora text-lg sm:text-xl font-bold text-[#34150F] leading-tight mt-1 truncate">
              {done ? 'Report sent' : `Report ${targetName}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="neu-raised-sm size-8 shrink-0 rounded-full bg-[#E5D8CB] text-[#5C4535] hover:text-[#34150F] disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {done ? (
          <div className="space-y-4 text-center py-4">
            <div className="neu-raised-sm size-14 rounded-full bg-[#E5D8CB] mx-auto flex items-center justify-center text-2xl text-emerald-700">✓</div>
            <p className="font-inter text-xs sm:text-[13px] text-[#5C4535] leading-relaxed max-w-sm mx-auto">
              Thank you. Your report about <strong>{targetName}</strong> was sent to the Justicia team. We review every report and
              will notify you once a decision is made. {targetName} will not be told who reported them.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="neu-btn-caramel px-6 py-2 rounded-[12px] text-white text-xs font-inter font-semibold shadow-md active:scale-95"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="font-inter text-[11px] font-bold uppercase tracking-wider text-[#5C4535] pb-1.5">What is the problem?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {REPORT_REASONS.map((r) => {
                  const selected = reasonKey === r.key;
                  return (
                    <label
                      key={r.key}
                      className={`cursor-pointer rounded-[14px] p-3 transition-all ${
                        selected ? 'neu-recessed ring-1 ring-[#C58B3C]/60 bg-[#E5D8CB]' : 'neu-raised-sm bg-[#E5D8CB] hover:brightness-[1.015]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={r.key}
                        checked={selected}
                        onChange={() => setReasonKey(r.key)}
                        className="sr-only"
                      />
                      <span className="flex items-start gap-2">
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 size-3.5 shrink-0 rounded-full border-2 ${selected ? 'border-[#C58B3C] bg-[#C58B3C]' : 'border-[#A89685]'}`}
                        />
                        <span className="min-w-0">
                          <span className="block font-lora text-xs sm:text-[13px] font-bold text-[#34150F] leading-snug">{r.label}</span>
                          <span className="block font-inter text-[10.5px] text-[#7D6855] mt-0.5 leading-snug">{r.description}</span>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <label htmlFor="report-details" className="font-inter text-[11px] font-bold uppercase tracking-wider text-[#5C4535]">
                What happened?
              </label>
              <textarea
                id="report-details"
                rows={4}
                value={details}
                maxLength={REPORT_DETAILS_MAX}
                disabled={submitting}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe what happened, when it happened and anything else our team should know."
                className="w-full neu-recessed bg-[#E5D8CB] rounded-[14px] px-3.5 py-2.5 text-xs sm:text-[13px] font-lora text-[#34150F] placeholder-[#9A8270]/70 focus:outline-none focus:ring-2 focus:ring-[#B9833C]/40 resize-y"
              />
              <p className={`font-inter text-[10.5px] ${trimmed.length > 0 && trimmed.length < REPORT_DETAILS_MIN ? 'text-rose-800' : 'text-[#8C7A6B]'}`}>
                {trimmed.length < REPORT_DETAILS_MIN
                  ? `At least ${REPORT_DETAILS_MIN} characters (${trimmed.length}/${REPORT_DETAILS_MIN}).`
                  : `${trimmed.length}/${REPORT_DETAILS_MAX}`}
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-inter text-[11px] font-bold uppercase tracking-wider text-[#5C4535]">Proof (optional)</p>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInput.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInput.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={`neu-recessed bg-[#E5D8CB] rounded-[14px] px-4 py-4 text-center cursor-pointer transition ${dragOver ? 'ring-2 ring-[#C58B3C]/60' : ''}`}
              >
                <p className="font-inter text-xs font-semibold text-[#34150F]">Drop screenshots or receipts here, or click to browse</p>
                <p className="font-inter text-[10.5px] text-[#7D6855] mt-1">
                  PNG, JPG, WEBP or PDF · up to {REPORT_MAX_FILES} files, 5 MB each
                </p>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
              {files.length > 0 && (
                <ul className="space-y-1.5">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${f.size}`} className="neu-raised-sm bg-[#E5D8CB] rounded-[12px] px-3 py-2 flex items-center justify-between gap-2">
                      <span className="min-w-0 font-inter text-[11px] text-[#34150F] truncate">
                        {f.name} <span className="text-[#8C7A6B]">· {formatSize(f.size)}</span>
                      </span>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="font-inter text-[11px] font-semibold text-rose-800 hover:underline shrink-0"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={includeConversation}
                  disabled={submitting}
                  onChange={(e) => setIncludeConversation(e.target.checked)}
                  className="mt-0.5 size-4 accent-[#C58B3C]"
                />
                <span className="font-inter text-[11.5px] text-[#5C4535] leading-snug">
                  Attach this conversation so the Justicia team can review the messages.
                </span>
              </label>
            </div>

            <p className="font-inter text-[10.5px] text-[#7D6855] leading-relaxed">
              Reports are confidential. {targetName} will not see who reported them. False or abusive reports may lead to action on
              your own account.
            </p>

            {error && (
              <p role="alert" className="rounded-[12px] border border-rose-300 bg-rose-50 px-3 py-2 font-inter text-[11.5px] text-rose-800">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-[12px] font-inter text-xs font-semibold text-[#5C4535] hover:text-[#34150F] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!valid || submitting}
                className="neu-btn-caramel px-5 py-2 rounded-[12px] text-white text-xs font-inter font-semibold shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending…' : 'Send Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ReportAccountModal;
