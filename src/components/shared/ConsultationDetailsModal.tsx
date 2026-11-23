'use client';

import React, { useEffect, useRef, useState } from 'react';
import { NeuModal, NeuButton, NeuAlert, EmptyState, QrIcon } from '@/components/shared/neu';

/**
 * Consultation "View Details" modal shared by the client and lawyer portals.
 * Layouts (public/modal-design):
 *  - pending-nvonfirmed.png / design1.png → header, person banner, docket
 *  - payment.png         → + Booking Summary with QR and proof-of-payment dropzone
 *  - pending-payment.png → + Booking Summary (full width)
 *  - confirmed-and-paid.png → + Payment Summary and Proof of Payment
 */

export type DetailsStatusTone = 'caramel' | 'red' | 'green' | 'amber' | 'grey';

export interface DetailsModalAction {
  label: string;
  variant: 'outline' | 'espresso' | 'caramel';
  icon?: 'video';
  onClick: () => void;
  disabled?: boolean;
}

export interface DetailsSummary {
  title: 'Booking Summary' | 'Payment Summary';
  lawyerName: string;
  lawyerMeta: string;
  modeLabel: string;
  modeMeta: string;
  dateLong: string;
  timeRange: string;
  sessionFee: number;
  platformFee: number;
  total: number;
}

export interface DetailsPaymentInput {
  qrImageUrl: string | null;
  qrCaption: string | null;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export interface ConsultationDetailsModalProps {
  dateStr: string;
  timeSlot: string;
  statusLabel: string;
  statusTone: DetailsStatusTone;
  person: { name: string; lines: string[]; rate?: number | null; onMessage?: () => void };
  docket: string;
  caseTitle: string;
  caseDescription: string;
  notice?: { tone: 'red' | 'amber'; title: string; text: string } | null;
  summary?: DetailsSummary | null;
  payment?: DetailsPaymentInput | null;
  proof?: { fileName: string; onOpen?: () => void } | null;
  error?: string | null;
  actions: DetailsModalAction[];
  onClose: () => void;
}

const peso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TONES: Record<DetailsStatusTone, { bg: string }> = {
  caramel: { bg: 'bg-[#D49E56]' },
  red: { bg: 'bg-[#E60000]' },
  green: { bg: 'bg-[#1FAA00]' },
  amber: { bg: 'bg-[#C9822B]' },
  grey: { bg: 'bg-stone-500' },
};

const BUTTON_VARIANT: Record<DetailsModalAction['variant'], 'secondary' | 'dark' | 'primary'> = {
  outline: 'secondary',
  espresso: 'dark',
  caramel: 'primary',
};

function VideoIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="13" height="14" rx="2" />
      <path d="M16 10l5-3v10l-5-3" />
      <circle cx="9.5" cy="10.5" r="2" />
      <path d="M6.5 16c.6-1.4 1.7-2 3-2s2.4.6 3 2" />
    </svg>
  );
}

function PhoneIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function CalendarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function ImageIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M21 15l-5-5L5 21" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </svg>
  );
}

function UploadTrayIcon({ className = 'w-14 h-14' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-3" />
      <path d="M12 2v11M8 9l4 4 4-4" />
    </svg>
  );
}

