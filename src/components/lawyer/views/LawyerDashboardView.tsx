'use client';

import React, { useState, useCallback } from 'react';

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface ConsultationClient {
  name: string;
  age: number;
  sex: string;
  address: string;
  email: string;
  phone: string;
}

interface ScheduledConsultation {
  id: string;
  dateTag: string;
  timeTag: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  client: ConsultationClient;
  subjectCategory: string;
  subjectTitle: string;
  caseDescription: string;
}

/* ─── Mock Consultations (Matching Figma Mockup) ──────────────────────────── */

const MOCK_CONSULTATIONS: ScheduledConsultation[] = [
  {
    id: 'c1',
    dateTag: 'TODAY, SEPTEMBER 23, 2026',
    timeTag: '3:00 PM - 4:00 PM • PST, GMT+8',
    status: 'confirmed',
    client: {
      name: 'Clyde Justine B. Rosal',
      age: 21,
      sex: 'Male',
      address: 'M. Aliganga St., Purok Proper III, Brgy. Tangke, City of Naga, Cebu, Philippines, 6037',
      email: 'clydejustinerosal@gmail.com',
      phone: '+63 998 875 6587',
    },
    subjectCategory: 'SUBJECT MATTER & CASE DOCKET',
    subjectTitle: 'Makati Residential Lease Deposit Dispute & Formal Notice to Vacate',
    caseDescription:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  },
  {
    id: 'c2',
    dateTag: 'TODAY, SEPTEMBER 23, 2026',
    timeTag: '4:30 PM - 5:30 PM • PST, GMT+8',
    status: 'confirmed',
    client: {
      name: 'Maria Angela C. Reyes',
      age: 34,
      sex: 'Female',
      address: 'Unit 1502, One Rockwell East Tower, Makati City, Metro Manila, 1210',
      email: 'ma.reyes@email.com',
      phone: '+63 917 890 1234',
    },
    subjectCategory: 'CORPORATE COMPLIANCE & CONTRACTS',
    subjectTitle: 'Employment Non-Compete Clause Enforceability & Intellectual Property Assignment',
    caseDescription:
      'Client requests comprehensive review of executive employment contract containing a 2-year nationwide restrictive covenant and assignment of pre-existing software copyrights under Philippine labor jurisprudence.',
  },
  {
    id: 'c3',
    dateTag: 'TOMORROW, SEPTEMBER 24, 2026',
    timeTag: '10:00 AM - 11:00 AM • PST, GMT+8',
    status: 'confirmed',
    client: {
      name: 'Rafael Vincent D. Cruz',
      age: 45,
      sex: 'Male',
      address: '89 Mahogany St., BF Homes, Parañaque City, Metro Manila, 1720',
      email: 'rv.cruz@email.com',
      phone: '+63 928 456 7890',
    },
    subjectCategory: 'REAL PROPERTY & LAND TITLES',
    subjectTitle: 'Torrens Title Reconstitution & Boundary Dispute Settlement',
    caseDescription:
      'Dispute regarding conflicting cadastral surveys covering a 450-sqm ancestral lot in Laguna with overlapping transfer certificates of title.',
  },
  {
    id: 'c4',
    dateTag: 'FRIDAY, SEPTEMBER 25, 2026',
    timeTag: '1:30 PM - 2:30 PM • PST, GMT+8',
    status: 'confirmed',
    client: {
      name: 'Elena Sofia Mendoza',
      age: 29,
      sex: 'Female',
      address: '45 Emerald Ave., Ortigas Center, Pasig City, 1605',
      email: 'elena.mendoza@email.com',
      phone: '+63 918 333 4455',
    },
    subjectCategory: 'FAMILY CODE & CIVIL STATUS',
    subjectTitle: 'Judicial Recognition of Foreign Divorce Decree & Property Division',
    caseDescription:
      'Petition for judicial recognition of divorce obtained abroad under Article 26 of the Family Code with partition of community property regime.',
  },
];

/* ─── Custom Figma Icons ─────────────────────────────────────────────────── */

function CalendarClockIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <circle cx="17.5" cy="17.5" r="4.5" />
      <polyline points="17.5 15.5 17.5 17.5 19 19" />
    </svg>
  );
}

function BriefcaseClockIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="13" x="2" y="7" rx="2" />
      <path d="M16 20V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v15" />
      <circle cx="17" cy="17.5" r="4.5" />
      <polyline points="17 15.5 17 17.5 18.5 19" />
    </svg>
  );
}

function BarChartIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" x2="18" y1="20" y2="10" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
      <line x1="3" x2="21" y1="20" y2="20" />
    </svg>
  );
}

function StarCircleIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="12 6.5 13.7 10 17.5 10.5 14.8 13.1 15.4 17 12 15.1 8.6 17 9.2 13.1 6.5 10.5 10.3 10 12 6.5" />
    </svg>
  );
}

function VideoCamIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="5" width="14" height="14" rx="2" />
      <polygon points="16 10 22 7 22 17 16 14 16 10" fill="currentColor" />
    </svg>
  );
}

function MiniCalendarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function AvatarSilhouetteIcon({ className = 'w-18 h-18 sm:w-20 sm:h-20' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none">
      <circle cx="40" cy="40" r="36" stroke="#4E3227" strokeWidth="4.5" />
      <circle cx="40" cy="30" r="9" stroke="#4E3227" strokeWidth="4" />
      <path d="M22 58 C22 47, 30 44, 40 44 C50 44, 58 47, 58 58" stroke="#4E3227" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Authentic Neumorphic KPI Card (Exact Figma Spec) ────────────────────── */

function FigmaKPICard({
  label,
  value,
  subtitle,
  icon,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="neu-card-md rounded-[28px] p-5 flex flex-col justify-between">
      {/* Top Title */}
      <h3 className="font-cormorant text-base sm:text-lg font-bold text-[#34150F]">{label}</h3>

      {/* Warm peach inner plate with big number & icon */}
      <div className="neu-plate rounded-2xl p-4 mt-3 flex flex-col justify-between min-h-[92px]">
        <div className="flex items-center gap-3">
          <div className="text-[#34150F]">{icon}</div>
          <span className="font-cormorant text-3xl sm:text-4xl font-bold text-[#34150F] leading-none">
            {value}
          </span>
        </div>
        <p className="text-[10px] sm:text-[11px] text-[#5C4535] mt-2 font-medium leading-tight">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

/* ─── Authentic Neumorphic Consultation Card (Exact User Spec) ────────────── */

function FigmaConsultationCard({ consultation }: { consultation: ScheduledConsultation }) {
  return (
    <div className="neu-card rounded-[36px] sm:rounded-[40px] p-7 sm:p-9 lg:p-11 space-y-7">
      {/* ── Top Badges Row ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Debossed date pill */}
          <div className="neu-inset-sm rounded-full px-5 py-2 text-[11px] font-bold tracking-wider text-[#4A3227] uppercase">
            {consultation.dateTag}
          </div>

          {/* Debossed time pill */}
          <div className="neu-inset-sm rounded-full px-5 py-2 text-[11px] font-semibold text-[#4A3227]">
            {consultation.timeTag}
          </div>
        </div>

        {/* Confirmed Appointment vibrant green badge */}
        <div className="neu-badge-green rounded-full px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-white shrink-0 self-start sm:self-auto">
          CONFIRMED APPOINTMENT
        </div>
      </div>

      {/* ── Client Profile Sub-Card (Extruded Warm Peach Plate) ─────────────── */}
      <div className="neu-plate rounded-[26px] p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5 sm:gap-6 min-w-0">
          {/* Large outline avatar matching Figma crop */}
          <div className="shrink-0">
            <AvatarSilhouetteIcon className="w-18 h-18 sm:w-20 sm:h-20" />
          </div>

          <div className="space-y-0.5 min-w-0">
            <h4 className="font-cormorant text-2xl sm:text-[27px] font-bold text-[#381F17] leading-tight">
              {consultation.client.name}
            </h4>
            <p className="text-xs font-medium text-[#685042] pt-0.5">
              Age: {consultation.client.age} <span className="mx-1 text-[#8C7A6B]">|</span> Sex: {consultation.client.sex}
            </p>
            <p className="text-xs text-[#685042] leading-relaxed pt-0.5">
              {consultation.client.address}
            </p>
            <p className="text-xs text-[#685042] pt-0.5">
              {consultation.client.email} <span className="mx-1 text-[#8C7A6B]">|</span> {consultation.client.phone}
            </p>
          </div>
        </div>

        {/* Monolithic Extruded Message Button on Peach Plate */}
        <button
          type="button"
          className="neu-btn-peach rounded-full px-8 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-[#4E3227] tracking-wide shrink-0 self-start md:self-center cursor-pointer"
        >
          Message
        </button>
      </div>

      {/* ── Subject Matter & Description ───────────────────────────────────── */}
      <div className="space-y-1.5 pt-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C58B3C]">
          {consultation.subjectCategory}
        </p>
        <h3 className="font-cormorant text-2xl sm:text-[28px] font-bold text-[#381F17] leading-snug">
          {consultation.subjectTitle}
        </h3>
        <div className="space-y-3 pt-1">
          <p className="text-xs sm:text-[13px] text-[#665246] leading-relaxed">
            {consultation.caseDescription}
          </p>
          <p className="text-xs sm:text-[13px] text-[#665246] leading-relaxed">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
          </p>
        </div>
      </div>

      {/* ── Bottom Action Row ──────────────────────────────────────────────── */}
      <div className="pt-2 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left document sharing notice */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#C58B3C]">
          THIS CLIENT HAS SHARED THEIR DOCUMENTS WITH YOU.{' '}
          <span className="underline cursor-pointer hover:text-[#99431E] transition-colors">
            View Documents
          </span>
        </p>

        {/* Right 3 action buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            className="neu-btn rounded-2xl border-[1.5px] border-[#55382D] bg-[#ECE1D2] px-7 py-2.5 text-xs sm:text-sm font-semibold text-[#381F17] shadow-[2px_2px_6px_rgba(180,155,130,0.25)] hover:bg-[#E4D7C5] transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            className="neu-btn-espresso rounded-2xl px-7 py-2.5 text-xs sm:text-sm font-semibold text-white transition-all cursor-pointer"
          >
            View Details
          </button>

          <button
            type="button"
            className="neu-btn-caramel rounded-2xl px-7 py-2.5 text-xs sm:text-sm font-bold text-[#381F17] flex items-center gap-2.5 transition-all cursor-pointer"
          >
            <VideoCamIcon className="w-4 h-4 text-[#381F17]" />
            <span>Join Meet</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export function LawyerDashboardView({
  todaysConsultations = 10,
  pendingRequests = 13,
  monthlyEarnings = 84900,
  clientRating = 4.95,
}: {
  todaysConsultations?: number;
  pendingRequests?: number;
  monthlyEarnings?: number;
  clientRating?: number;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalCards = MOCK_CONSULTATIONS.length;

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % totalCards);
  }, [totalCards]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalCards) % totalCards);
  }, [totalCards]);

  const formatEarnings = (amount: number) => {
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
    return String(amount);
  };

  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-7xl mx-auto space-y-7">
      {/* ── 4 Top KPI Cards (Matching Figma Layout) ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <FigmaKPICard
          label="Today's Consultations"
          value={String(todaysConsultations)}
          subtitle="There are 3 scheduled consultations today."
          icon={<CalendarClockIcon className="w-6 h-6 text-[#34150F]" />}
        />
        <FigmaKPICard
          label="Pending Requests"
          value={String(pendingRequests)}
          subtitle="13 people are still waiting for your approval."
          icon={<BriefcaseClockIcon className="w-6 h-6 text-[#34150F]" />}
        />
        <FigmaKPICard
          label="October's Earnings"
          value={formatEarnings(monthlyEarnings)}
          subtitle="A raise of 18% vs the month of September."
          icon={<BarChartIcon className="w-6 h-6 text-[#34150F]" />}
        />
        <FigmaKPICard
          label="Client Ratings"
          value={clientRating.toFixed(2)}
          subtitle="124 reviews, 99% response rate as of Oct. 2026."
          icon={<StarCircleIcon className="w-6 h-6 text-[#34150F]" />}
        />
      </div>

      {/* ── Section Divider ─────────────────────────────────────────────────── */}
      <hr className="border-[#C8B59E]/40" />

      {/* ── Carousel Header: Extruded Heading Pill + Filter Controls ────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Extruded warm heading pill */}
        <div className="neu-plate rounded-full px-6 py-2.5 text-sm font-bold text-[#34150F] inline-flex items-center self-start">
          Today&apos;s Scheduled Consultations
        </div>

        {/* Right filter controls */}
        <div className="flex items-center gap-3">
          {/* Debossed Month Filter Pill */}
          <div className="neu-inset-sm rounded-full px-4 py-2 flex items-center gap-2.5 text-xs font-semibold text-[#34150F] cursor-pointer">
            <span>Filter by month: October 2026</span>
            <MiniCalendarIcon className="w-3.5 h-3.5 text-[#5C4535]" />
          </div>

          {/* Extruded View Toggle Pill */}
          <div className="neu-plate-sm rounded-xl p-1.5 flex items-center gap-1 cursor-pointer">
            <svg className="w-4 h-4 text-[#34150F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" x2="21" y1="6" y2="6" />
              <line x1="8" x2="21" y1="12" y2="12" />
              <line x1="8" x2="21" y1="18" y2="18" />
              <line x1="3" x2="3.01" y1="6" y2="6" />
              <line x1="3" x2="3.01" y1="12" y2="12" />
              <line x1="3" x2="3.01" y1="18" y2="18" />
            </svg>
            <svg className="w-4 h-4 text-[#8C7A6B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="7" height="7" x="3" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="3" rx="1" />
              <rect width="7" height="7" x="14" y="14" rx="1" />
              <rect width="7" height="7" x="3" y="14" rx="1" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Consultation Card Viewport ──────────────────────────────────────── */}
      <div className="overflow-hidden p-6 -m-6">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {MOCK_CONSULTATIONS.map((c) => (
            <div key={c.id} className="w-full shrink-0">
              <FigmaConsultationCard consultation={c} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Carousel Controls: Extruded Arrows + Indicator Dots ─────────────── */}
      <div className="flex items-center justify-center gap-5 pt-2">
        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={goPrev}
          className="neu-btn w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold text-[#34150F] hover:text-[#C58B3C] cursor-pointer"
          aria-label="Previous consultation"
        >
          ‹
        </button>

        {/* 4 Carousel Dots */}
        <div className="flex items-center gap-2">
          {MOCK_CONSULTATIONS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? 'w-3 h-3 bg-[#C58B3C]'
                  : 'w-2.5 h-2.5 bg-[#4A2E25]/60 hover:bg-[#4A2E25]'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={goNext}
          className="neu-btn w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold text-[#34150F] hover:text-[#C58B3C] cursor-pointer"
          aria-label="Next consultation"
        >
          ›
        </button>
      </div>
    </div>
  );
}

export default LawyerDashboardView;
