'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getClientConsultationsAction,
  completeConsultationAction,
} from '@/app/actions/consultationActions';
import { addLawyerReviewAction } from '@/app/actions/reviewActions';
import Link from 'next/link';
import type { ViewKey } from '@/components/client/ClientShell';

interface ConsultationsViewProps {
  onNavigate?: (view: ViewKey) => void;
}

interface Appointment {
  id: string;
  lawyerId?: string;
  dateStr: string;
  day: number;
  timeSlot: string;
  status: 'CONFIRMED APPOINTMENT' | 'COMPLETED' | 'PENDING CONFIRMATION';
  lawyerName: string;
  rollNumber: string;
  ibpChapter: string;
  practiceAreas: string[];
  rating: string;
  experienceYrs: number;
  ratePerHour: number;
  docket: string;
  caseTitle: string;
  caseDescription: string;
  meetingLink?: string;
}

export function ConsultationsView({ onNavigate }: ConsultationsViewProps) {
  const router = useRouter();
  const [dbAppointments, setDbAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    getClientConsultationsAction().then((data: any) => {
      if (data && data.length > 0) {
        setDbAppointments(data);
      }
    });
  }, []);

  const [selectedDay, setSelectedDay] = useState<number>(23);
  const [activeAppointmentIndex, setActiveAppointmentIndex] = useState<number>(0);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [showMeetModal, setShowMeetModal] = useState<boolean>(false);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);

  // Locally completed appointments tracking (e.g. after video call finishes)
  const [completedStatusMap, setCompletedStatusMap] = useState<Record<string, boolean>>({});

  // Rated consultations tracking: { [appointmentId]: { rating: number, comment?: string } }
  const [ratedMap, setRatedMap] = useState<Record<string, { rating: number; comment?: string }>>({});

  // Rate Modal state
  const [showRateModal, setShowRateModal] = useState<boolean>(false);
  const [rateAppointment, setRateAppointment] = useState<Appointment | null>(null);
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [reviewerName, setReviewerName] = useState<string>('');
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [submittingRate, setSubmittingRate] = useState<boolean>(false);
  const [rateToast, setRateToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: '',
  });

  // Load rated consultations from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('justicia_rated_consultations');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            setRatedMap(parsed);
          }
        }
      } catch {}
    }
  }, []);

  const appointments: Appointment[] = [
    {
      id: 'apt-001',
      lawyerId: 'lw-001',
      dateStr: 'TODAY, SEPTEMBER 23, 2026',
      day: 23,
      timeSlot: '3:00 PM - 4:00 PM • PST, GMT+8',
      status: 'CONFIRMED APPOINTMENT',
      lawyerName: 'Atty. Maria Elena Santos, Ll.B.',
      rollNumber: '58942',
      ibpChapter: 'MAKATI',
      practiceAreas: ['Labor & Employment', 'Corporate', 'Civil Law'],
      rating: '4.9 (53 Reviews)',
      experienceYrs: 9,
      ratePerHour: 1500,
      docket: 'SUBJECT MATTER & CASE DOCKET',
      caseTitle: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
      caseDescription:
        'Legal consultation regarding unrefunded commercial and residential security deposits, dispute resolution protocols before barangay conciliation, and notice of formal dispute escalation.',
      meetingLink: 'https://meet.justicia.ph/room/santos-clyde-20260923',
    },
    {
      id: 'apt-002',
      lawyerId: 'lw-002',
      dateStr: 'SEPTEMBER 28, 2026',
      day: 28,
      timeSlot: '2:00 PM - 3:00 PM • PST, GMT+8',
      status: 'CONFIRMED APPOINTMENT',
      lawyerName: 'Atty. Joaquin Antonio Reyes, Ll.M.',
      rollNumber: '61204',
      ibpChapter: 'PASIG',
      practiceAreas: ['Real Estate & Tenancy', 'Commercial Contracts'],
      rating: '4.8 (41 Reviews)',
      experienceYrs: 11,
      ratePerHour: 1800,
      docket: 'SUBJECT MATTER & CASE DOCKET',
      caseTitle: 'Commercial Tenancy Escrow Release & Final Turnover Notice',
      caseDescription:
        'Legal review of commercial tenancy contract addendum for retail space in Ortigas Center. Assisting in escrow account release following joint tenant-lessor clearance protocols and tax certificate turnover.',
      meetingLink: 'https://meet.justicia.ph/room/reyes-clyde-20260928',
    },
    {
      id: 'apt-003',
      lawyerId: 'lw-003',
      dateStr: 'OCTOBER 05, 2026',
      day: 5,
      timeSlot: '10:00 AM - 11:30 AM • PST, GMT+8',
      status: 'CONFIRMED APPOINTMENT',
      lawyerName: 'Atty. Beatrice Clara Tan, Ll.B.',
      rollNumber: '59811',
      ibpChapter: 'QUEZON CITY',
      practiceAreas: ['Intellectual Property', 'Corporate Law'],
      rating: '5.0 (29 Reviews)',
      experienceYrs: 8,
      ratePerHour: 1600,
      docket: 'SUBJECT MATTER & CASE DOCKET',
      caseTitle: 'Trademark Filing Evaluation & Prior Art Search Assessment',
      caseDescription:
        'Pre-registration evaluation for proprietary software brand before the Intellectual Property Office of the Philippines (IPOPHL). Assessing trademark classification classes 9 and 42.',
      meetingLink: 'https://meet.justicia.ph/room/tan-clyde-20261005',
    },
    {
      id: 'apt-004',
      lawyerId: 'lw-001',
      dateStr: 'SEPTEMBER 18, 2026',
      day: 18,
      timeSlot: '4:00 PM - 5:00 PM • PST, GMT+8',
      status: 'COMPLETED',
      lawyerName: 'Atty. Maria Elena Santos, Ll.B.',
      rollNumber: '58942',
      ibpChapter: 'MAKATI',
      practiceAreas: ['Labor & Employment', 'Corporate', 'Civil Law'],
      rating: '4.9 (53 Reviews)',
      experienceYrs: 9,
      ratePerHour: 1500,
      docket: 'SUBJECT MATTER & CASE DOCKET',
      caseTitle: 'Post-Inspection Demand Settlement & Escrow Verification',
      caseDescription:
        'Follow-up review of demand compliance notice from landlord. Verification of bank transmittal clearance for security deposit restitution and full quitclaim execution.',
      meetingLink: 'https://meet.justicia.ph/room/santos-clyde-20260918',
    },
  ];

  const allAppointments = dbAppointments.length > 0 ? dbAppointments : appointments;
  const hasAppointments = allAppointments.length > 0;
  const currentAppointment =
    allAppointments[activeAppointmentIndex] || allAppointments[0] || appointments[0];

  const handleSelectAppointment = (idx: number) => {
    if (idx === activeAppointmentIndex) return;
    setIsSwitching(true);
    setActiveAppointmentIndex(idx);
    setSelectedDay(allAppointments[idx]?.day || 23);
    setTimeout(() => setIsSwitching(false), 200);
  };

  // Determine dynamic appointment status
  const effectiveStatus: 'CONFIRMED APPOINTMENT' | 'COMPLETED' | 'PENDING CONFIRMATION' | 'CANCELLED' =
    isCancelled
      ? 'CANCELLED'
      : completedStatusMap[currentAppointment.id]
      ? 'COMPLETED'
      : currentAppointment.status;

  const isCompleted = effectiveStatus === 'COMPLETED';
  const isAlreadyRated = Boolean(ratedMap[currentAppointment.id]);

  // Calendar dates: September 2026 begins on Tuesday (2 blank spaces for Sunday & Monday)
  const daysInMonth = [
    { day: null },
    { day: null },
    { day: 1 },
    { day: 2 },
    { day: 3 },
    { day: 4 },
    { day: 5 },
    { day: 6 },
    { day: 7 },
    { day: 8 },
    { day: 9 },
    { day: 10 },
    { day: 11 },
    { day: 12 },
    { day: 13 },
    { day: 14 },
    { day: 15 },
    { day: 16 },
    { day: 17 },
    { day: 18 },
    { day: 19 },
    { day: 20 },
    { day: 21 },
    { day: 22 },
    { day: 23 },
    { day: 24 },
    { day: 25 },
    { day: 26 },
    { day: 27 },
    { day: 28 },
    { day: 29 },
    { day: 30 },
  ];

  // Submit post-consultation rating handler
  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateAppointment) return;
    if (!feedbackText.trim()) {
      alert('Please provide your review feedback before submitting.');
      return;
    }

    setSubmittingRate(true);
    const targetLawyerId = rateAppointment.lawyerId || 'lw-001';
    const cleanReviewerName = reviewerName.trim() || 'Verified Client';
    const cleanComment = feedbackText.trim();
    const currentRating = ratingStars;
    const tempId = `rev-${Date.now()}`;

    const newReviewItem = {
      id: tempId,
      name: cleanReviewerName,
      stars: currentRating,
      date: new Date().toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      }),
      content: cleanComment,
    };

    // 1. Immediately store into localStorage so it persists upon reload in all views
    try {
      const storageKey = `justicia_reviews_${targetLawyerId}`;
      const existingRaw = localStorage.getItem(storageKey);
      let existing: any[] = [];
      if (existingRaw) {
        try {
          const parsed = JSON.parse(existingRaw);
          if (Array.isArray(parsed)) existing = parsed;
        } catch {}
      }
      const updatedList = [newReviewItem, ...existing.filter((r) => r.id !== tempId)];
      localStorage.setItem(storageKey, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('localStorage save review warning:', e);
    }

    // 2. Mark this consultation as rated in localStorage
    const newRatedMap = {
      ...ratedMap,
      [rateAppointment.id]: { rating: currentRating, comment: cleanComment },
    };
    setRatedMap(newRatedMap);
    try {
      localStorage.setItem('justicia_rated_consultations', JSON.stringify(newRatedMap));
    } catch {}

    // 3. Persist to Supabase database via server action
    try {
      const res = await addLawyerReviewAction({
        lawyerId: targetLawyerId,
        lawyerName: rateAppointment.lawyerName,
        rating: currentRating,
        comment: cleanComment,
        reviewerName: cleanReviewerName,
      });

      if (res.success && res.review) {
        const dbRev = res.review;
        try {
          const storageKey = `justicia_reviews_${targetLawyerId}`;
          const existingRaw = localStorage.getItem(storageKey);
          if (existingRaw) {
            const parsed = JSON.parse(existingRaw);
            if (Array.isArray(parsed)) {
              const synced = parsed.map((r: any) =>
                r.id === tempId ? { ...r, id: dbRev.id } : r
              );
              localStorage.setItem(storageKey, JSON.stringify(synced));
            }
          }
        } catch {}
      }
    } catch (err) {
      console.warn('addLawyerReviewAction notice:', err);
    }

    setSubmittingRate(false);
    setShowRateModal(false);
    setRateToast({
      show: true,
      message: `Your rating for ${rateAppointment.lawyerName} has been submitted successfully!`,
    });
    setTimeout(() => setRateToast({ show: false, message: '' }), 5000);
  };

  return (
    <div className="max-w-[1240px] mx-auto px-2 sm:px-6 py-6 space-y-6">
      {/* ─── Main 2-Column Grid (Exact Figma Layout) ───────────────────────── */}
      {!hasAppointments ? (
        <div className="rounded-[28px] p-12 bg-[#ECE1D2] text-center space-y-4 max-w-xl mx-auto shadow-md">
          <div className="text-4xl">📅</div>
          <h2 className="font-cormorant text-2xl font-bold text-[#34150F]">
            No Consultations Scheduled Yet
          </h2>
          <p className="text-xs text-[#7D6855] leading-relaxed">
            You do not have any active or pending consultations in the system. Explore verified
            Philippine legal practitioners to schedule your confidential consultation session.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (onNavigate) onNavigate('lawyers');
                else router.push('/client/lawyers');
              }}
              className="px-6 py-2.5 rounded-2xl bg-[#C58B3C] text-white hover:bg-[#B3792E] text-xs font-bold transition shadow-sm"
            >
              Find a Lawyer
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
          {/* ─── Left Column: Calendar & Reminders (5 cols) ───────────────────── */}
          <div className="lg:col-span-5 space-y-6">
            {/* 1. Calendar Card */}
            <div
              className="rounded-[28px] p-6 sm:p-7 bg-[#ECE1D2] space-y-5"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              {/* Top Month Badge (Inset Pill) */}
              <div className="flex justify-center">
                <div
                  className="px-8 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-[#C58B3C]"
                  style={{
                    backgroundColor: '#E6D7C3',
                    boxShadow:
                      'inset 2px 2px 5px rgba(165, 140, 115, 0.5), inset -2px -2px 5px rgba(255, 255, 255, 0.95)',
                  }}
                >
                  SEPTEMBER 2026
                </div>
              </div>

              {/* Days of week */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-[#362519] uppercase tracking-wider pb-1">
                <span>SUN</span>
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
              </div>

              {/* Dates Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-xs">
                {daysInMonth.map((item, idx) => {
                  if (!item.day) {
                    return <div key={`empty-${idx}`} className="h-8 w-8" />;
                  }
                  const isSelected = item.day === selectedDay;
                  const hasAppointment = allAppointments.some((a) => a.day === item.day);
                  return (
                    <button
                      key={`day-${item.day}`}
                      type="button"
                      onClick={() => {
                        const aptIdx = allAppointments.findIndex((a) => a.day === item.day);
                        if (aptIdx !== -1) {
                          handleSelectAppointment(aptIdx);
                        } else {
                          setSelectedDay(item.day!);
                        }
                      }}
                      className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center font-medium text-xs transition-all relative ${
                        isSelected
                          ? 'bg-[#DFC5A4] text-[#C58B3C] font-bold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.18)] scale-105'
                          : 'text-[#3E2A1E] hover:bg-[#DECEB8] hover:text-[#23150F]'
                      }`}
                    >
                      <span>{String(item.day).padStart(2, '0')}</span>
                      {hasAppointment && !isSelected && (
                        <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#C58B3C]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. REMINDERS: Card (Warm peach plate) */}
            <div
              className="rounded-[28px] p-6 sm:p-7 space-y-3.5"
              style={{
                backgroundColor: '#DFC5A4',
                boxShadow:
                  '10px 12px 28px rgba(165, 135, 105, 0.45), 3px 4px 8px rgba(165, 135, 105, 0.25), -10px -10px 24px rgba(255, 255, 255, 0.95), -3px -3px 6px #FFFFFF',
              }}
            >
              <h3 className="font-cormorant text-base sm:text-lg font-bold text-[#23150F] tracking-wide">
                REMINDERS:
              </h3>

              <ul className="space-y-2 text-xs sm:text-[12.5px] text-[#3E2A1E] leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-[8px] mt-1.5 shrink-0">●</span>
                  <span>
                    Consultations are strictly confidential under Rule 21.01 of the Code of
                    Professional Responsibility.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[8px] mt-1.5 shrink-0">●</span>
                  <span>
                    Please join the secure meeting room 5 minutes prior to your scheduled time.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[8px] mt-1.5 shrink-0">●</span>
                  <span>
                    Ratings and reviews can be submitted immediately following the conclusion of
                    your legal consultation.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[8px] mt-1.5 shrink-0">●</span>
                  <span>
                    Need to reschedule? Kindly provide at least 24 hours advance notice to counsel.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* ─── Right Column: Large Appointment Card (7 cols) ────────────────── */}
          <div className="lg:col-span-7 space-y-5">
            <div
              className="rounded-[28px] p-6 sm:p-8 bg-[#ECE1D2] space-y-5"
              style={{
                boxShadow:
                  '14px 14px 32px rgba(182, 155, 130, 0.4), -14px -14px 32px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              {isSwitching ? (
                <div className="space-y-5 animate-in fade-in duration-150 py-1">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="h-7 w-48 rounded-full neu-skeleton-inset" />
                    <div className="h-7 w-40 rounded-full neu-skeleton-inset" />
                    <div className="h-7 w-36 rounded-full neu-skeleton" />
                  </div>
                  <div className="h-28 rounded-[22px] neu-skeleton-plate" />
                  <div className="space-y-2.5 pt-1">
                    <div className="h-3 w-40 neu-skeleton-text" />
                    <div className="h-5 w-80 neu-skeleton-text" />
                    <div className="space-y-2 pt-1">
                      <div className="h-2.5 w-full neu-skeleton-text" />
                      <div className="h-2.5 w-11/12 neu-skeleton-text" />
                      <div className="h-2.5 w-4/5 neu-skeleton-text" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-[#D1BEA8]/60">
                    <div className="h-9 w-20 rounded-xl neu-skeleton" />
                    <div className="h-9 w-28 rounded-xl neu-skeleton" />
                    <div className="h-9 w-28 rounded-xl neu-skeleton-plate" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Top Pill Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Date Pill (Debossed) */}
                    <div
                      className="px-4 py-1.5 rounded-full text-[10px] sm:text-[11px] font-bold text-[#5C4535] uppercase tracking-wider"
                      style={{
                        backgroundColor: '#E6D7C3',
                        boxShadow:
                          'inset 2px 2px 4px rgba(165, 140, 115, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.95)',
                      }}
                    >
                      {currentAppointment.dateStr}
                    </div>

                    {/* Time Pill (Debossed) */}
                    <div
                      className="px-4 py-1.5 rounded-full text-[10px] sm:text-[11px] font-bold text-[#5C4535]"
                      style={{
                        backgroundColor: '#E6D7C3',
                        boxShadow:
                          'inset 2px 2px 4px rgba(165, 140, 115, 0.5), inset -2px -2px 4px rgba(255, 255, 255, 0.95)',
                      }}
                    >
                      {currentAppointment.timeSlot}
                    </div>

                    {/* Status Badge */}
                    <div
                      className={`px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wider uppercase text-white shadow-md ${
                        effectiveStatus === 'CANCELLED'
                          ? 'bg-red-700'
                          : effectiveStatus === 'COMPLETED'
                          ? 'bg-[#3E2A1E]'
                          : 'bg-[#27AE60]'
                      }`}
                      style={{
                        boxShadow:
                          effectiveStatus === 'CANCELLED'
                            ? '0 4px 12px rgba(185, 28, 28, 0.4)'
                            : effectiveStatus === 'COMPLETED'
                            ? '0 4px 12px rgba(62, 42, 30, 0.4)'
                            : '4px 6px 16px rgba(39, 174, 96, 0.4), -2px -2px 6px rgba(255, 255, 255, 0.25)',
                      }}
                    >
                      {effectiveStatus}
                    </div>
                  </div>

                  {/* Inner Lawyer Banner Plate */}
                  <div
                    className="rounded-[22px] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    style={{
                      backgroundColor: '#DFC5A4',
                      boxShadow:
                        '6px 8px 18px rgba(165, 135, 105, 0.4), 2px 2px 5px rgba(165, 135, 105, 0.2), -6px -6px 16px rgba(255, 255, 255, 0.9), -2px -2px 4px #FFFFFF',
                    }}
                  >
                    <div className="flex items-center gap-4 sm:gap-5">
                      {/* Circular Avatar */}
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-[#362519] flex items-center justify-center shrink-0">
                        <svg
                          className="w-9 h-9 sm:w-11 sm:h-11 text-[#362519]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="8" r="4" />
                          <path d="M5.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
                        </svg>
                      </div>

                      <div className="space-y-0.5">
                        <h4 className="font-cormorant text-xl sm:text-2xl font-bold text-[#23150F] leading-tight">
                          {currentAppointment.lawyerName}
                        </h4>
                        <p className="text-[11px] sm:text-xs text-[#5C4535] font-medium leading-tight">
                          Roll No. {currentAppointment.rollNumber} | IBP {currentAppointment.ibpChapter}
                        </p>
                        <p className="text-[11px] sm:text-xs text-[#5C4535] font-medium">
                          {currentAppointment.practiceAreas.join(' • ')}
                        </p>
                        <p className="text-[11px] sm:text-xs text-[#5C4535] font-medium">
                          ★ {currentAppointment.rating} • {currentAppointment.experienceYrs} yrs practice
                        </p>
                      </div>
                    </div>

                    {/* Rate */}
                    <div className="sm:text-right shrink-0">
                      <span className="font-cormorant text-2xl sm:text-3xl font-bold text-[#23150F]">
                        ₱{currentAppointment.ratePerHour.toLocaleString()}
                      </span>
                      <span className="text-xs sm:text-sm text-[#23150F] font-normal ml-1">
                        /per hour
                      </span>
                    </div>
                  </div>

                  {/* Subject Matter & Case Docket */}
                  <div className="space-y-2 pt-1">
                    <div className="font-bold text-[10px] sm:text-[11px] text-[#C58B3C] uppercase tracking-wider">
                      {currentAppointment.docket}
                    </div>
                    <h3 className="font-cormorant text-lg sm:text-xl font-bold text-[#23150F] leading-tight">
                      {currentAppointment.caseTitle}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-[#3E2A1E] leading-relaxed text-justify">
                      {currentAppointment.caseDescription}
                    </p>
                  </div>

                  {/* Action Buttons Row */}
                  {isCompleted ? (
                    <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-[#D1BEA8]/60">
                      {/* View Details */}
                      <button
                        type="button"
                        onClick={() => setShowDetailsModal(true)}
                        className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white transition-all hover:brightness-110"
                        style={{
                          backgroundColor: '#4A2E25',
                          boxShadow:
                            '0 6px 16px rgba(74, 46, 37, 0.38), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
                        }}
                      >
                        View Details
                      </button>

                      {/* Post-Consultation Rating Action */}
                      {isAlreadyRated ? (
                        <div
                          className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#34150F] flex items-center gap-1.5"
                          style={{
                            backgroundColor: '#DFC5A4',
                            boxShadow:
                              'inset 2px 2px 5px rgba(165, 140, 115, 0.4), inset -2px -2px 5px rgba(255, 255, 255, 0.95)',
                          }}
                        >
                          <span className="text-[#C58B3C] text-sm">★</span>
                          <span>Rated {ratedMap[currentAppointment.id]?.rating} / 5</span>
                          <span className="text-[10px] text-[#7D6855] font-normal ml-1">
                            ✓ Submitted
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRateAppointment(currentAppointment);
                            setRatingStars(5);
                            setHoverStars(null);
                            setFeedbackText('');
                            setReviewerName('');
                            setShowRateModal(true);
                          }}
                          className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#23150F] flex items-center gap-2 transition-all hover:brightness-105 active:scale-95"
                          style={{
                            backgroundColor: '#D49E56',
                            boxShadow:
                              '0 6px 16px rgba(212, 158, 86, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
                          }}
                        >
                          <span className="text-sm leading-none text-[#23150F]">★</span>
                          <span>Rate Consultation</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-[#D1BEA8]/60">
                      {/* Cancel Button */}
                      <button
                        type="button"
                        onClick={() => setShowCancelModal(true)}
                        className="px-6 py-2.5 rounded-xl text-xs font-semibold text-[#5C4535] hover:text-[#23150F] transition-all"
                        style={{
                          backgroundColor: '#ECE1D2',
                          boxShadow:
                            '4px 4px 10px rgba(182, 155, 130, 0.4), -4px -4px 10px #FFFFFF',
                        }}
                      >
                        Cancel
                      </button>

                      {/* View Details Button (Espresso) */}
                      <button
                        type="button"
                        onClick={() => setShowDetailsModal(true)}
                        className="px-6 py-2.5 rounded-xl text-xs font-semibold text-white transition-all hover:brightness-110"
                        style={{
                          backgroundColor: '#4A2E25',
                          boxShadow:
                            '0 6px 16px rgba(74, 46, 37, 0.38), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
                        }}
                      >
                        View Details
                      </button>

                      {/* Join Meet Button (Caramel Primary) */}
                      <button
                        type="button"
                        onClick={() => setShowMeetModal(true)}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#23150F] flex items-center gap-2 transition-all hover:brightness-105"
                        style={{
                          backgroundColor: '#D49E56',
                          boxShadow:
                            '0 6px 16px rgba(212, 158, 86, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
                        }}
                      >
                        <svg
                          className="w-4 h-4 text-[#23150F]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        <span>Join Meet</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Pagination Controls below appointment card */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => handleSelectAppointment(Math.max(0, activeAppointmentIndex - 1))}
                disabled={activeAppointmentIndex <= 0}
                className="w-9 h-9 rounded-full bg-[#ECE1D2] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
                style={{
                  boxShadow:
                    '4px 4px 10px rgba(182, 155, 130, 0.35), -4px -4px 10px #FFFFFF',
                }}
                aria-label="Previous consultation"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-2">
                {allAppointments.map((_, idx) => {
                  const isActive = idx === activeAppointmentIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectAppointment(idx)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        isActive ? 'bg-[#C58B3C] scale-125' : 'bg-[#362519] hover:bg-[#C58B3C]'
                      }`}
                      aria-label={`Go to consultation ${idx + 1}`}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() =>
                  handleSelectAppointment(
                    Math.min(allAppointments.length - 1, activeAppointmentIndex + 1)
                  )
                }
                disabled={activeAppointmentIndex >= allAppointments.length - 1}
                className="w-9 h-9 rounded-full bg-[#ECE1D2] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
                style={{
                  boxShadow:
                    '4px 4px 10px rgba(182, 155, 130, 0.35), -4px -4px 10px #FFFFFF',
                }}
                aria-label="Next consultation"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Cancel Consultation Modal ─────────────────────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className="w-full max-w-md rounded-[28px] p-7 bg-[#ECE1D2] space-y-4 text-center"
            style={{
              boxShadow: '16px 16px 40px rgba(0,0,0,0.25), -8px -8px 24px #FFFFFF',
            }}
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <h3 className="font-cormorant text-xl font-bold text-[#23150F]">
              Cancel Scheduled Consultation?
            </h3>
            <p className="text-xs text-[#5C4535] leading-relaxed">
              Are you sure you want to cancel your session with{' '}
              <strong>{currentAppointment.lawyerName}</strong> scheduled for{' '}
              <strong>{currentAppointment.dateStr}</strong>? Notice will be sent to counsel.
            </p>
            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-5 py-2.5 rounded-xl border border-[#C8B59E] text-xs font-semibold text-[#5C4535]"
              >
                Keep Consultation
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCancelled(true);
                  setShowCancelModal(false);
                }}
                className="px-5 py-2.5 rounded-xl bg-red-700 text-white text-xs font-semibold shadow-md"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── View Details Modal ────────────────────────────────────────────── */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-[28px] p-7 bg-[#ECE1D2] space-y-4"
            style={{
              boxShadow: '16px 16px 40px rgba(0,0,0,0.25), -8px -8px 24px #FFFFFF',
            }}
          >
            <div className="flex items-center justify-between border-b border-[#D1BEA8]/80 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
                  Booking Reference #{currentAppointment.id.toUpperCase()}
                </span>
                <h3 className="font-cormorant text-xl font-bold text-[#23150F]">
                  Consultation Docket Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="text-[#5C4535] hover:text-[#23150F] font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#3E2A1E]">
              <div className="p-3.5 rounded-xl bg-[#DFC5A4]/50 space-y-1">
                <p className="font-bold text-[#23150F]">Assigned Counsel:</p>
                <p>
                  {currentAppointment.lawyerName} (IBP {currentAppointment.ibpChapter})
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#DFC5A4]/50 space-y-1">
                <p className="font-bold text-[#23150F]">Scheduled Timing:</p>
                <p>
                  {currentAppointment.dateStr} • {currentAppointment.timeSlot}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#DFC5A4]/50 space-y-1">
                <p className="font-bold text-[#23150F]">Subject &amp; Intake Facts:</p>
                <p>{currentAppointment.caseTitle}</p>
                <p className="text-[11px] text-[#5C4535] mt-1">
                  {currentAppointment.caseDescription}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#DFC5A4]/50 space-y-1">
                <p className="font-bold text-[#23150F]">Attached Privilege Files:</p>
                <p className="text-[11px] text-[#7D6855]">No extra files attached to this session.</p>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2.5 rounded-xl bg-[#23150F] text-[#ded7cb] text-xs font-semibold"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Join Meet Preview Modal ────────────────────────────────────────── */}
      {showMeetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-[28px] p-7 bg-[#23150F] text-[#ded7cb] space-y-5"
            style={{
              boxShadow: '16px 16px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-between border-b border-[#352219] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-cormorant text-xl font-bold text-white">
                  Justicia Video Consultation Room
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMeetModal(false)}
                className="text-[#A69584] hover:text-white font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="aspect-video w-full rounded-2xl bg-[#150B07] border border-[#3E271D] flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#2A1810] border border-[#4A2E25] flex items-center justify-center text-2xl">
                📹
              </div>
              <div>
                <p className="font-medium text-sm text-white">Camera &amp; Microphone Encrypted</p>
                <p className="text-xs text-[#A69584] mt-0.5">
                  End-to-end encrypted connection with {currentAppointment.lawyerName}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-xs text-[#A69584]">Audio / Video: Ready</span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowMeetModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#3E271D] text-xs text-[#A69584] hover:text-white"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    // Mark appointment as completed
                    setCompletedStatusMap((prev) => ({
                      ...prev,
                      [currentAppointment.id]: true,
                    }));
                    if (currentAppointment.id && !currentAppointment.id.startsWith('apt-')) {
                      await completeConsultationAction(currentAppointment.id);
                    }
                    setShowMeetModal(false);
                    // Automatically trigger the Post-Consultation Rating Modal
                    setRateAppointment(currentAppointment);
                    setRatingStars(5);
                    setHoverStars(null);
                    setFeedbackText('');
                    setReviewerName('');
                    setShowRateModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition"
                >
                  ✓ End Call &amp; Complete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert('Connecting to attorney video conference room...');
                    setShowMeetModal(false);
                  }}
                  className="px-5 py-2 rounded-xl bg-[#D49E56] hover:bg-[#C58B3C] text-[#23150F] text-xs font-bold shadow-lg"
                >
                  Enter Meeting
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Rate Consultation Modal (Post-Consultation) ────────────────────── */}
      {showRateModal && rateAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className="w-full max-w-lg rounded-[28px] p-6 sm:p-8 bg-[#ECE1D2] space-y-5"
            style={{
              boxShadow: '16px 16px 40px rgba(0,0,0,0.35), -8px -8px 24px #FFFFFF',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#D1BEA8]/80 pb-3.5">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C58B3C]">
                  Verified Client Evaluation
                </span>
                <h3 className="font-cormorant text-2xl font-bold text-[#23150F] leading-tight">
                  How would you rate your consultation with {rateAppointment.lawyerName}?
                </h3>
                <p className="text-xs text-[#5C4535]">
                  Your verified evaluation directly helps fellow citizens find dependable counsel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRateModal(false)}
                className="text-[#5C4535] hover:text-[#23150F] font-bold p-1 rounded-full transition"
                aria-label="Close rating modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitRating} className="space-y-4">
              {/* Star Rating Section */}
              <div className="p-4 rounded-2xl bg-[#E5D8CB]/70 border border-[#D5C2AD] space-y-2 text-center">
                <span className="text-xs font-semibold text-[#5C4535] uppercase tracking-wider block">
                  Select Rating Score
                </span>
                <div className="flex items-center justify-center gap-2 text-3xl">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = star <= (hoverStars ?? ratingStars);
                    return (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverStars(star)}
                        onMouseLeave={() => setHoverStars(null)}
                        onClick={() => setRatingStars(star)}
                        className="transition-transform hover:scale-125 focus:outline-none p-1 text-[#C58B3C]"
                        aria-label={`${star} star`}
                      >
                        {isFilled ? '★' : '☆'}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-medium text-[#7D6855]">
                  {ratingStars === 5 && '★★★★★ (5 of 5) — Excellent Legal Advice'}
                  {ratingStars === 4 && '★★★★☆ (4 of 5) — Very Good Consultation'}
                  {ratingStars === 3 && '★★★☆☆ (3 of 5) — Satisfactory Session'}
                  {ratingStars === 2 && '★★☆☆☆ (2 of 5) — Needs Improvement'}
                  {ratingStars === 1 && '★☆☆☆☆ (1 of 5) — Unsatisfactory'}
                </p>
              </div>

              {/* Reviewer Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#5C4535] block">
                  Client Display Name (Optional):
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="e.g. Maria Santos (or leave blank for Verified Client)"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#E5D8CB] border border-[#D5C2AD] text-xs text-[#23150F] placeholder-[#8C7662] focus:outline-none focus:ring-1 focus:ring-[#C58B3C]"
                  style={{
                    boxShadow:
                      'inset 2px 2px 4px rgba(165, 140, 115, 0.35), inset -2px -2px 4px #FFFFFF',
                  }}
                />
              </div>

              {/* Feedback Content */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#5C4535] block">
                  Consultation Feedback &amp; Experience:
                </label>
                <textarea
                  rows={4}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Describe your consultation experience: clarity of counsel, understanding of law, punctuality, and responsiveness..."
                  required
                  className="w-full p-4 rounded-2xl bg-[#E5D8CB] border border-[#D5C2AD] text-xs text-[#23150F] placeholder-[#8C7662] focus:outline-none focus:ring-1 focus:ring-[#C58B3C]"
                  style={{
                    boxShadow:
                      'inset 2px 2px 5px rgba(165, 140, 115, 0.4), inset -2px -2px 5px #FFFFFF',
                  }}
                />
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRateModal(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#5C4535] hover:text-[#23150F] transition"
                  style={{
                    backgroundColor: '#ECE1D2',
                    boxShadow: '3px 3px 8px rgba(182, 155, 130, 0.4), -3px -3px 8px #FFFFFF',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRate}
                  className="px-6 py-2.5 rounded-xl bg-[#D49E56] hover:bg-[#C58B3C] text-[#23150F] text-xs font-bold transition shadow-md disabled:opacity-50 flex items-center gap-2"
                  style={{
                    boxShadow:
                      '0 6px 16px rgba(212, 158, 86, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
                  }}
                >
                  {submittingRate ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-[#23150F] border-t-transparent rounded-full animate-spin" />
                      <span>Submitting Rating...</span>
                    </>
                  ) : (
                    <span>Submit Rating</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Toast Notification ────────────────────────────────────────────── */}
      {rateToast.show && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[#3E2A1E] text-[#ECE1D2] shadow-2xl flex items-center gap-3 border border-[#C58B3C]/40 animate-in slide-in-from-bottom duration-300">
          <span className="text-[#C58B3C] text-lg">★</span>
          <span className="text-xs font-medium">{rateToast.message}</span>
        </div>
      )}
    </div>
  );
}

export default ConsultationsView;
