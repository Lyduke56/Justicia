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
      className="neu-card-interactive group block rounded-[22px] py-4 pl-3 pr-5 select-none"
    >
      <div className="flex items-center gap-2">
        {/* Silhouette Avatar Circle - height aligns with IBP Verified capsule & Specializations line */}
        <div className="w-[64px] h-[64px] sm:w-[80px] sm:h-[80px] shrink-0 flex items-center justify-center text-[#4A3528] group-hover:text-[#C58B3C] transition-colors">
          <svg
            className="w-full h-full"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </div>

        {/* Lawyer Details - height matches profile icon; justify-between aligns top and bottom */}
        <div className="min-w-0 flex-1 flex flex-col justify-between h-[64px] sm:h-[68px]">
          {/* Encapsulated IBP Verified Badge with Raised Look */}
          <div className="flex items-center">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full neu-raised-sm bg-[#E5D8CB] text-[9.5px] sm:text-[10px] font-lora font-semibold text-[#D39758] tracking-wide select-none leading-none">
              IBP Verified
            </span>
          </div>

          {/* Full Name in Lora */}
          <h3 className="font-lora font-bold text-xs sm:text-[13.5px] lg:text-[14px] text-[#34150F] truncate group-hover:text-[#C58B3C] transition-colors leading-tight">
            {lawyer.name}
          </h3>

          {/* Roll No & IBP Chapter in Inter with generous horizontal spacing */}
          <div className="flex items-center gap-2 text-[10px] sm:text-[10.5px] text-[#5C4535] font-inter font-normal truncate leading-none">
            <span>Roll No. {lawyer.rollNumber}</span>
            <span className="text-[#A89685] select-none">|</span>
            <span>IBP {lawyer.chapter}</span>
          </div>

          {/* Specializations in Inter with generous horizontal spacing */}
          <div className="flex items-center gap-1.5 text-[9.5px] sm:text-[10.5px] text-[#5C4535] font-inter font-normal truncate leading-none">
            {lawyer.specializations.map((spec, index) => (
              <React.Fragment key={spec}>
                {index > 0 && <span className="text-[#A89685] select-none">•</span>}
                <span className="shrink-0">{spec}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
