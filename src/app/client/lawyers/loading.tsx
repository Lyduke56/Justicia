import React from 'react';
import { LawyerGridSkeleton } from '@/components/skeletons';

export default function LawyersLoading() {
  return (
    <div className="p-5 sm:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Search Filters Bar Skeleton */}
      <div
        className="rounded-2xl p-4 sm:p-5 bg-[#ECE1D2] space-y-4"
        style={{
          boxShadow: '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="h-10 w-72 rounded-full neu-skeleton-inset" />
          <div className="flex items-center gap-3">
            <div className="h-9 w-28 rounded-xl neu-skeleton" />
            <div className="h-9 w-28 rounded-xl neu-skeleton" />
            <div className="h-9 w-28 rounded-xl neu-skeleton" />
          </div>
        </div>
      </div>

      {/* Grid of Lawyer Cards Skeletons */}
      <LawyerGridSkeleton count={8} />
    </div>
  );
}
