'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getLawyerConsultationsAction,
  respondToConsultationAction,
} from '@/app/actions/consultationActions';

/* ─── Types ────────────────────────────────────────────────────────────────── */

type ConsultationTab = 'all' | 'pending' | 'upcoming' | 'completed' | 'cancelled';

interface AppointmentItem {
  id: string;
  name: string;
  timeSlot: string;
  active?: boolean;
}

interface ConsultationClient {
  name: string;
  age: number;
  sex: string;
  address: string;
  email: string;
  phone: string;
}

interface DetailedConsultation {
  id: string;
  dateTag: string;
  timeTag: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  client: ConsultationClient;
  subjectCategory: string;
  subjectTitle: string;
  caseDescription: string;
  fee?: number;
  payment?: {
    method?: string;
    referenceNumber?: string;
    payerName?: string;
    amount?: number;
    receiptFileName?: string;
    receiptBase64?: string;
  } | null;
  attachedFiles?: Array<{ name: string }>;
  meetingLink?: string;
}

/* ─── Mock Data (Matching Figma Mockup) ──────────────────────────────────── */

const APPOINTMENTS_LIST: AppointmentItem[] = [
  { id: 'a1', name: 'Clyde Justine B. Rosal', timeSlot: '9 AM – 10 AM', active: true },
  { id: 'a2', name: 'Axziel Jay A. Bartolaba', timeSlot: '10 AM – 11 AM' },
  { id: 'a3', name: 'Benideck J. Longakit', timeSlot: '1 PM – 2 PM' },
  { id: 'a4', name: 'Christopher John G. Rubio', timeSlot: '2 PM – 3 PM' },
];

