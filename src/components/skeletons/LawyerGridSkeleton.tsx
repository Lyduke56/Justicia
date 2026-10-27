'use client';

import React from 'react';

export function LawyerGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4 animate-in fade-in duration-200">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl p-3.5 sm:p-4 bg-[#ECE1D2] space-y-3"
          style={{
            boxShadow: '5px 5px 14px rgba(182, 155, 130, 0.35), -5px -5px 14px #FFFFFF',
          }}
        >
          {/* Top row: Avatar + Details */}
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full neu-skeleton-plate shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="h-2.5 w-16 neu-skeleton-text" />
              <div className="h-4 w-32 neu-skeleton-text" />
              <div className="h-2.5 w-24 neu-skeleton-text" />
              <div className="h-2.5 w-28 neu-skeleton-text" />
            </div>
          </div>

          {/* Metrics Inset Box */}
          <div
            className="rounded-xl p-2.5 space-y-2 neu-skeleton-inset"
            style={{ minHeight: '84px' }}
          >
            <div className="flex justify-between items-center">
              <div className="h-2 w-14 neu-skeleton-text" />
              <div className="h-2 w-28 neu-skeleton-text" />
            </div>
            <div className="flex justify-between items-center">
              <div className="h-2 w-16 neu-skeleton-text" />
              <div className="h-2 w-24 neu-skeleton-text" />
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-[#D1BEA8]/40">
              <div className="h-2 w-16 neu-skeleton-text" />
              <div className="h-3 w-20 neu-skeleton-text" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default LawyerGridSkeleton;
