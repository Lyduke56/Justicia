'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ShieldCheckIcon, ScaleIcon } from '@/components/admin/AdminIcons';

function SearchIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CheckCircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ClockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function XCircleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function ArrowRightIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export interface LawyerDirectoryItem {
  user_id: string;
  email: string;
  full_name: string;
  roll_number?: string | null;
  ibp_chapter?: string | null;
  bar_passer_year?: number | null;
  practice_areas?: string[] | null;
  languages?: string[] | null;
  experience_years?: number | null;
  fee_standard_60min?: number | null;
  verification_status: string;
  is_visible?: boolean | null;
  is_available?: boolean | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

interface LawyerDirectoryTableProps {
  lawyers: LawyerDirectoryItem[];
}

export function LawyerDirectoryTable({ lawyers }: LawyerDirectoryTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'name' | 'experience'>('newest');

  // Compute status counts
  const counts = useMemo(() => {
    return {
      all: lawyers.length,
      approved: lawyers.filter((l) => l.verification_status === 'approved').length,
      pending: lawyers.filter((l) => l.verification_status === 'pending').length,
      needs_info: lawyers.filter((l) => l.verification_status === 'needs_info').length,
      rejected: lawyers.filter((l) => l.verification_status === 'rejected').length,
      draft: lawyers.filter((l) => !l.verification_status || l.verification_status === 'draft').length,
    };
  }, [lawyers]);

  // Filter & sort lawyers
  const filteredLawyers = useMemo(() => {
    return lawyers
      .filter((lawyer) => {
        // Status filter
        if (selectedStatus !== 'all') {
          const status = lawyer.verification_status || 'draft';
          if (selectedStatus === 'draft') {
            if (status !== 'draft') return false;
          } else if (status !== selectedStatus) {
            return false;
          }
        }

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = lawyer.full_name?.toLowerCase().includes(q);
          const matchEmail = lawyer.email?.toLowerCase().includes(q);
          const matchRoll = lawyer.roll_number?.toLowerCase().includes(q);
          const matchChapter = lawyer.ibp_chapter?.toLowerCase().includes(q);
          const matchAreas = lawyer.practice_areas?.some((a) => a.toLowerCase().includes(q));
          return matchName || matchEmail || matchRoll || matchChapter || matchAreas;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return (a.full_name || '').localeCompare(b.full_name || '');
        }
        if (sortBy === 'experience') {
          return (b.experience_years || 0) - (a.experience_years || 0);
        }
        // default: newest
        const dateA = new Date(a.submitted_at || a.created_at).getTime();
        const dateB = new Date(b.submitted_at || b.created_at).getTime();
        return dateB - dateA;
      });
  }, [lawyers, selectedStatus, searchQuery, sortBy]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            Verified & Active
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
            <ClockIcon className="w-3.5 h-3.5" />
            Pending Review
          </span>
        );
      case 'needs_info':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-300">
            <ClockIcon className="w-3.5 h-3.5" />
            Needs Info
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircleIcon className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-300">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Top KPI Stat Summary Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setSelectedStatus('all')}
          className={`cursor-pointer p-4 rounded-2xl bg-[#EFE5D8] border transition-all ${
            selectedStatus === 'all'
              ? 'border-[#C58B3C] shadow-[inset_2px_2px_5px_rgba(0,0,0,0.06)]'
              : 'border-[#E8DCCB] hover:border-[#C58B3C]/50'
          }`}
          style={{ boxShadow: '4px 4px 10px rgba(0,0,0,0.04), -4px -4px 10px rgba(255,255,255,0.8)' }}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#7D6855]">Total Roster</div>
          <div className="mt-1 font-cormorant text-3xl font-bold text-[#34150F]">{counts.all}</div>
          <div className="text-[10px] text-[#A69584] mt-0.5">Registered attorneys</div>
        </div>

        <div
          onClick={() => setSelectedStatus('approved')}
          className={`cursor-pointer p-4 rounded-2xl bg-[#EFE5D8] border transition-all ${
            selectedStatus === 'approved'
              ? 'border-emerald-600 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.06)]'
              : 'border-[#E8DCCB] hover:border-emerald-500/50'
          }`}
          style={{ boxShadow: '4px 4px 10px rgba(0,0,0,0.04), -4px -4px 10px rgba(255,255,255,0.8)' }}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Verified Counsel</div>
          <div className="mt-1 font-cormorant text-3xl font-bold text-emerald-900">{counts.approved}</div>
          <div className="text-[10px] text-emerald-700/80 mt-0.5">Active & visible in search</div>
        </div>

        <div
          onClick={() => setSelectedStatus('pending')}
          className={`cursor-pointer p-4 rounded-2xl bg-[#EFE5D8] border transition-all ${
            selectedStatus === 'pending'
              ? 'border-amber-600 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.06)]'
              : 'border-[#E8DCCB] hover:border-amber-500/50'
          }`}
          style={{ boxShadow: '4px 4px 10px rgba(0,0,0,0.04), -4px -4px 10px rgba(255,255,255,0.8)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Pending Review</span>
            {counts.pending > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <div className="mt-1 font-cormorant text-3xl font-bold text-amber-900">{counts.pending}</div>
          <div className="text-[10px] text-amber-700/80 mt-0.5">Awaiting Bar Roll check</div>
        </div>

        <div
          onClick={() => setSelectedStatus('rejected')}
          className={`cursor-pointer p-4 rounded-2xl bg-[#EFE5D8] border transition-all ${
            selectedStatus === 'rejected'
              ? 'border-rose-600 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.06)]'
              : 'border-[#E8DCCB] hover:border-rose-500/50'
          }`}
          style={{ boxShadow: '4px 4px 10px rgba(0,0,0,0.04), -4px -4px 10px rgba(255,255,255,0.8)' }}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Rejected / Denied</div>
          <div className="mt-1 font-cormorant text-3xl font-bold text-rose-900">{counts.rejected}</div>
          <div className="text-[10px] text-rose-700/80 mt-0.5">Did not satisfy criteria</div>
        </div>
      </div>

      {/* ─── Search, Tabs & Sorting Bar ────────────────────────────────────── */}
      <div
        className="p-4 sm:p-5 rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80 flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{ boxShadow: '6px 6px 14px rgba(0,0,0,0.06), -6px -6px 14px rgba(255,255,255,0.9)' }}
      >
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69584]" />
          <input
            type="text"
            placeholder="Search by name, Bar roll #, IBP chapter, or specialty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl bg-[#E8DCCB]/40 border border-[#D5C7B5] focus:outline-none focus:border-[#C58B3C] text-[#34150F] placeholder-[#A69584] transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#A69584] hover:text-[#34150F]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-[#E8DCCB]/50 border border-[#D5C7B5]/60 text-xs font-semibold overflow-x-auto">
          {[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'approved', label: 'Verified', count: counts.approved },
            { id: 'pending', label: 'Pending', count: counts.pending },
            { id: 'needs_info', label: 'Needs Info', count: counts.needs_info },
            { id: 'rejected', label: 'Rejected', count: counts.rejected },
            { id: 'draft', label: 'Draft', count: counts.draft },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                selectedStatus === tab.id
                  ? 'bg-[#23150F] text-[#EFE5D8] shadow-sm'
                  : 'text-[#7D6855] hover:text-[#34150F] hover:bg-[#E8DCCB]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  selectedStatus === tab.id
                    ? 'bg-[#C58B3C] text-[#23150F]'
                    : 'bg-[#D5C7B5]/60 text-[#7D6855]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-[11px] font-bold text-[#7D6855] uppercase tracking-wider">Sort:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'name' | 'experience')}
            aria-label="Sort lawyers directory"
            className="text-xs px-3 py-2 rounded-xl bg-[#E8DCCB]/40 border border-[#D5C7B5] text-[#34150F] focus:outline-none focus:border-[#C58B3C]"
          >
            <option value="newest">Recently Registered</option>
            <option value="name">Name (A-Z)</option>
            <option value="experience">Years of Experience</option>
          </select>
        </div>
      </div>

      {/* ─── Lawyers Table ─────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl bg-[#EFE5D8] border border-[#E8DCCB]/80 overflow-hidden"
        style={{ boxShadow: '8px 8px 18px rgba(0,0,0,0.06), -8px -8px 18px rgba(255,255,255,0.9)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#23150F] text-[#ded7cb] text-[11px] uppercase tracking-wider font-semibold border-b border-[#352219]">
                <th className="px-6 py-4">Counsel Profile</th>
                <th className="px-6 py-4">Bar Roll & Chapter</th>
                <th className="px-6 py-4">Practice Areas</th>
                <th className="px-6 py-4">Exp & Rate</th>
                <th className="px-6 py-4">Verification</th>
                <th className="px-6 py-4">Directory Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DCCB]/70 text-xs">
              {filteredLawyers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-[#7D6855]">
                    <ScaleIcon className="w-12 h-12 mx-auto text-[#A69584] mb-3 opacity-60" />
                    <p className="font-semibold text-base text-[#34150F]">No lawyer records found</p>
                    <p className="text-xs text-[#7D6855] mt-1">
                      {searchQuery
                        ? `No results matching "${searchQuery}". Try adjusting your keywords.`
                        : 'No lawyers currently match this status filter.'}
                    </p>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="mt-3 inline-flex items-center text-xs font-semibold text-[#C58B3C] hover:underline"
                      >
                        Clear search filter
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredLawyers.map((lawyer) => {
                  const initials = (lawyer.full_name || 'L')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();

                  const isPending = lawyer.verification_status === 'pending';

                  return (
                    <tr
                      key={lawyer.user_id}
                      className="hover:bg-[#E8DCCB]/30 transition-colors"
                    >
                      {/* Counsel Profile */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-[#23150F] text-[#C58B3C] font-cormorant font-bold text-base flex items-center justify-center shrink-0 shadow-sm">
                            {initials}
                          </div>
                          <div>
                            <Link
                              href={`/admin/lawyers/${lawyer.user_id}`}
                              className="font-semibold text-[#34150F] hover:text-[#C58B3C] transition text-sm flex items-center gap-1.5"
                            >
                              <span>{lawyer.full_name || 'Unnamed Attorney'}</span>
                            </Link>
                            <p className="text-[#7D6855] text-[11px] font-mono mt-0.5">
                              {lawyer.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Bar Roll & Chapter */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className="font-mono font-semibold text-[#34150F]">
                            {lawyer.roll_number ? `Roll #${lawyer.roll_number}` : 'Roll: Pending'}
                          </div>
                          <div className="text-[11px] text-[#7D6855]">
                            {lawyer.ibp_chapter || 'IBP Unspecified'}
                            {lawyer.bar_passer_year ? ` (${lawyer.bar_passer_year})` : ''}
                          </div>
                        </div>
                      </td>

                      {/* Practice Areas */}
                      <td className="px-6 py-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {lawyer.practice_areas && lawyer.practice_areas.length > 0 ? (
                            lawyer.practice_areas.slice(0, 3).map((area, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-lg bg-[#E8DCCB] text-[#34150F] text-[10px] font-medium"
                              >
                                {area}
                              </span>
                            ))
                          ) : (
                            <span className="text-[#A69584] italic text-[11px]">General Practice</span>
                          )}
                          {lawyer.practice_areas && lawyer.practice_areas.length > 3 && (
                            <span className="text-[10px] text-[#7D6855] self-center">
                              +{lawyer.practice_areas.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Exp & Rate */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-[#34150F]">
                          {lawyer.experience_years ? `${lawyer.experience_years} yrs exp` : '—'}
                        </div>
                        <div className="text-[11px] text-[#7D6855] font-mono">
                          {lawyer.fee_standard_60min
                            ? `₱${Number(lawyer.fee_standard_60min).toLocaleString()} / hr`
                            : 'Rate: Not set'}
                        </div>
                      </td>

                      {/* Verification Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(lawyer.verification_status || 'draft')}
                      </td>

                      {/* Directory Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              lawyer.is_visible && lawyer.verification_status === 'approved'
                                ? 'bg-emerald-500'
                                : 'bg-stone-400'
                            }`}
                          />
                          <span className="text-[11px] text-[#7D6855]">
                            {lawyer.is_visible && lawyer.verification_status === 'approved'
                              ? 'Publicly Listed'
                              : 'Hidden / Unlisted'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isPending ? (
                            <Link
                              href={`/admin/lawyers/${lawyer.user_id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C58B3C] text-[#23150F] font-semibold text-xs hover:bg-[#B37B2F] transition shadow-sm"
                            >
                              <ShieldCheckIcon className="w-3.5 h-3.5" />
                              <span>Verify Now</span>
                            </Link>
                          ) : (
                            <Link
                              href={`/admin/lawyers/${lawyer.user_id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#E8DCCB] text-[#34150F] font-medium text-xs hover:bg-[#D5C7B5] transition"
                            >
                              <span>Dossier</span>
                              <ArrowRightIcon className="w-3 h-3 text-[#7D6855]" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
