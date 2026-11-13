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
      needs_resubmission: lawyers.filter((l) => l.verification_status === 'needs_resubmission').length,
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
          <span className="admin-status admin-status-success inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            Verified & Active
          </span>
        );
      case 'pending':
        return (
          <span className="admin-status admin-status-warning inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold">
            <ClockIcon className="w-3.5 h-3.5" />
            Pending Review
          </span>
        );
      case 'needs_resubmission':
        return (
          <span className="admin-status admin-status-info inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold">
            <ClockIcon className="w-3.5 h-3.5" />
            Needs Info
          </span>
        );
      case 'rejected':
        return (
          <span className="admin-status admin-status-danger inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold">
            <XCircleIcon className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="admin-status admin-status-neutral inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Top KPI Stat Summary Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        {[
          { id: 'all', label: 'Total roster', count: counts.all, note: 'Registered attorneys' },
          { id: 'approved', label: 'Verified counsel', count: counts.approved, note: 'Approved credentials' },
          { id: 'pending', label: 'Pending review', count: counts.pending, note: 'Awaiting credential review' },
          { id: 'rejected', label: 'Not approved', count: counts.rejected, note: 'Applications declined' },
        ].map((item) => <button key={item.id} type="button" aria-pressed={selectedStatus === item.id} onClick={() => setSelectedStatus(item.id)} className="admin-card admin-filter p-5">
          <span className="block text-xs font-semibold text-[#705744]">{item.label}</span>
          <span className="admin-plate admin-filter-count px-4 py-3">{item.count}</span>
          <span className="mt-4 block text-[11px] text-[#705744]">{item.note}</span>
        </button>)}
      </div>

      {/* ─── Search, Tabs & Sorting Bar ────────────────────────────────────── */}
      <div
        className="admin-card p-4 sm:p-5 flex flex-col gap-5"
      >
        {/* Search Input */}
        <div className="relative w-full max-w-xl">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#806955]" />
          <input
            type="search"
            aria-label="Search lawyer directory"
            placeholder="Search by name, Bar roll #, IBP chapter, or specialty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-field w-full pl-10 pr-4 py-2.5 text-xs text-[#34150F] placeholder-[#A69584] transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 min-h-10 -translate-y-1/2 rounded-lg px-2 text-xs font-semibold text-[#705744]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="admin-plate admin-filter-bar">
          {[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'approved', label: 'Verified', count: counts.approved },
            { id: 'pending', label: 'Pending', count: counts.pending },
            { id: 'needs_resubmission', label: 'Needs Info', count: counts.needs_resubmission },
            { id: 'rejected', label: 'Rejected', count: counts.rejected },
            { id: 'draft', label: 'Draft', count: counts.draft },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={selectedStatus === tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`admin-button admin-filter px-3 py-1.5 transition flex items-center gap-1.5 ${
                selectedStatus === tab.id
                  ? 'bg-[#23150F] text-[#EFE5D8] shadow-sm'
                  : 'text-[#705744] hover:text-[#34150F] hover:bg-[#E8DCCB]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  selectedStatus === tab.id
                    ? 'bg-[#C58B3C] text-[#23150F]'
                    : 'bg-[#D5C7B5]/60 text-[#705744]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="directory-sort" className="text-[11px] font-bold text-[#705744] uppercase tracking-wider">Sort:</label>
          <select
            id="directory-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'name' | 'experience')}
            aria-label="Sort lawyers directory"
            className="admin-field text-xs px-3 py-2 text-[#34150F]"
          >
            <option value="newest">Recently Registered</option>
            <option value="name">Name (A-Z)</option>
            <option value="experience">Years of Experience</option>
          </select>
        </div>
      </div>

      {/* ─── Lawyers Table ─────────────────────────────────────────────────── */}
      <div
        className="admin-card overflow-hidden"
      >
        <div className="admin-table-scroll overflow-x-auto">
          <table className="admin-table w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] font-semibold">
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
                  <td colSpan={7} className="px-6 py-16 text-center text-[#705744]">
                    <ScaleIcon className="w-12 h-12 mx-auto text-[#806955] mb-3 opacity-60" />
                    <p className="font-semibold text-base text-[#34150F]">No lawyer records found</p>
                    <p className="text-xs text-[#705744] mt-1">
                      {searchQuery
                        ? `No results matching "${searchQuery}". Try adjusting your keywords.`
                        : 'No lawyers currently match this status filter.'}
                    </p>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="admin-button mt-3 inline-flex items-center text-xs font-semibold hover:underline"
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
                          <div className="w-10 h-10 rounded-2xl bg-[#23150F] text-[#80501F] font-lora font-bold text-base flex items-center justify-center shrink-0 shadow-sm">
                            {initials}
                          </div>
                          <div>
                            <Link
                              href={`/admin/lawyers/${lawyer.user_id}`}
                              className="font-semibold text-[#34150F] hover:text-[#80501F] transition text-sm flex items-center gap-1.5"
                            >
                              <span>{lawyer.full_name || 'Unnamed Attorney'}</span>
                            </Link>
                            <p className="text-[#705744] text-[11px] font-mono mt-0.5">
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
                          <div className="text-[11px] text-[#705744]">
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
                                className="admin-plate px-2 py-0.5 text-[#34150F] text-[10px] font-medium"
                              >
                                {area}
                              </span>
                            ))
                          ) : (
                            <span className="text-[#806955] italic text-[11px]">General Practice</span>
                          )}
                          {lawyer.practice_areas && lawyer.practice_areas.length > 3 && (
                            <span className="text-[10px] text-[#705744] self-center">
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
                        <div className="text-[11px] text-[#705744] font-mono">
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
                          <span className="text-[11px] text-[#705744]">
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
                              className="admin-button admin-button-primary inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-xs transition"
                            >
                              <ShieldCheckIcon className="w-3.5 h-3.5" />
                              <span>Verify Now</span>
                            </Link>
                          ) : (
                            <Link
                              href={`/admin/lawyers/${lawyer.user_id}`}
                              className="admin-button inline-flex items-center gap-1 px-3 py-1.5 font-medium text-xs transition"
                            >
                              <span>Dossier</span>
                              <ArrowRightIcon className="w-3 h-3 text-[#705744]" />
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
