'use client';

import Link from 'next/link';
import { LawyerVerificationQueue, type LawyerQueueItem } from '@/components/admin/LawyerVerificationQueue';

interface AdminVerificationQueueViewProps {
  lawyers?: LawyerQueueItem[];
}

export function AdminVerificationQueueView({ lawyers = [] }: AdminVerificationQueueViewProps) {
  const pendingCount = lawyers.filter((lawyer) => lawyer.verification_status === 'pending').length;

  return (
    <div className="admin-page">
      {/* ─── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/dashboard"
              className="text-[11px] font-bold tracking-[0.2em] text-[#705744] hover:text-[#34150F] uppercase cursor-pointer"
            >
              Platform Overview
            </Link>
            <span className="text-[#806955]">/</span>
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#80501F] uppercase">
              Verification Queue
            </span>
          </div>

          <h1 className="font-lora text-4xl sm:text-5xl font-medium text-[#34150F] tracking-tight leading-[1.1] mt-1">
            Lawyer Verification Queue
          </h1>
          <p className="text-sm text-[#705744] mt-1.5 max-w-2xl">
            Review submitted lawyer profiles and record a decision after checking their credentials.
          </p>
        </div>

        {/* Quick status pill */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div
            className="admin-plate px-5 py-3 text-xs font-semibold text-[#34150F] flex items-center gap-2.5"
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
