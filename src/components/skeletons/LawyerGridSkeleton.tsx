'use client';

import React from 'react';

export function LawyerGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 animate-in fade-in duration-200">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="neu-raised bg-[#E5D8CB] rounded-[22px] p-4 sm:p-5 space-y-4 select-none"
        >
          {/* Top row: Avatar + Details matching uncramped LawyerCard */}
          <div className="flex items-center gap-3 sm:gap-3.5">
            <div className="w-[64px] h-[64px] sm:w-[76px] sm:h-[76px] rounded-full bg-[#D4C4B2]/70 animate-pulse shrink-0" />
            <div className="min-w-0 flex-1 flex flex-col justify-between h-[68px] sm:h-[76px] py-0.5">
              <div className="h-3 w-16 rounded-full bg-[#D0BFAC]/70 animate-pulse" />
              <div className="h-4.5 w-40 rounded-md bg-[#CBB8A4]/80 animate-pulse" />
              <div className="h-3 w-28 rounded-md bg-[#D4C4B2]/70 animate-pulse" />
              <div className="h-3 w-32 rounded-md bg-[#D4C4B2]/70 animate-pulse" />
            </div>
          </div>

          {/* Metrics Plate Raised matching #D39758 at 30% Opacity */}
          <div
            className="w-full rounded-[10px] px-3.5 py-2.5 sm:py-3 space-y-2 shadow-[5px_5px_13px_0px_rgba(206,194,183,0.90),-5px_-5px_10px_0px_rgba(252,238,223,0.90),5px_-5px_10px_0px_rgba(206,194,183,0.20),-5px_5px_10px_0px_rgba(206,194,183,0.20),inset_-1px_-1px_2px_0px_rgba(206,194,183,0.50),inset_1px_1px_2px_0px_rgba(252,238,223,0.30)]"
            style={{ backgroundColor: 'rgba(211, 151, 88, 0.25)', minHeight: '82px' }}
          >
            <div className="flex justify-between items-center">
              <div className="h-2.5 w-16 rounded bg-[#341512]/20 animate-pulse" />
              <div className="h-2.5 w-32 rounded bg-[#341512]/20 animate-pulse" />
            </div>
            <div className="flex justify-between items-center">
              <div className="h-2.5 w-20 rounded bg-[#341512]/20 animate-pulse" />
              <div className="h-2.5 w-28 rounded bg-[#341512]/20 animate-pulse" />
            </div>
            <div className="flex justify-between items-center pt-0.5">
              <div className="h-2.5 w-16 rounded bg-[#341512]/20 animate-pulse" />
              <div className="h-3 w-24 rounded bg-[#341512]/25 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default LawyerGridSkeleton;
