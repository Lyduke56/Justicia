'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { PublicLawyerProfile } from './LawyerGrid';

interface LawyerDetailViewProps {
  lawyer: PublicLawyerProfile;
  onBack?: () => void;
  defaultTab?: 'about' | 'reviews' | 'booking' | 'cases';
}

type TabType = 'about' | 'reviews' | 'booking' | 'cases';

export function LawyerDetailView({
  lawyer,
  onBack,
  defaultTab = 'about',
}: LawyerDetailViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  // ─── Booking Form State ───────────────────────────────────────────────────────
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

  // ─── Reviews State ────────────────────────────────────────────────────────────
  const [selectedReviewStar, setSelectedReviewStar] = useState<number | 'all'>(5);
  const [reviewPage, setReviewPage] = useState<number>(1);
  const [helpfulCounts, setHelpfulCounts] = useState<{ [id: number]: number }>({
    0: 12,
    1: 8,
    2: 15,
    3: 6,
  });
  const [userVotedHelpful, setUserVotedHelpful] = useState<{ [id: number]: boolean }>({});

  // ─── Cases State ──────────────────────────────────────────────────────────────
  const [casePage, setCasePage] = useState<number>(1);

  // Calendar dates layout: September 2026 starts on Tuesday (2 empty slots for Sunday, Monday)
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

  const toggleHelpful = (idx: number) => {
    const hasVoted = userVotedHelpful[idx];
    setHelpfulCounts((prev) => ({
      ...prev,
      [idx]: (prev[idx] || 0) + (hasVoted ? -1 : 1),
    }));
    setUserVotedHelpful((prev) => ({
      ...prev,
      [idx]: !hasVoted,
    }));
  };

  const standardFee = lawyer.feeStandard60min ?? 1500;
  const initialFee = lawyer.feeInitial30min ?? 700;
  const extendedFee = lawyer.feeExtended120min ?? 2300;

  // Mock reviews matching Figma design names & avatar
  const allReviews = [
    {
      id: 0,
      name: 'Clyde Justine Rosal',
      stars: 5,
      date: '10/17/2026',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    },
    {
      id: 1,
      name: 'Benideck Longakit',
      stars: 5,
      date: '10/17/2026',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    },
    {
      id: 2,
      name: 'Christopher John Rubio',
      stars: 5,
      date: '10/17/2026',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    },
    {
      id: 3,
      name: 'Axziel Jay A. Bartolabac',
      stars: 5,
      date: '10/17/2026',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    },
  ];

  // Cases handled matching Figma design
  const casesHandled = [
    {
      id: 1,
      docket: 'SUBJECT MATTER & CASE DOCKET',
      title: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    },
    {
      id: 2,
      docket: 'SUBJECT MATTER & CASE DOCKET',
      title: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    },
    {
      id: 3,
      docket: 'SUBJECT MATTER & CASE DOCKET',
      title: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    },
    {
      id: 4,
      docket: 'SUBJECT MATTER & CASE DOCKET',
      title: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
      content:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    },
  ];

  return (
    <div className="max-w-[1180px] mx-auto px-2 sm:px-6 py-4 space-y-6">
      {/* ─── Back Navigation Link ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-1">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#5C4535] hover:text-[#23150F] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Lawyers Directory</span>
          </button>
        ) : (
          <Link
            href="/client/lawyers"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#5C4535] hover:text-[#23150F] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Lawyers Directory</span>
          </Link>
        )}
      </div>

      {/* ─── Lawyer Banner Header Card (Matches Figma Plate Exactly) ───────── */}
      <div
        className="w-full rounded-[26px] p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all"
        style={{
          backgroundColor: '#DFC5A4',
          boxShadow: '10px 12px 28px rgba(165, 135, 105, 0.45), 3px 4px 8px rgba(165, 135, 105, 0.25), -10px -10px 24px rgba(255, 255, 255, 0.95), -3px -3px 6px #FFFFFF',
        }}
      >
        <div className="flex items-center gap-5 sm:gap-6">
          {/* Avatar circle with dark brown border */}
          <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-[2.75px] border-[#362519] flex items-center justify-center shrink-0">
            <svg
              className="w-12 h-12 sm:w-14 sm:h-14 text-[#362519]"
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

          {/* Lawyer Info */}
          <div className="space-y-0.5">
            <h1 className="font-cormorant text-2xl sm:text-3xl font-bold text-[#23150F] leading-tight">
              {lawyer.fullName}, Ll.B.
            </h1>
            <p className="text-xs sm:text-[13px] text-[#5C4535] font-medium leading-tight">
              Roll No. {lawyer.rollNumber || '58942'} | IBP {lawyer.ibpChapter?.toUpperCase() || 'MAKATI'}
            </p>
            <p className="text-xs text-[#5C4535] font-medium">
              ★ 4.9 (53 Reviews) • {lawyer.experienceYears ?? 9} years of practice
            </p>
            <p className="text-xs text-[#5C4535] font-medium">
              {lawyer.practiceAreas && lawyer.practiceAreas.length > 0
                ? lawyer.practiceAreas.join(' • ')
                : 'Labor & Employment • Corporate • Civil Law'}
            </p>
          </div>
        </div>

        {/* Rate on right side */}
        <div className="md:text-right shrink-0">
          <div className="flex items-baseline md:justify-end">
            <span className="font-cormorant text-3xl sm:text-4xl font-bold text-[#23150F]">
              ₱{standardFee.toLocaleString()}
            </span>
            <span className="text-sm sm:text-base text-[#23150F] font-normal ml-1">/per hour</span>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs (Exact Figma Layout & Soft Drop Shadow Pill) ───── */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6 pt-2 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('about')}
          className={`font-cormorant text-base sm:text-lg font-semibold transition-all ${
            activeTab === 'about'
              ? 'bg-[#DFC5A4] text-[#23150F] font-bold px-7 sm:px-8 py-2 rounded-full shadow-[3px_4px_10px_rgba(165,135,105,0.4),-2px_-2px_6px_rgba(255,255,255,0.85)]'
              : 'text-[#4A3525] hover:text-[#23150F] px-5 py-2'
          }`}
        >
          About
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reviews')}
          className={`font-cormorant text-base sm:text-lg font-semibold transition-all ${
            activeTab === 'reviews'
              ? 'bg-[#DFC5A4] text-[#23150F] font-bold px-7 sm:px-8 py-2 rounded-full shadow-[3px_4px_10px_rgba(165,135,105,0.4),-2px_-2px_6px_rgba(255,255,255,0.85)]'
              : 'text-[#4A3525] hover:text-[#23150F] px-5 py-2'
          }`}
        >
          Reviews
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('booking')}
          className={`font-cormorant text-base sm:text-lg font-semibold transition-all ${
            activeTab === 'booking'
              ? 'bg-[#DFC5A4] text-[#23150F] font-bold px-7 sm:px-8 py-2 rounded-full shadow-[3px_4px_10px_rgba(165,135,105,0.4),-2px_-2px_6px_rgba(255,255,255,0.85)]'
              : 'text-[#4A3525] hover:text-[#23150F] px-5 py-2'
          }`}
        >
          Consultation Booking
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cases')}
          className={`font-cormorant text-base sm:text-lg font-semibold transition-all ${
            activeTab === 'cases'
              ? 'bg-[#DFC5A4] text-[#23150F] font-bold px-7 sm:px-8 py-2 rounded-full shadow-[3px_4px_10px_rgba(165,135,105,0.4),-2px_-2px_6px_rgba(255,255,255,0.85)]'
              : 'text-[#4A3525] hover:text-[#23150F] px-5 py-2'
          }`}
        >
          Cases Handled
        </button>
      </div>

      {/* ─── TAB 1: ABOUT (Matches Image 4) ─────────────────────────────────── */}
      {activeTab === 'about' && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {/* Top Row: Bio (Left) & Consultation Rates (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Bio Card (8 cols) */}
            <div
              className="lg:col-span-8 rounded-[28px] p-7 sm:p-8 bg-[#ECE1D2] flex flex-col justify-center"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              <p className="text-xs sm:text-[13px] text-[#3E2A1E] leading-relaxed text-justify">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
              </p>
            </div>

            {/* Consultation Rates Card (4 cols) */}
            <div
              className="lg:col-span-4 rounded-[28px] p-6 sm:p-7 flex flex-col justify-center space-y-4"
              style={{
                backgroundColor: '#DFC5A4',
                boxShadow:
                  '10px 12px 28px rgba(165, 135, 105, 0.45), 3px 4px 8px rgba(165, 135, 105, 0.25), -10px -10px 24px rgba(255, 255, 255, 0.95), -3px -3px 6px #FFFFFF',
              }}
            >
              <h3 className="font-cormorant text-xl sm:text-2xl font-bold text-[#23150F] text-center">
                Consultation Rates:
              </h3>

              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-xs sm:text-[13px] text-[#4A3525] font-medium">Initial Consultation (30 mins)</span>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-xs sm:text-sm text-[#23150F]">₱{initialFee.toLocaleString()}</span>
                    <span className="text-[11px] text-[#5C4535] ml-1">/per hour</span>
                  </div>
                </div>

                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-xs sm:text-[13px] text-[#4A3525] font-medium">Standard Consultation (1 hr)</span>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-xs sm:text-sm text-[#23150F]">₱{standardFee.toLocaleString()}</span>
                    <span className="text-[11px] text-[#5C4535] ml-1">/per hour</span>
                  </div>
                </div>

                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-xs sm:text-[13px] text-[#4A3525] font-medium">Extended Consultation (2 hrs)</span>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-xs sm:text-sm text-[#23150F]">₱{extendedFee.toLocaleString()}</span>
                    <span className="text-[11px] text-[#5C4535] ml-1">/per hour</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Background Section */}
          <div className="space-y-4">
            <h2 className="font-cormorant text-2xl font-bold text-[#23150F]">Professional Background</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Areas of Practice */}
              <div
                className="rounded-[24px] p-6 bg-[#ECE1D2] space-y-2.5"
                style={{
                  boxShadow:
                    '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF, 2px 2px 6px rgba(182, 155, 130, 0.15)',
                }}
              >
                <h4 className="font-cormorant font-bold text-base text-[#23150F]">Areas of Practice</h4>
                <ul className="space-y-1.5 text-xs text-[#3E2A1E] leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>

              {/* Legal Experience */}
              <div
                className="rounded-[24px] p-6 bg-[#ECE1D2] space-y-2.5"
                style={{
                  boxShadow:
                    '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF, 2px 2px 6px rgba(182, 155, 130, 0.15)',
                }}
              >
                <h4 className="font-cormorant font-bold text-base text-[#23150F]">Legal Experience</h4>
                <ul className="space-y-1.5 text-xs text-[#3E2A1E] leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>

              {/* Consultation Services */}
              <div
                className="rounded-[24px] p-6 bg-[#ECE1D2] space-y-2.5"
                style={{
                  boxShadow:
                    '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF, 2px 2px 6px rgba(182, 155, 130, 0.15)',
                }}
              >
                <h4 className="font-cormorant font-bold text-base text-[#23150F]">Consultation Services</h4>
                <ul className="space-y-1.5 text-xs text-[#3E2A1E] leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>

              {/* Philippine Bar Examination Passer */}
              <div
                className="rounded-[24px] p-6 bg-[#ECE1D2] space-y-2.5"
                style={{
                  boxShadow:
                    '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF, 2px 2px 6px rgba(182, 155, 130, 0.15)',
                }}
              >
                <h4 className="font-cormorant font-bold text-base text-[#23150F]">
                  Philippine Bar Examination Passer ({lawyer.barPasserYear ?? 2022})
                </h4>
                <ul className="space-y-1.5 text-xs text-[#3E2A1E] leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Educational Background Section */}
          <div className="space-y-4">
            <h2 className="font-cormorant text-2xl font-bold text-[#23150F]">Educational Background</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card 1: Juris Doctor */}
              <div
                className="rounded-[24px] p-6 bg-[#ECE1D2] space-y-3"
                style={{
                  boxShadow:
                    '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF, 2px 2px 6px rgba(182, 155, 130, 0.15)',
                }}
              >
                <div className="flex items-center gap-3.5">
                  {/* Scales of Justice Icon */}
                  <svg className="w-8 h-8 text-[#23150F] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3v18M7 21h10M3 7h18" />
                    <path d="M6 7l-3 7c0 1.5 1.5 2.5 3 2.5s3-1 3-2.5L6 7z" />
                    <path d="M18 7l-3 7c0 1.5 1.5 2.5 3 2.5s3-1 3-2.5L18 7z" />
                  </svg>
                  <div>
                    <h4 className="font-cormorant font-bold text-base sm:text-lg text-[#23150F] leading-tight">
                      Juris Doctor (2017 - 2021)
                    </h4>
                    <p className="text-xs text-[#7D6855]">University of the Philippines - Cebu</p>
                  </div>
                </div>

                <ul className="space-y-1.5 text-xs text-[#3E2A1E] leading-relaxed pt-1">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>

              {/* Card 2: Bachelor of Arts in Political Science */}
              <div
                className="rounded-[24px] p-6 bg-[#ECE1D2] space-y-3"
                style={{
                  boxShadow:
                    '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF, 2px 2px 6px rgba(182, 155, 130, 0.15)',
                }}
              >
                <div className="flex items-center gap-3.5">
                  {/* Graduation Cap / Diploma Icon */}
                  <svg className="w-8 h-8 text-[#23150F] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                  <div>
                    <h4 className="font-cormorant font-bold text-base sm:text-lg text-[#23150F] leading-tight">
                      Bachelor of Arts in Political Science (2013 - 2017)
                    </h4>
                    <p className="text-xs text-[#7D6855]">University of San Carlos - Main Campus</p>
                  </div>
                </div>

                <ul className="space-y-1.5 text-xs text-[#3E2A1E] leading-relaxed pt-1">
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[8px] mt-1.5 shrink-0">●</span>
                    <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: REVIEWS (Matches Image 1) ───────────────────────────────── */}
      {activeTab === 'reviews' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Main Large Reviews Outer Container */}
          <div
            className="rounded-[28px] p-6 sm:p-9 bg-[#ECE1D2] space-y-6"
            style={{
              boxShadow:
                '14px 14px 32px rgba(182, 155, 130, 0.4), -14px -14px 32px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
            }}
          >
            {/* Score header */}
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-cormorant text-5xl sm:text-6xl font-bold text-[#23150F] leading-none">
                4.9
              </span>
              <span className="font-cormorant text-2xl sm:text-3xl font-semibold text-[#23150F]">
                /5
              </span>

              {/* 5 Stars */}
              <div className="flex items-center gap-1.5 text-[#C58B3C] text-2xl sm:text-3xl ml-3 sm:ml-5">
                <span>★</span>
                <span>★</span>
                <span>★</span>
                <span>★</span>
                <span>★</span>
              </div>

              <span className="font-sans text-xs sm:text-sm font-medium text-[#4A3525] ml-2">
                (53 Reviews)
              </span>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
              <button
                type="button"
                onClick={() => setSelectedReviewStar(5)}
                className={`px-6 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  selectedReviewStar === 5
                    ? 'bg-[#DFC5A4] text-[#23150F] font-bold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15)]'
                    : 'bg-[#E5D5C1] hover:bg-[#DFC5A4] text-[#4A3525] shadow-[2px_2px_5px_rgba(182,155,130,0.25)]'
                }`}
              >
                5
              </button>

              <button
                type="button"
                onClick={() => setSelectedReviewStar(4)}
                className={`px-5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  selectedReviewStar === 4
                    ? 'bg-[#DFC5A4] text-[#23150F] font-bold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15)]'
                    : 'bg-[#E5D5C1] hover:bg-[#DFC5A4] text-[#4A3525] shadow-[2px_2px_5px_rgba(182,155,130,0.25)]'
                }`}
              >
                ★4
              </button>

              <button
                type="button"
                onClick={() => setSelectedReviewStar(3)}
                className={`px-5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  selectedReviewStar === 3
                    ? 'bg-[#DFC5A4] text-[#23150F] font-bold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15)]'
                    : 'bg-[#E5D5C1] hover:bg-[#DFC5A4] text-[#4A3525] shadow-[2px_2px_5px_rgba(182,155,130,0.25)]'
                }`}
              >
                ★3
              </button>

              <button
                type="button"
                onClick={() => setSelectedReviewStar(2)}
                className={`px-5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  selectedReviewStar === 2
                    ? 'bg-[#DFC5A4] text-[#23150F] font-bold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15)]'
                    : 'bg-[#E5D5C1] hover:bg-[#DFC5A4] text-[#4A3525] shadow-[2px_2px_5px_rgba(182,155,130,0.25)]'
                }`}
              >
                ★2
              </button>

              <button
                type="button"
                onClick={() => setSelectedReviewStar(1)}
                className={`px-5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  selectedReviewStar === 1
                    ? 'bg-[#DFC5A4] text-[#23150F] font-bold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.15)]'
                    : 'bg-[#E5D5C1] hover:bg-[#DFC5A4] text-[#4A3525] shadow-[2px_2px_5px_rgba(182,155,130,0.25)]'
                }`}
              >
                ★1
              </button>
            </div>

            {/* Review Cards Stack */}
            <div className="space-y-4 pt-1">
              {allReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-[22px] p-5 sm:p-6 space-y-3"
                  style={{
                    backgroundColor: '#DFC5A4',
                    boxShadow:
                      '6px 8px 18px rgba(165, 135, 105, 0.4), 2px 2px 5px rgba(165, 135, 105, 0.2), -6px -6px 16px rgba(255, 255, 255, 0.9), -2px -2px 4px #FFFFFF',
                  }}
                >
                  {/* Header: Avatar, Name, Stars, Date */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-[#362519] flex items-center justify-center shrink-0">
                      <svg
                        className="w-5 h-5 text-[#362519]"
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

                    <div>
                      <h4 className="font-sans font-bold text-xs sm:text-sm text-[#23150F] leading-tight">
                        {rev.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center text-[#C58B3C] text-xs">
                          {'★'.repeat(rev.stars)}
                        </div>
                        <span className="text-[10px] sm:text-[11px] text-[#5C4535] font-medium">
                          {rev.date}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body Text */}
                  <p className="text-xs sm:text-[13px] text-[#34150F] leading-relaxed text-justify">
                    {rev.content}
                  </p>

                  {/* Footer Action Links */}
                  <div className="flex items-center gap-5 pt-1 text-[11px] font-medium text-[#5C4535]">
                    <button
                      type="button"
                      onClick={() => alert(`Reply to ${rev.name}`)}
                      className="inline-flex items-center gap-1.5 hover:text-[#23150F] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 17 4 12 9 7" />
                        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                      </svg>
                      <span>Reply</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleHelpful(rev.id)}
                      className="inline-flex items-center gap-1.5 hover:text-[#23150F] transition-colors"
                    >
                      <svg
                        className={`w-3.5 h-3.5 ${userVotedHelpful[rev.id] ? 'fill-current text-[#C58B3C]' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                      </svg>
                      <span>Helpful? ({helpfulCounts[rev.id] || 0})</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Pagination matching Figma: < ● ● ● ● > */}
          <div className="flex items-center justify-center gap-4 pt-3 pb-4">
            <button
              type="button"
              onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
              disabled={reviewPage <= 1}
              className="w-9 h-9 rounded-full bg-[#ECE1D2] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
              style={{
                boxShadow:
                  '4px 4px 10px rgba(182, 155, 130, 0.35), -4px -4px 10px #FFFFFF',
              }}
              aria-label="Previous reviews page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((p) => {
                const isActive = p === reviewPage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setReviewPage(p)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      isActive ? 'bg-[#362519] scale-125' : 'bg-[#C58B3C]/80 hover:bg-[#362519]'
                    }`}
                    aria-label={`Go to review page ${p}`}
                  />
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setReviewPage((p) => Math.min(4, p + 1))}
              disabled={reviewPage >= 4}
              className="w-9 h-9 rounded-full bg-[#ECE1D2] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
              style={{
                boxShadow:
                  '4px 4px 10px rgba(182, 155, 130, 0.35), -4px -4px 10px #FFFFFF',
              }}
              aria-label="Next reviews page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB 3: CONSULTATION BOOKING (Matches Image 3) ───────────────────── */}
      {activeTab === 'booking' && (
        <form onSubmit={handleSubmitBooking} className="space-y-8 animate-in fade-in duration-150">
          {/* Confirmation Feedback */}
          {bookingStatus === 'saved' && (
            <div className="p-4 rounded-2xl bg-amber-100/90 border border-amber-300 text-amber-900 text-xs sm:text-sm flex items-center justify-between">
              <span>✓ Consultation draft details saved. You can complete your submission anytime.</span>
              <button type="button" onClick={() => setBookingStatus('idle')} className="font-bold">✕</button>
            </div>
          )}

          {bookingStatus === 'submitted' && (
            <div className="p-6 rounded-3xl bg-emerald-100/95 border border-emerald-300 text-emerald-950 space-y-3">
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
                  className="px-5 py-2.5 rounded-xl bg-[#23150F] text-[#ded7cb] text-xs font-semibold hover:bg-[#352219]"
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

          {/* Calendar & Time Slots Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Calendar Card (Left - 8 cols) */}
            <div
              className="lg:col-span-8 rounded-[28px] p-6 sm:p-8 bg-[#ECE1D2] flex flex-col justify-between"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-10">
                {/* Big Date Highlight */}
                <div className="text-center sm:text-left sm:pr-8 sm:border-r border-[#D1BEA8]/80 shrink-0">
                  <div className="font-cormorant text-base font-bold uppercase tracking-widest text-[#4A3525]">
                    SEPT
                  </div>
                  <div className="font-cormorant text-6xl sm:text-7xl font-bold text-[#C58B3C] leading-none my-1">
                    {selectedDay}
                  </div>
                  <div className="font-cormorant text-xs sm:text-sm font-bold tracking-widest uppercase text-[#4A3525]">
                    WEDNESDAY
                  </div>
                </div>

                {/* Mini Calendar Grid */}
                <div className="flex-1 w-full max-w-sm sm:max-w-none">
                  <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center pb-3 text-[11px] sm:text-xs font-bold text-[#4A3525] uppercase tracking-wider">
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
                              ? 'bg-[#DFC5A4] text-[#C58B3C] font-bold shadow-[inset_1px_1px_3px_rgba(0,0,0,0.18)] scale-105'
                              : 'text-[#3E2A1E] hover:bg-[#DECEB8] hover:text-[#23150F]'
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
              className="lg:col-span-4 rounded-[28px] p-6 bg-[#ECE1D2] flex flex-col justify-center space-y-3"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              {timeSlots.map((slot) => {
                const isSelected = selectedTimeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTimeSlot(slot)}
                    className={`w-full py-2.5 px-3 rounded-full text-xs font-medium transition-all text-center ${
                      isSelected
                        ? 'bg-[#DFC5A4] text-[#23150F] font-bold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
                        : 'bg-[#E6D7C3] hover:bg-[#DFC5A4]/60 text-[#5C4535] shadow-[2px_2px_5px_rgba(182,155,130,0.25)]'
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
            <h2 className="font-cormorant text-2xl font-bold text-[#23150F]">Mode of Communication</h2>
            <div
              className="rounded-[28px] p-5 sm:p-6 bg-[#ECE1D2] space-y-3"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              {/* Option 1: Video Consultation */}
              <div
                onClick={() => setCommunicationMode('video')}
                className={`flex items-start gap-3.5 p-4 rounded-[20px] cursor-pointer transition-all ${
                  communicationMode === 'video'
                    ? 'bg-[#DFC5A4] shadow-[4px_5px_12px_rgba(165,135,105,0.35),-3px_-3px_8px_rgba(255,255,255,0.85)]'
                    : 'bg-transparent hover:bg-[#E5D5C1]/50'
                }`}
              >
                <div className="mt-0.5">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      communicationMode === 'video' ? 'border-[#23150F]' : 'border-[#7D6855]'
                    }`}
                  >
                    {communicationMode === 'video' && <div className="w-2 h-2 rounded-full bg-[#23150F]" />}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#23150F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs sm:text-sm font-bold text-[#23150F]">Video Consultation</span>
                    <span className="text-[9px] uppercase tracking-wider font-bold bg-[#ECE1D2] text-[#9E6C28] px-2 py-0.5 rounded-full ml-1">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#5C4535] leading-relaxed">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                  </p>
                </div>
              </div>

              {/* Option 2: Audio Call */}
              <div
                onClick={() => setCommunicationMode('audio')}
                className={`flex items-start gap-3.5 p-4 rounded-[20px] cursor-pointer transition-all ${
                  communicationMode === 'audio'
                    ? 'bg-[#DFC5A4] shadow-[4px_5px_12px_rgba(165,135,105,0.35),-3px_-3px_8px_rgba(255,255,255,0.85)]'
                    : 'bg-transparent hover:bg-[#E5D5C1]/50'
                }`}
              >
                <div className="mt-0.5">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      communicationMode === 'audio' ? 'border-[#23150F]' : 'border-[#7D6855]'
                    }`}
                  >
                    {communicationMode === 'audio' && <div className="w-2 h-2 rounded-full bg-[#23150F]" />}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#23150F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span className="text-xs sm:text-sm font-bold text-[#23150F]">Audio Call</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-[#5C4535] leading-relaxed">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Purpose of Consultation Section */}
          <div className="space-y-3">
            <h2 className="font-cormorant text-2xl font-bold text-[#23150F]">Purpose of Consultation</h2>
            <div
              className="rounded-[28px] p-6 sm:p-8 bg-[#ECE1D2] space-y-5"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#5C4535]">Subject:</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Makati Residential Lease: Deposit Dispute & Formal Notice to Vacate"
                  className="w-full rounded-2xl py-3 px-4 bg-[#E4D5C2] text-xs sm:text-sm text-[#23150F] placeholder:text-[#9E8E7D] focus:outline-none"
                  style={{
                    boxShadow:
                      'inset 3px 3px 6px rgba(165, 140, 115, 0.45), inset -3px -3px 6px rgba(255, 255, 255, 0.85)',
                  }}
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
                  className="w-full rounded-2xl py-3 px-4 bg-[#E4D5C2] text-xs sm:text-sm text-[#23150F] placeholder:text-[#9E8E7D] focus:outline-none resize-y"
                  style={{
                    boxShadow:
                      'inset 3px 3px 6px rgba(165, 140, 115, 0.45), inset -3px -3px 6px rgba(255, 255, 255, 0.85)',
                  }}
                />
              </div>

              {/* File Attachments Dropzone */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#5C4535]">File Attachments</label>
                <div
                  className="w-full py-10 px-6 rounded-2xl bg-[#E4D5C2] flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#DECDBA] transition-all"
                  style={{
                    boxShadow:
                      'inset 3px 3px 6px rgba(165, 140, 115, 0.45), inset -3px -3px 6px rgba(255, 255, 255, 0.85)',
                  }}
                  onClick={() => {
                    const fileName = prompt('Enter document name to attach (e.g., Contract_Addendum.pdf):');
                    if (fileName) setAttachedFiles([...attachedFiles, fileName]);
                  }}
                >
                  <svg className="w-10 h-10 text-[#7D6855]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="text-xs text-[#7D6855] font-medium mt-3">
                    Drag and Drop, or Attach Relevant Files
                  </span>
                </div>

                {/* Attached Files List */}
                {attachedFiles.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {attachedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#DFC5A4]/60 text-xs text-[#23150F]">
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
                  className="px-8 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#23150F] hover:bg-[#D4B892] transition-all mx-auto block"
                  style={{
                    backgroundColor: '#DFC5A4',
                    boxShadow:
                      '4px 5px 12px rgba(165, 135, 105, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.85)',
                  }}
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
                  className="mt-0.5 rounded border-[#C8B59E] text-[#C58B3C] focus:ring-[#C58B3C] w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-[#5C4535] leading-relaxed select-none">
                  I agree that this intake form and attached records will be reviewed strictly under confidential attorney-client privilege prior to the scheduled consultation session.
                </span>
              </label>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClearInputs}
              className="w-full sm:w-auto px-6 py-2 rounded-xl border border-[#C8B59E] text-xs font-medium text-[#5C4535] hover:bg-[#E5D5C1] transition-colors"
            >
              Clear All Inputs
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="w-full sm:w-auto px-8 py-2 rounded-xl text-xs font-semibold text-[#23150F] hover:bg-[#D4B892] transition-all"
              style={{
                backgroundColor: '#DFC5A4',
                boxShadow:
                  '3px 4px 8px rgba(165, 135, 105, 0.3), -2px -2px 6px rgba(255, 255, 255, 0.85)',
              }}
            >
              Save
            </button>
          </div>

          {/* Divider Line */}
          <hr className="border-[#D1BEA8]/80 my-8" />

          {/* Centered Large Submit Button */}
          <div className="pt-2 pb-6">
            <button
              type="submit"
              className="w-full max-w-xs mx-auto block py-3 px-10 rounded-2xl text-sm sm:text-base font-bold text-[#23150F] text-center transition-all hover:brightness-105"
              style={{
                backgroundColor: '#DFC5A4',
                boxShadow:
                  '6px 8px 18px rgba(165, 135, 105, 0.45), -4px -4px 12px rgba(255, 255, 255, 0.85)',
              }}
            >
              Submit Booking
            </button>
          </div>
        </form>
      )}

      {/* ─── TAB 4: CASES HANDLED (Matches Image 2) ─────────────────────────── */}
      {activeTab === 'cases' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Stack of 4 Case Cards matching Figma */}
          {casesHandled.map((caseItem) => (
            <div
              key={caseItem.id}
              className="rounded-[28px] p-6 sm:p-8 bg-[#ECE1D2] space-y-2.5"
              style={{
                boxShadow:
                  '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF, 3px 3px 8px rgba(182, 155, 130, 0.2), -3px -3px 8px #FFFFFF',
              }}
            >
              <div className="font-bold text-[10px] sm:text-[11px] text-[#C58B3C] uppercase tracking-wider">
                {caseItem.docket}
              </div>
              <h3 className="font-cormorant text-lg sm:text-xl font-bold text-[#23150F] leading-tight">
                {caseItem.title}
              </h3>
              <p className="text-xs sm:text-[13px] text-[#3E2A1E] leading-relaxed text-justify">
                {caseItem.content}
              </p>
            </div>
          ))}

          {/* Bottom Pagination matching Figma: < ● ● ● ● > */}
          <div className="flex items-center justify-center gap-4 pt-3 pb-4">
            <button
              type="button"
              onClick={() => setCasePage((p) => Math.max(1, p - 1))}
              disabled={casePage <= 1}
              className="w-9 h-9 rounded-full bg-[#ECE1D2] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
              style={{
                boxShadow:
                  '4px 4px 10px rgba(182, 155, 130, 0.35), -4px -4px 10px #FFFFFF',
              }}
              aria-label="Previous cases page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((p) => {
                const isActive = p === casePage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCasePage(p)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      isActive ? 'bg-[#362519] scale-125' : 'bg-[#C58B3C]/80 hover:bg-[#362519]'
                    }`}
                    aria-label={`Go to case page ${p}`}
                  />
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setCasePage((p) => Math.min(4, p + 1))}
              disabled={casePage >= 4}
              className="w-9 h-9 rounded-full bg-[#ECE1D2] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
              style={{
                boxShadow:
                  '4px 4px 10px rgba(182, 155, 130, 0.35), -4px -4px 10px #FFFFFF',
              }}
              aria-label="Next cases page"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LawyerDetailView;
