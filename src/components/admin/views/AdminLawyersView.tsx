'use client';

import Link from 'next/link';
import { LawyerDirectoryTable, type LawyerDirectoryItem } from '@/components/admin/LawyerDirectoryTable';
import { ShieldCheckIcon } from '@/components/admin/AdminIcons';

interface AdminLawyersViewProps {
  lawyers?: LawyerDirectoryItem[];
}

export function AdminLawyersView({ lawyers = [] }: AdminLawyersViewProps) {

  const pendingCount = lawyers.filter((l) => l.verification_status === 'pending').length;

  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-7xl mx-auto space-y-8">
      {/* ─── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/dashboard"
              className="text-[11px] font-bold tracking-[0.2em] text-[#7D6855] hover:text-[#34150F] uppercase cursor-pointer"
            >
              Platform Overview
            </Link>
            <span className="text-[#A69584]">/</span>
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#C58B3C] uppercase">
              Lawyer Directory
            </span>
          </div>

          <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F] tracking-tight leading-[1.1] mt-1">
            Lawyer Directory & Roster
          </h1>
          <p className="text-sm text-[#7D6855] mt-1.5 max-w-2xl">
            Browse, filter, and inspect registered Philippine counsel. Review credential statuses, public directory visibility, and Bar Roll registrations.
          </p>
        </div>

        {/* Verification Queue quick link */}
        <Link
          href="/admin/lawyers/verification-queue"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#C58B3C] text-[#23150F] font-semibold text-xs tracking-wide shadow-[4px_4px_10px_rgba(0,0,0,0.1),-3px_-3px_10px_rgba(255,255,255,0.8)] hover:bg-[#B37B2F] transition-all shrink-0 self-start md:self-auto cursor-pointer"
        >
          <ShieldCheckIcon className="w-4 h-4" />
          <span>Verification Queue</span>
          {pendingCount > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-[#23150F] text-[#EFE5D8] text-[10px] font-bold">
              {pendingCount} Pending
            </span>
          )}
        </Link>
      </div>

      {/* ─── Lawyer Directory Table Component ─────────────────────────────── */}
      <LawyerDirectoryTable lawyers={lawyers} />
    </div>
  );
}
