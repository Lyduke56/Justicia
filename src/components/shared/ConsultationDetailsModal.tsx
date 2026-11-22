'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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

const INSET_PILL_SHADOW =
  'inset 2px 2px 4px rgba(165, 140, 115, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.95)';
const RAISED_SHADOW =
  '6px 8px 18px rgba(165, 135, 105, 0.35), -6px -6px 14px rgba(255, 255, 255, 0.85)';
const INSET_SHADOW =
  'inset 4px 4px 10px rgba(165, 140, 115, 0.4), inset -4px -4px 10px rgba(255, 255, 255, 0.85)';

const TONES: Record<DetailsStatusTone, { bg: string; shadow: string }> = {
  caramel: { bg: 'bg-[#D49E56]', shadow: '4px 6px 14px rgba(212, 158, 86, 0.4)' },
  red: { bg: 'bg-[#E60000]', shadow: '4px 6px 14px rgba(230, 0, 0, 0.35)' },
  green: { bg: 'bg-[#1FAA00]', shadow: '4px 6px 14px rgba(31, 170, 0, 0.35)' },
  amber: { bg: 'bg-[#C9822B]', shadow: '4px 6px 14px rgba(201, 130, 43, 0.4)' },
  grey: { bg: 'bg-stone-500', shadow: '4px 6px 14px rgba(120, 113, 108, 0.35)' },
};

const BUTTON_STYLES: Record<DetailsModalAction['variant'], { className: string }> = {
  outline: {
    className: 'neu-raised-sm bg-[#E5D8CB] border border-[#341512]/60 text-[#341512] hover:bg-[#DDCFC0]',
  },
  espresso: {
    className: 'neu-btn-espresso bg-[#4A2E25] text-white hover:brightness-110',
  },
  caramel: {
    className: 'neu-btn-caramel bg-[#D49E56] text-[#341512] hover:brightness-105 font-bold',
  },
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

export function ConsultationDetailsModal(props: ConsultationDetailsModalProps) {
  const { onClose } = props;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tone = TONES[props.statusTone];

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 md:p-8 animate-in fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consultation-details-title"
      onClick={onClose}
    >
      <div
        className="neu-modal outline-[#D39758] relative w-full max-w-[94vw] sm:max-w-2xl lg:max-w-3xl max-h-[88vh] flex flex-col rounded-[26px] sm:rounded-[30px] p-6 sm:p-8 lg:p-9 bg-[#E5D8CB] space-y-5 sm:space-y-6 animate-in zoom-in-95 duration-200 shadow-2xl my-auto overflow-y-auto neu-scrollbar-discrete"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Date / Time / Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="neu-recessed px-4 sm:px-5 py-2 rounded-full font-lora text-[10.5px] sm:text-xs font-bold text-[#5C4535] uppercase tracking-wider select-none">
              {props.dateStr}
            </div>
            <div className="neu-recessed px-4 sm:px-5 py-2 rounded-full font-lora text-[10.5px] sm:text-xs font-bold text-[#5C4535] select-none">
              {props.timeSlot}
            </div>
          </div>
          <div
            className={`px-5 sm:px-6 py-2 rounded-full font-lora text-[10px] sm:text-[10.5px] font-bold tracking-wider uppercase text-white select-none ${tone.bg} shadow-sm`}
          >
            {props.statusLabel}
          </div>
        </div>

        {/* Person banner */}
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
              <h4 className="font-lora text-base sm:text-lg lg:text-xl font-bold text-[#341512] leading-tight">{props.person.name}</h4>
              {props.person.lines.filter(Boolean).map((line, idx) => (
                <p key={idx} className="font-lora text-[10.5px] sm:text-[11.5px] text-[#5C4535] font-medium whitespace-pre-wrap break-words leading-tight">
                  {line}
                </p>
              ))}
            </div>
          </div>
          {props.person.onMessage ? (
            <button
              type="button"
              onClick={props.person.onMessage}
              className="neu-btn-caramel px-6 py-2 rounded-full font-lora text-xs sm:text-sm font-semibold text-[#341512] shrink-0 self-start sm:self-center hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              Message
            </button>
          ) : props.person.rate !== null && props.person.rate !== undefined ? (
            <div className="sm:text-right shrink-0">
              <span className="font-lora text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#341512] leading-none">
                ₱{props.person.rate.toLocaleString()}
              </span>
              <span className="font-lora text-xs sm:text-sm text-[#341512] ml-1">/per hour</span>
            </div>
          ) : null}
        </div>

        {/* Docket & Full Case Description */}
        <div className="space-y-2 pt-0.5">
          <div className="font-lora font-bold text-[9.5px] sm:text-[10.5px] text-[#C58B3C] uppercase tracking-wider">{props.docket}</div>
          <h3 id="consultation-details-title" className="font-lora text-base sm:text-lg lg:text-xl font-bold text-[#341512] leading-snug">
            {props.caseTitle}
          </h3>
          <div className="font-inter font-light text-xs sm:text-[13px] text-[#3E2A1E] leading-relaxed text-justify space-y-3 pt-1">
            {props.caseDescription.split(/\n\n+/).map((para, idx) => (
              <p key={idx} className="indent-6 sm:indent-8 whitespace-pre-line">
                {para.trim()}
              </p>
            ))}
          </div>
        </div>

        {props.notice && (
          <div
            className={`rounded-2xl px-4 py-3 text-xs sm:text-[13px] border ${props.notice.tone === 'red'
              ? 'bg-red-100/70 border-red-200 text-red-900'
              : 'bg-amber-100/70 border-amber-200 text-amber-900'
              }`}
          >
            <p className="font-bold">{props.notice.title}</p>
            <p className="mt-0.5 whitespace-pre-line">{props.notice.text}</p>
          </div>
        )}

        {/* Booking / Payment summary */}
        {props.summary && (
          <div className="space-y-4 sm:space-y-5 pt-1">
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
                    <div className="w-full max-w-[180px] aspect-square bg-[#EFE5D8] flex items-center justify-center p-4 text-[11px] text-[#7D6855] rounded-xl">
                      The payment QR code has not been set up yet. Please message your attorney for payment instructions.
                    </div>
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

        {props.error && (
          <p className="text-xs font-semibold text-red-800 bg-red-100 border border-red-300 rounded-xl px-3.5 py-2">
            {props.error}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-3 pt-2 sm:pt-3">
          {props.actions.map((action) => {
            const style = BUTTON_STYLES[action.variant];
            return (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={`min-w-[96px] px-6 sm:px-7 py-2.5 rounded-xl text-xs sm:text-sm font-lora font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 cursor-pointer ${style.className}`}
              >
                {action.icon === 'video' && <VideoIcon className="w-4 h-4" />}
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConsultationDetailsModal;