const CONSULTATION_DETAILS: Record<string, DetailedConsultation> = {
  a1: {
    id: 'a1',
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
  a2: {
    id: 'a2',
    dateTag: 'TODAY, SEPTEMBER 23, 2026',
    timeTag: '10:00 AM - 11:00 AM • PST, GMT+8',
    status: 'confirmed',
    client: {
      name: 'Axziel Jay A. Bartolaba',
      age: 28,
      sex: 'Male',
      address: '14 Orchid St., Capitol Site, Cebu City, 6000',
      email: 'axziel.bartolaba@email.com',
      phone: '+63 917 555 1234',
    },
    subjectCategory: 'COMMERCIAL LEASING & CONTRACTS',
    subjectTitle: 'Retail Commercial Lease Termination & Security Deposit Recovery',
    caseDescription:
      'Commercial tenant seeking legal counsel regarding early lease surrender penalties, restoration obligations, and recovery of three months security deposit following landlord breach of maintenance covenants.',
  },
  a3: {
    id: 'a3',
    dateTag: 'TODAY, SEPTEMBER 23, 2026',
    timeTag: '1:00 PM - 2:00 PM • PST, GMT+8',
    status: 'confirmed',
    client: {
      name: 'Benideck J. Longakit',
      age: 32,
      sex: 'Male',
      address: '77 Narra Ave., Ayala Alabang Village, Muntinlupa City, 1780',
      email: 'benideck.longakit@email.com',
      phone: '+63 920 888 9900',
    },
    subjectCategory: 'LABOR & EMPLOYMENT LAW',
    subjectTitle: 'Constructive Dismissal & Unpaid Executive Commissions Dispute',
    caseDescription:
      'Senior executive forced to resign after substantial diminution of management responsibilities and withheld performance incentive commissions under DOLE regulations.',
  },
  a4: {
    id: 'a4',
    dateTag: 'TODAY, SEPTEMBER 23, 2026',
    timeTag: '2:00 PM - 3:00 PM • PST, GMT+8',
    status: 'confirmed',
    client: {
      name: 'Christopher John G. Rubio',
      age: 35,
      sex: 'Male',
      address: 'Block 8 Lot 22, Greenwoods Exec. Village, Pasig City, 1600',
      email: 'cj.rubio@email.com',
      phone: '+63 919 444 7788',
    },
    subjectCategory: 'INTELLECTUAL PROPERTY & TECH',
    subjectTitle: 'Software SaaS Licensing & Trademark Infringement Notice',
    caseDescription:
      'SaaS startup founder issuing cease-and-desist letter against competitor for unauthorized reproduction of proprietary workflow engines and registered marks.',
  },
};

/* ─── Inline Icons ─────────────────────────────────────────────────────────── */

function SearchIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
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

function AvatarSilhouetteIcon({ className = 'w-18 h-18 sm:w-20 sm:h-20' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none">
      <circle cx="40" cy="40" r="36" stroke="#4E3227" strokeWidth="4.5" />
      <circle cx="40" cy="30" r="9" stroke="#4E3227" strokeWidth="4" />
      <path d="M22 58 C22 47, 30 44, 40 44 C50 44, 58 47, 58 58" stroke="#4E3227" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export function LawyerConsultationsView({
  lawyerUserId,
  lawyerName,
}: {
  lawyerUserId?: string;
  lawyerName?: string;
} = {}) {
  const router = useRouter();
  const [dbConsultations, setDbConsultations] = useState<DetailedConsultation[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ConsultationTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('a1');
  const [carouselIndex, setCarouselIndex] = useState(0);


  // Fetch real consultations from database
  useEffect(() => {
    getLawyerConsultationsAction(lawyerUserId).then((data: any) => {
      if (data && data.length > 0) {
        setDbConsultations(data);
        if (data[0]?.id) setSelectedAppointmentId(data[0].id);
      }
    });
  }, [lawyerUserId]);

  // Combine database consultations (first priority) with mock consultations
  const combinedConsultationsList = useMemo(() => {
    if (dbConsultations.length > 0) {
      return dbConsultations;
    }
    return Object.values(CONSULTATION_DETAILS);
  }, [dbConsultations]);

  // Filter consultations by status tab
  const appointmentsToDisplay = useMemo(() => {
    return combinedConsultationsList.filter((c) => {
      if (activeTab === 'pending') return c.status === 'pending';
      if (activeTab === 'upcoming') return c.status === 'confirmed';
      if (activeTab === 'completed') return c.status === 'completed';
      if (activeTab === 'cancelled') return c.status === 'cancelled';
      return true; // 'all'
    });
  }, [combinedConsultationsList, activeTab]);

  const selectedConsultation = useMemo(() => {
    return (
      combinedConsultationsList.find((c) => c.id === selectedAppointmentId) ||
      appointmentsToDisplay[0] ||
      combinedConsultationsList[0] ||
      null
    );
  }, [combinedConsultationsList, selectedAppointmentId, appointmentsToDisplay]);



  const handleApprove = async (id: string) => {
    setUpdatingId(id);
    const res = await respondToConsultationAction(id, 'approved');
    if (res?.error) {
      alert(res.error);
    } else {
      setDbConsultations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'confirmed' } : c))
      );
    }
    setUpdatingId(null);
  };

  const handleDecline = async (id: string) => {
    const reason = prompt('Please enter reason for declining (e.g. Schedule conflict):');
    if (!reason) return;
    setUpdatingId(id);
    const res = await respondToConsultationAction(id, 'rejected', reason);
    if (res?.error) {
      alert(res.error);
    } else {
      setDbConsultations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'cancelled' } : c))
      );
    }
    setUpdatingId(null);
  };

  const tabs: { key: ConsultationTab; label: string; count: number }[] = [
    { key: 'all',       label: 'All Inquires',       count: 50 },
    { key: 'pending',   label: 'Pending Approval',   count: 17 },
    { key: 'upcoming',  label: 'Upcoming',           count: 33 },
    { key: 'completed', label: 'Completed',          count: 39 },
    { key: 'cancelled', label: 'Cancelled',          count: 3 },
  ];

  return (
    <div className="p-6 sm:p-9 lg:p-10 max-w-7xl mx-auto space-y-7">
      {/* ── Top Status Tabs & Search Section ─────────────────────────────────── */}
      <div className="space-y-4">
        {/* Status Tab Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-2xl px-5 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'neu-plate text-[#381F17] font-bold shadow-[inset_2px_2px_4px_rgba(165,135,105,0.45),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
                    : 'neu-btn text-[#5C4535] hover:text-[#381F17]'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>

        {/* Search & Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Debossed Search Input */}
          <div className="flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Client Name"
              className="neu-inset rounded-2xl px-5 py-3 text-xs w-full text-[#381F17] placeholder-[#8C7A6B] focus:outline-none"
            />
          </div>

          {/* Raised Search Button */}
          <button
            type="button"
            className="neu-plate-sm rounded-2xl px-7 py-3 text-xs font-semibold text-[#381F17] flex items-center justify-center gap-2 cursor-pointer hover:filter hover:brightness-105 transition-all"
          >
            <SearchIcon className="w-3.5 h-3.5 text-[#381F17]" />
            <span>Search</span>
          </button>

          {/* Specialization Filter Dropdown */}
          <div className="relative">
            <select className="appearance-none neu-inset rounded-2xl pl-5 pr-10 py-3 text-xs font-semibold text-[#381F17] focus:outline-none cursor-pointer">
              <option>Labor & Employment</option>
              <option>Corporate & Commercial</option>
              <option>Real Property & Land Titles</option>
              <option>Family & Civil Status</option>
              <option>Intellectual Property</option>
            </select>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-[#5C4535]">
              ▼
            </span>
          </div>
        </div>
      </div>

      {/* ── Two-Column Main Content Layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[330px_1fr] gap-8 items-start">
        {/* ── Left Column: Calendar & Appointments List ─────────────────────── */}
        <div className="w-full xl:w-[330px] space-y-6 shrink-0">
          {/* Extruded "Upcoming Consultations" heading pill */}
          <div className="neu-plate rounded-full px-7 py-2.5 text-xs sm:text-sm font-bold text-[#381F17] inline-flex items-center">
            Upcoming Consultations
          </div>

          {/* Mini Calendar Widget */}
          <div className="neu-card-md rounded-[26px] p-5 space-y-4">
            {/* Month header pill */}
            <div className="neu-inset-sm rounded-full py-1.5 px-6 text-xs font-bold uppercase tracking-wider text-[#C58B3C] text-center w-fit mx-auto">
              SEPTEMBER 2026
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[#7D6855] tracking-wider">
              <span>SUN</span>
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 text-center text-xs font-medium text-[#34150F] gap-y-2.5 items-center">
              {/* Empty offset for Sunday & Monday */}
              <span />
              <span />
              <span>01</span>
              <span>02</span>
              <span>03</span>
              <span>04</span>
              <span>05</span>

              <span>06</span>
              <span>07</span>
              <span>08</span>
              <span>09</span>
              <span>10</span>
              <span>11</span>
              <span>12</span>

              <span>13</span>
              <span>14</span>
              <span>15</span>
              <span>16</span>
              <span>17</span>
              <span>18</span>
              <span>19</span>

              <span>20</span>
              <span>21</span>
              <span>22</span>
              {/* Active / Current Day 23 */}
              <span className="w-7 h-7 rounded-full border-2 border-[#C58B3C] font-bold text-[#34150F] flex items-center justify-center mx-auto">
                23
              </span>
              <span>24</span>
              <span>25</span>
              <span>26</span>

              <span>27</span>
              <span>28</span>
              <span>29</span>
              <span>30</span>
            </div>
          </div>

          {/* List of Appointments Container (Warm Peach Plate) */}
          <div className="neu-plate rounded-[24px] p-5 space-y-3">
            <h4 className="text-xs sm:text-sm font-bold text-[#381F17] text-center pb-1">
              List of Appointments
            </h4>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {appointmentsToDisplay.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#7D6855]">
                  No consultations in this category.
                </div>
              ) : (
                appointmentsToDisplay.map((apt) => {
                  const isSelected = selectedAppointmentId === apt.id;
                  const isPending = apt.status === 'pending';
                  const isConfirmed = apt.status === 'confirmed';
                  return (
                    <button
                      key={apt.id}
                      type="button"
                      onClick={() => setSelectedAppointmentId(apt.id)}
                      className={`w-full rounded-2xl px-4 py-3 flex flex-col gap-1 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'neu-inset text-[#381F17] font-semibold ring-2 ring-[#C58B3C]/50'
                          : 'bg-[#DFC5A4]/40 hover:bg-[#DFC5A4]/80 text-[#381F17]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-semibold text-[#381F17] truncate">
                          {apt.client.name}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                            isPending
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : isConfirmed
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-stone-200 text-stone-700'
                          }`}
                        >
                          {isPending ? 'Pending' : isConfirmed ? 'Confirmed' : apt.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#685042] font-medium truncate">
                        {apt.timeTag}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Extruded "Pending Approval" pill */}
          <div className="neu-plate rounded-full px-7 py-2.5 text-xs sm:text-sm font-bold text-[#381F17] inline-flex items-center cursor-pointer hover:shadow-[inset_2px_2px_4px_rgba(165,135,105,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] transition-all">
            Pending Approval
          </div>
        </div>

        {/* ── Right Column: Consultation Detail Hero Card ───────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Authentic Neumorphic Consultation Card (Exact User Spec) */}
          <div className="neu-card rounded-[36px] sm:rounded-[40px] p-7 sm:p-9 lg:p-11 space-y-7">
            {/* Top Badges Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="neu-inset-sm rounded-full px-5 py-2 text-[11px] font-bold tracking-wider text-[#4A3227] uppercase">
                  {selectedConsultation.dateTag}
                </div>
                <div className="neu-inset-sm rounded-full px-5 py-2 text-[11px] font-semibold text-[#4A3227]">
                  {selectedConsultation.timeTag}
                </div>
              </div>

              {selectedConsultation.status === 'pending' ? (
                <div className="rounded-full px-5 py-2 text-[11px] font-bold uppercase tracking-wider bg-amber-400 text-[#23150F] shadow-sm shrink-0 self-start sm:self-auto border border-amber-500">
                  PENDING YOUR APPROVAL
                </div>
              ) : selectedConsultation.status === 'confirmed' ? (
                <div className="neu-badge-green rounded-full px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-white shrink-0 self-start sm:self-auto">
                  CONFIRMED APPOINTMENT
                </div>
              ) : (
                <div className="rounded-full px-5 py-2 text-[11px] font-bold uppercase tracking-wider bg-stone-300 text-stone-800 shrink-0 self-start sm:self-auto">
                  {selectedConsultation.status.toUpperCase()}
                </div>
              )}
            </div>

            {/* Client Profile Sub-Card (Extruded Warm Peach Plate) */}
            <div className="neu-plate rounded-[26px] p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-5 sm:gap-6 min-w-0">
                {/* Custom Avatar Icon matching Figma mockup */}
                <div className="shrink-0">
                  <AvatarSilhouetteIcon className="w-18 h-18 sm:w-20 sm:h-20" />
                </div>

                <div className="space-y-0.5 min-w-0">
                  <h4 className="font-cormorant text-2xl sm:text-[27px] font-bold text-[#381F17] leading-tight">
                    {selectedConsultation.client.name}
                  </h4>
                  <p className="text-xs font-medium text-[#685042] pt-0.5">
                    Age: {selectedConsultation.client.age} <span className="mx-1 text-[#8C7A6B]">|</span> Sex: {selectedConsultation.client.sex}
                  </p>
                  <p className="text-xs text-[#685042] leading-relaxed pt-0.5">
                    {selectedConsultation.client.address}
                  </p>
                  <p className="text-xs text-[#685042] pt-0.5">
                    {selectedConsultation.client.email} <span className="mx-1 text-[#8C7A6B]">|</span> {selectedConsultation.client.phone}
                  </p>
                </div>
              </div>

              {/* Monolithic Extruded Message Button on Peach Plate */}
              <button
                type="button"
                onClick={() => router.push('/lawyer/messages')}
                className="neu-btn-peach rounded-full px-8 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-[#4E3227] tracking-wide shrink-0 self-start md:self-center cursor-pointer hover:brightness-105 transition-all"
              >
                Message Client
              </button>
            </div>


            {/* Proof of Payment Verification Plate (when present) */}
            {selectedConsultation.payment && (
              <div className="neu-plate rounded-[24px] p-5 sm:p-6 space-y-3 bg-[#DFC5A4]/30 border border-[#D5C2AB]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💳</span>
                    <h4 className="font-sans text-xs sm:text-sm font-bold text-[#381F17] uppercase tracking-wider">
                      Client Proof of Payment & Transaction Record
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 self-start sm:self-auto">
                    Amount: ₱{(selectedConsultation.payment.amount ?? 1500).toLocaleString()}.00
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-[#5C4535]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8C7A6B] block">Method</span>
                    <span className="font-semibold text-[#23150F] uppercase">
                      {selectedConsultation.payment.method || 'GCash'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8C7A6B] block">Ref Number</span>
                    <span className="font-mono font-bold text-[#23150F]">
                      {selectedConsultation.payment.referenceNumber || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8C7A6B] block">Sender Name</span>
                    <span className="font-semibold text-[#23150F]">
                      {selectedConsultation.payment.payerName || selectedConsultation.client.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#8C7A6B] block">Receipt</span>
                    {selectedConsultation.payment.receiptBase64 ? (
                      <button
                        type="button"
                        onClick={() => setViewingReceipt(selectedConsultation.payment?.receiptBase64 || null)}
                        className="text-xs font-bold text-[#C58B3C] underline hover:text-[#23150F]"
                      >
                        Inspect Receipt 🔍
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-semibold">
                        {selectedConsultation.payment.receiptFileName || 'Receipt Attached'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Subject Matter & Description */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C58B3C]">
                {selectedConsultation.subjectCategory}
              </p>
              <h3 className="font-cormorant text-2xl sm:text-[28px] font-bold text-[#381F17] leading-snug">
                {selectedConsultation.subjectTitle}
              </h3>
              <div className="space-y-3 pt-1">
                <p className="text-xs sm:text-[13px] text-[#665246] leading-relaxed">
                  {selectedConsultation.caseDescription}
                </p>
                <p className="text-xs sm:text-[13px] text-[#665246] leading-relaxed">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                </p>
              </div>
            </div>

            {/* Bottom Action Row */}
            <div className="pt-2 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#C58B3C]">
                THIS CLIENT HAS SHARED THEIR DOCUMENTS WITH YOU.{' '}
                <span
                  onClick={() => router.push('/lawyer/documents')}
                  className="underline cursor-pointer hover:text-[#99431E] transition-colors font-bold"
                >
                  View Client Documents Vault
                </span>
              </p>

              <div className="flex items-center gap-3 shrink-0">
                {selectedConsultation.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      disabled={updatingId === selectedConsultation.id}
                      onClick={() => handleDecline(selectedConsultation.id)}
                      className="neu-btn rounded-2xl border-[1.5px] border-[#55382D] bg-[#ECE1D2] px-6 py-2.5 text-xs sm:text-sm font-semibold text-[#381F17] shadow-[2px_2px_6px_rgba(180,155,130,0.25)] hover:bg-red-50 hover:text-red-700 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Decline
                    </button>

                    <button
                      type="button"
                      disabled={updatingId === selectedConsultation.id}
                      onClick={() => handleApprove(selectedConsultation.id)}
                      className="px-7 py-2.5 rounded-2xl bg-[#23150F] hover:bg-[#381F17] text-[#ded7cb] text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {updatingId === selectedConsultation.id ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin text-[#ded7cb]" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Approving...</span>
                        </>
                      ) : (
                        <span>Approve Consultation</span>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => router.push('/lawyer/messages')}
                      className="neu-btn-espresso rounded-2xl px-6 py-2.5 text-xs sm:text-sm font-semibold text-white transition-all cursor-pointer hover:brightness-110 flex items-center gap-2"
                    >
                      <span>💬</span>
                      <span>Message Channel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.open(selectedConsultation.meetingLink || 'https://meet.justicia.ph', '_blank')}
                      className="neu-btn-caramel rounded-2xl px-7 py-2.5 text-xs sm:text-sm font-bold text-[#381F17] flex items-center gap-2.5 transition-all cursor-pointer hover:brightness-105"
                    >
                      <VideoCamIcon className="w-4 h-4 text-[#381F17]" />
                      <span>Join Meet</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Carousel Controls (Matching Figma Mockup) */}
          <div className="flex items-center justify-center gap-6 pt-2">
            <button
              type="button"
              onClick={() => setCarouselIndex((prev) => (prev > 0 ? prev - 1 : 3))}
              className="neu-btn w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-[#381F17] hover:text-[#C58B3C] cursor-pointer"
              aria-label="Previous"
            >
              ‹
            </button>

            <div className="flex items-center gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === carouselIndex
                      ? 'w-3 h-3 bg-[#C58B3C]'
                      : 'w-2.5 h-2.5 bg-[#B8A28E]'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCarouselIndex((prev) => (prev < 3 ? prev + 1 : 0))}
              className="neu-btn w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-[#381F17] hover:text-[#C58B3C] cursor-pointer"
              aria-label="Next"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Preview Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative max-w-lg w-full bg-[#EFE5D8] rounded-3xl p-6 shadow-2xl border border-[#D5C2AB] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D5C2AB]">
              <h3 className="font-cormorant text-xl font-bold text-[#34150F]">Proof of Payment Receipt</h3>
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="w-8 h-8 rounded-full bg-[#E5D5C1] flex items-center justify-center font-bold text-[#5C4535]"
              >
                ✕
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-black/5 p-2 flex items-center justify-center max-h-[70vh]">
              <img src={viewingReceipt} alt="Payment Receipt" className="max-h-[60vh] object-contain rounded-xl" />
            </div>
            <div className="text-right">
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="px-5 py-2 rounded-xl bg-[#23150F] text-[#ded7cb] text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default LawyerConsultationsView;
