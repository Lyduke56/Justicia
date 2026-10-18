'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { PublicLawyerProfile } from './LawyerGrid';
import { UserCircleIcon } from './ClientIcons';

interface LawyerDetailViewProps {
  lawyer: PublicLawyerProfile;
  onBack?: () => void;
  defaultTab?: 'about' | 'reviews' | 'booking' | 'cases';
}

type TabType = 'about' | 'reviews' | 'booking' | 'cases';

export function LawyerDetailView({
  lawyer,
  onBack,
  defaultTab = 'booking',
}: LawyerDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  // Booking Form State
  const [selectedDay, setSelectedDay] = useState<number>(23);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('2:00 PM - 4:00 PM • PST, GMT+8');
  const [communicationMode, setCommunicationMode] = useState<'video' | 'audio'>('video');
  const [subject, setSubject] = useState<string>('Makati Residential Lease: Deposit Dispute & Formal Notice to Vacate');
  const [description, setDescription] = useState<string>(
    'Client has an ongoing residential lease dispute in Legaspi Village, Makati City. Landlord refused to refund 2-month security deposit amounting to ₱110,000 despite clearance inspections. Requesting formal review of lease contract clause 14 and issuance of demand letter.'
  );
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(true);
  const [attachedFiles, setAttachedFiles] = useState<string[]>(['Residential_Lease_Agreement_Makati.pdf']);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'saved' | 'submitted'>('idle');

  const daysInMonth = [
    { day: null }, { day: null }, { day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }, { day: 5 },
    { day: 6 }, { day: 7 }, { day: 8 }, { day: 9 }, { day: 10 }, { day: 11 }, { day: 12 },
    { day: 13 }, { day: 14 }, { day: 15 }, { day: 16 }, { day: 17 }, { day: 18 }, { day: 19 },
    { day: 20 }, { day: 21 }, { day: 22 }, { day: 23 }, { day: 24 }, { day: 25 }, { day: 26 },
    { day: 27 }, { day: 28 }, { day: 29 }, { day: 30 }
  ];

  const timeSlots = [
    '2:00 PM - 4:00 PM • PST, GMT+8',
    '2:30 PM - 4:30 PM • PST, GMT+8',
    '3:00 PM - 4:00 PM • PST, GMT+8',
    '3:30 PM - 4:30 PM • PST, GMT+8',
    '4:00 PM - 5:00 PM • PST, GMT+8',
  ];

  const handleClearInputs = () => {
    setSubject('');
    setDescription('');
    setAttachedFiles([]);
    setAgreedToTerms(false);
    setBookingStatus('idle');
  };

  const handleSaveDraft = () => {
    setBookingStatus('saved');
    setTimeout(() => setBookingStatus('idle'), 4000);
  };

  const handleSubmitBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      alert('Please enter a consultation subject.');
      return;
    }
    if (!agreedToTerms) {
      alert('Please agree to the attorney-client privilege review terms.');
      return;
    }
    setBookingStatus('submitted');
  };

  const standardFee = lawyer.feeStandard60min ?? 1500;
  const initialFee = lawyer.feeInitial30min ?? Math.round(standardFee * 0.5);
  const extendedFee = lawyer.feeExtended120min ?? Math.round(standardFee * 1.6);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* ─── Back Button & Navigation ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-[#5C4535] hover:text-[#34150F] hover:bg-[#DECEB8] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Lawyers Directory</span>
          </button>
        ) : (
          <Link
            href="/client/lawyers"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-[#5C4535] hover:text-[#34150F] hover:bg-[#DECEB8] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Lawyers Directory</span>
          </Link>
        )}

        <span className="text-[11px] font-semibold text-[#7D6855] uppercase tracking-wider">
          Philippine Bar Verified Counsel
        </span>
      </div>

      {/* ─── Lawyer Banner Card ────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5 sm:p-7 bg-[#E8DAC8] border border-[#D1BEA8]/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 transition-all"
        style={{
          boxShadow: '6px 6px 16px rgba(0,0,0,0.07), -6px -6px 16px rgba(255,255,255,0.75)',
        }}
      >
        <div className="flex items-start sm:items-center gap-4 sm:gap-6">
          {/* Avatar Icon */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#D4C1AB] border-2 border-[#5C4535]/30 flex items-center justify-center shrink-0 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.6)]">
            <UserCircleIcon className="w-12 h-12 sm:w-16 sm:h-16 text-[#34150F]" />
          </div>

          <div className="space-y-1 sm:space-y-1.5">
            <span className="inline-block text-[9px] uppercase tracking-widest font-bold text-[#9E6C28] bg-[#C58B3C]/20 px-2 py-0.5 rounded-full border border-[#C58B3C]/30">
              IBP Verified
            </span>
            <h1 className="font-cormorant text-xl sm:text-2xl lg:text-3xl font-bold text-[#34150F] leading-tight">
              {lawyer.fullName}, Ll.B.
            </h1>
            <p className="text-xs text-[#5C4535] font-medium">
              Roll No. {lawyer.rollNumber || '58942'} | IBP {lawyer.ibpChapter?.toUpperCase() || 'MAKATI'}
            </p>
            <p className="text-xs text-[#7D6855]">
              ★ 4.9 (53 Reviews) • {lawyer.experienceYears ?? 9} years of practice
            </p>
            <p className="text-xs text-[#7D6855]">
              {lawyer.practiceAreas && lawyer.practiceAreas.length > 0
                ? lawyer.practiceAreas.join(' • ')
                : 'Labor & Employment • Corporate • Civil Law'}
            </p>
          </div>
        </div>

        {/* Rate Banner */}
        <div className="sm:text-right w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-[#D1BEA8]">
          <div className="flex sm:flex-col items-baseline sm:items-end justify-between gap-1">
            <span className="font-cormorant text-3xl sm:text-4xl font-bold text-[#34150F]">
              ₱{standardFee.toLocaleString()}
            </span>
            <span className="text-xs text-[#7D6855] font-medium">/per hour</span>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab('about')}
          className={`px-5 sm:px-7 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'about'
              ? 'bg-[#D4C1AB] text-[#34150F] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
              : 'text-[#5C4535] hover:text-[#34150F] hover:bg-[#DECEB8]/50'
          }`}
        >
          About
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reviews')}
          className={`px-5 sm:px-7 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'reviews'
              ? 'bg-[#D4C1AB] text-[#34150F] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
              : 'text-[#5C4535] hover:text-[#34150F] hover:bg-[#DECEB8]/50'
          }`}
        >
          Reviews
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('booking')}
          className={`px-5 sm:px-7 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'booking'
              ? 'bg-[#D4C1AB] text-[#34150F] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
              : 'text-[#5C4535] hover:text-[#34150F] hover:bg-[#DECEB8]/50'
          }`}
        >
          Consultation Booking
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cases')}
          className={`px-5 sm:px-7 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'cases'
              ? 'bg-[#D4C1AB] text-[#34150F] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
              : 'text-[#5C4535] hover:text-[#34150F] hover:bg-[#DECEB8]/50'
          }`}
        >
          Cases Handled
        </button>
      </div>

      {/* ─── Confirmation Feedback ─────────────────────────────────────────── */}
      {bookingStatus === 'saved' && (
        <div className="p-4 rounded-xl bg-amber-100/80 border border-amber-300 text-amber-900 text-xs sm:text-sm flex items-center justify-between animate-in fade-in">
          <span>✓ Consultation draft details saved. You can complete your submission anytime.</span>
          <button type="button" onClick={() => setBookingStatus('idle')} className="font-bold">✕</button>
        </div>
      )}

      {bookingStatus === 'submitted' && (
        <div className="p-6 rounded-2xl bg-emerald-100/90 border border-emerald-300 text-emerald-950 space-y-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <h3 className="font-cormorant font-bold text-lg">Consultation Request Confirmed</h3>
          </div>
          <p className="text-xs sm:text-sm">
            Your booking request for <strong>{lawyer.fullName}</strong> on <strong>September {selectedDay}, 2026 ({selectedTimeSlot})</strong> has been received under confidential attorney-client privilege.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <Link
              href="/client/consultations"
              className="px-4 py-2 rounded-xl bg-[#23150F] text-[#ded7cb] text-xs font-semibold hover:bg-[#352219]"
            >
              View My Consultations
            </Link>
            <button
              type="button"
              onClick={() => setBookingStatus('idle')}
              className="text-xs text-[#5C4535] underline"
            >
              Book Another Session
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 1: CONSULTATION BOOKING (Matches Screenshot) ──────────────── */}
      {activeTab === 'booking' && (
        <form onSubmit={handleSubmitBooking} className="space-y-8 animate-in fade-in duration-150">
          {/* Calendar & Time Slots Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            {/* Calendar Card (Left - 8 cols) */}
            <div
              className="lg:col-span-8 rounded-2xl p-6 bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 shadow-[5px_5px_14px_rgba(0,0,0,0.06),-5px_-5px_14px_rgba(255,255,255,0.7)] flex flex-col justify-between"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-4">
                {/* Big Date Highlight */}
                <div className="space-y-1 sm:pr-8 sm:border-r border-[#D1BEA8]/70">
                  <span className="font-cinzel text-xs font-bold uppercase tracking-widest text-[#7D6855]">
                    SEPT
                  </span>
                  <div className="font-cormorant text-5xl sm:text-6xl font-bold text-[#C58B3C] leading-none">
                    {selectedDay}
                  </div>
                  <span className="font-cinzel text-[10px] font-bold tracking-widest uppercase text-[#5C4535]">
                    WEDNESDAY
                  </span>
                </div>

                {/* Mini Calendar Grid */}
                <div className="flex-1">
                  <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center pb-2 text-[10px] sm:text-xs font-bold text-[#7D6855] uppercase tracking-wider">
                    <span>SUN</span>
                    <span>MON</span>
                    <span>TUE</span>
                    <span>WED</span>
                    <span>THU</span>
                    <span>FRI</span>
                    <span>SAT</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs">
                    {daysInMonth.map((item, idx) => {
                      if (!item.day) {
                        return <div key={`empty-${idx}`} className="h-8 w-8" />;
                      }
                      const isSelected = item.day === selectedDay;
                      return (
                        <button
                          key={`day-${item.day}`}
                          type="button"
                          onClick={() => setSelectedDay(item.day!)}
                          className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center font-medium text-xs transition-all ${
                            isSelected
                              ? 'bg-[#D4C1AB] text-[#34150F] font-bold border-2 border-[#C58B3C] shadow-[inset_1px_1px_3px_rgba(0,0,0,0.18)] scale-105'
                              : 'text-[#3E2A1E] hover:bg-[#DECEB8] hover:text-[#34150F]'
                          }`}
                        >
                          {String(item.day).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Time Slots Card (Right - 4 cols) */}
            <div
              className="lg:col-span-4 rounded-2xl p-5 bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 shadow-[5px_5px_14px_rgba(0,0,0,0.06),-5px_-5px_14px_rgba(255,255,255,0.7)] flex flex-col justify-center space-y-2.5"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#7D6855] pb-1">
                Available Time Slots
              </div>

              {timeSlots.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTimeSlot(slot)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-medium transition-all text-center ${
                      isSelected
                        ? 'bg-[#D4C1AB] text-[#34150F] font-bold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)] border border-[#C58B3C]/50'
                        : 'bg-[#DECEB8]/70 text-[#5C4535] hover:bg-[#D4C1AB]/40 shadow-[2px_2px_5px_rgba(0,0,0,0.03),-2px_-2px_5px_rgba(255,255,255,0.6)]'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode of Communication Section */}
          <div className="space-y-3">
            <h2 className="font-cormorant text-xl font-bold text-[#34150F]">Mode of Communication</h2>
            <div
              className="rounded-2xl p-4 sm:p-5 bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 shadow-[5px_5px_14px_rgba(0,0,0,0.06),-5px_-5px_14px_rgba(255,255,255,0.7)] space-y-3"
            >
              {/* Option 1: Video Consultation */}
              <div
                onClick={() => setCommunicationMode('video')}
                className={`flex items-start gap-3.5 p-3.5 rounded-xl cursor-pointer transition-all ${
                  communicationMode === 'video'
                    ? 'bg-[#D4C1AB]/80 border border-[#C58B3C]/60 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)]'
                    : 'bg-[#DECEB8]/40 border border-transparent hover:bg-[#DECEB8]'
                }`}
              >
                <div className="mt-0.5">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    communicationMode === 'video' ? 'border-[#34150F]' : 'border-[#7D6855]'
                  }`}>
                    {communicationMode === 'video' && <div className="w-2 h-2 rounded-full bg-[#34150F]" />}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#34150F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs sm:text-sm font-bold text-[#34150F]">Video Consultation</span>
                    <span className="text-[9px] font-bold text-[#9E6C28] uppercase tracking-wider bg-[#C58B3C]/20 px-2 py-0.5 rounded-full">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#5C4535] leading-relaxed">
                    End-to-end encrypted video meeting with integrated document sharing and interactive legal intake.
                  </p>
                </div>
              </div>

              {/* Option 2: Audio Call */}
              <div
                onClick={() => setCommunicationMode('audio')}
                className={`flex items-start gap-3.5 p-3.5 rounded-xl cursor-pointer transition-all ${
                  communicationMode === 'audio'
                    ? 'bg-[#D4C1AB]/80 border border-[#C58B3C]/60 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)]'
                    : 'bg-[#DECEB8]/40 border border-transparent hover:bg-[#DECEB8]'
                }`}
              >
                <div className="mt-0.5">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    communicationMode === 'audio' ? 'border-[#34150F]' : 'border-[#7D6855]'
                  }`}>
                    {communicationMode === 'audio' && <div className="w-2 h-2 rounded-full bg-[#34150F]" />}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#34150F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span className="text-xs sm:text-sm font-bold text-[#34150F]">Audio Call</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#5C4535] leading-relaxed">
                    Direct secure cellular or voice consultation over private encrypted voice channels.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Purpose of Consultation Section */}
          <div className="space-y-3">
            <h2 className="font-cormorant text-xl font-bold text-[#34150F]">Purpose of Consultation</h2>
            <div
              className="rounded-2xl p-5 sm:p-7 bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 shadow-[5px_5px_14px_rgba(0,0,0,0.06),-5px_-5px_14px_rgba(255,255,255,0.7)] space-y-5"
            >
              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#5C4535]">Subject:</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Makati Residential Lease: Deposit Dispute & Formal Notice to Vacate"
                  className="w-full px-4 py-3 rounded-xl bg-[#DECEB8]/70 border border-[#D1BEA8] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.6)] text-xs sm:text-sm text-[#34150F] placeholder:text-[#A69584] focus:outline-none focus:ring-1 focus:ring-[#C58B3C]"
                />
              </div>

              {/* Subject Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#5C4535]">Subject Description:</label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide concise facts, key contract dates, and specific legal queries for counsel to review..."
                  className="w-full px-4 py-3 rounded-xl bg-[#DECEB8]/70 border border-[#D1BEA8] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.6)] text-xs sm:text-sm text-[#34150F] placeholder:text-[#A69584] focus:outline-none focus:ring-1 focus:ring-[#C58B3C] resize-y"
                />
              </div>

              {/* File Attachments Dropzone */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#5C4535]">File Attachments</label>
                <div
                  className="w-full py-8 px-4 border-2 border-dashed border-[#C8B59E] rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#C58B3C] bg-[#DECEB8]/30 transition-all shadow-[inset_1px_1px_3px_rgba(0,0,0,0.04)]"
                  onClick={() => {
                    const fileName = prompt('Enter document name to attach (e.g., Contract_Addendum.pdf):');
                    if (fileName) setAttachedFiles([...attachedFiles, fileName]);
                  }}
                >
                  <svg className="w-8 h-8 text-[#7D6855]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-xs text-[#7D6855] font-medium mt-2">
                    Drag and Drop, or Attach Relevant Files
                  </span>
                </div>

                {/* Attached Files List */}
                {attachedFiles.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {attachedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#D4C1AB]/50 text-xs text-[#34150F]">
                        <span className="truncate">📎 {file}</span>
                        <button
                          type="button"
                          onClick={() => setAttachedFiles(attachedFiles.filter((_, i) => i !== idx))}
                          className="text-red-700 hover:text-red-900 font-bold ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-center py-1">
                  <span className="text-[11px] font-bold tracking-widest text-[#7D6855] uppercase">OR</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    alert('Documents from your client vault can be linked here.');
                  }}
                  className="px-6 py-2.5 rounded-xl bg-[#D4C1AB] border border-[#C8B59E] shadow-[2px_2px_6px_rgba(0,0,0,0.06),-2px_-2px_6px_rgba(255,255,255,0.7)] text-xs sm:text-sm font-semibold text-[#34150F] hover:bg-[#DECEB8] transition-all mx-auto block"
                >
                  Share Uploaded Files from your Documents
                </button>
              </div>

              {/* Privilege Agreement Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer pt-3">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 rounded border-[#C8B59E] text-[#C58B3C] focus:ring-[#C58B3C] w-4 h-4"
                />
                <span className="text-xs text-[#5C4535] leading-relaxed select-none">
                  I agree that this intake form and attached records will be reviewed strictly under confidential attorney-client privilege prior to the scheduled consultation session.
                </span>
              </label>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClearInputs}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-[#C8B59E] text-xs font-medium text-[#5C4535] hover:bg-[#DECEB8] transition-colors"
            >
              Clear All Inputs
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-[#D4C1AB] text-xs font-semibold text-[#34150F] hover:bg-[#C8B59E] shadow-[2px_2px_6px_rgba(0,0,0,0.06),-2px_-2px_6px_rgba(255,255,255,0.7)] transition-all"
            >
              Save
            </button>
          </div>

          {/* Divider */}
          <hr className="border-[#D1BEA8] my-6" />

          {/* Centered Large Submit Button */}
          <div className="pt-2 pb-6">
            <button
              type="submit"
              className="w-full max-w-sm mx-auto block py-3.5 px-8 rounded-2xl bg-gradient-to-r from-[#D4C1AB] via-[#DECEB8] to-[#D4C1AB] border border-[#C58B3C]/40 text-sm sm:text-base font-bold text-[#34150F] shadow-[4px_4px_12px_rgba(0,0,0,0.1),-4px_-4px_12px_rgba(255,255,255,0.7)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.12)] transition-all text-center"
            >
              Submit Booking
            </button>
          </div>
        </form>
      )}

      {/* ─── TAB 2: ABOUT (Matches Previous Reference Screen) ──────────────── */}
      {activeTab === 'about' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bio Box (2 cols) */}
            <div
              className="md:col-span-2 rounded-2xl p-6 bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 shadow-[5px_5px_14px_rgba(0,0,0,0.06),-5px_-5px_14px_rgba(255,255,255,0.7)]"
            >
              <h3 className="font-cormorant text-xl font-bold text-[#34150F] mb-3">Overview & Bio</h3>
              <p className="text-xs sm:text-sm text-[#3E2A1E] leading-relaxed">
                {lawyer.about ||
                  'Experienced litigation and dispute resolution counsel practicing before the trial courts, National Labor Relations Commission (NLRC), and appellate tribunals. Dedicated to advising both private individuals and corporate entities on contract negotiation, compliance matters, and residential dispute settlement with high adherence to Philippine ethical codes.'}
              </p>
            </div>

            {/* Rates Box (1 col) */}
            <div
              className="rounded-2xl p-6 bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 shadow-[5px_5px_14px_rgba(0,0,0,0.06),-5px_-5px_14px_rgba(255,255,255,0.7)] space-y-3"
            >
              <h3 className="font-cormorant text-xl font-bold text-[#34150F]">Consultation Rates:</h3>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between items-baseline">
                  <span className="text-[#5C4535]">Initial Consultation (30 mins)</span>
                  <span className="font-bold text-[#34150F]">₱{initialFee.toLocaleString()} <span className="text-[10px] text-[#7D6855]">/session</span></span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[#5C4535]">Standard Consultation (1 hr)</span>
                  <span className="font-bold text-[#34150F]">₱{standardFee.toLocaleString()} <span className="text-[10px] text-[#7D6855]">/per hour</span></span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[#5C4535]">Extended Consultation (2 hrs)</span>
                  <span className="font-bold text-[#34150F]">₱{extendedFee.toLocaleString()} <span className="text-[10px] text-[#7D6855]">/per hour</span></span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('booking')}
                className="w-full mt-4 py-2.5 rounded-xl bg-[#D4C1AB] font-bold text-xs text-[#34150F] hover:bg-[#DECEB8] transition-all shadow-[2px_2px_5px_rgba(0,0,0,0.05),-2px_-2px_5px_rgba(255,255,255,0.7)]"
              >
                Book Consultation Now →
              </button>
            </div>
          </div>

          {/* Professional Background */}
          <div className="space-y-3">
            <h2 className="font-cormorant text-xl font-bold text-[#34150F]">Professional Background</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 space-y-2 shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.7)]">
                <h4 className="font-bold text-sm text-[#34150F]">Areas of Practice</h4>
                <ul className="list-disc list-inside space-y-1 text-xs text-[#5C4535]">
                  <li>Labor & Employment: Termination disputes, non-compete clauses, and CBA negotiation</li>
                  <li>Corporate & Commercial: SEC compliance, vendor contracts, and entity structuring</li>
                  <li>Civil Law & Property: Residential lease disputes, deeds of sale, and quiet title actions</li>
                </ul>
              </div>

              <div className="p-5 rounded-xl bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 space-y-2 shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.7)]">
                <h4 className="font-bold text-sm text-[#34150F]">Legal Experience</h4>
                <ul className="list-disc list-inside space-y-1 text-xs text-[#5C4535]">
                  <li>Senior Litigation Associate — Santos & Partners Law Offices (2018–Present)</li>
                  <li>Legal Counsel — Philippine Arbitration & Mediation Center (2015–2018)</li>
                  <li>Junior Associate — Metro Manila Law Chambers (2014–2015)</li>
                </ul>
              </div>

              <div className="p-5 rounded-xl bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 space-y-2 shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.7)]">
                <h4 className="font-bold text-sm text-[#34150F]">Consultation Services</h4>
                <ul className="list-disc list-inside space-y-1 text-xs text-[#5C4535]">
                  <li>Pre-litigation case evaluation and demand letter drafting</li>
                  <li>Contract interpretation and risk assessment memorandums</li>
                  <li>Representation before administrative regulatory agencies</li>
                </ul>
              </div>

              <div className="p-5 rounded-xl bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 space-y-2 shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.7)]">
                <h4 className="font-bold text-sm text-[#34150F]">Philippine Bar Examination Passer (2014)</h4>
                <p className="text-xs text-[#5C4535] leading-relaxed">
                  Admitted to the Philippine Bar in 2014. Member in good standing of the Integrated Bar of the Philippines (IBP {lawyer.ibpChapter || 'Makati Chapter'}).
                </p>
              </div>
            </div>
          </div>

          {/* Educational Background */}
          <div className="space-y-3">
            <h2 className="font-cormorant text-xl font-bold text-[#34150F]">Educational Background</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 space-y-2 shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.7)]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚖️</span>
                  <div>
                    <h4 className="font-bold text-sm text-[#34150F]">Juris Doctor (2010 – 2014)</h4>
                    <p className="text-xs text-[#7D6855]">University of the Philippines – College of Law</p>
                  </div>
                </div>
                <p className="text-xs text-[#5C4535]">Graduated with honors, Philippine Law Journal Contributor.</p>
              </div>

              <div className="p-5 rounded-xl bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 space-y-2 shadow-[4px_4px_10px_rgba(0,0,0,0.05),-4px_-4px_10px_rgba(255,255,255,0.7)]">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📜</span>
                  <div>
                    <h4 className="font-bold text-sm text-[#34150F]">Bachelor of Arts in Political Science (2006 – 2010)</h4>
                    <p className="text-xs text-[#7D6855]">Ateneo de Manila University</p>
                  </div>
                </div>
                <p className="text-xs text-[#5C4535]">Dean&apos;s List awardee, Magna Cum Laude honors.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: REVIEWS ────────────────────────────────────────────────── */}
      {activeTab === 'reviews' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="p-6 rounded-2xl bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 shadow-[5px_5px_14px_rgba(0,0,0,0.06),-5px_-5px_14px_rgba(255,255,255,0.7)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="font-cormorant text-5xl font-bold text-[#C58B3C]">4.9</span>
              <div>
                <div className="text-amber-600 text-sm">★★★★★</div>
                <p className="text-xs text-[#7D6855]">Based on 53 verified client consultations</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('booking')}
              className="px-5 py-2 rounded-xl bg-[#D4C1AB] text-xs font-semibold text-[#34150F] shadow-[2px_2px_5px_rgba(0,0,0,0.06),-2px_-2px_5px_rgba(255,255,255,0.7)]"
            >
              Book with this Lawyer
            </button>
          </div>

          <div className="space-y-3">
            {[
              {
                client: 'Engr. Manuel C.',
                date: 'October 12, 2026',
                rating: 5,
                comment: 'Atty. Santos was very thorough in evaluating our commercial lease agreement and spotting unilateral penalty clauses. Highly recommended for business operators.',
              },
              {
                client: 'Clarissa P.',
                date: 'September 28, 2026',
                rating: 5,
                comment: 'Prompt video consultation. She drafted the demand notice immediately and the security deposit dispute was resolved amicably within two weeks.',
              },
              {
                client: 'David G.',
                date: 'September 15, 2026',
                rating: 5,
                comment: 'Clear, compassionate advice on labor grievance procedures. Very well-versed in NLRC jurisprudence.',
              },
            ].map((rev, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-[#E8DAC8]/50 border border-[#D1BEA8]/50 space-y-1 shadow-[2px_2px_6px_rgba(0,0,0,0.03),-2px_-2px_6px_rgba(255,255,255,0.6)]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#34150F]">{rev.client}</span>
                  <span className="text-[10px] text-[#7D6855]">{rev.date}</span>
                </div>
                <div className="text-amber-600 text-xs">{'★'.repeat(rev.rating)}</div>
                <p className="text-xs text-[#5C4535] leading-relaxed">{rev.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 4: CASES HANDLED ─────────────────────────────────────────── */}
      {activeTab === 'cases' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="p-6 rounded-2xl bg-[#E8DAC8]/70 border border-[#D1BEA8]/70 shadow-[5px_5px_14px_rgba(0,0,0,0.06),-5px_-5px_14px_rgba(255,255,255,0.7)] space-y-4">
            <h3 className="font-cormorant text-xl font-bold text-[#34150F]">Representative Matters & Outcomes</h3>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-[#DECEB8]/50 border border-[#D1BEA8]/50 space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#9E6C28]">Real Estate & Tenancy</span>
                <h4 className="font-bold text-xs sm:text-sm text-[#34150F]">Makati Commercial Arcade Lease Rescission</h4>
                <p className="text-xs text-[#5C4535]">Successfully represented tenant in pre-litigation settlement, recovering 100% of advance rentals and security deposits.</p>
              </div>
              <div className="p-4 rounded-xl bg-[#DECEB8]/50 border border-[#D1BEA8]/50 space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#9E6C28]">Labor & Employment</span>
                <h4 className="font-bold text-xs sm:text-sm text-[#34150F]">Corporate Reorganization Redundancy Appeal</h4>
                <p className="text-xs text-[#5C4535]">Advising mid-sized BPO on lawful separation pay computation and mandatory DOLE notice protocols.</p>
              </div>
              <div className="p-4 rounded-xl bg-[#DECEB8]/50 border border-[#D1BEA8]/50 space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#9E6C28]">Civil & Estate</span>
                <h4 className="font-bold text-xs sm:text-sm text-[#34150F]">Extrajudicial Settlement with Partition of Real Estate</h4>
                <p className="text-xs text-[#5C4535]">Prepared deeds of partition and cleared estate tax liabilities for seven co-heirs without judicial intervention.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LawyerDetailView;
