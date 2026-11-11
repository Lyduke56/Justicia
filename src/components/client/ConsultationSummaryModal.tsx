'use client';

import React, { useEffect } from 'react';
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tone = TONE_STYLES[data.tone];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consultation-summary-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[28px] p-6 sm:p-9 bg-[#ECE1D2] space-y-6"
        style={{ boxShadow: '16px 16px 40px rgba(0,0,0,0.25), -8px -8px 24px rgba(255,255,255,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Date / Time / Status pills */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="px-4 py-1.5 rounded-full text-[10px] sm:text-[11px] font-lora font-bold text-[#5C4535] uppercase tracking-wider"
              style={{ backgroundColor: '#E6D7C3', boxShadow: INSET_PILL_SHADOW }}
            >
              {data.dateStr}
            </div>
            <div
              className="px-4 py-1.5 rounded-full text-[10px] sm:text-[11px] font-lora font-bold text-[#5C4535]"
              style={{ backgroundColor: '#E6D7C3', boxShadow: INSET_PILL_SHADOW }}
            >
              {data.timeSlot}
            </div>
          </div>
          <div
            className={`px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wider uppercase text-white ${tone.className}`}
            style={{ boxShadow: tone.shadow }}
          >
            {data.status}
          </div>
        </div>

        {/* Person banner plate (lawyer for clients, client for lawyers) */}
        <div
          className="rounded-[22px] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{
            backgroundColor: '#DFC5A4',
            boxShadow:
              '6px 8px 18px rgba(165, 135, 105, 0.4), 2px 2px 5px rgba(165, 135, 105, 0.2), -6px -6px 16px rgba(255, 255, 255, 0.9), -2px -2px 4px #FFFFFF',
          }}
        >
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-[3px] border-[#5C4535] flex items-center justify-center shrink-0">
              <svg
                className="w-9 h-9 sm:w-11 sm:h-11 text-[#5C4535]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M5.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
              </svg>
            </div>
            <div className="space-y-0.5 min-w-0">
              <h4 className="font-lora text-lg sm:text-xl font-bold text-[#4A3525] leading-tight">
                {data.personName}
              </h4>
              {data.personLines.filter(Boolean).map((line, idx) => (
                <p key={idx} className="text-[11px] text-[#5C4535] font-medium whitespace-pre">
                  {line}
                </p>
              ))}
            </div>
          </div>
          {data.rate !== null && (
            <div className="sm:text-right shrink-0">
              <span className="font-lora text-3xl sm:text-4xl font-bold text-[#4A3525]">
                ₱{data.rate.toLocaleString()}
              </span>
              <span className="font-lora text-sm sm:text-base text-[#4A3525] ml-1">/per hour</span>
            </div>
          )}
        </div>

        {/* Subject matter & case docket */}
        <div className="space-y-2">
          <div className="font-lora font-bold text-[10px] text-[#C58B3C] uppercase tracking-wider">
            {data.docket}
          </div>
          <h3
            id="consultation-summary-title"
            className="font-lora text-lg sm:text-xl font-bold text-[#4A3525] leading-tight"
          >
            {data.caseTitle}
          </h3>
          <p className="text-xs sm:text-[13px] text-[#4A3525] leading-relaxed text-justify indent-6 whitespace-pre-line">
            {data.caseDescription}
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="px-10 py-2.5 rounded-xl text-sm font-lora font-bold text-[#4A3525] transition-all hover:brightness-105 active:scale-95"
            style={{
              backgroundColor: '#D9A86C',
              boxShadow: '0 6px 16px rgba(212, 158, 86, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConsultationSummaryModal;
