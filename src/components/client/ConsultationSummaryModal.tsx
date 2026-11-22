'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ClientConsultation } from '@/app/actions/consultationActions';

/** View model for the design1 summary card (client or lawyer perspective). */
export interface ConsultationSummaryData {
  dateStr: string;
  timeSlot: string;
  status: string;
  /** Caramel badge while awaiting action, green once confirmed, red when closed. */
  tone: 'pending' | 'confirmed' | 'closed';
  personName: string;
  personLines: string[];
  rate: number | null;
  docket: string;
  caseTitle: string;
  caseDescription: string;
}

export function clientConsultationToSummary(c: ClientConsultation): ConsultationSummaryData {
  return {
    dateStr: c.dateStr,
    timeSlot: c.timeSlot,
    status: c.status,
    tone:
      c.rawStatus === 'confirmed' || c.rawStatus === 'completed'
        ? 'confirmed'
        : c.rawStatus === 'declined' || c.rawStatus === 'cancelled'
          ? 'closed'
          : 'pending',
    personName: c.lawyerName,
    personLines: [
      `Roll No. ${c.rollNumber}  |  IBP ${c.ibpChapter}`,
      c.practiceAreas.join(' • '),
      `☆ ${c.rating} • ${c.experienceYrs} yrs practice`,
    ],
    rate: c.ratePerHour,
    docket: c.docket,
    caseTitle: c.caseTitle,
    caseDescription: c.caseDescription,
  };
}

interface ConsultationSummaryModalProps {
  data: ConsultationSummaryData;
  onClose: () => void;
}

const INSET_PILL_SHADOW =
  'inset 2px 2px 4px rgba(165, 140, 115, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.95)';

const TONE_STYLES: Record<ConsultationSummaryData['tone'], { className: string; shadow: string }> = {
  pending: { className: 'bg-[#D49E56]', shadow: '4px 6px 14px rgba(212, 158, 86, 0.4)' },
  confirmed: { className: 'bg-[#27AE60]', shadow: '4px 6px 16px rgba(39, 174, 96, 0.4)' },
  closed: { className: 'bg-red-700', shadow: '0 4px 12px rgba(185, 28, 28, 0.4)' },
};

/**
 * Consultation summary card (public/modal-design/design1.png).
 * Used after a client submits a booking and for "View Details".
 */
export function ConsultationSummaryModal({ data, onClose }: ConsultationSummaryModalProps) {
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

  const tone = TONE_STYLES[data.tone];

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6 md:p-8 animate-in fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consultation-summary-title"
      onClick={onClose}
    >
      <div
        className="neu-modal outline-[#D39758] relative w-full max-w-[94vw] sm:max-w-2xl lg:max-w-3xl max-h-[88vh] flex flex-col rounded-[26px] sm:rounded-[30px] p-6 sm:p-8 lg:p-9 bg-[#E5D8CB] space-y-5 sm:space-y-6 animate-in zoom-in-95 duration-200 shadow-2xl my-auto overflow-y-auto neu-scrollbar-discrete"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Date / Time / Status pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="neu-recessed px-4 sm:px-5 py-2 rounded-full font-lora text-[10.5px] sm:text-xs font-bold text-[#5C4535] uppercase tracking-wider select-none">
              {data.dateStr}
            </div>
            <div className="neu-recessed px-4 sm:px-5 py-2 rounded-full font-lora text-[10.5px] sm:text-xs font-bold text-[#5C4535] select-none">
              {data.timeSlot}
            </div>
          </div>
          <div
            className={`px-5 sm:px-6 py-2 rounded-full font-lora text-[10px] sm:text-[10.5px] font-bold tracking-wider uppercase text-white select-none ${tone.className} shadow-sm`}
          >
            {data.status}
          </div>
        </div>

        {/* Person banner plate (lawyer for clients, client for lawyers) */}
        <div
          className="neu-raised-highlight rounded-[20px] sm:rounded-[22px] p-4.5 sm:p-5 lg:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6"
          style={{ backgroundColor: 'rgba(211, 151, 88, 0.3)' }}
        >
          <div className="flex items-center gap-3.5 sm:gap-4.5 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-[3px] sm:border-[3.5px] border-[#341512] flex items-center justify-center shrink-0 select-none">
              <svg
                className="w-8 h-8 sm:w-10 sm:h-10 text-[#341512]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="3.8" />
                <path d="M5 20c0-3.8 3.1-6.5 7-6.5s7 2.7 7 6.5" />
              </svg>
            </div>
            <div className="space-y-1 min-w-0">
              <h4 className="font-lora text-base sm:text-lg lg:text-xl font-bold text-[#341512] leading-tight">
                {data.personName}
              </h4>
              {data.personLines.filter(Boolean).map((line, idx) => (
                <p key={idx} className="font-lora text-[10.5px] sm:text-[11.5px] text-[#5C4535] font-medium whitespace-pre-wrap break-words leading-tight">
                  {line}
                </p>
              ))}
            </div>
          </div>
          {data.rate !== null && (
            <div className="sm:text-right shrink-0">
              <span className="font-lora text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#341512] leading-none">
                ₱{data.rate.toLocaleString()}
              </span>
              <span className="font-lora text-xs sm:text-sm text-[#341512] ml-1">/per hour</span>
            </div>
          )}
        </div>

        {/* Subject matter & case docket */}
        <div className="space-y-2 pt-0.5">
          <div className="font-lora font-bold text-[9.5px] sm:text-[10.5px] text-[#C58B3C] uppercase tracking-wider">
            {data.docket}
          </div>
          <h3
            id="consultation-summary-title"
            className="font-lora text-base sm:text-lg lg:text-xl font-bold text-[#341512] leading-snug"
          >
            {data.caseTitle}
          </h3>
          <div className="font-lora text-xs sm:text-[13px] text-[#3E2A1E] leading-relaxed text-justify space-y-3 pt-1">
            {data.caseDescription.split(/\n\n+/).map((para, idx) => (
              <p key={idx} className="indent-6 sm:indent-8 whitespace-pre-line">
                {para.trim()}
              </p>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2 sm:pt-3">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="neu-btn-caramel px-8 sm:px-10 py-2.5 rounded-xl font-lora text-xs sm:text-sm font-bold text-[#341512] bg-[#D49E56] transition-all hover:brightness-105 active:scale-95 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConsultationSummaryModal;
