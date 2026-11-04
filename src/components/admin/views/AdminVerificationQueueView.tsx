'use client';

import Link from 'next/link';
import { LawyerVerificationQueue, type LawyerQueueItem } from '@/components/admin/LawyerVerificationQueue';

interface AdminVerificationQueueViewProps {
  lawyers?: LawyerQueueItem[];
}

export function AdminVerificationQueueView({ lawyers = [] }: AdminVerificationQueueViewProps) {
  const pendingCount = lawyers.filter((lawyer) => lawyer.verification_status === 'pending').length;

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
              Verification Queue
            </span>
          </div>

          <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F] tracking-tight leading-[1.1] mt-1">
            Lawyer Verification Queue
          </h1>
          <p className="text-sm text-[#7D6855] mt-1.5 max-w-2xl">
            Review submitted lawyer profiles and record a decision after checking their credentials.
          </p>
        </div>

        {/* Quick status pill */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div
            className="px-5 py-3 rounded-2xl bg-[#EFE5D8] border border-[#E8DCCB] text-xs font-semibold text-[#34150F] shadow-sm flex items-center gap-2.5"
            style={{ boxShadow: '4px 4px 10px rgba(0,0,0,0.06), -3px -3px 10px rgba(255,255,255,0.9)' }}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${pendingCount > 0 ? 'bg-[#C58B3C]' : 'bg-emerald-500'}`} />
            <span>
              {`${pendingCount} Pending Verification${pendingCount === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Queue Component ──────────────────────────────────────────────── */}
      <LawyerVerificationQueue lawyers={lawyers} />
    </div>
  );
}