function SummaryCard({ summary }: { summary: DetailsSummary }) {
  const dotted = 'border-t border-dotted border-[#C8B59E]';
  const isAudio = summary.modeLabel.toLowerCase().includes('audio');
  return (
    <div className="neu-raised bg-[#E5D8CB] rounded-[22px] p-5 sm:p-6 space-y-3">
      <div>
        <p className="font-lora text-base sm:text-lg font-bold text-[#341512] leading-tight">{summary.lawyerName}</p>
        <p className="font-lora text-[10px] text-[#5C4535]">{summary.lawyerMeta}</p>
      </div>
      <div className={`pt-3 ${dotted}`}>
        <p className="flex items-center gap-2 font-lora text-base font-semibold text-[#341512]">
          {isAudio ? <PhoneIcon /> : <VideoIcon />} {summary.modeLabel}
        </p>
        <p className="font-lora text-[10px] text-[#5C4535]">{summary.modeMeta}</p>
      </div>
      <div className={`pt-3 ${dotted}`}>
        <p className="flex items-center gap-2 font-lora text-base font-semibold text-[#341512]">
          <CalendarIcon /> {summary.dateLong}
        </p>
        <p className="font-lora text-[10px] text-[#5C4535]">{summary.timeRange}</p>
      </div>
      <div className={`pt-3 space-y-1.5 ${dotted}`}>
        <div className="flex items-center justify-between font-lora text-[11px] text-[#5C4535]">
          <span>Session Legal Fee</span>
          <span className="font-lora text-sm font-semibold text-[#341512]">{peso(summary.sessionFee)}</span>
        </div>
        <div className="flex items-center justify-between font-lora text-[11px] text-[#5C4535]">
          <span>Platform Convenience Fee</span>
          <span className="font-lora text-sm font-semibold text-[#341512]">{peso(summary.platformFee)}</span>
        </div>
      </div>
      <div className="pt-3 border-t-2 border-[#C9B8A4] flex items-center justify-between">
        <span className="font-lora text-sm font-semibold uppercase text-[#341512]">Total:</span>
        <span className="font-lora text-lg font-bold text-[#341512]">{peso(summary.total)}</span>
      </div>
    </div>
  );
}

