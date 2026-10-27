'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { ViewKey } from '@/components/client/ClientShell';

interface ConsultationsViewProps {
  onNavigate?: (view: ViewKey) => void;
}

interface Appointment {
  id: string;
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
  const [selectedDay, setSelectedDay] = useState<number>(23);
  const [activeAppointmentIndex, setActiveAppointmentIndex] = useState<number>(0);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [showMeetModal, setShowMeetModal] = useState<boolean>(false);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const [isSwitching, setIsSwitching] = useState<boolean>(false);

  const handleSelectAppointment = (idx: number) => {
    if (idx === activeAppointmentIndex) return;
    setIsSwitching(true);
    setActiveAppointmentIndex(idx);
    setSelectedDay(appointments[idx].day);
    setTimeout(() => setIsSwitching(false), 200);
  };

  const appointments: Appointment[] = [
    {
      id: 'apt-001',
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
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
      meetingLink: 'https://meet.justicia.ph/room/santos-clyde-20260923',
    },
    {
      id: 'apt-002',
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
      dateStr: 'OCTOBER 14, 2026',
      day: 14,
      timeSlot: '4:00 PM - 5:00 PM • PST, GMT+8',
      status: 'CONFIRMED APPOINTMENT',
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
      meetingLink: 'https://meet.justicia.ph/room/santos-clyde-20261014',
    },
  ];

  const currentAppointment = appointments[activeAppointmentIndex] || appointments[0];

  // Calendar dates: September 2026 begins on Tuesday (2 blank spaces for Sunday & Monday)
  const daysInMonth = [
    { day: null }, { day: null }, { day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }, { day: 5 },
    { day: 6 }, { day: 7 }, { day: 8 }, { day: 9 }, { day: 10 }, { day: 11 }, { day: 12 },
    { day: 13 }, { day: 14 }, { day: 15 }, { day: 16 }, { day: 17 }, { day: 18 }, { day: 19 },
    { day: 20 }, { day: 21 }, { day: 22 }, { day: 23 }, { day: 24 }, { day: 25 }, { day: 26 },
    { day: 27 }, { day: 28 }, { day: 29 }, { day: 30 }
  ];

  return (
    <div className="max-w-[1240px] mx-auto px-2 sm:px-6 py-6 space-y-6">
      {/* ─── Main 2-Column Grid (Exact Figma Layout) ───────────────────────── */}
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
                const hasAppointment = appointments.some((a) => a.day === item.day);
                return (
                  <button
                    key={`day-${item.day}`}
                    type="button"
                    onClick={() => {
                      const aptIdx = appointments.findIndex((a) => a.day === item.day);
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
              <li className="flex items-start gap-2">
                <span className="text-[8px] mt-1.5 shrink-0">●</span>
                <span>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[8px] mt-1.5 shrink-0">●</span>
                <span>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</span>
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

              {/* Status Badge (Vibrant Emerald) */}
              <div
                className={`px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wider uppercase text-white shadow-md ${
                  isCancelled ? 'bg-red-700' : 'bg-[#27AE60]'
                }`}
                style={{
                  boxShadow: isCancelled
                    ? '0 4px 12px rgba(185, 28, 28, 0.4)'
                    : '4px 6px 16px rgba(39, 174, 96, 0.4), -2px -2px 6px rgba(255, 255, 255, 0.25)',
                }}
              >
                {isCancelled ? 'CANCELLED' : currentAppointment.status}
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
                <span className="text-xs sm:text-sm text-[#23150F] font-normal ml-1">/per hour</span>
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
                <svg className="w-4 h-4 text-[#23150F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Join Meet</span>
              </button>
            </div>
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
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              {appointments.map((_, idx) => {
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
              onClick={() => handleSelectAppointment(Math.min(appointments.length - 1, activeAppointmentIndex + 1))}
              disabled={activeAppointmentIndex >= appointments.length - 1}
              className="w-9 h-9 rounded-full bg-[#ECE1D2] flex items-center justify-center text-[#5C4535] hover:text-[#23150F] disabled:opacity-30 transition-all"
              style={{
                boxShadow:
                  '4px 4px 10px rgba(182, 155, 130, 0.35), -4px -4px 10px #FFFFFF',
              }}
              aria-label="Next consultation"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

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
                <p>{currentAppointment.lawyerName} (IBP {currentAppointment.ibpChapter})</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#DFC5A4]/50 space-y-1">
                <p className="font-bold text-[#23150F]">Scheduled Timing:</p>
                <p>{currentAppointment.dateStr} • {currentAppointment.timeSlot}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#DFC5A4]/50 space-y-1">
                <p className="font-bold text-[#23150F]">Subject & Intake Facts:</p>
                <p>{currentAppointment.caseTitle}</p>
                <p className="text-[11px] text-[#5C4535] mt-1">{currentAppointment.caseDescription}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#DFC5A4]/50 space-y-1">
                <p className="font-bold text-[#23150F]">Attached Privilege Files:</p>
                <p className="text-[11px]">📎 Residential_Lease_Agreement_Makati.pdf</p>
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
                <p className="font-medium text-sm text-white">Camera & Microphone Encrypted</p>
                <p className="text-xs text-[#A69584] mt-0.5">
                  End-to-end encrypted connection with {currentAppointment.lawyerName}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-[#A69584]">Audio / Video: Ready</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowMeetModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#3E271D] text-xs text-[#A69584] hover:text-white"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => {
                    alert('Connecting to attorney video conference room...');
                    setShowMeetModal(false);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-[#D49E56] hover:bg-[#C58B3C] text-[#23150F] text-xs font-bold shadow-lg"
                >
                  Enter Meeting
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConsultationsView;
