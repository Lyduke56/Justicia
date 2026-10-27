'use client';

import React from 'react';

export function LawyerDetailSkeleton() {
  return (
    <div className="max-w-[1180px] mx-auto px-2 sm:px-6 py-4 space-y-6 animate-in fade-in duration-200">
      {/* Back button line */}
      <div className="flex items-center gap-2 pb-1">
        <div className="h-4 w-44 neu-skeleton-text" />
      </div>

      {/* Banner Header Card Skeleton */}
      <div
        className="w-full rounded-[26px] p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 neu-skeleton-plate"
        style={{
          boxShadow:
            '10px 12px 28px rgba(165, 135, 105, 0.45), -10px -10px 24px rgba(255, 255, 255, 0.95)',
        }}
      >
        <div className="flex items-center gap-5 sm:gap-6">
          <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-2 border-[#362519]/40 neu-skeleton shrink-0" />
          <div className="space-y-2">
            <div className="h-6 sm:h-7 w-56 sm:w-72 neu-skeleton-text" />
            <div className="h-3 w-40 neu-skeleton-text" />
            <div className="h-3 w-48 neu-skeleton-text" />
            <div className="h-3 w-52 neu-skeleton-text" />
          </div>
        </div>

        <div className="shrink-0 flex items-baseline gap-2">
          <div className="h-8 sm:h-10 w-28 neu-skeleton-text" />
          <div className="h-4 w-16 neu-skeleton-text" />
        </div>
      </div>

      {/* Navigation Tabs Bar Skeleton */}
      <div className="flex items-center justify-center gap-3 sm:gap-6 py-2">
        <div className="h-9 w-24 rounded-full neu-skeleton-plate" />
        <div className="h-9 w-24 rounded-full neu-skeleton" />
        <div className="h-9 w-36 rounded-full neu-skeleton" />
        <div className="h-9 w-28 rounded-full neu-skeleton" />
      </div>

      {/* About Tab Content Skeleton */}
      <div className="space-y-8">
        {/* Top Row: Bio (8 cols) & Rates (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div
            className="lg:col-span-8 rounded-[28px] p-7 sm:p-8 bg-[#ECE1D2] space-y-3"
            style={{
              boxShadow:
                '12px 12px 30px rgba(182, 155, 130, 0.4), -12px -12px 30px #FFFFFF',
            }}
          >
            <div className="h-3 w-full neu-skeleton-text" />
            <div className="h-3 w-full neu-skeleton-text" />
            <div className="h-3 w-11/12 neu-skeleton-text" />
            <div className="h-3 w-full neu-skeleton-text" />
            <div className="h-3 w-4/5 neu-skeleton-text" />
            <div className="h-3 w-full neu-skeleton-text" />
            <div className="h-3 w-3/4 neu-skeleton-text" />
          </div>

          <div
            className="lg:col-span-4 rounded-[28px] p-6 sm:p-7 neu-skeleton-plate flex flex-col justify-center space-y-4"
            style={{
              boxShadow:
                '10px 12px 28px rgba(165, 135, 105, 0.45), -10px -10px 24px rgba(255, 255, 255, 0.95)',
            }}
          >
            <div className="h-5 w-40 mx-auto neu-skeleton-text" />
            <div className="space-y-3 pt-2">
              <div className="flex justify-between">
                <div className="h-3 w-32 neu-skeleton-text" />
                <div className="h-3 w-16 neu-skeleton-text" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-32 neu-skeleton-text" />
                <div className="h-3 w-16 neu-skeleton-text" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-32 neu-skeleton-text" />
                <div className="h-3 w-16 neu-skeleton-text" />
              </div>
            </div>
          </div>
        </div>

        {/* Professional Background Section */}
        <div className="space-y-4">
          <div className="h-6 w-52 neu-skeleton-text" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[24px] p-6 bg-[#ECE1D2] space-y-3"
                style={{
                  boxShadow:
                    '8px 8px 20px rgba(182, 155, 130, 0.35), -8px -8px 20px #FFFFFF',
                }}
              >
                <div className="h-4 w-36 neu-skeleton-text" />
                <div className="space-y-2 pt-1">
                  <div className="h-2.5 w-full neu-skeleton-text" />
                  <div className="h-2.5 w-5/6 neu-skeleton-text" />
                  <div className="h-2.5 w-4/5 neu-skeleton-text" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LawyerDetailSkeleton;
