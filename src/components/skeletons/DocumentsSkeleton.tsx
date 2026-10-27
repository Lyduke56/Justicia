'use client';

import React from 'react';

export function DocumentsSkeleton() {
  return (
    <div className="max-w-[1300px] mx-auto px-4 sm:px-8 py-6 space-y-8 animate-in fade-in duration-200">
      {/* Top Toolbar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* + New Button Skeleton */}
        <div className="h-10 w-24 rounded-2xl neu-skeleton" />

        {/* Breadcrumb Inset Pill Skeleton */}
        <div className="h-10 w-72 rounded-full neu-skeleton-inset" />

        {/* View Switcher & Search Bar */}
        <div className="flex items-center gap-4">
          <div className="h-10 w-20 rounded-2xl neu-skeleton" />
          <div className="h-10 w-52 rounded-full neu-skeleton-inset" />
        </div>
      </div>

      {/* 5-Column Grid of Folder Skeletons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8 items-start pt-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center p-3 rounded-2xl space-y-3"
          >
            {/* Folder Silhouette */}
            <div
              className="w-32 h-24 sm:w-36 sm:h-26 rounded-2xl neu-skeleton flex items-center justify-center"
              style={{
                boxShadow:
                  '4px 4px 10px rgba(182, 155, 130, 0.25), -4px -4px 10px #FFFFFF',
              }}
            />
            {/* Folder Name Line */}
            <div className="h-3 w-24 rounded neu-skeleton-text" />
          </div>
        ))}

        {/* Item 10: Circular + Button Skeleton */}
        <div className="flex flex-col items-center justify-center p-3 pt-6">
          <div
            className="w-20 h-20 sm:w-22 sm:h-22 rounded-full neu-skeleton flex items-center justify-center"
            style={{
              boxShadow:
                '6px 6px 14px rgba(182, 155, 130, 0.35), -6px -6px 14px #FFFFFF',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default DocumentsSkeleton;
