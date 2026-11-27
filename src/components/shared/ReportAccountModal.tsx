'use client';

/**
 * "Report" dialog opened from a Messages conversation (clients report lawyers, lawyers report
 * clients). The report — reason, details, evidence files and optionally the conversation — goes
 * to the admin Reports tab. The reported person is not told who reported them.
 *
 * Styled like the My Documents modals: recessed parchment sheet with a caramel rim, Lora labels,
 * .neu-input fields and the .neu-btn-create action. Sending morphs the sheet into the submission
 * loader, which then writes a check (report sent) or an X (SubmissionModal).
 */
import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
import { CloseIcon, FileIcon, NeuAlert } from '@/components/shared/neu';
import { SubmissionModal, settle, useSubmission } from '@/components/shared/feedback';

interface ReportAccountModalProps {
  open: boolean;
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

const labelClass = 'block font-lora text-[13px] sm:text-sm font-medium text-[#5A4537] pl-0.5 select-none';

const FlagIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 21V4.5m0 0h11.5l-2 4.25 2 4.25H5" />
  </svg>
);

const UploadIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 16V8m0 0l-3.25 3.25M12 8l3.25 3.25M6.75 19.5a4.5 4.5 0 01-1.41-8.78 5.25 5.25 0 0110.23-2.33 3 3 0 013.76 3.85A3.75 3.75 0 0118 19.5H6.75z" />
  </svg>
);

const TITLE_ID = 'report-account-title';

