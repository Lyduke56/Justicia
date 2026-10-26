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
    <section className="space-y-6" aria-label="Recommended Lawyers section">
      {/* Capsule Pill Header */}
      <div>
        <span className="inline-block px-6 py-2 rounded-full bg-[#EFE5D8] text-[#34150F] font-cormorant text-lg sm:text-xl font-semibold shadow-[3px_3px_8px_rgba(0,0,0,0.06),-3px_-3px_8px_rgba(255,255,255,0.85)] border border-[#E5D7C5] select-none">
          Recommended Lawyers
        </span>
      </div>

      {/* 3x3 Lawyer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {currentLawyers.map((lawyer) => (
          <LawyerCard key={lawyer.id} lawyer={lawyer} />
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-center gap-4 pt-4 pb-8">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentPage === 1}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] disabled:opacity-30 disabled:hover:text-[#5C4535] transition-colors focus:outline-none"
          aria-label="Previous lawyers page"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>

        {/* Dots */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalPages }).map((_, idx) => {
            const pageNum = idx + 1;
            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  isActive ? 'bg-[#C58B3C] scale-125' : 'bg-[#3E2A1E]/70 hover:bg-[#3E2A1E]'
                }`}
                aria-label={`Go to page ${pageNum}`}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#5C4535] hover:text-[#C58B3C] disabled:opacity-30 disabled:hover:text-[#5C4535] transition-colors focus:outline-none"
          aria-label="Next lawyers page"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}
