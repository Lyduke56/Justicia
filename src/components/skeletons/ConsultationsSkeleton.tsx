'use client';

import React from 'react';

export function ConsultationsSkeleton() {
  return (
    <div className="max-w-[1240px] mx-auto px-2 sm:px-6 py-6 space-y-6 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-7 items-start">
        {/* Left Column (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Calendar Card Skeleton */}
          <div
            className="rounded-[28px] p-6 sm:p-7 bg-[#ECE1D2] space-y-5"
            style={{
              boxShadow:
                '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF',
            }}
          >
            {/* Top Month Pill */}
            <div className="flex justify-center">
              <div className="h-7 w-36 rounded-full neu-skeleton-inset" />
            </div>

            {/* Days header */}
            <div className="grid grid-cols-7 gap-2 pb-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-3 w-6 mx-auto neu-skeleton-text" />
              ))}
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="h-8 w-8 mx-auto rounded-full neu-skeleton" />
              ))}
            </div>
          </div>

          {/* Reminders Plate Skeleton */}
          <div
            className="rounded-[28px] p-6 sm:p-7 space-y-3.5 neu-skeleton-plate"
            style={{
              boxShadow:
                '10px 12px 28px rgba(165, 135, 105, 0.45), -10px -10px 24px rgba(255, 255, 255, 0.95)',
            }}
          >
            <div className="h-4 w-28 neu-skeleton-text" />
            <div className="space-y-2.5 pt-1">
              <div className="h-2.5 w-full neu-skeleton-text" />
              <div className="h-2.5 w-11/12 neu-skeleton-text" />
              <div className="h-2.5 w-4/5 neu-skeleton-text" />
              <div className="h-2.5 w-full neu-skeleton-text" />
              <div className="h-2.5 w-3/4 neu-skeleton-text" />
            </div>
          </div>
        </div>

        {/* Right Column (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div
            className="rounded-[28px] p-6 sm:p-8 bg-[#ECE1D2] space-y-5"
            style={{
              boxShadow:
                '14px 14px 32px rgba(182, 155, 130, 0.4), -14px -14px 32px #FFFFFF',
            }}
          >
            {/* Top Pills Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="h-7 w-48 rounded-full neu-skeleton-inset" />
              <div className="h-7 w-44 rounded-full neu-skeleton-inset" />
              <div className="h-7 w-36 rounded-full neu-skeleton" />
            </div>

            {/* Lawyer Banner Plate Skeleton */}
            <div
              className="rounded-[22px] p-5 sm:p-6 neu-skeleton-plate flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              style={{
                boxShadow:
                  '6px 8px 18px rgba(165, 135, 105, 0.4), -6px -6px 16px rgba(255, 255, 255, 0.9)',
              }}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-[#362519]/30 neu-skeleton shrink-0" />
                <div className="space-y-2">
                  <div className="h-5 w-48 neu-skeleton-text" />
                  <div className="h-2.5 w-36 neu-skeleton-text" />
                  <div className="h-2.5 w-44 neu-skeleton-text" />
                  <div className="h-2.5 w-40 neu-skeleton-text" />
                </div>
              </div>
              <div className="h-8 w-24 neu-skeleton-text shrink-0" />
            </div>

            {/* Subject Matter & Case Docket */}
            <div className="space-y-2.5 pt-1">
              <div className="h-3 w-40 neu-skeleton-text" />
              <div className="h-5 w-80 neu-skeleton-text" />
              <div className="space-y-2 pt-1">
                <div className="h-2.5 w-full neu-skeleton-text" />
                <div className="h-2.5 w-full neu-skeleton-text" />
                <div className="h-2.5 w-11/12 neu-skeleton-text" />
                <div className="h-2.5 w-full neu-skeleton-text" />
                <div className="h-2.5 w-4/5 neu-skeleton-text" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#D1BEA8]/60">
              <div className="h-9 w-20 rounded-xl neu-skeleton" />
              <div className="h-9 w-28 rounded-xl neu-skeleton" />
              <div className="h-9 w-28 rounded-xl neu-skeleton-plate" />
            </div>
          </div>

          {/* Pagination dots skeleton */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <div className="w-9 h-9 rounded-full neu-skeleton" />
            <div className="flex gap-2">
              <div className="w-2.5 h-2.5 rounded-full neu-skeleton-plate" />
              <div className="w-2.5 h-2.5 rounded-full neu-skeleton" />
              <div className="w-2.5 h-2.5 rounded-full neu-skeleton" />
              <div className="w-2.5 h-2.5 rounded-full neu-skeleton" />
            </div>
            <div className="w-9 h-9 rounded-full neu-skeleton" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConsultationsSkeleton;