/** The dialog; mounted fresh each time it opens, so the form always starts empty. */
function ReportDialog({ threadId, targetName, targetRole, onClose }: Omit<ReportAccountModalProps, 'open'>) {
  const [reasonKey, setReasonKey] = useState<string>('');
  const [details, setDetails] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [includeConversation, setIncludeConversation] = useState(true);
  const submission = useSubmission();
  const submitting = submission.processing;
  /** Problems with the chosen files (the send error is shown by the submission card). */
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const roleWord = targetRole === 'lawyer' ? 'attorney' : 'client';
  const reason = REPORT_REASONS.find((r) => r.key === reasonKey);
  const trimmed = details.trim();
  const detailsOk = trimmed.length >= REPORT_DETAILS_MIN && trimmed.length <= REPORT_DETAILS_MAX;
  const valid = !!reason && detailsOk;

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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setError(null);
    const fd = new FormData();
    fd.append('threadId', threadId);
    fd.append('reasonKey', reasonKey);
    fd.append('details', trimmed);
    fd.append('includeConversation', includeConversation ? 'true' : 'false');
    files.forEach((f) => fd.append('files', f));
    void submission.run(() =>
      settle(() => submitAccountReportAction(fd), 'We could not send your report. Please check your connection and try again.')
    );
  };

  return (
    <SubmissionModal
      phase={submission.phase}
      titleId={TITLE_ID}
      size="sm"
      onClose={onClose}
      onRetry={submission.reset}
      error={submission.error}
      processing={{ title: 'Sending your report', message: 'Sending it securely to the Justicia team.' }}
      success={{
        title: 'Report sent',
        message: `Thank you. We review every report and will notify you of the decision. ${targetName} won't be told who reported them.`,
      }}
      failure={{ title: "We couldn't send your report", retryLabel: 'Review Report' }}
    >
    <div className="relative min-h-0 flex-1 overflow-y-auto neu-scrollbar-discrete px-6 sm:px-9 pt-8 pb-7 sm:pt-9 sm:pb-8">
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        aria-label="Close dialog"
        className="absolute top-4 right-4 sm:top-5 sm:right-5 size-9 rounded-full flex items-center justify-center text-[#5A4537] hover:text-[#34150F] hover:bg-[#D4C1AB]/40 hover:rotate-90 transition-[color,background-color,rotate] duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/50 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
      >
        <CloseIcon className="w-3 h-3" />
      </button>
      {/* Header */}
      <div className="text-center mb-5">
        <div className="pm-pop mx-auto size-14 rounded-full neu-raised-sm flex items-center justify-center text-[#B42318] mb-3">
          <FlagIcon />
        </div>
        <h2 id={TITLE_ID} className="font-lora text-2xl sm:text-[26px] font-normal text-[#34150F] leading-tight px-6">
          Report {roleWord}
        </h2>
        <p className="font-inter text-xs text-[#7A604D] mt-2">
          About <span className="font-semibold text-[#34150F]">{targetName}</span> · they won&apos;t see who reported them.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* Reason */}
        <div>
          <label htmlFor="report-reason" className={`${labelClass} mb-2`}>
            Reason:
          </label>
          <select
            id="report-reason"
            value={reasonKey}
            disabled={submitting}
            onChange={(e) => setReasonKey(e.target.value)}
            className={`neu-input font-lora w-full h-11 rounded-[11px] px-4 text-sm focus:outline-none cursor-pointer ${reasonKey ? 'text-[#34150F]' : 'text-[#9A8270]'}`}
          >
            <option value="" disabled>
              Choose what happened…
            </option>
            {REPORT_REASONS.map((r) => (
              <option key={r.key} value={r.key} className="text-[#34150F]">
                {r.label}
              </option>
            ))}
          </select>
          <AnimatePresence mode="wait" initial={false}>
            {reason && (
              <motion.p
                key={reason.key}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
                className="font-inter text-[11px] text-[#7D6855] mt-1.5 pl-1 leading-snug"
              >
                {reason.description}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Details */}
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <label htmlFor="report-details" className={labelClass}>
              What happened:
            </label>
            <span
              className={`font-inter text-[10.5px] tabular-nums transition-colors ${
                detailsOk ? 'text-[#1F7A3A]' : trimmed.length > 0 ? 'text-[#B42318]' : 'text-[#9A8270]'
              }`}
            >
              {trimmed.length < REPORT_DETAILS_MIN
                ? `${trimmed.length}/${REPORT_DETAILS_MIN} min`
                : `${trimmed.length}/${REPORT_DETAILS_MAX}`}
            </span>
          </div>
          <textarea
            id="report-details"
            rows={3}
            value={details}
            maxLength={REPORT_DETAILS_MAX}
            disabled={submitting}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="When it happened, what was said or done, and anything else we should know."
            className="neu-input font-lora w-full rounded-[11px] px-4 py-3 text-sm text-[#34150F] placeholder-[#9A8270]/70 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        {/* Proof */}
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <span className={labelClass}>Proof (optional):</span>
            <span className="font-inter text-[10.5px] text-[#9A8270]">
              {files.length}/{REPORT_MAX_FILES} · 5 MB each
            </span>
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => !submitting && fileInput.current?.click()}
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
            className={`group neu-input h-12 rounded-[11px] px-4 flex items-center gap-3 cursor-pointer transition-[transform,box-shadow] duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/45 ${
              dragOver ? 'scale-[1.015] ring-2 ring-[#C58B3C]/60' : ''
            }`}
          >
            <UploadIcon className="w-5 h-5 text-[#5C4535] shrink-0 transition-transform duration-500 group-hover:-translate-y-0.5" />
            <span className="min-w-0 flex-1 font-lora text-[13px] text-[#34150F] truncate">
              {dragOver ? 'Drop to attach' : 'Drop screenshots here, or click to browse'}
            </span>
            <span className="font-inter text-[10.5px] text-[#9A8270] shrink-0 hidden sm:inline">PNG · JPG · PDF</span>
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
            <ul className="flex flex-wrap gap-2 mt-3">
              <AnimatePresence initial={false}>
                {files.map((f, i) => (
                  <motion.li
                    key={`${f.name}-${f.size}`}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="neu-raised-sm rounded-full pl-2.5 pr-1 py-1 flex items-center gap-2 max-w-full"
                  >
                    <FileIcon className="w-3.5 h-3.5 text-[#C58B3C] shrink-0" />
                    <span className="min-w-0 font-inter text-[11px] text-[#34150F] truncate max-w-[160px]" title={f.name}>
                      {f.name}
                    </span>
                    <span className="font-inter text-[10px] text-[#8C7A6B] shrink-0">{formatSize(f.size)}</span>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${f.name}`}
                      className="size-6 rounded-full flex items-center justify-center text-[#7D6855] hover:text-[#B42318] hover:bg-[#B42318]/10 transition-colors cursor-pointer"
                    >
                      <CloseIcon className="w-2.5 h-2.5" />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {/* Include the conversation */}
        <button
          type="button"
          role="switch"
          aria-checked={includeConversation}
          disabled={submitting}
          onClick={() => setIncludeConversation((v) => !v)}
          className="w-full flex items-center gap-3.5 text-left cursor-pointer group"
        >
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full neu-input transition-colors duration-300 ${
              includeConversation ? '!bg-[#D39758]/45' : ''
            }`}
          >
            <motion.span
              initial={false}
              animate={{ x: includeConversation ? 20 : 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 32 }}
              className="absolute top-[3px] left-[3px] size-[18px] rounded-full neu-raised-sm"
            />
          </span>
          <span className="min-w-0">
            <span className="block font-lora text-[13px] font-medium text-[#34150F]">Include this conversation</span>
            <span className="block font-inter text-[11px] text-[#7D6855] mt-0.5">So our team can review the messages.</span>
          </span>
        </button>

        <AnimatePresence>
          {(error || (submission.phase === 'idle' && submission.error)) && (
            <NeuAlert key="report-error" tone="error">
              {error || submission.error}
            </NeuAlert>
          )}
        </AnimatePresence>

        {/* Actions (same as the Documents modals) */}
        <div className="pt-2 flex flex-col items-center">
          <button
            type="submit"
            disabled={!valid || submitting}
            className="neu-btn-create w-[240px] sm:w-[260px] text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase py-3 sm:py-3.5 px-6 rounded-[14px] active:translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/60"
          >
            Send Report
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="mt-3.5 text-xs font-inter text-[#7A604D] hover:text-[#99431E] hover:underline transition-colors duration-200 cursor-pointer select-none disabled:opacity-50"
          >
            Cancel
          </button>
          <p className="font-inter text-[10.5px] text-[#9A8270] text-center mt-3 leading-snug max-w-[300px]">
            False or abusive reports may lead to action on your own account.
          </p>
        </div>
      </form>
    </div>
    </SubmissionModal>
  );
}

export function ReportAccountModal({ open, threadId, targetName, targetRole, onClose }: ReportAccountModalProps) {
  return (
    <AnimatePresence>
      {open && <ReportDialog key="report-account" threadId={threadId} targetName={targetName} targetRole={targetRole} onClose={onClose} />}
    </AnimatePresence>
  );
}

export default ReportAccountModal;
