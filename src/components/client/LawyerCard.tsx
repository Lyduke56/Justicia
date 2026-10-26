import React from 'react';
import Link from 'next/link';

export interface LawyerItem {
  id: string;
  name: string;
  rollNumber: string;
  chapter: string;
  specializations: string[];
  hourlyRate?: number;
  rating?: number;
  isVerified?: boolean;
}

interface LawyerCardProps {
  lawyer: LawyerItem;
}

export function LawyerCard({ lawyer }: LawyerCardProps) {
  return (
    <Link
      href={`/client/lawyers/${lawyer.id}`}
      className="group block rounded-2xl p-4 bg-[#EFE5D8] shadow-[5px_5px_12px_rgba(0,0,0,0.06),-5px_-5px_12px_rgba(255,255,255,0.9)] border border-[#E8DCCB]/60 hover:shadow-[7px_7px_18px_rgba(0,0,0,0.1),-7px_-7px_18px_rgba(255,255,255,1)] transition-all duration-200"
    >
      <div className="flex items-center gap-3.5">
        {/* Silhouette Avatar Circle */}
        <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full border-2 border-[#5C4535]/75 flex items-center justify-center shrink-0 group-hover:border-[#C58B3C] transition-colors">
          <svg
            className="w-8 h-8 text-[#5C4535] group-hover:text-[#C58B3C] transition-colors"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M6 20v-1a6 6 0 0 1 12 0v1" />
          </svg>
        </div>

        {/* Lawyer Details */}
        <div className="min-w-0 flex-1">
          {/* IBP Verified Badge */}
          <div className="flex items-center gap-1 text-[10px] font-semibold text-[#C58B3C] tracking-wide uppercase">
            <span>IBP Verified</span>
          </div>

          {/* Full Name */}
          <h3 className="font-cormorant font-bold text-sm sm:text-[15px] text-[#34150F] truncate group-hover:text-[#C58B3C] transition-colors leading-tight mt-0.5">
            {lawyer.name}
          </h3>

          {/* Roll No & IBP Chapter */}
          <p className="text-[10px] text-[#7D6855] uppercase tracking-wider font-medium mt-0.5 truncate">
            Roll No. {lawyer.rollNumber} <span className="opacity-60">|</span> IBP {lawyer.chapter}
          </p>

          {/* Specializations */}
          <p className="text-[10px] text-[#695444] font-normal truncate mt-0.5">
            {lawyer.specializations.join(' • ')}
          </p>
        </div>
      </div>
    </Link>
  );
}
