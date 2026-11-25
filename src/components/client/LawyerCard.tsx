import React from 'react';
import Link from 'next/link';
import { ProfilePhoto } from '@/components/shared/ProfilePhoto';

export interface LawyerItem {
  id: string;
  name: string;
  rollNumber: string;
  chapter: string;
  specializations: string[];
  hourlyRate?: number;
  rating?: number;
  isVerified?: boolean;
  /** Profile photo; missing, empty or broken URLs show the default profile icon. */
  photoUrl?: string | null;
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
        {/* Profile photo, or the default profile icon - height aligns with IBP Verified capsule & Specializations line */}
        <div className="w-[64px] h-[64px] sm:w-[80px] sm:h-[80px] shrink-0 flex items-center justify-center overflow-hidden rounded-full text-[#4A3528] group-hover:text-[#C58B3C] transition-colors">
          <ProfilePhoto src={lawyer.photoUrl} alt={lawyer.name} className="w-full h-full" />
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
