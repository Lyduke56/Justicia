'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { PublicLawyerProfile } from './LawyerGrid';
import {
  CalendarBookingIcon,
  MessagesIcon,
  ShieldCheckIcon,
} from './ClientIcons';

interface LawyerDetailModalProps {
  lawyer: PublicLawyerProfile | null;
  onClose: () => void;
}

export function LawyerDetailModal({ lawyer, onClose }: LawyerDetailModalProps) {
  // Handle ESC key to close
  useEffect(() => {
    if (!lawyer) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lawyer, onClose]);

  if (!lawyer) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lawyer-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-[#FBF7EE] border border-[#E8DCCB] text-[#34150F] shadow-[0_20px_50px_rgba(0,0,0,0.25)] overflow-hidden z-10 my-8"
        style={{
          boxShadow: '12px 12px 30px rgba(0,0,0,0.15), -12px -12px 30px rgba(255,255,255,0.9)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner */}
        <div className="relative bg-[#23150F] text-[#ded7cb] p-6 sm:p-8 border-b border-[#352219]">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#352219]/80 text-[#ded7cb] hover:text-[#C58B3C] hover:bg-[#352219] flex items-center justify-center transition-colors focus:outline-none"
            aria-label="Close modal"
          >
            ✕
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-3 border-[#C58B3C] flex items-center justify-center shrink-0 overflow-hidden bg-[#D4C1AB] shadow-lg">
              {lawyer.photoUrl ? (
                <Image
                  src={lawyer.photoUrl}
                  alt={lawyer.fullName}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg className="w-12 h-12 text-[#5C4535]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
                </svg>
              )}
            </div>

            {/* Profile Header Info */}
            <div className="text-center sm:text-left space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-[#C58B3C]/20 text-[#C58B3C] border border-[#C58B3C]/40">
                <ShieldCheckIcon className="w-3.5 h-3.5" />
                <span>Verified by Justicia & IBP</span>
              </div>

              <h2
                id="lawyer-modal-title"
                className="font-cormorant text-2xl sm:text-3xl font-bold text-white tracking-tight"
              >
                {lawyer.fullName}
              </h2>

              <p className="text-xs text-[#A69584] uppercase tracking-wider font-medium">
                Roll No. {lawyer.rollNumber} {lawyer.ibpChapter && `• IBP Chapter: ${lawyer.ibpChapter}`}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-[11px] text-[#ded7cb]/80">
                {lawyer.experienceYears && (
                  <span className="px-2 py-0.5 rounded-md bg-[#352219]">
                    {lawyer.experienceYears} Years Experience
                  </span>
                )}
                {lawyer.barPasserYear && (
                  <span className="px-2 py-0.5 rounded-md bg-[#352219]">
                    Bar Admitted {lawyer.barPasserYear}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-md bg-emerald-900/60 text-emerald-300">
                  ● Available for Booking
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Practice Areas */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#7D6855]">
              Practice Areas & Specializations
            </h3>
            <div className="flex flex-wrap gap-2">
              {lawyer.practiceAreas.map((area) => (
                <span
                  key={area}
                  className="px-3 py-1 rounded-xl text-xs font-semibold bg-[#E8DAC8] text-[#34150F] border border-[#D9C9B6] shadow-[2px_2px_4px_rgba(0,0,0,0.04)]"
                >
                  ⚖️ {area}
                </span>
              ))}
            </div>
          </div>

          {/* About / Bio */}
          {lawyer.about && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#7D6855]">
                Professional Background
              </h3>
              <p className="text-xs sm:text-sm text-[#5C4535] leading-relaxed bg-[#EFE5D8] p-4 rounded-2xl border border-[#E8DCCB]">
                {lawyer.about}
              </p>
            </div>
          )}

          {/* Languages */}
          {lawyer.languages.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#7D6855]">
                Languages Spoken
              </h3>
              <p className="text-xs text-[#5C4535] font-medium">
                {lawyer.languages.join(' • ')}
              </p>
            </div>
          )}

          {/* Consultation Fee Rates Card */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#7D6855]">
              Consultation Rates & Sessions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 30 Min */}
              <div className="p-3.5 rounded-2xl bg-[#E8DAC8] text-center border border-[#D9C9B6] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider">
                  Initial Review (30m)
                </span>
                <p className="font-cormorant text-xl font-bold text-[#34150F]">
                  {lawyer.feeInitial30min ? `₱${lawyer.feeInitial30min.toLocaleString()}` : '₱1,200'}
                </p>
                <span className="text-[10px] text-[#7D6855]">Preliminary advisory</span>
              </div>

              {/* 60 Min */}
              <div className="p-3.5 rounded-2xl bg-[#EFE5D8] text-center border-2 border-[#C58B3C] shadow-sm space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#C58B3C] tracking-wider">
                  Standard Session (60m)
                </span>
                <p className="font-cormorant text-2xl font-bold text-[#34150F]">
                  {lawyer.feeStandard60min ? `₱${lawyer.feeStandard60min.toLocaleString()}` : '₱2,500'}
                </p>
                <span className="text-[10px] text-[#7D6855]">Full case assessment</span>
              </div>

              {/* 120 Min */}
              <div className="p-3.5 rounded-2xl bg-[#E8DAC8] text-center border border-[#D9C9B6] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#7D6855] tracking-wider">
                  Extended (120m)
                </span>
                <p className="font-cormorant text-xl font-bold text-[#34150F]">
                  {lawyer.feeExtended120min ? `₱${lawyer.feeExtended120min.toLocaleString()}` : '₱4,500'}
                </p>
                <span className="text-[10px] text-[#7D6855]">In-depth drafting</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Action Footer */}
        <div className="p-6 bg-[#EFE5D8] border-t border-[#E8DCCB] flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link
            href={`/lawyers/${lawyer.userId}`}
            className="text-xs font-semibold text-[#5C4535] hover:text-[#C58B3C] transition-colors order-2 sm:order-1"
          >
            View Full Public Profile Page ↗
          </Link>

          <div className="flex items-center gap-2.5 w-full sm:w-auto order-1 sm:order-2">
            <Link
              href={`/client/messages?lawyerId=${lawyer.userId}`}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#23150F] text-[#ded7cb] hover:bg-[#34150F] transition-all shadow-sm"
            >
              <MessagesIcon className="w-4 h-4 text-[#C58B3C]" />
              <span>Message</span>
            </Link>

            <Link
              href={`/client/consultations?lawyerId=${lawyer.userId}`}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#C58B3C] text-[#23150F] hover:bg-[#B37B2F] transition-all shadow-md"
            >
              <CalendarBookingIcon className="w-4 h-4" />
              <span>Book Consultation</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