function PaymentDropzone({ payment }: { payment: DetailsPaymentInput }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) payment.onFileChange(file);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !payment.disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !payment.disabled) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!payment.disabled) pick(e.dataTransfer.files);
      }}
      className={`neu-recessed rounded-[22px] py-8 sm:py-9 px-6 flex flex-col items-center justify-center text-center gap-3 transition-colors ${payment.disabled ? 'cursor-wait opacity-70' : 'cursor-pointer'
        } ${dragging ? 'bg-[#DDCFC0]' : 'bg-[#E5D8CB]'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,application/pdf"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
      <UploadTrayIcon className="w-12 h-12 text-[#7D6855]" />
      {payment.file ? (
        <span className="font-lora text-sm text-[#4A3525] flex items-center gap-2">
          <ImageIcon className="w-4 h-4" />
          {payment.file.name}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              payment.onFileChange(null);
            }}
            className="text-red-700 font-bold ml-1 cursor-pointer"
            aria-label="Remove selected file"
          >
            ✕
          </button>
        </span>
      ) : (
        <span className="font-lora text-sm text-[#9E8E7D]">Drag and Drop, or Attach Proof of Payment</span>
      )}
    </div>
  );
}

/**
 * Top section of the details view (status row, person banner, docket + description).
 * Shared by the modal and the client's consultation booking card so both stay identical.
 */
type StatusRowProps = Pick<ConsultationDetailsModalProps, 'dateStr' | 'timeSlot' | 'statusLabel' | 'statusTone'> & {
  /**
   * Keep date, time and status on one row by scaling the pills with the width of their container
   * (the client's booking card). Below 38.75rem there's no room at a readable size, so the row
   * keeps the regular sizes and wraps.
   */
  fit?: boolean;
};

export function DetailsStatusRow({ fit = false, ...props }: StatusRowProps) {
  if (fit) return <FitStatusRow {...props} />;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="neu-raised-pill bg-[#E5D8CB] px-4 sm:px-5 py-2 rounded-full font-lora text-[10.5px] sm:text-xs font-bold text-[#5C4535] uppercase tracking-wider select-none">
          {props.dateStr}
        </div>
        <div className="neu-raised-pill bg-[#E5D8CB] px-4 sm:px-5 py-2 rounded-full font-lora text-[10.5px] sm:text-xs font-bold text-[#5C4535] select-none">
          {props.timeSlot}
        </div>
      </div>
      <div
        className={`neu-raised-pill px-5 sm:px-6 py-2 rounded-full font-lora text-[10px] sm:text-[10.5px] font-bold tracking-wider uppercase text-white select-none ${TONES[props.statusTone].bg}`}
      >
        {props.statusLabel}
      </div>
    </div>
  );
}

/**
 * Fit mode. From 38.75rem of container width the row's font size is 1/60 of that width (10.25px
 * to 12px), and every size inside is in em, so at 12px it is exactly the regular desktop row. That
 * row measures 56-58em with the longest date, time and status, so the three always share one line
 * and grow or shrink together; the status text never drops below 9px. Narrower containers get the
 * regular row.
 */
function FitStatusRow(props: Omit<StatusRowProps, 'fit'>) {
  return (
    <div className="@container">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 @min-[38.75rem]:gap-x-[1.333em] @min-[38.75rem]:text-[clamp(10.25px,1.667cqw,12px)]">
        <div className="flex flex-wrap items-center gap-3 @min-[38.75rem]:gap-[1em]">
          <div className="neu-raised-pill bg-[#E5D8CB] px-4 sm:px-5 py-2 rounded-full font-lora text-[10.5px] sm:text-xs font-bold text-[#5C4535] uppercase tracking-wider select-none @min-[38.75rem]:whitespace-nowrap @min-[38.75rem]:px-[1.667em] @min-[38.75rem]:py-[0.667em] @min-[38.75rem]:text-[1em]">
            {props.dateStr}
          </div>
          <div className="neu-raised-pill bg-[#E5D8CB] px-4 sm:px-5 py-2 rounded-full font-lora text-[10.5px] sm:text-xs font-bold text-[#5C4535] select-none @min-[38.75rem]:whitespace-nowrap @min-[38.75rem]:px-[1.667em] @min-[38.75rem]:py-[0.667em] @min-[38.75rem]:text-[1em]">
            {props.timeSlot}
          </div>
        </div>
        <div
          className={`neu-raised-pill px-5 sm:px-6 py-2 rounded-full font-lora text-[10px] sm:text-[10.5px] font-bold tracking-wider uppercase text-white select-none @min-[38.75rem]:whitespace-nowrap @min-[38.75rem]:px-[2.286em] @min-[38.75rem]:py-[0.762em] @min-[38.75rem]:text-[0.875em] ${TONES[props.statusTone].bg}`}
        >
          {props.statusLabel}
        </div>
      </div>
    </div>
  );
}

export function DetailsPersonBanner({ person }: { person: ConsultationDetailsModalProps['person'] }) {
  return (
    <div
      className="neu-raised-highlight rounded-[20px] sm:rounded-[22px] p-4.5 sm:p-5 lg:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6"
      style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
    >
      <div className="flex items-center gap-3.5 sm:gap-4.5 min-w-0">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-[3px] sm:border-[3.5px] border-[#341512] flex items-center justify-center shrink-0 select-none">
          <svg className="w-8 h-8 sm:w-10 sm:h-10 text-[#341512]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="3.8" />
            <path d="M5 20c0-3.8 3.1-6.5 7-6.5s7 2.7 7 6.5" />
          </svg>
        </div>
        <div className="space-y-1 min-w-0">
          <h4 className="font-lora text-base sm:text-lg lg:text-xl font-bold text-[#341512] leading-tight">{person.name}</h4>
          {person.lines.filter(Boolean).map((line, idx) => (
            <p key={idx} className="font-inter font-light text-[10.5px] sm:text-[11.5px] text-[#5C4535] whitespace-pre-wrap break-words leading-tight">
              {line}
            </p>
          ))}
        </div>
      </div>
      {person.onMessage ? (
        <button
          type="button"
          onClick={person.onMessage}
          className="neu-btn-banner px-6 sm:px-7 py-2 sm:py-2.5 rounded-full font-lora text-xs sm:text-sm font-semibold text-[#341512] shrink-0 self-start sm:self-center cursor-pointer"
        >
          Message
        </button>
      ) : person.rate !== null && person.rate !== undefined ? (
        <div className="sm:text-right shrink-0">
          <span className="font-lora text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#341512] leading-none">
            ₱{person.rate.toLocaleString()}
          </span>
          <span className="font-lora text-xs sm:text-sm text-[#341512] ml-1">/per hour</span>
        </div>
      ) : null}
    </div>
  );
}

type CaseBlockProps = Pick<ConsultationDetailsModalProps, 'docket' | 'caseTitle' | 'caseDescription'> & {
  titleId?: string;
  /**
   * When set, the description fills only the space its parent leaves it and is cut off with a
   * "See More" link if it doesn't fit (the parent must give this block a bounded height).
   */
  onSeeMore?: () => void;
  /**
   * With onSeeMore: always show exactly this many lines, at every breakpoint, in a card of natural
   * height (the lawyer dashboard). Without it, lg+ fills the space the parent's fixed height leaves.
   */
  previewLines?: number;
};

/** Lines the truncated description shows below the lg breakpoint, where the card has no fixed height. */
const COMPACT_PREVIEW_LINES = 6;

export function DetailsCaseBlock({ titleId, onSeeMore, previewLines, ...props }: CaseBlockProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const [clamp, setClamp] = useState<{ height: number; lineHeight: number; overflowing: boolean } | null>(null);
  const truncate = Boolean(onSeeMore);

  // Cut the preview at a whole line so "… See More" can sit at the end of the last visible line.
  // lg+: as many lines as fit in the space the card leaves (the text is absolutely positioned, so
  // the wrapper's height comes from the layout, not the text). Smaller screens: a fixed line count.
  useEffect(() => {
    const wrap = wrapRef.current;
    const desc = descRef.current;
    if (!truncate || !wrap || !desc) return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(desc).lineHeight) || 20;
      const bounded = !previewLines && window.matchMedia('(min-width: 1024px)').matches;
      const lines = previewLines
        ? previewLines
        : bounded
          ? Math.max(2, Math.floor(wrap.clientHeight / lineHeight))
          : COMPACT_PREVIEW_LINES;
      const height = lines * lineHeight;
      setClamp({ height, lineHeight, overflowing: desc.scrollHeight > height + 1 });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [truncate, previewLines, props.caseDescription]);

  const paragraphs = props.caseDescription.split(/\n\n+/).map((para, idx) => (
    <p key={idx} className="indent-6 sm:indent-8 whitespace-pre-line">
      {para.trim()}
    </p>
  ));
  const textClass = 'font-inter font-light text-xs sm:text-[13px] text-[#3E2A1E] leading-relaxed text-justify';

  if (!truncate) {
    return (
      <div className="space-y-2 pt-0.5">
        <div className="font-lora font-bold text-[9.5px] sm:text-[10.5px] text-[#C58B3C] uppercase tracking-wider">{props.docket}</div>
        <h3 id={titleId} className="font-lora text-base sm:text-lg lg:text-xl font-bold text-[#341512] leading-snug">
          {props.caseTitle}
        </h3>
        <div className={`${textClass} space-y-3 pt-1`}>{paragraphs}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 pt-0.5">
      <div className="font-lora font-bold text-[9.5px] sm:text-[10.5px] text-[#C58B3C] uppercase tracking-wider">{props.docket}</div>
      <h3 id={titleId} className="font-lora text-base sm:text-lg lg:text-xl font-bold text-[#341512] leading-snug">
        {props.caseTitle}
      </h3>
      <div ref={wrapRef} className={`relative mt-1 ${previewLines ? '' : 'flex-1 min-h-0'}`}>
        {/* No paragraph gaps in the preview, so every line sits on the line-height grid. */}
        <div
          ref={descRef}
          className={`${textClass} relative overflow-hidden ${previewLines ? '' : 'lg:absolute lg:inset-x-0 lg:top-0'}`}
          style={clamp ? { maxHeight: clamp.height } : undefined}
        >
          {paragraphs}
          {clamp?.overflowing && (
            <button
              type="button"
              onClick={onSeeMore}
              className="absolute right-0 bottom-0 pl-10 pr-0.5 font-inter text-xs sm:text-[13px] cursor-pointer group"
              style={{
                height: clamp.lineHeight,
                lineHeight: `${clamp.lineHeight}px`,
                background: 'linear-gradient(to right, rgba(229, 216, 203, 0), #E5D8CB 2.25rem)',
              }}
            >
              <span className="font-light text-[#3E2A1E]">…</span>{' '}
              <span className="font-semibold text-[#C58B3C] group-hover:text-[#A8742E] group-hover:underline">See More</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConsultationDetailsModal(props: ConsultationDetailsModalProps) {
  return (
    <NeuModal
      onClose={props.onClose}
      size="xl"
      labelledBy="consultation-details-title"
      footer={props.actions.map((action) => (
        <NeuButton
          key={action.label}
          variant={BUTTON_VARIANT[action.variant]}
          onClick={action.onClick}
          disabled={action.disabled}
          icon={action.icon === 'video' ? <VideoIcon className="w-4 h-4" /> : undefined}
        >
          {action.label}
        </NeuButton>
      ))}
    >
        <DetailsStatusRow {...props} />
        <DetailsPersonBanner person={props.person} />
        <DetailsCaseBlock {...props} titleId="consultation-details-title" />

        {props.notice && (
          <NeuAlert tone={props.notice.tone === 'red' ? 'error' : 'warning'} title={props.notice.title}>
            {props.notice.text}
          </NeuAlert>
        )}

        {/* Booking / Payment summary */}
        {props.summary && (
          <div className="space-y-5 pt-2">
            <div className="w-2/3 mx-auto border-t border-[#CDBCA8]" />
            <h4 className="font-lora text-base sm:text-lg font-bold text-[#4A3525] text-center">{props.summary.title}</h4>
            {props.payment ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 items-stretch">
                <SummaryCard summary={props.summary} />
                <div
                  className="neu-raised bg-[#E5D8CB] rounded-[22px] p-5 sm:p-6 flex flex-col items-center justify-center gap-2.5 text-center"
                >
                  {props.payment.qrImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={props.payment.qrImageUrl}
                      alt="Payment QR code"
                      className="w-full max-w-[160px] sm:max-w-[180px] aspect-square object-contain bg-white p-2.5 rounded-xl shadow-sm"
                    />
                  ) : (
                    <EmptyState
                      size="sm"
                      icon={<QrIcon />}
                      title="QR code not set up yet"
                      description="Message your attorney for payment instructions."
                    />
                  )}
                  {props.payment.qrCaption && (
                    <p className="text-[11px] text-[#4A3525] font-medium whitespace-pre-line leading-tight">{props.payment.qrCaption}</p>
                  )}
                </div>
              </div>
            ) : (
              <SummaryCard summary={props.summary} />
            )}
            {props.payment && <PaymentDropzone payment={props.payment} />}
          </div>
        )}

        {/* Proof of payment */}
        {props.proof && (
          <div className="space-y-3 pt-1">
            <h4 className="font-lora text-base sm:text-lg font-bold text-[#4A3525] text-center">Proof of Payment</h4>
            <button
              type="button"
              onClick={props.proof.onOpen}
              disabled={!props.proof.onOpen}
              className="neu-raised bg-[#E5D8CB] w-full rounded-[18px] px-5 py-3.5 flex items-center gap-3 font-lora text-xs sm:text-sm text-[#4A3525] text-left hover:brightness-[1.02] disabled:cursor-default cursor-pointer"
            >
              <ImageIcon className="w-5 h-5 shrink-0" />
              <span className="truncate">{props.proof.fileName}</span>
            </button>
          </div>
        )}

        {props.error && <NeuAlert tone="error">{props.error}</NeuAlert>}
    </NeuModal>
  );
}

export default ConsultationDetailsModal;
