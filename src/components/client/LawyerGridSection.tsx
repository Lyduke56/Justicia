'use client';

import React, { useState } from 'react';
import { LawyerCard, type LawyerItem } from './LawyerCard';
import { ChevronLeftIcon, ChevronRightIcon } from './ClientIcons';

interface LawyerGridSectionProps {
  initialLawyers: LawyerItem[];
}

export function LawyerGridSection({ initialLawyers }: LawyerGridSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const totalPages = Math.ceil(initialLawyers.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentLawyers = initialLawyers.slice(startIndex, startIndex + itemsPerPage);

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <section className="space-y-4" aria-label="Recommended Lawyers section">
      {/* Capsule Pill Header */}
      <div>
        <span
          className="inline-block px-4.5 py-3 rounded-full neu-raised-sm bg-[#D39758]/30 text-[#34150F] font-lora text-sm sm:text-[18px] font-semibold select-none mb-4"
          style={{ backgroundColor: 'rgba(211, 151, 88, 0.30)' }}
        >
          Recommended Lawyers
        </span>
      </div>

      {/* 3x3 Lawyer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {currentLawyers.map((lawyer) => (
          <LawyerCard key={lawyer.id} lawyer={lawyer} />
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-center gap-6 sm:gap-7 pt-6">
        {/* Previous Page Button - circle only when there are remaining previous pages */}
        {currentPage > 1 ? (
          <button
            type="button"
            onClick={handlePrev}
            className="size-11 rounded-full neu-raised-sm bg-[#E5D8CB] flex items-center justify-center text-[#583C37] hover:text-[#C58B3C] active:scale-95 transition-all cursor-pointer focus:outline-none"
            aria-label="Previous lawyers page"
          >
            <ChevronLeftIcon className="w-8 h-8 stroke-[2.5]" />
          </button>
        ) : (
          <div
            className="size-11 flex items-center justify-center text-[#583C37] select-none"
            aria-hidden="true"
          >
            <ChevronLeftIcon className="w-8 h-8 stroke-[2.5]" />
          </div>
        )}

        {/* Dots */}
        <div className="flex items-center gap-2.5">
          {Array.from({ length: totalPages }).map((_, idx) => {
            const pageNum = idx + 1;
            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`rounded-full transition-all cursor-pointer focus:outline-none ${isActive
                  ? 'w-3.5 h-3.5 bg-[#D39758]'
                  : 'w-2.5 h-2.5 bg-[#34150F] hover:bg-[#C58B3C]'
                  }`}
                aria-label={`Go to page ${pageNum}`}
              />
            );
          })}
        </div>

        {/* Next Page Button - circle only when there are remaining next pages */}
        {currentPage < totalPages ? (
          <button
            type="button"
            onClick={handleNext}
            className="size-11 rounded-full neu-raised-sm bg-[#E5D8CB] flex items-center justify-center text-[#583C37] hover:text-[#C58B3C] active:scale-95 transition-all cursor-pointer focus:outline-none"
            aria-label="Next lawyers page"
          >
            <ChevronRightIcon className="w-8 h-8 stroke-[2.5]" />
          </button>
        ) : (
          <div
            className="size-11 flex items-center justify-center text-[#583C37] select-none"
            aria-hidden="true"
          >
            <ChevronRightIcon className="w-8 h-8 stroke-[2.5]" />
          </div>
        )}
      </div>
    </section>
  );
}
